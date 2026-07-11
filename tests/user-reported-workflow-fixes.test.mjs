import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const contactPanelSource = readFileSync(new URL('../src/components/contacts/ContactPanel.tsx', import.meta.url), 'utf8');
const inventorySource = readFileSync(new URL('../src/pages/InventoryPage.tsx', import.meta.url), 'utf8');
const profileSource = readFileSync(new URL('../src/pages/SettingsProfile.tsx', import.meta.url), 'utf8');
const userMenuSource = readFileSync(new URL('../src/components/shared/UserMenu.tsx', import.meta.url), 'utf8');

test('contact edit save surfaces the actual API error message', () => {
  assert.match(contactPanelSource, /e instanceof Error \? e\.message : t\('page\.contacts\.saveFailed'\)/);
});

test('contact save locks cancel while saving', () => {
  assert.match(contactPanelSource, /disabled=\{saving\}/);
  assert.match(contactPanelSource, /<button onClick=\{onClose\} disabled=\{saving\} className="btn-secondary">/);
});

test('inventory product form lets users edit SKU and name instead of locking them behind auto generation', () => {
  assert.match(inventorySource, /value=\{form\.sku\}/);
  assert.match(inventorySource, /onChange=\{e => set\('sku', e\.target\.value\)\}/);
  assert.match(inventorySource, /value=\{form\.name\}/);
  assert.match(inventorySource, /onChange=\{e => set\('name', e\.target\.value\)\}/);
  assert.doesNotMatch(inventorySource, /value=\{autoSku\} readOnly/);
  assert.doesNotMatch(inventorySource, /value=\{autoName\} readOnly/);
});

test('inventory product save shows backend validation details', () => {
  assert.match(inventorySource, /await res\.json\(\)\.catch/);
  assert.match(inventorySource, /data\?\.error \|\| data\?\.message/);
});

test('profile save notifies the sidebar user menu to refresh immediately', () => {
  assert.match(profileSource, /window\.dispatchEvent\(new CustomEvent\('crm-profile-updated'/);
  assert.match(userMenuSource, /crm-profile-updated/);
  assert.match(userMenuSource, /window\.addEventListener\('storage'/);
});
