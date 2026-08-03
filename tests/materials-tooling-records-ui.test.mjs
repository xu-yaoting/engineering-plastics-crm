import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const materialsTabFile = new URL('../src/components/materials-tooling/MaterialsTab.tsx', import.meta.url);
const documentsTabFile = new URL('../src/components/materials-tooling/DocumentsTab.tsx', import.meta.url);
const toolingTabFile = new URL('../src/components/materials-tooling/ToolingTab.tsx', import.meta.url);
const tasksPageFile = new URL('../src/pages/Tasks.tsx', import.meta.url);
const dictionarySource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');

const materialsSource = readFileSync(materialsTabFile, 'utf8');
const documentsSource = readFileSync(documentsTabFile, 'utf8');
const toolingSource = readFileSync(toolingTabFile, 'utf8');
const tasksSource = readFileSync(tasksPageFile, 'utf8');

// Strip comments
const renderedMaterials = materialsSource.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/[^\n]*/g, '');
const renderedDocuments = documentsSource.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/[^\n]*/g, '');

test('MaterialsTab uses data-surface with sticky headers', () => {
  assert.match(materialsSource, /data-surface/);
  assert.match(materialsSource, /sticky top-0 z-10/);
  assert.match(materialsSource, /table-header/);
});

test('material and tooling master lists provide readable mobile cards before desktop tables', () => {
  assert.match(materialsSource, /className="space-y-2 md:hidden"/);
  assert.match(materialsSource, /className="hidden data-surface overflow-x-auto md:block"/);
  assert.match(toolingSource, /className="space-y-2 md:hidden"/);
  assert.match(toolingSource, /className="hidden data-surface overflow-x-auto md:block"/);
});

test('MaterialsTab has searchable table', () => {
  assert.match(materialsSource, /search/);
  assert.match(materialsSource, /filter/);
  assert.match(materialsSource, /onChange/);
});

test('MaterialsTab has fixed-UOM form with grouped fieldsets', () => {
  assert.match(materialsSource, /fieldset/);
  assert.match(materialsSource, /grid-cols-1.*sm:grid-cols-2/);
});

test('material and tooling master-data controls have persistent labels', () => {
  const materialControlIds = [
    'materials-tooling-material-search',
    'materials-tooling-material-code',
    'materials-tooling-material-name',
    'materials-tooling-material-category',
    'materials-tooling-material-unit',
    'materials-tooling-material-specification',
    'materials-tooling-material-safety-quantity',
    'materials-tooling-material-notes',
  ];
  const toolingControlIds = [
    'materials-tooling-tooling-code',
    'materials-tooling-tooling-name',
    'materials-tooling-tooling-category',
    'materials-tooling-tooling-specification',
    'materials-tooling-tooling-serial-number',
    'materials-tooling-tooling-tracked-quantity',
    'materials-tooling-tooling-notes',
  ];

  for (const fieldId of materialControlIds) {
    assert.match(materialsSource, new RegExp(`htmlFor="${fieldId}"`));
    assert.match(materialsSource, new RegExp(`id="${fieldId}"`));
  }
  for (const fieldId of toolingControlIds) {
    assert.match(toolingSource, new RegExp(`htmlFor="${fieldId}"`));
    assert.match(toolingSource, new RegExp(`id="${fieldId}"`));
  }
});

test('material and tooling record workflows use side panels instead of expanding in list content', () => {
  for (const recordSource of [materialsSource, toolingSource]) {
    assert.match(recordSource, /import SidePanel from '\.\.\/shared\/SidePanel'/);
    assert.match(recordSource, /<SidePanel\s+open=\{showForm\}/);
    assert.doesNotMatch(recordSource, /showForm && \(/);
  }

  assert.match(toolingSource, /<SidePanel\s+open=\{!!selected\}/);
  assert.doesNotMatch(toolingSource, /selected && <div className="data-surface mt-4 p-4"/);
});

test('task and material document create flows use side panels with document details kept contextual', () => {
  assert.match(tasksSource, /import SidePanel from '\.\.\/components\/shared\/SidePanel'/);
  assert.match(tasksSource, /<SidePanel\s+open=\{showForm\}/);
  assert.doesNotMatch(tasksSource, /showForm && \(/);

  assert.match(documentsSource, /import SidePanel from '\.\.\/shared\/SidePanel'/);
  assert.match(documentsSource, /<SidePanel\s+open=\{showForm\}/);
  assert.match(documentsSource, /<SidePanel\s+open=\{!!selected\}/);
  assert.doesNotMatch(documentsSource, /showForm && <div className="data-surface p-4 mb-4"/);
  assert.doesNotMatch(documentsSource, /selected && <div className="data-surface mt-4 p-4"/);
});

test('MaterialsTab handles price column permission (viewPrices)', () => {
  assert.match(materialsSource, /viewPrices/);
});

test('MaterialsTab uses typed API client', () => {
  assert.match(materialsSource, /materialsToolingApi/);
});

test('MaterialsTab reports successful saves as success', () => {
  assert.match(materialsSource, /toast\.success\(t\('page\.materialsTooling\.saved'\)\)/);
  assert.doesNotMatch(materialsSource, /toast\.success\(t\('page\.materialsTooling\.error\.saveFailed'\)\)/);
});

test('MaterialsTab supports previewed all-or-nothing opening balance import', () => {
  assert.match(materialsSource, /previewCutoverImport/);
  assert.match(materialsSource, /confirmCutoverImport/);
  assert.match(materialsSource, /sourceWorkbook/);
  assert.match(materialsSource, /confirm/);
  assert.match(materialsSource, /type="file"/);
  assert.match(materialsSource, /missingItems/);
  assert.match(materialsSource, /errors/);
});

test('MaterialsTab no hard-coded English copy', () => {
  const forbidden = [
    />Add Material</, />Material Code</, />Material Name</,
    />Current Qty</, />Safety Qty</,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(renderedMaterials, pattern,
      `Hard-coded English in MaterialsTab: ${pattern}`);
  }
});

test('DocumentsTab uses data-surface with sticky headers', () => {
  assert.match(documentsSource, /data-surface/);
  assert.match(documentsSource, /sticky top-0 z-10/);
  assert.match(documentsSource, /table-header/);
});

test('DocumentsTab has document type filters', () => {
  assert.match(documentsSource, /filter/);
  assert.match(documentsSource, /select/);
});

test('DocumentsTab has submit/withdraw/execute action buttons', () => {
  assert.match(documentsSource, /submit/);
  assert.match(documentsSource, /withdraw/);
  assert.match(documentsSource, /execute/);
});

test('DocumentsTab supports the complete document record workflow', () => {
  assert.match(documentsSource, /createDocument/);
  assert.match(documentsSource, /getDocument/);
  assert.match(documentsSource, /downloadApplicationPdf/);
  assert.match(documentsSource, /downloadApprovedPdf/);
  assert.match(documentsSource, /voidAndReplaceDocument/);
  assert.match(documentsSource, /tooling_request/);
  assert.match(documentsSource, /material_item_id/);
  assert.match(documentsSource, /tax_inclusive_unit_price/);
  assert.match(documentsSource, /lineForms\.map/);
  assert.match(documentsSource, /setLineForms/);
  assert.match(documentsSource, /addMaterialLine/);
  assert.match(documentsSource, /removeMaterialLine/);
  assert.match(documentsSource, /listSuppliers/);
  assert.match(documentsSource, /supplier_id/);
  assert.match(documentsSource, /contract_number/);
  assert.match(documentsSource, /invoice_number/);
  assert.match(documentsSource, /updateDocument/);
  assert.match(documentsSource, /listDocumentAttachments/);
  assert.match(documentsSource, /uploadAttachment/);
  assert.match(documentsSource, /downloadAttachment/);
  assert.match(documentsSource, /type="file"/);
});

test('DocumentsTab uses typed API client', () => {
  assert.match(documentsSource, /materialsToolingApi/);
});

test('DocumentsTab no hard-coded English copy', () => {
  const forbidden = [
    />Draft</, />Pending Approval</, />Approved</,
    />Submit</, />Withdraw</, />Execute</,
    />Document Type</, />Document Number</,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(renderedDocuments, pattern,
      `Hard-coded English in DocumentsTab: ${pattern}`);
  }
});

test('DocumentsTab shows document status from dictionary keys', () => {
  assert.match(dictionarySource, /pendingApproval/);
  assert.match(dictionarySource, /pendingExecution/);
  assert.match(dictionarySource, /awaitingSignedCopy/);
  assert.match(dictionarySource, /'Draft'/);
  assert.match(dictionarySource, /'Approved'/);
  assert.match(dictionarySource, /'Executed'/);
});
