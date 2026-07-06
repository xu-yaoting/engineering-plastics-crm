import { useState, useEffect } from 'react';
import StatusBadge from '../components/shared/StatusBadge';
import { formatCurrency } from '../lib/currency';
import Icon from '../components/shared/Icon';
import { useTranslation } from 'react-i18next';
import { exportFullCsv } from '../lib/exportCsv';
import { toast } from '../lib/toast';

export default function Payments() {
  const { t } = useTranslation();
  const [list, setList] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ order_id: '', total: 0, due_date: '', notes: '' });
  const [payForm, setPayForm] = useState<{ invoiceId: string; amount: number; method: string; ref: string } | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editForm, setEditForm] = useState({ total: 0, due_date: '', notes: '' });

  const load = () => {
    fetch('/api/payments').then(r => r.json()).then(setList).finally(() => setLoading(false));
    fetch('/api/orders').then(r => r.json()).then(setOrders);
  };

  const readError = async (res: Response, fallback: string) => {
    const data = await res.json().catch(() => null);
    if (data?.error === 'Payment exceeds remaining balance') {
      return t('page.payments.paymentExceedsBalance', {
        remainingDue: formatCurrency(data.remainingDue || 0, 'USD'),
      });
    }
    return data?.error || data?.message || fallback;
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    try {
      await fetch(`/api/payments/${id}`, { method: 'DELETE' });
      setConfirmDelete(null);
      load();
    } catch (e) { console.error('Delete failed', e); }
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    try {
      const res = await fetch(`/api/payments/${editTarget.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        toast.error(await readError(res, t('page.payments.failedUpdateInvoice')));
        return;
      }
      setEditTarget(null);
      load();
    } catch (e) {
      console.error('Edit failed', e);
      toast.error(t('page.payments.failedUpdateInvoice'));
    }
  };

  const createInvoice = async () => {
    if (!form.order_id || !form.total) return;
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      toast.error(await readError(res, t('page.payments.failedCreateInvoice')));
      return;
    }
    setShowForm(false);
    setForm({ order_id: '', total: 0, due_date: '', notes: '' });
    load();
  };

  const recordPayment = async () => {
    if (!payForm) return;
    const res = await fetch(`/api/payments/${payForm.invoiceId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: payForm.amount, payment_method: payForm.method, reference_number: payForm.ref }),
    });
    if (!res.ok) {
      toast.error(await readError(res, t('page.payments.failedRecordPayment')));
      return;
    }
    setPayForm(null);
    load();
  };

  const filtered = list.filter((i: any) => {
    if (filter && i.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const match = i.invoice_number?.toLowerCase().includes(q) ||
        i.order_number?.toLowerCase().includes(q) ||
        i.company_name?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
  const isOverdue = (inv: any) => inv.status === 'overdue' || (inv.status !== 'paid' && inv.status !== 'cancelled' && new Date(inv.due_date) < new Date());

  // KPI computations
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const unpaid = list.filter((i: any) => i.status !== 'paid' && i.status !== 'cancelled');

  const outstandingUSD = unpaid.filter((i: any) => !i.currency || i.currency === 'USD')
    .reduce((s: number, i: any) => s + (i.amount_due || i.total || 0), 0);
  const outstandingCNY = unpaid.filter((i: any) => i.currency === 'CNY')
    .reduce((s: number, i: any) => s + (i.amount_due || i.total || 0), 0);

  const overdueInvs = unpaid.filter((i: any) => new Date(i.due_date) < now);
  const overdueUSD = overdueInvs.filter((i: any) => !i.currency || i.currency === 'USD')
    .reduce((s: number, i: any) => s + (i.amount_due || i.total || 0), 0);
  const overdueCNY = overdueInvs.filter((i: any) => i.currency === 'CNY')
    .reduce((s: number, i: any) => s + (i.amount_due || i.total || 0), 0);

  const dueThisMonth = unpaid.filter((i: any) => {
    const d = new Date(i.due_date);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear && d >= now;
  });
  const dueThisMonthUSD = dueThisMonth.filter((i: any) => !i.currency || i.currency === 'USD')
    .reduce((s: number, i: any) => s + (i.amount_due || i.total || 0), 0);
  const dueThisMonthCNY = dueThisMonth.filter((i: any) => i.currency === 'CNY')
    .reduce((s: number, i: any) => s + (i.amount_due || i.total || 0), 0);

  const collectedThisMonth = list.filter((i: any) => {
    if (i.status !== 'paid') return false;
    const d = new Date(i.fully_paid_at || i.updated_at);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  const collectedUSD = collectedThisMonth.filter((i: any) => !i.currency || i.currency === 'USD')
    .reduce((s: number, i: any) => s + (i.amount_paid || i.total || 0), 0);
  const collectedCNY = collectedThisMonth.filter((i: any) => i.currency === 'CNY')
    .reduce((s: number, i: any) => s + (i.amount_paid || i.total || 0), 0);

  const fmt = (usd: number, cny: number) => {
    const parts: string[] = [];
    if (usd > 0) parts.push(formatCurrency(usd, 'USD'));
    if (cny > 0) parts.push(formatCurrency(cny, 'CNY'));
    return parts.join(' · ') || '$0';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('nav.payments')}</h1>
          <p className="text-sm text-gray-500">{t('page.payments.outstanding')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowForm(true)} className="btn-primary btn-sm"><Icon name="plus" size={16} className="mr-1.5" />{t('page.payments.new')}</button>
          <button onClick={() => exportFullCsv('/api/payments', 'invoices')} className="btn-secondary btn-sm"><Icon name="download" size={14} className="mr-1" />CSV</button>
        </div>
      </div>

      {/* KPI Cards — Accounts Receivable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-xs text-gray-500 font-medium mb-1">{t('page.payments.outstandingReceivables')}</div>
          <div className="text-xl font-semibold text-gray-900">{fmt(outstandingUSD, outstandingCNY)}</div>
          <div className="text-2xs text-gray-400 mt-1">{t('page.payments.unpaidInvoices', { count: unpaid.length })}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 font-medium mb-1">{t('page.payments.overdueReceivables')}</div>
          <div className="text-xl font-semibold text-red-600">{fmt(overdueUSD, overdueCNY)}</div>
          <div className="text-2xs text-red-500 mt-1">{t('page.payments.overdueInvoices', { count: overdueInvs.length })}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 font-medium mb-1">{t('page.payments.dueThisMonth')}</div>
          <div className="text-xl font-semibold text-yellow-600">{fmt(dueThisMonthUSD, dueThisMonthCNY)}</div>
          <div className="text-2xs text-gray-400 mt-1">{t('page.payments.invoicesDue', { count: dueThisMonth.length })}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 font-medium mb-1">{t('page.payments.collectedThisMonth')}</div>
          <div className="text-xl font-semibold text-green-600">{fmt(collectedUSD, collectedCNY)}</div>
          <div className="text-2xs text-gray-400 mt-1">{t('page.payments.invoicesPaid', { count: collectedThisMonth.length })}</div>
        </div>
      </div>

      {showForm && (
        <div className="card p-4 mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">{t('page.payments.order')} *</label>
              <select className="input" value={form.order_id} onChange={e => {
                const sel = orders.find(o => o.id === e.target.value);
                setForm({...form, order_id: e.target.value, total: sel?.total || 0});
              }}>
                <option value="">{t('select.order')}</option>
                {orders.map((o: any) => <option key={o.id} value={o.id}>{o.order_number} — {o.company_name || ''}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t('page.payments.total')} *</label>
              <input className="input font-mono" type="number" value={form.total || ''} onChange={e => setForm({...form, total: parseFloat(e.target.value) || 0})} />
            </div>
            <div>
              <label className="label">{t('page.payments.dueDate')}</label>
              <input className="input" type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createInvoice} className="btn-primary btn-sm">{t('page.payments.createInvoice')}</button>
            <button onClick={() => setShowForm(false) } className="btn-secondary btn-sm">{t('common.cancel')}</button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-lg p-6 w-[420px]">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{t('page.payments.editInvoice')} — {editTarget.invoice_number}</h3>
            <div className="space-y-4">
              <div>
                <label className="label">{t('page.payments.total')} ({editTarget.currency || 'USD'})</label>
                <input className="input font-mono" type="number" step="0.01" value={editForm.total}
                  onChange={e => setEditForm({...editForm, total: parseFloat(e.target.value) || 0})} />
              </div>
              <div>
                <label className="label">{t('page.payments.dueDate')}</label>
                <input className="input" type="date" value={editForm.due_date}
                  onChange={e => setEditForm({...editForm, due_date: e.target.value})} />
              </div>
              <div>
                <label className="label">{t('page.payments.notes')}</label>
                <textarea className="input min-h-[60px] resize-y" value={editForm.notes}
                  onChange={e => setEditForm({...editForm, notes: e.target.value})} />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={saveEdit} className="btn-primary flex-1">{t('page.payments.saveChanges')}</button>
                <button onClick={() => setEditTarget(null) } className="btn-secondary">{t('common.cancel')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {payForm && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-lg p-6 w-[400px]">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{t('page.payments.recordPayment')}</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="label">{t('page.payments.amount')} ($)</label>
                <input className="input font-mono" type="number" value={payForm.amount || ''} onChange={e => setPayForm({...payForm, amount: parseFloat(e.target.value) || 0})} autoFocus />
              </div>
              <div>
                <label className="label">{t('page.payments.method')}</label>
                <select className="input" value={payForm.method} onChange={e => setPayForm({...payForm, method: e.target.value})}>
                  <option value="wire_transfer">{t('page.payments.wireTransfer')}</option>
                  <option value="credit_card">{t('page.payments.creditCard')}</option>
                  <option value="check">{t('page.payments.check')}</option>
                  <option value="cash">{t('page.payments.cash')}</option>
                </select>
              </div>
              <div>
                <label className="label">{t('page.payments.reference')}</label>
                <input className="input" value={payForm.ref} onChange={e => setPayForm({...payForm, ref: e.target.value})} placeholder={t('page.payments.transactionId')} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={recordPayment} disabled={!payForm.amount} className="btn-primary flex-1">{t('page.payments.recordPayment')}</button>
              <button onClick={() => setPayForm(null) } className="btn-secondary">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <input className="input max-w-sm" placeholder={t('common.searchInvoices')} value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex items-center gap-2">
        {['', 'issued', 'partial_paid', 'paid', 'overdue', 'cancelled'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === s ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}>
            {s ? t(`status.${s}`) : t('status.all')}
          </button>
        ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">{t('common.loading')}</div>
      ) : (
        <div className="card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="table-header">{t('page.payments.invoices')} #</th>
                <th className="table-header">{t('page.payments.order')}</th>
                <th className="table-header">{t('page.payments.company')}</th>
                <th className="table-header">{t('page.payments.status')}</th>
                <th className="table-header text-right">{t('page.payments.total')}</th>
                <th className="table-header text-right">{t('page.payments.paid')}</th>
                <th className="table-header text-right">{t('page.payments.due')}</th>
                <th className="table-header">{t('page.payments.dueDate')}</th>
                <th className="table-header w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv: any) => (
                <tr key={inv.id} className={`table-row ${isOverdue(inv) ? 'bg-red-50/30' : ''}`}>
                  <td className="table-cell font-medium">{inv.invoice_number}</td>
                  <td className="table-cell text-xs">{inv.order_number || '—'}</td>
                  <td className="table-cell text-xs">{inv.company_name || '—'}</td>
                  <td className="table-cell"><StatusBadge status={inv.status} /></td>
                  <td className="table-cell text-right font-mono text-sm">{formatCurrency(inv.total, inv.currency)}</td>
                  <td className="table-cell text-right font-mono text-xs text-green-600">{formatCurrency(inv.amount_paid, inv.currency)}</td>
                  <td className={`table-cell text-right font-mono text-sm ${isOverdue(inv) ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
                    {formatCurrency(inv.amount_due ?? inv.total, inv.currency)}
                  </td>
                  <td className="table-cell">
                    <span className={`text-xs ${isOverdue(inv) ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                      {inv.due_date?.slice(0, 10)}
                      {isOverdue(inv) && ` `}
                    </span>
                  </td>
                  {inv.status !== 'paid' && inv.status !== 'cancelled' ? (
                    <td className="table-cell">
                      <button onClick={() => setPayForm({ invoiceId: inv.id, amount: inv.amount_due || inv.total, method: 'wire_transfer', ref: '' })}
                        className="text-xs text-blue-600 hover:underline">{t('page.payments.pay')}</button>
                    </td>
                  ) : <td className="table-cell"></td>}
                  <td className="table-cell" onClick={e => e.stopPropagation()}>
                    <div className="relative">
                      <button onClick={() => setOpenMenu(openMenu === inv.id ? null : inv.id)} className="btn-ghost btn-sm text-xs px-1">⋮</button>
                      {openMenu === inv.id && (
                        <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-md z-20 py-1">
                          <button onClick={() => {
                            setOpenMenu(null);
                            setEditForm({ total: inv.total || 0, due_date: inv.due_date || '', notes: inv.notes || '' });
                            setEditTarget(inv);
                          }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                            <Icon name="square-pen" size={13} />{t('common.edit')}
                          </button>
                          {confirmDelete !== inv.id ? (
                            <button onClick={() => setConfirmDelete(inv.id)} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
                              <Icon name="delete" size={13} />{t('common.delete')}
                            </button>
                          ) : (
                            <div className="px-3 py-2">
                              <p className="text-2xs text-red-600 mb-1">{t('common.confirmDelete')}</p>
                              <div className="flex gap-1">
                                <button onClick={() => remove(inv.id)} className="text-xs bg-red-600 text-white px-2 py-0.5 rounded">{t('common.yes')}</button>
                                <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-500 px-2 py-0.5">{t('common.no')}</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-gray-400 text-sm">{t('noData.invoices')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
