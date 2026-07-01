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
  ];

  for (const key of requiredKeys) {
    assert.match(dictionarySource, new RegExp(`${key}:`), `Missing i18n key: ${key}`);
  }
});
