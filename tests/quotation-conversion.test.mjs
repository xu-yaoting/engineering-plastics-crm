import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/pages/QuotationDetail.tsx', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('QuotationDetail.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const handlers = new Map();
function visit(node) {
  if (ts.isVariableDeclaration(node) && ['createOrder', 'readError'].includes(node.name.getText(parsed))) {
    handlers.set(node.name.getText(parsed), node.initializer.getText(parsed));
  }
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.equal(handlers.size, 2);
const compiled = ts.transpileModule(`const readError=${handlers.get('readError')}; module.exports=${handlers.get('createOrder')};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
}).outputText;

function conversionFixture({ activityFails = false, statusFails = false, existingOrderId = null, response, legacyDiscount = 0, savedTotal = 20 } = {}) {
  const calls = { requests: [], activities: [], statuses: [], orderIds: [], busy: [], navigations: [], errors: [], successes: [] };
  const orderCreationInFlight = { current: false };
  const createdOrderRef = { current: null };
  let currentResponse = response ?? { ok: true, json: async () => ({ id: 'fixture-order', order_number: 'FIXTURE-ORDER' }) };
  const module = { exports: {} };
  runInNewContext(compiled, {
    module, Error, id: 'fixture-quote', orderId: existingOrderId, orderCreationInFlight, createdOrderRef,
    quotation: { id: 'fixture-quote', company_id: 'fixture-company', contact_id: null, currency: 'USD', subtotal: 20, total: savedTotal, discount_percent: legacyDiscount, discount_amount: legacyDiscount },
    lineItems: [{ line_number: 1, product_grade_snapshot: 'Fixture material', unit_of_measure: 'pc', quantity: 2, unit_price: 10, line_total: 20, discount_percent: legacyDiscount }], subtotal: 20,
    setCreatingOrder: value => calls.busy.push(value),
    // Retain the original render's orderId value to exercise stale-handler protection.
    setOrderId: value => calls.orderIds.push(value),
    t: key => key,
    toast: { error: text => calls.errors.push(text), success: text => calls.successes.push(text) },
    navigate: path => calls.navigations.push(path),
    fetch: async (url, options) => {
      calls.requests.push({ url, payload: JSON.parse(options.body) });
      return typeof currentResponse === 'function' ? currentResponse() : currentResponse;
    },
    activities: { create: async payload => { calls.activities.push(payload); if (activityFails) throw new Error('Activity service unavailable'); } },
    quotations: { update: async (id, payload) => { calls.statuses.push({ id, payload }); if (statusFails) throw new Error('Quotation service unavailable'); } },
  });
  return { action: module.exports, calls, orderCreationInFlight, createdOrderRef, setResponse: value => { currentResponse = value; } };
}

test('confirmed order creation records its ID and completes normal follow-up requests', async () => {
  const fixture = conversionFixture();
  await fixture.action();
  assert.deepEqual(fixture.calls.orderIds, ['fixture-order']);
  assert.equal(fixture.calls.requests.length, 1);
  assert.equal(fixture.calls.requests[0].payload.quotation_id, 'fixture-quote');
  assert.equal(fixture.calls.requests[0].payload.total, 20);
  assert.equal(fixture.calls.activities.length, 1);
  assert.equal(fixture.calls.statuses.length, 1);
  assert.equal(fixture.calls.statuses[0].payload.status, 'accepted');
  assert.deepEqual(fixture.calls.successes, ['page.quotationDetail.orderCreated']);
  assert.deepEqual(fixture.calls.errors, []);
  assert.deepEqual(fixture.calls.navigations, ['/orders/fixture-order']);
});

test('quotation conversion preserves the agreed amounts without activating legacy discount fields', async () => {
  const fixture = conversionFixture({ legacyDiscount: 10 });
  await fixture.action();
  const payload = fixture.calls.requests[0].payload;
  assert.equal(payload.total, 20);
  assert.equal(payload.subtotal, 20);
  assert.equal(payload.discount_percent, 0);
  assert.equal(payload.discount_amount, 0);
  assert.equal(payload.line_items[0].discount_percent, 0);
  assert.equal(payload.line_items[0].line_total, 20);
});

test('quotation conversion preserves an explicitly saved zero total', async () => {
  const fixture = conversionFixture({ savedTotal: 0 });
  await fixture.action();
  assert.equal(fixture.calls.requests[0].payload.total, 0);
});

test('activity or status failure cannot turn a confirmed order into a failed creation or another POST', async () => {
  for (const failures of [{ activityFails: true }, { statusFails: true }, { activityFails: true, statusFails: true }]) {
    const fixture = conversionFixture(failures);
    await fixture.action();
    assert.deepEqual(fixture.calls.orderIds, ['fixture-order']);
    assert.equal(fixture.calls.activities.length, 1);
    assert.equal(fixture.calls.statuses.length, 1, 'Activity failure skipped quotation status synchronization');
    assert.deepEqual(fixture.calls.navigations, ['/orders/fixture-order']);
    assert.equal(fixture.calls.errors.length, 1);
    assert.ok(fixture.calls.errors[0].includes('page.quotationDetail.orderCreated'));
    if (failures.activityFails) assert.ok(fixture.calls.errors[0].includes('page.activityTimeline.activityLogFailed'));
    if (failures.statusFails) assert.ok(fixture.calls.errors[0].includes('page.quotationDetail.statusChangeFailed'));
    assert.ok(!fixture.calls.errors[0].includes('page.quotationDetail.orderCreateFailed'));
    await fixture.action();
    assert.equal(fixture.calls.requests.length, 1, 'Retry after confirmed creation posted a second order');
    assert.equal(fixture.calls.activities.length, 1);
    assert.equal(fixture.orderCreationInFlight.current, false);
  }
});

test('immediate conversion calls submit only once and existing orders are opened without creation', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const fixture = conversionFixture({ response: () => pending });
  const first = fixture.action();
  const second = fixture.action();
  assert.equal(fixture.calls.requests.length, 1);
  assert.equal(fixture.orderCreationInFlight.current, true);
  finish({ ok: true, json: async () => ({ id: 'fixture-order', order_number: 'FIXTURE-ORDER' }) });
  await Promise.all([first, second]);
  assert.deepEqual(fixture.calls.busy, [true, false]);
  const existing = conversionFixture({ existingOrderId: 'existing-order' });
  await existing.action();
  assert.equal(existing.calls.requests.length, 0);
  assert.deepEqual(existing.calls.navigations, ['/orders/existing-order']);
});

test('genuine creation failure stays retryable and stops follow-up writes', async () => {
  const fixture = conversionFixture({ response: { ok: false, json: async () => ({ message: 'Customer code is required' }) } });
  await fixture.action();
  assert.deepEqual(fixture.calls.errors, ['Customer code is required']);
  assert.equal(fixture.calls.activities.length, 0);
  assert.equal(fixture.calls.statuses.length, 0);
  assert.deepEqual(fixture.calls.navigations, []);
  assert.deepEqual(fixture.calls.orderIds, []);
  assert.equal(fixture.orderCreationInFlight.current, false);
  fixture.setResponse({ ok: true, json: async () => ({ id: 'retry-order', order_number: 'FIXTURE-RETRY' }) });
  await fixture.action();
  assert.equal(fixture.calls.requests.length, 2);
  assert.deepEqual(fixture.calls.navigations, ['/orders/retry-order']);
});
