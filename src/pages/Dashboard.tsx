import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, AlertTriangle, ArrowRight, Award, CheckCircle, FileText, ReceiptText, Workflow, TrendingUp, CalendarClock, Inbox, FlaskConical, Truck, Wallet } from 'lucide-react';
import { formatCurrency } from '../lib/currency';
import { useTranslation } from 'react-i18next';

const WORKSPACE_CARD = 'card overflow-hidden border-gray-200';
const WORKSPACE_CARD_HEADER = 'px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between min-h-[52px]';
const WORKSPACE_CARD_TITLE = 'text-base font-semibold text-gray-700 flex items-center gap-2';
const WORKSPACE_CARD_BODY = 'p-4';

function DashboardSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="page-shell space-y-6">
      <div aria-hidden="true" className="animate-pulse space-y-6 motion-reduce:animate-none">
        <div>
          <div className="h-7 w-40 rounded bg-gray-200" />
          <div className="mt-2 h-3 w-64 max-w-full rounded bg-gray-100" />
        </div>
        <div className="metric-strip">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="metric-cell">
              <div className="h-3 w-28 rounded bg-gray-100" />
              <div className="mt-5 h-8 w-24 rounded bg-gray-200" />
              <div className="mt-2 h-3 w-20 rounded bg-gray-100" />
            </div>
          ))}
        </div>
        <div className="data-surface h-64">
          <div className="h-14 border-b border-gray-200 bg-white px-4 py-4">
            <div className="h-4 w-48 rounded bg-gray-200" />
          </div>
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-8 rounded bg-gray-100" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-56 rounded-md border border-gray-200 bg-white" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [samples, setSamples] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/payments').then(r => r.json()).then(setInvoices).catch(() => {}),
      fetch('/api/orders').then(r => r.json()).then(setOrders).catch(() => {}),
      fetch('/api/quotations').then(r => r.json()).then(setQuotations).catch(() => {}),
      fetch('/api/inquiries').then(r => r.json()).then(setInquiries).catch(() => {}),
      fetch('/api/sample-requests').then(r => r.json()).then(setSamples).catch(() => {}),
      fetch('/api/shipments').then(r => r.json()).then(setShipments).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton label={t('common.loading')} />;

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  // Outstanding Receivables
  const unpaid = invoices.filter((i: any) => i.status !== 'paid' && i.status !== 'cancelled');
  const outstandingUSD = unpaid.filter((i: any) => !i.currency || i.currency === 'USD')
    .reduce((s: number, i: any) => s + (i.amount_due || i.total || 0), 0);
  const outstandingCNY = unpaid.filter((i: any) => i.currency === 'CNY')
    .reduce((s: number, i: any) => s + (i.amount_due || i.total || 0), 0);

  // Overdue Receivables
  const overdue = invoices.filter((i: any) => {
    if (i.status === 'paid' || i.status === 'cancelled') return false;
    return new Date(i.due_date) < now;
  });
  const overdueUSD = overdue.filter((i: any) => !i.currency || i.currency === 'USD')
    .reduce((s: number, i: any) => s + (i.amount_due || i.total || 0), 0);
  const overdueCNY = overdue.filter((i: any) => i.currency === 'CNY')
    .reduce((s: number, i: any) => s + (i.amount_due || i.total || 0), 0);

  const openOrders = orders.filter((o: any) => o.status !== 'delivered' && o.status !== 'cancelled');
  const openQuotes = quotations.filter((q: any) =>
    ['draft', 'sent', 'negotiating', 'pending_approval'].includes(q.status)
  );

  const formatWithCurrency = (usd: number, cny: number) => {
    const parts: string[] = [];
    if (usd > 0) parts.push(formatCurrency(usd, 'USD'));
    if (cny > 0) parts.push(formatCurrency(cny, 'CNY'));
    return parts.join(' · ') || '$0';
  };

  // Sales Pipeline
  const pipeline = [
    { labelKey: 'stageInquiry', count: inquiries.length, link: '/inquiries', icon: Inbox },
    { labelKey: 'stageQuotation', count: quotations.length, link: '/quotations', icon: FileText },
    { labelKey: 'stageSample', count: samples.length, link: '/samples', icon: FlaskConical },
    { labelKey: 'stageShipment', count: shipments.length, link: '/shipments', icon: Truck },
    { labelKey: 'stagePayment', count: invoices.length, link: '/payments', icon: Wallet },
  ];
  const pipelineTotal = pipeline.reduce((sum, stage) => sum + stage.count, 0);
  const pipelineMax = Math.max(...pipeline.map(stage => stage.count), 1);

  // Monthly Performance — accepted quotations + active orders
  const thisMonthQuotes = quotations.filter((q: any) => {
    if (q.status !== 'accepted') return false;
    const d = new Date(q.accepted_at || q.updated_at);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  const thisMonthOrders = orders.filter((o: any) => {
    if (o.status === 'draft' || o.status === 'cancelled') return false;
    const d = new Date(o.created_at);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });

  // Combine: use orders first (higher authority), skip quotes that already became orders
  const quoteOrderIds = new Set(thisMonthOrders.filter((o: any) => o.quotation_id).map((o: any) => o.quotation_id));
  const standaloneQuotes = thisMonthQuotes.filter((q: any) => !quoteOrderIds.has(q.id));

  const combinedDeals = [
    ...thisMonthOrders.map((o: any) => ({
      company_name: o.company_name, currency: o.currency || 'USD', total: o.total || 0,
    })),
    ...standaloneQuotes.map((q: any) => ({
      company_name: q.company_name, currency: q.currency || 'USD', total: q.total || 0,
    })),
  ];

  const actualUSD = combinedDeals.filter((d: any) => !d.currency || d.currency === 'USD')
    .reduce((s: number, d: any) => s + d.total, 0);
  const actualCNY = combinedDeals.filter((d: any) => d.currency === 'CNY')
    .reduce((s: number, d: any) => s + d.total, 0);
  const targetUSD = 50000;
  const targetCNY = 500000;
  const pctUSD = targetUSD > 0 ? Math.round((actualUSD / targetUSD) * 100) : 0;

  // Top Customers
  const byCompany: Record<string, { total: number; currency: string; count: number; id: string }> = {};
  combinedDeals.forEach((d: any) => {
    const key = d.company_name || t('page.dashboard.unknownCustomer');
    if (!byCompany[key]) byCompany[key] = { total: 0, currency: d.currency || 'USD', count: 0, id: key };
    byCompany[key].total += d.total;
    byCompany[key].count += 1;
  });
  const topCustomers = Object.entries(byCompany).map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total).slice(0, 5);

  const agingBuckets = [
    { label: t('page.dashboard.days0to30'), min: 0, max: 30, bar: 'bg-blue-200' },
    { label: t('page.dashboard.days31to60'), min: 31, max: 60, bar: 'bg-blue-400' },
    { label: t('page.dashboard.days61to90'), min: 61, max: 90, bar: 'bg-blue-600' },
    { label: t('page.dashboard.days90Plus'), min: 91, max: Infinity, bar: 'bg-red-500' },
  ];
  const unpaidWithDueDate = invoices.filter((i: any) => i.status !== 'paid' && i.status !== 'cancelled' && i.due_date);
  const aging = agingBuckets.map(bucket => {
    const items = unpaidWithDueDate.filter((inv: any) => {
      const days = Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / 86400000);
      return days >= bucket.min && days <= bucket.max;
    });
    return { ...bucket, items,
      usdTotal: items.filter((i: any) => !i.currency || i.currency === 'USD').reduce((s: number, i: any) => s + (i.amount_due || i.total || 0), 0),
      cnyTotal: items.filter((i: any) => i.currency === 'CNY').reduce((s: number, i: any) => s + (i.amount_due || i.total || 0), 0),
    };
  });
  const totalAgingItems = aging.reduce((sum, bucket) => sum + bucket.items.length, 0);

  return (
    <div className="page-shell space-y-6">
      {/* Header */}
      <div className="page-header mb-0">
        <div>
          <h1 className="page-heading">{t('page.title.dashboard')}</h1>
          <p className="page-summary">
            {t('page.dashboard.activeOrdersSummary', { count: openOrders.length })} · {t('page.dashboard.openQuotationsSummary', { count: openQuotes.length })}
          </p>
        </div>
      </div>

      {/* 1. KPI Row */}
      <div className="metric-strip">
        <Link to="/payments" className="metric-cell group">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-450 text-gray-500">{t('page.dashboard.outstandingReceivables')}</span>
            <Wallet size={16} strokeWidth={1.75} className="text-gray-300 transition-colors group-hover:text-blue-500" />
          </div>
          <div className="mt-4 text-3xl font-semibold tabular-nums text-gray-900">{formatWithCurrency(outstandingUSD, outstandingCNY)}</div>
          <div className="mt-1 text-2xs text-gray-400">{t('page.dashboard.unpaidInvoices', { count: unpaid.length })}</div>
        </Link>
        <Link to="/payments" className="metric-cell group">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-450 text-gray-500">{t('page.dashboard.overdueReceivables')}</span>
            <AlertCircle size={16} strokeWidth={1.75} className={overdue.length > 0 ? 'text-red-500' : 'text-gray-300'} />
          </div>
          <div className={`mt-4 text-3xl font-semibold tabular-nums ${overdue.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>{formatWithCurrency(overdueUSD, overdueCNY)}</div>
          <div className={`mt-1 text-2xs ${overdue.length > 0 ? 'text-red-500' : 'text-gray-400'}`}>{t('page.dashboard.overdueInvoices', { count: overdue.length })}</div>
        </Link>
        <Link to="/orders" className="metric-cell group">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-450 text-gray-500">{t('page.dashboard.openOrders')}</span>
            <ReceiptText size={16} strokeWidth={1.75} className="text-gray-300 transition-colors group-hover:text-blue-500" />
          </div>
          <div className="mt-4 text-3xl font-semibold tabular-nums text-gray-900">{openOrders.length}</div>
          <div className="mt-1 text-2xs text-gray-400">{t('page.dashboard.notYetDelivered')}</div>
        </Link>
        <Link to="/quotations" className="metric-cell group">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-450 text-gray-500">{t('page.dashboard.openQuotations')}</span>
            <FileText size={16} strokeWidth={1.75} className="text-gray-300 transition-colors group-hover:text-blue-500" />
          </div>
          <div className="mt-4 text-3xl font-semibold tabular-nums text-gray-900">{openQuotes.length}</div>
          <div className="mt-1 text-2xs text-gray-400">{t('page.dashboard.awaitingDecision')}</div>
        </Link>
      </div>

      {/* 2. Accounts Receivable Alert */}
      <div className={`data-surface ${overdue.length > 0 ? 'status-edge-danger' : 'border-gray-300'}`}>
        <div className="flex min-h-[56px] items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <div>
            <h2 className={WORKSPACE_CARD_TITLE}><ReceiptText size={18} strokeWidth={1.75} className={overdue.length > 0 ? 'text-red-500' : 'text-gray-500'} />{t('page.dashboard.accountsReceivableAlert')}</h2>
            <p className="mt-1 text-2xs text-gray-400">{t('page.dashboard.unpaidInvoices', { count: unpaid.length })} · {t('page.dashboard.overdueInvoices', { count: overdue.length })}</p>
          </div>
          <Link to="/payments" className="text-xs text-blue-600 hover:underline">{t('page.dashboard.viewAll')}</Link>
        </div>
            <div className="space-y-2 p-3 md:hidden">
              {unpaid.slice().sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()).slice(0, 10).map((inv: any) => {
                const diffDays = Math.ceil((new Date(inv.due_date).getTime() - now.getTime()) / 86400000);
                let statusLabel: string, statusColor: string;
                let StatusIcon: React.ComponentType<any> = AlertCircle;
                if (diffDays < 0) { statusLabel = t('page.dashboard.overdue'); statusColor = 'text-red-700 bg-red-50'; StatusIcon = AlertCircle; }
                else if (diffDays <= 7) { statusLabel = diffDays === 0 ? t('page.dashboard.dueToday') : t('page.dashboard.dueSoon'); statusColor = 'text-yellow-700 bg-yellow-50'; StatusIcon = AlertTriangle; }
                else { statusLabel = t('page.dashboard.normal'); statusColor = 'text-gray-500 bg-gray-100'; StatusIcon = CheckCircle; }
                return (
                  <div key={inv.id} className={`rounded-md border border-gray-200 bg-white p-3 ${diffDays < 0 ? 'border-l-2 border-l-red-500' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-800">{inv.company_name || '—'}</p>
                        <p className="mt-1 text-xs tabular-nums text-gray-500">{inv.order_number || '—'} · {inv.currency || 'USD'}</p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">{formatCurrency(inv.amount_due || inv.total, inv.currency)}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3 text-xs">
                      <div>
                        <p className="section-label">{t('page.dashboard.dueDate')}</p>
                        <p className="mt-1 text-gray-600">{inv.due_date?.slice(0, 10) || '—'}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-450 ${statusColor}`}>
                        <StatusIcon size={12} strokeWidth={1.75} />{statusLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
              {unpaid.length === 0 && <div className="empty-state">{t('page.dashboard.allInvoicesPaid')}</div>}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] table-fixed text-sm">
            <colgroup>
              <col className="w-[25%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
              <col className="w-[10%]" />
              <col className="w-[15%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="table-header">{t('page.dashboard.customer')}</th>
                <th className="table-header">{t('page.dashboard.order')}</th>
                <th className="table-header text-right">{t('page.dashboard.amount')}</th>
                <th className="table-header text-center">{t('page.dashboard.currencyShort')}</th>
                <th className="table-header">{t('page.dashboard.dueDate')}</th>
                <th className="table-header text-center">{t('page.dashboard.status')}</th>
              </tr>
            </thead>
            <tbody>
              {unpaid.slice().sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()).slice(0, 10).map((inv: any) => {
                const diffDays = Math.ceil((new Date(inv.due_date).getTime() - now.getTime()) / 86400000);
                let statusLabel: string, statusColor: string;
                let StatusIcon: React.ComponentType<any> = AlertCircle;
                if (diffDays < 0) { statusLabel = t('page.dashboard.overdue'); statusColor = 'text-red-700 bg-red-50'; StatusIcon = AlertCircle; }
                else if (diffDays <= 7) { statusLabel = diffDays === 0 ? t('page.dashboard.dueToday') : t('page.dashboard.dueSoon'); statusColor = 'text-yellow-700 bg-yellow-50'; StatusIcon = AlertTriangle; }
                else { statusLabel = t('page.dashboard.normal'); statusColor = 'text-gray-500 bg-gray-100'; StatusIcon = CheckCircle; }
                return (
                  <tr key={inv.id} className={`border-b border-gray-100 transition-colors hover:bg-gray-50 ${diffDays < 0 ? 'border-l-2 border-l-red-500' : 'border-l-2 border-l-transparent'}`}>
                    <td className="px-3 py-2 text-xs text-gray-700 max-w-[120px] truncate">{inv.company_name || '—'}</td>
                    <td className="px-3 py-2 text-xs tabular-nums font-medium text-gray-700">{inv.order_number || '—'}</td>
                    <td className="px-3 py-2 text-xs tabular-nums text-right">{formatCurrency(inv.amount_due || inv.total, inv.currency)}</td>
                    <td className="px-3 py-2 text-2xs text-center text-gray-400">{inv.currency || 'USD'}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{inv.due_date?.slice(0, 10)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-450 ${statusColor}`}><StatusIcon size={12} strokeWidth={1.75} />{statusLabel}</span>
                    </td>
                  </tr>
                );
              })}
              {unpaid.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-sm text-gray-400">{t('page.dashboard.allInvoicesPaid')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Sales Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={WORKSPACE_CARD}>
          <div className={WORKSPACE_CARD_HEADER}>
            <h2 className={WORKSPACE_CARD_TITLE}><Workflow size={18} strokeWidth={1.75} className="text-gray-500" />{t('page.dashboard.salesPipeline')}</h2>
            <span className="rounded bg-white px-2 py-1 text-2xs font-450 text-gray-500 ring-1 ring-gray-200">
              {t('page.dashboard.totalPipelineItems', { count: pipelineTotal })}
            </span>
          </div>
          <div>
            <div className="divide-y divide-gray-100">
              {pipeline.map(stage => {
                const share = pipelineTotal > 0 ? Math.round((stage.count / pipelineTotal) * 100) : 0;
                const width = stage.count > 0 ? Math.max(4, Math.round((stage.count / pipelineMax) * 100)) : 0;
                return (
                  <Link key={stage.labelKey} to={stage.link} className="group block px-4 py-3 transition-colors hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-600">
                        <stage.icon size={17} strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <span className="truncate text-xs font-medium text-gray-700">{t(`page.dashboard.${stage.labelKey}`)}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-2xs font-450 text-gray-400">{t('page.dashboard.pipelineShare', { percent: share })}</span>
                            <span className="min-w-7 text-right text-sm font-semibold text-gray-700">{stage.count}</span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                      <ArrowRight size={15} strokeWidth={1.75} className="text-gray-300 transition-colors group-hover:text-gray-600" />
                    </div>
                  </Link>
                );
              })}
            </div>
            {pipelineTotal === 0 && <p className="empty-state">{t('page.dashboard.noActiveDeals')}</p>}
          </div>
        </div>

        {/* Recent Inquiries */}
        <div className={WORKSPACE_CARD}>
          <div className={WORKSPACE_CARD_HEADER}>
            <h2 className={WORKSPACE_CARD_TITLE}><Inbox size={18} strokeWidth={1.75} className="text-gray-500" />{t('page.dashboard.recentInquiries')}</h2>
            <Link to="/inquiries" className="text-xs text-blue-600 hover:underline">{t('page.dashboard.viewAll')}</Link>
          </div>
          <div className={WORKSPACE_CARD_BODY}>
            {inquiries.length === 0 ? (
              <p className="empty-state">{t('page.dashboard.noInquiries')}</p>
            ) : (
              <div className="space-y-1">
                {inquiries.slice(0, 5).map((inq: any) => (
                  <Link key={inq.id} to={`/inquiries/${inq.id}`} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50">
                    <Inbox size={16} strokeWidth={1.75} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{inq.inquiry_number} — {inq.company_name}</p>
                      <p className="text-2xs text-gray-400">{inq.target_material_requested || '—'} · {inq.urgency?.replace(/_/g, ' ')}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Monthly Performance */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className={WORKSPACE_CARD}>
          <div className={WORKSPACE_CARD_HEADER}>
            <h2 className={WORKSPACE_CARD_TITLE}><TrendingUp size={18} strokeWidth={1.75} className="text-gray-500" />{t('page.dashboard.thisMonthSales')}</h2>
          </div>
          <div className={WORKSPACE_CARD_BODY}>
            <div className="flex items-center justify-between mb-2">
              <span className="section-label">{t('page.dashboard.currency')}</span>
              <span className="section-label">{t('page.dashboard.target')}</span>
              <span className="section-label">{t('page.dashboard.actual')}</span>
              <span className="section-label">%</span>
            </div>
            {actualUSD > 0 && (
              <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
                <span className="text-xs font-medium text-gray-600">USD</span>
                <span className="text-xs tabular-nums text-gray-500">{formatCurrency(targetUSD, 'USD')}</span>
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(actualUSD, 'USD')}</span>
                <span className={`text-xs font-semibold ${pctUSD >= 100 ? 'text-green-600' : pctUSD >= 70 ? 'text-yellow-600' : 'text-blue-600'}`}>{pctUSD}%</span>
              </div>
            )}
            {actualCNY > 0 && (
              <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
                <span className="text-xs font-medium text-gray-600">CNY</span>
                <span className="text-xs tabular-nums text-gray-500">{formatCurrency(targetCNY, 'CNY')}</span>
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(actualCNY, 'CNY')}</span>
                <span className="text-xs font-semibold">{Math.round((actualCNY / targetCNY) * 100)}%</span>
              </div>
            )}
            {actualUSD === 0 && actualCNY === 0 && <p className="empty-state min-h-24">{t('page.dashboard.noClosedSalesThisMonth')}</p>}
            {(actualUSD > 0 || actualCNY > 0) && (
              <div className="mt-3">
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${pctUSD >= 100 ? 'bg-green-500' : pctUSD >= 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(100, Math.max(2, pctUSD))}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={WORKSPACE_CARD}>
          <div className={WORKSPACE_CARD_HEADER}>
            <h2 className={WORKSPACE_CARD_TITLE}><Award size={18} strokeWidth={1.75} className="text-gray-500" />{t('page.dashboard.topCustomersThisMonth')}</h2>
          </div>
          <div className={WORKSPACE_CARD_BODY}>
            {topCustomers.length > 0 ? (
              <div className="space-y-2">
                {topCustomers.map((c, idx) => (
                  <div key={c.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                    {idx === 0 ? <Award size={18} strokeWidth={1.75} className="text-yellow-500 flex-shrink-0" /> :
                     idx === 1 ? <Award size={18} strokeWidth={1.75} className="text-gray-400 flex-shrink-0" /> :
                     idx === 2 ? <Award size={18} strokeWidth={1.75} className="text-orange-500 flex-shrink-0" /> :
                     <span className="w-6 h-6 flex items-center justify-center text-xs font-medium text-gray-300">{idx + 1}</span>}
                    <span className="flex-1 text-sm text-gray-700 truncate">{c.name}</span>
                    <span className="text-xs text-gray-400">{t('page.dashboard.deals', { count: c.count })}</span>
                    <span className="text-sm tabular-nums font-semibold text-gray-900">{formatCurrency(c.total, c.currency)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">{t('page.dashboard.noClosedSalesThisMonth')}</p>
            )}
          </div>
        </div>
      </div>

      {/* 5. Receivable Aging */}
      <div className={WORKSPACE_CARD}>
        <div className={WORKSPACE_CARD_HEADER}>
          <h2 className={WORKSPACE_CARD_TITLE}><CalendarClock size={18} strokeWidth={1.75} className="text-gray-500" />{t('page.dashboard.receivableAging')}</h2>
          <span className="text-2xs font-450 text-gray-400">{t('page.dashboard.trackedReceivables', { count: unpaidWithDueDate.length })}</span>
        </div>
        <div>
          {unpaid.length > 0 && (
            <div className="border-b border-gray-100 px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-4">
                <span className="text-xs text-gray-500">{t('page.dashboard.outstandingReceivables')}</span>
                <span className="text-sm tabular-nums font-semibold text-gray-900">{formatWithCurrency(outstandingUSD, outstandingCNY)}</span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-gray-100">
                {aging.map(bucket => (
                  <div key={bucket.label} className={bucket.bar} style={{ width: `${totalAgingItems > 0 ? (bucket.items.length / totalAgingItems) * 100 : 0}%` }} />
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 divide-y divide-gray-100 md:grid-cols-4 md:divide-x md:divide-y-0">
            {aging.map(b => {
              return (
                <div key={b.label} className="min-w-0 p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{b.label}</p>
                      <p className="mt-0.5 text-2xs text-gray-400">{t('page.dashboard.agingBucketInvoices', { count: b.items.length })}</p>
                    </div>
                    <div className="text-right">
                      {b.usdTotal > 0 && <p className="text-xs tabular-nums font-semibold text-gray-900">{formatCurrency(b.usdTotal, 'USD')}</p>}
                      {b.cnyTotal > 0 && <p className="text-xs tabular-nums font-semibold text-gray-900">{formatCurrency(b.cnyTotal, 'CNY')}</p>}
                      {b.usdTotal === 0 && b.cnyTotal === 0 && <p className="text-xs text-gray-300">—</p>}
                    </div>
                  </div>
                  {b.items.length > 0 ? (
                    <div className="space-y-1">
                      {b.items.slice(0, 4).map((inv: any) => (
                        <div key={inv.id} className="flex items-center justify-between gap-3 text-2xs text-gray-500">
                          <span className="min-w-0 truncate">{inv.company_name || inv.invoice_number}</span>
                          <span className="flex-shrink-0 tabular-nums">{formatCurrency(inv.amount_due || inv.total, inv.currency)}</span>
                        </div>
                      ))}
                      {b.items.length > 4 && <div className="text-2xs text-gray-400">{t('page.dashboard.more', { count: b.items.length - 4 })}</div>}
                    </div>
                  ) : (
                    <p className="text-2xs text-gray-400">{t('page.dashboard.agingNoInvoices')}</p>
                  )}
                </div>
              );
            })}
          </div>
          {unpaid.length === 0 && (
            <p className="empty-state">{t('page.dashboard.noOutstandingReceivables')}</p>
          )}
        </div>
      </div>

      {/* 6. Recent Quotations */}
      <div className={WORKSPACE_CARD}>
        <div className={WORKSPACE_CARD_HEADER}>
          <h2 className={WORKSPACE_CARD_TITLE}><FileText size={18} strokeWidth={1.75} className="text-gray-500" />{t('page.dashboard.recentQuotations')}</h2>
          <Link to="/quotations" className="text-xs text-blue-600 hover:underline">{t('page.dashboard.viewAll')}</Link>
        </div>
        <div className={WORKSPACE_CARD_BODY}>
          {quotations.length === 0 ? (
            <p className="empty-state">{t('page.dashboard.noQuotations')}</p>
          ) : (
            <div className="space-y-1">
              {quotations.slice(0, 5).map((q: any) => (
                <Link key={q.id} to={`/quotations/${q.id}`} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50">
                  <FileText size={16} strokeWidth={1.75} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{q.quotation_number} — {q.company_name}</p>
                    <p className="text-2xs text-gray-400">{q.status?.replace(/_/g, ' ')} · {formatCurrency(q.total || 0, q.currency)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
