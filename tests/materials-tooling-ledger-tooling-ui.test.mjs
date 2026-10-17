import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ledgerFile = new URL('../src/components/materials-tooling/LedgerTab.tsx', import.meta.url);
const toolingFile = new URL('../src/components/materials-tooling/ToolingTab.tsx', import.meta.url);

const ledgerSource = readFileSync(ledgerFile, 'utf8');
const toolingSource = readFileSync(toolingFile, 'utf8');

const renderedLedger = ledgerSource.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/[^\n]*/g, '');
const renderedTooling = toolingSource.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/[^\n]*/g, '');

test('LedgerTab uses data-surface with sticky headers', () => {
  assert.match(ledgerSource, /data-surface/);
  assert.match(ledgerSource, /sticky top-0 z-10/);
  assert.match(ledgerSource, /table-header/);
});

test('LedgerTab has month selection', () => {
  assert.match(ledgerSource, /month/);
  assert.match(ledgerSource, /type=.?month/);
});

test('LedgerTab has quantity columns for opening/receipts/issues/closing', () => {
  assert.match(ledgerSource, /opening/);
  assert.match(ledgerSource, /receipts/);
  assert.match(ledgerSource, /issues/);
  assert.match(ledgerSource, /closing/);
});

test('LedgerTab handles viewPrices for amount columns', () => {
  assert.match(ledgerSource, /viewPrices/);
});

test('LedgerTab has Excel and PDF download buttons', () => {
  assert.match(ledgerSource, /download/);
  assert.match(ledgerSource, /xlsx|excel/i);
  assert.match(ledgerSource, /pdf/i);
  assert.match(ledgerSource, /\.blob\(\)|downloadBlob|materialsToolingApi\.downloadLedger/);
});

test('LedgerTab has close/reopen period controls', () => {
  assert.match(ledgerSource, /close/);
  assert.match(ledgerSource, /reopen/);
  assert.match(ledgerSource, /managePeriods/);
  assert.match(ledgerSource, /closePeriodConfirm/);
  assert.match(ledgerSource, /reopenReason/);
});

test('LedgerTab renders dedicated ledger labels and adjustment quantity', () => {
  assert.match(ledgerSource, /openingQty/);
  assert.match(ledgerSource, /receiptQty/);
  assert.match(ledgerSource, /issueQty/);
  assert.match(ledgerSource, /scrapQty/);
  assert.match(ledgerSource, /adjustmentQty/);
  assert.match(ledgerSource, /closingQty/);
  assert.match(ledgerSource, /adjustment\.quantity/);
  assert.doesNotMatch(ledgerSource, /materialsTooling\.overviewTab/);
});

test('LedgerTab uses typed API client', () => {
  assert.match(ledgerSource, /materialsToolingApi/);
});

test('LedgerTab no hard-coded English copy', () => {
  const forbidden = [
    />Opening Balance</, />Period Receipts</, />Period Issues</,
    />Closing Balance</, />Monthly Receipts</, />Monthly Issues</,
    />Download Excel</, />Download PDF</, />Close Period</,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(renderedLedger, pattern,
      `Hard-coded English in LedgerTab: ${pattern}`);
  }
});

test('ToolingTab uses data-surface with sticky headers', () => {
  assert.match(toolingSource, /data-surface/);
  assert.match(toolingSource, /sticky top-0 z-10/);
  assert.match(toolingSource, /table-header/);
});

test('ToolingTab has status filters', () => {
  assert.match(toolingSource, /filter/);
  assert.match(toolingSource, /status/);
});

test('ToolingTab shows tooling status values and terminal states', () => {
  assert.match(toolingSource, /disposed|Disposed|disposal/);
  assert.match(toolingSource, /lost|Lost|loss_report/);
  assert.match(toolingSource, /in_stock/);
  assert.match(toolingSource, /in_use/);
  assert.match(toolingSource, /under_repair/);
});

test('ToolingTab has create form with grouped fields', () => {
  assert.match(toolingSource, /fieldset/);
  assert.match(toolingSource, /grid-cols-1.*sm:grid-cols-2/);
  assert.match(toolingSource, /serial_number/);
  assert.match(toolingSource, /tracked_quantity/);
  assert.match(toolingSource, /const payload = \{/);
  assert.doesNotMatch(toolingSource, /location: form\.location/);
});

test('ToolingTab uses typed API client', () => {
  assert.match(toolingSource, /materialsToolingApi/);
});

test('ToolingTab exposes managed editing while keeping immutable identifiers locked', () => {
  assert.match(toolingSource, /updateTooling/);
  assert.match(toolingSource, /openEdit/);
  assert.match(toolingSource, /editId/);
  assert.match(toolingSource, /disabled=\{!!editId\}/);
  assert.match(toolingSource, /editId \? t\('common\.edit'\)/);
});

test('ToolingTab exposes tooling detail and movement history', () => {
  assert.match(toolingSource, /getTooling/);
  assert.match(toolingSource, /movements/);
  assert.match(toolingSource, /movement_type/);
  assert.match(toolingSource, /from_status/);
  assert.match(toolingSource, /to_status/);
  assert.match(toolingSource, /document_number/);
});

test('ToolingTab no hard-coded English copy', () => {
  const forbidden = [
    />Add Tooling</, />Tooling Code</, />Tooling Name</,
    />In Stock</, />In Use</, />Under Repair</, />Disposed</,
    />Status</, />Custodian</,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(renderedTooling, pattern,
      `Hard-coded English in ToolingTab: ${pattern}`);
  }
  assert.doesNotMatch(toolingSource, /\? 'In Stock'/);
  assert.match(toolingSource, /toolingStatus/);
});

test('ledger and tooling records paginate their current result sets', () => {
  assert.match(ledgerSource, /Pagination/);
  assert.match(ledgerSource, /MATERIALS_LEDGER_PAGE_SIZE = 10/);
  assert.match(ledgerSource, /paged\.map/);
  assert.match(ledgerSource, /setPage\(1\)/);
  assert.match(ledgerSource, /total=\{filtered\.length\}/);

  assert.match(toolingSource, /Pagination/);
  assert.match(toolingSource, /TOOLING_PAGE_SIZE = 10/);
  assert.match(toolingSource, /paged\.map/);
  assert.match(toolingSource, /TOOLING_MOVEMENTS_PAGE_SIZE = 10/);
  assert.match(toolingSource, /pagedMovements\.map/);
  assert.match(toolingSource, /total=\{selectedMovements\.length\}/);
});

test('ToolingTab joins its toolbar to the list surface with divided mobile rows', () => {
  assert.match(toolingSource, /className="toolbar justify-between flex-wrap gap-3"/);
  assert.doesNotMatch(toolingSource, /toolbar mb-4/);
  assert.match(toolingSource, /data-surface divide-y divide-border border-t-0 rounded-t-none/);
  assert.match(toolingSource, /hidden data-surface overflow-x-auto border-t-0 rounded-t-none md:block/);
  assert.match(toolingSource, /onStatsChange/);
});

test('ToolingTab renders custodian names and the add button uses the addTooling label', () => {
  assert.match(toolingSource, /item\.custodian_name/);
  assert.doesNotMatch(toolingSource, /custodian_user_id \|\| '—'/);
  assert.match(toolingSource, /t\('page\.materialsTooling\.addTooling'\)/);
});

test('LedgerTab joins its toolbar to the ledger surface', () => {
  assert.doesNotMatch(ledgerSource, /toolbar mb-4/);
  assert.match(ledgerSource, /hidden data-surface overflow-x-auto border-t-0 rounded-t-none md:block/);
});
