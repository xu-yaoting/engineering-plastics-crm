import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const files = [
  '../src/pages/Payments.tsx',
  '../src/pages/Shipments.tsx',
  '../src/pages/ShipmentDetail.tsx',
];

const source = files
  .map(path => readFileSync(new URL(path, import.meta.url), 'utf8'))
  .join('\n')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\/[^\n]*/g, '');

const dictionarySource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');

test('payments and shipment pages no longer render obvious hard-coded English UI labels', () => {
  const forbidden = [
    /return `Payment exceeds remaining balance/,
    /Failed to create invoice/,
    /Failed to record payment/,
    /Outstanding Receivables/,
    /Overdue Receivables/,
    /Due This Month/,
    /Collected This Month/,
    /unpaid invoices/,
    /overdue invoices/,
    /invoices due/,
    /invoices paid/,
    /Edit Invoice/,
    /Save Changes/,
    /Transaction ID/,
    /Confirm\?/,
    /Sea Freight/,
    /Air Freight/,
    /New Shipment/,
    /Edit Shipment/,
    /Items:/,
    /Order \*/,
    /Select order/,
    /Ship Date/,
    /Shipment Type/,
    /Container No\./,
    /Carrier \/ Vessel/,
    /Tracking Status/,
    /Tracking Details/,
    /Tracking #/,
    /Est\. Delivery/,
    /No items tracked for this shipment/,
    /No shipments match your search/,
    /Create Shipment/,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(source, pattern);
  }
});

test('payments and shipment dictionary contains the batch keys', () => {
  const requiredKeys = [
    'paymentExceedsBalance', 'failedCreateInvoice', 'failedRecordPayment',
    'dueThisMonth', 'collectedThisMonth', 'invoicesDue', 'invoicesPaid',
    'editInvoice', 'transactionId',
    'editShipment', 'shipmentSaved', 'shipmentDeleted', 'shipmentSaveFailed',
    'saving', 'shipmentNumber', 'carrierVessel', 'items', 'selectOrder',
    'createShipment', 'noShipmentsMatchSearch', 'trackingStatus',
    'trackingDetails', 'shippingMethod', 'estDelivery',
  ];

  for (const key of requiredKeys) {
    assert.match(dictionarySource, new RegExp(`${key}:`));
  }
});

test('shipments save keeps the form open on backend errors and shows saving state', () => {
  assert.match(source, /const \[saving, setSaving\] = useState\(false\)/);
  assert.match(source, /const readError = async \(res: Response, fallback: string\)/);
  assert.match(source, /setSaving\(true\)/);
  assert.match(source, /if \(!res\.ok\) \{/);
  assert.match(source, /toast\.error\(await readError\(res, t\('page\.shipments\.shipmentSaveFailed'\)\)\)/);
  assert.match(source, /setShowForm\(false\);[\s\S]*toast\.success\(t\('page\.shipments\.shipmentSaved'\)\)/);
  assert.match(source, /finally \{[\s\S]*setSaving\(false\);[\s\S]*\}/);
  assert.match(source, /saving \? t\('page\.shipments\.saving'\)/);
  assert.match(source, /disabled=\{!form\.order_id \|\| saving\}/);
});
