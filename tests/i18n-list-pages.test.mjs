import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const files = [
  '../src/pages/Inquiries.tsx',
  '../src/pages/Orders.tsx',
  '../src/pages/Tasks.tsx',
];

const source = files
  .map(path => readFileSync(new URL(path, import.meta.url), 'utf8'))
  .join('\n')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\/[^\n]*/g, '');

const dictionarySource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');
const ordersSource = readFileSync(new URL('../src/pages/Orders.tsx', import.meta.url), 'utf8');

test('inquiry, order, and task list pages no longer render obvious hard-coded English UI labels', () => {
  const forbidden = [
    />Number</,
    />Company</,
    />Material</,
    />Status</,
    />Urgency</,
    />Created</,
    /Search orders/,
    /Order #/,
    />Payment</,
    />Total</,
    />Date</,
    /Order date: newest first/,
    /Order date: oldest first/,
    /Total: high to low/,
    /Total: low to high/,
    /\} pending</,
    /Subject \*/,
    /Task description/,
    />Priority</,
    />Due Date</,
    /'Overdue'/,
    /'Due'/,
    /Delete task/,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(source, pattern);
  }
});

test('inquiry, order, and task list dictionary contains the batch keys', () => {
  const requiredKeys = [
    'within2Weeks', 'within1Month',
    'orderNumber', 'searchOrders',
    'orderDateNewest', 'orderDateOldest',
    'totalHighToLow', 'totalLowToHigh',
    'pendingSummary', 'taskDescription', 'deleteTask',
  ];

  for (const key of requiredKeys) {
    assert.match(dictionarySource, new RegExp(`${key}:`));
  }
});

test('orders list defaults to order date sorting and exposes sort options', () => {
  assert.match(ordersSource, /useState\('order_date_desc'\)/);
  assert.match(ordersSource, /dateValue\(b\.order_date \|\| b\.created_at\) - dateValue\(a\.order_date \|\| a\.created_at\)/);
  assert.match(ordersSource, /value=\{sortBy\}/);
  assert.match(ordersSource, /setSortBy\(e\.target\.value\)/);
  assert.match(ordersSource, /value="order_date_desc"/);
  assert.match(ordersSource, /value="order_date_asc"/);
  assert.match(ordersSource, /value="total_desc"/);
  assert.match(ordersSource, /value="total_asc"/);
});
