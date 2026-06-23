import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const indexSource = readFileSync(new URL('../server/index.ts', import.meta.url), 'utf8');
const authSource = readFileSync(new URL('../server/auth.ts', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const apiSource = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8');

test('/api/config does not expose API keys to the browser', () => {
  assert.doesNotMatch(indexSource, /res\.json\(\{\s*apiKey:\s*getApiKey\(\)\s*\}\)/);
  assert.doesNotMatch(mainSource, /apiKeyResolve|x-api-key/);
  assert.doesNotMatch(apiSource, /getApiKey|x-api-key/);
});

test('auth module never prints generated API keys', () => {
  assert.doesNotMatch(authSource, /API key generated:\s*\$\{cachedKey\}/);
});
