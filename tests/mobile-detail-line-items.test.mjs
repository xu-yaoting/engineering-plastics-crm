import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const quotationSource = readFileSync(new URL('../src/pages/QuotationDetail.tsx', import.meta.url), 'utf8');
const shipmentSource = readFileSync(new URL('../src/pages/ShipmentDetail.tsx', import.meta.url), 'utf8');

test('quotation detail provides mobile line-item cards before the desktop table', () => {
  assert.match(quotationSource, /className="space-y-2 p-3 md:hidden"/);
  assert.match(quotationSource, /className="hidden overflow-x-auto md:block"/);
  assert.match(quotationSource, /formatCurrency\(item\.unit_price/);
  assert.match(quotationSource, /formatCurrency\(item\.line_total/);
});

test('shipment detail provides mobile line-item cards before the desktop table', () => {
  assert.match(shipmentSource, /className="space-y-2 p-3 md:hidden"/);
  assert.match(shipmentSource, /className="hidden overflow-x-auto md:block"/);
  assert.match(shipmentSource, /quantity_shipped/);
  assert.match(shipmentSource, /noItemsTracked/);
});
