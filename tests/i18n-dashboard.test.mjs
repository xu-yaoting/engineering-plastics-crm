import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/pages/Dashboard.tsx', import.meta.url), 'utf8')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\/[^\n]*/g, '');

const dictionarySource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');

test('dashboard no longer renders obvious hard-coded English UI labels', () => {
  const forbidden = [
    /active orders/,
    /open quotations/,
    /Outstanding Receivables/,
    /Overdue Receivables/,
    /Open Orders/,
    /Open Quotations/,
    /unpaid invoices/,
    /overdue invoices/,
    /Not yet delivered/,
    /Awaiting decision/,
    /Accounts Receivable Alert/,
    />Customer</,
    />Invoice</,
    />Amount</,
    /Due Date/,
    /Overdue/,
    /Due Today/,
    /Due Soon/,
    /Normal/,
    /All invoices paid/,
    /Sales Pipeline/,
    /label: 'Inquiry'/,
    /label: 'Quotation'/,
    /label: 'Sample'/,
    /label: 'Confirmed'/,
    /label: 'Production'/,
    /label: 'Shipment'/,
    /label: 'Payment'/,
    /No active deals in pipeline/,
    /Recent Inquiries/,
    /No inquiries/,
    /This Month Sales/,
    />Currency</,
    />Target</,
    />Actual</,
    /No closed sales this month/,
    /Top Customers This Month/,
    /\{c\.count\} deals/,
    /Receivable Aging/,
    /0-30 Days/,
    /31-60 Days/,
    /61-90 Days/,
    /90\+ Days/,
    /\+\{b\.items\.length - 4\} more/,
    /No outstanding receivables/,
    /Recent Quotations/,
    /No quotations/,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(source, pattern);
  }
});

test('dashboard localization dictionary contains the batch keys', () => {
  const requiredKeys = [
    'activeOrdersSummary', 'openQuotationsSummary',
    'outstandingReceivables', 'overdueReceivables',
    'openOrders', 'openQuotations', 'unpaidInvoices',
    'overdueInvoices', 'notYetDelivered', 'awaitingDecision',
    'accountsReceivableAlert', 'customer', 'invoice', 'order', 'amount',
    'currencyShort', 'dueDate', 'overdue', 'dueToday', 'dueSoon',
    'normal', 'allInvoicesPaid', 'salesPipeline',
    'stageInquiry', 'stageQuotation', 'stageSample',
    'stageShipment', 'stagePayment',
    'totalPipelineItems', 'pipelineShare',
    'noActiveDeals', 'recentInquiries', 'noInquiries',
    'thisMonthSales', 'currency', 'target', 'actual',
    'noClosedSalesThisMonth', 'topCustomersThisMonth', 'deals',
    'receivableAging', 'days0to30', 'days31to60', 'days61to90',
    'days90Plus', 'more', 'trackedReceivables',
    'agingBucketInvoices', 'agingNoInvoices', 'noOutstandingReceivables',
    'recentQuotations', 'noQuotations',
  ];

  for (const key of requiredKeys) {
    assert.match(dictionarySource, new RegExp(`${key}:`));
  }
});

test('dashboard sales pipeline uses real module counts without unused stages', () => {
  assert.match(source, /fetch\('\/api\/shipments'\)/);
  assert.match(source, /count: inquiries\.length/);
  assert.match(source, /count: quotations\.length/);
  assert.match(source, /count: samples\.length/);
  assert.match(source, /count: shipments\.length/);
  assert.match(source, /count: invoices\.length/);
  assert.match(source, /link: '\/shipments'/);
  assert.doesNotMatch(source, /stageConfirmed/);
  assert.doesNotMatch(source, /stageProduction/);
  assert.doesNotMatch(source, /BadgeCheck/);
  assert.doesNotMatch(source, /Factory/);
});

test('dashboard uses shared workspace card layout classes', () => {
  assert.match(source, /const WORKSPACE_CARD = 'card overflow-hidden border-gray-200'/);
  assert.match(source, /const WORKSPACE_CARD_HEADER = 'px-4 py-3 border-b border-gray-100 bg-gray-50\/60 flex items-center justify-between min-h-\[52px\]'/);
  assert.match(source, /const WORKSPACE_CARD_TITLE = 'text-base font-semibold text-gray-700 flex items-center gap-2'/);
  assert.match(source, /const WORKSPACE_CARD_BODY = 'p-4'/);
  assert.match(source, /const KPI_CARD = 'card p-4 border-gray-200 hover:border-gray-300 transition-colors min-h-\[120px\] flex flex-col justify-between'/);
});

test('dashboard pipeline and aging cards expose summary-oriented layouts', () => {
  assert.match(source, /const pipelineTotal = pipeline\.reduce/);
  assert.match(source, /const pipelineMax = Math\.max/);
  assert.match(source, /page\.dashboard\.totalPipelineItems/);
  assert.match(source, /page\.dashboard\.pipelineShare/);
  assert.match(source, /const unpaidWithDueDate = invoices\.filter/);
  assert.match(source, /const maxAgingCount = Math\.max/);
  assert.match(source, /page\.dashboard\.trackedReceivables/);
  assert.match(source, /grid grid-cols-1 gap-3 md:grid-cols-2/);
  assert.doesNotMatch(source, /ml-\[120px\]/);
});

test('dashboard receivable alert shows order numbers instead of invoice numbers', () => {
  assert.match(source, /page\.dashboard\.order/);
  assert.match(source, /inv\.order_number \|\| '—'/);
  assert.doesNotMatch(source, /page\.dashboard\.invoice/);
});
