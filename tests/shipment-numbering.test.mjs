import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const numbersSource = readFileSync(new URL('../server/numbers.ts', import.meta.url), 'utf8');
const smokeSource = readFileSync(new URL('../tests/api-write-smoke.mjs', import.meta.url), 'utf8');

test('shipment numbers use the short order suffix plus shipment sequence', () => {
  assert.match(numbersSource, /function shipmentBaseFromOrderNumber\(orderNumber: string\): string/);
  assert.match(numbersSource, /return parts\.slice\(-2\)\.join\('-'\)/);
  assert.match(numbersSource, /return `\$\{shortBase\}-S\$\{nextSequence\}`/);
});

test('shipment smoke check rejects full company-prefixed shipment numbers', () => {
  assert.match(smokeSource, /assert\.match\(shipment\.shipment_number, \/\^\\d\{4\}-\\d\{2\}-S1\$\//);
});
