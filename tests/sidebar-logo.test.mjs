import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sidebarSource = readFileSync(new URL('../src/components/layout/Sidebar.tsx', import.meta.url), 'utf8');
const logoSource = readFileSync(new URL('../public/basepoint-logo.svg', import.meta.url), 'utf8');

test('sidebar logo has a dedicated Basepoint mark', () => {
  assert.match(sidebarSource, /function BasepointLogo/);
  assert.match(sidebarSource, /src="\/basepoint-logo\.svg"/);
  assert.match(sidebarSource, /alt="Basepoint"/);
  assert.match(sidebarSource, /className="w-8 h-8 rounded-full flex-shrink-0 object-cover"/);
  assert.match(logoSource, /viewBox="0 0 768\.000000 768\.000000"/);
  assert.match(logoSource, /fill="#2563EB"/);
  assert.match(sidebarSource, /bg-blue-50 text-blue-600/);
  assert.doesNotMatch(sidebarSource, /text-\[#[0-9A-Fa-f]{6}\]/);
});

test('collapsed sidebar centers the logo horizontally', () => {
  assert.match(sidebarSource, /collapsed \? 'justify-center px-0' : 'gap-3 px-4'/);
});
