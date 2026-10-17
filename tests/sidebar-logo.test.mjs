import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sidebarSource = readFileSync(new URL('../src/components/layout/Sidebar.tsx', import.meta.url), 'utf8');
const logoSource = readFileSync(new URL('../public/jekin-logo.svg', import.meta.url), 'utf8');

test('sidebar logo has a dedicated JEKIN mark', () => {
  assert.match(sidebarSource, /function JekinLogo/);
  assert.match(sidebarSource, /src="\/jekin-logo\.svg"/);
  assert.match(sidebarSource, /alt="JEKIN CRM"/);
  assert.match(sidebarSource, /className="w-8 h-8 rounded-full flex-shrink-0 object-cover"/);
  assert.match(logoSource, /viewBox="50 46 504 504"/);
  assert.match(logoSource, /fill="#2285ff"/);
  assert.match(sidebarSource, /bg-brand-soft text-brand/);
  assert.doesNotMatch(sidebarSource, /text-\[#[0-9A-Fa-f]{6}\]/);
});

test('collapsed sidebar centers the logo horizontally', () => {
  assert.match(sidebarSource, /collapsed \? 'justify-center px-0' : 'gap-3 px-4'/);
});
