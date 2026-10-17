import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/pages/OrderDetail.tsx', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('OrderDetail.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
let readError;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'createInvoice') handler = node.initializer;
  if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'readError') readError = node.initializer;
  if (ts.isJsxAttribute(node) && node.name.getText(parsed) === 'onClick'
    && node.initializer && ts.isJsxExpression(node.initializer)
    && node.initializer.expression?.getText(parsed).includes("fetch('/api/payments'")) {
    handler = node.initializer.expression;
  }
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.ok(handler, 'Order invoice creation handler is missing');
assert.ok(readError, 'API error reader is missing');
const compiled = ts.transpileModule(`const readError = ${readError.getText(parsed)}; module.exports = ${handler.getText(parsed)};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
}).outputText;

const success = () => ({ ok: true, json: async () => ({ id: 'fixture-invoice', invoice_number: 'INV-QA-001' }) });

function invoiceFixture({ response = success(), creatingInvoice = false, savingEdit = false, savingStatus = false, order = { total: 265.64 } } = {}) {
  const calls = { requests: [], busy: [], errors: [], successes: [] };
  const invoiceInFlight = { current: false };
  const location = { href: '' };
  let currentResponse = response;
  const module = { exports: {} };
  runInNewContext(compiled, {
    module, id: 'fixture-order', order, creatingInvoice, savingEdit, savingStatus, invoiceInFlight,
    setCreatingInvoice: value => calls.busy.push(value),
    t: (key, values) => values ? `${key}:${values.number}` : key,
    toast: { error: value => calls.errors.push(value), success: value => calls.successes.push(value) },
    window: { location },
    fetch: async (url, options) => {
      calls.requests.push({ url, method: options.method, payload: JSON.parse(options.body) });
      return typeof currentResponse === 'function' ? currentResponse() : currentResponse;
    },
  });
  return { action: module.exports, calls, location, invoiceInFlight, setResponse: value => { currentResponse = value; } };
}

test('invoice creation submits the order amount and navigates after a validated response', async () => {
  const fixture = invoiceFixture();
  await fixture.action();
  assert.equal(fixture.calls.requests.length, 1);
  const request = fixture.calls.requests[0];
  assert.equal(request.url, '/api/payments');
  assert.equal(request.method, 'POST');
  assert.equal(request.payload.order_id, 'fixture-order');
  assert.equal(request.payload.total, 265.64);
  assert.match(request.payload.due_date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(fixture.location.href, '/payments');
  assert.deepEqual(fixture.calls.successes, ['page.orderDetail.invoiceCreated:INV-QA-001']);
  assert.deepEqual(fixture.calls.errors, []);
  assert.deepEqual(fixture.calls.busy, [true, false]);
});

test('immediate repeated invoice actions submit one receivable before React rerenders', async () => {
  let resolveRequest;
  const pending = new Promise(resolve => { resolveRequest = resolve; });
  const fixture = invoiceFixture({ response: () => pending });
  const first = fixture.action();
  const second = fixture.action();
  assert.equal(fixture.calls.requests.length, 1, 'Only one invoice POST is allowed while the first is pending');
  assert.deepEqual(fixture.calls.busy, [true]);
  resolveRequest(success());
  await Promise.all([first, second]);
  assert.equal(fixture.calls.successes.length, 1);
  assert.deepEqual(fixture.calls.busy, [true, false]);
  assert.equal(fixture.invoiceInFlight.current, false);
});

test('invoice API rejection preserves the error message and permits a subsequent retry', async () => {
  const fixture = invoiceFixture({ response: { ok: false, json: async () => ({ message: 'Invoice total must be greater than 0' }) } });
  await fixture.action();
  assert.deepEqual(fixture.calls.errors, ['Invoice total must be greater than 0']);
  assert.equal(fixture.location.href, '');
  assert.deepEqual(fixture.calls.successes, []);
  fixture.setResponse(success());
  await fixture.action();
  assert.equal(fixture.calls.requests.length, 2);
  assert.equal(fixture.location.href, '/payments');
  assert.deepEqual(fixture.calls.busy, [true, false, true, false]);
});

test('invalid or unreachable invoice responses do not claim success and remain retryable', async () => {
  for (const response of [
    { ok: true, json: async () => ({}) },
    { ok: true, json: async () => { throw new Error('Invalid JSON'); } },
    () => { throw new Error('Network unavailable'); },
  ]) {
    const fixture = invoiceFixture({ response });
    await fixture.action();
    assert.deepEqual(fixture.calls.errors, ['page.orderDetail.invoiceCreateFailed']);
    assert.equal(fixture.location.href, '');
    assert.deepEqual(fixture.calls.successes, []);
    fixture.setResponse(success());
    await fixture.action();
    assert.equal(fixture.calls.requests.length, 2);
    assert.equal(fixture.location.href, '/payments');
  }
});

test('invoice creation respects existing order and save-state blockers', async () => {
  for (const options of [{ order: null }, { creatingInvoice: true }, { savingEdit: true }, { savingStatus: true }]) {
    const fixture = invoiceFixture(options);
    await fixture.action();
    assert.deepEqual(fixture.calls.requests, []);
    assert.deepEqual(fixture.calls.busy, []);
  }
});
