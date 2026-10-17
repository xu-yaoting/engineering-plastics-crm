import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../src/pages/FollowUpWorkbench.tsx', import.meta.url),
  'utf8',
);
const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const sidebarSource = readFileSync(
  new URL('../src/components/layout/Sidebar.tsx', import.meta.url),
  'utf8',
);
const contactsSource = readFileSync(
  new URL('../src/pages/Contacts.tsx', import.meta.url),
  'utf8',
);
const companiesSource = readFileSync(
  new URL('../src/pages/Companies.tsx', import.meta.url),
  'utf8',
);
const planSource = readFileSync(new URL('../PLANS.md', import.meta.url), 'utf8');

test('follow-up workbench presents company maintenance queues instead of a sales pipeline', () => {
  assert.match(source, /followUps\.list\(\)/);
  assert.match(source, /FollowUpBucket/);
  for (const bucket of ['overdue', 'thisWeek', 'none', 'all']) {
    assert.match(source, new RegExp(`key: '${bucket}'`));
  }
  assert.match(source, /role="tablist"/);
  assert.match(source, /aria-pressed=\{bucket === item\.key\}/);
  assert.doesNotMatch(source, /PipelineColumn|PipelineCard|pipeline\.list/);
});

test('follow-up workbench has accessible search, stage, and owner filters', () => {
  assert.match(source, /<OwnerFilter/);
  for (const fieldId of ['follow-up-workbench-search', 'follow-up-workbench-stage']) {
    assert.match(source, new RegExp(`htmlFor="${fieldId}"`));
    assert.match(source, new RegExp(`id="${fieldId}"`));
  }
  assert.match(source, /ownerFilter === 'mine'/);
  assert.match(source, /ownerFilter === 'unassigned'/);
});

test('follow-up workbench keeps rows compact and exposes both detail and follow-up actions', () => {
  assert.match(source, /className="page-shell"/);
  assert.match(source, /className="hidden data-surface overflow-x-auto rounded-t-none border-t-0 md:block"/);
  assert.match(source, /className="mt-2 space-y-2 md:hidden"/);
  assert.match(source, /sticky top-0 z-10/);
  assert.match(source, /<tr key=\{item\.company_id\} className="table-row">/);
  assert.match(source, /navigate\(`\/companies\/\$\{item\.company_id\}`\)/);
  assert.match(source, /setSelected\(item\)/);
  assert.match(source, /<FollowUpPanel/);
  assert.match(source, /currentTask=\{/);
});

test('company and follow-up lists paginate the current filtered result set', () => {
  assert.match(companiesSource, /COMPANIES_PAGE_SIZE = 10/);
  assert.match(source, /FOLLOW_UP_PAGE_SIZE = 7/);
  for (const listSource of [companiesSource, source]) {
    assert.match(listSource, /Pagination/);
    assert.match(listSource, /paged\.map/);
    assert.match(listSource, /setPage\(1\)/);
    assert.match(listSource, /total=\{filtered\.length\}/);
  }
  assert.match(companiesSource, /statusFilter/);
  assert.match(source, /bucket/);
});

test('contact directory uses readable mobile cards instead of clipped desktop rows', () => {
  assert.match(contactsSource, /className="space-y-2 md:hidden"/);
  assert.match(contactsSource, /className="hidden data-surface overflow-x-auto md:block"/);
  assert.match(contactsSource, /phoneFromCompany/);
  assert.match(contactsSource, /emailFromCompany/);
});

test('follow-up workbench handles loading, empty results, and API errors', () => {
  assert.match(source, /animate-pulse/);
  assert.match(source, /className="empty-state"/);
  assert.match(source, /toast\.error\(t\('page\.customerDevelopment\.loadFailed'\)\)/);
});

test('follow-up workbench uses the shared page title hierarchy', () => {
  assert.match(source, /<h1 className="page-heading">/);
  assert.match(source, /<p className="mt-1 text-sm text-ink-muted">/);
  assert.match(source, /<div className="toolbar flex-wrap rounded-b-none border-b-0">/);
  assert.match(source, /<div className="segmented-control w-full rounded-none border-x border-border border-b-0 border-t-0/);
  assert.match(source, /table-header w-\[28%\]\">/);
  assert.doesNotMatch(source, /table-header w-\[28%\] text-center/);
  assert.match(source, /STAGE_BADGE_BASE_CLASS/);
  assert.match(source, /SUGGEST_BADGE_CLASS/);
});

test('company development surfaces use restrained semantic state colors', () => {
  assert.match(source, /bg-success-soft text-success/);
  assert.match(source, /bg-warning-soft text-warning/);
  assert.match(source, /bg-stage-shipment-soft text-stage-shipment/);
  assert.match(source, /text-danger font-medium/);
  assert.match(source, /bg-canvas/);
  assert.match(contactsSource, /bg-brand-soft text-xs font-medium text-brand/);
  assert.match(contactsSource, /text-danger hover:bg-danger-soft/);
  assert.match(contactsSource, /border-border bg-surface/);
});

test('sales sidebar groups Companies, Follow-ups, and Quotations as primary sales entries', () => {
  assert.match(sidebarSource, /CalendarClock/);
  // Pipeline at top level, Quotations moved to Sales section
  assert.match(
    sidebarSource,
    /label: 'nav\.pipeline', path: '\/pipeline', icon: 'workflow'/,
  );
  assert.match(
    sidebarSource,
    /label: 'nav\.companies', path: '\/companies'[\s\S]*label: 'page\.customerDevelopment\.workbench', path: '\/companies\/follow-ups', icon: 'calendar-clock'[\s\S]*label: 'nav\.quotations', path: '\/quotations', icon: 'file-text'/,
  );
  // Inquiries is no longer a primary nav entry
  assert.doesNotMatch(sidebarSource, /label: 'nav\.inquiries', path: '\/inquiries'/);
  assert.match(appSource, /path="\/pipeline" element=\{<Pipeline \/>\}/);
  assert.match(appSource, /Navigate to="\/quotations" replace/);
  assert.match(sidebarSource, /end=\{item\.path === '\/' \|\| item\.path === '\/companies'\}/);
});

test('company routes render directly without a repeated module tab bar', () => {
  assert.match(appSource, /lazy\(\(\) => import\('\.\/pages\/FollowUpWorkbench'\)\)/);
  assert.match(appSource, /path="\/companies" element=\{<Companies \/>\}/);
  assert.match(appSource, /path="\/companies\/follow-ups" element=\{<FollowUpWorkbench \/>\}/);
  assert.match(appSource, /path="\/companies\/contacts" element=\{<Contacts \/>\}/);
  assert.match(appSource, /path="\/contacts" element=\{<Contacts \/>\}/);
});

test('customer development plan marks the workbench batch complete', () => {
  assert.match(
    planSource,
    /\[x\] Build the cross-company Follow-up Workbench\./,
  );
});
