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
  assert.match(source, /const activeShipments = shipments\.filter/);
  assert.match(source, /const activeOrders = orders\.filter/);
  assert.match(source, /count: openQuotes\.length/);
  assert.match(source, /count: activeOrders\.length/);
  assert.match(source, /count: activeShipments\.length/);
  assert.match(source, /count: unpaid\.length/);
  assert.match(source, /link: '\/shipments'/);
  assert.doesNotMatch(source, /stageInquiry/);
  assert.doesNotMatch(source, /stageSample/);
  assert.doesNotMatch(source, /Inbox/);
  assert.doesNotMatch(source, /FlaskConical/);
});

test('dashboard uses the shared workspace hierarchy and continuous KPI strip', () => {
  assert.match(source, /const WORKSPACE_CARD = 'card overflow-hidden shadow-\[var\(--shadow-card\)\]'/);
  assert.match(source, /const WORKSPACE_CARD_HEADER = 'flex min-h-\[52px\] items-center justify-between border-b border-border bg-surface-subtle px-4 py-3'/);
  assert.match(source, /const WORKSPACE_CARD_TITLE = 'flex items-center gap-2 text-base font-semibold text-ink'/);
  assert.match(source, /const WORKSPACE_CARD_BODY = 'p-4'/);
  assert.match(source, /className="metric-strip"/);
  assert.ok((source.match(/className="metric-cell group/g) || []).length >= 3);
  assert.doesNotMatch(source, /const KPI_CARD/);
  assert.match(source, /data-surface.*status-edge-danger/);
  assert.match(source, /diffDays < 0 \? 'border-l-2 border-l-danger'/);
});

test('dashboard and inventory overview hide premature zero metrics behind layout skeletons', () => {
  assert.match(source, /function DashboardSkeleton/);
  assert.match(source, /const \[loading, setLoading\] = useState\(true\)/);
  assert.match(source, /Promise\.all\(\[/);
  assert.match(source, /if \(loading\) return <DashboardSkeleton label=\{t\('common\.loading'\)\} \/>/);
  assert.match(source, /role="status"/);
  assert.match(source, /motion-reduce:animate-none/);

  assert.match(inventorySource, /function InventoryDashboardSkeleton/);
  assert.match(inventorySource, /<InventoryDashboardSkeleton label=\{t\('common\.loading'\)\} \/>/);
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
  assert.match(source, /grid grid-cols-1 divide-y divide-border md:grid-cols-4 md:divide-x md:divide-y-0/);
  assert.match(source, /ArrowRight size=\{15\}/);
  assert.doesNotMatch(source, />→</);
  assert.doesNotMatch(source, /bg-violet-500|bg-emerald-500|bg-slate-400/);
  assert.match(source, /labelKey: 'stagePayment'/);
  assert.doesNotMatch(source, /ml-\[120px\]/);
});

test('dashboard monthly sales use confirmed orders and actionable empty states', () => {
  assert.match(source, /const closedOrderStatuses = new Set/);
  assert.match(source, /const thisMonthClosedOrders = orders\.filter/);
  assert.match(source, /o\.order_date \|\| o\.created_at/);
  assert.match(source, /const salesRows = Object\.entries\(salesByCurrency\)/);
  assert.doesNotMatch(source, /combinedDeals|thisMonthQuotes/);
  assert.match(source, /salesRows\.length > 0/);
  assert.match(source, /to="\/quotations"/);
  assert.match(source, /to="\/orders"/);
  assert.match(source, /topCustomers\.length > 0 \? 'lg:grid-cols-2' : ''/);
  assert.match(source, /c\.companyId/);
});

test('dashboard receivable alert shows order numbers instead of invoice numbers', () => {
  assert.match(source, /page\.dashboard\.order/);
  assert.match(source, /inv\.order_number \|\| '—'/);
  assert.doesNotMatch(source, /page\.dashboard\.invoice/);
});

test('dashboard reserves semantic colors for actions and business states', () => {
  assert.match(source, /status-edge-danger/);
  assert.match(source, /text-ink-muted">\{inv\.order_number/);
  assert.match(source, /text-ink-muted bg-surface-hover/);
  assert.doesNotMatch(source, /stage\.labelKey === 'stagePayment'.*text-red/s);
  assert.match(source, /bg-stage-quotation-soft text-stage-quotation/);
  assert.match(source, /row\.percentage >= 70 \? 'text-warning' : 'text-brand'/);
  assert.match(source, /row\.percentage === null \? 'text-ink-subtle'/);
  assert.doesNotMatch(source, /bg-orange-50|text-orange-600/);
});

test('inventory movements use semantic risk and success states', () => {
  assert.match(inventorySource, /Number\(movement\.quantity_delta\) < 0 \? 'text-danger' : 'text-success'/);
});

test('shared status badges use consistent success waiting risk and neutral groups', () => {
  assert.match(statusBadgeSource, /const SUCCESS_STATUSES/);
  assert.match(statusBadgeSource, /const WAITING_STATUSES/);
  assert.match(statusBadgeSource, /const RISK_STATUSES/);
  assert.match(statusBadgeSource, /const ACTIVE_STATUSES/);
  assert.match(statusBadgeSource, /bg-success-soft text-success/);
  assert.match(statusBadgeSource, /bg-warning-soft text-warning/);
  assert.match(statusBadgeSource, /bg-danger-soft text-danger/);
  assert.match(statusBadgeSource, /bg-brand-soft text-brand/);
  assert.match(statusBadgeSource, /bg-surface-hover text-ink-muted/);
  assert.match(statusBadgeSource, /rounded-full/);
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
