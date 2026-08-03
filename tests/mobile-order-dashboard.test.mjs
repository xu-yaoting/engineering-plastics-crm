import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const orderDetailSource = readFileSync(new URL('../src/pages/OrderDetail.tsx', import.meta.url), 'utf8');
const dashboardSource = readFileSync(new URL('../src/pages/Dashboard.tsx', import.meta.url), 'utf8');

test('order detail provides mobile line-item cards before the desktop table', () => {
  assert.match(orderDetailSource, /className="space-y-2 p-3 md:hidden"/);
  assert.match(orderDetailSource, /className="hidden overflow-x-auto md:block"/);
  assert.match(orderDetailSource, /order-line-mobile-\$\{item\.id\}-shipped-quantity/);
  assert.match(orderDetailSource, /formatCurrency\(shippedTotal, order\.currency\)/);
});

test('dashboard receivables provide mobile cards before the desktop table', () => {
  assert.match(dashboardSource, /className="space-y-2 p-3 md:hidden"/);
  assert.match(dashboardSource, /className="hidden overflow-x-auto md:block"/);
  assert.match(dashboardSource, /t\('page\.dashboard\.dueDate'\)/);
  assert.match(dashboardSource, /t\('page\.dashboard\.status'\)/);
});
