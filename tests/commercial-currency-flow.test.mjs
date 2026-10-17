import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const quotationRouteSource = readFileSync(new URL('../server/routes/quotations.ts', import.meta.url), 'utf8');
const orderDetailSource = readFileSync(new URL('../src/pages/OrderDetail.tsx', import.meta.url), 'utf8');
const paymentsRouteSource = readFileSync(new URL('../server/routes/payments.ts', import.meta.url), 'utf8');

test('quotation currency edits propagate to generated orders', () => {
  assert.match(quotationRouteSource, /const currencyChanged = before\.currency !== after\.currency/);
  assert.match(quotationRouteSource, /const currencySubmitted = Object\.prototype\.hasOwnProperty\.call\(dataFields, 'currency'\)/);
  assert.match(quotationRouteSource, /if \(currencyChanged \|\| currencySubmitted\)/);
  assert.match(quotationRouteSource, /UPDATE orders\s+SET currency = \?, updated_by = \?, updated_at = \?\s+WHERE quotation_id = \?/);
  assert.match(quotationRouteSource, /writeAudit\(req, 'order', order\.id as string, 'update'/);
});

test('order edit panel exposes currency because invoices inherit order currency', () => {
  assert.match(orderDetailSource, /currency: order\.currency \|\| 'USD'/);
  assert.match(orderDetailSource, /htmlFor="order-edit-currency"/);
  assert.match(orderDetailSource, /id="order-edit-currency"/);
  assert.match(orderDetailSource, /setEditForm\(\{[\s\S]*currency: e\.target\.value/);
  assert.match(paymentsRouteSource, /SELECT i\.\*, o\.order_number, o\.currency/);
});
