import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sidebarFile = new URL('../src/components/layout/Sidebar.tsx', import.meta.url);
const dictionaryFile = new URL('../src/lib/i18n.tsx', import.meta.url);

const sidebarSource = readFileSync(sidebarFile, 'utf8');
const dictionarySource = readFileSync(dictionaryFile, 'utf8');

const renderedSidebar = sidebarSource
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\/[^\n]*/g, '');

test('sidebar imports Wrench icon for materials tooling', () => {
  assert.match(sidebarSource, /Wrench/);
});

test('sidebar icon map contains materials tooling entry', () => {
  assert.match(sidebarSource, /'wrench'/);
  assert.match(sidebarSource, /Wrench/);
});

test('sidebar has materials tooling nav item with correct label and path', () => {
  assert.match(sidebarSource, /nav\.materialsTooling/);
  assert.match(sidebarSource, /\/materials-tooling/);
  assert.match(sidebarSource, /icon: 'wrench'/);
});

test('materials tooling nav item appears after /inventory', () => {
  const inventoryIdx = sidebarSource.indexOf('/inventory');
  const mtIdx = sidebarSource.indexOf('/materials-tooling');
  assert.ok(mtIdx > inventoryIdx, '/materials-tooling should appear after /inventory');
});

test('sidebar does not hardcode visible English text for materials tooling', () => {
  // The title text must come from t('nav.materialsTooling'), not hardcoded
  assert.doesNotMatch(renderedSidebar, />Materials & Tooling</);
  assert.doesNotMatch(renderedSidebar, />物资与工装</);
});

test('dictionary has nav.materialsTooling key with bilingual values', () => {
  assert.match(dictionarySource, /materialsTooling/);
  assert.match(dictionarySource, /Toolings/);
  assert.match(dictionarySource, /工装/);
});

test('dictionary has all required page.materialsTooling tab keys', () => {
  const requiredKeys = [
    'overviewTab', 'materialsTab', 'documentsTab',
    'ledgerTab', 'toolingTab', 'approvalsTab', 'settingsTab',
  ];
  for (const key of requiredKeys) {
    assert.match(dictionarySource, new RegExp(key)),
      `Missing dictionary key: page.materialsTooling.${key}`;
  }
});

test('dictionary has materials tooling overview keys', () => {
  assert.match(dictionarySource, /pendingApprovals/);
  assert.match(dictionarySource, /lowStockItems/);
  assert.match(dictionarySource, /lowStockAlerts/);
  assert.match(dictionarySource, /monthlyReceipts/);
  assert.match(dictionarySource, /monthlyIssues/);
  assert.match(dictionarySource, /overdueToolingCount/);
});

test('dictionary has materials tooling common label keys', () => {
  assert.match(dictionarySource, /'Code'/);
  assert.match(dictionarySource, /'Name'/);
  assert.match(dictionarySource, /currentQty/);
  assert.match(dictionarySource, /safetyQty/);
  assert.match(dictionarySource, /'Unit'/);
  assert.match(dictionarySource, /comingSoon/);
  assert.match(dictionarySource, /noData/);
});

test('dictionary has materials tooling status keys', () => {
  const statusKeys = ['draft', 'pendingApproval', 'approved', 'rejected',
    'pendingExecution', 'executed', 'awaitingSignedCopy', 'completed',
    'withdrawn', 'voided'];
  for (const key of statusKeys) {
    const ok = new RegExp(`\\b${key}: '`).test(dictionarySource)
      || new RegExp(`\\b${key}: "`).test(dictionarySource);
    assert.ok(ok, `Missing dictionary key: page.materialsTooling.status.${key}`);
  }
});

test('dictionary has materials tooling error and export keys', () => {
  assert.match(dictionarySource, /loadFailed/);
  assert.match(dictionarySource, /downloadXlsx/);
  assert.match(dictionarySource, /restricted/);
});

test('materials tooling page uses nav.materialsTooling for heading and nav', () => {
  const pageFile = new URL('../src/pages/MaterialsToolingPage.tsx', import.meta.url);
  const pageSource = readFileSync(pageFile, 'utf8');
  assert.match(pageSource, /'nav\.materialsTooling'/);
  // Page heading and tab bar aria-label both use nav.materialsTooling
  const matches = pageSource.match(/nav\.materialsTooling/g);
  assert.ok(matches && matches.length >= 2, 'Page should reference nav key at least twice');
});
