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

test('typography scale keeps CRM headings compact and neutral', () => {
  assert.match(tailwindConfig, /'2xl': \['1\.125rem', '1\.625rem'\]/);
  assert.doesNotMatch(tailwindConfig, /letterSpacing: '-0\.02em'/);
});

test('core controls share a compact Attio-like type rhythm', () => {
  assert.match(css, /\.btn \{[\s\S]*text-sm font-450/);
  assert.match(css, /\.input \{[\s\S]*text-sm font-normal/);
  assert.match(css, /\.label \{[\s\S]*text-xs font-450/);
  assert.match(css, /\.table-header \{[\s\S]*text-2xs font-450/);
  assert.match(css, /\.table-cell \{[\s\S]*text-sm/);
});

test('common UI does not fall back to heavy section labels or 700 weight', () => {
  assert.doesNotMatch(appSource, /font-semibold text-gray-500 uppercase tracking-wider/);
  assert.doesNotMatch(appSource, /text-2xs font-medium/);
  assert.doesNotMatch(appSource, /font-bold/);
});

test('quotation and order lists use the interface font with aligned numerals', () => {
  assert.doesNotMatch(commercialListSource, /font-mono/);
  assert.equal((commercialListSource.match(/table-cell font-medium text-blue-600 tabular-nums/g) || []).length, 2);
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
