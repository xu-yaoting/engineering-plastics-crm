import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const overviewSource = readFileSync(new URL('../src/pages/MaterialsToolingPage.tsx', import.meta.url), 'utf8');
const toolingSource = readFileSync(new URL('../src/components/materials-tooling/ToolingTab.tsx', import.meta.url), 'utf8');

test('materials tooling overview provides low-stock cards before the desktop table', () => {
  assert.match(overviewSource, /className="space-y-2 p-3 md:hidden"/);
  assert.match(overviewSource, /className="hidden overflow-x-auto md:block"/);
  assert.match(overviewSource, /item\.current_quantity/);
  assert.match(overviewSource, /item\.safety_quantity/);
});

test('tooling movement details provide mobile cards before the desktop table', () => {
  assert.match(toolingSource, /className="space-y-2 md:hidden"/);
  assert.match(toolingSource, /className="hidden overflow-x-auto md:block"/);
  assert.match(toolingSource, /movement\.to_custodian_name/);
  assert.match(toolingSource, /movement\.to_location/);
});
