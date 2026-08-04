import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const teamSource = readFileSync(new URL('../server/routes/team.ts', import.meta.url), 'utf8');
const orderRouteSource = readFileSync(new URL('../server/routes/orders.ts', import.meta.url), 'utf8');
const quotationRouteSource = readFileSync(new URL('../server/routes/quotations.ts', import.meta.url), 'utf8');
const companyRouteSource = readFileSync(new URL('../server/routes/companies.ts', import.meta.url), 'utf8');
const companyCreateSource = companyRouteSource.slice(
  companyRouteSource.indexOf("router.post('/',"),
  companyRouteSource.indexOf("router.put('/:id',"),
);
const serverSource = readFileSync(new URL('../server/index.ts', import.meta.url), 'utf8');
const apiSource = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8');
const panelSource = readFileSync(new URL('../src/components/shared/AccountabilityPanel.tsx', import.meta.url), 'utf8');
const companyDetailSource = readFileSync(new URL('../src/pages/CompanyDetail.tsx', import.meta.url), 'utf8');
const companyEditSource = readFileSync(new URL('../src/components/companies/CompanyEditPanel.tsx', import.meta.url), 'utf8');
const quotationDetailSource = readFileSync(new URL('../src/pages/QuotationDetail.tsx', import.meta.url), 'utf8');
const quotationEditSource = readFileSync(new URL('../src/components/quotations/QuotationEditPanel.tsx', import.meta.url), 'utf8');
const orderDetailSource = readFileSync(new URL('../src/pages/OrderDetail.tsx', import.meta.url), 'utf8');
const shipmentDetailSource = readFileSync(new URL('../src/pages/ShipmentDetail.tsx', import.meta.url), 'utf8');
const companiesPageSource = readFileSync(new URL('../src/pages/Companies.tsx', import.meta.url), 'utf8');
const taskSectionSource = readFileSync(new URL('../src/components/shared/TaskSection.tsx', import.meta.url), 'utf8');
const paymentsPageSource = readFileSync(new URL('../src/pages/Payments.tsx', import.meta.url), 'utf8');
const inventoryPageSource = readFileSync(new URL('../src/pages/InventoryPage.tsx', import.meta.url), 'utf8');
const ownerFilterSource = readFileSync(new URL('../src/components/shared/OwnerFilter.tsx', import.meta.url), 'utf8');
const quotationsPageSource = readFileSync(new URL('../src/pages/Quotations.tsx', import.meta.url), 'utf8');
const ordersPageSource = readFileSync(new URL('../src/pages/Orders.tsx', import.meta.url), 'utf8');

test('authenticated users can list active team members without credential fields', () => {
  assert.match(serverSource, /app\.use\('\/api\/team', teamRouter\)/);
  assert.match(teamSource, /SELECT id, name, role FROM users WHERE is_active = 1/);
  assert.doesNotMatch(teamSource, /pin_hash|pin_salt|token/);
});

test('quotation and order lists use consistent owner filtering and columns', () => {
  for (const source of [quotationsPageSource, ordersPageSource]) {
    assert.match(source, /OwnerFilter/);
    assert.match(source, /owner_user_id/);
    assert.match(source, /owner_name/);
  }
});

test('inquiry list uses the shared owner filter and shows ownership', () => {
  assert.match(ownerFilterSource, /team\.list/);
  assert.match(ownerFilterSource, /auth\.me/);
  assert.match(quotationsPageSource, /OwnerFilter/);
  assert.match(quotationsPageSource, /owner_name/);
  assert.match(quotationsPageSource, /owner_user_id/);
});

test('payment and inventory pages expose authenticated operators without manual impersonation', () => {
  assert.match(paymentsPageSource, /updated_by_name/);
  assert.match(paymentsPageSource, /accountability\.updatedBy/);
  const transactionForm = inventoryPageSource.slice(
    inventoryPageSource.indexOf('function TransactionForm'),
    inventoryPageSource.indexOf('// ─── Import'),
  );
  assert.doesNotMatch(transactionForm, /placeholderOperator|form\.operator/);
});

test('task quick add supports assignees and shows the assigned team member', () => {
  assert.match(taskSectionSource, /team\.list/);
  assert.match(taskSectionSource, /assigned_to_user_id/);
  assert.match(taskSectionSource, /assignee_name/);
});

test('customer list can distinguish, filter, and reassign owners', () => {
  assert.match(companiesPageSource, /ownerFilter/);
  assert.match(companiesPageSource, /owner_name/);
  assert.match(companiesPageSource, /owner_user_id/);
  assert.match(companiesPageSource, /team\.list/);
});

test('shipment details show operation accountability without an ownership label', () => {
  assert.match(shipmentDetailSource, /AccountabilityPanel[\s\S]*entityType="shipment"/);
  assert.match(shipmentDetailSource, /showOwner=\{false\}/);
});

test('order details show inherited ownership and accountability history', () => {
  assert.match(orderDetailSource, /AccountabilityPanel[\s\S]*entityType="order"/);
  assert.match(panelSource, /showOwner/);
});

test('only administrators can transfer an order owner', () => {
  assert.match(orderRouteSource, /owner_user_id[\s\S]*req\.user!\.role !== 'admin'[\s\S]*status\(403\)/);
  assert.match(orderDetailSource, /useAuth\(\)/);
  assert.match(orderDetailSource, /team\.list\(\)/);
  assert.match(orderDetailSource, /user\?\.role === 'admin'[\s\S]*owner_user_id/);
});

test('quotation details expose inherited accountability', () => {
  assert.match(quotationDetailSource, /AccountabilityPanel[\s\S]*entityType="quotation"/);
});

test('only administrators can transfer quotation owners', () => {
  assert.match(quotationRouteSource, /owner_user_id[\s\S]*req\.user!\.role !== 'admin'[\s\S]*status\(403\)/);
  assert.match(quotationEditSource, /useAuth\(\)/);
  assert.match(quotationEditSource, /team\.list\(\)/);
  assert.match(quotationEditSource, /user\?\.role === 'admin'[\s\S]*owner_user_id/);
});

test('company ownership transfers are admin-only and validate active users', () => {
  assert.match(companyRouteSource, /owner_user_id[\s\S]*req\.user!\.role !== 'admin'[\s\S]*status\(403\)/);
  assert.match(companyRouteSource, /requestedOwnerId !== \(before\.owner_user_id \|\| null\) && req\.user!\.role !== 'admin'/);
  assert.match(companyRouteSource, /SELECT id FROM users WHERE id = \? AND is_active = 1/);
  assert.match(companyRouteSource, /Invalid or inactive owner/);
  assert.match(companyCreateSource, /owner_user_id[\s\S]*req\.user!\.id, req\.user!\.id, req\.user!\.id/);
  assert.doesNotMatch(companyCreateSource, /req\.body\.owner_user_id/);
});

test('company detail shows accountability and only admins see or submit owner controls', () => {
  assert.match(companyDetailSource, /AccountabilityPanel/);
  assert.match(companyDetailSource, /entityType="company"/);
  assert.match(companyEditSource, /useAuth\(\)/);
  assert.match(companyEditSource, /team\.list/);
  assert.match(companyEditSource, /user\?\.role === 'admin'[\s\S]*owner_user_id/);
  assert.match(companyEditSource, /if \(user\?\.role !== 'admin'\)[\s\S]*delete payload\.owner_user_id/);
});

test('frontend exposes team and audit APIs through a reusable accountability panel', () => {
  assert.match(apiSource, /export const team/);
  assert.match(apiSource, /export const audit/);
  assert.match(panelSource, /owner_name/);
  assert.match(panelSource, /created_by_name/);
  assert.match(panelSource, /updated_by_name/);
  assert.match(panelSource, /audit\.list/);
  assert.match(panelSource, /changeEntries/);
  assert.match(panelSource, /change\.old/);
  assert.match(panelSource, /change\.new/);
});
