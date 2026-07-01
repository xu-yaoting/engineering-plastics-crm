import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const inventorySource = readFileSync(new URL('../src/pages/InventoryPage.tsx', import.meta.url), 'utf8');
const dictionarySource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');
const renderedSource = inventorySource
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\/[^\n]*/g, '');

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
    'importInventoryData', 'chooseFile', 'noFileSelected',
  ];

  for (const key of requiredKeys) {
    assert.match(dictionarySource, new RegExp(`${key}:`));
  }
});
