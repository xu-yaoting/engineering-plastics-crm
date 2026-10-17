import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const files = [
  '../src/pages/Companies.tsx',
  '../src/pages/Contacts.tsx',
  '../src/components/contacts/ContactPanel.tsx',
];

const source = files
  .map((file) => readFileSync(new URL(file, import.meta.url), 'utf8'))
  .join('\n');

const dictionarySource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');
const companiesSource = readFileSync(new URL('../src/pages/Companies.tsx', import.meta.url), 'utf8');
const contactsSource = readFileSync(new URL('../src/pages/Contacts.tsx', import.meta.url), 'utf8');
const approvalsSource = readFileSync(new URL('../src/components/materials-tooling/ApprovalsTab.tsx', import.meta.url), 'utf8');

test('customer and contact batch no longer renders obvious hard-coded English UI labels', () => {
  const forbidden = [
    />Delete\?</,
    />Yes</,
    />No</,
    />Edit</,
    />Duplicate</,
    />Delete</,
    /title="New Company"/,
    /Edit Company/,
    /Import Companies/,
    /Upload a <strong>\.csv<\/strong> or <strong>\.xlsx<\/strong> file/,
    /Template format:/,
    />Download Template</,
    />Choose File</,
    /No file selected/,
    /Upload & Import/,
    /Importing\.\.\./,
    /No new companies/,
    /Total rows:/,
    /errors \(check format\)/,
    /title=\{isEdit \? 'Edit Contact' : 'New Contact'\}/,
    />Primary contact</,
    />Decision maker</,
    />Delete contact</,
    /Contact updated/,
    /Contact created/,
    /Failed to save contact/,
    /Failed to delete contact/,
    /Company created/,
    /Company updated/,
    /Failed to create/,
    /Import failed/,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(source, pattern, `Unexpected hard-coded English UI text: ${pattern}`);
  }
});

test('first localization batch has dictionary entries for customer and contact UI', () => {
  const requiredKeys = [
    'firstName',
    'lastName',
    'jobTitle',
    'department',
    'role',
    'primaryContact',
    'decisionMaker',
    'directPhone',
    'mobilePhone',
    'newContact',
    'editContact',
    'createContact',
    'deleteContact',
    'importCompanies',
    'uploadImport',
    'downloadTemplate',
    'templateFormat',
    'noFileSelected',
    'totalRows',
    'checkFormat',
    'customerCode',
    'orderNumberHint',
    'companyNameRequired',
  ];

  for (const key of requiredKeys) {
    assert.match(dictionarySource, new RegExp(`${key}:`), `Missing i18n key: ${key}`);
  }
});

test('new customer panel exposes field-level name validation', () => {
  assert.match(companiesSource, /const \[createErrors, setCreateErrors\] = useState<\{ name\?: string \}>\(\{\}\)/);
  assert.match(companiesSource, /if \(!form\.name\.trim\(\)\) \{[\s\S]*companyNameRequired/);
  assert.match(companiesSource, /htmlFor="company-create-name"/);
  assert.match(companiesSource, /id="company-create-name"/);
  assert.match(companiesSource, /aria-invalid=\{!!createErrors\.name\}/);
  assert.match(companiesSource, /aria-describedby=\{createErrors\.name \? 'company-create-name-error' : undefined\}/);
  assert.match(companiesSource, /id="company-create-name-error" className="field-error" role="alert"/);
  assert.doesNotMatch(companiesSource, /toast\.error\(['"]name is required/);
});

test('new customer controls have complete labels, autofill hints, and linked help text', () => {
  for (const fieldId of [
    'company-create-name',
    'company-create-type',
    'company-create-industry',
    'company-create-country',
    'company-create-city',
    'company-create-customer-code',
  ]) {
    assert.match(companiesSource, new RegExp(`htmlFor="${fieldId}"`));
    assert.match(companiesSource, new RegExp(`id="${fieldId}"`));
  }
  assert.match(companiesSource, /id="company-create-name"[\s\S]*autoComplete="organization"/);
  assert.match(companiesSource, /id="company-create-country"[\s\S]*autoComplete="country-name"/);
  assert.match(companiesSource, /id="company-create-city"[\s\S]*autoComplete="address-level2"/);
  assert.match(companiesSource, /id="company-create-customer-code"[\s\S]*aria-describedby="company-create-customer-code-help"/);
  assert.match(companiesSource, /id="company-create-customer-code-help"/);
  assert.match(companiesSource, /createNameInputRef\.current\?\.focus\(\)/);
});

test('customer list edit and search controls have persistent labels', () => {
  assert.match(companiesSource, /htmlFor="company-search"/);
  assert.match(companiesSource, /id="company-search"/);
  // List editing reuses the shared full-company panel; its labels are covered by the company panel tests.
  assert.match(companiesSource, /<CompanyEditPanel company=\{editTarget\}/);
});

test('customers establishes the shared operational list-page pattern', () => {
  assert.match(companiesSource, /className="page-shell"/);
  assert.match(companiesSource, /className="page-header"/);
  assert.match(companiesSource, /className="toolbar"/);
  assert.match(companiesSource, /className="(?:hidden )?data-surface/);
  assert.match(companiesSource, /sticky top-0 z-10/);
  assert.match(companiesSource, /<Icon name="search"/);
  assert.match(companiesSource, /<Icon name="more"/);
  assert.match(companiesSource, /aria-label=\{t\('common\.moreActions'/);
  assert.match(companiesSource, /animate-pulse/);
  assert.doesNotMatch(companiesSource, />⋮</);
});

test('customer list uses readable mobile cards instead of compressed desktop rows', () => {
  assert.match(companiesSource, /className="hidden data-surface md:block"/);
  assert.match(companiesSource, /className="data-surface md:hidden divide-y/);
  assert.match(companiesSource, /role="button"[\s\S]*tabIndex=\{0\}/);
  assert.match(companiesSource, /onKeyDown=\{e => \{[\s\S]*e\.key === 'Enter' \|\| e\.key === ' '/);
  assert.match(companiesSource, /onClick=\{e => e\.stopPropagation\(\)\} onKeyDown=\{e => e\.stopPropagation\(\)\}/);
});

test('customer and contact lists use shared overlays and stable empty states', () => {
  assert.match(companiesSource, /<SidePanel\s+open=\{showImport\}/);
  assert.doesNotMatch(companiesSource, /\{\/\* Import Modal \*\/\}/);
  assert.match(companiesSource, /menu-surface/);
  assert.match(companiesSource, /className="empty-state"/);
  assert.match(contactsSource, /menu-surface/);
  assert.match(contactsSource, /colSpan=\{7\}[\s\S]*className="empty-state"/);
  assert.doesNotMatch(companiesSource, /rounded-xl|shadow-lg|shadow-md/);
  assert.doesNotMatch(contactsSource, /shadow-md/);
});

test('material approval details use a contextual side panel', () => {
  assert.match(approvalsSource, /import SidePanel from '\.\.\/shared\/SidePanel'/);
  assert.match(approvalsSource, /<SidePanel\s+open=\{!!selected\}/);
  assert.doesNotMatch(approvalsSource, /selected && <div className="data-surface mt-4 p-4"/);
});
