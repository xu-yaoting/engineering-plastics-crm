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
  assert.match(inventorySource, /role="tablist"/);
  assert.match(inventorySource, /aria-selected=\{tab === item\.key\}/);
  assert.match(inventorySource, /className="metric-strip/);
  assert.match(inventorySource, /className="metric-cell/);
  assert.match(inventorySource, /className="data-surface overflow-x-auto"/);
  assert.match(inventorySource, /className="sticky top-0 z-10"/);
  assert.match(inventorySource, /<Icon name="plus"/);
});

test('payments and inventory lists reflow to compact mobile cards before desktop tables', () => {
  for (const listSource of [paymentsSource, inventorySource]) {
    assert.match(listSource, /className="space-y-2 md:hidden"/);
    assert.match(listSource, /className="hidden md:block/);
  }
  assert.match(paymentsSource, /renderMobilePayment/);
  assert.match(inventorySource, /renderMobileProduct/);
  assert.match(inventorySource, /renderMobileTransaction/);
  assert.match(inventorySource, /renderMobileStock/);
});

test('inventory product and transaction forms use grouped responsive surfaces', () => {
  assert.ok((inventorySource.match(/<fieldset/g) || []).length >= 2);
  assert.ok((inventorySource.match(/<legend/g) || []).length >= 2);
  assert.ok((inventorySource.match(/className="data-surface p-4/g) || []).length >= 3);
  assert.match(inventorySource, /grid-cols-1 gap-[^\"]*sm:grid-cols-2/);
  assert.match(inventorySource, /grid-cols-1 gap-[^\"]*sm:grid-cols-3/);
  assert.match(inventorySource, /sticky bottom-0/);
});

test('inventory dashboard explains stock counts are changed through adjustment entries', () => {
  assert.match(inventorySource, /t\('page\.inventory\.stockChangeHelp'\)/);
  assert.match(inventorySource, /onTabChange\('adjustment'\)/);
  assert.match(inventorySource, /onTabChange\('products'\)/);
});

test('inventory products can be edited and soft-deleted from the products table', () => {
  assert.match(inventorySource, /deleteProduct/);
  assert.match(inventorySource, /method: 'DELETE'/);
  assert.match(inventorySource, /\/api\/inventory\/products\/\$\{id\}/);
  assert.match(inventorySource, /t\('common\.edit'\)/);
  assert.match(inventorySource, /t\('common\.delete'\)/);
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

test('inventory form and filter controls have persistent labels', () => {
  const labeledControlIds = [
    'inventory-product-type',
    'inventory-product-tracking-mode',
    'inventory-product-category',
    'inventory-product-unit',
    'inventory-product-material',
    'inventory-product-initial-qty',
    'inventory-product-safety-qty',
    'inventory-product-safety-weight',
    'inventory-ledger-type-filter',
    'inventory-transaction-product',
    'inventory-transaction-quantity',
    'inventory-transaction-unit',
    'inventory-transaction-date',
    'inventory-transaction-reference-type',
    'inventory-transaction-reference-id',
    'inventory-transaction-notes',
    'inventory-import-operator',
    'inventory-stock-product',
    'inventory-stock-quantity',
    'inventory-stock-unit',
    'inventory-stock-date',
    'inventory-stock-reference-type',
    'inventory-stock-reference-id',
    'inventory-stock-notes',
    'inventory-stock-operator',
  ];

  for (const fieldId of labeledControlIds) {
    assert.match(inventorySource, new RegExp(`htmlFor="${fieldId}"`));
    assert.match(inventorySource, new RegExp(`id="${fieldId}"`));
  }

  assert.match(inventorySource, /htmlFor=\{`inventory-product-dimension-\$\{f\.key\}`\}/);
  assert.match(inventorySource, /id=\{`inventory-product-dimension-\$\{f\.key\}`\}/);
});
