import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const files = [
  '../src/pages/CompanyDetail.tsx',
  '../src/pages/Activities.tsx',
  '../src/pages/SettingsProfile.tsx',
];

const source = files
  .map(path => readFileSync(new URL(path, import.meta.url), 'utf8'))
  .join('\n')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\/[^\n]*/g, '');

const dictionarySource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');

test('company detail, activities, and profile pages no longer render obvious hard-coded English UI labels', () => {
  const forbidden = [
    /-Class/,
    /Last activity/,
    /Primary/,
    /Decision Maker/,
    /Add first contact/,
    /View all/,
    /Pipeline Opportunities/,
    /\|\| 'Inquiry'/,
    /Expires/,
    /Rev /,
    /No active opportunities/,
    /Create Inquiry/,
    /Tasks & Stats/,
    /total activities/,
    /Search activities/,
    /Delete</,
    /Cancel</,
    /Your Name/,
    /Your Role/,
    /Your full name/,
    /Company name/,
    /← Back/,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(source, pattern);
  }
});

test('company detail, activities, and profile dictionary contains the batch keys', () => {
  const requiredKeys = [
    'classLabel', 'lastActivity', 'daysAgo', 'primaryContactLabel',
    'decisionMakerLabel', 'addFirstContact', 'viewAllContacts',
    'pipelineOpportunities', 'expires', 'revision', 'noActiveOpportunities',
    'createInquiry', 'tasksAndStats',
    'totalActivities', 'searchActivities', 'internal',
    'yourName', 'yourRole', 'placeholderFullName', 'placeholderCompany',
  ];

  for (const key of requiredKeys) {
    assert.match(dictionarySource, new RegExp(`${key}:`));
  }
});
