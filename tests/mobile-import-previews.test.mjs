import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const materialsSource = readFileSync(new URL('../src/components/materials-tooling/MaterialsTab.tsx', import.meta.url), 'utf8');

test('materials opening-balance import controls stack cleanly on narrow screens', () => {
  assert.match(materialsSource, /className="grid grid-cols-1 gap-3 sm:grid-cols-2"/);
  assert.match(materialsSource, /className="[^"]*flex flex-col gap-2 sm:flex-row"/);
  assert.match(materialsSource, /min-w-0/);
});
