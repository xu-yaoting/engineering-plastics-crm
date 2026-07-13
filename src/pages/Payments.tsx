import { useState, useEffect } from 'react';
import StatusBadge from '../components/shared/StatusBadge';
import { formatCurrency } from '../lib/currency';
import Icon from '../components/shared/Icon';
import { useTranslation } from 'react-i18next';
import { exportFullCsv } from '../lib/exportCsv';
import { toast } from '../lib/toast';
import { useAuth } from '../lib/auth';

export default function Payments() {
  const { t } = useTranslation();
  const { user } = useAuth();
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
  const [savingAction, setSavingAction] = useState<'create' | 'edit' | 'pay' | null>(null);

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

  // Re-fetch when window regains focus (e.g. after editing order number in another tab)
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/payments/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error(await readError(res, t('page.payments.failedDeleteInvoice')));
        return;
      }
      setConfirmDelete(null);
      load();
    } catch (e) {
      console.error('Delete failed', e);
      toast.error(t('page.payments.failedDeleteInvoice'));
    }
  };

  const saveEdit = async () => {
    if (!editTarget || savingAction) return;
    setSavingAction('edit');
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
      toast.success(t('page.payments.invoiceUpdated'));
      load();
    } catch (e) {
      console.error('Edit failed', e);
      toast.error(t('page.payments.failedUpdateInvoice'));
    } finally {
      setSavingAction(null);
    }
  };

  const createInvoice = async () => {
    if (!form.order_id || !form.total || savingAction) return;
    setSavingAction('create');
    try {
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
      toast.success(t('page.payments.invoiceCreated'));
      load();
    } catch (e) {
      console.error('Create invoice failed', e);
      toast.error(t('page.payments.failedCreateInvoice'));
    } finally {
      setSavingAction(null);
    }
  };

  const recordPayment = async () => {
    if (!payForm || savingAction) return;
    setSavingAction('pay');
    try {
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
      toast.success(t('page.payments.paymentRecorded'));
      load();
    } catch (e) {
      console.error('Record payment failed', e);
      toast.error(t('page.payments.failedRecordPayment'));
    } finally {
      setSavingAction(null);
    }
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
  const editableOrders = user?.role === 'admin'
    ? orders
    : orders.filter((order: any) => order.owner_user_id === user?.id);
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
    <div className="page-shell space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-heading">{t('nav.payments')}</h1>
          <p className="page-summary">{t('page.payments.outstanding')}</p>
        </div>
        <div className="page-actions">
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
        <div className="data-surface p-4 mb-6">
          <fieldset>
          <legend className="section-label mb-3">{t('page.payments.new')}</legend>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">{t('page.payments.order')} *</label>
              <select className="input" value={form.order_id} onChange={e => {
                const sel = orders.find(o => o.id === e.target.value);
                setForm({...form, order_id: e.target.value, total: sel?.total || 0});
              }}>
                <option value="">{t('select.order')}</option>
                {editableOrders.map((o: any) => <option key={o.id} value={o.id}>{o.order_number} — {o.company_name || ''}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t('page.payments.total')} *</label>
              <input className="input tabular-nums" type="number" value={form.total || ''} onChange={e => setForm({...form, total: parseFloat(e.target.value) || 0})} />
            </div>
            <div>
              <label className="label">{t('page.payments.dueDate')}</label>
              <input className="input" type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createInvoice} disabled={!form.order_id || !form.total || savingAction === 'create'} className="btn-primary btn-sm">
              {savingAction === 'create' ? t('page.payments.saving') : t('page.payments.createInvoice')}
            </button>
            <button onClick={() => setShowForm(false) } disabled={savingAction === 'create'} className="btn-secondary btn-sm">{t('common.cancel')}</button>
          </div>
          </fieldset>
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center">
          <div role="dialog" aria-modal="true" aria-label={t('page.payments.editInvoice')} className="modal-surface w-[min(420px,calc(100vw-2rem))] p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{t('page.payments.editInvoice')} — {editTarget.invoice_number}</h3>
            <div className="space-y-4">
              <dl className="grid grid-cols-1 gap-2 rounded border border-gray-200 bg-gray-50 p-3 text-xs sm:grid-cols-3">
                <div><dt className="text-gray-400">{t('accountability.owner')}</dt><dd className="mt-0.5 text-gray-700">{editTarget.owner_name || t('accountability.unassigned')}</dd></div>
                <div><dt className="text-gray-400">{t('accountability.createdBy')}</dt><dd className="mt-0.5 text-gray-700">{editTarget.created_by_name || t('accountability.historicalActorUnknown')}</dd></div>
                <div><dt className="text-gray-400">{t('accountability.updatedBy')}</dt><dd className="mt-0.5 text-gray-700">{editTarget.updated_by_name || t('accountability.historicalActorUnknown')}</dd></div>
              </dl>
              <div>
                <label className="label">{t('page.payments.total')} ({editTarget.currency || 'USD'})</label>
                <input className="input tabular-nums" type="number" step="0.01" value={editForm.total}
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
                <button onClick={saveEdit} disabled={savingAction === 'edit'} className="btn-primary flex-1">
                  {savingAction === 'edit' ? t('page.payments.saving') : t('page.payments.saveChanges')}
                </button>
                <button onClick={() => setEditTarget(null) } disabled={savingAction === 'edit'} className="btn-secondary">{t('common.cancel')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {payForm && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center">
          <div role="dialog" aria-modal="true" aria-label={t('page.payments.recordPayment')} className="modal-surface w-[min(400px,calc(100vw-2rem))] p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{t('page.payments.recordPayment')}</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="label">{t('page.payments.amount')} ($)</label>
                <input className="input tabular-nums" type="number" value={payForm.amount || ''} onChange={e => setPayForm({...payForm, amount: parseFloat(e.target.value) || 0})} autoFocus />
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
              <button onClick={recordPayment} disabled={!payForm.amount || savingAction === 'pay'} className="btn-primary flex-1">
                {savingAction === 'pay' ? t('page.payments.saving') : t('page.payments.recordPayment')}
              </button>
              <button onClick={() => setPayForm(null) } disabled={savingAction === 'pay'} className="btn-secondary">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      <div className="toolbar gap-3 overflow-x-auto">
        <div className="relative w-full max-w-sm shrink-0">
          <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input w-full pl-9" placeholder={t('common.searchInvoices')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="segmented-control whitespace-nowrap">
        {['', 'issued', 'partial_paid', 'paid', 'overdue', 'cancelled'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`segmented-option ${filter === s ? 'segmented-option-active' : ''}`}>
            {s ? t(`status.${s}`) : t('status.all')}
          </button>
        ))}
        </div>
      </div>

      {loading ? (
        <div className="data-surface p-3" aria-label={t('common.loading')}>
          <div className="animate-pulse space-y-2">
            {[0, 1, 2, 3, 4].map(row => <div key={row} className="h-10 rounded bg-gray-100" />)}
          </div>
        </div>
      ) : (
        <div className="data-surface overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="table-header">{t('page.payments.invoices')} #</th>
                <th className="table-header">{t('page.payments.order')}</th>
                <th className="table-header">{t('page.payments.company')}</th>
                <th className="table-header">{t('page.payments.status')}</th>
                <th className="table-header text-right">{t('page.payments.total')}</th>
                <th className="table-header text-right">{t('page.payments.paid')}</th>
                <th className="table-header text-right">{t('page.payments.due')}</th>
                <th className="table-header">{t('page.payments.dueDate')}</th>
                <th className="table-header hidden lg:table-cell">{t('accountability.owner')}</th>
                <th className="table-header w-16"></th>
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
                  <td className="table-cell text-right tabular-nums text-sm">{formatCurrency(inv.total, inv.currency)}</td>
                  <td className="table-cell text-right tabular-nums text-xs text-green-600">{formatCurrency(inv.amount_paid, inv.currency)}</td>
                  <td className={`table-cell text-right tabular-nums text-sm ${isOverdue(inv) ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
                    {formatCurrency(inv.amount_due ?? inv.total, inv.currency)}
                  </td>
                  <td className="table-cell">
                    <span className={`text-xs ${isOverdue(inv) ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                      {inv.due_date?.slice(0, 10)}
                      {isOverdue(inv) && ` `}
                    </span>
                  </td>
                  <td className="table-cell hidden lg:table-cell text-xs text-gray-500">{inv.owner_name || t('accountability.unassigned')}</td>
                  {inv.status !== 'paid' && inv.status !== 'cancelled' ? (
                    <td className="table-cell">
                      <button
                        onClick={() => setPayForm({ invoiceId: inv.id, amount: inv.amount_due || inv.total, method: 'wire_transfer', ref: '' })}
                        disabled={!inv.can_edit}
                        title={!inv.can_edit ? t('accountability.ownerOrAdminOnly') : undefined}
                        className="text-xs text-blue-600 hover:underline disabled:cursor-not-allowed disabled:text-gray-300 disabled:no-underline"
                      >{t('page.payments.pay')}</button>
                    </td>
                  ) : <td className="table-cell"></td>}
                  <td className="table-cell" onClick={e => e.stopPropagation()}>
                    <div className="relative">
                      <button onClick={() => setOpenMenu(openMenu === inv.id ? null : inv.id)} className="icon-btn" aria-label={t('common.moreActions')} title={t('common.moreActions')}>
                        <Icon name="more" size={16} />
                      </button>
                      {openMenu === inv.id && (
                        <div className="menu-surface absolute right-0 top-full mt-1 w-36">
                          <button disabled={!inv.can_edit} title={!inv.can_edit ? t('accountability.ownerOrAdminOnly') : undefined} onClick={() => {
                            setOpenMenu(null);
                            setEditForm({ total: inv.total || 0, due_date: inv.due_date || '', notes: inv.notes || '' });
                            setEditTarget(inv);
                          }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-white">
                            <Icon name="square-pen" size={13} />{t('common.edit')}
                          </button>
                          {user?.role === 'admin' && (confirmDelete !== inv.id ? (
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
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={11}><div className="empty-state">{t('noData.invoices')}</div></td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
