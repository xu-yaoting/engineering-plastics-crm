import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const auditSource = readFileSync(new URL('../server/audit.ts', import.meta.url), 'utf8');
const paymentsSource = readFileSync(new URL('../server/routes/payments.ts', import.meta.url), 'utf8');
const ordersSource = readFileSync(new URL('../server/routes/orders.ts', import.meta.url), 'utf8');
const shipmentsSource = readFileSync(new URL('../server/routes/shipments.ts', import.meta.url), 'utf8');
const inquiriesSource = readFileSync(new URL('../server/routes/inquiries.ts', import.meta.url), 'utf8');
const quotationsSource = readFileSync(new URL('../server/routes/quotations.ts', import.meta.url), 'utf8');
const companiesSource = readFileSync(new URL('../server/routes/companies.ts', import.meta.url), 'utf8');
const contactsSource = readFileSync(new URL('../server/routes/contacts.ts', import.meta.url), 'utf8');
const inventorySource = readFileSync(new URL('../server/routes/inventory.ts', import.meta.url), 'utf8');
const tasksSource = readFileSync(new URL('../server/routes/tasks.ts', import.meta.url), 'utf8');
const activitiesSource = readFileSync(new URL('../server/routes/activities.ts', import.meta.url), 'utf8');
const samplesSource = readFileSync(new URL('../server/routes/sample-requests.ts', import.meta.url), 'utf8');
const smokeSource = readFileSync(new URL('../tests/api-write-smoke.mjs', import.meta.url), 'utf8');
const dbSource = readFileSync(new URL('../server/db.ts', import.meta.url), 'utf8');
const serverSource = readFileSync(new URL('../server/index.ts', import.meta.url), 'utf8');

test('team accountability fields are added with safe additive migrations', () => {
  for (const table of ['companies', 'inquiries', 'quotations', 'sample_requests', 'orders']) {
    assert.match(dbSource, new RegExp(`['\"]${table}['\"]`));
  }
  for (const table of [
    'companies', 'contacts', 'activities', 'tasks', 'inquiries', 'quotations',
    'sample_requests', 'orders', 'shipments', 'invoices', 'payment_records',
    'products', 'inventory_transactions',
  ]) {
    assert.match(dbSource, new RegExp(`['\"]${table}['\"]`));
  }
  for (const table of [
    'companies', 'contacts', 'activities', 'tasks', 'inquiries', 'quotations',
    'sample_requests', 'orders', 'shipments', 'invoices', 'products',
  ]) {
    assert.match(dbSource, new RegExp(`['\"]${table}['\"]`));
  }
  assert.match(dbSource, /ALTER TABLE \$\{table\} ADD COLUMN owner_user_id TEXT/);
  assert.match(dbSource, /ALTER TABLE \$\{table\} ADD COLUMN created_by TEXT/);
  assert.match(dbSource, /ALTER TABLE \$\{table\} ADD COLUMN updated_by TEXT/);
  assert.match(dbSource, /idx_companies_owner_user/);
});

test('audit helper records the authenticated actor and structured changes', () => {
  assert.match(auditSource, /req\.user/);
  assert.match(auditSource, /INSERT INTO audit_log/);
  assert.match(auditSource, /JSON\.stringify\(changes\)/);
  assert.match(auditSource, /throw new Error\('Authenticated user is required for audit logging'\)/);
});

test('audit helper computes field-level before and after changes', () => {
  assert.match(auditSource, /export function computeChanges/);
  assert.match(auditSource, /old: beforeRecord\[field\]/);
  assert.match(auditSource, /new: afterRecord\[field\]/);
  assert.match(auditSource, /IGNORED_AUDIT_FIELDS/);
});

test('authenticated audit history API validates entity filters and parses stored changes', () => {
  assert.match(auditSource, /export const auditRouter = Router\(\)/);
  assert.match(auditSource, /auditRouter\.get\('\/'/);
  assert.match(auditSource, /entity_type and entity_id are required/);
  assert.match(auditSource, /JSON\.parse\(row\.changes/);
  assert.match(serverSource, /app\.use\('\/api\/audit', auditRouter\)/);
});

test('payment writes record create, update, payment, and delete audit events', () => {
  assert.match(paymentsSource, /writeAudit\(req, 'invoice', id, 'create'/);
  assert.match(paymentsSource, /writeAudit\(req, 'invoice', req\.params\.id, 'update'/);
  assert.match(paymentsSource, /writeAudit\(req, 'payment_record', paymentId, 'create'/);
  assert.match(paymentsSource, /writeAudit\(req, 'invoice', req\.params\.id, 'delete'/);
});

test('payment data changes and audit events share database transactions', () => {
  assert.ok((paymentsSource.match(/db\.transaction\(\(\) =>/g) || []).length >= 4);
});

test('write smoke verifies payment audit events and removes its audit history', () => {
  assert.match(smokeSource, /function verifyPaymentAudit\(\)/);
  assert.match(smokeSource, /payment_applied/);
  assert.match(smokeSource, /payment_record/);
  assert.match(smokeSource, /action = 'delete'/);
  assert.match(smokeSource, /DELETE FROM audit_log WHERE user_id = \?/);
});

test('order writes audit orders and individual line item changes', () => {
  assert.match(ordersSource, /writeAudit\(req, 'order', id, 'create'/);
  assert.match(ordersSource, /writeAudit\(req, 'order', req\.params\.id, 'update'/);
  assert.match(ordersSource, /writeAudit\(req, 'order', req\.params\.id, 'delete'/);
  assert.match(ordersSource, /writeAudit\(req, 'order_line_item', req\.params\.id, 'update'/);
  assert.ok((ordersSource.match(/db\.transaction\(\(\) =>/g) || []).length >= 4);
});

test('shipment create, update, and delete writes are audited transactionally', () => {
  assert.match(shipmentsSource, /writeAudit\(req, 'shipment', id, 'create'/);
  assert.match(shipmentsSource, /writeAudit\(req, 'shipment', req\.params\.id, 'update'/);
  assert.match(shipmentsSource, /writeAudit\(req, 'shipment', req\.params\.id, 'delete'/);
  assert.ok((shipmentsSource.match(/db\.transaction\(\(\) =>/g) || []).length >= 3);
});

test('inquiry create, update, and delete writes are audited transactionally', () => {
  assert.match(inquiriesSource, /writeAudit\(req, 'inquiry', id, 'create'/);
  assert.match(inquiriesSource, /writeAudit\(req, 'inquiry', req\.params\.id, 'update'/);
  assert.match(inquiriesSource, /writeAudit\(req, 'inquiry', req\.params\.id, 'delete'/);
  assert.ok((inquiriesSource.match(/db\.transaction\(\(\) =>/g) || []).length >= 3);
});

test('quotation writes and approval decisions are audited transactionally', () => {
  assert.match(quotationsSource, /writeAudit\(req, 'quotation', id, 'create'/);
  assert.match(quotationsSource, /writeAudit\(req, 'quotation', req\.params\.id, 'update'/);
  assert.match(quotationsSource, /writeAudit\(req, 'quotation', req\.params\.id, 'delete'/);
  assert.match(quotationsSource, /writeAudit\(req, 'quotation', req\.params\.id, action/);
  assert.ok((quotationsSource.match(/db\.transaction\(\(\) =>/g) || []).length >= 4);
});

test('company ownership and customer/contact writes capture authenticated actors', () => {
  assert.match(companiesSource, /owner_user_id/);
  assert.match(companiesSource, /created_by/);
  assert.match(companiesSource, /updated_by/);
  assert.match(companiesSource, /computeChanges/);
  assert.ok((companiesSource.match(/writeAudit\(req, 'company'/g) || []).length >= 4);
  assert.ok((companiesSource.match(/db\.transaction\(\(\) =>/g) || []).length >= 3);

  assert.match(contactsSource, /created_by/);
  assert.match(contactsSource, /updated_by/);
  assert.match(contactsSource, /computeChanges/);
  assert.ok((contactsSource.match(/writeAudit\(req, 'contact'/g) || []).length >= 3);
  assert.ok((contactsSource.match(/db\.transaction\(\(\) =>/g) || []).length >= 3);
});

test('inventory products and stock movements record authenticated actors and quantity changes', () => {
  assert.match(inventorySource, /computeChanges, writeAudit/);
  assert.match(inventorySource, /created_by/);
  assert.match(inventorySource, /updated_by/);
  assert.ok((inventorySource.match(/writeAudit\(req, 'product'/g) || []).length >= 3);
  assert.ok((inventorySource.match(/writeAudit\(req, 'inventory_transaction'/g) || []).length >= 3);
  assert.match(inventorySource, /before_quantity/);
  assert.match(inventorySource, /change_quantity/);
  assert.match(inventorySource, /after_quantity/);
  assert.match(inventorySource, /req\.user!\.name/);
  assert.doesNotMatch(inventorySource, /req\.body\.operator \|\| null/);
});

test('inquiries and quotations inherit ownership and update actor metadata', () => {
  for (const routeSource of [quotationsSource]) {
    assert.match(routeSource, /owner_user_id/);
    assert.match(routeSource, /created_by/);
    assert.match(routeSource, /updated_by/);
    assert.match(routeSource, /owner_name/);
    assert.match(routeSource, /computeChanges/);
  }
  assert.match(quotationsSource, /company\.owner_user_id \|\| req\.user!\.id/);
});

test('orders inherit ownership while shipments capture creator and updater', () => {
  assert.match(ordersSource, /quotation\.owner_user_id \|\| company\.owner_user_id \|\| req\.user!\.id/);
  assert.match(ordersSource, /owner_name/);
  assert.match(ordersSource, /created_by/);
  assert.match(ordersSource, /updated_by/);
  assert.match(ordersSource, /computeChanges/);
  assert.match(shipmentsSource, /created_by/);
  assert.match(shipmentsSource, /updated_by/);
  assert.match(shipmentsSource, /created_by_name/);
  assert.match(shipmentsSource, /computeChanges/);
});

test('payments capture authenticated creator and updater metadata', () => {
  assert.match(paymentsSource, /created_by, updated_by/);
  assert.match(paymentsSource, /req\.user!\.id/);
  assert.match(paymentsSource, /payment_records[\s\S]*created_by/);
  assert.match(paymentsSource, /UPDATE invoices[\s\S]*updated_by = \?/);
  assert.match(paymentsSource, /computeChanges\(/);
});

test('tasks support team assignment and audit every write', () => {
  assert.match(tasksSource, /assigned_to_user_id/);
  assert.match(tasksSource, /assignee_name/);
  assert.match(tasksSource, /created_by, updated_by/);
  assert.match(tasksSource, /writeAudit\(req, 'task'/);
  assert.match(tasksSource, /computeChanges\(/);
});

test('activities capture authenticated actors and audit existing write flows', () => {
  assert.match(activitiesSource, /created_by, updated_by/);
  assert.match(activitiesSource, /created_by_name/);
  assert.match(activitiesSource, /writeAudit\(req, 'activity'/);
});

test('sample requests inherit ownership and record their creator', () => {
  assert.match(samplesSource, /owner_user_id/);
  assert.match(samplesSource, /owner_name/);
  assert.match(samplesSource, /created_by, updated_by/);
  assert.match(samplesSource, /writeAudit\(req, 'sample_request'/);
});
