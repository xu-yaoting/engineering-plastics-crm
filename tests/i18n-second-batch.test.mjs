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
    'created',
    'noDescription',
    'editInquiry',
    'rev',
    'pendingApproval',
    'approved',
  ];

  for (const key of requiredKeys) {
    assert.match(dictionarySource, new RegExp(`${key}:`), `Missing i18n key: ${key}`);
  }
});
