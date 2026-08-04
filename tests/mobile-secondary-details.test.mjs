import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const documentsSource = readFileSync(new URL('../src/components/materials-tooling/DocumentsTab.tsx', import.meta.url), 'utf8');
const quotationDetailSource = readFileSync(new URL('../src/pages/QuotationDetail.tsx', import.meta.url), 'utf8');

test('document detail lines use mobile cards before the desktop table', () => {
  assert.match(documentsSource, /selected\.lines/);
  assert.match(documentsSource, /className="space-y-2 md:hidden"/);
  assert.match(documentsSource, /className="hidden overflow-x-auto md:block"/);
  assert.match(documentsSource, /line\.item_name/);
  assert.match(documentsSource, /line\.execution_quantity/);
  assert.match(documentsSource, /w-full sm:w-auto/);
});

test('quotation detail uses responsive layout grid', () => {
  assert.match(quotationDetailSource, /grid grid-cols-1/);
  assert.match(quotationDetailSource, /max-w-5xl/);
});
