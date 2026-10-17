import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const inventorySource = readFileSync(new URL('../src/pages/InventoryPage.tsx', import.meta.url), 'utf8');
const paymentsSource = readFileSync(new URL('../src/pages/Payments.tsx', import.meta.url), 'utf8');
const dictionarySource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');
const renderedSource = inventorySource
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\/[^\n]*/g, '');

test('inventory uses the shared operational hierarchy and data surfaces', () => {
  assert.match(inventorySource, /className="page-shell/);
  assert.match(inventorySource, /className="page-header"/);
  assert.match(inventorySource, /className="page-actions px-3"/);
  assert.match(inventorySource, /role="tablist"/);
  assert.match(inventorySource, /aria-selected=\{view === item\}/);
  assert.match(inventorySource, /aria-selected=\{shape === item\}/);
  assert.match(inventorySource, /className="toolbar"/);
  assert.match(inventorySource, /className="data-surface divide-y divide-border border-t-0 rounded-t-none"/);
  assert.match(inventorySource, /className="data-surface overflow-x-auto border-t-0 rounded-t-none"/);
  assert.match(inventorySource, /className="sticky top-0 z-10"/);
  assert.match(inventorySource, /<Icon name="plus"/);
  assert.doesNotMatch(inventorySource, /metric-strip|metric-cell/);
});

test('payments list reflows to compact mobile cards before the desktop table', () => {
  assert.match(paymentsSource, /className="space-y-2 md:hidden"/);
  assert.match(paymentsSource, /className="hidden md:block/);
  assert.match(paymentsSource, /renderMobilePayment/);
});

test('inventory forms use grouped responsive surfaces', () => {
  assert.ok((inventorySource.match(/<fieldset/g) || []).length >= 2);
  assert.ok((inventorySource.match(/<legend/g) || []).length >= 2);
  assert.match(inventorySource, /grid-cols-1 gap-[^\"]*sm:grid-cols-2/);
  assert.match(inventorySource, /grid-cols-1 gap-[^\"]*sm:grid-cols-3/);
  assert.match(inventorySource, /sticky bottom-0/);
});

test('inventory page no longer renders obvious hard-coded English UI labels', () => {
  const forbidden = [
    />Dashboard</,
    />Products</,
    />Ledger</,
    />Stock In</,
    />Stock Out</,
    />Adjustment</,
    />Import</,
    /Last 30 Days Activity/,
    /Low Stock Alerts/,
    /Current Inventory/,
    /Edit Products/,
    /Adjust Stock/,
    /\+ Add Product/,
    /SKU and Name required/,
    /Delete product/,
    /Product deleted/,
    /Transaction History/,
    /Insufficient Inventory/,
    /Select product and enter quantity/,
    /Stock in recorded/,
    /Stock out recorded/,
    /Adjustment recorded/,
    /Import Inventory Data/,
    /Choose File/,
    /No file selected/,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(renderedSource, pattern);
  }
});

test('inventory localization dictionary contains the batch keys', () => {
  const requiredKeys = [
    'dashboardTab', 'productsTab', 'ledgerTab', 'stockInTab', 'stockOutTab',
    'adjustmentTab', 'importTab', 'stockChangeHelp', 'editProducts',
    'adjustStock', 'last30DaysActivity', 'lowStockAlerts', 'currentInventory',
    'addProduct', 'skuNameRequired', 'deleteConfirm', 'productDeleted',
    'transactionHistory', 'insufficientInventory', 'selectProductQuantity',
    'stockInRecorded', 'stockOutRecorded', 'adjustmentRecorded',
    'importInventoryData', 'chooseFile', 'noFileSelected', 'trackingMode',
  ];

  for (const key of requiredKeys) {
    assert.match(dictionarySource, new RegExp(`${key}:`));
  }
});

