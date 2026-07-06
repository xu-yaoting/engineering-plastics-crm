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
