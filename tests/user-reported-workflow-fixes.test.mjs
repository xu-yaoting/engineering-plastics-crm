import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const contactPanelSource = readFileSync(new URL('../src/components/contacts/ContactPanel.tsx', import.meta.url), 'utf8');
const inventorySource = readFileSync(new URL('../src/pages/InventoryPage.tsx', import.meta.url), 'utf8');
const profileSource = readFileSync(new URL('../src/pages/SettingsProfile.tsx', import.meta.url), 'utf8');
const userMenuSource = readFileSync(new URL('../src/components/shared/UserMenu.tsx', import.meta.url), 'utf8');
const i18nSource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');
const sidePanelSource = readFileSync(new URL('../src/components/shared/SidePanel.tsx', import.meta.url), 'utf8');
const aboutModalSource = readFileSync(new URL('../src/components/shared/AboutModal.tsx', import.meta.url), 'utf8');
const companyEditPanelSource = readFileSync(new URL('../src/components/companies/CompanyEditPanel.tsx', import.meta.url), 'utf8');
const companiesPageSource = readFileSync(new URL('../src/pages/Companies.tsx', import.meta.url), 'utf8');
const shipmentDetailSource = readFileSync(new URL('../src/pages/ShipmentDetail.tsx', import.meta.url), 'utf8');
const orderDetailSource = readFileSync(new URL('../src/pages/OrderDetail.tsx', import.meta.url), 'utf8');
const quotationDetailSource = readFileSync(new URL('../src/pages/QuotationDetail.tsx', import.meta.url), 'utf8');
const tasksPageSource = readFileSync(new URL('../src/pages/Tasks.tsx', import.meta.url), 'utf8');
const activityTimelineSource = readFileSync(new URL('../src/components/shared/ActivityTimeline.tsx', import.meta.url), 'utf8');
const ordersPageSource = readFileSync(new URL('../src/pages/Orders.tsx', import.meta.url), 'utf8');
const shipmentsPageSource = readFileSync(new URL('../src/pages/Shipments.tsx', import.meta.url), 'utf8');
const paymentsPageSource = readFileSync(new URL('../src/pages/Payments.tsx', import.meta.url), 'utf8');
const materialsToolingPageSource = readFileSync(new URL('../src/pages/MaterialsToolingPage.tsx', import.meta.url), 'utf8');
const topBarSource = readFileSync(new URL('../src/components/layout/TopBar.tsx', import.meta.url), 'utf8');
const dashboardSource = readFileSync(new URL('../src/pages/Dashboard.tsx', import.meta.url), 'utf8');
const pipelineSource = readFileSync(new URL('../src/pages/Pipeline.tsx', import.meta.url), 'utf8');
const exportCsvSource = readFileSync(new URL('../src/lib/exportCsv.ts', import.meta.url), 'utf8');
const contactsPageSource = readFileSync(new URL('../src/pages/Contacts.tsx', import.meta.url), 'utf8');
const quotationsPageSource = readFileSync(new URL('../src/pages/Quotations.tsx', import.meta.url), 'utf8');
const activitiesPageSource = readFileSync(new URL('../src/pages/Activities.tsx', import.meta.url), 'utf8');
const companyDetailSource = readFileSync(new URL('../src/pages/CompanyDetail.tsx', import.meta.url), 'utf8');
const followUpWorkbenchSource = readFileSync(new URL('../src/pages/FollowUpWorkbench.tsx', import.meta.url), 'utf8');
const quotationEditPanelSource = readFileSync(new URL('../src/components/quotations/QuotationEditPanel.tsx', import.meta.url), 'utf8');
const ownerFilterSource = readFileSync(new URL('../src/components/shared/OwnerFilter.tsx', import.meta.url), 'utf8');
const accountabilityPanelSource = readFileSync(new URL('../src/components/shared/AccountabilityPanel.tsx', import.meta.url), 'utf8');
const followUpPanelSource = readFileSync(new URL('../src/components/companies/FollowUpPanel.tsx', import.meta.url), 'utf8');
const taskSectionSource = readFileSync(new URL('../src/components/shared/TaskSection.tsx', import.meta.url), 'utf8');
const approvalsTabSource = readFileSync(new URL('../src/components/materials-tooling/ApprovalsTab.tsx', import.meta.url), 'utf8');
const documentsTabSource = readFileSync(new URL('../src/components/materials-tooling/DocumentsTab.tsx', import.meta.url), 'utf8');
const materialsTabSource = readFileSync(new URL('../src/components/materials-tooling/MaterialsTab.tsx', import.meta.url), 'utf8');
const ledgerTabSource = readFileSync(new URL('../src/components/materials-tooling/LedgerTab.tsx', import.meta.url), 'utf8');
const toolingTabSource = readFileSync(new URL('../src/components/materials-tooling/ToolingTab.tsx', import.meta.url), 'utf8');
const materialsSettingsSource = readFileSync(new URL('../src/components/materials-tooling/MaterialsSettings.tsx', import.meta.url), 'utf8');

test('company and contact editors use grouped responsive forms with stable actions', () => {
  for (const panelSource of [companyEditPanelSource, contactPanelSource]) {
    assert.match(panelSource, /<fieldset/);
    assert.match(panelSource, /<legend/);
    assert.match(panelSource, /sm:grid-cols-2/);
    assert.match(panelSource, /sticky bottom-0/);
  }

  assert.match(contactPanelSource, /className="size-4/);
  assert.match(contactPanelSource, /className="flex cursor-pointer items-center/);
  assert.doesNotMatch(contactPanelSource, /className="w-4 h-4/);
});

test('company and contact editors expose persistent labels and field-level validation', () => {
  assert.match(companyEditPanelSource, /const \[errors, setErrors\]/);
  assert.match(companyEditPanelSource, /aria-invalid=\{!!errors\.name\}/);
  assert.match(companyEditPanelSource, /aria-describedby=\{errors\.name \? 'company-name-error' : undefined\}/);
  assert.match(companyEditPanelSource, /id="company-address-line-1"/);
  assert.match(companyEditPanelSource, /htmlFor="company-address-line-1"/);
  assert.match(companyEditPanelSource, /className="field-error" role="alert"/);

  assert.match(contactPanelSource, /const \[errors, setErrors\]/);
  assert.match(contactPanelSource, /aria-invalid=\{!!errors\.first_name\}/);
  assert.match(contactPanelSource, /className="field-error" role="alert"/);
  assert.doesNotMatch(contactPanelSource, /errors\.contact_method/);
  assert.doesNotMatch(contactPanelSource, /id="contact-method-error"/);
  for (const fieldId of ['contact-job-title', 'contact-department', 'contact-role', 'contact-notes']) {
    assert.match(contactPanelSource, new RegExp(`htmlFor="${fieldId}"`));
    assert.match(contactPanelSource, new RegExp(`id="${fieldId}"`));
  }
  assert.doesNotMatch(contactPanelSource, /if \(!activeCompanyId\) \{ toast\.error/);
  assert.doesNotMatch(contactPanelSource, /if \(!form\.first_name\.trim\(\) \|\| !form\.last_name\.trim\(\)\) \{ toast\.error/);
});

test('company edit controls have complete labels and autofill semantics', () => {
  for (const fieldId of [
    'company-name',
    'company-type',
    'company-industry',
    'company-owner',
    'company-registration-number',
    'company-customer-code',
    'company-website',
    'company-phone',
    'company-status',
    'company-classification',
    'company-notes',
  ]) {
    assert.match(companyEditPanelSource, new RegExp(`htmlFor="${fieldId}"`));
    assert.match(companyEditPanelSource, new RegExp(`id="${fieldId}"`));
  }
  assert.match(companyEditPanelSource, /id="company-name"[\s\S]*autoComplete="organization"/);
  assert.match(companyEditPanelSource, /id="company-website"[\s\S]*autoComplete="url"/);
  assert.match(companyEditPanelSource, /id="company-phone"[\s\S]*autoComplete="tel"/);
  assert.match(companyEditPanelSource, /id="company-customer-code"[\s\S]*aria-describedby="company-customer-code-help"/);
  assert.match(companyEditPanelSource, /id="company-customer-code-help"/);
});

test('company list edit surfaces backend errors and locks duplicate saves', () => {
  assert.match(companiesPageSource, /<CompanyEditPanel company=\{editTarget\}/);
  assert.match(companyEditPanelSource, /const \[saving, setSaving\] = useState\(false\)/);
  assert.match(companyEditPanelSource, /if \(!company\?\.id\) return/);
  assert.match(companyEditPanelSource, /toast\.error\(e instanceof Error \? e\.message : t\('page\.companies\.companySaveFailed'\)\)/);
  assert.match(companyEditPanelSource, /disabled=\{saving\}/);
});

test('shipment detail status and edit saves surface API errors and lock actions', () => {
  assert.match(shipmentDetailSource, /const \[loadError, setLoadError\] = useState\(false\)/);
  assert.match(shipmentDetailSource, /if \(!res\.ok\) throw new Error\(`Shipment request failed/);
  assert.match(shipmentDetailSource, /t\('page\.error\.loadFailed'\)/);
  assert.match(shipmentDetailSource, /onClick=\{load\}/);
  assert.match(shipmentDetailSource, /const readError = async \(res: Response, fallback: string\)/);
  assert.match(shipmentDetailSource, /const \[savingEdit, setSavingEdit\] = useState\(false\)/);
  assert.match(shipmentDetailSource, /const \[savingStatus, setSavingStatus\] = useState\(false\)/);
  assert.match(shipmentDetailSource, /if \(!res\.ok\) \{/);
  assert.match(shipmentDetailSource, /toast\.error\(await readError\(res, t\('page\.shipments\.shipmentSaveFailed'\)\)\)/);
  assert.match(shipmentDetailSource, /finally \{[\s\S]*setSavingEdit\(false\);[\s\S]*\}/);
  assert.match(shipmentDetailSource, /disabled=\{savingStatus \|\| savingEdit\}/);
  assert.match(shipmentDetailSource, /disabled=\{savingEdit\}/);
});

test('payments list shows retryable load errors instead of a false empty state', () => {
  assert.match(paymentsPageSource, /const \[loadError, setLoadError\] = useState\(false\)/);
  assert.match(paymentsPageSource, /const load = \(\) =>/);
  assert.match(paymentsPageSource, /if \(!res\.ok\) throw new Error\(`Payments request failed/);
  assert.match(paymentsPageSource, /if \(!res\.ok\) throw new Error\(`Orders request failed/);
  assert.match(paymentsPageSource, /setList\(\[\]\);[\s\S]*setOrders\(\[\]\);[\s\S]*setLoadError\(true\)/);
  assert.match(paymentsPageSource, /t\('page\.error\.loadFailed'\)/);
  assert.match(paymentsPageSource, /onClick=\{load\}/);
});

test('materials and global alerts validate read responses and expose retry actions', () => {
  assert.match(materialsToolingPageSource, /if \(!res\.ok\) throw new Error\(`Materials permissions request failed/);
  assert.match(materialsToolingPageSource, /if \(!res\.ok\) throw new Error\(`Materials overview request failed/);
  assert.match(materialsToolingPageSource, /t\('common\.refresh'\)/);
  assert.doesNotMatch(materialsToolingPageSource, /t\('common\.retry'\)/);

  assert.match(topBarSource, /const \[alertLoadError, setAlertLoadError\] = useState\(false\)/);
  assert.match(topBarSource, /const loadAlerts = \(\) =>/);
  assert.match(topBarSource, /if \(!res\.ok\) throw new Error\(`Overdue tasks request failed/);
  assert.match(topBarSource, /if \(!res\.ok\) throw new Error\(`Quotations request failed/);
  assert.match(topBarSource, /alertLoadError \? loadAlerts\(\) : navigate\('\/tasks'\)/);
  assert.match(topBarSource, /t\('page\.error\.loadFailed'\)/);
});

test('workspace dashboard and pipeline show retryable read failures', () => {
  assert.match(dashboardSource, /const \[loadError, setLoadError\] = useState\(false\)/);
  assert.match(dashboardSource, /if \(!res\.ok\) throw new Error\(`Payments request failed/);
  assert.match(dashboardSource, /if \(!res\.ok\) throw new Error\(`Orders request failed/);
  assert.match(dashboardSource, /if \(!res\.ok\) throw new Error\(`Quotations request failed/);
  assert.match(dashboardSource, /if \(!res\.ok\) throw new Error\(`Shipments request failed/);
  assert.match(dashboardSource, /t\('page\.error\.loadFailed'\)/);
  assert.match(dashboardSource, /onClick=\{load\}/);

  assert.match(pipelineSource, /const \[loadError, setLoadError\] = useState\(false\)/);
  assert.match(pipelineSource, /if \(!res\.ok\) throw new Error\(`Pipeline request failed/);
  assert.match(pipelineSource, /setCards\(\[\]\);[\s\S]*setLoadError\(true\)/);
  assert.match(pipelineSource, /t\('page\.error\.loadFailed'\)/);
  assert.match(pipelineSource, /onClick=\{load\}/);
});

test('shipment presets and inventory transaction data expose retryable read failures', () => {
  assert.match(shipmentsPageSource, /const \[presetOrderError, setPresetOrderError\] = useState\(false\)/);
  assert.match(shipmentsPageSource, /if \(!res\.ok\) throw new Error\(`Preset order request failed/);
  assert.match(shipmentsPageSource, /t\('page\.error\.loadFailed'\)/);
  assert.match(shipmentsPageSource, /onClick=\{loadPresetOrder\}/);

  assert.match(inventorySource, /const \[loadError, setLoadError\] = useState\(false\)/);
  assert.match(inventorySource, /throw new Error\('Inventory V2 request failed'\)/);
  assert.match(inventorySource, /setGroups\(\[\]\);[\s\S]*setMovements\(\[\]\);[\s\S]*setUnfilteredGroups\(\[\]\);[\s\S]*setLoadError\(true\)/);
  assert.match(inventorySource, /<InventoryLoadError onRetry=\{load\} \/>/);
});

test('CSV export validates failed and malformed read responses', () => {
  assert.match(exportCsvSource, /const res = await fetch\(apiUrl\)/);
  assert.match(exportCsvSource, /if \(!res\.ok\) throw new Error\(`Export request failed/);
  assert.match(exportCsvSource, /if \(!Array\.isArray\(data\) \|\| data\.length === 0\) return/);
});

test('contacts and quotations lists show retryable read failures', () => {
  assert.match(contactsPageSource, /const \[loadError, setLoadError\] = useState\(false\)/);
  assert.match(contactsPageSource, /contacts\.list\(filterCompany \|\| undefined\)/);
  assert.match(contactsPageSource, /setList\(\[\]\);[\s\S]*setLoadError\(true\)/);
  assert.match(contactsPageSource, /const loadCompanies = \(\) =>/);
  assert.match(contactsPageSource, /const \[companiesLoadError, setCompaniesLoadError\] = useState\(false\)/);
  assert.match(contactsPageSource, /onClick=\{loadCompanies\}/);
  assert.match(contactsPageSource, /onClick=\{load\}/);
  assert.match(contactsPageSource, /t\('page\.error\.loadFailed'\)/);

  assert.match(quotationsPageSource, /const \[loadError, setLoadError\] = useState\(false\)/);
  assert.match(quotationsPageSource, /quotations\.list\(\)/);
  assert.match(quotationsPageSource, /setList\(\[\]\);[\s\S]*setLoadError\(true\)/);
  assert.match(quotationsPageSource, /onClick=\{load\}/);
  assert.match(quotationsPageSource, /t\('page\.error\.loadFailed'\)/);
});

test('companies and activities lists show retryable read failures', () => {
  assert.match(companiesPageSource, /const \[loadError, setLoadError\] = useState\(false\)/);
  assert.match(companiesPageSource, /companies\.list\(\)/);
  assert.match(companiesPageSource, /setList\(\[\]\);[\s\S]*setLoadError\(true\)/);
  assert.match(companiesPageSource, /onClick=\{load\}/);
  assert.match(companiesPageSource, /t\('page\.error\.loadFailed'\)/);

  assert.match(activitiesPageSource, /const \[loadError, setLoadError\] = useState\(false\)/);
  assert.match(activitiesPageSource, /const load = \(\) =>/);
  assert.match(activitiesPageSource, /activities\.recent\(\)/);
  assert.match(activitiesPageSource, /setList\(\[\]\);[\s\S]*setLoadError\(true\)/);
  assert.match(activitiesPageSource, /onClick=\{load\}/);
  assert.match(activitiesPageSource, /t\('page\.error\.loadFailed'\)/);
});

test('tasks and company details show retryable read failures', () => {
  assert.match(tasksPageSource, /const \[loadError, setLoadError\] = useState\(false\)/);
  assert.match(tasksPageSource, /tasks\.list\(\{ status: filter === 'all' \? undefined : filter \}\)/);
  assert.match(tasksPageSource, /setList\(\[\]\);[\s\S]*setLoadError\(true\)/);
  assert.match(tasksPageSource, /onClick=\{load\}/);
  assert.match(tasksPageSource, /t\('page\.error\.loadFailed'\)/);

  assert.match(companyDetailSource, /const \[loadError, setLoadError\] = useState\(false\)/);
  assert.match(companyDetailSource, /Promise\.all\(\[/);
  assert.match(companyDetailSource, /companies\.get\(id\)/);
  assert.match(companyDetailSource, /contacts\.list\(id\)/);
  assert.match(companyDetailSource, /activities\.list\('company', id\)/);
  assert.match(companyDetailSource, /tasks\.list\(\{ entity_type: 'company', entity_id: id \}\)/);
  assert.match(companyDetailSource, /quotations\.list\(id\)/);
  assert.match(companyDetailSource, /setCompany\(null\);[\s\S]*setLoadError\(true\)/);
  assert.match(companyDetailSource, /onClick=\{load\}/);
  assert.match(companyDetailSource, /t\('page\.error\.loadFailed'\)/);
});

test('follow-up and quotation context reads show retryable failures', () => {
  assert.match(followUpWorkbenchSource, /const \[loadError, setLoadError\] = useState\(false\)/);
  assert.match(followUpWorkbenchSource, /followUps\.list\(\)/);
  assert.match(followUpWorkbenchSource, /setItems\(\[\]\);[\s\S]*setLoadError\(true\)/);
  assert.match(followUpWorkbenchSource, /onClick=\{load\}/);
  assert.match(followUpWorkbenchSource, /t\('page\.error\.loadFailed'\)/);

  assert.match(quotationEditPanelSource, /const \[companyLoadError, setCompanyLoadError\] = useState\(false\)/);
  assert.match(quotationEditPanelSource, /const \[contactLoadError, setContactLoadError\] = useState\(false\)/);
  assert.match(quotationEditPanelSource, /companies\.list\(\)[\s\S]*setCompanyLoadError\(true\)/);
  assert.match(quotationEditPanelSource, /contacts\.list\(companyId\)[\s\S]*setContactLoadError\(true\)/);
  assert.match(quotationEditPanelSource, /onClick=\{loadCompanies\}/);
  assert.match(quotationEditPanelSource, /onClick=\{\(\) => loadContacts\(form\.company_id\)\}/);
  assert.match(quotationEditPanelSource, /t\('page\.error\.loadFailed'\)/);
});

test('shared owner and audit reads expose retry actions', () => {
  assert.match(ownerFilterSource, /const \[loadError, setLoadError\] = useState\(false\)/);
  assert.match(ownerFilterSource, /Promise\.all\(\[[\s\S]*team\.list\(\)[\s\S]*auth\.me\(\)/);
  assert.match(ownerFilterSource, /onClick=\{load\}/);
  assert.match(ownerFilterSource, /t\('page\.error\.loadFailed'\)/);

  assert.match(accountabilityPanelSource, /const \[loadError, setLoadError\] = useState\(false\)/);
  assert.match(accountabilityPanelSource, /audit\.list\(entityType, entityId, 12\)/);
  assert.match(accountabilityPanelSource, /setEntries\(\[\]\);[\s\S]*setLoadError\(true\)/);
  assert.match(accountabilityPanelSource, /onClick=\{load\}/);
  assert.match(accountabilityPanelSource, /t\('page\.error\.loadFailed'\)/);
});

test('company edit and follow-up panels expose member-list retry actions', () => {
  for (const panelSource of [companyEditPanelSource, followUpPanelSource]) {
    assert.match(panelSource, /const \[membersLoadError, setMembersLoadError\] = useState\(false\)/);
    assert.match(panelSource, /team\.list\(\)[\s\S]*setMembersLoadError\(true\)/);
    assert.match(panelSource, /onClick=\{loadMembers\}/);
    assert.match(panelSource, /t\('page\.error\.loadFailed'\)/);
    assert.match(panelSource, /t\('common\.refresh'\)/);
  }
});

test('task and quotation editors expose member-list retry actions', () => {
  for (const panelSource of [taskSectionSource, quotationEditPanelSource]) {
    assert.match(panelSource, /const \[membersLoadError, setMembersLoadError\] = useState\(false\)/);
    assert.match(panelSource, /team\.list\(\)[\s\S]*setMembersLoadError\(true\)/);
    assert.match(panelSource, /onClick=\{loadMembers\}/);
    assert.match(panelSource, /t\('page\.error\.loadFailed'\)/);
    assert.match(panelSource, /t\('common\.refresh'\)/);
  }
});

test('company and order owner reads expose member-list retry actions', () => {
  assert.match(companiesPageSource, /const \[membersLoadError, setMembersLoadError\] = useState\(false\)/);
  assert.match(companiesPageSource, /const loadOwnerData = \(\) =>/);
  assert.match(companiesPageSource, /team\.list\(\)[\s\S]*setMembersLoadError\(true\)/);
  assert.match(companiesPageSource, /auth\.me\(\)[\s\S]*setMembersLoadError\(true\)/);
  assert.match(companiesPageSource, /onClick=\{loadOwnerData\}/);
  assert.match(companiesPageSource, /t\('page\.error\.loadFailed'\)/);

  assert.match(orderDetailSource, /const \[membersLoadError, setMembersLoadError\] = useState\(false\)/);
  assert.match(orderDetailSource, /const loadMembers = \(\) =>/);
  assert.match(orderDetailSource, /team\.list\(\)[\s\S]*setMembersLoadError\(true\)/);
  assert.match(orderDetailSource, /onClick=\{loadMembers\}/);
  assert.match(orderDetailSource, /t\('page\.error\.loadFailed'\)/);
});

test('materials tooling document reads expose retryable failures', () => {
  for (const source of [approvalsTabSource, documentsTabSource]) {
    assert.match(source, /const \[loadError, setLoadError\] = useState\(false\)/);
    assert.match(source, /setLoadError\(true\)/);
    assert.match(source, /onClick=\{load\}/);
    assert.match(source, /t\('page\.error\.loadFailed'\)/);
    assert.match(source, /t\('common\.refresh'\)/);
  }
  assert.match(approvalsTabSource, /materialsToolingApi\.listDocuments\(\)/);
  assert.match(documentsTabSource, /materialsToolingApi\.listDocuments\(\)/);
  assert.match(documentsTabSource, /team\.list\(\)/);
});

test('materials and ledger reads expose retryable failures', () => {
  for (const source of [materialsTabSource, ledgerTabSource]) {
    assert.match(source, /const \[loadError, setLoadError\] = useState\(false\)/);
    assert.match(source, /setLoadError\(true\)/);
    assert.match(source, /onClick=\{load\}/);
    assert.match(source, /t\('page\.error\.loadFailed'\)/);
    assert.match(source, /t\('common\.refresh'\)/);
  }
  assert.match(materialsTabSource, /materialsToolingApi\.listItems\(\)/);
  assert.match(ledgerTabSource, /materialsToolingApi\.listLedger\(month\)/);
});

test('tooling and materials settings reads expose retryable failures', () => {
  for (const source of [toolingTabSource, materialsSettingsSource]) {
    assert.match(source, /const \[loadError, setLoadError\] = useState\(false\)/);
    assert.match(source, /setLoadError\(true\)/);
    assert.match(source, /t\('page\.error\.loadFailed'\)/);
    assert.match(source, /t\('common\.refresh'\)/);
  }
  assert.match(toolingTabSource, /onClick=\{load\}/);
  assert.match(toolingTabSource, /materialsToolingApi\.listTooling\(\)/);
  assert.match(materialsSettingsSource, /onClick=\{\(\) => \{ void load\(\); \}\}/);
  assert.match(materialsSettingsSource, /auth\.me\(\)/);
  assert.match(materialsSettingsSource, /materialsToolingApi\.getPermissions\(\)/);
  assert.match(materialsSettingsSource, /materialsToolingApi\.getApprovalConfig\(\)/);
});

test('materials document detail reads expose retryable failures', () => {
  for (const source of [approvalsTabSource, documentsTabSource]) {
    assert.match(source, /const \[detailErrorId, setDetailErrorId\] = useState<string \| null>\(null\)/);
    assert.match(source, /setDetailErrorId\((docId|id)/);
    assert.match(source, /t\('page\.error\.loadFailed'\)/);
    assert.match(source, /t\('common\.refresh'\)/);
    assert.match(source, /role="alert"/);
  }
  assert.match(approvalsTabSource, /materialsToolingApi\.getDocument\(docId\)/);
  assert.match(documentsTabSource, /materialsToolingApi\.getDocument\(id\)/);
  assert.match(documentsTabSource, /materialsToolingApi\.listDocumentAttachments\(id\)/);
});

test('tooling detail reads expose retryable failures', () => {
  assert.match(toolingTabSource, /const \[detailErrorId, setDetailErrorId\] = useState<string \| null>\(null\)/);
  assert.match(toolingTabSource, /setDetailErrorId\(id\)/);
  assert.match(toolingTabSource, /onClick=\{\(\) => \{ void openDetail\(detailErrorId\); \}\}/);
  assert.match(toolingTabSource, /t\('page\.error\.loadFailed'\)/);
  assert.match(toolingTabSource, /t\('common\.refresh'\)/);
  assert.match(toolingTabSource, /materialsToolingApi\.getTooling\(id\)/);
});

test('materials document editing and import reads expose retryable failures', () => {
  assert.match(documentsTabSource, /const \[editErrorId, setEditErrorId\] = useState<string \| null>\(null\)/);
  assert.match(documentsTabSource, /setEditErrorId\(id\)/);
  assert.match(documentsTabSource, /onClick=\{\(\) => \{ void editDocument\(editErrorId\); \}\}/);
  assert.match(materialsTabSource, /const \[importError, setImportError\] = useState\(false\)/);
  assert.match(materialsTabSource, /const \[importRetry, setImportRetry\] = useState<'preview' \| 'confirm' \| null>\(null\)/);
  assert.match(materialsTabSource, /setImportError\(true\)/);
  assert.match(materialsTabSource, /importRetry === 'preview'/);
  assert.match(materialsTabSource, /importRetry === 'confirm'/);
  assert.match(materialsTabSource, /t\('page\.error\.loadFailed'\)/);
  assert.match(materialsTabSource, /t\('common\.refresh'\)/);
});

test('order detail status, duplicate, and delete actions validate API responses', () => {
  assert.match(orderDetailSource, /const \[loadError, setLoadError\] = useState\(false\)/);
  assert.match(orderDetailSource, /if \(!res\.ok\) throw new Error\(`Order request failed/);
  assert.match(orderDetailSource, /if \(!res\.ok\) throw new Error\(`Shipments request failed/);
  assert.match(orderDetailSource, /if \(!res\.ok\) throw new Error\(`Payments request failed/);
  assert.match(orderDetailSource, /t\('page\.error\.loadFailed'\)/);
  assert.match(orderDetailSource, /onClick=\{load\}/);
  assert.match(orderDetailSource, /const \[savingStatus, setSavingStatus\] = useState\(false\)/);
  assert.match(orderDetailSource, /if \(!id \|\| savingStatus \|\| savingEdit\) return/);
  assert.match(orderDetailSource, /toast\.error\(await readError\(res, t\('page\.orderDetail\.orderSaveFailed'\)\)\)/);
  assert.match(orderDetailSource, /if \(!res\.ok \|\| !dup\?\.id\) throw new Error/);
  assert.match(orderDetailSource, /const res = await fetch\(`\/api\/orders\/\$\{id\}`, \{ method: 'DELETE' \}\)/);
  assert.match(orderDetailSource, /readError\(res, t\('page\.orderDetail\.deleteFailed'\)\)/);
  assert.match(orderDetailSource, /disabled=\{savingStatus \|\| savingEdit\}/);
});

test('order invoice creation validates the response and prevents duplicate submissions', () => {
  assert.match(orderDetailSource, /const \[creatingInvoice, setCreatingInvoice\] = useState\(false\)/);
  assert.match(orderDetailSource, /if \(!order \|\| creatingInvoice \|\| savingEdit \|\| savingStatus\) return/);
  assert.match(orderDetailSource, /if \(!res\.ok\) \{[\s\S]*readError\(res, t\('page\.orderDetail\.invoiceCreateFailed'\)\)/);
  assert.match(orderDetailSource, /if \(!inv\?\.invoice_number\)/);
  assert.match(orderDetailSource, /disabled=\{creatingInvoice \|\| savingEdit \|\| savingStatus\}/);
});

function shippedQuantityFixture(outcomes = {}, edits = { 'line-a': 2, 'line-b': 3 }) {
  const parsed = ts.createSourceFile('OrderDetail.tsx', orderDetailSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const handlers = {};
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ['saveShippedQuantities', 'readError'].includes(node.name.getText(parsed))) {
      handlers[node.name.getText(parsed)] = node.initializer.getText(parsed);
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  const compiled = ts.transpileModule(`const readError = ${handlers.readError}; module.exports = ${handlers.saveShippedQuantities};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const calls = { requests: [], busy: [], errors: [], loads: [] };
  const persisted = { 'line-a': 0, 'line-b': 0 };
  let pendingEdits = { ...edits };
  const module = { exports: {} };
  const context = {
    module, id: 'fixture-order', savingShippedQty: false, editingShipQty: pendingEdits,
    shippedQtyInFlight: { current: false },
    setSavingShippedQty: value => calls.busy.push(value),
    setEditingShipQty: update => { pendingEdits = typeof update === 'function' ? update(pendingEdits) : update; context.editingShipQty = pendingEdits; },
    t: key => key, toast: { error: message => calls.errors.push(message) },
    load: () => calls.loads.push({ ...persisted }),
    fetch: async (url, options) => {
      const lineId = url.split('/').pop();
      const payload = JSON.parse(options.body);
      calls.requests.push({ url, method: options.method, payload });
      const outcome = outcomes[lineId];
      const response = await (typeof outcome === 'function' ? outcome() : outcome) ?? { ok: true, json: async () => ({}) };
      if (response.ok) persisted[lineId] = payload.quantity_shipped;
      return response;
    },
  };
  runInNewContext(compiled, context);
  return { action: module.exports, calls, persisted, context, edits: () => ({ ...pendingEdits }), edit: (lineId, qty) => { pendingEdits = { ...pendingEdits, [lineId]: qty }; context.editingShipQty = pendingEdits; } };
}

test('shipped quantity partial HTTP failures refresh saved lines and retry only unsaved edits', async () => {
  const outcomes = { 'line-b': { ok: false, json: async () => ({ message: 'QA line temporarily unavailable' }) } };
  const fixture = shippedQuantityFixture(outcomes);
  await fixture.action();
  assert.deepEqual(fixture.calls.loads, [{ 'line-a': 2, 'line-b': 0 }]);
  assert.deepEqual(fixture.edits(), { 'line-b': 3 });
  assert.deepEqual(fixture.calls.errors, ['QA line temporarily unavailable']);
  delete outcomes['line-b'];
  await fixture.action();
  assert.deepEqual(fixture.calls.requests.map(request => request.url), ['/api/orders/line-items/line-a', '/api/orders/line-items/line-b', '/api/orders/line-items/line-b']);
  assert.deepEqual(fixture.edits(), {});
  assert.deepEqual(fixture.persisted, { 'line-a': 2, 'line-b': 3 });
});

test('shipped quantity network failures wait for every other line before unlocking and refreshing', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const fixture = shippedQuantityFixture({ 'line-a': () => { throw new Error('Network unavailable'); }, 'line-b': () => pending });
  let completed = false;
  const save = fixture.action().then(() => { completed = true; });
  await new Promise(resolve => setImmediate(resolve));
  const unlockedEarly = completed;
  finish({ ok: true });
  await save;
  assert.equal(unlockedEarly, false, 'Other line writes must settle before the batch unlocks');
  assert.deepEqual(fixture.edits(), { 'line-a': 2 });
  assert.deepEqual(fixture.calls.loads, [{ 'line-a': 0, 'line-b': 3 }]);
  assert.deepEqual(fixture.calls.errors, ['page.orderDetail.orderSaveFailed']);
  assert.deepEqual(fixture.calls.busy, [true, false]);
});

test('shipped quantity save preserves newer edits entered while the submitted values are pending', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const fixture = shippedQuantityFixture({ 'line-a': () => pending });
  const save = fixture.action();
  fixture.edit('line-a', 7);
  fixture.edit('line-c', 4);
  finish({ ok: true });
  await save;
  assert.deepEqual(fixture.persisted, { 'line-a': 2, 'line-b': 3 });
  assert.deepEqual(fixture.edits(), { 'line-a': 7, 'line-c': 4 });
});

test('immediate repeated shipped quantity saves submit one batch', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const fixture = shippedQuantityFixture({ 'line-a': () => pending });
  const first = fixture.action();
  const second = fixture.action();
  const submittedCount = fixture.calls.requests.length;
  finish({ ok: true });
  await Promise.all([first, second]);
  assert.equal(submittedCount, 2, 'Two lines should generate exactly two PUTs');
  assert.deepEqual(fixture.calls.busy, [true, false]);
  assert.equal(fixture.context.shippedQtyInFlight.current, false);
});

test('successful shipped quantity saves clear submitted edits and reload confirmed values', async () => {
  const fixture = shippedQuantityFixture();
  await fixture.action();
  assert.deepEqual(fixture.edits(), {});
  assert.deepEqual(fixture.calls.loads, [{ 'line-a': 2, 'line-b': 3 }]);
  assert.deepEqual(fixture.calls.requests.map(request => [request.method, request.payload.quantity_shipped]), [['PUT', 2], ['PUT', 3]]);
  assert.deepEqual(fixture.calls.errors, []);
  assert.deepEqual(fixture.calls.busy, [true, false]);
});

test('shipped quantity saves with no changes or an existing busy state submit nothing', async () => {
  const empty = shippedQuantityFixture({}, {});
  await empty.action();
  assert.deepEqual(empty.calls.requests, []);
  const busy = shippedQuantityFixture();
  busy.context.savingShippedQty = true;
  await busy.action();
  assert.deepEqual(busy.calls.requests, []);
});

test('order detail loads when the source quotation is deleted or unreachable (regression)', () => {
  // A soft-deleted (or missing) source quotation returns 404; the page must still show the order.
  assert.match(orderDetailSource, /if \(data\.quotation_id\) \{[\s\S]*if \(quotationRes\.ok\) sourceQuotation = await quotationRes\.json\(\)/);
  assert.match(orderDetailSource, /catch \{[\s\S]*show the order without it/);
  assert.doesNotMatch(orderDetailSource, /if \(!quotationRes\.ok\) throw new Error\(`Quotation request failed/);
});

test('inventory initial stock records surface API failures', () => {
  assert.match(inventorySource, /function InventoryLoadError/);
  assert.match(inventorySource, /const \[stockRes, ledgerRes, scopeRes\] = await Promise\.all/);
  assert.match(inventorySource, /throw new Error\('Inventory V2 request failed'\)/);
  assert.match(inventorySource, /t\('page\.error\.loadFailed'\)/);
  assert.match(inventorySource, /<InventoryLoadError onRetry=\{load\} \/>/);
});

test('quotation detail order and sample actions stop on failed API responses', () => {
  assert.match(quotationDetailSource, /const \[loadError, setLoadError\] = useState\(false\)/);
  assert.match(quotationDetailSource, /if \(!res\.ok\) throw new Error\(`Orders request failed/);
  assert.match(quotationDetailSource, /setQuotation\(null\);[\s\S]*setLoadError\(true\)/);
  assert.match(quotationDetailSource, /t\('page\.error\.loadFailed'\)/);
  assert.match(quotationDetailSource, /onClick=\{load\}/);
  assert.match(quotationDetailSource, /const readError = async \(res: Response, fallback: string\)/);
  assert.match(quotationDetailSource, /if \(!orderRes\.ok\) \{/);
  assert.match(quotationDetailSource, /readError\(orderRes, t\('page\.quotationDetail\.orderCreateFailed'\)\)/);
  assert.match(quotationDetailSource, /if \(!res\.ok\) \{/);
  assert.match(quotationDetailSource, /readError\(res, t\('page\.quotationDetail\.sampleRequestFailed'\)\)/);
});

test('quotation approval and status changes validate responses and lock duplicate actions', () => {
  assert.match(quotationDetailSource, /const \[changingStatus, setChangingStatus\] = useState\(false\)/);
  assert.match(quotationDetailSource, /const \[savingApproval, setSavingApproval\] = useState\(false\)/);
  assert.match(quotationDetailSource, /if \(!id \|\| changingStatus \|\| savingApproval\) return/);
  assert.match(quotationDetailSource, /const handleApproval = async \(action: 'approve' \| 'reject'\)/);
  assert.match(quotationDetailSource, /if \(!res\.ok\) \{[\s\S]*readError\(res, t\('page\.quotationDetail\.statusChangeFailed'\)\)/);
  assert.match(quotationDetailSource, /onClick=\{\(\) => handleApproval\('approve'\)\}/);
  assert.match(quotationDetailSource, /disabled=\{savingApproval \|\| changingStatus\}/);
});

test('tasks page keeps failed updates visible and locks duplicate task actions', () => {
  assert.match(tasksPageSource, /const \[busyTaskId, setBusyTaskId\] = useState<string \| null>\(null\)/);
  assert.match(tasksPageSource, /if \(busyTaskId\) return/);
  assert.match(tasksPageSource, /const removeTask = async \(task: any\)/);
  assert.match(tasksPageSource, /await tasks\.update\(task\.id, \{ status: newStatus \}\)/);
  assert.match(tasksPageSource, /await tasks\.delete\(task\.id\)/);
  assert.match(tasksPageSource, /toast\.error\(t\('page\.tasks\.taskUpdateFailed'\)\)/);
  assert.match(tasksPageSource, /disabled=\{busyTaskId === task\.id\}/);
});

test('task creation surfaces backend errors instead of leaving an unhandled rejection', () => {
  assert.match(tasksPageSource, /await tasks\.create\(\{ \.\.\.form, task_type: 'other', status: 'pending' \}\)/);
  assert.match(tasksPageSource, /catch \(e\) \{[\s\S]*toast\.error\(e instanceof Error \? e\.message : t\('page\.tasks\.taskAddFailed'\)\)/);
});

test('company duplication surfaces backend errors and locks the duplicate action', () => {
  assert.match(companiesPageSource, /const \[duplicatingId, setDuplicatingId\] = useState<string \| null>\(null\)/);
  assert.match(companiesPageSource, /if \(duplicatingId\) return/);
  assert.match(companiesPageSource, /await companies\.create\(\{/);
  assert.match(companiesPageSource, /toast\.error\(e instanceof Error \? e\.message : t\('page\.companies\.createFailed'\)\)/);
  assert.match(companiesPageSource, /disabled=\{duplicatingId === company\.id\}/);
});

test('activity follow-up scheduling surfaces task API failures and locks the action', () => {
  assert.match(activityTimelineSource, /const \[schedulingFollowUp, setSchedulingFollowUp\] = useState\(false\)/);
  assert.match(activityTimelineSource, /if \(!followUpDate \|\| schedulingFollowUp\) return/);
  assert.match(activityTimelineSource, /await tasksApi\.create\(/);
  assert.match(activityTimelineSource, /toast\.error\(t\('page\.tasks\.taskAddFailed'\)\)/);
  assert.match(activityTimelineSource, /disabled=\{schedulingFollowUp\}/);
});

test('meeting notes use the transactional company follow-up workflow', () => {
  const meetingNotesSource = readFileSync(new URL('../src/components/shared/MeetingNotes.tsx', import.meta.url), 'utf8');
  assert.match(meetingNotesSource, /import \{ activities as activitiesApi, followUps \} from '\.\.\/\.\.\/lib\/api'/);
  assert.match(meetingNotesSource, /await followUps\.record\(\{/);
  assert.match(meetingNotesSource, /company_id: entityId/);
  assert.match(meetingNotesSource, /next_task: form\.nextFollowUp && form\.nextFollowUpDate/);
  assert.doesNotMatch(meetingNotesSource, /tasksApi\.create/);
});

test('orders and shipments show retryable load errors instead of false empty states', () => {
  assert.match(ordersPageSource, /const \[loadError, setLoadError\] = useState\(false\)/);
  assert.match(ordersPageSource, /if \(!res\.ok\) throw new Error\(`Orders request failed/);
  assert.match(ordersPageSource, /setList\(\[\]\); setLoadError\(true\)/);
  assert.match(ordersPageSource, /t\('page\.error\.loadFailed'\)/);
  assert.match(ordersPageSource, /onClick=\{load\}/);
  assert.match(shipmentsPageSource, /const \[loadError, setLoadError\] = useState\(false\)/);
  assert.match(shipmentsPageSource, /const loadLists = \(\) =>/);
  assert.match(shipmentsPageSource, /if \(!res\.ok\) throw new Error\(`Shipments request failed/);
  assert.match(shipmentsPageSource, /setList\(\[\]\); setOrders\(\[\]\); setLoadError\(true\)/);
  assert.match(shipmentsPageSource, /onClick=\{loadLists\}/);
});

test('orders and shipments keep desktop table content left aligned', () => {
  for (const source of [ordersPageSource, shipmentsPageSource]) {
    assert.doesNotMatch(source, /table-header text-center/);
  }
  assert.doesNotMatch(shipmentsPageSource, /table-cell text-center/);
  assert.match(ordersPageSource, /table-header text-right.*page\.orders\.total/);
});

test('inventory and materials tooling headers share the tab content left edge', () => {
  for (const source of [inventorySource, materialsToolingPageSource]) {
    assert.match(source, /<div className="page-header[^"]*">\s*<div className="px-3">/);
    assert.match(source, /<h1 className="page-heading">/);
    assert.match(source, /<p className="page-summary[^"]*">/);
  }
});

test('payments keeps non-monetary desktop table content left aligned', () => {
  assert.doesNotMatch(paymentsPageSource, /table-header text-center/);
  assert.match(paymentsPageSource, /table-header text-right.*page\.payments\.total/);
  assert.match(paymentsPageSource, /table-header text-right.*page\.payments\.paid/);
  assert.match(paymentsPageSource, /table-header text-right.*page\.payments\.due/);
});

test('shared side panels are responsive accessible dialogs', () => {
  assert.match(sidePanelSource, /role="dialog"/);
  assert.match(sidePanelSource, /aria-modal="true"/);
  assert.match(sidePanelSource, /aria-labelledby=\{titleId\}/);
  assert.match(sidePanelSource, /h-dvh/);
  assert.match(sidePanelSource, /w-\[min\(/);
  assert.match(sidePanelSource, /<Icon name="close"/);
  assert.match(sidePanelSource, /aria-label=\{t\('common\.close'\)\}/);
  assert.match(sidePanelSource, /safe-area-inset-bottom/);
  assert.match(sidePanelSource, /ref=\{panelRef\}/);
  assert.match(sidePanelSource, /previouslyFocused\?\.isConnected/);
  assert.match(sidePanelSource, /e\.key !== 'Tab'/);
  assert.match(sidePanelSource, /panelRef\.current\?\.querySelectorAll/);
  assert.match(sidePanelSource, /window\.addEventListener\('keydown', handler, true\)/);
  assert.doesNotMatch(sidePanelSource, />✕</);
});

test('contact edit save surfaces the actual API error message', () => {
  assert.match(contactPanelSource, /e instanceof Error \? e\.message : t\('page\.contacts\.saveFailed'\)/);
});

test('contact save locks cancel while saving', () => {
  assert.match(contactPanelSource, /disabled=\{saving\}/);
  assert.match(contactPanelSource, /<button onClick=\{onClose\} disabled=\{saving\} className="btn-secondary">/);
});

test('inventory product form lets users edit SKU and material instead of locking them behind auto generation', () => {
  assert.match(inventorySource, /value=\{createForm\.sku\}/);
  assert.match(inventorySource, /value=\{createForm\.materialName\}/);
  assert.match(inventorySource, /onChange=\{event => setCreateForm\(current => \(\{ \.\.\.current, sku: event\.target\.value \}\)\)\}/);
  assert.doesNotMatch(inventorySource, /readOnly/);
});

test('inventory product save surfaces backend validation details', () => {
  assert.match(inventorySource, /if \(!res\.ok\) throw new Error\(data\.error \|\| t\('page\.inventory\.v2\.createFailed'\)\)/);
});

test('inventory product save locks form actions while saving', () => {
  assert.match(inventorySource, /const \[createSaving, setCreateSaving\] = useState\(false\)/);
  assert.match(inventorySource, /disabled=\{createSaving\}/);
  assert.match(inventorySource, /createSaving \? t\('page\.inventory\.saving'\) : t\('common\.save'\)/);
});

test('inventory operations reject API errors and lock duplicate submissions', () => {
  assert.match(inventorySource, /const \[operationSaving, setOperationSaving\] = useState\(false\)/);
  assert.match(inventorySource, /disabled=\{operationSaving\}/);
  assert.match(inventorySource, /operationSaving \? t\('page\.inventory\.saving'\) : t\('common\.save'\)/);
});

test('inventory tables use stable shared empty states', () => {
  assert.ok((inventorySource.match(/className="empty-state/g) || []).length >= 2);
  assert.doesNotMatch(inventorySource, /text-center py-8 text-xs text-gray-400/);
});

test('profile save notifies the sidebar user menu to refresh immediately', () => {
  assert.match(profileSource, /window\.dispatchEvent\(new CustomEvent\('crm-profile-updated'/);
  assert.match(userMenuSource, /crm-profile-updated/);
  assert.match(userMenuSource, /window\.addEventListener\('storage'/);
});

test('profile fields have persistent labels and autofill semantics', () => {
  for (const fieldId of ['profile-full-name', 'profile-job-title', 'profile-company', 'profile-email']) {
    assert.match(profileSource, new RegExp(`htmlFor="${fieldId}"`));
    assert.match(profileSource, new RegExp(`id="${fieldId}"`));
  }
  assert.match(profileSource, /autoComplete="name"/);
  assert.match(profileSource, /autoComplete="organization-title"/);
  assert.match(profileSource, /autoComplete="organization"/);
  assert.match(profileSource, /type="email"[\s\S]*autoComplete="email"/);
});

test('profile data is isolated by authenticated user without real-person defaults', () => {
  assert.match(profileSource, /useAuth\(\)/);
  assert.match(profileSource, /profileStorageKey\(user\.id\)/);
  assert.match(profileSource, /detail: \{ userId: user\.id, profile: form \}/);
  assert.match(userMenuSource, /profileStorageKey\(user\?\.id\)/);
  assert.match(userMenuSource, /profileEvent\.detail\?\.userId !== user\?\.id/);
  assert.match(userMenuSource, /profile\.fullName \|\| user\?\.name/);
  for (const source of [profileSource, userMenuSource]) {
    assert.doesNotMatch(source, /localStorage\.getItem\(STORAGE_KEY\)/);
    assert.doesNotMatch(source, /crm-profile['"]/);
  }
  assert.doesNotMatch(profileSource, /Yaoting Xu|nathan@jekinpolymer\.com|JEKIN Polymer|Sales Engineer/);
});

test('user menu and account management use shared restrained overlays', () => {
  assert.match(userMenuSource, /menu-surface/);
  assert.match(userMenuSource, /modal-surface/);
  assert.doesNotMatch(userMenuSource, /rounded-xl|shadow-xl/);
});

test('account management is an accessible keyboard dialog', () => {
  assert.match(userMenuSource, /role="dialog"/);
  assert.match(userMenuSource, /aria-modal="true"/);
  assert.match(userMenuSource, /aria-labelledby="user-management-title"/);
  assert.match(userMenuSource, /onMouseDown=\{event => \{ event\.stopPropagation\(\); closeUserManagement\(\); \}\}/);
  assert.match(userMenuSource, /event\.key === 'Escape'/);
  assert.match(userMenuSource, /event\.key !== 'Tab'/);
  assert.match(userMenuSource, /userManagementDialogRef\.current\?\.querySelectorAll/);
  assert.match(userMenuSource, /userManagementCloseRef\.current\?\.focus\(\)/);
  assert.match(userMenuSource, /manageUsersTriggerRef\.current\?\.focus\(\)/);
  assert.match(userMenuSource, /htmlFor="managed-user-name"/);
  assert.match(userMenuSource, /id="managed-user-name"/);
  assert.match(userMenuSource, /htmlFor="managed-user-pin"/);
  assert.match(userMenuSource, /id="managed-user-pin"/);
  assert.match(userMenuSource, /role="alert"/);
  assert.match(userMenuSource, /role="status"/);
});

test('about modal is a focus-managed accessible dialog', () => {
  assert.match(aboutModalSource, /role="dialog"/);
  assert.match(aboutModalSource, /aria-modal="true"/);
  assert.match(aboutModalSource, /aria-labelledby=\{titleId\}/);
  assert.match(aboutModalSource, /ref=\{dialogRef\}/);
  assert.match(aboutModalSource, /handleKeyDown/);
  assert.match(aboutModalSource, /event\.key === 'Escape'/);
  assert.match(aboutModalSource, /event\.key !== 'Tab'/);
  assert.match(aboutModalSource, /previouslyFocused\?\.isConnected && previouslyFocused !== document\.body/);
  assert.match(aboutModalSource, /returnFocusRef\?\.current\?\.focus\(\)/);
});

test('administrators can create colleague PIN accounts from the user menu', () => {
  assert.match(userMenuSource, /user\?\.role === 'admin'/);
  assert.match(userMenuSource, /fetch\('\/api\/auth\/users'/);
  assert.match(userMenuSource, /method: 'POST'/);
  assert.match(userMenuSource, /accountPin\.length !== 6/);
  assert.match(userMenuSource, /showUserManagement/);
  for (const key of ['manageUsers', 'addColleague', 'accountName', 'initialPin', 'createAccount', 'noUsers']) {
    assert.match(i18nSource, new RegExp(`${key}:`));
  }
});
