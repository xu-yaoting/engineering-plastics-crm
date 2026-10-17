import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import StatusBadge from '../components/shared/StatusBadge';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import SidePanel from '../components/shared/SidePanel';
import Icon from '../components/shared/Icon';
import { useTranslation } from 'react-i18next';
import AccountabilityPanel from '../components/shared/AccountabilityPanel';
import toast from 'react-hot-toast';

const SHIPPING_TYPES = ['sea_freight', 'air_freight', 'express', 'truck', 'pickup'] as const;

const shipmentCarrier = (shipment: any) => {
  switch (shipment.shipping_type) {
    case 'air_freight': return shipment.airline || shipment.carrier || '';
    case 'express': return shipment.express_provider || shipment.carrier || '';
    case 'pickup': return '';
    default: return shipment.carrier || shipment.vessel || '';
  }
};

const shipmentReference = (shipment: any) => shipment.tracking_number || shipment.awb || '';

const emptyEditForm = {
  shipping_type: 'express', carrier: '', tracking_number: '', container_no: '', vessel: '', voyage: '',
  airline: '', express_provider: '', etd: '', eta: '', shipped_at: '', estimated_delivery_date: '',
  shipping_address: '', notes: '',
};

function ShipmentDetailSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex h-full flex-col">
      <div aria-hidden="true" className="flex h-full flex-col animate-pulse motion-reduce:animate-none">
        <header className="flex-shrink-0 border-b border-border bg-surface px-5 py-3">
          <div className="flex min-h-8 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-8 w-8 rounded-md bg-border-strong" />
              <div className="h-5 w-40 rounded bg-border-strong" />
              <div className="h-5 w-20 rounded bg-surface-hover" />
            </div>
            <div className="h-8 w-8 rounded-md bg-surface-hover" />
          </div>
          <div className="mt-2 h-3 w-72 max-w-full rounded bg-surface-hover" />
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-canvas p-6">
          <div className="mx-auto max-w-3xl space-y-5">
            <section className="commercial-summary rounded-md border border-border bg-surface p-5">
              <div className="flex items-end justify-between gap-4">
                <div className="space-y-3">
                  <div className="h-3 w-20 rounded bg-surface-hover" />
                  <div className="h-8 w-48 rounded bg-border-strong" />
                </div>
                <div className="h-5 w-20 rounded bg-surface-hover" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 md:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="space-y-2">
                    <div className="h-3 w-16 rounded bg-surface-hover" />
                    <div className="h-4 w-4/5 rounded bg-border-strong" />
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-md border border-border bg-surface p-4">
              <div className="h-3 w-28 rounded bg-border-strong" />
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="h-4 rounded bg-surface-hover" />
                ))}
              </div>
            </section>

            <section className="rounded-md border border-border bg-surface p-4">
              <div className="h-3 w-24 rounded bg-border-strong" />
              <div className="mt-4 flex flex-wrap gap-2">
                {Array.from({ length: 5 }, (_, index) => (
                  <div key={index} className="h-7 w-24 rounded bg-surface-hover" />
                ))}
              </div>
            </section>

            <section className="rounded-md border border-border bg-surface p-4">
              <div className="h-3 w-28 rounded bg-border-strong" />
              <div className="mt-4 grid grid-cols-2 gap-5">
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className="space-y-2">
                    <div className="h-3 w-20 rounded bg-surface-hover" />
                    <div className="h-4 w-3/4 rounded bg-border-strong" />
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-md border border-border bg-surface">
              <div className="border-b border-border px-4 py-3">
                <div className="h-3 w-20 rounded bg-border-strong" />
              </div>
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex justify-between border-b border-border px-4 py-4 last:border-b-0">
                  <div className="h-4 w-40 rounded bg-surface-hover" />
                  <div className="h-4 w-16 rounded bg-border-strong" />
                </div>
              ))}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function ShipmentDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [editForm, setEditForm] = useState(emptyEditForm);

  const statusOptions = ['pending_pickup', 'in_transit', 'out_for_delivery', 'delivered', 'exception'];
  const shipmentStatusLabel = (value: string) => t(`status.${value}`);
  const shipmentTypeLabel = (value: string) => {
    const key = value === 'sea_freight' ? 'seaFreight' : value === 'air_freight' ? 'airFreight' : value;
    return t(`page.shipments.${key}`);
  };

  const load = () => {
    if (!id) {
      setLoadError(true);
      return;
    }
    setLoadError(false);
    fetch(`/api/shipments/${id}`)
      .then(async res => {
        if (!res.ok) throw new Error(`Shipment request failed: ${res.status}`);
        return res.json();
      })
      .then(data => {
        setShipment(data);
        setLineItems(data.line_items || []);
      })
      .catch(() => {
        setShipment(null);
        setLineItems([]);
        setLoadError(true);
      });
  };

  useEffect(() => { load(); }, [id]);

  const readError = async (res: Response, fallback: string) => {
    const data = await res.json().catch(() => null);
    return data?.error || data?.message || fallback;
  };

  const updateStatus = async (status: string) => {
    if (!id || savingStatus || savingEdit) return;
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/shipments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        toast.error(await readError(res, t('page.shipments.shipmentSaveFailed')));
        return;
      }
      load();
    } catch {
      toast.error(t('page.shipments.shipmentSaveFailed'));
    } finally {
      setSavingStatus(false);
    }
  };

  const saveEdit = async () => {
    if (!id || savingEdit) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/shipments/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        toast.error(await readError(res, t('page.shipments.shipmentSaveFailed')));
        return;
      }
      setShowEditPanel(false);
      load();
    } catch {
      toast.error(t('page.shipments.shipmentSaveFailed'));
    } finally {
      setSavingEdit(false);
    }
  };

  const remove = async () => {
    if (!id || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/shipments/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error(t('page.shipments.deleteFailed'));
        return;
      }
      navigate('/shipments');
    } catch {
      toast.error(t('page.shipments.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center bg-canvas p-6">
        <div className="empty-state data-surface w-full max-w-md p-6" role="alert">
          <p>{t('page.error.loadFailed')}</p>
          <button type="button" onClick={load} className="btn-secondary btn-sm mt-3">
            <Icon name="refresh" size={14} className="mr-1.5" />
            {t('common.refresh')}
          </button>
        </div>
      </div>
    );
  }

  if (!shipment) return <ShipmentDetailSkeleton label={t('common.loading')} />;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 border-b border-border bg-surface px-5 py-3">
        <div className="page-header mb-0 min-h-0 items-start sm:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/shipments" className="icon-btn" aria-label={t('common.back')} title={t('page.title.shipments')}><Icon name="back" size={16} /></Link>
            <h1 className="page-heading text-lg sm:text-2xl truncate tabular-nums">{shipment.shipment_number}</h1>
            <StatusBadge status={shipment.status} />
          </div>
          <div className="page-actions relative">
            <button onClick={() => setShowActionsMenu(!showActionsMenu)} className="icon-btn" aria-label={t('common.moreActions')} title={t('common.moreActions')}><Icon name="more" size={16} /></button>
            {showActionsMenu && (
              <div className="menu-surface absolute right-0 top-full mt-1 w-36">
                <button onClick={() => { setShowActionsMenu(false);
                  setEditForm({
                    shipping_type: shipment.shipping_type || 'express', carrier: shipment.carrier || '',
                    tracking_number: shipment.tracking_number || shipment.awb || '',
                    container_no: shipment.container_no || '', vessel: shipment.vessel || '', voyage: shipment.voyage || '',
                    airline: shipment.airline || '', express_provider: shipment.express_provider || '',
                    etd: shipment.etd || '', eta: shipment.eta || '', shipped_at: shipment.shipped_at?.slice(0, 10) || '',
                    estimated_delivery_date: shipment.estimated_delivery_date?.slice(0, 10) || '',
                    shipping_address: shipment.shipping_address || '', notes: shipment.notes || '',
                  });
                  setShowEditPanel(true);
                }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-ink hover:bg-canvas">
                  <Icon name="square-pen" size={13} />{t('common.edit')}
                </button>
                <button onClick={() => {
                  setConfirmDelete(true);
                  setShowActionsMenu(false);
                }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-danger hover:bg-danger-soft">
                  <Icon name="delete" size={13} />{t('common.delete')}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="text-xs text-ink-muted">
          {shipment.company_name && <>{shipment.company_name} · </>}
          {t('page.shipments.order')}: <Link to={`/orders/${shipment.order_id}`} className="text-brand hover:underline">{shipment.order_number}</Link>
          {shipmentCarrier(shipment) && ` · ${shipmentCarrier(shipment)}`}
          {shipmentReference(shipment) && ` · ${shipmentReference(shipment)}`}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-5">
          <div className="section-band commercial-summary p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="section-label text-ink-subtle">{t('page.title.shipments')}</p>
                <p className="mt-1 text-2xl font-semibold text-ink tabular-nums">{shipment.shipment_number}</p>
              </div>
              <StatusBadge status={shipment.status} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 md:grid-cols-4">
              <div><span className="text-2xs text-ink-subtle">{t('page.dashboard.customer')}</span><p className="mt-1 truncate text-sm text-ink">{shipment.company_name || '—'}</p></div>
              <div><span className="text-2xs text-ink-subtle">{t('page.shipments.order')}</span><p className="mt-1 text-sm"><Link to={`/orders/${shipment.order_id}`} className="text-brand hover:underline">{shipment.order_number}</Link></p></div>
              <div><span className="text-2xs text-ink-subtle">{t('page.shipmentDetail.carrier')}</span><p className="mt-1 text-sm text-ink">{shipmentCarrier(shipment) || '—'}</p></div>
              <div><span className="text-2xs text-ink-subtle">{t('page.shipmentDetail.trackingNumber')}</span><p className="mt-1 truncate text-sm tabular-nums text-ink">{shipmentReference(shipment) || '—'}</p></div>
            </div>
          </div>
          <div className="section-band p-4">
            <AccountabilityPanel entityType="shipment" entityId={id!} record={shipment} showOwner={false} />
          </div>
          {/* Status Controls */}
          <div className="section-band p-4">
            <h3 className="section-label mb-3">{t('page.shipmentDetail.trackingStatus')}</h3>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map(s => (
                <button
                  key={s}
                  onClick={() => updateStatus(s)}
                  disabled={savingStatus || savingEdit}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    shipment.status === s
                      ? 'bg-brand text-white'
                      : 'bg-surface-hover text-ink-muted hover:bg-border-strong'
                  }`}
                >
                  {shipmentStatusLabel(s)}
                </button>
              ))}
            </div>
          </div>

          {/* Tracking Info */}
          <div className="data-surface p-4">
            <h3 className="section-label mb-3">{t('page.shipmentDetail.trackingDetails')}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-2xs text-ink-subtle block">{t('page.shipments.shipmentType')}</span><span className="text-ink">{shipmentTypeLabel(shipment.shipping_type)}</span></div>
              <div><span className="text-2xs text-ink-subtle block">{t('page.shipmentDetail.carrier')}</span><span className="text-ink">{shipmentCarrier(shipment) || '—'}</span></div>
              <div><span className="text-2xs text-ink-subtle block">{t('page.shipmentDetail.trackingNumber')}</span><span className="tabular-nums text-ink">{shipmentReference(shipment) || '—'}</span></div>
              <div><span className="text-2xs text-ink-subtle block">{t('page.shipmentDetail.shipDate')}</span><span className="text-ink">{shipment.shipped_at?.slice(0, 10) || '—'}</span></div>
              <div><span className="text-2xs text-ink-subtle block">{t('page.shipmentDetail.estDelivery')}</span><span className="text-ink">{shipment.estimated_delivery_date || '—'}</span></div>
              {shipment.shipping_type === 'sea_freight' && <>
                <div><span className="text-2xs text-ink-subtle block">{t('page.shipments.containerNo')}</span><span className="tabular-nums text-ink">{shipment.container_no || '—'}</span></div>
                <div><span className="text-2xs text-ink-subtle block">{t('page.shipments.vessel')}</span><span className="text-ink">{shipment.vessel || '—'}</span></div>
                <div><span className="text-2xs text-ink-subtle block">{t('page.shipments.voyage')}</span><span className="text-ink">{shipment.voyage || '—'}</span></div>
                <div><span className="text-2xs text-ink-subtle block">{t('page.shipments.etd')}</span><span className="text-ink">{shipment.etd || '—'}</span></div>
                <div><span className="text-2xs text-ink-subtle block">{t('page.shipments.eta')}</span><span className="text-ink">{shipment.eta || '—'}</span></div>
              </>}
              {shipment.shipping_type === 'air_freight' && <>
                <div><span className="text-2xs text-ink-subtle block">{t('page.shipments.etd')}</span><span className="text-ink">{shipment.etd || '—'}</span></div>
                <div><span className="text-2xs text-ink-subtle block">{t('page.shipments.eta')}</span><span className="text-ink">{shipment.eta || '—'}</span></div>
              </>}
              {shipment.shipping_type === 'pickup' && shipment.shipping_address && <div className="col-span-2"><span className="text-2xs text-ink-subtle block">{t('page.shipments.address')}</span><span className="text-ink">{shipment.shipping_address}</span></div>}
            </div>
          </div>

          {/* Line Items */}
          <div className="data-surface overflow-x-auto">
            <h3 className="section-label border-b border-border px-4 py-3">{t('page.shipmentDetail.items')}</h3>
            {lineItems.length === 0 ? (
              <p className="px-4 py-6 text-xs text-ink-subtle">{t('page.shipmentDetail.noItemsTracked')}</p>
            ) : (
              <>
                <div className="space-y-2 p-3 md:hidden">
                  {lineItems.map((li: any) => (
                    <article key={li.id} className="flex items-center justify-between gap-4 rounded border border-border bg-canvas/50 p-3">
                      <div className="min-w-0">
                        <p className="section-label">{t('page.shipmentDetail.item')}</p>
                        <p className="truncate text-sm text-ink">{li.order_line_item_id?.slice(0, 8) || t('page.shipmentDetail.item')}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="section-label">{t('page.shipmentDetail.qty')}</p>
                        <p className="tabular-nums text-sm font-medium text-ink">{li.quantity_shipped}</p>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10"><tr className="border-b border-border bg-canvas"><th className="table-header">{t('page.shipmentDetail.item')}</th><th className="table-header text-right">{t('page.shipmentDetail.qty')}</th></tr></thead>
                    <tbody>
                      {lineItems.map((li: any) => (
                        <tr key={li.id} className="border-b border-border">
                          <td className="table-cell text-xs text-ink">{li.order_line_item_id?.slice(0, 8) || t('page.shipmentDetail.item')}</td>
                          <td className="table-cell text-right tabular-nums text-xs">{li.quantity_shipped}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {shipment.notes && (
            <div className="section-band p-4">
              <h3 className="section-label mb-2">{t('page.shipmentDetail.notes')}</h3>
              <p className="text-sm text-ink">{shipment.notes}</p>
            </div>
          )}
        </div>
      </div>

      <SidePanel
        open={showEditPanel}
        onClose={() => { if (!savingEdit) setShowEditPanel(false); }}
        title={t('page.shipments.editShipment')}
        subtitle={shipment.shipment_number}
        width="w-[min(560px,calc(100vw-1rem))]"
      >
                <div className="space-y-4">
                  <div>
                    <label className="label" htmlFor="shipment-edit-type">{t('page.shipments.shipmentType')}</label>
                    <select id="shipment-edit-type" className="input" value={editForm.shipping_type} onChange={e => setEditForm({...editForm, shipping_type: e.target.value})}>
                      {SHIPPING_TYPES.map(type => <option key={type} value={type}>{shipmentTypeLabel(type)}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div><label className="label" htmlFor="shipment-edit-ship-date">{t('page.shipments.shipDate')}</label><input id="shipment-edit-ship-date" className="input" type="date" value={editForm.shipped_at} onChange={e => setEditForm({...editForm, shipped_at: e.target.value})} /></div>
                    {editForm.shipping_type !== 'pickup' && <div><label className="label" htmlFor="shipment-edit-reference">{t('page.shipments.referenceNumber')}</label><input id="shipment-edit-reference" className="input tabular-nums" value={editForm.tracking_number} onChange={e => setEditForm({...editForm, tracking_number: e.target.value})} /></div>}
                  </div>
                  {editForm.shipping_type === 'sea_freight' && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div><label className="label" htmlFor="shipment-edit-carrier">{t('page.shipments.carrierForwarder')}</label><input id="shipment-edit-carrier" className="input" value={editForm.carrier} onChange={e => setEditForm({...editForm, carrier: e.target.value})} /></div>
                    <div><label className="label" htmlFor="shipment-edit-container">{t('page.shipments.containerNo')}</label><input id="shipment-edit-container" className="input tabular-nums" value={editForm.container_no} onChange={e => setEditForm({...editForm, container_no: e.target.value})} /></div>
                    <div><label className="label" htmlFor="shipment-edit-vessel">{t('page.shipments.vessel')}</label><input id="shipment-edit-vessel" className="input" value={editForm.vessel} onChange={e => setEditForm({...editForm, vessel: e.target.value})} /></div>
                    <div><label className="label" htmlFor="shipment-edit-voyage">{t('page.shipments.voyage')}</label><input id="shipment-edit-voyage" className="input" value={editForm.voyage} onChange={e => setEditForm({...editForm, voyage: e.target.value})} /></div>
                    <div><label className="label" htmlFor="shipment-edit-etd">{t('page.shipments.etd')}</label><input id="shipment-edit-etd" className="input" type="date" value={editForm.etd} onChange={e => setEditForm({...editForm, etd: e.target.value})} /></div>
                    <div><label className="label" htmlFor="shipment-edit-eta">{t('page.shipments.eta')}</label><input id="shipment-edit-eta" className="input" type="date" value={editForm.eta} onChange={e => setEditForm({...editForm, eta: e.target.value})} /></div>
                  </div>}
                  {editForm.shipping_type === 'air_freight' && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div><label className="label" htmlFor="shipment-edit-airline">{t('page.shipments.airlineForwarder')}</label><input id="shipment-edit-airline" className="input" value={editForm.airline} onChange={e => setEditForm({...editForm, airline: e.target.value})} /></div>
                    <div><label className="label" htmlFor="shipment-edit-air-tracking">{t('page.shipments.trackingNumber')}</label><input id="shipment-edit-air-tracking" className="input tabular-nums" value={editForm.tracking_number} onChange={e => setEditForm({...editForm, tracking_number: e.target.value})} /></div>
                    <div><label className="label" htmlFor="shipment-edit-etd">{t('page.shipments.etd')}</label><input id="shipment-edit-etd" className="input" type="date" value={editForm.etd} onChange={e => setEditForm({...editForm, etd: e.target.value})} /></div>
                    <div><label className="label" htmlFor="shipment-edit-eta">{t('page.shipments.eta')}</label><input id="shipment-edit-eta" className="input" type="date" value={editForm.eta} onChange={e => setEditForm({...editForm, eta: e.target.value})} /></div>
                  </div>}
                  {editForm.shipping_type === 'express' && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div><label className="label" htmlFor="shipment-edit-express-provider">{t('page.shipments.provider')}</label><input id="shipment-edit-express-provider" className="input" value={editForm.express_provider} onChange={e => setEditForm({...editForm, express_provider: e.target.value})} /></div>
                    <div><label className="label" htmlFor="shipment-edit-estimated-delivery">{t('page.shipments.estimatedDelivery')}</label><input id="shipment-edit-estimated-delivery" className="input" type="date" value={editForm.estimated_delivery_date} onChange={e => setEditForm({...editForm, estimated_delivery_date: e.target.value})} /></div>
                  </div>}
                  {editForm.shipping_type === 'truck' && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div><label className="label" htmlFor="shipment-edit-carrier">{t('page.shipments.logisticsCompany')}</label><input id="shipment-edit-carrier" className="input" value={editForm.carrier} onChange={e => setEditForm({...editForm, carrier: e.target.value})} /></div>
                    <div><label className="label" htmlFor="shipment-edit-truck-tracking">{t('page.shipments.trackingNumber')}</label><input id="shipment-edit-truck-tracking" className="input tabular-nums" value={editForm.tracking_number} onChange={e => setEditForm({...editForm, tracking_number: e.target.value})} /></div>
                    <div><label className="label" htmlFor="shipment-edit-estimated-delivery">{t('page.shipments.estimatedDelivery')}</label><input id="shipment-edit-estimated-delivery" className="input" type="date" value={editForm.estimated_delivery_date} onChange={e => setEditForm({...editForm, estimated_delivery_date: e.target.value})} /></div>
                  </div>}
                  {editForm.shipping_type === 'pickup' && <div><label className="label" htmlFor="shipment-edit-pickup-address">{t('page.shipments.address')}</label><textarea id="shipment-edit-pickup-address" className="input min-h-[60px] resize-y" value={editForm.shipping_address} onChange={e => setEditForm({...editForm, shipping_address: e.target.value})} autoComplete="street-address" /></div>}
              <div>
                <label className="label" htmlFor="shipment-edit-notes">{t('page.shipmentDetail.notes')}</label>
                <textarea id="shipment-edit-notes" className="input min-h-[60px] resize-y" value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={saveEdit} disabled={savingEdit} className="btn-primary flex-1">{savingEdit ? t('page.shipments.saving') : t('page.shipments.saveChanges')}</button>
                <button onClick={() => setShowEditPanel(false)} disabled={savingEdit} className="btn-secondary">{t('common.cancel')}</button>
              </div>
            </div>
      </SidePanel>
      <ConfirmDialog
        open={confirmDelete}
        title={t('common.delete')}
        description={<>{t('common.confirmDelete')} <strong>{shipment.shipment_number}</strong></>}
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
