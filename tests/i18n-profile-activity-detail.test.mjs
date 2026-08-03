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
const activitiesSource = readFileSync(new URL('../src/pages/Activities.tsx', import.meta.url), 'utf8');
const companyDetailSource = readFileSync(new URL('../src/pages/CompanyDetail.tsx', import.meta.url), 'utf8');
const sidebarSource = readFileSync(new URL('../src/components/layout/Sidebar.tsx', import.meta.url), 'utf8');
const contactsSource = readFileSync(new URL('../src/pages/Contacts.tsx', import.meta.url), 'utf8');
const profileSource = readFileSync(new URL('../src/pages/SettingsProfile.tsx', import.meta.url), 'utf8');
const responsiveWorkspaceSource = readFileSync(new URL('../src/components/shared/ResponsiveWorkspace.tsx', import.meta.url), 'utf8');
const mediaQuerySource = readFileSync(new URL('../src/lib/useMediaQuery.ts', import.meta.url), 'utf8');

test('company workspace uses the shared menu icon without character overrides', () => {
  assert.doesNotMatch(companyDetailSource, /rightPanelIcon/);
  assert.doesNotMatch(companyDetailSource, /☰/);
  assert.doesNotMatch(responsiveWorkspaceSource, /rightPanelIcon/);
  assert.match(responsiveWorkspaceSource, /<Icon name="menu"/);
});

test('company workspace owns responsive column geometry without nested fixed-width panels', () => {
  assert.match(responsiveWorkspaceSource, /grid-cols-\[minmax\(/);
  assert.match(responsiveWorkspaceSource, /minmax\(0,1fr\)/);
  assert.match(responsiveWorkspaceSource, /<main className=/);
  assert.match(responsiveWorkspaceSource, /960-1200px: 2-column/);
  assert.match(responsiveWorkspaceSource, /<960px: Accordion sections/);
  assert.match(mediaQuerySource, /min-width: 960px\) and \(max-width: 1199px/);
  assert.match(mediaQuerySource, /max-width: 959px/);
  assert.doesNotMatch(responsiveWorkspaceSource, /w-\[280px\]|w-\[300px\]/);
  assert.doesNotMatch(companyDetailSource, /w-\[280px\]|w-\[300px\]/);
  assert.doesNotMatch(companyDetailSource, /flex-shrink-0 border-[lr]/);
});

test('contacts and profile use shared page and icon interaction patterns', () => {
  for (const pageSource of [contactsSource, profileSource]) {
    assert.match(pageSource, /className="page-shell/);
    assert.match(pageSource, /className="page-header/);
    assert.match(pageSource, /className="page-heading/);
  }

  assert.match(contactsSource, /className="toolbar/);
  assert.match(contactsSource, /<Icon name="search"/);
  assert.match(contactsSource, /<Icon name="plus"/);
  assert.match(contactsSource, /<Icon name="more"/);
  assert.match(contactsSource, /animate-pulse/);
  assert.doesNotMatch(contactsSource, /➕|>⋮</);

  assert.match(profileSource, /className="icon-btn"/);
  assert.match(profileSource, /<Icon name="back"/);
  assert.match(profileSource, /className="data-surface/);
  assert.doesNotMatch(profileSource, /←/);
});

test('activities and company detail use purpose-built shared visual hierarchy', () => {
  assert.match(activitiesSource, /className="page-shell/);
  assert.match(activitiesSource, /className="page-header"/);
  assert.match(activitiesSource, /className="toolbar/);
  assert.match(activitiesSource, /className="data-surface/);
  assert.match(activitiesSource, /<Icon name="search"/);
  assert.match(activitiesSource, /<Icon name="delete"/);
  assert.match(activitiesSource, /animate-pulse/);
  assert.doesNotMatch(activitiesSource, />✕</);

  assert.match(companyDetailSource, /className="page-header mb-0/);
  assert.match(companyDetailSource, /className="page-heading/);
  assert.match(companyDetailSource, /className="page-actions/);
  assert.match(companyDetailSource, /className="icon-btn"/);
  assert.match(companyDetailSource, /className="section-band/);
  assert.match(companyDetailSource, /aria-label=\{t\('common\.back'\)\}/);
});

test('company detail opens with one actionable pipeline summary instead of duplicate briefing cards', () => {
  for (const key of [
    'actionSummary', 'pipelineValue', 'openPipeline', 'nextFollowUp',
    'pendingTasks', 'openTask',
  ]) {
    assert.match(companyDetailSource, new RegExp(`page\\.companyDetail\\.${key}`));
  }
  assert.match(companyDetailSource, /activeQuotationTotals/);
  assert.match(companyDetailSource, /nextFollowUpTask/);
  assert.doesNotMatch(companyDetailSource, /CustomerSummary/);
  assert.doesNotMatch(companyDetailSource, /page\.companyDetail\.quickStats/);
  assert.doesNotMatch(companyDetailSource, /orders=\{\[\]\}/);
});

test('company detail keeps one short support rail and discloses secondary details in side panels', () => {
  assert.match(companyDetailSource, /const primaryContact =/);
  assert.match(companyDetailSource, /pendingTasks\.slice\(0,\s*3\)/);
  assert.match(companyDetailSource, /company\.owner_name/);
  assert.match(companyDetailSource, /setDetailsPanel\('company'\)/);
  assert.match(companyDetailSource, /setDetailsPanel\('history'\)/);
  assert.match(companyDetailSource, /<SidePanel/);
  assert.match(companyDetailSource, /detailsPanel === 'company'/);
  assert.match(companyDetailSource, /<AccountabilityPanel[\s\S]*showOwner=\{false\}/);
  assert.match(companyDetailSource, /lg:sticky lg:top-4/);
  assert.doesNotMatch(companyDetailSource, /lg:row-span-2/);
});

test('company detail header and action summary reflow without clipping on narrow screens', () => {
  assert.match(companyDetailSource, /items-stretch sm:items-center/);
  assert.match(companyDetailSource, /page-heading min-w-0 flex-1 text-lg sm:text-2xl/);
  assert.match(companyDetailSource, /page-actions w-full sm:w-auto/);
  assert.match(companyDetailSource, /flex-1 sm:flex-none/);
  assert.match(companyDetailSource, /w-full lg:w-auto/);
  assert.doesNotMatch(companyDetailSource, /<h1 className="page-heading truncate"/);
});

test('company contact directory remains discoverable with correct section state and safe website links', () => {
  assert.match(sidebarSource, /useLocation/);
  assert.match(sidebarSource, /location\.pathname\.startsWith\('\/companies\/'\)/);
  assert.match(companyDetailSource, /to="\/companies\/contacts"/);
  assert.match(companyDetailSource, /page\.customerDevelopment\.contactDirectory/);
  assert.match(companyDetailSource, /const websiteHref =/);
  assert.match(companyDetailSource, /https:\/\/\$\{company\.website\}/);
});

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
    'createInquiry', 'tasksAndStats', 'actionSummary', 'pipelineValue',
    'openPipeline', 'nextFollowUp', 'pendingTasks', 'openTask',
    'totalActivities', 'searchActivities', 'internal',
    'yourName', 'yourRole', 'placeholderFullName', 'placeholderCompany',
  ];

  for (const key of requiredKeys) {
    assert.match(dictionarySource, new RegExp(`${key}:`));
  }
});
