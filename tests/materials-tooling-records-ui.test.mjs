import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const materialsTabFile = new URL('../src/components/materials-tooling/MaterialsTab.tsx', import.meta.url);
const documentsTabFile = new URL('../src/components/materials-tooling/DocumentsTab.tsx', import.meta.url);
const approvalsTabFile = new URL('../src/components/materials-tooling/ApprovalsTab.tsx', import.meta.url);
const toolingTabFile = new URL('../src/components/materials-tooling/ToolingTab.tsx', import.meta.url);
const tasksPageFile = new URL('../src/pages/Tasks.tsx', import.meta.url);
const dictionarySource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');

const materialsSource = readFileSync(materialsTabFile, 'utf8');
const documentsSource = readFileSync(documentsTabFile, 'utf8');
const approvalsSource = readFileSync(approvalsTabFile, 'utf8');
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

test('material and tooling master lists provide a readable mobile layout before desktop tables', () => {
  assert.match(materialsSource, /className="space-y-2 md:hidden"/);
  assert.match(materialsSource, /className="hidden data-surface overflow-x-auto border-t-0 rounded-t-none md:block"/);
  assert.match(toolingSource, /className="md:hidden"/);
  assert.match(toolingSource, /className="data-surface divide-y divide-border border-t-0 rounded-t-none"/);
  assert.match(toolingSource, /className="hidden data-surface overflow-x-auto border-t-0 rounded-t-none md:block"/);
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

test('new material and tooling forms show the automatic code examples', () => {
  assert.match(materialsSource, /placeholder=\{editId \? t\('page\.materialsTooling\.code'\) : 'MAT-0001'\}/);
  assert.match(toolingSource, /placeholder=\{editId \? t\('page\.materialsTooling\.code'\) : 'TLG-0001'\}/);
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

test('MaterialsTab exposes guarded delete confirmation for managed materials', () => {
  assert.match(materialsSource, /ConfirmDialog/);
  assert.match(materialsSource, /deleteItem/);
  assert.match(materialsSource, /deleteTarget/);
  assert.match(materialsSource, /common\.confirmDelete/);
  assert.match(materialsSource, /common\.delete/);
  assert.match(materialsSource, /text-danger/);
});

test('MaterialsTab starts ledger-based count adjustments from the current quantity', () => {
  assert.match(materialsSource, /openAdjustment/);
  assert.match(materialsSource, /current_quantity/);
  assert.match(materialsSource, /document_type: 'count_adjustment'/);
  assert.match(materialsSource, /submitDocument\(created\.document\.id\)/);
  assert.match(materialsSource, /executeDocument\(created\.document\.id\)/);
  assert.match(materialsSource, /page\.materialsTooling\.execute/);
  assert.match(materialsSource, /system_quantity: systemQuantity/);
  assert.match(materialsSource, /counted_quantity: countedQuantity/);
  assert.match(materialsSource, /adjustment_delta: adjustmentDelta/);
  assert.match(materialsSource, /materials-tooling-adjustment-counted-quantity/);
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

test('DocumentsTab uses direct execution for new operational documents', () => {
  assert.match(documentsSource, /const confirmExecution/);
  assert.match(documentsSource, /submitDocument\(doc\.id\)/);
  assert.match(documentsSource, /executeDocument\(doc\.id\)/);
  assert.match(documentsSource, /doc\.document_type === 'purchase_request'/);
  assert.doesNotMatch(documentsSource, /submitDocument\(doc\.id\).*pendingApproval/);
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

test('purchase documents use optional handwritten supplier and optional unit price', () => {
  assert.match(documentsSource, /supplierName/);
  assert.match(documentsSource, /supplier_name/);
  assert.match(documentsSource, /page\.materialsTooling\.supplierOptional/);
  assert.match(documentsSource, /page\.materialsTooling\.optional/);
  assert.doesNotMatch(documentsSource, /supplierRequired/);
  assert.doesNotMatch(documentsSource, /required=\{form\.documentType === 'purchase_receipt'\}/);
  assert.match(dictionarySource, /supplierOptional: 'Optional/);
  assert.match(dictionarySource, /supplierOptional: '可选/);
});

test('materials tooling record queues paginate their filtered result sets', () => {
  assert.match(materialsSource, /Pagination/);
  assert.match(materialsSource, /MATERIALS_PAGE_SIZE = 10/);
  assert.match(materialsSource, /paged\.map/);
  assert.match(materialsSource, /setPage\(1\)/);
  assert.match(materialsSource, /total=\{filtered\.length\}/);

  assert.match(documentsSource, /Pagination/);
  assert.match(documentsSource, /DOCUMENTS_PAGE_SIZE = 10/);
  assert.match(documentsSource, /paged\.map/);
  assert.match(documentsSource, /setPage\(1\)/);
  assert.match(documentsSource, /total=\{filtered\.length\}/);

  assert.match(approvalsSource, /Pagination/);
  assert.match(approvalsSource, /APPROVALS_PAGE_SIZE = 10/);
  assert.match(approvalsSource, /paged\.map/);
  assert.match(approvalsSource, /total=\{pendingDocs\.length\}/);
});
