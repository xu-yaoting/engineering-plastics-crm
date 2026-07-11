import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const files = [
  '../src/pages/QuotationDetail.tsx',
  '../src/components/quotations/QuotationEditPanel.tsx',
  '../src/pages/OrderDetail.tsx',
];

const source = files
  .map((file) => readFileSync(new URL(file, import.meta.url), 'utf8'))
  .join('\n');

const dictionarySource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');

test('quotation and order detail batch no longer renders obvious hard-coded English UI labels', () => {
  const forbidden = [
    /Status changed to/,
    /Failed to change status/,
    /Order created from quotation/,
    /Failed to create order/,
    /Failed to duplicate quotation/,
    /Quotation deleted/,
    /Failed to delete quotation/,
    /Sample request created/,
    /Failed to create sample request/,
    /View Order/,
    /Approver name \(optional\)/,
    />Approve</,
    />Reject</,
    /Rejected — returned to draft/,
    /Download PDF/,
    /Request Sample/,
    />Sample Purpose</,
    />Quantity</,
    />Shipping Address</,
    />Create Sample Request</,
    /No line items from source quotation/,
    />Status</,
    />Payment</,
    />Order Date</,
    />Delivery Date</,
    />Source</,
    /View Original Quotation/,
    />Shipped Total</,
    />Shipped Qty</,
    /No shipment linked/,
    /Create one from the/,
    /invoices created yet/,
    /Order updated/,
    /Failed to save/,
    /Failed to duplicate/,
    /Failed to delete order/,
    /Invoice .* created/,
    /Failed to create invoice/,
    />Draft</,
    />Confirmed</,
    />In Production</,
    />Quality Check</,
    />Ready to Ship</,
    />Shipped</,
    />Delivered</,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(source, pattern, `Unexpected hard-coded English UI text: ${pattern}`);
  }
});

test('third localization batch has dictionary entries for quotation and order detail UI', () => {
  const requiredKeys = [
    'downloadPdf',
    'requestSample',
    'samplePurpose',
    'sampleRequestCreated',
    'sampleRequestFailed',
    'viewOrder',
    'approve',
    'reject',
    'orderCreated',
    'orderCreateFailed',
    'quotationDeleted',
    'quotationDeleteFailed',
    'orderUpdated',
    'orderSaveFailed',
    'saving',
    'invoiceCreated',
    'invoiceCreateFailed',
    'shippedQty',
    'shipment',
    'noShipmentLinked',
    'viewOriginalQuotation',
    'noInvoicesCreated',
    'readyToShip',
  ];

  for (const key of requiredKeys) {
    assert.match(dictionarySource, new RegExp(`${key}:`), `Missing i18n key: ${key}`);
  }
});

test('order edit save checks backend errors before closing the modal', () => {
  const orderDetailSource = readFileSync(new URL('../src/pages/OrderDetail.tsx', import.meta.url), 'utf8');

  assert.match(orderDetailSource, /const \[savingEdit, setSavingEdit\] = useState\(false\)/);
  assert.match(orderDetailSource, /const readError = async \(res: Response, fallback: string\)/);
  assert.match(orderDetailSource, /setSavingEdit\(true\)/);
  assert.match(orderDetailSource, /if \(!res\.ok\) \{/);
  assert.match(orderDetailSource, /toast\.error\(await readError\(res, t\('page\.orderDetail\.orderSaveFailed'\)\)\)/);
  assert.match(orderDetailSource, /setShowEditPanel\(false\);[\s\S]*toast\.success\(t\('page\.orderDetail\.orderUpdated'\)\)/);
  assert.match(orderDetailSource, /finally \{[\s\S]*setSavingEdit\(false\);[\s\S]*\}/);
  assert.match(orderDetailSource, /savingEdit \? t\('page\.orderDetail\.saving'\)/);
  assert.match(orderDetailSource, /disabled=\{savingEdit\}/);
});

test('quotation edit save surfaces backend errors and locks cancel while saving', () => {
  const quotationEditSource = readFileSync(new URL('../src/components/quotations/QuotationEditPanel.tsx', import.meta.url), 'utf8');

  assert.match(quotationEditSource, /e instanceof Error \? e\.message : t\('page\.quotationDetail\.quotationSaveFailed'\)/);
  assert.match(quotationEditSource, /<button onClick=\{onClose\} disabled=\{saving\} className="btn-secondary">/);
  assert.match(quotationEditSource, /disabled=\{saving \|\| lineItems\.length === 0\}/);
});

test('quotation amounts use the interface font with aligned numerals', () => {
  const quotationSource = files.slice(0, 2)
    .map((file) => readFileSync(new URL(file, import.meta.url), 'utf8'))
    .join('\n');

  assert.doesNotMatch(quotationSource, /font-mono/);
  assert.match(quotationSource, /tabular-nums/);
});
