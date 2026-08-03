import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pipelineSource = readFileSync(new URL('../server/routes/pipeline.ts', import.meta.url), 'utf8');
const quotationPanelSource = readFileSync(new URL('../src/components/quotations/QuotationEditPanel.tsx', import.meta.url), 'utf8');
const quotationRouteSource = readFileSync(new URL('../server/routes/quotations.ts', import.meta.url), 'utf8');
const quotationDetailSource = readFileSync(new URL('../src/pages/QuotationDetail.tsx', import.meta.url), 'utf8');
const quotationsListSource = readFileSync(new URL('../src/pages/Quotations.tsx', import.meta.url), 'utf8');
const sidebarSource = readFileSync(new URL('../src/components/layout/Sidebar.tsx', import.meta.url), 'utf8');
const i18nSource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');
const dbSource = readFileSync(new URL('../server/db.ts', import.meta.url), 'utf8');

test('pipeline shows quotation cards directly with target material from quotation', () => {
  // Merge logic removed — quotations are the primary sales entity
  assert.doesNotMatch(pipelineSource, /coveredInquiryIds/);
  assert.match(pipelineSource, /material: q\.target_material_requested/);
  assert.match(pipelineSource, /urgency: q\.urgency/);
  assert.match(pipelineSource, /entityType: 'quotation'/);
  assert.match(pipelineSource, /value: q\.total/);
});

test('quotations is the primary sales entry with new quotation button', () => {
  assert.match(quotationsListSource, /QuotationEditPanel/);
  assert.match(quotationsListSource, /showNewQuotation/);
  assert.match(quotationsListSource, /page\.quotations\.newQuotation/);
  assert.match(i18nSource, /newQuotation: 'New Quotation'/);
  assert.match(i18nSource, /newQuotation: '新建报价'/);
});

test('sidebar places quotations under Sales section as primary entry', () => {
  assert.match(
    sidebarSource,
    /label: 'nav\.companies', path: '\/companies'[\s\S]*label: 'page\.customerDevelopment\.workbench', path: '\/companies\/follow-ups', icon: 'calendar-clock'[\s\S]*label: 'nav\.quotations', path: '\/quotations', icon: 'file-text'/,
  );
  assert.doesNotMatch(sidebarSource, /label: 'nav\.inquiries', path: '\/inquiries'/);
});

test('new quotation form includes customer requirement fields editable inline', () => {
  assert.match(quotationPanelSource, /companyList/);
  assert.match(quotationPanelSource, /contactList/);
  assert.match(quotationPanelSource, /application_description/);
  assert.match(quotationPanelSource, /target_material_requested/);
  assert.match(quotationPanelSource, /quantity_estimate/);
  assert.match(quotationPanelSource, /form\.urgency/);
  assert.match(quotationPanelSource, /form\.source/);
  assert.match(quotationPanelSource, /page\.inquiryNew\.companyRequired/);
  assert.match(quotationPanelSource, /page\.inquiryNew\.descriptionRequired/);
});

test('quotation form sends new fields to API', () => {
  assert.match(quotationPanelSource, /application_description/);
  assert.match(quotationPanelSource, /target_material_requested/);
  assert.match(quotationPanelSource, /urgency: 'within_1_month'/);
  assert.match(quotationPanelSource, /source: 'email'/);
});

test('quotations table has inquiry fields added via migration', () => {
  assert.match(dbSource, /ALTER TABLE quotations ADD COLUMN application_description/);
  assert.match(dbSource, /ALTER TABLE quotations ADD COLUMN target_material_requested/);
  assert.match(dbSource, /ALTER TABLE quotations ADD COLUMN quantity_estimate/);
  assert.match(dbSource, /ALTER TABLE quotations ADD COLUMN urgency/);
  assert.match(dbSource, /ALTER TABLE quotations ADD COLUMN source/);
});

test('quotation API update fields include new customer requirement columns', () => {
  assert.match(quotationRouteSource, /'application_description'/);
  assert.match(quotationRouteSource, /'target_material_requested'/);
  assert.match(quotationRouteSource, /'quantity_estimate'/);
  assert.match(quotationRouteSource, /'urgency'/);
  assert.match(quotationRouteSource, /'source'/);
});

test('quotation API POST stores new fields and validates company + line items', () => {
  assert.match(quotationRouteSource, /req\.body\.application_description/);
  assert.match(quotationRouteSource, /req\.body\.target_material_requested/);
  assert.match(quotationRouteSource, /req\.body\.urgency/);
  assert.match(quotationRouteSource, /QUOTATION_LINE_ITEMS_REQUIRED/);
  assert.match(quotationRouteSource, /Array\.isArray\(req\.body\.line_items\)/);
});
