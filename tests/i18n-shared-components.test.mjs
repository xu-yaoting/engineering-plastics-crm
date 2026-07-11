import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const files = [
  '../src/components/shared/ResponsiveWorkspace.tsx',
  '../src/components/shared/StatusBadge.tsx',
  '../src/components/layout/Sidebar.tsx',
  '../src/components/shared/AboutModal.tsx',
  '../src/components/pipeline/PipelineColumn.tsx',
  '../src/pages/Pipeline.tsx',
];

const source = files
  .map(path => readFileSync(new URL(path, import.meta.url), 'utf8'))
  .join('\n')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\/[^\n]*/g, '');

const dictionarySource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');

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

test('pipeline board keeps sample and testing work in one equal-width column set', () => {
  assert.doesNotMatch(source, /key: 'testing'/);
  assert.match(source, /col\.key === 'sample' \? c\.stage === 'sample' \|\| c\.stage === 'testing' : c\.stage === col\.key/);
  assert.match(source, /grid h-full min-w-\[1040px\] grid-cols-4 gap-4/);
  assert.match(source, /flex min-w-0 flex-col/);
});
