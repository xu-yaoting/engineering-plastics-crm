import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pipelineSource = readFileSync(new URL('../server/routes/pipeline.ts', import.meta.url), 'utf8');
const inquiryRouteSource = readFileSync(new URL('../server/routes/inquiries.ts', import.meta.url), 'utf8');
const inquiryDetailSource = readFileSync(new URL('../src/pages/InquiryDetail.tsx', import.meta.url), 'utf8');
const quotationPanelSource = readFileSync(new URL('../src/components/quotations/QuotationEditPanel.tsx', import.meta.url), 'utf8');
const quotationRouteSource = readFileSync(new URL('../server/routes/quotations.ts', import.meta.url), 'utf8');
const quotationDetailSource = readFileSync(new URL('../src/pages/QuotationDetail.tsx', import.meta.url), 'utf8');
const quotationsListSource = readFileSync(new URL('../src/pages/Quotations.tsx', import.meta.url), 'utf8');
const opportunitiesPageSource = readFileSync(new URL('../src/pages/Pipeline.tsx', import.meta.url), 'utf8');
const i18nSource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');

test('pipeline represents a linked inquiry and quotation as one opportunity card', () => {
  assert.match(pipelineSource, /coveredInquiryIds/);
  assert.match(pipelineSource, /q\.inquiry_id/);
  assert.match(pipelineSource, /id: `opp-\$\{i\.id\}`/);
  assert.match(pipelineSource, /coveredInquiryIds\.has\(q\.inquiry_id\)/);
});

test('opportunities is the primary sales view with inquiry and quotation lists as secondary views', () => {
  assert.match(opportunitiesPageSource, /page\.title\.opportunities/);
  assert.match(opportunitiesPageSource, /aria-label=\{t\('page\.pipeline\.relatedViews'\)\}/);
  assert.match(opportunitiesPageSource, /to="\/inquiries"/);
  assert.match(opportunitiesPageSource, /to="\/quotations"/);
  assert.match(i18nSource, /opportunities: 'Opportunities'/);
  assert.match(i18nSource, /opportunities: '销售机会'/);
});

test('unified quotation-stage cards preserve the request material and quote value', () => {
  assert.match(pipelineSource, /entityType: 'quotation'/);
  assert.match(pipelineSource, /material: i\.target_material_requested/);
  assert.match(pipelineSource, /value: q\.total/);
  assert.match(pipelineSource, /status: q\.status/);
});

test('inquiry details expose the latest quotation without duplicating request fields', () => {
  assert.match(inquiryRouteSource, /latest_quotation/);
  assert.match(inquiryRouteSource, /inquiry_id = \?/);
  assert.match(inquiryRouteSource, /quotation_number/);
  assert.match(inquiryDetailSource, /inquiry\.latest_quotation/);
  assert.match(inquiryDetailSource, /formatCurrency/);
  assert.match(inquiryDetailSource, /quotations\/\$\{latestQuotation\.id\}/);
});

test('quotation creation starts from inquiry context instead of creating an empty quote', () => {
  assert.match(inquiryDetailSource, /QuotationEditPanel/);
  assert.match(inquiryDetailSource, /showQuotationPanel/);
  assert.match(inquiryDetailSource, /quotationDraft/);
  assert.match(inquiryDetailSource, /onSaved=\{handleQuotationSaved\}/);
  assert.doesNotMatch(inquiryDetailSource, /quotationsApi\.create/);
  assert.match(quotationPanelSource, /let savedQuotation/);
  assert.match(quotationPanelSource, /await quotations\.create/);
  assert.match(quotationPanelSource, /await onSaved\(savedQuotation\)/);
});

test('new quotation panel shows inherited customer and request context', () => {
  assert.match(quotationPanelSource, /quotation\.company_name/);
  assert.match(quotationPanelSource, /quotation\.contact_name/);
  assert.match(quotationPanelSource, /quotation\.target_material_requested/);
  assert.match(quotationPanelSource, /quotation\.quantity_estimate/);
  assert.match(quotationPanelSource, /product_grade_snapshot: quotation\.target_material_requested/);
  assert.match(quotationPanelSource, /subtitle=\{quotation\?\.quotation_number \|\| quotation\?\.inquiry_number\}/);
});

test('quotation API rejects empty creations while preserving valid inquiry links', () => {
  assert.match(quotationRouteSource, /QUOTATION_LINE_ITEMS_REQUIRED/);
  assert.match(quotationRouteSource, /Array\.isArray\(req\.body\.line_items\)/);
  assert.match(quotationRouteSource, /inquiry_id/);
  assert.match(quotationRouteSource, /inquiry\.company_id/);
});

test('quotation duplication keeps line items and links back to its inquiry', () => {
  assert.match(quotationDetailSource, /line_items: lineItems\.map/);
  assert.match(quotationDetailSource, /quotation\.inquiry_id/);
  assert.match(quotationDetailSource, /\/inquiries\/\$\{quotation\.inquiry_id\}/);
});

test('quotation list surfaces linked inquiry numbers and marks legacy quotes as unlinked', () => {
  assert.match(quotationRouteSource, /i\.inquiry_number/);
  assert.match(quotationRouteSource, /i\.inquiry_number LIKE/);
  assert.match(quotationsListSource, /q\.inquiry_number/);
  assert.match(quotationsListSource, /t\('common\.na'\)/);
});
