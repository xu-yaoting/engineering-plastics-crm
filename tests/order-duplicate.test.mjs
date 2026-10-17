import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/pages/OrderDetail.tsx', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('OrderDetail.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'duplicate') handler = node.initializer;
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.ok(handler, 'Order duplicate handler is missing');
const compiled = ts.transpileModule(`module.exports = ${handler.getText(parsed)};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
}).outputText;

function duplicateFixture(fetchResult) {
  const order = {
    company_id: 'fixture-company', contact_id: 'fixture-contact', quotation_id: 'fixture-quotation',
    currency: 'CNY', subtotal: 240, discount_percent: 5, discount_amount: 12,
    tax_type: 'domestic_vat', domestic_vat_rate: 13, export_tax_rebate_rate: 0,
    tax_amount: 29.64, shipping_handling: 8, total: 265.64,
    customer_po_number: 'OLD-PO', status: 'shipped', order_date: '2026-01-03',
    internal_notes: 'Previous order only',
  };
  const lineItems = [
    { line_number: 1, product_grade_snapshot: 'Fixture PEEK', unit_of_measure: 'kg', quantity_ordered: 2, quantity_shipped: 2, quantity_delivered: 2, unit_price: 100, discount_percent: 10, line_total: 180, description: 'First item' },
    { line_number: 2, product_grade_snapshot: 'Fixture PPSU', unit_of_measure: 'pc', quantity_ordered: 1, quantity_shipped: 0, quantity_delivered: 0, unit_price: 60, discount_percent: 0, line_total: 60, description: 'Second item' },
  ];
  const calls = { requests: [], navigations: [], errors: [], busy: [] };
  const duplicateInFlight = { current: false };
  let currentResponse = fetchResult ?? { ok: true, json: async () => ({ id: 'fixture-copy' }) };
  const module = { exports: {} };
  runInNewContext(compiled, {
    module, order, lineItems, duplicateInFlight, Error,
    setDuplicating: value => calls.busy.push(value),
    readError: async (res, fallback) => {
      const data = await res.json().catch(() => null);
      return data?.error || data?.message || fallback;
    },
    t: key => key,
    toast: { error: message => calls.errors.push(message) },
    navigate: path => calls.navigations.push(path),
    fetch: async (url, options) => {
      calls.requests.push({ url, ...options, payload: JSON.parse(options.body) });
      return typeof currentResponse === 'function' ? currentResponse() : currentResponse;
    },
  });
  return { action: module.exports, order, lineItems, calls, duplicateInFlight, setResponse: value => { currentResponse = value; } };
}

test('duplicating an order preserves commercial fields and ordered product lines while resetting fulfillment progress', async () => {
  const fixture = duplicateFixture();
  const original = JSON.stringify({ order: fixture.order, lineItems: fixture.lineItems });
  await fixture.action();
  assert.equal(fixture.calls.requests.length, 1);
  assert.equal(fixture.calls.requests[0].url, '/api/orders');
  assert.equal(fixture.calls.requests[0].method, 'POST');
  const payload = fixture.calls.requests[0].payload;
  for (const field of ['company_id', 'contact_id', 'quotation_id', 'currency', 'subtotal', 'discount_percent', 'discount_amount', 'tax_type', 'domestic_vat_rate', 'export_tax_rebate_rate', 'tax_amount', 'shipping_handling', 'total']) {
    assert.equal(payload[field], fixture.order[field], `Duplicate omitted or changed ${field}`);
  }
  assert.deepEqual(payload.line_items, fixture.lineItems.map(item => ({
    line_number: item.line_number,
    product_grade_snapshot: item.product_grade_snapshot,
    unit_of_measure: item.unit_of_measure,
    quantity: item.quantity_ordered,
    unit_price: item.unit_price,
    discount_percent: item.discount_percent,
    line_total: item.line_total,
    description: item.description,
  })));
  assert.equal('customer_po_number' in payload, false, 'A customer PO from the previous order must not carry over');
  assert.equal('status' in payload, false, 'The duplicate must start as a new draft');
  assert.equal('order_date' in payload, false, 'The server should assign a new order date');
  assert.equal(payload.line_items.some(item => 'quantity_shipped' in item || 'quantity_delivered' in item), false);
  assert.equal(JSON.stringify({ order: fixture.order, lineItems: fixture.lineItems }), original);
  assert.deepEqual(fixture.calls.navigations, ['/orders/fixture-copy']);
  assert.deepEqual(fixture.calls.errors, []);
});

test('immediate duplicate calls submit only one new order', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const fixture = duplicateFixture(() => pending);
  const first = fixture.action();
  const second = fixture.action();
  assert.equal(fixture.calls.requests.length, 1);
  assert.equal(fixture.duplicateInFlight.current, true);
  assert.deepEqual(fixture.calls.busy, [true]);
  finish({ ok: true, json: async () => ({ id: 'fixture-copy' }) });
  await Promise.all([first, second]);
  assert.equal(fixture.duplicateInFlight.current, false);
  assert.deepEqual(fixture.calls.busy, [true, false]);
  assert.deepEqual(fixture.calls.navigations, ['/orders/fixture-copy']);
});

test('order duplicate failures show the API message and allow retry', async () => {
  const fixture = duplicateFixture({ ok: false, json: async () => ({ message: 'Company must have a customer_code before creating an order' }) });
  await fixture.action();
  assert.deepEqual(fixture.calls.errors, ['Company must have a customer_code before creating an order']);
  assert.deepEqual(fixture.calls.navigations, []);
  assert.equal(fixture.duplicateInFlight.current, false);
  assert.deepEqual(fixture.calls.busy, [true, false]);
  fixture.setResponse({ ok: true, json: async () => ({ id: 'retry-copy' }) });
  await fixture.action();
  assert.equal(fixture.calls.requests.length, 2);
  assert.deepEqual(fixture.calls.navigations, ['/orders/retry-copy']);
});
