import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import StatusBadge from '../components/shared/StatusBadge';
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
  shipping_type: 'sea_freight',
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
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
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

  const remove = async (id: string) => {
    try {
      await fetch(`/api/shipments/${id}`, { method: 'DELETE' });
      setConfirmDelete(null);
      toast.success(t('page.shipments.shipmentDeleted'));
      fetch('/api/shipments').then(r => r.json()).then(setList);
    } catch (e) { toast.error(t('page.shipments.deleteFailed')); }
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
    s.carrier?.toLowerCase().includes(search.toLowerCase()) ||
    s.tracking_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('page.title.shipments')}</h1>
          <p className="text-sm text-gray-500">{list.length} {t('page.title.shipments')}</p>
        </div>
        <button onClick={() => { setEditId(null); setForm(defaultForm()); setShowForm(true); }} className="btn-primary btn-sm"><Icon name="plus" size={16} className="mr-1.5" />{t('page.shipments.new')}</button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input className="input max-w-sm" placeholder={t('common.searchShipments')} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {showForm && (
        <div className="card p-4 mb-6">
          <h3 className="text-xs font-450 text-gray-500 uppercase tracking-[0.08em] mb-4">
            {editId ? t('page.shipments.editShipment') : t('page.shipments.new')}
          </h3>
          {/* Show pre-selected order info when coming from Order Detail */}
          {presetOrder && (
            <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm space-y-1">
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
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('page.shipments.order')} *</label>
                <select className="input" value={form.order_id} onChange={e => set('order_id', e.target.value)}>
                  <option value="">{t('page.shipments.selectOrder')}</option>
                  {orders.map((o: any) => (
                    <option key={o.id} value={o.id}>{o.order_number} — {o.company_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t('page.shipments.shipDate')}</label>
                <input className="input" type="date" value={form.shipped_at} onChange={e => set('shipped_at', e.target.value)} />
              </div>
              <div>
                <label className="label">{t('page.shipments.shipmentType')}</label>
                <select className="input" value={st} onChange={e => set('shipping_type', e.target.value)}>
                  {SHIPPING_TYPES.map(x => <option key={x.value} value={x.value}>{t(`page.shipments.${x.labelKey}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">{t('page.shipments.status')}</label>
                <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
                  {SHIPPING_STATUSES.map(s => <option key={s} value={s}>{shipmentStatusLabel(s)}</option>)}
                </select>
              </div>
            </div>

            {/* Sea Freight */}
            {st === 'sea_freight' && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t('page.shipments.containerNo')}</label><input className="input font-mono" value={form.container_no} onChange={e => set('container_no', e.target.value)} placeholder="e.g. MSCU4820347" /></div>
                <div><label className="label">{t('page.shipments.vessel')}</label><input className="input" value={form.vessel} onChange={e => set('vessel', e.target.value)} placeholder="e.g. EVER FORTUNE" /></div>
                <div><label className="label">{t('page.shipments.voyage')}</label><input className="input" value={form.voyage} onChange={e => set('voyage', e.target.value)} placeholder="e.g. 123E" /></div>
                <div><label className="label">{t('page.shipments.etd')}</label><input className="input" type="date" value={form.etd} onChange={e => set('etd', e.target.value)} /></div>
                <div><label className="label">{t('page.shipments.eta')}</label><input className="input" type="date" value={form.eta} onChange={e => set('eta', e.target.value)} /></div>
              </div>
            )}

            {/* Air Freight */}
            {st === 'air_freight' && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t('page.shipments.awb')}</label><input className="input font-mono" value={form.awb} onChange={e => set('awb', e.target.value)} placeholder={t('page.shipments.airWaybillPlaceholder')} /></div>
                <div><label className="label">{t('page.shipments.airline')}</label><input className="input" value={form.airline} onChange={e => set('airline', e.target.value)} placeholder="e.g. Cathay Pacific" /></div>
                <div><label className="label">{t('page.shipments.etd')}</label><input className="input" type="date" value={form.etd} onChange={e => set('etd', e.target.value)} /></div>
                <div><label className="label">{t('page.shipments.eta')}</label><input className="input" type="date" value={form.eta} onChange={e => set('eta', e.target.value)} /></div>
              </div>
            )}

            {/* Express */}
            {st === 'express' && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t('page.shipments.provider')}</label><input className="input" value={form.express_provider} onChange={e => set('express_provider', e.target.value)} placeholder="DHL, FedEx, UPS..." /></div>
                <div><label className="label">{t('page.shipments.trackingNumber')}</label><input className="input font-mono" value={form.tracking_number} onChange={e => set('tracking_number', e.target.value)} /></div>
              </div>
            )}

            {/* Truck */}
            {st === 'truck' && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">{t('page.shipments.carrier')}</label><input className="input" value={form.carrier} onChange={e => set('carrier', e.target.value)} placeholder={t('page.shipments.truckingCompany')} /></div>
                <div><label className="label">{t('page.shipments.etd')}</label><input className="input" type="date" value={form.etd} onChange={e => set('etd', e.target.value)} /></div>
                <div><label className="label">{t('page.shipments.eta')}</label><input className="input" type="date" value={form.eta} onChange={e => set('eta', e.target.value)} /></div>
              </div>
            )}

            {/* Pickup */}
            {st === 'pickup' && (
              <div>
                <label className="label">{t('page.shipments.address')}</label>
                <textarea className="input min-h-[60px] resize-y" value={form.shipping_address} onChange={e => set('shipping_address', e.target.value)} placeholder={t('page.shipments.pickupAddress')} />
              </div>
            )}

            <div>
              <label className="label">{t('page.shipments.notes')}</label>
              <textarea className="input min-h-[50px] resize-y" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder={t('page.shipments.optionalNotes')} />
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={save} disabled={!form.order_id || saving} className="btn-primary btn-sm flex-1">
                {saving ? t('page.shipments.saving') : editId ? t('page.shipments.saveChanges') : t('page.shipments.createShipment')}
              </button>
              <button onClick={() => { setShowForm(false); setEditId(null); }} disabled={saving} className="btn-secondary btn-sm">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">{t('common.loading')}</div>
      ) : (
        <div className="card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="table-header">{t('page.shipments.shipmentNumber')}</th>
                <th className="table-header">{t('page.shipments.order')}</th>
                <th className="table-header">{t('page.shipments.company')}</th>
                <th className="table-header">{t('page.shipments.type')}</th>
                <th className="table-header">{t('page.shipments.carrierVessel')}</th>
                <th className="table-header">{t('page.shipments.tracking')}</th>
                <th className="table-header">{t('page.shipments.etd')}</th>
                <th className="table-header">{t('page.shipments.eta')}</th>
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
                  <td className="table-cell text-xs">{s.carrier || s.vessel || '—'}</td>
                  <td className="table-cell font-mono text-xs">{s.tracking_number || '—'}</td>
                  <td className="table-cell text-2xs text-gray-400">{s.etd?.slice(0, 10) || '—'}</td>
                  <td className="table-cell text-2xs text-gray-400">{s.eta?.slice(0, 10) || '—'}</td>
                  <td className="table-cell"><StatusBadge status={s.status} /></td>
                  <td className="table-cell" onClick={e => e.stopPropagation()}>
                    <div className="relative">
                      <button onClick={() => setOpenMenu(openMenu === s.id ? null : s.id)} className="btn-ghost btn-sm text-xs px-1">⋮</button>
                      {openMenu === s.id && (
                        <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-md z-20 py-1">
                          <button onClick={() => {
                            setOpenMenu(null);
                            setEditId(s.id);
                            setForm({
                              order_id: s.order_id, shipping_type: s.shipping_type || 'sea_freight',
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
                          {confirmDelete !== s.id ? (
                            <button onClick={() => setConfirmDelete(s.id)} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
                              <Icon name="delete" size={13} />{t('common.delete')}
                            </button>
                          ) : (
                            <div className="px-3 py-2">
                              <p className="text-2xs text-red-600 mb-1">{t('common.confirmDelete')}</p>
                              <div className="flex gap-1">
                                <button onClick={() => remove(s.id)} className="text-xs bg-red-600 text-white px-2 py-0.5 rounded">{t('common.yes')}</button>
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
              {filtered.length === 0 && <tr><td colSpan={10} className="text-center py-12 text-gray-400 text-sm">{search ? t('page.shipments.noShipmentsMatchSearch') : t('noData.shipments')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
