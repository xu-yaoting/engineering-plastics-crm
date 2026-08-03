import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import StatusBadge from '../components/shared/StatusBadge';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import SidePanel from '../components/shared/SidePanel';
import Icon from '../components/shared/Icon';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

const SHIPPING_TYPES = [
  { value: 'sea_freight', labelKey: 'seaFreight' },
  { value: 'air_freight', labelKey: 'airFreight' },
  { value: 'express', labelKey: 'express' },
  { value: 'truck', labelKey: 'truck' },
  { value: 'pickup', labelKey: 'pickup' },
];

const SHIPPING_STATUSES = [
  'pending_pickup', 'in_transit', 'out_for_delivery', 'delivered', 'exception',
];

const defaultForm = (order_id = '') => ({
  order_id,
  shipping_type: 'express',
  status: 'pending_pickup',
  carrier: '',
  tracking_number: '',
  container_no: '',
  vessel: '',
  voyage: '',
  awb: '',
  airline: '',
  express_provider: '',
  etd: '',
  eta: '',
  shipping_address: '',
  shipped_at: '',
  notes: '',
  estimated_delivery_date: '',
});

const shipmentCarrier = (shipment: any) => {
  switch (shipment.shipping_type) {
    case 'air_freight': return shipment.airline || shipment.carrier || '';
    case 'express': return shipment.express_provider || shipment.carrier || '';
    case 'pickup': return '';
    default: return shipment.carrier || shipment.vessel || '';
  }
};

const shipmentReference = (shipment: any) => shipment.tracking_number || shipment.awb || '';

export default function Shipments() {
  const { t } = useTranslation();
  const [list, setList] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(defaultForm());
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [presetOrder, setPresetOrder] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [searchParams] = useSearchParams();
  const presetOrderId = searchParams.get('order');

  useEffect(() => {
    fetch('/api/shipments').then(r => r.json()).then(setList).finally(() => setLoading(false));
    fetch('/api/orders').then(r => r.json()).then(setOrders);
  }, []);

  // Auto-fill from ?order=xxx query param
  useEffect(() => {
    if (presetOrderId) {
      fetch(`/api/orders/${presetOrderId}`).then(r => r.json()).then(order => {
        if (!order || order.error) return;
        setPresetOrder(order);
        setForm(defaultForm(presetOrderId));
        setShowForm(true);
      }).catch(() => {});
    }
  }, [presetOrderId]);

  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const readError = async (res: Response, fallback: string) => {
    const data = await res.json().catch(() => null);
    return data?.error || data?.message || fallback;
  };

  const remove = async () => {
    if (!deleteTarget?.id || deleting) return;
    const id = deleteTarget.id;
    setDeleting(true);
    try {
      const res = await fetch(`/api/shipments/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error(await readError(res, t('page.shipments.deleteFailed')));
        return;
      }
      setDeleteTarget(null);
      toast.success(t('page.shipments.shipmentDeleted'));
      fetch('/api/shipments').then(r => r.json()).then(setList);
    } catch (e) {
      toast.error(t('page.shipments.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const save = async () => {
    if (!form.order_id || saving) return;
    setSaving(true);
    try {
      let res: Response;
      if (editId) {
        res = await fetch(`/api/shipments/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else {
        res = await fetch('/api/shipments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }
      if (!res.ok) {
        toast.error(await readError(res, t('page.shipments.shipmentSaveFailed')));
        return;
      }
      setShowForm(false);
      setEditId(null);
      toast.success(t('page.shipments.shipmentSaved'));
      setForm(defaultForm());
      fetch('/api/shipments').then(r => r.json()).then(setList);
    } catch (e) {
      toast.error(t('page.shipments.shipmentSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const st = form.shipping_type;
  const shipmentTypeLabel = (value: string) => {
    const type = SHIPPING_TYPES.find(x => x.value === value);
    return type ? t(`page.shipments.${type.labelKey}`) : value;
  };
  const shipmentStatusLabel = (value: string) => t(`status.${value}`);

  const filtered = list.filter(s =>
    !search ||
    s.shipment_number?.toLowerCase().includes(search.toLowerCase()) ||
    s.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    s.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    shipmentCarrier(s).toLowerCase().includes(search.toLowerCase()) ||
    shipmentReference(s).toLowerCase().includes(search.toLowerCase())
  );

  const renderMobileShipment = (s: any) => (
    <Link
      key={s.id}
      to={`/shipments/${s.id}`}
      className="block rounded-md border border-gray-200 bg-white p-3 transition-colors hover:border-blue-200 hover:bg-blue-50/30"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium tabular-nums text-blue-600">{s.shipment_number}</span>
          <span className="mt-0.5 block truncate text-xs text-gray-500">{s.company_name || '—'}</span>
        </div>
        <StatusBadge status={s.status} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-gray-100 pt-3 text-xs">
        <div className="min-w-0">
          <dt className="text-2xs text-gray-400">{t('page.shipments.order')}</dt>
          <dd className="mt-0.5 truncate tabular-nums text-gray-700">{s.order_number || '—'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-2xs text-gray-400">{t('page.shipments.type')}</dt>
          <dd className="mt-0.5 truncate text-gray-700">{shipmentTypeLabel(s.shipping_type) || '—'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-2xs text-gray-400">{t('page.shipments.carrierParty')}</dt>
          <dd className="mt-0.5 truncate text-gray-700">{shipmentCarrier(s) || '—'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-2xs text-gray-400">{t('page.shipments.referenceNumber')}</dt>
          <dd className="mt-0.5 truncate tabular-nums text-gray-700">{shipmentReference(s) || '—'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-2xs text-gray-400">{t('page.shipments.shipDate')}</dt>
          <dd className="mt-0.5 truncate tabular-nums text-gray-500">{s.shipped_at?.slice(0, 10) || '—'}</dd>
        </div>
      </dl>
    </Link>
  );

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-heading">{t('page.title.shipments')}</h1>
          <p className="page-summary tabular-nums">{list.length} {t('page.title.shipments')}</p>
        </div>
        <div className="page-actions">
          <button onClick={() => { setEditId(null); setForm(defaultForm()); setShowForm(true); }} className="btn-primary btn-sm"><Icon name="plus" size={16} className="mr-1.5" />{t('page.shipments.new')}</button>
        </div>
      </div>

      <div className="toolbar">
        <div className="relative w-full max-w-sm">
          <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <label className="sr-only" htmlFor="shipments-search">{t('common.searchShipments')}</label>
          <input id="shipments-search" className="input w-full pl-9" placeholder={t('common.searchShipments')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <SidePanel
        open={showForm}
        onClose={() => {
          if (!saving) {
            setShowForm(false);
            setEditId(null);
          }
        }}
        title={editId ? t('page.shipments.editShipment') : t('page.shipments.new')}
        subtitle={presetOrder?.order_number}
        width="w-[min(560px,calc(100vw-1rem))]"
      >
        <div className="data-surface p-4 mb-6">
          <h3 className="section-label mb-4">
            {editId ? t('page.shipments.editShipment') : t('page.shipments.new')}
          </h3>
          {/* Show pre-selected order info when coming from Order Detail */}
          {presetOrder && (
            <div className="mb-4 space-y-1 rounded border border-gray-200 bg-gray-50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">{presetOrder.order_number}</span>
                <span className="text-xs text-gray-500">{presetOrder.company_name}</span>
              </div>
              {presetOrder.line_items && presetOrder.line_items.length > 0 && (
                <div className="text-xs text-gray-600 mt-1">
                  {t('page.shipments.items')}: {presetOrder.line_items.map((li: any) => `${li.quantity_ordered}x ${li.product_grade_snapshot}`).join(', ')}
                </div>
              )}
            </div>
          )}
          <fieldset className="space-y-3">
            <legend className="sr-only">{editId ? t('page.shipments.editShipment') : t('page.shipments.new')}</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="shipment-create-order">{t('page.shipments.order')} *</label>
                <select id="shipment-create-order" className="input" value={form.order_id} onChange={e => set('order_id', e.target.value)} required>
                  <option value="">{t('page.shipments.selectOrder')}</option>
                  {orders.map((o: any) => (
                    <option key={o.id} value={o.id}>{o.order_number} — {o.company_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="shipment-create-ship-date">{t('page.shipments.shipDate')}</label>
                <input id="shipment-create-ship-date" className="input" type="date" value={form.shipped_at} onChange={e => set('shipped_at', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="shipment-create-type">{t('page.shipments.shipmentType')}</label>
                <select id="shipment-create-type" className="input" value={st} onChange={e => set('shipping_type', e.target.value)}>
                  {SHIPPING_TYPES.map(x => <option key={x.value} value={x.value}>{t(`page.shipments.${x.labelKey}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="shipment-create-status">{t('page.shipments.status')}</label>
                <select id="shipment-create-status" className="input" value={form.status} onChange={e => set('status', e.target.value)}>
                  {SHIPPING_STATUSES.map(s => <option key={s} value={s}>{shipmentStatusLabel(s)}</option>)}
                </select>
              </div>
            </div>

            {/* Sea Freight */}
            {st === 'sea_freight' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><label className="label" htmlFor="shipment-create-carrier">{t('page.shipments.carrierForwarder')}</label><input id="shipment-create-carrier" className="input" value={form.carrier} onChange={e => set('carrier', e.target.value)} /></div>
                <div><label className="label" htmlFor="shipment-create-reference">{t('page.shipments.billOfLading')}</label><input id="shipment-create-reference" className="input tabular-nums" value={form.tracking_number} onChange={e => set('tracking_number', e.target.value)} /></div>
                <div><label className="label" htmlFor="shipment-create-container">{t('page.shipments.containerNo')}</label><input id="shipment-create-container" className="input tabular-nums" value={form.container_no} onChange={e => set('container_no', e.target.value)} placeholder="e.g. MSCU4820347" /></div>
                <div><label className="label" htmlFor="shipment-create-vessel">{t('page.shipments.vessel')}</label><input id="shipment-create-vessel" className="input" value={form.vessel} onChange={e => set('vessel', e.target.value)} placeholder="e.g. EVER FORTUNE" /></div>
                <div><label className="label" htmlFor="shipment-create-voyage">{t('page.shipments.voyage')}</label><input id="shipment-create-voyage" className="input" value={form.voyage} onChange={e => set('voyage', e.target.value)} placeholder="e.g. 123E" /></div>
                <div><label className="label" htmlFor="shipment-create-etd">{t('page.shipments.etd')}</label><input id="shipment-create-etd" className="input" type="date" value={form.etd} onChange={e => set('etd', e.target.value)} /></div>
                <div><label className="label" htmlFor="shipment-create-eta">{t('page.shipments.eta')}</label><input id="shipment-create-eta" className="input" type="date" value={form.eta} onChange={e => set('eta', e.target.value)} /></div>
              </div>
            )}

            {/* Air Freight */}
            {st === 'air_freight' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><label className="label" htmlFor="shipment-create-airline">{t('page.shipments.airlineForwarder')}</label><input id="shipment-create-airline" className="input" value={form.airline} onChange={e => set('airline', e.target.value)} placeholder="e.g. Cathay Pacific" /></div>
                <div><label className="label" htmlFor="shipment-create-reference">{t('page.shipments.awb')}</label><input id="shipment-create-reference" className="input tabular-nums" value={form.tracking_number} onChange={e => set('tracking_number', e.target.value)} placeholder={t('page.shipments.airWaybillPlaceholder')} /></div>
                <div><label className="label" htmlFor="shipment-create-etd">{t('page.shipments.etd')}</label><input id="shipment-create-etd" className="input" type="date" value={form.etd} onChange={e => set('etd', e.target.value)} /></div>
                <div><label className="label" htmlFor="shipment-create-eta">{t('page.shipments.eta')}</label><input id="shipment-create-eta" className="input" type="date" value={form.eta} onChange={e => set('eta', e.target.value)} /></div>
              </div>
            )}

            {/* Express */}
            {st === 'express' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><label className="label" htmlFor="shipment-create-express-provider">{t('page.shipments.provider')}</label><input id="shipment-create-express-provider" className="input" value={form.express_provider} onChange={e => set('express_provider', e.target.value)} placeholder="DHL, FedEx, UPS..." /></div>
                <div><label className="label" htmlFor="shipment-create-reference">{t('page.shipments.trackingNumber')}</label><input id="shipment-create-reference" className="input tabular-nums" value={form.tracking_number} onChange={e => set('tracking_number', e.target.value)} /></div>
                <div><label className="label" htmlFor="shipment-create-estimated-delivery">{t('page.shipments.estimatedDelivery')}</label><input id="shipment-create-estimated-delivery" className="input" type="date" value={form.estimated_delivery_date} onChange={e => set('estimated_delivery_date', e.target.value)} /></div>
              </div>
            )}

            {/* Truck */}
            {st === 'truck' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><label className="label" htmlFor="shipment-create-carrier">{t('page.shipments.logisticsCompany')}</label><input id="shipment-create-carrier" className="input" value={form.carrier} onChange={e => set('carrier', e.target.value)} /></div>
                <div><label className="label" htmlFor="shipment-create-reference">{t('page.shipments.waybillNumber')}</label><input id="shipment-create-reference" className="input tabular-nums" value={form.tracking_number} onChange={e => set('tracking_number', e.target.value)} /></div>
                <div><label className="label" htmlFor="shipment-create-estimated-delivery">{t('page.shipments.estimatedDelivery')}</label><input id="shipment-create-estimated-delivery" className="input" type="date" value={form.estimated_delivery_date} onChange={e => set('estimated_delivery_date', e.target.value)} /></div>
              </div>
            )}

            {/* Pickup */}
            {st === 'pickup' && (
              <div>
                <label className="label" htmlFor="shipment-create-pickup-address">{t('page.shipments.address')}</label>
                <textarea id="shipment-create-pickup-address" className="input min-h-[60px] resize-y" value={form.shipping_address} onChange={e => set('shipping_address', e.target.value)} placeholder={t('page.shipments.pickupAddress')} autoComplete="street-address" />
              </div>
            )}

            <div>
              <label className="label" htmlFor="shipment-create-notes">{t('page.shipments.notes')}</label>
              <textarea id="shipment-create-notes" className="input min-h-[50px] resize-y" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder={t('page.shipments.optionalNotes')} />
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={save} disabled={!form.order_id || saving} className="btn-primary btn-sm flex-1">
                {saving ? t('page.shipments.saving') : editId ? t('page.shipments.saveChanges') : t('page.shipments.createShipment')}
              </button>
              <button onClick={() => { setShowForm(false); setEditId(null); }} disabled={saving} className="btn-secondary btn-sm">{t('common.cancel')}</button>
            </div>
          </fieldset>
        </div>
      </SidePanel>

      {loading ? (
        <div className="data-surface p-3" aria-label={t('common.loading')}>
          <div className="animate-pulse space-y-2">
            {[0, 1, 2, 3, 4].map(row => <div key={row} className="h-10 rounded bg-gray-100" />)}
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {filtered.map(renderMobileShipment)}
            {filtered.length === 0 && (
              <div className="empty-state rounded-md border border-gray-200 bg-white">
                {search ? t('page.shipments.noShipmentsMatchSearch') : t('noData.shipments')}
              </div>
            )}
          </div>
          <div className="hidden data-surface overflow-x-auto md:block">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="table-header">{t('page.shipments.shipmentNumber')}</th>
                <th className="table-header">{t('page.shipments.order')}</th>
                <th className="table-header">{t('page.shipments.company')}</th>
                <th className="table-header">{t('page.shipments.type')}</th>
                <th className="table-header">{t('page.shipments.carrierParty')}</th>
                <th className="table-header">{t('page.shipments.referenceNumber')}</th>
                <th className="table-header">{t('page.shipments.shipDate')}</th>
                <th className="table-header">{t('page.shipments.status')}</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s: any) => (
                <tr key={s.id} className="table-row">
                  <td className="table-cell font-medium text-blue-600">
                    <Link to={`/shipments/${s.id}`} className="hover:underline">{s.shipment_number}</Link>
                  </td>
                  <td className="table-cell text-xs">{s.order_number || '—'}</td>
                  <td className="table-cell text-xs">{s.company_name || '—'}</td>
                  <td className="table-cell text-xs">{shipmentTypeLabel(s.shipping_type) || '—'}</td>
                  <td className="table-cell text-xs">{shipmentCarrier(s) || '—'}</td>
                  <td className="table-cell tabular-nums text-xs">{shipmentReference(s) || '—'}</td>
                  <td className="table-cell text-2xs text-gray-500">{s.shipped_at?.slice(0, 10) || '—'}</td>
                  <td className="table-cell"><StatusBadge status={s.status} /></td>
                  <td className="table-cell" onClick={e => e.stopPropagation()}>
                    <div className="relative">
                      <button onClick={() => setOpenMenu(openMenu === s.id ? null : s.id)} className="icon-btn" aria-label={t('common.moreActions')} title={t('common.moreActions')}>
                        <Icon name="more" size={16} />
                      </button>
                      {openMenu === s.id && (
                        <div className="menu-surface absolute right-0 top-full mt-1 w-36">
                          <button onClick={() => {
                            setOpenMenu(null);
                            setEditId(s.id);
                            setForm({
                              order_id: s.order_id, shipping_type: s.shipping_type || 'express',
                              status: s.status || 'pending_pickup', carrier: s.carrier || '',
                              tracking_number: s.tracking_number || '', container_no: s.container_no || '',
                              vessel: s.vessel || '', voyage: s.voyage || '', awb: s.awb || '', airline: s.airline || '',
                              express_provider: s.express_provider || '', shipped_at: s.shipped_at || '',
                              etd: s.etd || '', eta: s.eta || '', shipping_address: s.shipping_address || '',
                              notes: s.notes || '', estimated_delivery_date: s.estimated_delivery_date || '',
                            });
                            setShowForm(true);
                          }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                            <Icon name="square-pen" size={13} />{t('common.edit')}
                          </button>
                          <button onClick={() => {
                            setDeleteTarget(s);
                            setOpenMenu(null);
                          }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
                            <Icon name="delete" size={13} />{t('common.delete')}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9}><div className="empty-state">{search ? t('page.shipments.noShipmentsMatchSearch') : t('noData.shipments')}</div></td></tr>}
            </tbody>
          </table>
          </div>
        </>
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        title={t('common.delete')}
        description={<>{t('common.confirmDelete')} <strong>{deleteTarget?.shipment_number}</strong></>}
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
