import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const inventorySource = readFileSync(new URL('../src/pages/InventoryPage.tsx', import.meta.url), 'utf8');

test('inventory dashboard explains stock counts are changed through adjustment entries', () => {
  assert.match(inventorySource, /Use Stock In, Stock Out, or Adjustment to change quantities/);
  assert.match(inventorySource, /onTabChange\('adjustment'\)/);
  assert.match(inventorySource, /onTabChange\('products'\)/);
});

test('inventory products can be edited and soft-deleted from the products table', () => {
  assert.match(inventorySource, /deleteProduct/);
  assert.match(inventorySource, /method: 'DELETE'/);
  assert.match(inventorySource, /\/api\/inventory\/products\/\$\{id\}/);
  assert.match(inventorySource, />Edit</);
  assert.match(inventorySource, />Delete</);
});
