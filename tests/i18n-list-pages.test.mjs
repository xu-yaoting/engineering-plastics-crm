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
const quotationsSource = readFileSync(new URL('../src/pages/Quotations.tsx', import.meta.url), 'utf8');
const inquiriesSource = readFileSync(new URL('../src/pages/Inquiries.tsx', import.meta.url), 'utf8');
const tasksSource = readFileSync(new URL('../src/pages/Tasks.tsx', import.meta.url), 'utf8');

test('inquiries and tasks use shared page hierarchy with purpose-built list surfaces', () => {
  for (const listSource of [inquiriesSource, tasksSource]) {
    assert.match(listSource, /className="page-shell/);
    assert.match(listSource, /className="page-header"/);
    assert.match(listSource, /className="toolbar/);
    assert.match(listSource, /className="data-surface/);
    assert.match(listSource, /animate-pulse/);
  }

  assert.match(inquiriesSource, /<Icon name="search"/);
  assert.match(inquiriesSource, /className="sticky top-0 z-10"/);
  assert.match(tasksSource, /role="tablist"/);
  assert.match(tasksSource, /aria-pressed=\{filter === f\.key\}/);
  assert.match(tasksSource, /<Icon name="check"/);
  assert.match(tasksSource, /aria-label=/);
  assert.doesNotMatch(tasksSource, />✓</);
});

test('new task fields have labels and inline subject validation', () => {
  for (const fieldId of ['task-subject', 'task-priority', 'task-due-date']) {
    assert.match(tasksSource, new RegExp(`htmlFor="${fieldId}"`));
    assert.match(tasksSource, new RegExp(`id="${fieldId}"`));
  }
  assert.match(tasksSource, /const \[subjectError, setSubjectError\] = useState\(''\)/);
  assert.match(tasksSource, /required/);
  assert.match(tasksSource, /aria-invalid=\{!!subjectError\}/);
  assert.match(tasksSource, /aria-describedby=\{subjectError \? 'task-subject-error' : undefined\}/);
  assert.match(tasksSource, /id="task-subject-error" className="field-error" role="alert"/);
  assert.match(tasksSource, /subjectInputRef\.current\?\.focus\(\)/);
  assert.match(dictionarySource, /subjectRequired:/);
});

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

test('quotation and order lists follow the shared operational list pattern', () => {
  for (const listSource of [quotationsSource, ordersSource]) {
    assert.match(listSource, /className="page-shell"/);
    assert.match(listSource, /className="page-header"/);
    assert.match(listSource, /className="toolbar"/);
    assert.match(listSource, /className="(?:hidden )?data-surface overflow-x-auto(?: md:block)?"/);
    assert.match(listSource, /sticky top-0 z-10/);
    assert.match(listSource, /<Icon name="search"/);
    assert.match(listSource, /animate-pulse/);
  }
});

test('quotation and order lists keep empty results inside stable table surfaces', () => {
  assert.match(ordersSource, /colSpan=\{7\}><div className="empty-state"/);
  assert.match(quotationsSource, /colSpan=\{9\}><div className="empty-state"/);
});

test('inquiry and task filters use the shared empty state', () => {
  assert.match(inquiriesSource, /className="empty-state"/);
  assert.match(tasksSource, /className="empty-state"/);
});

test('task filters use the shared compact segmented control', () => {
  assert.match(tasksSource, /className="segmented-control"/);
  assert.match(tasksSource, /segmented-option-active/);
  assert.doesNotMatch(tasksSource, /rounded-lg text-xs font-medium/);
});

test('task rows do not shadow the translation function when rendering due dates', () => {
  assert.doesNotMatch(tasksSource, /list\.map\(\(t:\s*any\)/);
  assert.match(tasksSource, /list\.map\(\(task:\s*any\)/);
});
