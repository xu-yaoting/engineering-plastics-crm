import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, AlertTriangle, Award, CheckCircle, FileText, ReceiptText, Workflow, TrendingUp, CalendarClock, Inbox, FlaskConical, Truck, Wallet } from 'lucide-react';
import { formatCurrency } from '../lib/currency';
import { useTranslation } from 'react-i18next';

const WORKSPACE_CARD = 'card overflow-hidden border-gray-200';
const WORKSPACE_CARD_HEADER = 'px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between min-h-[52px]';
const WORKSPACE_CARD_TITLE = 'text-base font-semibold text-gray-700 flex items-center gap-2';
const WORKSPACE_CARD_BODY = 'p-4';
const KPI_CARD = 'card p-4 border-gray-200 hover:border-gray-300 transition-colors min-h-[120px] flex flex-col justify-between';

export default function Dashboard() {
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [samples, setSamples] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/payments').then(r => r.json()).then(setInvoices).catch(() => {});
    fetch('/api/orders').then(r => r.json()).then(setOrders).catch(() => {});
    fetch('/api/quotations').then(r => r.json()).then(setQuotations).catch(() => {});
    fetch('/api/inquiries').then(r => r.json()).then(setInquiries).catch(() => {});
    fetch('/api/sample-requests').then(r => r.json()).then(setSamples).catch(() => {});
    fetch('/api/shipments').then(r => r.json()).then(setShipments).catch(() => {});
  }, []);

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
    { labelKey: 'stageInquiry', count: inquiries.length, link: '/inquiries', icon: Inbox, bar: 'bg-slate-400', tone: 'bg-slate-50 text-slate-500' },
    { labelKey: 'stageQuotation', count: quotations.length, link: '/quotations', icon: FileText, bar: 'bg-blue-500', tone: 'bg-blue-50 text-blue-600' },
    { labelKey: 'stageSample', count: samples.length, link: '/samples', icon: FlaskConical, bar: 'bg-violet-500', tone: 'bg-violet-50 text-violet-600' },
    { labelKey: 'stageShipment', count: shipments.length, link: '/shipments', icon: Truck, bar: 'bg-emerald-500', tone: 'bg-emerald-50 text-emerald-600' },
    { labelKey: 'stagePayment', count: invoices.length, link: '/payments', icon: Wallet, bar: 'bg-red-500', tone: 'bg-red-50 text-red-600' },
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
    { label: t('page.dashboard.days0to30'), min: 0, max: 30, bar: 'bg-green-500' },
    { label: t('page.dashboard.days31to60'), min: 31, max: 60, bar: 'bg-yellow-500' },
    { label: t('page.dashboard.days61to90'), min: 61, max: 90, bar: 'bg-orange-500' },
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
  const maxAgingCount = Math.max(...aging.map(bucket => bucket.items.length), 1);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{t('page.title.dashboard')}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t('page.dashboard.activeOrdersSummary', { count: openOrders.length })} · {t('page.dashboard.openQuotationsSummary', { count: openQuotes.length })}
        </p>
      </div>

      {/* 1. KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/payments" className={KPI_CARD}>
          <div className="mb-2">
            <span className="text-xs text-gray-500 font-medium">{t('page.dashboard.outstandingReceivables')}</span>
          </div>
          <div className="text-3xl font-semibold text-gray-900">{formatWithCurrency(outstandingUSD, outstandingCNY)}</div>
          <div className="text-2xs text-gray-400 mt-1">{t('page.dashboard.unpaidInvoices', { count: unpaid.length })}</div>
        </Link>
        <Link to="/payments" className={KPI_CARD}>
          <div className="mb-2">
            <span className="text-xs text-gray-500 font-medium">{t('page.dashboard.overdueReceivables')}</span>
          </div>
          <div className="text-3xl font-semibold text-red-600">{formatWithCurrency(overdueUSD, overdueCNY)}</div>
          <div className="text-2xs text-red-500 mt-1">{t('page.dashboard.overdueInvoices', { count: overdue.length })}</div>
        </Link>
        <Link to="/orders" className={KPI_CARD}>
          <div className="mb-2">
            <span className="text-xs text-gray-500 font-medium">{t('page.dashboard.openOrders')}</span>
          </div>
          <div className="text-3xl font-semibold text-blue-600">{openOrders.length}</div>
          <div className="text-2xs text-gray-400 mt-1">{t('page.dashboard.notYetDelivered')}</div>
        </Link>
        <Link to="/quotations" className={KPI_CARD}>
          <div className="mb-2">
            <span className="text-xs text-gray-500 font-medium">{t('page.dashboard.openQuotations')}</span>
          </div>
          <div className="text-3xl font-semibold text-yellow-600">{openQuotes.length}</div>
          <div className="text-2xs text-gray-400 mt-1">{t('page.dashboard.awaitingDecision')}</div>
        </Link>
      </div>

      {/* 2. Accounts Receivable Alert */}
      <div className={WORKSPACE_CARD}>
        <div className={WORKSPACE_CARD_HEADER}>
          <h2 className={WORKSPACE_CARD_TITLE}><ReceiptText size={18} strokeWidth={1.75} className="text-gray-500" />{t('page.dashboard.accountsReceivableAlert')}</h2>
          <Link to="/payments" className="text-xs text-blue-600 hover:underline">{t('page.dashboard.viewAll')}</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-2xs font-450 text-gray-500 uppercase tracking-[0.08em] px-3 py-2">{t('page.dashboard.customer')}</th>
                <th className="text-left text-2xs font-450 text-gray-500 uppercase tracking-[0.08em] px-3 py-2">{t('page.dashboard.order')}</th>
                <th className="text-right text-2xs font-450 text-gray-500 uppercase tracking-[0.08em] px-3 py-2">{t('page.dashboard.amount')}</th>
                <th className="text-center text-2xs font-450 text-gray-500 uppercase tracking-[0.08em] px-3 py-2">{t('page.dashboard.currencyShort')}</th>
                <th className="text-left text-2xs font-450 text-gray-500 uppercase tracking-[0.08em] px-3 py-2">{t('page.dashboard.dueDate')}</th>
                <th className="text-center text-2xs font-450 text-gray-500 uppercase tracking-[0.08em] px-3 py-2">{t('page.dashboard.status')}</th>
              </tr>
            </thead>
            <tbody>
              {unpaid.slice().sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()).slice(0, 10).map((inv: any) => {
                const diffDays = Math.ceil((new Date(inv.due_date).getTime() - now.getTime()) / 86400000);
                let statusLabel: string, statusColor: string;
                let StatusIcon: React.ComponentType<any> = AlertCircle;
                if (diffDays < 0) { statusLabel = t('page.dashboard.overdue'); statusColor = 'text-red-600 bg-red-50'; StatusIcon = AlertCircle; }
                else if (diffDays === 0) { statusLabel = t('page.dashboard.dueToday'); statusColor = 'text-orange-600 bg-orange-50'; StatusIcon = AlertTriangle; }
                else if (diffDays <= 7) { statusLabel = t('page.dashboard.dueSoon'); statusColor = 'text-yellow-600 bg-yellow-50'; StatusIcon = AlertTriangle; }
                else { statusLabel = t('page.dashboard.normal'); statusColor = 'text-green-600 bg-green-50'; StatusIcon = CheckCircle; }
                return (
                  <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs text-gray-700 max-w-[120px] truncate">{inv.company_name || '—'}</td>
                    <td className="px-3 py-2 text-xs font-mono text-blue-600">{inv.order_number || '—'}</td>
                    <td className="px-3 py-2 text-xs font-mono text-right">{formatCurrency(inv.amount_due || inv.total, inv.currency)}</td>
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
          <div className={WORKSPACE_CARD_BODY}>
            <div className="space-y-2.5">
              {pipeline.map(stage => {
                const share = pipelineTotal > 0 ? Math.round((stage.count / pipelineTotal) * 100) : 0;
                const width = stage.count > 0 ? Math.max(4, Math.round((stage.count / pipelineMax) * 100)) : 0;
                return (
                  <Link key={stage.labelKey} to={stage.link} className="group block rounded-lg border border-gray-100 bg-white px-3 py-2.5 transition-colors hover:border-gray-200 hover:bg-gray-50/70">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded ${stage.tone}`}>
                        <stage.icon size={17} strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <span className="truncate text-xs font-medium text-gray-700">{t(`page.dashboard.${stage.labelKey}`)}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-2xs font-450 text-gray-400">{t('page.dashboard.pipelineShare', { percent: share })}</span>
                            <span className={`min-w-7 text-right text-sm font-semibold ${stage.labelKey === 'stagePayment' && stage.count > 0 ? 'text-red-600' : 'text-gray-700'}`}>{stage.count}</span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                          <div className={`h-full rounded-full transition-all ${stage.bar}`} style={{ width: `${width}%` }} />
                        </div>
                      </div>
                      <span className="text-xs text-gray-300 transition-colors group-hover:text-gray-500">→</span>
                    </div>
                  </Link>
                );
              })}
            </div>
            {pipelineTotal === 0 && <p className="text-sm text-gray-400 text-center py-6">{t('page.dashboard.noActiveDeals')}</p>}
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
              <p className="text-sm text-gray-400 text-center py-6">{t('page.dashboard.noInquiries')}</p>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${WORKSPACE_CARD} lg:col-span-1`}>
          <div className={WORKSPACE_CARD_HEADER}>
            <h2 className={WORKSPACE_CARD_TITLE}><TrendingUp size={18} strokeWidth={1.75} className="text-gray-500" />{t('page.dashboard.thisMonthSales')}</h2>
          </div>
          <div className={WORKSPACE_CARD_BODY}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xs font-450 text-gray-400 uppercase tracking-[0.08em]">{t('page.dashboard.currency')}</span>
              <span className="text-2xs font-450 text-gray-400 uppercase tracking-[0.08em]">{t('page.dashboard.target')}</span>
              <span className="text-2xs font-450 text-gray-400 uppercase tracking-[0.08em]">{t('page.dashboard.actual')}</span>
              <span className="text-2xs font-450 text-gray-400 uppercase tracking-[0.08em]">%</span>
            </div>
            {actualUSD > 0 && (
              <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
                <span className="text-xs font-medium text-gray-600">USD</span>
                <span className="text-xs font-mono text-gray-500">{formatCurrency(targetUSD, 'USD')}</span>
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(actualUSD, 'USD')}</span>
                <span className={`text-xs font-semibold ${pctUSD >= 100 ? 'text-green-600' : pctUSD >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>{pctUSD}%</span>
              </div>
            )}
            {actualCNY > 0 && (
              <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
                <span className="text-xs font-medium text-gray-600">CNY</span>
                <span className="text-xs font-mono text-gray-500">{formatCurrency(targetCNY, 'CNY')}</span>
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(actualCNY, 'CNY')}</span>
                <span className="text-xs font-semibold">{Math.round((actualCNY / targetCNY) * 100)}%</span>
              </div>
            )}
            {actualUSD === 0 && actualCNY === 0 && <p className="text-xs text-gray-400 text-center py-4">{t('page.dashboard.noClosedSalesThisMonth')}</p>}
            {(actualUSD > 0 || actualCNY > 0) && (
              <div className="mt-3">
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${pctUSD >= 100 ? 'bg-green-500' : pctUSD >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, Math.max(2, pctUSD))}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={`${WORKSPACE_CARD} lg:col-span-2`}>
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
                    <span className="text-sm font-mono font-semibold text-gray-900">{formatCurrency(c.total, c.currency)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-6">{t('page.dashboard.noClosedSalesThisMonth')}</p>
            )}
          </div>
        </div>
      </div>

      {/* 5. Receivable Aging */}
      <div className={WORKSPACE_CARD}>
        <div className={WORKSPACE_CARD_HEADER}>
          <h2 className={WORKSPACE_CARD_TITLE}><CalendarClock size={18} strokeWidth={1.75} className="text-gray-500" />{t('page.dashboard.receivableAging')}</h2>
        </div>
        <div className={WORKSPACE_CARD_BODY}>
          {unpaid.length > 0 && (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
                <p className="text-2xs font-450 uppercase tracking-[0.08em] text-gray-400">{t('page.dashboard.outstandingReceivables')}</p>
                <p className="mt-1 text-sm font-mono font-semibold text-gray-900">{formatWithCurrency(outstandingUSD, outstandingCNY)}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
                <p className="text-2xs font-450 uppercase tracking-[0.08em] text-gray-400">{t('page.dashboard.overdue')}</p>
                <p className="mt-1 text-sm font-semibold text-red-600">{t('page.dashboard.overdueInvoices', { count: overdue.length })}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
                <p className="text-2xs font-450 uppercase tracking-[0.08em] text-gray-400">{t('page.dashboard.status')}</p>
                <p className="mt-1 text-sm font-semibold text-gray-700">{t('page.dashboard.trackedReceivables', { count: unpaidWithDueDate.length })}</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {aging.map(b => {
              const width = b.items.length > 0 ? Math.max(4, Math.round((b.items.length / maxAgingCount) * 100)) : 0;
              return (
                <div key={b.label} className="rounded-lg border border-gray-100 bg-white p-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{b.label}</p>
                      <p className="mt-0.5 text-2xs text-gray-400">{t('page.dashboard.agingBucketInvoices', { count: b.items.length })}</p>
                    </div>
                    <div className="text-right">
                      {b.usdTotal > 0 && <p className="text-xs font-mono font-semibold text-gray-900">{formatCurrency(b.usdTotal, 'USD')}</p>}
                      {b.cnyTotal > 0 && <p className="text-xs font-mono font-semibold text-gray-900">{formatCurrency(b.cnyTotal, 'CNY')}</p>}
                      {b.usdTotal === 0 && b.cnyTotal === 0 && <p className="text-xs text-gray-300">—</p>}
                    </div>
                  </div>
                  <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div className={`h-full rounded-full ${b.bar}`} style={{ width: `${width}%` }} />
                  </div>
                  {b.items.length > 0 ? (
                    <div className="space-y-1">
                      {b.items.slice(0, 4).map((inv: any) => (
                        <div key={inv.id} className="flex items-center justify-between gap-3 text-2xs text-gray-500">
                          <span className="min-w-0 truncate">{inv.company_name || inv.invoice_number}</span>
                          <span className="flex-shrink-0 font-mono">{formatCurrency(inv.amount_due || inv.total, inv.currency)}</span>
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
            <p className="text-sm text-gray-400 text-center py-6">{t('page.dashboard.noOutstandingReceivables')}</p>
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
            <p className="text-sm text-gray-400 text-center py-6">{t('page.dashboard.noQuotations')}</p>
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
