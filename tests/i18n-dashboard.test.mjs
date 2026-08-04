import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/pages/Dashboard.tsx', import.meta.url), 'utf8')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\/[^\n]*/g, '');

const dictionarySource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');
const statusBadgeSource = readFileSync(new URL('../src/components/shared/StatusBadge.tsx', import.meta.url), 'utf8');
const activitiesSource = readFileSync(new URL('../src/pages/Activities.tsx', import.meta.url), 'utf8');
const inventorySource = readFileSync(new URL('../src/pages/InventoryPage.tsx', import.meta.url), 'utf8');

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
  assert.match(source, /count: quotations\.length/);
  assert.match(source, /count: orders\.length/);
  assert.match(source, /count: shipments\.length/);
  assert.match(source, /count: invoices\.length/);
  assert.match(source, /link: '\/shipments'/);
  assert.doesNotMatch(source, /stageInquiry/);
  assert.doesNotMatch(source, /stageSample/);
  assert.doesNotMatch(source, /Inbox/);
  assert.doesNotMatch(source, /FlaskConical/);
});

test('dashboard uses the shared workspace hierarchy and continuous KPI strip', () => {
  assert.match(source, /const WORKSPACE_CARD = 'card overflow-hidden border-gray-200'/);
  assert.match(source, /const WORKSPACE_CARD_HEADER = 'px-4 py-3 border-b border-gray-100 bg-gray-50\/60 flex items-center justify-between min-h-\[52px\]'/);
  assert.match(source, /const WORKSPACE_CARD_TITLE = 'text-base font-semibold text-gray-700 flex items-center gap-2'/);
  assert.match(source, /const WORKSPACE_CARD_BODY = 'p-4'/);
  assert.match(source, /className="metric-strip"/);
  assert.ok((source.match(/className="metric-cell group"/g) || []).length >= 3);
  assert.doesNotMatch(source, /const KPI_CARD/);
  assert.match(source, /data-surface.*status-edge-danger/);
  assert.match(source, /diffDays < 0 \? 'border-l-2 border-l-red-500'/);
});

test('dashboard and inventory overview hide premature zero metrics behind layout skeletons', () => {
  assert.match(source, /function DashboardSkeleton/);
  assert.match(source, /const \[loading, setLoading\] = useState\(true\)/);
  assert.match(source, /Promise\.all\(\[/);
  assert.match(source, /if \(loading\) return <DashboardSkeleton label=\{t\('common\.loading'\)\} \/>/);
  assert.match(source, /role="status"/);
  assert.match(source, /motion-reduce:animate-none/);

  assert.match(inventorySource, /function InventoryDashboardSkeleton/);
  assert.match(inventorySource, /const \[loadingDashboard, setLoadingDashboard\] = useState\(true\)/);
  assert.match(inventorySource, /if \(loadingDashboard\) return <InventoryDashboardSkeleton label=\{t\('common\.loading'\)\} \/>/);
  assert.match(inventorySource, /motion-reduce:animate-none/);
});

test('dashboard pipeline and aging cards expose summary-oriented layouts', () => {
  assert.match(source, /const pipelineTotal = pipeline\.reduce/);
  assert.match(source, /const pipelineMax = Math\.max/);
  assert.match(source, /page\.dashboard\.totalPipelineItems/);
  assert.match(source, /page\.dashboard\.pipelineShare/);
  assert.match(source, /const unpaidWithDueDate = invoices\.filter/);
  assert.match(source, /const totalAgingItems = aging\.reduce/);
  assert.match(source, /page\.dashboard\.trackedReceivables/);
  assert.match(source, /grid grid-cols-1 divide-y divide-gray-100 md:grid-cols-4 md:divide-x md:divide-y-0/);
  assert.match(source, /ArrowRight size=\{15\}/);
  assert.doesNotMatch(source, />→</);
  assert.doesNotMatch(source, /bg-violet-500|bg-emerald-500|bg-slate-400/);
  assert.match(source, /labelKey: 'stagePayment'/);
  assert.doesNotMatch(source, /ml-\[120px\]/);
});

test('dashboard receivable alert shows order numbers instead of invoice numbers', () => {
  assert.match(source, /page\.dashboard\.order/);
  assert.match(source, /inv\.order_number \|\| '—'/);
  assert.doesNotMatch(source, /page\.dashboard\.invoice/);
});

test('dashboard reserves semantic colors for actions and business states', () => {
  assert.match(source, /status-edge-danger/);
  assert.match(source, /text-gray-700">\{inv\.order_number/);
  assert.match(source, /bg-gray-100 text-gray-500/);
  assert.doesNotMatch(source, /stage\.labelKey === 'stagePayment'.*text-red/s);
  assert.match(source, /group-hover:bg-blue-50 group-hover:text-blue-600/);
  assert.match(source, /pctUSD >= 70 \? 'text-yellow-600' : 'text-blue-600'/);
  assert.match(source, /pctUSD >= 70 \? 'bg-yellow-500' : 'bg-blue-500'/);
  assert.doesNotMatch(source, /bg-orange-50|text-orange-600/);
});

test('inventory uses red only for risk, failure, and destructive states', () => {
  assert.match(inventorySource, /stockOutTab'\)\}<\/div>\s*<div className="text-lg font-semibold text-blue-600/s);
  assert.match(inventorySource, /transaction_type === 'stock_out' \? 'bg-blue-50 text-blue-600'/);
  assert.match(inventorySource, /txn\.quantity > 0 \? 'text-green-600' : 'text-blue-600'/);
  assert.match(inventorySource, /btnColor="bg-blue-600" isOut=\{true\}/);
  assert.match(inventorySource, /lowStock\.length > 0 \? 'text-red-600'/);
  assert.match(inventorySource, /setDeleteTarget\(p\).*text-red-600/);
  assert.match(inventorySource, /<ConfirmDialog[\s\S]*onConfirm=\{deleteProduct\}/);
  assert.match(inventorySource, /insufficientInventory.*text-red-700/s);
});

test('shared status badges use consistent success waiting risk and neutral groups', () => {
  assert.match(statusBadgeSource, /const SUCCESS_STATUSES/);
  assert.match(statusBadgeSource, /const WAITING_STATUSES/);
  assert.match(statusBadgeSource, /const RISK_STATUSES/);
  assert.match(statusBadgeSource, /const ACTIVE_STATUSES/);
  assert.match(statusBadgeSource, /bg-green-50 text-green-700/);
  assert.match(statusBadgeSource, /bg-yellow-50 text-yellow-700/);
  assert.match(statusBadgeSource, /bg-red-50 text-red-700/);
  assert.match(statusBadgeSource, /bg-blue-50 text-blue-700/);
});

test('workspace and activity feeds use stable shared empty states', () => {
  assert.ok((source.match(/className="empty-state"/g) || []).length >= 4);
  assert.match(activitiesSource, /className="empty-state"/);
});

test('workspace labels follow sentence case and shared table density', () => {
  assert.ok((source.match(/className="table-header/g) || []).length >= 6);
  assert.ok((source.match(/className="section-label/g) || []).length >= 3);
  assert.doesNotMatch(source, /uppercase tracking-\[0\.08em\]/);
});

test('workspace receivables and monthly performance use balanced columns', () => {
  assert.match(source, /<table className="w-full min-w-\[760px\] table-fixed text-sm">/);
  assert.match(source, /<col className="w-\[25%\]"/);
  assert.ok((source.match(/<col className="w-\[15%\]"/g) || []).length >= 3);
  assert.match(source, /<col className="w-\[10%\]"/);
  assert.match(source, /<col className="w-\[20%\]"/);
  assert.match(source, /className="grid grid-cols-1 gap-6 lg:grid-cols-2"/);
  assert.doesNotMatch(source, /lg:col-span-1|lg:col-span-2/);
});
