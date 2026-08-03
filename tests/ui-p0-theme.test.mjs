import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const themeSource = readFileSync(new URL('../src/lib/theme.tsx', import.meta.url), 'utf8');

test('theme provider applies an explicit resolved theme to the document root', () => {
  assert.match(themeSource, /classList\.remove\('light', 'dark'\)/);
  assert.match(themeSource, /classList\.add\(resolved\)/);
  assert.match(themeSource, /prefers-color-scheme: dark/);
});

test('dark mode defines complete semantic surface and content tokens', () => {
  assert.match(css, /\.dark\s*\{[\s\S]*color-scheme:\s*dark/);

  for (const token of [
    '--color-text:',
    '--color-text-muted:',
    '--color-text-subtle:',
    '--surface-canvas:',
    '--surface-primary:',
    '--surface-subtle:',
    '--surface-hover:',
    '--border-subtle:',
    '--border-strong:',
    '--shadow-overlay:',
  ]) {
    assert.match(css, new RegExp(`\\.dark\\s*\\{[\\s\\S]*${token}`));
  }
});

test('dark mode bridges the light utility classes used by existing CRM screens', () => {
  for (const selector of [
    '.dark .bg-white',
    '.dark .bg-gray-50',
    '.dark .text-gray-900',
    '.dark .text-gray-500',
    '.dark .border-gray-200',
    '.dark .hover\\:bg-gray-50:hover',
  ]) {
    assert.ok(css.includes(selector), `missing dark theme bridge: ${selector}`);
  }
});

test('dark mode preserves semantic state contrast without turning the canvas black', () => {
  assert.doesNotMatch(css, /\.dark\s*\{[\s\S]*--surface-canvas:\s*#000(?:000)?\s*;/);
  assert.match(css, /\.dark \.status-edge-danger/);
  assert.match(css, /\.dark \.badge-red/);
  assert.match(css, /\.dark \.badge-green/);
});
