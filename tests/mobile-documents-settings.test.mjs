import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const documentsSource = readFileSync(new URL('../src/components/materials-tooling/DocumentsTab.tsx', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../src/components/materials-tooling/MaterialsSettings.tsx', import.meta.url), 'utf8');

test('documents provides mobile cards before the desktop workflow table', () => {
  assert.match(documentsSource, /className="space-y-2 md:hidden"/);
  assert.match(documentsSource, /className="hidden data-surface overflow-x-auto border-t-0 rounded-t-none md:block"/);
  assert.match(documentsSource, /downloadPdf/);
  assert.match(documentsSource, /voidAndReplace/);
});

test('materials settings provides mobile permission and approval cards before desktop tables', () => {
  assert.match(settingsSource, /className="space-y-2 md:hidden"/);
  assert.match(settingsSource, /className="hidden data-surface overflow-x-auto md:block"/);
  assert.match(settingsSource, /toggleUserPermission/);
  assert.match(settingsSource, /updateApprover/);
});
