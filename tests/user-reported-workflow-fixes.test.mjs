import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const contactPanelSource = readFileSync(new URL('../src/components/contacts/ContactPanel.tsx', import.meta.url), 'utf8');
const inventorySource = readFileSync(new URL('../src/pages/InventoryPage.tsx', import.meta.url), 'utf8');
const profileSource = readFileSync(new URL('../src/pages/SettingsProfile.tsx', import.meta.url), 'utf8');
const userMenuSource = readFileSync(new URL('../src/components/shared/UserMenu.tsx', import.meta.url), 'utf8');
const i18nSource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');
const sidePanelSource = readFileSync(new URL('../src/components/shared/SidePanel.tsx', import.meta.url), 'utf8');
const responsiveWorkspaceSource = readFileSync(new URL('../src/components/shared/ResponsiveWorkspace.tsx', import.meta.url), 'utf8');
const aboutModalSource = readFileSync(new URL('../src/components/shared/AboutModal.tsx', import.meta.url), 'utf8');
const companyEditPanelSource = readFileSync(new URL('../src/components/companies/CompanyEditPanel.tsx', import.meta.url), 'utf8');

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

test('responsive workspace slide-over traps and restores keyboard focus', () => {
  assert.match(responsiveWorkspaceSource, /ref=\{rightPanelTriggerRef\}/);
  assert.match(responsiveWorkspaceSource, /ref=\{rightPanelRef\}/);
  assert.match(responsiveWorkspaceSource, /ref=\{rightPanelCloseRef\}/);
  assert.match(responsiveWorkspaceSource, /event\.key === 'Escape'/);
  assert.match(responsiveWorkspaceSource, /event\.key !== 'Tab'/);
  assert.match(responsiveWorkspaceSource, /rightPanelRef\.current\?\.querySelectorAll/);
  assert.match(responsiveWorkspaceSource, /previouslyFocused\?\.isConnected/);
  assert.match(responsiveWorkspaceSource, /rightPanelTriggerRef\.current\?\.focus\(\)/);
});

test('contact edit save surfaces the actual API error message', () => {
  assert.match(contactPanelSource, /e instanceof Error \? e\.message : t\('page\.contacts\.saveFailed'\)/);
});

test('contact save locks cancel while saving', () => {
  assert.match(contactPanelSource, /disabled=\{saving\}/);
  assert.match(contactPanelSource, /<button onClick=\{onClose\} disabled=\{saving\} className="btn-secondary">/);
});

test('inventory product form lets users edit SKU and name instead of locking them behind auto generation', () => {
  assert.match(inventorySource, /value=\{form\.sku\}/);
  assert.match(inventorySource, /onChange=\{e => set\('sku', e\.target\.value\)\}/);
  assert.match(inventorySource, /value=\{form\.name\}/);
  assert.match(inventorySource, /onChange=\{e => set\('name', e\.target\.value\)\}/);
  assert.doesNotMatch(inventorySource, /value=\{autoSku\} readOnly/);
  assert.doesNotMatch(inventorySource, /value=\{autoName\} readOnly/);
});

test('inventory product save shows backend validation details', () => {
  assert.match(inventorySource, /await res\.json\(\)\.catch/);
  assert.match(inventorySource, /data\?\.error \|\| data\?\.message/);
});

test('inventory product save locks form actions while saving', () => {
  assert.match(inventorySource, /const \[savingProduct, setSavingProduct\] = useState\(false\)/);
  assert.match(inventorySource, /if \(savingProduct\) return/);
  assert.match(inventorySource, /setSavingProduct\(true\)/);
  assert.match(inventorySource, /finally \{[\s\S]*setSavingProduct\(false\);[\s\S]*\}/);
  assert.match(inventorySource, /disabled=\{savingProduct\}/);
  assert.match(inventorySource, /savingProduct \? t\('page\.inventory\.saving'\)/);
});

test('inventory transactions reject API errors and lock duplicate submissions', () => {
  assert.equal((inventorySource.match(/const \[saving, setSaving\] = useState\(false\)/g) || []).length, 3);
  assert.equal((inventorySource.match(/if \(saving\) return/g) || []).length, 3);
  assert.equal((inventorySource.match(/if \(!res\.ok\) throw new Error\(data\?\.error \|\| data\?\.message \|\| t\('page\.inventory\.failed'\)\)/g) || []).length, 2);
  assert.match(inventorySource, /saving=\{saving\}/);
  assert.match(inventorySource, /disabled=\{saving \|\| \(isOut && currentQty === 0\)\}/);
  assert.match(inventorySource, /saving \? t\('page\.inventory\.saving'\) : title/);
});

test('inventory tables use stable shared empty states', () => {
  assert.ok((inventorySource.match(/className="empty-state"/g) || []).length >= 3);
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
