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
const paymentsSource = readFileSync(new URL('../src/pages/Payments.tsx', import.meta.url), 'utf8');
const shipmentsSource = readFileSync(new URL('../src/pages/Shipments.tsx', import.meta.url), 'utf8');
const shipmentDetailSource = readFileSync(new URL('../src/pages/ShipmentDetail.tsx', import.meta.url), 'utf8');
const companiesSource = readFileSync(new URL('../src/pages/Companies.tsx', import.meta.url), 'utf8');
const inventorySource = readFileSync(new URL('../src/pages/InventoryPage.tsx', import.meta.url), 'utf8');
const orderDetailSource = readFileSync(new URL('../src/pages/OrderDetail.tsx', import.meta.url), 'utf8');
const quotationDetailSource = readFileSync(new URL('../src/pages/QuotationDetail.tsx', import.meta.url), 'utf8');

test('payment and shipment forms are grouped and responsive', () => {
  for (const formSource of [paymentsSource, shipmentsSource]) {
    assert.match(formSource, /<fieldset/);
    assert.match(formSource, /<legend/);
    assert.match(formSource, /sm:grid-cols-2/);
    assert.match(formSource, /className="data-surface p-4/);
  }

  assert.match(paymentsSource, /role="dialog"/);
  assert.match(paymentsSource, /aria-modal="true"/);
  assert.match(paymentsSource, /w-\[min\(400px,calc\(100vw-2rem\)\)\]/);
});

test('payment create and edit controls have persistent label associations', () => {
  for (const fieldId of [
    'payment-invoice-order',
    'payment-invoice-total',
    'payment-invoice-due-date',
    'payment-edit-total',
    'payment-edit-due-date',
    'payment-edit-notes',
  ]) {
    assert.match(paymentsSource, new RegExp(`htmlFor="${fieldId}"`));
    assert.match(paymentsSource, new RegExp(`id="${fieldId}"`));
  }
  assert.match(paymentsSource, /id="payment-invoice-order"[\s\S]*required/);
  assert.match(paymentsSource, /id="payment-invoice-total"[\s\S]*required/);
});

test('shipment create controls have persistent label associations', () => {
  for (const fieldId of [
    'shipment-create-order',
    'shipment-create-ship-date',
    'shipment-create-type',
    'shipment-create-status',
    'shipment-create-carrier',
    'shipment-create-reference',
    'shipment-create-container',
    'shipment-create-vessel',
    'shipment-create-voyage',
    'shipment-create-etd',
    'shipment-create-eta',
    'shipment-create-airline',
    'shipment-create-express-provider',
    'shipment-create-estimated-delivery',
    'shipment-create-pickup-address',
    'shipment-create-notes',
  ]) {
    assert.match(shipmentsSource, new RegExp(`htmlFor="${fieldId}"`));
    assert.match(shipmentsSource, new RegExp(`id="${fieldId}"`));
  }
  assert.match(shipmentsSource, /id="shipment-create-order"[\s\S]*required/);
  assert.match(shipmentsSource, /id="shipment-create-pickup-address"[\s\S]*autoComplete="street-address"/);
});

test('shipment edit controls have persistent label associations', () => {
  for (const fieldId of [
    'shipment-edit-type',
    'shipment-edit-ship-date',
    'shipment-edit-reference',
    'shipment-edit-carrier',
    'shipment-edit-container',
    'shipment-edit-vessel',
    'shipment-edit-voyage',
    'shipment-edit-etd',
    'shipment-edit-eta',
    'shipment-edit-airline',
    'shipment-edit-air-tracking',
    'shipment-edit-express-provider',
    'shipment-edit-estimated-delivery',
    'shipment-edit-truck-tracking',
    'shipment-edit-pickup-address',
    'shipment-edit-notes',
  ]) {
    assert.match(shipmentDetailSource, new RegExp(`htmlFor="${fieldId}"`));
    assert.match(shipmentDetailSource, new RegExp(`id="${fieldId}"`));
  }
  assert.match(shipmentDetailSource, /id="shipment-edit-pickup-address"[\s\S]*autoComplete="street-address"/);
});

test('company and payment create and edit flows use side panels while payment recording stays modal', () => {
  for (const pageSource of [companiesSource, paymentsSource]) {
    assert.match(pageSource, /import SidePanel from '\.\.\/components\/shared\/SidePanel'/);
  }

  assert.match(companiesSource, /import CompanyEditPanel from '\.\.\/components\/companies\/CompanyEditPanel'/);
  assert.match(companiesSource, /<CompanyEditPanel company=\{editTarget\}/);
  assert.doesNotMatch(companiesSource, /\{\/\* Edit Modal \*\/\}/);
  assert.match(paymentsSource, /<SidePanel open=\{showForm\}/);
  assert.match(paymentsSource, /<SidePanel open=\{!!editTarget\}/);
  assert.doesNotMatch(paymentsSource, /\{\/\* Edit Modal \*\/\}/);
  assert.match(paymentsSource, /aria-labelledby=\{paymentDialogTitleId\}/);
  assert.match(paymentsSource, /id=\{paymentDialogTitleId\}[\s\S]*t\('page\.payments\.recordPayment'\)/);
});

test('inquiry and shipment detail editors use side panels instead of centered long-form modals', () => {
  for (const detailSource of [shipmentDetailSource, shipmentDetailSource]) {
    assert.match(detailSource, /import SidePanel from '\.\.\/components\/shared\/SidePanel'/);
    assert.match(detailSource, /<SidePanel\s+open=\{showEditPanel\}/);
    assert.doesNotMatch(detailSource, /\{\/\* Edit Modal \*\/\}/);
    assert.doesNotMatch(detailSource, /fixed inset-0 bg-black\/20 z-50 flex items-center justify-center/);
  }
});

test('shipment and inventory list forms use side panels instead of expanding inside list content', () => {
  assert.match(shipmentsSource, /import SidePanel from '\.\.\/components\/shared\/SidePanel'/);
  assert.match(shipmentsSource, /<SidePanel\s+open=\{showForm\}/);
  assert.doesNotMatch(shipmentsSource, /\{showForm && \(/);

  assert.match(inventorySource, /import SidePanel from '\.\.\/components\/shared\/SidePanel'/);
  assert.match(inventorySource, /<SidePanel\s+open=\{createOpen\}/);
  assert.match(inventorySource, /<SidePanel\s+open=\{!!selected\}/);
  assert.doesNotMatch(inventorySource, /\{showForm && \(/);
});

test('order editing and quotation sample requests use side panels instead of centered long-form modals', () => {
  for (const detailSource of [orderDetailSource, quotationDetailSource]) {
    assert.match(detailSource, /import SidePanel from '\.\.\/components\/shared\/SidePanel'/);
  }

  assert.match(orderDetailSource, /<SidePanel\s+open=\{showEditPanel\}/);
  assert.doesNotMatch(orderDetailSource, /\{\/\* Edit Modal \*\/\}/);
  assert.match(quotationDetailSource, /<SidePanel\s+open=\{showSamplePanel\}/);
  assert.doesNotMatch(quotationDetailSource, /showSamplePanel && \(/);
});

test('shipment detail and responsive workspace use accessible record interactions', () => {
  assert.match(shipmentDetailSource, /className="page-header mb-0/);
  assert.match(shipmentDetailSource, /className="page-heading/);
  assert.match(shipmentDetailSource, /className="page-actions/);
  assert.match(shipmentDetailSource, /<Icon name="back"/);
  assert.match(shipmentDetailSource, /<Icon name="more"/);
  assert.match(shipmentDetailSource, /className="data-surface overflow-x-auto"/);
  assert.match(shipmentDetailSource, /className="sticky top-0 z-10"/);
  assert.match(shipmentDetailSource, /animate-pulse/);
  assert.doesNotMatch(shipmentDetailSource, />⋮</);
});

test('shipment detail leads with a compact fulfillment summary', () => {
  assert.match(shipmentDetailSource, /commercial-summary/);
  assert.match(shipmentDetailSource, /commercial-summary[\s\S]*shipment\.shipment_number[\s\S]*shipment\.company_name/);
  assert.match(shipmentDetailSource, /shipmentReference\(shipment\) \|\| '—'/);
  assert.match(shipmentDetailSource, /tracking_number \|\| shipment\.awb/);
  assert.doesNotMatch(shipmentDetailSource, /tabular-nums text-blue-600">\{shipment\.tracking_number/);
  assert.doesNotMatch(shipmentDetailSource, /rounded-xl/);
});

test('shipment details use sentence-case labels and neutral order context', () => {
  assert.match(shipmentDetailSource, /section-label/);
  assert.doesNotMatch(shipmentDetailSource, /uppercase tracking-\[0\.08em\]/);
  assert.match(shipmentsSource, /border border-border bg-canvas/);
  assert.doesNotMatch(shipmentsSource, /bg-brand-soft rounded-lg p-3 mb-4/);
});

test('payments and shipments use the shared operational list surfaces', () => {
  for (const pageSource of [paymentsSource, shipmentsSource]) {
    assert.match(pageSource, /className="page-shell/);
    assert.match(pageSource, /className="page-header"/);
    assert.match(pageSource, /className="toolbar/);
    assert.match(pageSource, /className="(?:hidden )?data-surface overflow-x-auto(?: md:block)?"/);
    assert.match(pageSource, /className="sticky top-0 z-10"/);
    assert.match(pageSource, /<Icon name="search"/);
    assert.match(pageSource, /animate-pulse/);
    assert.match(pageSource, /<Icon name="more"/);
    assert.doesNotMatch(pageSource, />⋮</);
  }
});

test('payment list paginates the current filtered result set', () => {
  assert.match(paymentsSource, /Pagination/);
  assert.match(paymentsSource, /PAYMENTS_PAGE_SIZE = 6/);
  assert.match(paymentsSource, /paged\.map/);
  assert.match(paymentsSource, /setPage\(1\)/);
  assert.match(paymentsSource, /total=\{filtered\.length\}/);
});

test('payment and shipment overlays and empty states use shared surfaces', () => {
  for (const pageSource of [paymentsSource, shipmentsSource]) {
    assert.match(pageSource, /menu-surface/);
    assert.match(pageSource, /empty-state/);
    assert.doesNotMatch(pageSource, /shadow-md/);
  }
  assert.equal((paymentsSource.match(/modal-surface/g) || []).length, 1);
  assert.match(shipmentsSource, /className="data-surface p-4 mb-6"/);
});

test('payment and shipment lists use stage and semantic risk colors', () => {
  assert.match(shipmentsSource, /text-stage-shipment/);
  assert.match(shipmentsSource, /bg-stage-shipment-soft/);
  assert.match(paymentsSource, /text-stage-payment/);
  assert.match(paymentsSource, /border-l-danger/);
  assert.match(paymentsSource, /text-danger/);
  assert.match(paymentsSource, /text-success/);
});

test('payment status filters use the shared compact segmented control', () => {
  assert.match(paymentsSource, /segmented-control/);
  assert.match(paymentsSource, /segmented-option-active/);
  assert.doesNotMatch(paymentsSource, /rounded-lg text-xs font-medium/);
});

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
