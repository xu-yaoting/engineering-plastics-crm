import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiSource = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8');
const authContextSource = readFileSync(new URL('../src/lib/auth.tsx', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const paymentsSource = readFileSync(new URL('../src/pages/Payments.tsx', import.meta.url), 'utf8');
const loginSource = readFileSync(new URL('../src/pages/Login.tsx', import.meta.url), 'utf8');
const i18nSource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');

test('API client preserves backend error messages', () => {
  assert.match(apiSource, /await res\.json\(\)\.catch/);
  assert.match(apiSource, /data\?\.error \|\| data\?\.message/);
});

test('customer development frontend contract is typed and bilingual', () => {
  for (const typeName of [
    'DevelopmentStage',
    'ActivityOutcome',
    'FollowUpBucket',
    'FollowUpWorkbenchItem',
    'RecordFollowUpInput',
    'RecordFollowUpResult',
  ]) {
    assert.match(apiSource, new RegExp(`export type ${typeName}`));
  }
  assert.match(apiSource, /export const followUps/);
  assert.match(apiSource, /request<FollowUpWorkbenchItem\[]>\(`\/activities\/follow-ups/);
  assert.match(apiSource, /request<RecordFollowUpResult>\('\/activities\/follow-ups'/);

  for (const copy of [
    'Follow-ups',
    'Customer development and maintenance',
    'Stage',
    'No next follow-up',
    '跟进',
    '客户开发与维护',
    '开发阶段',
    '尚未安排下次跟进',
  ]) {
    assert.match(i18nSource, new RegExp(copy));
  }
});

test('all same-origin API fetches receive the current bearer token', () => {
  assert.match(apiSource, /export function installAuthenticatedFetch/);
  assert.match(apiSource, /const originalFetch = window\.fetch\.bind\(window\)/);
  assert.match(apiSource, /url\.startsWith\('\/api\/'\)/);
  assert.match(apiSource, /headers\.set\('Authorization', `Bearer \$\{token\}`\)/);
  assert.match(mainSource, /installAuthenticatedFetch\(\);/);
});

test('frontend authentication uses setup and PIN login instead of passwordless registration', () => {
  assert.match(apiSource, /status: \(\) => request.*'\/auth\/status'/);
  assert.match(apiSource, /setup: \(name: string, pin: string\)/);
  assert.match(apiSource, /login: \(name: string, pin: string\)/);
  assert.doesNotMatch(apiSource, /auth\/register/);
  assert.match(authContextSource, /requiresSetup/);
  assert.match(authContextSource, /setup: \(name: string, pin: string\)/);
  assert.match(authContextSource, /login: \(name: string, pin: string\)/);
  assert.match(authContextSource, /const login = async \(name: string, pin: string\)/);
  assert.doesNotMatch(authContextSource, /const login = async \(name: string, pin\?: string\)/);
  assert.doesNotMatch(authContextSource, /const login = async \(name: string, pin = ''\)/);
});

test('login page supports first admin setup and six-digit PIN login in both languages', () => {
  assert.match(loginSource, /requiresSetup, setup, login/);
  assert.match(loginSource, /type="password"/);
  assert.match(loginSource, /inputMode="numeric"/);
  assert.match(loginSource, /pin\.length !== 6/);
  assert.match(loginSource, /confirmPin !== pin/);
  assert.match(loginSource, /requiresSetup \? setup\(clean, pin\) : login\(clean, pin\)/);
  for (const key of ['setupTitle', 'loginTitle', 'pin', 'confirmPin', 'pinMismatch', 'setupAction', 'loginAction']) {
    assert.match(i18nSource, new RegExp(`${key}:`));
  }
});

test('login fields have persistent labels, autofill hints, and announced errors', () => {
  for (const fieldId of ['login-name', 'login-pin', 'login-confirm-pin']) {
    assert.match(loginSource, new RegExp(`htmlFor="${fieldId}"`));
    assert.match(loginSource, new RegExp(`id="${fieldId}"`));
  }
  assert.match(loginSource, /name="username"[\s\S]*autoComplete="username"/);
  assert.match(loginSource, /name="pin"[\s\S]*autoComplete=\{requiresSetup \? 'new-password' : 'current-password'\}/);
  assert.match(loginSource, /name="confirm-pin"[\s\S]*autoComplete="new-password"/);
  assert.match(loginSource, /id="login-error"[\s\S]*role="alert"/);
});

test('payments page shows backend errors instead of closing the payment form', () => {
  assert.match(paymentsSource, /toast\.error/);
  assert.match(paymentsSource, /if \(!res\.ok\)/);
  assert.match(paymentsSource, /Payment exceeds remaining balance/);
});

test('payments edit form checks update errors before closing', () => {
  assert.match(paymentsSource, /const res = await fetch\(`\/api\/payments\/\$\{editTarget\.id\}`/);
  assert.match(paymentsSource, /toast\.error\(await readError\(res, t\('page\.payments\.failedUpdateInvoice'\)\)\)/);
  assert.match(paymentsSource, /setEditTarget\(null\);[\s\S]*load\(\);/);
});

test('payments write actions show saving state and success feedback', () => {
  assert.match(paymentsSource, /const \[savingAction, setSavingAction\] = useState/);
  assert.match(paymentsSource, /setSavingAction\('create'\)/);
  assert.match(paymentsSource, /setSavingAction\('edit'\)/);
  assert.match(paymentsSource, /setSavingAction\('pay'\)/);
  assert.match(paymentsSource, /finally \{[\s\S]*setSavingAction\(null\);[\s\S]*\}/);
  assert.match(paymentsSource, /toast\.success\(t\('page\.payments\.invoiceCreated'\)\)/);
  assert.match(paymentsSource, /toast\.success\(t\('page\.payments\.invoiceUpdated'\)\)/);
  assert.match(paymentsSource, /toast\.success\(t\('page\.payments\.paymentRecorded'\)\)/);
  assert.match(paymentsSource, /savingAction === 'create' \? t\('page\.payments\.saving'\)/);
  assert.match(paymentsSource, /savingAction === 'edit' \? t\('page\.payments\.saving'\)/);
  assert.match(paymentsSource, /savingAction === 'pay' \? t\('page\.payments\.saving'\)/);
});
