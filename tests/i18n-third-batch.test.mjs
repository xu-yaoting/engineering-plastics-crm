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
const quotationDetailSource = readFileSync(new URL('../src/pages/QuotationDetail.tsx', import.meta.url), 'utf8');
const orderDetailSource = readFileSync(new URL('../src/pages/OrderDetail.tsx', import.meta.url), 'utf8');
const inventorySource = readFileSync(new URL('../src/pages/InventoryPage.tsx', import.meta.url), 'utf8');

test('quotation and order details share the commercial document hierarchy', () => {
  for (const detailSource of [quotationDetailSource, orderDetailSource]) {
    assert.match(detailSource, /className="page-header mb-0/);
    assert.match(detailSource, /className="page-heading/);
    assert.match(detailSource, /className="page-actions/);
    assert.match(detailSource, /className="icon-btn"/);
    assert.match(detailSource, /aria-label=\{t\('common\.back'\)\}/);
    assert.match(detailSource, /<Icon name="more"/);
    assert.match(detailSource, /className="data-surface overflow-x-auto"/);
    assert.match(detailSource, /className="sticky top-0 z-10"/);
    assert.doesNotMatch(detailSource, />⋮</);
  }
});

test('quotation and order detail headers stay usable on phone widths', () => {
  for (const detailSource of [quotationDetailSource, orderDetailSource]) {
    assert.match(detailSource, /page-header mb-0 min-h-0 items-stretch sm:items-center/);
    assert.match(detailSource, /page-heading min-w-0 flex-1 text-lg sm:text-2xl tabular-nums/);
    assert.match(detailSource, /page-actions w-full max-w-none flex-nowrap overflow-x-auto/);
    assert.match(detailSource, /\[&>\*\]:shrink-0/);
  }
  assert.match(quotationDetailSource, /sm:max-w-\[62%\]/);
  assert.match(orderDetailSource, /sm:max-w-\[58%\]/);
});

test('order detail keeps wide operational content inside local scrollers', () => {
  assert.match(orderDetailSource, /className="h-full flex flex-col overflow-x-hidden"/);
  assert.match(orderDetailSource, /className="flex items-center max-w-3xl overflow-x-auto"/);
  assert.match(orderDetailSource, /className="data-surface overflow-x-auto"/);
  assert.match(orderDetailSource, /className="table-cell text-right relative"/);
  assert.match(orderDetailSource, /className="table-cell relative"/);
});

test('commercial details use layout-shaped accessible loading states', () => {
  const loadingStates = [
    [quotationDetailSource, 'quotation', 'QuotationDetailSkeleton'],
    [orderDetailSource, 'order', 'OrderDetailSkeleton'],
  ];

  for (const [detailSource, entity, skeleton] of loadingStates) {
    assert.match(detailSource, new RegExp(`function ${skeleton}`));
    assert.match(detailSource, new RegExp(`if \\(!${entity}\\) return <${skeleton} label=\\{t\\('common\\.loading'\\)\\} \\/>`));
    assert.match(detailSource, /role="status"/);
    assert.match(detailSource, /motion-reduce:animate-none/);
    assert.match(detailSource, /lg:grid-cols-3/);
    assert.doesNotMatch(detailSource, /return <div className="p-6 text-gray-400">\{t\('common\.loading'\)\}<\/div>/);
  }
});

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

test('quotation and inventory product editors expose field-level validation', () => {
  const quotationEditSource = readFileSync(new URL('../src/components/quotations/QuotationEditPanel.tsx', import.meta.url), 'utf8');

  assert.match(quotationEditSource, /e instanceof Error \? e\.message : t\('page\.quotationDetail\.quotationSaveFailed'\)/);
  assert.match(quotationEditSource, /<button onClick=\{onClose\} disabled=\{saving\} className="btn-secondary">/);
  assert.match(quotationEditSource, /const \[errors, setErrors\]/);
  assert.match(quotationEditSource, /aria-describedby=\{errors\.lineItems \? 'quotation-line-items-error' : undefined\}/);
  assert.match(quotationEditSource, /id="quotation-line-items-error" className="field-error" role="alert"/);
  assert.doesNotMatch(quotationEditSource, /disabled=\{saving \|\| lineItems\.length === 0\}/);

  assert.match(inventorySource, /const \[productErrors, setProductErrors\]/);
  assert.match(inventorySource, /id="inventory-product-sku"/);
  assert.match(inventorySource, /aria-invalid=\{!!productErrors\.sku\}/);
  assert.match(inventorySource, /aria-describedby=\{productErrors\.name \? 'inventory-product-name-error' : undefined\}/);
  assert.match(inventorySource, /className="field-error" role="alert"/);
  assert.doesNotMatch(inventorySource, /if \(!currentSku \|\| !currentName\) \{ toast\.error/);
});

test('quotation editor controls have persistent labels and selected-state semantics', () => {
  const quotationEditSource = readFileSync(new URL('../src/components/quotations/QuotationEditPanel.tsx', import.meta.url), 'utf8');

  for (const fieldId of [
    'quotation-edit-owner',
    'quotation-edit-currency',
    'quotation-edit-incoterm',
    'quotation-edit-payment-terms',
    'quotation-edit-delivery-terms',
    'quotation-edit-quotation-date',
    'quotation-edit-valid-until',
    'quotation-edit-vat-rate',
    'quotation-edit-export-rebate-rate',
    'quotation-edit-shipping-handling',
    'quotation-edit-internal-notes',
  ]) {
    assert.match(quotationEditSource, new RegExp(`htmlFor="${fieldId}"`));
    assert.match(quotationEditSource, new RegExp(`id="${fieldId}"`));
  }

  for (const field of ['grade', 'unit', 'quantity', 'unit-price', 'line-total']) {
    assert.match(quotationEditSource, new RegExp(`htmlFor=\\{\`quotation-edit-${field}-\\$\\{idx\\}\`\\}`));
    assert.match(quotationEditSource, new RegExp(`id=\\{\`quotation-edit-${field}-\\$\\{idx\\}\`\\}`));
  }

  assert.match(quotationEditSource, /<output[\s\S]*id=\{`quotation-edit-line-total-\$\{idx\}`\}/);
  assert.match(quotationEditSource, /aria-pressed=\{form\.tax_type === type\}/);
});

test('order editor controls have persistent labels and address semantics', () => {
  for (const fieldId of [
    'order-edit-owner',
    'order-edit-po-number',
    'order-edit-order-number',
    'order-edit-incoterm',
    'order-edit-order-date',
    'order-edit-delivery-date',
    'order-edit-payment-terms',
    'order-edit-shipping-address',
  ]) {
    assert.match(orderDetailSource, new RegExp(`htmlFor="${fieldId}"`));
    assert.match(orderDetailSource, new RegExp(`id="${fieldId}"`));
  }
  assert.match(orderDetailSource, /id="order-edit-shipping-address"[\s\S]*autoComplete="street-address"/);
});

test('sample request controls have persistent labels and address semantics', () => {
  for (const fieldId of [
    'quotation-sample-purpose',
    'quotation-sample-quantity',
    'quotation-sample-shipping-address',
  ]) {
    assert.match(quotationDetailSource, new RegExp(`htmlFor="${fieldId}"`));
    assert.match(quotationDetailSource, new RegExp(`id="${fieldId}"`));
  }
  assert.match(quotationDetailSource, /id="quotation-sample-shipping-address"[\s\S]*autoComplete="street-address"/);
});

test('quotation taxation mode uses the shared compact segmented control', () => {
  const quotationEditSource = readFileSync(new URL('../src/components/quotations/QuotationEditPanel.tsx', import.meta.url), 'utf8');
  assert.match(quotationEditSource, /segmented-control/);
  assert.match(quotationEditSource, /segmented-option-active/);
  assert.doesNotMatch(quotationEditSource, /rounded-lg text-xs font-medium transition-colors/);
});

test('quotation amounts use the interface font with aligned numerals', () => {
  const quotationSource = files.slice(0, 2)
    .map((file) => readFileSync(new URL(file, import.meta.url), 'utf8'))
    .join('\n');

  assert.doesNotMatch(quotationSource, /font-mono/);
  assert.match(quotationSource, /tabular-nums/);
});

test('commercial details lead with amount and status before supporting metadata', () => {
  for (const detailSource of [quotationDetailSource, orderDetailSource]) {
    assert.match(detailSource, /commercial-summary/);
    assert.match(detailSource, /text-2xl font-semibold text-gray-900 tabular-nums/);
  }
  assert.match(quotationDetailSource, /commercial-summary[\s\S]*quotation\.total[\s\S]*quotation\.company_name/);
  assert.match(orderDetailSource, /commercial-summary[\s\S]*order\.total[\s\S]*order\.company_name/);
  assert.doesNotMatch(quotationDetailSource, /style=\{\{background:'#16a34a'\}\}/);
  assert.doesNotMatch(quotationDetailSource, /style=\{\{color:'#dc2626',borderColor:'#dc2626'\}\}/);
});

test('commercial detail overlays use shared restrained surfaces', () => {
  for (const detailSource of [quotationDetailSource, orderDetailSource]) {
    assert.match(detailSource, /menu-surface/);
    assert.match(detailSource, /<SidePanel/);
    assert.doesNotMatch(detailSource, /rounded-xl|shadow-lg|shadow-md/);
  }
});

test('commercial line item tables use stable shared empty states', () => {
  assert.match(quotationDetailSource, /colSpan=\{6\}><div className="empty-state"/);
  assert.match(orderDetailSource, /colSpan=\{8\}><div className="empty-state"/);
});

test('commercial detail labels use sentence case without forced tracking', () => {
  for (const detailSource of [quotationDetailSource, orderDetailSource]) {
    assert.match(detailSource, /section-label/);
    assert.doesNotMatch(detailSource, /uppercase tracking-\[0\.08em\]/);
  }
});
