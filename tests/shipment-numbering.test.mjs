import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const numbersSource = readFileSync(new URL('../server/numbers.ts', import.meta.url), 'utf8');
const smokeSource = readFileSync(new URL('../tests/api-write-smoke.mjs', import.meta.url), 'utf8');

test('shipment numbers follow the invoice-style yearly global sequence', () => {
  assert.match(numbersSource, /export function nextShipmentNumber\(\): string/);
  assert.match(numbersSource, /SELECT COUNT\(\*\) as c FROM shipments/);
  assert.match(numbersSource, /return `SHP-\$\{now\.slice\(2, 4\)\}-\$\{String\(count\)\.padStart\(4, '0'\)\}`/);
  assert.doesNotMatch(numbersSource, /shipmentBaseFromOrderNumber/);
  assert.doesNotMatch(numbersSource, /orderNumber.*-S/);
});

test('shipment smoke check requires the invoice-style shipment number format', () => {
  assert.match(smokeSource, /assert\.match\(shipment\.shipment_number, \/\^SHP-\\d\{2\}-\\d\{4\}\$\//);
});
