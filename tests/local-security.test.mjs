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

test('initial setup only trusts the direct loopback socket address', () => {
  assert.match(authRouteSource, /function isDirectLoopbackAddress/);
  assert.match(authRouteSource, /req\.socket\.remoteAddress/);
  assert.match(authRouteSource, /127\.0\.0\.1/);
  assert.match(authRouteSource, /::ffff:127\.0\.0\.1/);
  assert.match(authRouteSource, /::1/);
  assert.match(authRouteSource, /res\.status\(403\)\.json/);
  assert.doesNotMatch(authRouteSource, /x-forwarded-for/i);

  const setupStart = authRouteSource.indexOf("router.post('/setup'");
  const setupEnd = authRouteSource.indexOf("router.post('/login'");
  const setupRoute = authRouteSource.slice(setupStart, setupEnd);
  assert.ok(setupRoute.indexOf('isDirectLoopbackAddress') < setupRoute.indexOf('hashPin('));
});

test('login rate limiting blocks before PIN hashing and clears after success', () => {
  assert.match(authRouteSource, /const LOGIN_FAILURE_LIMIT = 5/);
  assert.match(authRouteSource, /const RATE_LIMIT_WINDOW_MS = 15 \* 60 \* 1000/);
  assert.match(authRouteSource, /name\.trim\(\)\.toLocaleLowerCase\(\)/);
  assert.match(authRouteSource, /res\.status\(429\)\.json/);
  assert.match(authRouteSource, /const usernameKey = normalizedName/);
  assert.match(authRouteSource, /loginUsernameFailures\.delete\(usernameKey\)/);
  assert.match(authRouteSource, /loginIpFailures\.delete\(clientIp\)/);
  assert.doesNotMatch(authRouteSource, /`\$\{clientIp\}:\$\{normalizedName\}`/);

  const loginStart = authRouteSource.indexOf("router.post('/login'");
  const loginEnd = authRouteSource.indexOf("router.post('/register'");
  const loginRoute = authRouteSource.slice(loginStart, loginEnd);
  assert.ok(loginRoute.indexOf('isRateLimited') < loginRoute.indexOf('pinMatches('));
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
