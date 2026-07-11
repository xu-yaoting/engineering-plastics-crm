import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiSource = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8');
const paymentsSource = readFileSync(new URL('../src/pages/Payments.tsx', import.meta.url), 'utf8');

test('API client preserves backend error messages', () => {
  assert.match(apiSource, /await res\.json\(\)\.catch/);
  assert.match(apiSource, /data\?\.error \|\| data\?\.message/);
});

test('payments page shows backend errors instead of closing the payment form', () => {
  assert.match(paymentsSource, /toast\.error/);
  assert.match(paymentsSource, /if \(!res\.ok\)/);
  assert.match(paymentsSource, /Payment exceeds remaining balance/);
});

test('payments edit form checks update errors before closing', () => {
  assert.match(paymentsSource, /const res = await fetch\(`\/api\/payments\/\$\{editTarget\.id\}`/);
  assert.match(paymentsSource, /toast\.error\(await readError\(res, t\('page\.payments\.failedUpdateInvoice'\)\)\)/);
  assert.match(paymentsSource, /setEditTarget\(null\);[\s\S]*load\(\);/);
});

test('payments write actions show saving state and success feedback', () => {
  assert.match(paymentsSource, /const \[savingAction, setSavingAction\] = useState/);
  assert.match(paymentsSource, /setSavingAction\('create'\)/);
  assert.match(paymentsSource, /setSavingAction\('edit'\)/);
  assert.match(paymentsSource, /setSavingAction\('pay'\)/);
  assert.match(paymentsSource, /finally \{[\s\S]*setSavingAction\(null\);[\s\S]*\}/);
  assert.match(paymentsSource, /toast\.success\(t\('page\.payments\.invoiceCreated'\)\)/);
  assert.match(paymentsSource, /toast\.success\(t\('page\.payments\.invoiceUpdated'\)\)/);
  assert.match(paymentsSource, /toast\.success\(t\('page\.payments\.paymentRecorded'\)\)/);
  assert.match(paymentsSource, /savingAction === 'create' \? t\('page\.payments\.saving'\)/);
  assert.match(paymentsSource, /savingAction === 'edit' \? t\('page\.payments\.saving'\)/);
  assert.match(paymentsSource, /savingAction === 'pay' \? t\('page\.payments\.saving'\)/);
});
