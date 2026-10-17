import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/pages/Payments.tsx', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('Payments.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['createInvoice', 'recordPayment', 'saveEdit', 'readError'];
const handlers = new Map();
function visit(node) {
  if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(parsed))) handlers.set(node.name.getText(parsed), node.initializer.getText(parsed));
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.equal(handlers.size, names.length);
const compiled = ts.transpileModule(`${names.map(name => `const ${name}=${handlers.get(name)};`).join('\n')} module.exports={createInvoice,recordPayment,saveEdit};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
}).outputText;

function paymentFixture(response = { ok: true }) {
  const calls = { requests: [], busy: [], errors: [], successes: [], loads: 0 };
  const savingActionRef = { current: null };
  let currentResponse = response;
  const module = { exports: {} };
  runInNewContext(compiled, {
    module, savingAction: null, savingActionRef,
    form: { order_id: 'fixture-order', total: 100, due_date: '2026-11-15', notes: '' },
    payForm: { invoiceId: 'fixture-invoice', amount: 25, method: 'bank_transfer', ref: 'QA-REF' },
    editTarget: { id: 'fixture-invoice' }, editForm: { total: 100, due_date: '2026-11-15' },
    setSavingAction: value => calls.busy.push(value),
    setShowForm: () => {}, setForm: () => {}, setPayForm: () => {}, setEditTarget: () => {},
    t: key => key, toast: { error: value => calls.errors.push(value), success: value => calls.successes.push(value) },
    console: { error: () => {} },
    load: () => { calls.loads += 1; },
    fetch: async (url, options) => {
      calls.requests.push({ url, method: options.method, payload: JSON.parse(options.body) });
      return typeof currentResponse === 'function' ? currentResponse() : currentResponse;
    },
  });
  return { actions: module.exports, calls, savingActionRef, setResponse: value => { currentResponse = value; } };
}

for (const action of ['createInvoice', 'recordPayment', 'saveEdit']) {
  test(`payment action ${action} prevents immediate duplicate writes`, async () => {
    let finish;
    const pending = new Promise(resolve => { finish = resolve; });
    const fixture = paymentFixture(() => pending);
    const first = fixture.actions[action]();
    const second = fixture.actions[action]();
    const submitted = fixture.calls.requests.length;
    finish({ ok: true });
    await Promise.all([first, second]);
    assert.equal(submitted, 1);
    assert.equal(fixture.calls.loads, 1);
    assert.equal(fixture.calls.successes.length, 1);
    assert.equal(fixture.savingActionRef.current, null);
  });
}

test('pending payment-page writes block other money actions until completion', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const fixture = paymentFixture(() => pending);
  const creation = fixture.actions.createInvoice();
  const payment = fixture.actions.recordPayment();
  finish({ ok: true });
  await Promise.all([creation, payment]);
  assert.equal(fixture.calls.requests.length, 1);
  assert.equal(fixture.calls.requests[0].url, '/api/payments');
});

test('rejected payment writes show the API error and remain retryable with the original amount', async () => {
  const fixture = paymentFixture({ ok: false, json: async () => ({ error: 'Anonymous payment rejection' }) });
  await fixture.actions.recordPayment();
  assert.deepEqual(fixture.calls.errors, ['Anonymous payment rejection']);
  assert.equal(fixture.calls.loads, 0);
  assert.equal(fixture.savingActionRef.current, null);
  fixture.setResponse({ ok: true });
  await fixture.actions.recordPayment();
  assert.equal(fixture.calls.requests.length, 2);
  assert.equal(fixture.calls.requests[1].payload.amount, 25);
  assert.equal(fixture.calls.requests[1].url, '/api/payments/fixture-invoice/pay');
  assert.equal(fixture.calls.loads, 1);
});
