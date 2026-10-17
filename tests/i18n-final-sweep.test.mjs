import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const files = [
  '../src/components/companies/CompanyEditPanel.tsx',
];

const source = files
  .map(path => readFileSync(new URL(path, import.meta.url), 'utf8'))
  .join('\n')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\/[^\n]*/g, '');

const dictionarySource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');

test('final sweep components no longer render obvious hard-coded English UI labels', () => {
  const forbidden = [
    /Email Draft/,
    /Select a template/,
    />All</,
    /\{tpl\.variables\.length\} variables/,
    /Fill in Variables/,
    />Subject</,
    />Body</,
    /fill variables above/,
    /Copied!/,
    /Copy to Clipboard/,
    /Customer Briefing/,
    /YTD Revenue/,
    /Last Activity/,
    /Open Opportunities/,
    /Active Orders/,
    /Top product/,
    /overdue task/,
    /No activity for/,
    /Recent Activity/,
    /Pipeline Summary/,
    /Open Quotes/,
    /Pending Tasks/,
    /Company updated/,
    /Failed to save/,
    /End-user/,
    /Distributor/,
    /Trading Company/,
    /Customer Code/,
    /Used for order numbering/,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(source, pattern);
  }
});

test('final sweep localization dictionary contains email draft, customer summary, and company edit keys', () => {
  const requiredKeys = [
    'emailDraft', 'selectTemplate', 'fillVariables', 'variables',
    'fillVariablesAbove', 'copied', 'copyToClipboard',
    'customerBriefing', 'ytdRevenue', 'lastActivity', 'openOpportunities',
    'activeOrders', 'topProduct', 'overdueTask', 'noActivityFor',
    'pipelineSummary', 'openQuotes', 'pendingTasks',
    'companyUpdated', 'companySaveFailed', 'usedForOrderNumbering',
  ];

  for (const key of requiredKeys) {
    assert.match(dictionarySource, new RegExp(`${key}:`));
  }
});

test('company edit save surfaces field and backend errors while locking actions during save', () => {
  const companyEditSource = readFileSync(new URL('../src/components/companies/CompanyEditPanel.tsx', import.meta.url), 'utf8');

  assert.match(companyEditSource, /toast\.error\(e instanceof Error \? e\.message : t\('page\.companies\.companySaveFailed'\)\)/);
  assert.match(companyEditSource, /if \(!form\.name\.trim\(\)\) \{[\s\S]*setErrors\(\{ name:/);
  assert.match(companyEditSource, /<button onClick=\{save\} disabled=\{saving\} className="btn-primary flex-1">/);
  assert.match(companyEditSource, /<button onClick=\{onClose\} disabled=\{saving\} className="btn-secondary">/);
});
