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
    'accountsReceivableAlert', 'customer', 'invoice', 'amount',
    'currencyShort', 'dueDate', 'overdue', 'dueToday', 'dueSoon',
    'normal', 'allInvoicesPaid', 'salesPipeline',
    'stageInquiry', 'stageQuotation', 'stageSample', 'stageConfirmed',
    'stageProduction', 'stageShipment', 'stagePayment',
    'noActiveDeals', 'recentInquiries', 'noInquiries',
    'thisMonthSales', 'currency', 'target', 'actual',
    'noClosedSalesThisMonth', 'topCustomersThisMonth', 'deals',
    'receivableAging', 'days0to30', 'days31to60', 'days61to90',
    'days90Plus', 'more', 'noOutstandingReceivables',
    'recentQuotations', 'noQuotations',
  ];

  for (const key of requiredKeys) {
    assert.match(dictionarySource, new RegExp(`${key}:`));
  }
});
