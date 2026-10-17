import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('app shell declares the branded favicon', () => {
  assert.match(indexSource, /<link rel="icon" type="image\/svg\+xml" href="\/jekin-logo\.svg" \/>/);
});

test('app shell declares the JEKIN CRM title', () => {
  assert.match(indexSource, /<title>JEKIN CRM<\/title>/);
});

test('app shell declares the zh-CN default language and apple touch icon link', () => {
  assert.match(indexSource, /<html lang="zh-CN">/);
  assert.match(indexSource, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png" \/>/);
});

test('apple touch icon is a 180x180 PNG', () => {
  const icon = readFileSync(new URL('../public/apple-touch-icon.png', import.meta.url));
  assert.equal(icon.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(icon.readUInt32BE(16), 180);
  assert.equal(icon.readUInt32BE(20), 180);
});

test('runtime keeps the document language in sync with the UI language', () => {
  const i18nSource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');
  assert.match(i18nSource, /document\.documentElement\.lang = lng\.startsWith\('zh'\) \? 'zh-CN' : 'en'/);
  assert.match(i18nSource, /lng: localStorage\.getItem\('crm-language'\) \|\| 'zh'/);
});
