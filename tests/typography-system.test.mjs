import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const tailwindConfig = readFileSync(new URL('../tailwind.config.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const commercialListSource = [
  '../src/pages/Quotations.tsx',
  '../src/pages/Orders.tsx',
].map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
const commercialDetailSource = [
  '../src/pages/OrderDetail.tsx',
  '../src/pages/Payments.tsx',
].map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
const appSource = [
  '../src/pages/InventoryPage.tsx',
  '../src/pages/Dashboard.tsx',
  '../src/pages/CompanyDetail.tsx',
  '../src/components/layout/Sidebar.tsx',
  '../src/components/shared/StatusBadge.tsx',
  '../src/components/shared/ProductTag.tsx',
].map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');

test('semantic color and surface tokens define the CRM visual hierarchy', () => {
  const requiredTokens = [
    '--color-brand: #000000', '--color-text: #141414', '--color-text-muted: #6f6f6f',
    '--color-text-subtle: #a3a3a3', '--surface-canvas: #f5f5f5',
    '--surface-subtle: #fafafa', '--surface-hover: #f1f1f1',
    '--border-subtle: #ececec', '--color-success: #168a5b',
    '--color-warning: #b7791f', '--color-danger: #d64545',
    '--radius-surface: 12px',
  ];

  for (const token of requiredTokens) assert.match(css, new RegExp(token));
  assert.match(css, /\.status-edge-danger/);
  assert.match(css, /\.empty-state/);
});

test('typography scale keeps CRM headings compact and neutral', () => {
  assert.match(tailwindConfig, /'2xl': \['1\.125rem', '1\.625rem'\]/);
  assert.doesNotMatch(tailwindConfig, /letterSpacing: '-0\.02em'/);
});

test('core controls share a compact Attio-like type rhythm', () => {
  assert.match(css, /\.btn \{[\s\S]*text-sm font-450/);
  assert.match(css, /\.input \{[\s\S]*text-sm font-normal/);
  assert.match(css, /\.label \{[\s\S]*text-xs font-450/);
  assert.match(css, /\.table-header \{[\s\S]*h-8[\s\S]*text-xs font-450/);
  assert.match(css, /\.table-cell \{[\s\S]*h-10[\s\S]*text-sm/);
  assert.doesNotMatch(css, /\.table-header \{[\s\S]*uppercase/);
  assert.match(css, /\.record-link/);
  assert.match(css, /\.segmented-control/);
});

test('bottom table rows open action menus upward to avoid clipped controls', () => {
  assert.match(css, /\.data-surface tbody tr:nth-last-child\(-n\+2\) \.menu-surface/);
  assert.match(css, /bottom:\s*100%/);
  assert.match(css, /top:\s*auto\s*!important/);
});

test('page shells wrap actions cleanly on narrow layouts', () => {
  assert.match(css, /\.page-shell \{[\s\S]*px-4[\s\S]*sm:px-6/);
  assert.match(css, /\.page-header \{[\s\S]*flex-col[\s\S]*sm:flex-row/);
  assert.match(css, /\.page-actions \{[\s\S]*flex-wrap/);
});

test('application shell uses shared control classes and sentence-case navigation labels', () => {
  const shellSource = [
    '../src/components/layout/Sidebar.tsx',
    '../src/components/layout/TopBar.tsx',
  ].map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
  assert.doesNotMatch(shellSource, /rounded-lg/);
  assert.doesNotMatch(shellSource, /tracking-\[0\.08em\] uppercase/);
  assert.match(shellSource, /className="input h-9 pl-9 pr-12"/);
  assert.ok((shellSource.match(/icon-btn/g) || []).length >= 2);
});

test('shared controls expose consistent focus disabled error and overlay states', () => {
  assert.match(css, /\.btn:disabled/);
  assert.match(css, /\.icon-btn:disabled/);
  assert.match(css, /\.field-error/);
  assert.match(css, /\.menu-surface/);
  assert.match(css, /\.modal-surface/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('ordinary cards and kanban records stay flat', () => {
  assert.match(css, /\.card-hover \{[\s\S]*transition-colors/);
  assert.match(css, /\.kanban-column \{[\s\S]*min-w-\[200px\][\s\S]*rounded/);
  assert.match(css, /\.kanban-card \{[\s\S]*cursor-grab rounded/);
  assert.doesNotMatch(css, /hover:shadow-sm/);
});

test('common UI does not fall back to heavy section labels or 700 weight', () => {
  assert.doesNotMatch(appSource, /font-semibold text-gray-500 uppercase tracking-wider/);
  assert.doesNotMatch(appSource, /text-2xs font-medium/);
  assert.doesNotMatch(appSource, /font-bold/);
});

test('quotation and order lists use the interface font with aligned numerals', () => {
  assert.doesNotMatch(commercialListSource, /font-mono/);
  assert.match(commercialListSource, /table-cell font-medium text-stage-quotation tabular-nums/);
  assert.match(commercialListSource, /table-cell font-medium text-stage-order tabular-nums/);
  assert.equal((commercialListSource.match(/table-cell text-right tabular-nums text-sm font-medium/g) || []).length, 2);
});

test('order detail and payments use the interface font with aligned numerals', () => {
  assert.doesNotMatch(commercialDetailSource, /font-mono/);
  assert.match(commercialDetailSource, /tabular-nums/);
});

test('quotation edit and order detail format displayed money with thousands separators', () => {
  const moneyDisplaySource = [
    '../src/components/quotations/QuotationEditPanel.tsx',
    '../src/pages/OrderDetail.tsx',
  ].map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');

  assert.equal((moneyDisplaySource.match(/import \{ formatCurrency \}/g) || []).length, 2);
  assert.doesNotMatch(moneyDisplaySource, /currencySymbol|\bconst sym\b/);
  assert.doesNotMatch(moneyDisplaySource, /\.toFixed\(2\)/);
});

test('inventory SKUs and measurements use the interface font with aligned numerals', () => {
  const inventorySource = readFileSync(new URL('../src/pages/InventoryPage.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(inventorySource, /font-mono/);
  assert.match(inventorySource, /tabular-nums/);
});

test('workspace and pipeline cards use the interface font with aligned numerals', () => {
  const workspaceSource = [
    '../src/pages/Dashboard.tsx',
    '../src/components/pipeline/PipelineCard.tsx',
  ].map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');

  assert.doesNotMatch(workspaceSource, /font-mono/);
  assert.match(workspaceSource, /tabular-nums/);
});

test('pipeline totals and shipment identifiers use the interface font', () => {
  const fulfillmentSource = [
    '../src/components/pipeline/PipelineColumn.tsx',
    '../src/pages/Shipments.tsx',
  ].map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');

  assert.doesNotMatch(fulfillmentSource, /font-mono/);
  assert.match(fulfillmentSource, /tabular-nums/);
});

test('shipment and company details use the interface font for identifiers and money', () => {
  const detailSource = [
    '../src/pages/ShipmentDetail.tsx',
    '../src/pages/CompanyDetail.tsx',
  ].map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');

  assert.doesNotMatch(detailSource, /font-mono/);
  assert.match(detailSource, /tabular-nums/);
});

test('companies list and edit panel use the interface font', () => {
  const remainingSource = [
    '../src/pages/Companies.tsx',
    '../src/components/companies/CompanyEditPanel.tsx',
  ].map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');

  assert.doesNotMatch(remainingSource, /font-mono/);
  assert.match(remainingSource, /tabular-nums/);
});

test('detail page headings share one compact scale and headers stay left-aligned on mobile', () => {
  const shipmentDetail = readFileSync(new URL('../src/pages/ShipmentDetail.tsx', import.meta.url), 'utf8');
  const orderDetail = readFileSync(new URL('../src/pages/OrderDetail.tsx', import.meta.url), 'utf8');

  assert.match(shipmentDetail, /page-header mb-0 min-h-0 items-start sm:items-center/);
  assert.match(shipmentDetail, /page-heading text-lg sm:text-2xl truncate tabular-nums/);
  assert.match(orderDetail, /text-ink whitespace-nowrap">\{inv\.invoice_number\}<\/span>\{' '\}/);
  assert.match(orderDetail, /ml-2 whitespace-nowrap">\{t\('page\.payments\.due'\)/);
});

test('pipeline heading and top bar search placeholder follow the shared scale and locale punctuation', () => {
  const pipelineSource = readFileSync(new URL('../src/pages/Pipeline.tsx', import.meta.url), 'utf8');
  const topBarSource = readFileSync(new URL('../src/components/layout/TopBar.tsx', import.meta.url), 'utf8');

  assert.match(pipelineSource, /<h1 className="page-heading">\{t\('page\.title\.pipeline'\)\}<\/h1>/);
  assert.doesNotMatch(pipelineSource, /text-xl font-semibold text-ink md:text-2xl/);
  assert.match(topBarSource, /startsWith\('zh'\)/);
  assert.match(topBarSource, /'、'/);
  assert.match(topBarSource, /'…'/);
  assert.doesNotMatch(topBarSource, /t\('nav\.quotations'\) \+ '\.\.\.'/);
});
