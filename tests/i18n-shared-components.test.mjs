import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const files = [
  '../src/components/shared/ResponsiveWorkspace.tsx',
  '../src/components/shared/StatusBadge.tsx',
  '../src/components/layout/Sidebar.tsx',
  '../src/components/shared/AboutModal.tsx',
  '../src/components/pipeline/PipelineColumn.tsx',
  '../src/components/pipeline/PipelineCard.tsx',
  '../src/pages/Pipeline.tsx',
];

const source = files
  .map(path => readFileSync(new URL(path, import.meta.url), 'utf8'))
  .join('\n')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\/[^\n]*/g, '');

const dictionarySource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');
const pipelineSurfaceSource = [
  '../src/components/pipeline/PipelineColumn.tsx',
  '../src/components/pipeline/PipelineCard.tsx',
].map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const topBarSource = readFileSync(new URL('../src/components/layout/TopBar.tsx', import.meta.url), 'utf8');

test('shared layout, badges, and pipeline controls use translation keys for visible labels', () => {
  const forbidden = [
    /rightPanelLabel = 'Details'/,
    /Customer Profile/,
    /Opportunities & Activity/,
    /Drop items here/,
    /Release to drop/,
    /Loading pipeline/,
    /section: 'Sales'/,
    /section: 'Workspace'/,
    /Version'/,
    /Build'/,
    /Database'/,
    /Close</,
    /status\.replace\(/,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(source, pattern);
  }
});

test('shared component dictionary contains required English and Chinese keys', () => {
  const requiredKeys = [
    'workspace:', 'customerProfile', 'opportunitiesActivity',
    'dropItemsHere', 'releaseToDrop', 'partiallyShipped', 'unpaid',
    'about:', 'version', 'database',
  ];

  for (const key of requiredKeys) {
    assert.match(dictionarySource, new RegExp(key));
  }
});

test('pipeline board shows quotation, sample, testing, and order columns', () => {
  assert.match(source, /key: 'testing'/);
  assert.match(source, /c\.stage === col\.key/);
  assert.match(source, /grid h-full min-w-\[1040px\] grid-cols-4 gap-4/);
  assert.match(source, /flex min-w-0 flex-col/);
});

test('sidebar places inventory below payments in fulfillment navigation', () => {
  assert.match(source, /nav\.shipments[\s\S]*nav\.payments[\s\S]*nav\.inventory/);
});

test('app shell uses a dismissible mobile navigation drawer without changing desktop collapse', () => {
  assert.match(appSource, /useMediaQuery\('\(max-width: 767px\)'\)/);
  assert.match(appSource, /className="hidden md:flex"/);
  assert.match(appSource, /mobileSidebarOpen &&/);
  assert.match(appSource, /fixed inset-0 z-50 md:hidden/);
  assert.match(appSource, /className="h-dvh flex overflow-hidden"/);
  assert.match(appSource, /className="relative flex h-dvh w-\[min\(15rem,calc\(100vw-3rem\)\)\][^"]*"/);
  assert.match(appSource, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(appSource, /const previousOverflow = document\.body\.style\.overflow/);
  assert.match(appSource, /aria-modal="true"/);
  assert.match(appSource, /setMobileSidebarOpen\(false\)/);
  assert.match(appSource, /isMobile[\s\S]*setMobileSidebarOpen[\s\S]*setSidebarCollapsed/);
  assert.match(topBarSource, /aria-expanded=\{navigationExpanded\}/);
  assert.match(topBarSource, /aria-label=\{t\('nav\.workspace'\)\}/);
});

test('shared informational overlays use restrained standard surfaces', () => {
  assert.match(source, /modal-surface/);
  assert.doesNotMatch(source, /rounded-xl|shadow-2xl|from-blue-600 to-blue-700/);
  assert.match(source, /rounded-full bg-blue-600/);
});

test('pipeline uses flat six-pixel drag surfaces with neutral record text', () => {
  assert.doesNotMatch(pipelineSurfaceSource, /rounded-lg|shadow-\[0_1px_1px/);
  assert.match(pipelineSurfaceSource, /cursor-grab rounded border/);
  assert.match(pipelineSurfaceSource, /truncate text-2xs font-450 text-gray-500/);
  assert.match(pipelineSurfaceSource, /group-hover:text-gray-600/);
});

test('pipeline owner filter uses the shared control radius and focus treatment', () => {
  const pipelinePageSource = readFileSync(new URL('../src/pages/Pipeline.tsx', import.meta.url), 'utf8');
  assert.match(pipelinePageSource, /rounded border border-gray-200/);
  assert.doesNotMatch(pipelinePageSource, /rounded-lg border border-gray-200/);
  assert.match(pipelinePageSource, /focus-visible:ring-2 focus-visible:ring-blue-600/);
});
