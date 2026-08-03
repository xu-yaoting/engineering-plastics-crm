import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const documentsSource = readFileSync(new URL('../src/components/materials-tooling/DocumentsTab.tsx', import.meta.url), 'utf8');
const inquirySource = readFileSync(new URL('../src/pages/InquiryDetail.tsx', import.meta.url), 'utf8');

test('document detail lines use mobile cards before the desktop table', () => {
  assert.match(documentsSource, /selected\.lines/);
  assert.match(documentsSource, /className="space-y-2 md:hidden"/);
  assert.match(documentsSource, /className="hidden overflow-x-auto md:block"/);
  assert.match(documentsSource, /line\.item_name/);
  assert.match(documentsSource, /line\.execution_quantity/);
  assert.match(documentsSource, /w-full sm:w-auto/);
});

test('inquiry detail technical fields collapse to one column on phones', () => {
  assert.match(inquirySource, /className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2"/);
  assert.match(inquirySource, /className="col-span-1 sm:col-span-2"/);
  assert.match(inquirySource, /className="max-w-5xl mx-auto p-4 sm:p-6"/);
});
