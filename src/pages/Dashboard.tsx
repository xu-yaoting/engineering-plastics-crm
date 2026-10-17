import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, AlertTriangle, ArrowRight, Award, CheckCircle, FileText, ReceiptText, Workflow, TrendingUp, CalendarClock, Truck, Wallet, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../lib/currency';
import { useTranslation } from 'react-i18next';

const WORKSPACE_CARD = 'card overflow-hidden shadow-[var(--shadow-card)]';
const WORKSPACE_CARD_HEADER = 'flex min-h-[52px] items-center justify-between border-b border-border bg-surface-subtle px-4 py-3';
const WORKSPACE_CARD_TITLE = 'flex items-center gap-2 text-base font-semibold text-ink';
const WORKSPACE_CARD_BODY = 'p-4';

function DashboardSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="page-shell space-y-6">
      <div aria-hidden="true" className="animate-pulse space-y-6 motion-reduce:animate-none">
        <div>
          <div className="h-7 w-40 rounded bg-border-strong" />
          <div className="mt-2 h-3 w-64 max-w-full rounded bg-surface-hover" />
        </div>
        <div className="metric-strip">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="metric-cell">
              <div className="h-3 w-28 rounded bg-surface-hover" />
              <div className="mt-5 h-8 w-24 rounded bg-border-strong" />
              <div className="mt-2 h-3 w-20 rounded bg-surface-hover" />
            </div>
          ))}
        </div>
        <div className="data-surface h-64">
          <div className="h-14 border-b border-border bg-surface px-4 py-4">
            <div className="h-4 w-48 rounded bg-border-strong" />
          </div>
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-8 rounded bg-surface-hover" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-56 rounded-md border border-border bg-surface" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);

  const load = () => {
    setLoading(true);
    setLoadError(false);
    Promise.all([
      fetch('/api/payments').then(async res => {
        if (!res.ok) throw new Error(`Payments request failed: ${res.status}`);
        return res.json();
      }),
      fetch('/api/orders').then(async res => {
        if (!res.ok) throw new Error(`Orders request failed: ${res.status}`);
        return res.json();
      }),
      fetch('/api/quotations').then(async res => {
        if (!res.ok) throw new Error(`Quotations request failed: ${res.status}`);
        return res.json();
      }),
      fetch('/api/shipments').then(async res => {
        if (!res.ok) throw new Error(`Shipments request failed: ${res.status}`);
        return res.json();
      }),
    ]).then(([invoiceData, orderData, quotationData, shipmentData]) => {
      setInvoices(invoiceData);
      setOrders(orderData);
      setQuotations(quotationData);
      setShipments(shipmentData);
    }).catch(() => {
      setInvoices([]);
      setOrders([]);
      setQuotations([]);
      setShipments([]);
      setLoadError(true);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return <DashboardSkeleton label={t('common.loading')} />;
  if (loadError) {
    return (
      <div className="page-shell flex min-h-full items-center justify-center">
        <div className="data-surface w-full max-w-md p-6 text-center" role="alert">
          <p className="text-sm text-ink-muted">{t('page.error.loadFailed')}</p>
          <button type="button" onClick={load} className="btn-secondary btn-sm mt-3">
            <RefreshCw size={14} className="mr-1.5" />
            {t('common.refresh')}
          </button>
        </div>
      </div>
    );
  }

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
  const activeOrderStatuses = new Set(['confirmed', 'in_production', 'quality_check', 'ready_to_ship', 'shipped']);
  const activeOrders = orders.filter((o: any) => activeOrderStatuses.has(o.status));
  const openQuotes = quotations.filter((q: any) =>
    ['draft', 'sent', 'negotiating', 'pending_approval'].includes(q.status)
  );
  const activeShipments = shipments.filter((s: any) => s.status !== 'delivered' && s.status !== 'cancelled');

  const formatWithCurrency = (usd: number, cny: number) => {
    const parts: string[] = [];
    if (usd > 0) parts.push(formatCurrency(usd, 'USD'));
    if (cny > 0) parts.push(formatCurrency(cny, 'CNY'));
    return parts.join(' · ') || '$0';
  };

  // Sales Pipeline
  const pipeline = [
    { labelKey: 'stageQuotation', count: openQuotes.length, link: '/quotations', icon: FileText },
    { labelKey: 'stageConfirmed', count: activeOrders.length, link: '/orders', icon: ReceiptText },
    { labelKey: 'stageShipment', count: activeShipments.length, link: '/shipments', icon: Truck },
    { labelKey: 'stagePayment', count: unpaid.length, link: '/payments', icon: Wallet },
  ];
  const pipelineTotal = pipeline.reduce((sum, stage) => sum + stage.count, 0);
  const pipelineMax = Math.max(...pipeline.map(stage => stage.count), 1);

  // Monthly Performance — confirmed orders and their downstream statuses.
  const closedOrderStatuses = new Set(['confirmed', 'in_production', 'quality_check', 'ready_to_ship', 'shipped', 'delivered']);
  const isThisMonth = (value: unknown) => {
    if (!value) return false;
    const date = new Date(String(value));
    return !Number.isNaN(date.getTime()) && date.getMonth() === thisMonth && date.getFullYear() === thisYear;
  };
  const thisMonthClosedOrders = orders.filter((o: any) =>
    closedOrderStatuses.has(o.status) && isThisMonth(o.order_date || o.created_at)
  );
  const salesByCurrency = thisMonthClosedOrders.reduce<Record<string, number>>((totals, order: any) => {
    const currency = order.currency || 'USD';
    totals[currency] = (totals[currency] || 0) + Number(order.total || 0);
    return totals;
  }, {});
  const referenceTargets: Record<string, number> = { USD: 50000, CNY: 500000 };
  const salesRows = Object.entries(salesByCurrency).map(([currency, actual]) => {
    const target = referenceTargets[currency] || 0;
    return {
      currency,
      actual,
      target,
      percentage: target > 0 ? Math.round((actual / target) * 100) : null,
    };
  }).sort((a, b) => a.currency.localeCompare(b.currency));

  // Top Customers — keep currencies separate so totals are never mixed.
  const byCompanyCurrency: Record<string, { name: string; companyId?: string; total: number; currency: string; count: number }> = {};
  thisMonthClosedOrders.forEach((order: any) => {
    const name = order.company_name || t('page.dashboard.unknownCustomer');
    const currency = order.currency || 'USD';
    const key = `${order.company_id || name}:${currency}`;
    if (!byCompanyCurrency[key]) {
      byCompanyCurrency[key] = { name, companyId: order.company_id, total: 0, currency, count: 0 };
    }
    byCompanyCurrency[key].total += Number(order.total || 0);
    byCompanyCurrency[key].count += 1;
  });
  const topCustomers = Object.values(byCompanyCurrency)
    .sort((a, b) => b.total - a.total).slice(0, 5);

  const agingBuckets = [
    { label: t('page.dashboard.days0to30'), min: 0, max: 30, bar: 'bg-border-strong' },
    { label: t('page.dashboard.days31to60'), min: 31, max: 60, bar: 'bg-ink-subtle' },
    { label: t('page.dashboard.days61to90'), min: 61, max: 90, bar: 'bg-ink' },
    { label: t('page.dashboard.days90Plus'), min: 91, max: Infinity, bar: 'bg-danger' },
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
            <span className="text-xs font-450 text-ink-muted">{t('page.dashboard.outstandingReceivables')}</span>
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-stage-payment-soft text-stage-payment">
              <Wallet size={15} strokeWidth={1.75} />
            </span>
          </div>
          <div className="mt-4 text-3xl font-semibold tabular-nums text-ink">{formatWithCurrency(outstandingUSD, outstandingCNY)}</div>
          <div className="mt-1 text-2xs text-ink-subtle">{t('page.dashboard.unpaidInvoices', { count: unpaid.length })}</div>
        </Link>
        <Link to="/payments" className="metric-cell group">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-450 text-ink-muted">{t('page.dashboard.overdueReceivables')}</span>
            <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${overdue.length > 0 ? 'bg-danger-soft text-danger' : 'bg-surface-hover text-ink-subtle'}`}>
              <AlertCircle size={15} strokeWidth={1.75} />
            </span>
          </div>
          <div className={`mt-4 text-3xl font-semibold tabular-nums ${overdue.length > 0 ? 'text-danger' : 'text-ink'}`}>{formatWithCurrency(overdueUSD, overdueCNY)}</div>
          <div className={`mt-1 text-2xs ${overdue.length > 0 ? 'text-danger' : 'text-ink-subtle'}`}>{t('page.dashboard.overdueInvoices', { count: overdue.length })}</div>
        </Link>
        <Link to="/orders" className="metric-cell group">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-450 text-ink-muted">{t('page.dashboard.openOrders')}</span>
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-stage-order-soft text-stage-order">
              <ReceiptText size={15} strokeWidth={1.75} />
            </span>
          </div>
          <div className="mt-4 text-3xl font-semibold tabular-nums text-ink">{openOrders.length}</div>
          <div className="mt-1 text-2xs text-ink-subtle">{t('page.dashboard.notYetDelivered')}</div>
        </Link>
        <Link to="/quotations" className="metric-cell group">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-450 text-ink-muted">{t('page.dashboard.openQuotations')}</span>
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-stage-quotation-soft text-stage-quotation">
              <FileText size={15} strokeWidth={1.75} />
            </span>
          </div>
          <div className="mt-4 text-3xl font-semibold tabular-nums text-ink">{openQuotes.length}</div>
          <div className="mt-1 text-2xs text-ink-subtle">{t('page.dashboard.awaitingDecision')}</div>
        </Link>
      </div>

      {/* 2. Accounts Receivable Alert */}
      <div className={`data-surface ${overdue.length > 0 ? 'status-edge-danger' : 'border-border-strong'}`}>
        <div className="flex min-h-[56px] items-center justify-between border-b border-border bg-surface px-4 py-3">
          <div>
            <h2 className={WORKSPACE_CARD_TITLE}><ReceiptText size={18} strokeWidth={1.75} className={overdue.length > 0 ? 'text-danger' : 'text-ink-muted'} />{t('page.dashboard.accountsReceivableAlert')}</h2>
            <p className="mt-1 text-2xs text-ink-subtle">{t('page.dashboard.unpaidInvoices', { count: unpaid.length })} · {t('page.dashboard.overdueInvoices', { count: overdue.length })}</p>
          </div>
          <Link to="/payments" className="text-xs text-brand hover:underline">{t('page.dashboard.viewAll')}</Link>
        </div>
            <div className="space-y-2 p-3 md:hidden">
              {unpaid.slice().sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()).slice(0, 10).map((inv: any) => {
                const diffDays = Math.ceil((new Date(inv.due_date).getTime() - now.getTime()) / 86400000);
                let statusLabel: string, statusColor: string;
                let StatusIcon: React.ComponentType<any> = AlertCircle;
                if (diffDays < 0) { statusLabel = t('page.dashboard.overdue'); statusColor = 'text-danger bg-danger-soft'; StatusIcon = AlertCircle; }
                else if (diffDays <= 7) { statusLabel = diffDays === 0 ? t('page.dashboard.dueToday') : t('page.dashboard.dueSoon'); statusColor = 'text-warning bg-warning-soft'; StatusIcon = AlertTriangle; }
                else { statusLabel = t('page.dashboard.normal'); statusColor = 'text-ink-muted bg-surface-hover'; StatusIcon = CheckCircle; }
                return (
                  <div key={inv.id} className={`rounded-md border border-border bg-surface p-3 ${diffDays < 0 ? 'border-l-2 border-l-danger' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{inv.company_name || '—'}</p>
                        <p className="mt-1 text-xs tabular-nums text-ink-muted">{inv.order_number || '—'} · {inv.currency || 'USD'}</p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-ink">{formatCurrency(inv.amount_due || inv.total, inv.currency)}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3 text-xs">
                      <div>
                        <p className="section-label">{t('page.dashboard.dueDate')}</p>
                        <p className="mt-1 text-ink-muted">{inv.due_date?.slice(0, 10) || '—'}</p>
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
              <tr className="border-b border-border bg-surface-subtle">
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
                if (diffDays < 0) { statusLabel = t('page.dashboard.overdue'); statusColor = 'text-danger bg-danger-soft'; StatusIcon = AlertCircle; }
                else if (diffDays <= 7) { statusLabel = diffDays === 0 ? t('page.dashboard.dueToday') : t('page.dashboard.dueSoon'); statusColor = 'text-warning bg-warning-soft'; StatusIcon = AlertTriangle; }
                else { statusLabel = t('page.dashboard.normal'); statusColor = 'text-ink-muted bg-surface-hover'; StatusIcon = CheckCircle; }
                return (
                  <tr key={inv.id} className={`border-b border-border transition-colors hover:bg-surface-hover ${diffDays < 0 ? 'border-l-2 border-l-danger' : 'border-l-2 border-l-transparent'}`}>
                    <td className="max-w-[120px] truncate px-3 py-2 text-xs text-ink-muted">{inv.company_name || '—'}</td>
                    <td className="px-3 py-2 text-xs font-medium tabular-nums text-ink-muted">{inv.order_number || '—'}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-ink">{formatCurrency(inv.amount_due || inv.total, inv.currency)}</td>
                    <td className="px-3 py-2 text-center text-2xs text-ink-subtle">{inv.currency || 'USD'}</td>
                    <td className="px-3 py-2 text-xs text-ink-muted">{inv.due_date?.slice(0, 10)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-450 ${statusColor}`}><StatusIcon size={12} strokeWidth={1.75} />{statusLabel}</span>
                    </td>
                  </tr>
                );
              })}
              {unpaid.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-sm text-ink-subtle">{t('page.dashboard.allInvoicesPaid')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Sales Pipeline */}
      <div className="grid grid-cols-1 gap-6">
        <div className={WORKSPACE_CARD}>
          <div className={WORKSPACE_CARD_HEADER}>
            <h2 className={WORKSPACE_CARD_TITLE}><Workflow size={18} strokeWidth={1.75} className="text-ink-muted" />{t('page.dashboard.salesPipeline')}</h2>
            <span className="rounded bg-surface px-2 py-1 text-2xs font-450 text-ink-muted ring-1 ring-border">
              {t('page.dashboard.totalPipelineItems', { count: pipelineTotal })}
            </span>
          </div>
          <div>
            <div className="divide-y divide-border">
              {pipeline.map(stage => {
                const stageTone = stage.labelKey === 'stageQuotation'
                  ? { dot: 'bg-stage-quotation', icon: 'bg-stage-quotation-soft text-stage-quotation', bar: 'bg-stage-quotation' }
                  : stage.labelKey === 'stageConfirmed'
                    ? { dot: 'bg-stage-order', icon: 'bg-stage-order-soft text-stage-order', bar: 'bg-stage-order' }
                    : stage.labelKey === 'stageShipment'
                      ? { dot: 'bg-stage-shipment', icon: 'bg-stage-shipment-soft text-stage-shipment', bar: 'bg-stage-shipment' }
                      : { dot: 'bg-stage-payment', icon: 'bg-stage-payment-soft text-stage-payment', bar: 'bg-stage-payment' };
                const share = pipelineTotal > 0 ? Math.round((stage.count / pipelineTotal) * 100) : 0;
                const width = stage.count > 0 ? Math.max(4, Math.round((stage.count / pipelineMax) * 100)) : 0;
                return (
                  <Link key={stage.labelKey} to={stage.link} className="group block px-4 py-3 transition-colors hover:bg-surface-hover">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md ${stageTone.icon}`}>
                        <stage.icon size={17} strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-1.5 truncate text-xs font-medium text-ink-muted"><span className={`h-1.5 w-1.5 rounded-full ${stageTone.dot}`} aria-hidden="true" />{t(`page.dashboard.${stage.labelKey}`)}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-2xs font-450 text-ink-subtle">{t('page.dashboard.pipelineShare', { percent: share })}</span>
                            <span className="min-w-7 text-right text-sm font-semibold text-ink">{stage.count}</span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
                          <div className={`h-full rounded-full transition-all ${stageTone.bar}`} style={{ width: `${width}%` }} />
                        </div>
                      </div>
                      <ArrowRight size={15} strokeWidth={1.75} className="text-ink-subtle transition-colors group-hover:text-ink-muted" />
                    </div>
                  </Link>
                );
              })}
            </div>
            {pipelineTotal === 0 && <p className="empty-state">{t('page.dashboard.noActiveDeals')}</p>}
          </div>
        </div>

      </div>

      {/* 4. Monthly Performance */}
      <div className={`grid grid-cols-1 gap-6 ${topCustomers.length > 0 ? 'lg:grid-cols-2' : ''}`}>
        <div className={WORKSPACE_CARD}>
          <div className={WORKSPACE_CARD_HEADER}>
            <h2 className={WORKSPACE_CARD_TITLE}><TrendingUp size={18} strokeWidth={1.75} className="text-ink-muted" />{t('page.dashboard.thisMonthSales')}</h2>
          </div>
          <div className={WORKSPACE_CARD_BODY}>
            {salesRows.length > 0 ? (
              <>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="section-label">{t('page.dashboard.currency')}</span>
                  <span className="section-label">{t('page.dashboard.target')}</span>
                  <span className="section-label">{t('page.dashboard.actual')}</span>
                  <span className="section-label">%</span>
                </div>
                {salesRows.map(row => (
                  <div key={row.currency} className="flex items-center justify-between gap-3 border-b border-border py-1.5 last:border-b-0">
                    <span className="text-xs font-medium text-ink-muted">{row.currency}</span>
                    <span className="text-xs tabular-nums text-ink-muted">{row.target > 0 ? formatCurrency(row.target, row.currency) : '—'}</span>
                    <span className="text-sm font-semibold tabular-nums text-ink">{formatCurrency(row.actual, row.currency)}</span>
                    <span className={`text-xs font-semibold ${row.percentage === null ? 'text-ink-subtle' : row.percentage >= 100 ? 'text-success' : row.percentage >= 70 ? 'text-warning' : 'text-brand'}`}>
                      {row.percentage === null ? '—' : `${row.percentage}%`}
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <div className="empty-state min-h-24 px-0 py-4">
                <p>{t('page.dashboard.noClosedSalesThisMonth')}</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Link to="/quotations" className="btn-secondary btn-sm">{t('page.dashboard.openQuotations')}</Link>
                  <Link to="/orders" className="btn-ghost btn-sm">{t('page.dashboard.openOrders')}</Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {topCustomers.length > 0 && <div className={WORKSPACE_CARD}>
          <div className={WORKSPACE_CARD_HEADER}>
            <h2 className={WORKSPACE_CARD_TITLE}><Award size={18} strokeWidth={1.75} className="text-ink-muted" />{t('page.dashboard.topCustomersThisMonth')}</h2>
          </div>
          <div className={WORKSPACE_CARD_BODY}>
            <div className="space-y-2">
              {topCustomers.map((c, idx) => (
                <div key={`${c.companyId || c.name}-${c.currency}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-canvas">
                  {idx === 0 ? <Award size={18} strokeWidth={1.75} className="text-warning flex-shrink-0" /> :
                   idx === 1 ? <Award size={18} strokeWidth={1.75} className="text-ink-subtle flex-shrink-0" /> :
                   idx === 2 ? <Award size={18} strokeWidth={1.75} className="text-ink-subtle flex-shrink-0" /> :
                   <span className="w-6 h-6 flex items-center justify-center text-xs font-medium text-ink-subtle">{idx + 1}</span>}
                  {c.companyId ? (
                    <Link to={`/companies/${c.companyId}`} className="min-w-0 flex-1 truncate text-sm text-ink underline decoration-border-strong underline-offset-2 hover:decoration-ink">{c.name}</Link>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{c.name}</span>
                  )}
                  <span className="text-xs text-ink-subtle">{t('page.dashboard.deals', { count: c.count })}</span>
                  <span className="text-sm tabular-nums font-semibold text-ink">{formatCurrency(c.total, c.currency)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>}
      </div>

      {/* 5. Receivable Aging */}
      <div className={WORKSPACE_CARD}>
        <div className={WORKSPACE_CARD_HEADER}>
          <h2 className={WORKSPACE_CARD_TITLE}><CalendarClock size={18} strokeWidth={1.75} className="text-ink-muted" />{t('page.dashboard.receivableAging')}</h2>
          <span className="text-2xs font-450 text-ink-subtle">{t('page.dashboard.trackedReceivables', { count: unpaidWithDueDate.length })}</span>
        </div>
        <div>
          {unpaid.length > 0 && (
            <div className="border-b border-border px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-4">
                <span className="text-xs text-ink-muted">{t('page.dashboard.outstandingReceivables')}</span>
                <span className="text-sm tabular-nums font-semibold text-ink">{formatWithCurrency(outstandingUSD, outstandingCNY)}</span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-surface-hover">
                {aging.map(bucket => (
                  <div key={bucket.label} className={bucket.bar} style={{ width: `${totalAgingItems > 0 ? (bucket.items.length / totalAgingItems) * 100 : 0}%` }} />
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-4 md:divide-x md:divide-y-0">
            {aging.map(b => {
              return (
                <div key={b.label} className="min-w-0 p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-ink">{b.label}</p>
                      <p className="mt-0.5 text-2xs text-ink-subtle">{t('page.dashboard.agingBucketInvoices', { count: b.items.length })}</p>
                    </div>
                    <div className="text-right">
                      {b.usdTotal > 0 && <p className="text-xs tabular-nums font-semibold text-ink">{formatCurrency(b.usdTotal, 'USD')}</p>}
                      {b.cnyTotal > 0 && <p className="text-xs tabular-nums font-semibold text-ink">{formatCurrency(b.cnyTotal, 'CNY')}</p>}
                      {b.usdTotal === 0 && b.cnyTotal === 0 && <p className="text-xs text-ink-subtle">—</p>}
                    </div>
                  </div>
                  {b.items.length > 0 ? (
                    <div className="space-y-1">
                      {b.items.slice(0, 4).map((inv: any) => (
                        <div key={inv.id} className="flex items-center justify-between gap-3 text-2xs text-ink-muted">
                          <span className="min-w-0 truncate">{inv.company_name || inv.invoice_number}</span>
                          <span className="flex-shrink-0 tabular-nums">{formatCurrency(inv.amount_due || inv.total, inv.currency)}</span>
                        </div>
                      ))}
                      {b.items.length > 4 && <div className="text-2xs text-ink-subtle">{t('page.dashboard.more', { count: b.items.length - 4 })}</div>}
                    </div>
                  ) : (
                    <p className="text-2xs text-ink-subtle">{t('page.dashboard.agingNoInvoices')}</p>
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
          <h2 className={WORKSPACE_CARD_TITLE}><FileText size={18} strokeWidth={1.75} className="text-stage-quotation" />{t('page.dashboard.recentQuotations')}</h2>
          <Link to="/quotations" className="text-xs text-brand hover:underline">{t('page.dashboard.viewAll')}</Link>
        </div>
        <div className={WORKSPACE_CARD_BODY}>
          {quotations.length === 0 ? (
            <p className="empty-state">{t('page.dashboard.noQuotations')}</p>
          ) : (
              <div className="divide-y divide-border">
                {quotations.slice(0, 5).map((q: any) => (
                  <Link key={q.id} to={`/quotations/${q.id}`} className="flex items-start gap-3 px-2 py-3 transition-colors first:pt-0 last:pb-0 hover:bg-surface-hover">
                    <FileText size={16} strokeWidth={1.75} className="mt-0.5 flex-shrink-0 text-stage-quotation" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="truncate text-sm font-medium text-ink">{q.quotation_number} — {q.company_name}</p>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{formatCurrency(q.total || 0, q.currency)}</span>
                      </div>
                      <p className="mt-1 text-2xs text-ink-subtle">{q.status?.replace(/_/g, ' ')} · {q.target_material_requested || '—'}</p>
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
