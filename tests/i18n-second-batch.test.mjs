import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const files = [
  '../src/pages/InquiryNew.tsx',
  '../src/pages/InquiryDetail.tsx',
  '../src/pages/Quotations.tsx',
];

const source = files
  .map((file) => readFileSync(new URL(file, import.meta.url), 'utf8'))
  .join('\n');

const dictionarySource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');
const quotationsSource = readFileSync(new URL('../src/pages/Quotations.tsx', import.meta.url), 'utf8');

test('inquiry and quotation batch no longer renders obvious hard-coded English UI labels', () => {
  const forbidden = [
    /Inquiry created/,
    /Failed to create inquiry/,
    /Status changed to/,
    /Failed to change status/,
    /Quotation created/,
    /Failed to create quotation/,
    /Inquiry duplicated/,
    /Failed to duplicate/,
    /Inquiry deleted/,
    /Failed to delete inquiry/,
    /Creating\.\.\./,
    />Duplicate</,
    />Delete</,
    />Confirm\?</,
    />Yes</,
    />No</,
    /Contact:/,
    /Created:/,
    /Source:/,
    /No description provided\./,
    />Quantity</,
    />Chemical Exposure</,
    />Mechanical Load</,
    />Regulatory Requirements</,
    />Activity</,
    />Details</,
    />Status</,
    />Urgency</,
    />Customer</,
    />Tasks</,
    />Edit Inquiry</,
    />Immediate</,
    />Within 2 Weeks</,
    />Within 1 Month</,
    />No Rush</,
    />Email</,
    />Phone \/ WeChat</,
    />Social Media</,
    />Alibaba Platform</,
    />Trade Show</,
    />Referral</,
    />Save Changes</,
    />All</,
    />Pending Approval</,
    />Approved</,
    />Number</,
    />Date</,
    />Company</,
    />Total</,
    />Currency</,
    />Valid Until</,
    />Version</,
    />Rev /,
    /Quotation date: newest first/,
    /Quotation date: oldest first/,
    /Total: high to low/,
    /Total: low to high/,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(source, pattern, `Unexpected hard-coded English UI text: ${pattern}`);
  }
});

test('second localization batch has dictionary entries for inquiry and quotation UI', () => {
  const requiredKeys = [
    'inquiryCreated',
    'inquiryCreateFailed',
    'statusChangeFailed',
    'quotationCreated',
    'quotationCreateFailed',
    'inquiryDuplicated',
    'duplicateFailed',
    'inquiryDeleted',
    'deleteFailed',
    'inquiryUpdated',
    'inquirySaveFailed',
    'saving',
    'created',
    'noDescription',
    'editInquiry',
    'rev',
    'quotationDateNewest',
    'quotationDateOldest',
    'totalHighToLow',
    'totalLowToHigh',
    'pendingApproval',
    'approved',
    'companyRequired',
    'descriptionRequired',
  ];

  for (const key of requiredKeys) {
    assert.match(dictionarySource, new RegExp(`${key}:`), `Missing i18n key: ${key}`);
  }
});

test('inquiry edit save checks backend errors before closing the modal', () => {
  const inquiryDetailSource = readFileSync(new URL('../src/pages/InquiryDetail.tsx', import.meta.url), 'utf8');

  assert.match(inquiryDetailSource, /const \[savingEdit, setSavingEdit\] = useState\(false\)/);
  assert.match(inquiryDetailSource, /setSavingEdit\(true\)/);
  assert.match(inquiryDetailSource, /toast\.success\(t\('page\.inquiryDetail\.inquiryUpdated'\)\)/);
  assert.match(inquiryDetailSource, /toast\.error\(e instanceof Error \? e\.message : t\('page\.inquiryDetail\.inquirySaveFailed'\)\)/);
  assert.match(inquiryDetailSource, /finally \{[\s\S]*setSavingEdit\(false\);[\s\S]*\}/);
  assert.match(inquiryDetailSource, /savingEdit \? t\('page\.inquiryDetail\.saving'\)/);
  assert.match(inquiryDetailSource, /disabled=\{savingEdit\}/);
});

test('inquiry edit fields have persistent labels and accessible description validation', () => {
  const inquiryDetailSource = readFileSync(new URL('../src/pages/InquiryDetail.tsx', import.meta.url), 'utf8');

  for (const fieldId of [
    'inquiry-edit-owner',
    'inquiry-edit-description',
    'inquiry-edit-material',
    'inquiry-edit-quantity',
    'inquiry-edit-urgency',
    'inquiry-edit-source',
  ]) {
    assert.match(inquiryDetailSource, new RegExp(`htmlFor="${fieldId}"`));
    assert.match(inquiryDetailSource, new RegExp(`id="${fieldId}"`));
  }
  assert.match(inquiryDetailSource, /aria-invalid=\{!!editDescriptionError\}/);
  assert.match(inquiryDetailSource, /aria-describedby=\{editDescriptionError \? 'inquiry-edit-description-error' : undefined\}/);
  assert.match(inquiryDetailSource, /id="inquiry-edit-description-error"[\s\S]*role="alert"/);
  assert.match(inquiryDetailSource, /descriptionInputRef\.current\?\.focus\(\)/);
});

test('new inquiry create surfaces backend errors and locks cancel while saving', () => {
  const inquiryNewSource = readFileSync(new URL('../src/pages/InquiryNew.tsx', import.meta.url), 'utf8');

  assert.match(inquiryNewSource, /toast\.error\(e instanceof Error \? e\.message : t\('page\.inquiries\.inquiryCreateFailed'\)\)/);
  assert.match(inquiryNewSource, /disabled=\{saving\}/);
  assert.match(inquiryNewSource, /<button onClick=\{\(\) => navigate\(-1\)\} disabled=\{saving\} className="btn-secondary">/);
});

test('new inquiry fields have persistent labels and accessible required-field errors', () => {
  const inquiryNewSource = readFileSync(new URL('../src/pages/InquiryNew.tsx', import.meta.url), 'utf8');

  for (const fieldId of [
    'inquiry-company',
    'inquiry-contact',
    'inquiry-source',
    'inquiry-urgency',
    'inquiry-description',
    'inquiry-material',
    'inquiry-quantity',
  ]) {
    assert.match(inquiryNewSource, new RegExp(`htmlFor="${fieldId}"`));
    assert.match(inquiryNewSource, new RegExp(`id="${fieldId}"`));
  }
  assert.match(inquiryNewSource, /aria-invalid=\{!!errors\.company_id\}/);
  assert.match(inquiryNewSource, /aria-describedby=\{errors\.company_id \? 'inquiry-company-error' : undefined\}/);
  assert.match(inquiryNewSource, /aria-invalid=\{!!errors\.application_description\}/);
  assert.match(inquiryNewSource, /aria-describedby=\{errors\.application_description \? 'inquiry-description-error' : undefined\}/);
  assert.match(inquiryNewSource, /id="inquiry-company-error"[\s\S]*role="alert"/);
  assert.match(inquiryNewSource, /id="inquiry-description-error"[\s\S]*role="alert"/);
});

test('quotations list defaults to quotation date sorting and exposes sort options', () => {
  assert.match(quotationsSource, /useState\('quotation_date_desc'\)/);
  assert.match(quotationsSource, /dateValue\(b\.quotation_date \|\| b\.created_at\) - dateValue\(a\.quotation_date \|\| a\.created_at\)/);
  assert.match(quotationsSource, /value=\{sortBy\}/);
  assert.match(quotationsSource, /setSortBy\(e\.target\.value\)/);
  assert.match(quotationsSource, /value="quotation_date_desc"/);
  assert.match(quotationsSource, /value="quotation_date_asc"/);
  assert.match(quotationsSource, /value="total_desc"/);
  assert.match(quotationsSource, /value="total_asc"/);
});
