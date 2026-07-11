import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const tailwindConfig = readFileSync(new URL('../tailwind.config.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const commercialListSource = [
  '../src/pages/Quotations.tsx',
  '../src/pages/Orders.tsx',
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
