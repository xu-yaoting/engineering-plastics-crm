import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, AlertTriangle, Award, CheckCircle, FileText, ReceiptText, Workflow, TrendingUp, CalendarClock, Inbox, FlaskConical, BadgeCheck, Factory, Truck, Wallet } from 'lucide-react';
import { formatCurrency } from '../lib/currency';
import { useTranslation } from 'react-i18next';

export default function Dashboard() {
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/payments').then(r => r.json()).then(setInvoices).catch(() => {});
    fetch('/api/orders').then(r => r.json()).then(setOrders).catch(() => {});
    fetch('/api/quotations').then(r => r.json()).then(setQuotations).catch(() => {});
    fetch('/api/inquiries').then(r => r.json()).then(setInquiries).catch(() => {});
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
    { labelKey: 'stageInquiry', count: inquiries.filter((i: any) => ['open', 'under_review'].includes(i.status)).length, link: '/inquiries', icon: Inbox },
    { labelKey: 'stageQuotation', count: openQuotes.length, link: '/quotations', icon: FileText },
    { labelKey: 'stageSample', count: 0, link: '/samples', icon: FlaskConical },
    { labelKey: 'stageConfirmed', count: orders.filter((o: any) => o.status === 'confirmed').length, link: '/orders', icon: BadgeCheck },
    { labelKey: 'stageProduction', count: orders.filter((o: any) => ['in_production', 'quality_check'].includes(o.status)).length, link: '/orders', icon: Factory },
    { labelKey: 'stageShipment', count: orders.filter((o: any) => ['ready_to_ship', 'shipped'].includes(o.status)).length, link: '/orders', icon: Truck },
    { labelKey: 'stagePayment', count: invoices.filter((i: any) => i.status !== 'paid' && i.status !== 'cancelled').length, link: '/payments', icon: Wallet },
  ];

  // Monthly Performance
  const thisMonthQuotes = quotations.filter((q: any) => {
    if (q.status !== 'accepted') return false;
    const d = new Date(q.accepted_at || q.updated_at);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  const actualUSD = thisMonthQuotes.filter((q: any) => !q.currency || q.currency === 'USD')
    .reduce((s: number, q: any) => s + (q.total || 0), 0);
  const actualCNY = thisMonthQuotes.filter((q: any) => q.currency === 'CNY')
    .reduce((s: number, q: any) => s + (q.total || 0), 0);
  const targetUSD = 50000;
  const targetCNY = 500000;
  const pctUSD = targetUSD > 0 ? Math.round((actualUSD / targetUSD) * 100) : 0;

  // Top Customers
  const byCompany: Record<string, { total: number; currency: string; count: number; id: string }> = {};
  thisMonthQuotes.forEach((q: any) => {
    const key = q.company_name || q.company_id || t('page.dashboard.unknownCustomer');
    if (!byCompany[key]) byCompany[key] = { total: 0, currency: q.currency || 'USD', count: 0, id: key };
    byCompany[key].total += (q.total || 0);
    byCompany[key].count += 1;
  });
  const topCustomers = Object.entries(byCompany).map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total).slice(0, 5);

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
        <Link to="/payments" className="card p-4 hover:border-gray-300 transition-colors">
          <div className="mb-2">
            <span className="text-xs text-gray-500 font-medium">{t('page.dashboard.outstandingReceivables')}</span>
          </div>
          <div className="text-3xl font-semibold text-gray-900">{formatWithCurrency(outstandingUSD, outstandingCNY)}</div>
          <div className="text-2xs text-gray-400 mt-1">{t('page.dashboard.unpaidInvoices', { count: unpaid.length })}</div>
        </Link>
        <Link to="/payments" className="card p-4 hover:border-gray-300 transition-colors">
          <div className="mb-2">
            <span className="text-xs text-gray-500 font-medium">{t('page.dashboard.overdueReceivables')}</span>
          </div>
          <div className="text-3xl font-semibold text-red-600">{formatWithCurrency(overdueUSD, overdueCNY)}</div>
          <div className="text-2xs text-red-500 mt-1">{t('page.dashboard.overdueInvoices', { count: overdue.length })}</div>
        </Link>
        <Link to="/orders" className="card p-4 hover:border-gray-300 transition-colors">
          <div className="mb-2">
            <span className="text-xs text-gray-500 font-medium">{t('page.dashboard.openOrders')}</span>
          </div>
          <div className="text-3xl font-semibold text-blue-600">{openOrders.length}</div>
          <div className="text-2xs text-gray-400 mt-1">{t('page.dashboard.notYetDelivered')}</div>
        </Link>
        <Link to="/quotations" className="card p-4 hover:border-gray-300 transition-colors">
          <div className="mb-2">
            <span className="text-xs text-gray-500 font-medium">{t('page.dashboard.openQuotations')}</span>
          </div>
          <div className="text-3xl font-semibold text-yellow-600">{openQuotes.length}</div>
          <div className="text-2xs text-gray-400 mt-1">{t('page.dashboard.awaitingDecision')}</div>
        </Link>
      </div>

      {/* 2. Accounts Receivable Alert */}
      <div className="card">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2"><ReceiptText size={18} strokeWidth={1.75} className="text-gray-500" />{t('page.dashboard.accountsReceivableAlert')}</h2>
          <Link to="/payments" className="text-xs text-blue-600 hover:underline">{t('page.dashboard.viewAll')}</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-2xs font-450 text-gray-500 uppercase tracking-[0.08em] px-3 py-2">{t('page.dashboard.customer')}</th>
                <th className="text-left text-2xs font-450 text-gray-500 uppercase tracking-[0.08em] px-3 py-2">{t('page.dashboard.invoice')}</th>
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
                    <td className="px-3 py-2 text-xs font-mono text-blue-600">{inv.invoice_number}</td>
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
        <div className="card">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2"><Workflow size={18} strokeWidth={1.75} className="text-gray-500" />{t('page.dashboard.salesPipeline')}</h2>
          </div>
          <div className="p-4">
            <div className="space-y-2">
              {pipeline.map(stage => (
                <Link key={stage.labelKey} to={stage.link} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group">
                  <stage.icon size={18} strokeWidth={1.75} className="opacity-75 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700">{t(`page.dashboard.${stage.labelKey}`)}</span>
                      <span className={`text-sm font-semibold ${stage.labelKey === 'stagePayment' && stage.count > 0 ? 'text-red-600' : 'text-gray-700'}`}>{stage.count}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${"bg-gray-300"}`}
                        style={{ width: `${Math.min(100, Math.max(3, Math.round(pipeline.reduce((s, p) => s + p.count, 0) > 0 ? (stage.count / Math.max(...pipeline.map(p => p.count))) * 100 : 3)))}%` }} />
                    </div>
                  </div>
                  <span className="text-xs text-gray-300 group-hover:text-gray-500 transition-colors">→</span>
                </Link>
              ))}
            </div>
            {pipeline.reduce((s, p) => s + p.count, 0) === 0 && <p className="text-sm text-gray-400 text-center py-6">{t('page.dashboard.noActiveDeals')}</p>}
          </div>
        </div>

        {/* Recent Inquiries */}
        <div className="card">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2"><Inbox size={18} strokeWidth={1.75} className="text-gray-500" />{t('page.dashboard.recentInquiries')}</h2>
            <Link to="/inquiries" className="text-xs text-blue-600 hover:underline">{t('page.dashboard.viewAll')}</Link>
          </div>
          <div className="p-4">
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
        <div className="card p-4 lg:col-span-1">
          <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2"><TrendingUp size={18} strokeWidth={1.75} className="text-gray-500" />{t('page.dashboard.thisMonthSales')}</h2>
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

        <div className="card p-4 lg:col-span-2">
          <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2"><Award size={18} strokeWidth={1.75} className="text-gray-500" />{t('page.dashboard.topCustomersThisMonth')}</h2>
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

      {/* 5. Receivable Aging */}
      <div className="card">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2"><CalendarClock size={18} strokeWidth={1.75} className="text-gray-500" />{t('page.dashboard.receivableAging')}</h2>
        </div>
        <div className="p-4">
          {(() => {
            const buckets = [
              { label: t('page.dashboard.days0to30'), min: 0, max: 30, bar: 'bg-green-500' },
              { label: t('page.dashboard.days31to60'), min: 31, max: 60, bar: 'bg-yellow-500' },
              { label: t('page.dashboard.days61to90'), min: 61, max: 90, bar: 'bg-orange-500' },
              { label: t('page.dashboard.days90Plus'), min: 91, max: Infinity, bar: 'bg-red-500' },
            ];
            const unpaid2 = invoices.filter((i: any) => i.status !== 'paid' && i.status !== 'cancelled' && i.due_date);
            const aging = buckets.map(b => {
              const items = unpaid2.filter((inv: any) => {
                const days = Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / 86400000);
                return days >= b.min && days <= b.max;
              });
              return { ...b, items,
                usdTotal: items.filter((i: any) => !i.currency || i.currency === 'USD').reduce((s: number, i: any) => s + (i.amount_due || i.total || 0), 0),
                cnyTotal: items.filter((i: any) => i.currency === 'CNY').reduce((s: number, i: any) => s + (i.amount_due || i.total || 0), 0),
              };
            });
            const maxTotal = Math.max(...aging.map(a => a.usdTotal + a.cnyTotal), 1);
            return aging.map(b => {
              const total = b.usdTotal + b.cnyTotal;
              return (
                <div key={b.label} className="mb-3 last:mb-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-xs font-semibold text-gray-700 w-24">{b.label}</span>
                      <div className="flex-1 max-w-[300px] h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${b.bar}`} style={{ width: `${Math.max(3, (total / maxTotal) * 100)}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      {b.usdTotal > 0 && <span className="text-xs font-mono font-semibold text-gray-900">{formatCurrency(b.usdTotal, 'USD')}</span>}
                      {b.cnyTotal > 0 && <span className="text-xs font-mono font-semibold text-gray-900">{formatCurrency(b.cnyTotal, 'CNY')}</span>}
                      <span className="text-xs text-gray-400">({b.items.length})</span>
                    </div>
                  </div>
                  {b.items.length > 0 && (
                    <div className="ml-[120px] space-y-0.5 mb-2">
                      {b.items.slice(0, 4).map((inv: any) => (
                        <div key={inv.id} className="flex items-center justify-between text-2xs text-gray-500">
                          <span className="truncate max-w-[250px]">{inv.company_name || inv.invoice_number}</span>
                          <span className="font-mono">{formatCurrency(inv.amount_due || inv.total, inv.currency)}</span>
                        </div>
                      ))}
                      {b.items.length > 4 && <div className="text-2xs text-gray-400">{t('page.dashboard.more', { count: b.items.length - 4 })}</div>}
                    </div>
                  )}
                </div>
              );
            });
          })()}
          {unpaid.length === 0 && <p className="text-sm text-gray-400 text-center py-6">{t('page.dashboard.noOutstandingReceivables')}</p>}
        </div>
      </div>

      {/* 6. Recent Quotations */}
      <div className="card">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2"><FileText size={18} strokeWidth={1.75} className="text-gray-500" />{t('page.dashboard.recentQuotations')}</h2>
          <Link to="/quotations" className="text-xs text-blue-600 hover:underline">{t('page.dashboard.viewAll')}</Link>
        </div>
        <div className="p-4">
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
