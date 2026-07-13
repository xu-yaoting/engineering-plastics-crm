import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const indexSource = readFileSync(new URL('../server/index.ts', import.meta.url), 'utf8');
const authSource = readFileSync(new URL('../server/auth.ts', import.meta.url), 'utf8');
const authRouteSource = readFileSync(new URL('../server/routes/auth.ts', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const apiSource = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8');
const smokeSource = readFileSync(new URL('../tests/api-write-smoke.mjs', import.meta.url), 'utf8');

test('/api/config does not expose API keys to the browser', () => {
  assert.doesNotMatch(indexSource, /res\.json\(\{\s*apiKey:\s*getApiKey\(\)\s*\}\)/);
  assert.doesNotMatch(mainSource, /apiKeyResolve|x-api-key/);
  assert.doesNotMatch(apiSource, /getApiKey|x-api-key/);
});

test('auth module never prints generated API keys', () => {
  assert.doesNotMatch(authSource, /API key generated:\s*\$\{cachedKey\}/);
});

test('authentication requires a hashed PIN instead of passwordless name registration', () => {
  assert.match(authRouteSource, /scryptSync/);
  assert.match(authRouteSource, /timingSafeEqual/);
  assert.match(authRouteSource, /router\.post\('\/login'/);
  assert.match(authRouteSource, /router\.post\('\/setup'/);
  assert.match(authRouteSource, /router\.post\('\/register'.*410/s);
  assert.doesNotMatch(authRouteSource, /return existing user/);
});

test('only administrators can list and create colleague accounts', () => {
  assert.match(authRouteSource, /function requireAdmin/);
  assert.match(authRouteSource, /res\.status\(403\)\.json/);
  assert.match(authRouteSource, /router\.get\('\/users', requireAdmin/);
  assert.match(authRouteSource, /router\.post\('\/users', requireAdmin/);
  assert.match(authRouteSource, /role, is_active, created_at, last_seen_at/);
  assert.match(authRouteSource, /pin_hash, pin_salt/);
  assert.match(authRouteSource, /SELECT id, name, role, is_active, created_at, last_seen_at FROM users/);
});

test('API write smoke uses and removes isolated temporary accounts', () => {
  assert.match(smokeSource, /const smokeAuthToken = randomUUID\(\)/);
  assert.match(smokeSource, /Authorization: `Bearer \$\{token\}`/);
  assert.match(smokeSource, /const smokeMemberToken = randomUUID\(\)/);
  assert.match(smokeSource, /INSERT INTO users/);
  assert.match(smokeSource, /DELETE FROM users WHERE id = \?/);
  assert.match(smokeSource, /DELETE FROM users WHERE id IN \(\?, \?\)/);
  assert.doesNotMatch(smokeSource, /API_KEY/);
});
