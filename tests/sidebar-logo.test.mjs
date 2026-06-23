import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sidebarSource = readFileSync(new URL('../src/components/layout/Sidebar.tsx', import.meta.url), 'utf8');

test('sidebar logo has a dedicated Basepoint mark', () => {
  assert.match(sidebarSource, /function BasepointLogo/);
  assert.match(sidebarSource, /viewBox="0 0 32 32"/);
  assert.match(sidebarSource, /aria-label="Basepoint"/);
  assert.match(sidebarSource, /bg-blue-600/);
  assert.match(sidebarSource, /<circle cx="16" cy="16" r="11\.55"/);
  assert.match(sidebarSource, /stroke="#2563EB"/);
});

test('collapsed sidebar centers the logo horizontally', () => {
  assert.match(sidebarSource, /collapsed \? 'justify-center px-0' : 'gap-3 px-4'/);
});
