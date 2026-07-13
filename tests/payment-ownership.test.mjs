import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const authSource = readFileSync(new URL('../server/auth.ts', import.meta.url), 'utf8');
const authorizeSource = readFileSync(new URL('../server/authorize.ts', import.meta.url), 'utf8');
const paymentsSource = readFileSync(new URL('../server/routes/payments.ts', import.meta.url), 'utf8');
const paymentsPageSource = readFileSync(new URL('../src/pages/Payments.tsx', import.meta.url), 'utf8');
const i18nSource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');

test('authenticated requests carry role and shared ownership authorization', () => {
  assert.match(authSource, /user\?: \{ id: string; name: string; role: string \}/);
  assert.match(authSource, /SELECT id, name, role FROM users/);
  assert.match(authorizeSource, /canManageOwnedRecord/);
  assert.match(authorizeSource, /user\.role === 'admin'/);
  assert.match(authorizeSource, /ownerUserId === user\.id/);
  assert.match(authorizeSource, /res\.status\(403\)/);
});

test('payments expose order ownership and enforce owner-or-admin writes', () => {
  assert.match(paymentsSource, /owner\.name as owner_name/);
  assert.match(paymentsSource, /o\.owner_user_id/);
  assert.match(paymentsSource, /can_edit/);
  assert.match(paymentsSource, /requireOwnedRecord\(req, res/);
  assert.match(paymentsSource, /requireAdministrator\(req, res\)/);
  assert.match(paymentsSource, /created_by_name/);
  assert.match(paymentsSource, /updated_by_name/);
});

test('payments UI separates owner from truthful actor metadata and respects can_edit', () => {
  assert.match(paymentsPageSource, /accountability\.owner/);
  assert.match(paymentsPageSource, /inv\.owner_name/);
  assert.match(paymentsPageSource, /editTarget\.created_by_name/);
  assert.match(paymentsPageSource, /editTarget\.updated_by_name/);
  assert.match(paymentsPageSource, /historicalActorUnknown/);
  assert.match(paymentsPageSource, /!inv\.can_edit/);
  assert.match(paymentsPageSource, /user\?\.role === 'admin'/);
  assert.match(i18nSource, /Historical data - not recorded/);
  assert.match(i18nSource, /历史数据，未记录/);
});
