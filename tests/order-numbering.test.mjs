import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const numbersSource = readFileSync(new URL('../server/numbers.ts', import.meta.url), 'utf8');

test('order number sequence is counted by customer code, not reset by YYMM', () => {
  assert.match(numbersSource, /SELECT order_number FROM orders/);
  assert.match(numbersSource, /const customerPattern = `\$\{prefix\}-\$\{customerCode\}-`/);
  assert.match(numbersSource, /maxSequence \+ 1/);
  assert.doesNotMatch(numbersSource, /COUNT\(\*\) as c FROM orders WHERE order_number LIKE \?/);
});

test('order number sequence includes soft-deleted orders to avoid UNIQUE collision', () => {
  // Soft-deleted orders still occupy the UNIQUE index on order_number, so the
  // max-sequence query must not filter them out, or re-creating an order after
  // deletion can regenerate a number that already exists.
  assert.doesNotMatch(numbersSource, /deleted_at IS NULL AND order_number LIKE/);
});
