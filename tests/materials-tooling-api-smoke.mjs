import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import Database from 'better-sqlite3';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = mkdtempSync(path.join(tmpdir(), 'mt-smoke-'));
const attachmentsRoot = path.join(sandbox, 'attachments');
mkdirSync(attachmentsRoot, { recursive: true });

import { ensureMaterialsToolingSchema } from '../server/materials-tooling/schema.js';
import { createMaterialsToolingRouter } from '../server/routes/materials-tooling.js';

const db = new Database(':memory:');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE audit_log (id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, user_id TEXT, user_name TEXT NOT NULL, action TEXT NOT NULL, changes TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL);
`);
ensureMaterialsToolingSchema(db);
db.exec(`
  INSERT INTO users (id, name, role) VALUES
    ('admin', 'Admin', 'admin'), ('member', 'Member', 'member'),
    ('clerk', 'Moana', 'member'), ('approver', 'Approver', 'member');
  INSERT INTO mt_permissions (user_id, manage_materials, approve, view_prices, manage_periods, updated_by, updated_at)
    VALUES ('clerk', 1, 0, 1, 0, 'admin', 'x'), ('approver', 0, 1, 1, 0, 'admin', 'x');
  INSERT INTO mt_approval_config (document_type, approver_user_id, updated_by, updated_at)
    VALUES ('material_issue', 'approver', 'admin', 'x'), ('tooling_movement', 'approver', 'admin', 'x');
  INSERT INTO mt_suppliers (id, code, name, is_active, created_by, updated_by, created_at, updated_at)
    VALUES ('supplier', 'SUP-1', 'Test Supplier', 1, 'admin', 'admin', 'x', 'x');
  INSERT INTO mt_items (id, code, name, category, unit, safety_quantity, created_by, updated_by, created_at, updated_at)
    VALUES ('item1', 'BRUSH', 'Brush', '消耗品', '把', 5, 'admin', 'admin', 'x', 'x');
  INSERT INTO mt_tooling_assets (id, tooling_code, name, category, specification, status, custodian_user_id, location, created_by, updated_by, created_at, updated_at)
    VALUES ('ta-1', 'MOLD-001', 'Test Mold', 'Mold', 'A4', 'in_stock', NULL, 'Warehouse A', 'admin', 'admin', 'x', 'x');
  INSERT INTO mt_movements (id, item_id, movement_type, quantity_delta, movement_date, created_by, created_at, source_workbook, cutover_period)
    VALUES ('opening', 'item1', 'opening_balance', 10, '2026-07-01', 'admin', 'x', 'initial.xlsx', '2026-07');
`);

const users = new Map([
  ['admin', { id: 'admin', name: 'Admin', role: 'admin' }],
  ['member', { id: 'member', name: 'Member', role: 'member' }],
  ['clerk', { id: 'clerk', name: 'Moana', role: 'member' }],
  ['approver', { id: 'approver', name: 'Approver', role: 'member' }],
]);

const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.user = users.get(String(req.headers['x-test-user'])); next(); });
app.use('/mt', createMaterialsToolingRouter(db, {
  attachments: { storageRoot: attachmentsRoot },
  pdfs: { storageRoot: attachmentsRoot },
}));

const server = await new Promise((resolve, reject) => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  listener.on('error', reject);
});
const port = server.address().port;
const base = `http://127.0.0.1:${port}/mt`;

async function call(pathname, user = 'admin', method = 'GET', body) {
  const response = await fetch(base + pathname, {
    method,
    headers: {
      'x-test-user': user,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let bodyJson;
  try { bodyJson = JSON.parse(text); } catch { bodyJson = { raw: text.slice(0, 200) }; }
  return { status: response.status, body: bodyJson };
}

let failCount = 0;
let passCount = 0;
async function t(label, fn) {
  try { await fn(); passCount += 1; console.log(`  ✓ ${label}`); }
  catch (e) { failCount += 1; console.error(`  ✗ ${label}: ${e.message}`); }
}

// ─── 1. Permission ───
console.log('\n1. Permission');
await t('unauthenticated blocked', async () => {
  assert.equal((await fetch(base + '/tooling')).status, 401);
});
await t('member can GET items', async () => {
  const r = await call('/items', 'member');
  assert.equal(r.status, 200); assert.ok(Array.isArray(r.body.items));
});
await t('member cannot POST items', async () => {
  const r = await call('/items', 'member', 'POST', { code: 'X', name: 'X', category: 'X', unit: 'x' });
  assert.equal(r.status, 403);
});
await t('clerk can POST items', async () => {
  const r = await call('/items', 'clerk', 'POST', { code: 'MOP', name: 'Mop', category: '工具', unit: '把' });
  assert.equal(r.status, 201);
});

// ─── 2. Document workflow ───
console.log('\n2. Document workflow');
let issueDocId;
await t('clerk creates material_issue', async () => {
  const r = await call('/documents', 'clerk', 'POST', {
    document_type: 'material_issue', department: '生产部', request_date: '2026-07-15', recipient_name: 'Worker',
    lines: [{ material_item_id: 'item1', requested_quantity: 3, execution_quantity: 3, unit: '把' }],
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  issueDocId = r.body.document.id;
});
await t('clerk submits', async () => {
  assert.equal((await call(`/documents/${issueDocId}/submit`, 'clerk', 'POST', {})).status, 200);
});
await t('approver approves', async () => {
  assert.equal((await call(`/documents/${issueDocId}/approve`, 'approver', 'POST', {})).status, 200);
});
await t('clerk executes', async () => {
  assert.equal((await call(`/documents/${issueDocId}/execute`, 'clerk', 'POST', {})).status, 200);
});
await t('duplicate execute blocked', async () => {
  assert.equal((await call(`/documents/${issueDocId}/execute`, 'clerk', 'POST', {})).status, 409);
});
// Self-approval test: approver creates & submits own doc, then cannot approve
await t('self-approval blocked', async () => {
  const r = await call('/documents', 'approver', 'POST', {
    document_type: 'material_issue', department: '生产部', request_date: '2026-07-15', recipient_name: 'Worker',
    lines: [{ material_item_id: 'item1', requested_quantity: 1, execution_quantity: 1, unit: '把' }],
  });
  const selfId = r.body.document.id;
  await call(`/documents/${selfId}/submit`, 'approver', 'POST', {});
  // Approver has approve permission but can't approve own doc
  assert.equal((await call(`/documents/${selfId}/approve`, 'approver', 'POST', {})).status, 409);
  // Cleanup: admin withdraws the doc
  await call(`/documents/${selfId}/withdraw`, 'admin', 'POST', {});
});

// ─── 3. Tooling ───
console.log('\n3. Tooling lifecycle');
let toolDocId;
await t('clerk creates tooling document', async () => {
  const r = await call('/documents', 'clerk', 'POST', {
    document_type: 'tooling_movement', department: '生产部', request_date: '2026-07-15',
    tooling_request: { asset_id: 'ta-1', action: 'issue', to_custodian_user_id: 'clerk', to_location: 'Workshop' },
    lines: [],
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  toolDocId = r.body.document.id;
});
await t('clerk submits tooling', async () => {
  assert.equal((await call(`/documents/${toolDocId}/submit`, 'clerk', 'POST', {})).status, 200);
});
await t('approver approves tooling', async () => {
  assert.equal((await call(`/documents/${toolDocId}/approve`, 'approver', 'POST', {})).status, 200);
});
await t('clerk executes tooling', async () => {
  assert.equal((await call(`/documents/${toolDocId}/execute`, 'clerk', 'POST', {})).status, 200);
});
await t('asset status updated to in_use', async () => {
  const r = await call('/tooling/ta-1', 'member');
  assert.equal(r.status, 200); assert.equal(r.body.tooling.status, 'in_use');
});

// ─── 4. Tooling void reversal ───
console.log('\n4. Tooling void reversal');
await t('admin voids tooling movement', async () => {
  const r = await call(`/documents/${toolDocId}/void-and-replace`, 'admin', 'POST', { reason: 'Correction' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.tooling);
});
await t('asset restored to in_stock', async () => {
  const r = await call('/tooling/ta-1', 'member');
  assert.equal(r.status, 200); assert.equal(r.body.tooling.status, 'in_stock');
});

// ─── 5. Overview ───
console.log('\n5. Overview');
await t('overview returns real data', async () => {
  const r = await call('/overview', 'member');
  assert.equal(r.status, 200);
  assert.ok(r.body.overview.month);
  assert.ok('pendingApprovals' in r.body.overview);
  assert.ok(Array.isArray(r.body.overview.lowStockItems));
});

// ─── Summary ───
const total = passCount + failCount;
console.log(`\n${failCount > 0 ? '✗' : '✓'} ${passCount}/${total} passed`);
if (failCount > 0) console.error(`${failCount} test(s) failed`);

// Cleanup
server.close(); db.close(); rmSync(sandbox, { recursive: true, force: true });
if (failCount > 0) process.exit(1);
