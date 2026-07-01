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
