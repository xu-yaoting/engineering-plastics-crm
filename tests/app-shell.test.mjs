import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('app shell declares the branded favicon', () => {
  assert.match(indexSource, /<link rel="icon" type="image\/svg\+xml" href="\/basepoint-logo\.svg" \/>/);
});
