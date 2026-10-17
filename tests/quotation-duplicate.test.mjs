import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/pages/QuotationDetail.tsx', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('QuotationDetail.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'duplicate') handler = node.initializer;
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.ok(handler, 'Quotation duplicate handler is missing');
// Run the real page handler; replace only network, navigation and state boundaries.
const compiled = ts.transpileModule(`module.exports = ${handler.getText(parsed)};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
}).outputText;

function duplicateFixture(fetchResult = async () => ({ ok: true, json: async () => ({ id: 'copied-quotation' }) })) {
  const quotation = {
    company_id: 'fixture-company', contact_id: 'fixture-contact', currency: 'CNY',
    subtotal: 180, total: 201.23, discount_percent: 5, discount_amount: 9,
    tax_type: 'domestic_vat', domestic_vat_rate: 13,
    export_tax_rebate_rate: 0, tax_amount: 22.23, shipping_handling: 8,
    incoterm: 'EXW', payment_term: 'Fixture payment', delivery_term: 'Fixture delivery',
    internal_notes: 'Anonymous internal note', quotation_date: '2026-10-16', valid_until: '2026-11-16',
  };
  const lineItems = [{ line_number: 1, product_grade_snapshot: 'Fixture material', unit_of_measure: 'pc', quantity: 2, unit_price: 100, discount_percent: 10, line_total: 180, description: 'Fixture dimensions' }];
  const requests = [];
  const navigations = [];
  const errors = [];
  const busyStates = [];
  const duplicationInFlight = { current: false };
  const module = { exports: {} };
  runInNewContext(compiled, {
    module, quotation, lineItems, duplicationInFlight, Error,
    setDuplicating: value => busyStates.push(value),
    t: key => key,
    toast: { error: message => errors.push(message) },
    navigate: path => navigations.push(path),
    fetch: async (url, options) => {
      requests.push({ url, ...options, payload: JSON.parse(options.body) });
      return fetchResult();
    },
  });
  return { action: module.exports, quotation, lineItems, requests, navigations, errors, busyStates, duplicationInFlight };
}

test('new quotation copies use quantity times unit price without legacy discounts and preserve their source', async () => {
  const fixture = duplicateFixture();
  const original = JSON.stringify({ quotation: fixture.quotation, lines: fixture.lineItems });
  await fixture.action();
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.requests[0].url, '/api/quotations');
  assert.equal(fixture.requests[0].method, 'POST');
  for (const [field, expected] of Object.entries(fixture.quotation)) {
    if (['subtotal', 'total', 'tax_amount', 'discount_percent', 'discount_amount'].includes(field)) continue;
    assert.equal(fixture.requests[0].payload[field], expected, `Copy omitted or changed ${field}`);
  }
  const payload = fixture.requests[0].payload;
  assert.equal(payload.subtotal, 200);
  assert.equal(payload.tax_amount, 26);
  assert.equal(payload.total, 234);
  assert.equal(payload.discount_percent, 0);
  assert.equal(payload.discount_amount, 0);
  assert.deepEqual(payload.line_items, [{ ...fixture.lineItems[0], discount_percent: 0, line_total: 200 }]);
  assert.equal(JSON.stringify({ quotation: fixture.quotation, lines: fixture.lineItems }), original);
  assert.deepEqual(fixture.navigations, ['/quotations/copied-quotation']);
  assert.deepEqual(fixture.errors, []);
});

test('quotation copies default missing, null and zero discount values to zero', async () => {
  for (const value of [undefined, null, 0]) {
    const fixture = duplicateFixture();
    fixture.quotation.discount_percent = value;
    fixture.quotation.discount_amount = value;
    fixture.lineItems[0].discount_percent = value;
    const source = JSON.stringify({ quotation: fixture.quotation, lines: fixture.lineItems });
    await fixture.action();
    const payload = fixture.requests[0].payload;
    assert.equal(payload.discount_percent, 0);
    assert.equal(payload.discount_amount, 0);
    assert.equal(payload.line_items[0].discount_percent, 0);
    assert.equal(JSON.stringify({ quotation: fixture.quotation, lines: fixture.lineItems }), source);
  }
});

test('two immediate copy calls submit once while the first request is pending', async () => {
  let finish;
  const response = new Promise(resolve => { finish = resolve; });
  const fixture = duplicateFixture(() => response);
  const first = fixture.action();
  const second = fixture.action();
  assert.equal(fixture.requests.length, 1, 'Immediate repeat clicks created multiple copy requests');
  assert.equal(fixture.duplicationInFlight.current, true);
  assert.deepEqual(fixture.busyStates, [true]);
  finish({ ok: true, json: async () => ({ id: 'copied-quotation' }) });
  await Promise.all([first, second]);
  assert.equal(fixture.duplicationInFlight.current, false);
  assert.deepEqual(fixture.busyStates, [true, false]);
  assert.equal(fixture.navigations.length, 1);
});

test('copy failures do not navigate, show useful feedback and unlock retry', async () => {
  const cases = [
    { response: { ok: false, json: async () => ({ message: 'Selected contact does not belong to the company' }) }, expected: 'Selected contact does not belong to the company' },
    { response: { ok: false, json: async () => { throw new Error('Non-JSON response'); } }, expected: 'page.quotationDetail.duplicateFailed' },
    { response: { ok: true, json: async () => ({}) }, expected: 'page.quotationDetail.duplicateFailed' },
  ];
  for (const { response, expected } of cases) {
    let fail = true;
    const fixture = duplicateFixture(async () => fail ? response : { ok: true, json: async () => ({ id: 'retry-copy' }) });
    await fixture.action();
    assert.deepEqual(fixture.errors, [expected]);
    assert.deepEqual(fixture.navigations, []);
    assert.equal(fixture.duplicationInFlight.current, false);
    assert.deepEqual(fixture.busyStates, [true, false]);
    fail = false;
    await fixture.action();
    assert.equal(fixture.requests.length, 2);
    assert.deepEqual(fixture.navigations, ['/quotations/retry-copy']);
  }
});
