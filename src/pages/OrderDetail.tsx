import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import SidePanel from '../components/shared/SidePanel';
import StatusBadge from '../components/shared/StatusBadge';
import Icon from '../components/shared/Icon';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../lib/currency';
import AccountabilityPanel from '../components/shared/AccountabilityPanel';
import { team, type TeamMember } from '../lib/api';
import { useAuth } from '../lib/auth';

const statusFlow = [
  { key: 'draft', labelKey: 'status.draft' },
  { key: 'confirmed', labelKey: 'status.confirmed' },
  { key: 'in_production', labelKey: 'status.inProduction' },
  { key: 'quality_check', labelKey: 'status.qualityCheck' },
  { key: 'ready_to_ship', labelKey: 'status.readyToShip' },
  { key: 'shipped', labelKey: 'status.shipped' },
  { key: 'delivered', labelKey: 'status.delivered' },
];

function OrderDetailSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex h-full flex-col">
      <div aria-hidden="true" className="flex h-full flex-col animate-pulse motion-reduce:animate-none">
        <header className="flex-shrink-0 border-b border-gray-200 bg-white px-5 py-3">
          <div className="flex min-h-8 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-8 w-8 rounded-md bg-gray-200" />
              <div className="h-5 w-36 rounded bg-gray-200" />
              <div className="h-5 w-20 rounded bg-gray-100" />
              <div className="h-5 w-16 rounded bg-gray-100" />
            </div>
            <div className="h-8 w-44 rounded-md bg-gray-200" />
          </div>
          <div className="mt-2 h-3 w-72 max-w-full rounded bg-gray-100" />
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-gray-50">
          <div className="mx-auto max-w-5xl space-y-6 p-6">
            <section className="commercial-summary rounded-md border border-gray-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="space-y-3">
                  <div className="h-3 w-20 rounded bg-gray-100" />
                  <div className="h-8 w-44 rounded bg-gray-200" />
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  <div className="h-3 w-24 rounded bg-gray-100" />
                  <div className="h-3 w-20 rounded bg-gray-100" />
                  <div className="h-4 w-28 rounded bg-gray-200" />
                  <div className="h-4 w-24 rounded bg-gray-200" />
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <section className="space-y-5 lg:col-span-2">
                <div className="rounded-md border border-gray-200 bg-white">
                  <div className="border-b border-gray-200 px-4 py-3">
                    <div className="h-3 w-24 rounded bg-gray-200" />
                  </div>
                  <div className="divide-y divide-gray-100">
                    {Array.from({ length: 4 }, (_, index) => (
                      <div key={index} className="grid grid-cols-[minmax(0,2fr)_repeat(3,minmax(56px,1fr))] gap-3 px-4 py-4">
                        <div className="h-4 w-4/5 rounded bg-gray-200" />
                        <div className="h-4 rounded bg-gray-100" />
                        <div className="h-4 rounded bg-gray-100" />
                        <div className="h-4 rounded bg-gray-200" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="h-28 rounded-md border border-gray-200 bg-white p-4">
                  <div className="h-3 w-20 rounded bg-gray-200" />
                  <div className="mt-4 h-4 w-3/4 rounded bg-gray-100" />
                </div>
              </section>

              <aside className="space-y-4">
                {[144, 176, 112].map((height, index) => (
                  <div key={index} className="rounded-md border border-gray-200 bg-white p-4" style={{ height }}>
                    <div className="h-3 w-24 rounded bg-gray-200" />
                    <div className="mt-4 space-y-3">
                      <div className="h-3 w-full rounded bg-gray-100" />
                      <div className="h-3 w-4/5 rounded bg-gray-100" />
                      <div className="h-3 w-2/3 rounded bg-gray-100" />
                    </div>
                  </div>
                ))}
              </aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function OrderDetail() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [quotation, setQuotation] = useState<any>(null);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [editingShipQty, setEditingShipQty] = useState<Record<string, number>>({});
  const [editForm, setEditForm] = useState({
    customer_po_number: '', incoterm: '', payment_term: '', confirmed_delivery_date: '', shipping_address: '',
    order_date: '', order_number: '', owner_user_id: '',
  });

  useEffect(() => {
    if (user?.role === 'admin') {
      team.list().then(setMembers).catch(() => setMembers([]));
    }
  }, [user?.role]);

  const load = () => {
    if (!id) return;
    fetch(`/api/orders/${id}`).then(r => r.json()).then(data => {
      setOrder(data);
      setLineItems(data.line_items || []);
      // Load source quotation if exists
      if (data.quotation_id) {
        fetch(`/api/quotations/${data.quotation_id}`)
          .then(r => r.json())
          .then(setQuotation)
          .catch(() => {});
      }
    });
    fetch(`/api/shipments`).then(r => r.json()).then(all => setShipments(all.filter((s: any) => s.order_id === id)));
    fetch(`/api/payments`).then(r => r.json()).then(all => setInvoices(all.filter((i: any) => i.order_id === id)));
  };

  useEffect(() => { load(); }, [id]);

  const updateStatus = async (status: string) => {
    await fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const readError = async (res: Response, fallback: string) => {
    const data = await res.json().catch(() => null);
    return data?.error || data?.message || fallback;
  };

  const saveEdit = async () => {
    if (!id || savingEdit) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        toast.error(await readError(res, t('page.orderDetail.orderSaveFailed')));
        return;
      }
      setShowEditPanel(false);
      toast.success(t('page.orderDetail.orderUpdated'));
      load();
    } catch (e) {
      toast.error(t('page.orderDetail.orderSaveFailed'));
    } finally {
      setSavingEdit(false);
    }
  };

  const duplicate = async () => {
    if (!order) return;
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: order.company_id,
          contact_id: order.contact_id,
          quotation_id: order.quotation_id,
          currency: order.currency,
          subtotal: order.subtotal || 0,
          total: order.total || 0,
        }),
      });
      const dup = await res.json();
      navigate(`/orders/${dup.id}`);
    } catch (e) { toast.error(t('page.orderDetail.duplicateFailed')); }
  };

  const remove = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      navigate('/orders');
    } catch (e) {
      toast.error(t('page.orderDetail.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const updateLineItemUnit = async (lineItemId: string, newUnit: string) => {
    try {
      const res = await fetch(`/api/orders/line-items/${lineItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_of_measure: newUnit }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(t('page.orderDetail.unitUpdated'));
      load();
    } catch {
      toast.error(t('page.orderDetail.unitUpdateFailed'));
    }
  };

  if (!order) return <OrderDetailSkeleton label={t('common.loading')} />;

  const currentIdx = statusFlow.findIndex(s => s.key === order.status);
  const subtotal = lineItems.reduce((s: number, i: any) => s + (i.line_total || 0), 0);
  return (
    <div className="h-full flex flex-col overflow-x-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white px-5 py-3">
        <div className="page-header mb-0 min-h-0 items-stretch sm:items-center">
          <div className="flex min-w-0 items-start gap-2 sm:items-center sm:gap-3">
            <button onClick={() => navigate(-1)} className="icon-btn" aria-label={t('common.back')} title={t('common.back')}><Icon name="back" size={16} /></button>
            <h1 className="page-heading min-w-0 flex-1 text-lg sm:text-2xl tabular-nums">{order.order_number}</h1>
            <StatusBadge status={order.status} />
            <StatusBadge status={order.payment_status} />
          </div>
          <div className="page-actions w-full max-w-none flex-nowrap overflow-x-auto whitespace-nowrap pb-1 sm:w-auto sm:max-w-[58%] sm:flex-wrap [&>*]:shrink-0">
            <button onClick={() => {
              setEditForm({
                customer_po_number: order.customer_po_number || '',
                order_number: order.order_number || '',
                order_date: order.order_date?.slice(0, 10) || '',
                owner_user_id: order.owner_user_id || '',
                incoterm: order.incoterm || '',
                payment_term: order.payment_term || '',
                confirmed_delivery_date: order.confirmed_delivery_date || '',
                shipping_address: order.shipping_address || '',
              });
              setSavingEdit(false);
              setShowEditPanel(true);
            }} className="btn-primary btn-sm"><Icon name="square-pen" size={14} className="mr-1.5" />{t('common.edit')}</button>
            <Link to={`/shipments?order=${id}`} className="btn-secondary btn-sm"><Icon name="truck" size={14} className="mr-1.5" />{t('page.orderDetail.ship')}</Link>
            <button onClick={async () => {
              if (!order) return;
              try {
                const res = await fetch('/api/payments', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    order_id: id,
                    total: order.total || 0,
                    due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
                  }),
                });
                const inv = await res.json();
                toast.success(t('page.orderDetail.invoiceCreated', { number: inv.invoice_number }));
                window.location.href = '/payments';
              } catch (e) { toast.error(t('page.orderDetail.invoiceCreateFailed')); }
            }} className="btn-secondary btn-sm"><Icon name="file-down" size={14} className="mr-1.5" />{t('page.orderDetail.invoice')}</button>
            <div className="relative">
              <button onClick={() => setShowActions(!showActions)} className="icon-btn" aria-label={t('common.moreActions')} title={t('common.moreActions')}><Icon name="more" size={16} /></button>
              {showActions && (
                <div className="menu-surface absolute right-0 top-full mt-1 w-40">
                  <button onClick={() => { setShowActions(false); duplicate(); }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"><Icon name="copy" size={13} />{t('common.duplicate')}</button>
                  <button onClick={() => { setShowActions(false); setConfirmDelete(true); }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"><Icon name="delete" size={13} />{t('common.delete')}</button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          <Link to={`/companies/${order.company_id}`} className="text-blue-600 hover:underline">{order.company_name}</Link>
          {order.customer_po_number && ` · PO: ${order.customer_po_number}`}
          {` · ${order.currency || 'USD'}`}
          {order.order_date && ` · ${t('page.orderDetail.ordered')}: ${order.order_date}`}
          {order.requested_delivery_date && ` · ${t('page.orderDetail.requested')}: ${order.requested_delivery_date}`}
          {order.quotation_id && (
            <span> · {t('page.orderDetail.source')}: <Link to={`/quotations/${order.quotation_id}`} className="text-blue-600 hover:underline">{t('page.orderDetail.quotationPrefix')} #{order.quotation_id?.slice(0, 8)}</Link></span>
          )}
        </div>
      </div>

      <SidePanel
        open={showEditPanel}
        onClose={() => {
          if (!savingEdit) setShowEditPanel(false);
        }}
        title={t('common.edit')}
        subtitle={order.order_number}
        width="w-[min(500px,calc(100vw-1rem))]"
      >
        <div className="space-y-4">
          {user?.role === 'admin' && (
            <div>
              <label className="label" htmlFor="order-edit-owner">{t('accountability.owner')}</label>
              <select
                id="order-edit-owner"
                className="input"
                value={editForm.owner_user_id}
                onChange={e => setEditForm({ ...editForm, owner_user_id: e.target.value })}
              >
                <option value="">{t('accountability.unassigned')}</option>
                {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="order-edit-po-number">{t('page.orderDetail.poNumber')}</label>
              <input id="order-edit-po-number" className="input" value={editForm.customer_po_number} onChange={e => setEditForm({...editForm, customer_po_number: e.target.value})} />
            </div>
            <div>
              <label className="label" htmlFor="order-edit-order-number">{t('page.orderDetail.orderNumber')}</label>
              <input id="order-edit-order-number" className="input tabular-nums" value={editForm.order_number} onChange={e => setEditForm({...editForm, order_number: e.target.value})} />
            </div>
            <div>
              <label className="label" htmlFor="order-edit-incoterm">{t('page.orderDetail.incoterm')}</label>
              <input id="order-edit-incoterm" className="input" value={editForm.incoterm} onChange={e => setEditForm({...editForm, incoterm: e.target.value})} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="order-edit-order-date">{t('page.orderDetail.orderDate')}</label>
              <input id="order-edit-order-date" className="input" type="date" value={editForm.order_date} onChange={e => setEditForm({...editForm, order_date: e.target.value})} />
            </div>
            <div>
              <label className="label" htmlFor="order-edit-delivery-date">{t('page.orderDetail.deliveryDate')}</label>
              <input id="order-edit-delivery-date" className="input" type="date" value={editForm.confirmed_delivery_date} onChange={e => setEditForm({...editForm, confirmed_delivery_date: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="order-edit-payment-terms">{t('page.orderDetail.paymentTerms')}</label>
            <input id="order-edit-payment-terms" className="input" value={editForm.payment_term} onChange={e => setEditForm({...editForm, payment_term: e.target.value})} />
          </div>
          <div>
            <label className="label" htmlFor="order-edit-shipping-address">{t('page.orderDetail.shippingAddress')}</label>
            <input id="order-edit-shipping-address" className="input" value={editForm.shipping_address} onChange={e => setEditForm({...editForm, shipping_address: e.target.value})} autoComplete="street-address" />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={saveEdit} disabled={savingEdit} className="btn-primary flex-1">
              {savingEdit ? t('page.orderDetail.saving') : t('common.save')}
            </button>
            <button onClick={() => setShowEditPanel(false)} disabled={savingEdit} className="btn-secondary">{t('common.cancel')}</button>
          </div>
        </div>
      </SidePanel>
      <ConfirmDialog
        open={confirmDelete}
        title={t('common.delete')}
        description={<>{t('common.confirmDelete')} <strong>{order.order_number}</strong></>}
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />

      {/* Progress Bar */}
      <div className="bg-white border-b border-gray-200 px-5 py-4">
        <div className="flex items-center max-w-3xl overflow-x-auto">
          {statusFlow.map((s, idx) => (
            <div key={s.key} className="flex items-center flex-shrink-0">
              <button
                onClick={() => updateStatus(s.key)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${
                  idx <= currentIdx ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`w-3 h-3 rounded-full ${idx <= currentIdx ? 'bg-blue-600' : 'bg-gray-200'}`} />
                <span className={`text-2xs font-450 whitespace-nowrap ${idx === currentIdx ? 'font-semibold' : ''}`}>{t(s.labelKey)}</span>
              </button>
              {idx < statusFlow.length - 1 && <div className={`w-6 h-0.5 mx-1 ${idx < currentIdx ? 'bg-blue-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          {/* ── Order Summary ── */}
          <div className="section-band commercial-summary p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="section-label text-gray-400">{t('page.orderDetail.totalAmount')}</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">{formatCurrency(order.total || subtotal, order.currency)}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={order.status} />
                <StatusBadge status={order.payment_status} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-gray-200 pt-4 md:grid-cols-4">
              <SummaryField label={t('page.inquiryDetail.customer')} value={
                <Link to={`/companies/${order.company_id}`} className="text-blue-600 hover:underline">{order.company_name}</Link>
              } />
              <SummaryField label={t('page.orderDetail.orderNumber')} value={order.order_number} mono />
              <SummaryField label={t('page.orderDetail.status')} value={<StatusBadge status={order.status} />} />
              <SummaryField label={t('page.orderDetail.payment')} value={<StatusBadge status={order.payment_status} />} />
              <SummaryField label={t('page.orderDetail.orderDate')} value={order.order_date || '—'} />
              <SummaryField label={t('page.orderDetail.poNumber')} value={order.customer_po_number || '—'} mono />
              <SummaryField label={t('page.orderDetail.incoterm')} value={order.incoterm || '—'} />
              <SummaryField label={t('page.quotationDetail.currency')} value={order.currency || 'USD'} />
              <SummaryField label={t('page.orderDetail.paymentTerms')} value={order.payment_term || '—'} />
              <SummaryField label={t('page.orderDetail.deliveryDate')} value={order.confirmed_delivery_date || '—'} />
              <SummaryField label={t('page.orderDetail.source')} value={
                order.quotation_id
                  ? <Link to={`/quotations/${order.quotation_id}`} className="text-blue-600 hover:underline">{t('page.orderDetail.viewOriginalQuotation')}</Link>
                  : '—'
              } />
            </div>
          </div>

          <div className="section-band p-4">
            <AccountabilityPanel entityType="order" entityId={id!} record={order} />
          </div>

          {/* ── Line Items ── */}
          <div className="data-surface overflow-x-auto">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="section-label">{t('page.orderDetail.lineItems')}</h3>
            </div>
            <div className="space-y-2 p-3 md:hidden">
              {lineItems.map((item: any) => {
                const sq = editingShipQty[item.id] ?? item.quantity_shipped ?? 0;
                const shippedTotal = (item.unit_price || 0) * sq;
                return (
                  <div key={item.id} className="rounded-md border border-gray-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-2xs font-medium uppercase tracking-wide text-gray-400">#{item.line_number}</p>
                        <p className="mt-1 truncate text-sm font-medium text-gray-900">{item.product_grade_snapshot || '—'}</p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">{formatCurrency(item.line_total || 0, order.currency)}</p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
                      <div>
                        <p className="section-label">{t('page.orderDetail.ordered')}</p>
                        <p className="mt-1 text-sm tabular-nums text-gray-700">{item.quantity_ordered}</p>
                      </div>
                      <div>
                        <label className="section-label" htmlFor={`order-line-mobile-${item.id}-shipped-quantity`}>
                          {t('page.orderDetail.shipped')}
                        </label>
                        <input
                          id={`order-line-mobile-${item.id}-shipped-quantity`}
                          className="input mt-1 h-8 w-full text-right tabular-nums text-sm"
                          type="number" min="0"
                          value={sq}
                          onChange={e => setEditingShipQty(prev => ({...prev, [item.id]: parseFloat(e.target.value) || 0}))}
                        />
                      </div>
                      <div>
                        <label className="section-label" htmlFor={`order-line-mobile-${item.id}-unit`}>
                          {t('page.orderDetail.unit')}
                        </label>
                        <select
                          id={`order-line-mobile-${item.id}-unit`}
                          className="input mt-1 h-8 w-full px-1.5 text-xs"
                          value={item.unit_of_measure || ''}
                          onChange={e => updateLineItemUnit(item.id, e.target.value)}
                        >
                          <option value="kg">kg</option>
                          <option value="lb">lb</option>
                          <option value="m">m</option>
                          <option value="sheet">sheet</option>
                          <option value="pc">pc</option>
                        </select>
                      </div>
                      <div>
                        <p className="section-label">{t('page.orderDetail.price')}</p>
                        <p className="mt-1 text-sm tabular-nums text-gray-700">{formatCurrency(item.unit_price || 0, order.currency)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs">
                      <span className="text-gray-500">{t('page.orderDetail.shippedTotal')}</span>
                      <span className="font-medium tabular-nums text-blue-600">{formatCurrency(shippedTotal, order.currency)}</span>
                    </div>
                  </div>
                );
              })}
              {lineItems.length === 0 && <div className="empty-state">{t('noData.lineItemsFromSource')}</div>}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[920px]">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="table-header">#</th>
                    <th className="table-header">{t('page.orderDetail.product')}</th>
                    <th className="table-header text-right">{t('page.orderDetail.ordered')}</th>
                    <th className="table-header text-right">{t('page.orderDetail.shipped')}</th>
                    <th className="table-header">{t('page.orderDetail.unit')}</th>
                    <th className="table-header text-right">{t('page.orderDetail.price')}</th>
                    <th className="table-header text-right">{t('page.orderDetail.lineTotal')}</th>
                    <th className="table-header text-right">{t('page.orderDetail.shippedTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item: any) => {
                    const sq = editingShipQty[item.id] ?? item.quantity_shipped ?? 0;
                    const shippedTotal = (item.unit_price || 0) * sq;
                    return (
                      <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="table-cell text-xs text-gray-400">{item.line_number}</td>
                        <td className="table-cell text-sm text-gray-900">{item.product_grade_snapshot || '—'}</td>
                        <td className="table-cell text-right tabular-nums text-sm">{item.quantity_ordered}</td>
                        <td className="table-cell text-right relative">
                          <label className="sr-only" htmlFor={`order-line-${item.id}-shipped-quantity`}>
                            {t('page.orderDetail.shipped')}
                          </label>
                          <input
                            id={`order-line-${item.id}-shipped-quantity`}
                            className="input text-right tabular-nums text-sm w-20 h-7"
                            type="number" min="0"
                            value={sq}
                            onChange={e => setEditingShipQty(prev => ({...prev, [item.id]: parseFloat(e.target.value) || 0}))}
                          />
                        </td>
                        <td className="table-cell relative">
                          <label className="sr-only" htmlFor={`order-line-${item.id}-unit`}>
                            {t('page.orderDetail.unit')}
                          </label>
                          <select
                            id={`order-line-${item.id}-unit`}
                            className="input text-xs h-7 py-0 px-1.5"
                            value={item.unit_of_measure || ''}
                            onChange={e => updateLineItemUnit(item.id, e.target.value)}
                          >
                            <option value="kg">kg</option>
                            <option value="lb">lb</option>
                            <option value="m">m</option>
                            <option value="sheet">sheet</option>
                            <option value="pc">pc</option>
                          </select>
                        </td>
                        <td className="table-cell text-right tabular-nums text-sm">{formatCurrency(item.unit_price || 0, order.currency)}</td>
                        <td className="table-cell text-right tabular-nums text-sm font-medium">{formatCurrency(item.line_total || 0, order.currency)}</td>
                        <td className="table-cell text-right tabular-nums text-sm font-medium text-blue-600">{formatCurrency(shippedTotal, order.currency)}</td>
                      </tr>
                    );
                  })}
                  {lineItems.length === 0 && (
                    <tr><td colSpan={8}><div className="empty-state">{t('noData.lineItemsFromSource')}</div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={async () => {
                  if (!id) return;
                  const updates = Object.entries(editingShipQty).map(([lineItemId, qty]) => (
                    fetch(`/api/orders/line-items/${lineItemId}`, {
                      method: 'PUT',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({ quantity_shipped: qty }),
                    })
                  ));
                  await Promise.all(updates);
                  setEditingShipQty({});
                  load();
                }} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                  disabled={Object.keys(editingShipQty).length === 0}>
                  <Icon name="save" size={14} />{t('page.orderDetail.shippedQty')}
                </button>
              </div>
              <div className="w-48 space-y-1">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>{t('page.orderDetail.subtotal')}</span>
                  <span className="tabular-nums">{formatCurrency(order.subtotal || subtotal, order.currency)}</span>
                </div>
                {order.discount_percent > 0 && (
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>{t('page.quotationDetail.discount')} ({order.discount_percent}%)</span>
                    <span className="tabular-nums">-{formatCurrency(order.discount_amount || 0, order.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t border-gray-200">
                  <span>{t('page.orderDetail.total')}</span>
                  <span className="tabular-nums text-base">{formatCurrency(order.total || subtotal, order.currency)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="section-label">{t('page.orderDetail.shipment')} ({shipments.length})</h3>
              <Link to="/shipments" className="text-xs text-blue-600 hover:underline font-medium">{t('common.edit')}</Link>
            </div>
            {shipments.length === 0 ? (
              <p className="text-xs text-gray-400">{t('page.orderDetail.noShipmentLinked')} <Link to="/shipments" className="text-blue-600 hover:underline">{t('page.orderDetail.createFromShipments')}</Link></p>
            ) : (
              <div className="space-y-3">
                {shipments.map((s: any) => (
                  <div key={s.id} className="rounded border border-gray-200 bg-white p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-900">{s.shipment_number}</span>
                        <StatusBadge status={s.status} />
                      </div>
                      <Link to={`/shipments/${s.id}`} className="text-2xs text-blue-600 hover:underline">{t('page.orderDetail.viewDetails')} </Link>
                    </div>
                    <ShipmentFieldsDisplay shipment={s} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Invoices Summary ── */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="section-label">{t('page.payments.invoices')} ({invoices.length})</h3>
              <button onClick={() => navigate('/payments')} className="text-xs text-blue-600 hover:underline">{t('page.orderDetail.viewAll')}</button>
            </div>
            {invoices.length === 0 ? (
              <p className="text-xs text-gray-400">{t('page.orderDetail.noInvoicesCreated')}</p>
            ) : (
              <div className="space-y-2">
                {invoices.slice(0, 3).map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                    <div><span className="text-xs font-medium text-gray-900">{inv.invoice_number}</span><span className="text-2xs text-gray-400 ml-2">{t('page.payments.due')}: {inv.due_date?.slice(0, 10)}</span></div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs tabular-nums ${(inv.amount_due || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(inv.amount_due || 0, inv.currency || order.currency)}</span>
                      <StatusBadge status={inv.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryField({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-2xs text-gray-400 mb-0.5">{label}</div>
      <div className={`text-sm text-gray-900 ${mono ? 'tabular-nums' : ''}`}>{value}</div>
    </div>
  );
}

function ShipmentFieldsDisplay({ shipment }: { shipment: any }) {
  const { t } = useTranslation();
  const shipType = shipment.shipping_type || 'sea_freight';
  const typeLabel: Record<string, string> = {
    sea_freight: t('page.shipments.seaFreight'),
    air_freight: t('page.shipments.airFreight'),
    express: t('page.shipments.express'),
    truck: t('page.shipments.truck'),
    pickup: t('page.shipments.pickup'),
  };
  const label: Record<string, string> = {
    container_no: t('page.shipments.containerNo'),
    vessel: t('page.shipments.vessel'),
    voyage: t('page.shipments.voyage'),
    awb: t('page.shipments.awb'),
    airline: t('page.shipments.airline'),
    express_provider: t('page.shipments.provider'),
    tracking_number: t('page.shipments.trackingNumber'),
    etd: t('page.shipments.etd'),
    eta: t('page.shipments.eta'),
    carrier: t('page.shipments.carrier'),
    shipping_address: t('page.shipments.address'),
  };
  const f = (k: string) => shipment[k] || '—';

  const Field = ({ k, mono }: { k: string; mono?: boolean }) => (
    <div><span className="text-gray-400">{label[k] || k}</span><br /><span className={mono ? 'tabular-nums' : ''}>{f(k)}</span></div>
  );

  const commonFields = (
    <>
      <Field k="etd" />
      <Field k="eta" />
    </>
  );

  return (
    <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
      <div><span className="text-gray-400">{t('page.shipments.type')}</span><br /><span className="font-medium text-gray-900">{typeLabel[shipType] || shipType}</span></div>
      {shipType === 'sea_freight' && <><Field k="container_no" mono /><Field k="vessel" /><Field k="voyage" />{commonFields}</>}
      {shipType === 'air_freight' && <><Field k="awb" mono /><Field k="airline" />{commonFields}</>}
      {shipType === 'express' && <><Field k="express_provider" /><Field k="tracking_number" mono /></>}
      {shipType === 'truck' && <><Field k="carrier" />{commonFields}</>}
      {shipType === 'pickup' && <div className="col-span-2"><Field k="shipping_address" /></div>}
      {shipment.notes && <div className="col-span-3"><span className="text-gray-400">{t('page.shipments.notes')}</span><br /><span>{shipment.notes}</span></div>}
    </div>
  );
}
