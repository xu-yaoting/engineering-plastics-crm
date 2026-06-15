import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import StatusBadge from '../components/shared/StatusBadge';
import Icon from '../components/shared/Icon';
import { useTranslation } from 'react-i18next';

export default function ShipmentDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editForm, setEditForm] = useState({ carrier: '', tracking_number: '', shipping_method: '', notes: '' });

  const statusOptions = ['pending_pickup', 'in_transit', 'out_for_delivery', 'delivered', 'exception'];

  const load = () => {
    if (!id) return;
    fetch(`/api/shipments/${id}`).then(r => r.json()).then(data => {
      setShipment(data);
      setLineItems(data.line_items || []);
    });
  };

  useEffect(() => { load(); }, [id]);

  const updateStatus = async (status: string) => {
    await fetch(`/api/shipments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const saveEdit = async () => {
    if (!id) return;
    await fetch(`/api/shipments/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setShowEditPanel(false);
    load();
  };

  const remove = async () => {
    if (!id) return;
    await fetch(`/api/shipments/${id}`, { method: 'DELETE' });
    navigate('/shipments');
  };

  if (!shipment) return <div className="p-6 text-gray-400">{t('common.loading')}</div>;

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <Link to="/shipments" className="text-xs text-gray-400 hover:text-gray-600">← Shipments</Link>
            <h1 className="text-2xl font-semibold text-gray-900">{shipment.shipment_number}</h1>
            <StatusBadge status={shipment.status} />
          </div>
          <div className="relative">
            <button onClick={() => setShowActionsMenu(!showActionsMenu)} className="btn-ghost btn-sm">⋮</button>
            {showActionsMenu && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-md z-10 py-1">
                <button onClick={() => { setShowActionsMenu(false);
                  setEditForm({
                    carrier: shipment.carrier || '', tracking_number: shipment.tracking_number || '',
                    shipping_method: shipment.shipping_method || '', notes: shipment.notes || '',
                  });
                  setShowEditPanel(true);
                }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                  <Icon name="square-pen" size={13} />{t('common.edit')}
                </button>
                {!confirmDelete ? (
                  <button onClick={() => setConfirmDelete(true)} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
                    <Icon name="delete" size={13} />{t('common.delete')}
                  </button>
                ) : (
                  <div className="px-3 py-2">
                    <p className="text-2xs text-red-600 mb-1.5">Confirm?</p>
                    <div className="flex gap-1">
                      <button onClick={remove} className="text-xs bg-red-600 text-white px-2 py-1 rounded">{t('common.yes')}</button>
                      <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-500 px-2 py-1">{t('common.no')}</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {shipment.company_name && <>{shipment.company_name} · </>}
          Order: <Link to={`/orders/${shipment.order_id}`} className="text-blue-600 hover:underline">{shipment.order_number}</Link>
          {shipment.carrier && ` · ${shipment.carrier}`}
          {shipment.tracking_number && ` · ${shipment.tracking_number}`}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {/* Status Controls */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Tracking Status</h3>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map(s => (
                <button
                  key={s}
                  onClick={() => updateStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    shipment.status === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Tracking Info */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Tracking Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-2xs text-gray-400 block">Carrier</span><span className="text-gray-700">{shipment.carrier || '—'}</span></div>
              <div><span className="text-2xs text-gray-400 block">Tracking #</span><span className="font-mono text-blue-600">{shipment.tracking_number || '—'}</span></div>
              <div><span className="text-2xs text-gray-400 block">Ship Date</span><span className="text-gray-700">{shipment.shipped_at?.slice(0, 10) || '—'}</span></div>
              <div><span className="text-2xs text-gray-400 block">Est. Delivery</span><span className="text-gray-700">{shipment.estimated_delivery_date || '—'}</span></div>
              {shipment.shipping_method && <div className="col-span-2"><span className="text-2xs text-gray-400 block">Method</span><span className="text-gray-700">{shipment.shipping_method}</span></div>}
            </div>
          </div>

          {/* Line Items */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Items</h3>
            {lineItems.length === 0 ? (
              <p className="text-xs text-gray-400">No items tracked for this shipment</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200"><th className="text-left text-xs text-gray-500 pb-2 font-medium">Item</th><th className="text-right text-xs text-gray-500 pb-2 font-medium">Qty</th></tr></thead>
                <tbody>
                  {lineItems.map((li: any) => (
                    <tr key={li.id} className="border-b border-gray-100">
                      <td className="py-2 text-xs text-gray-700">{li.order_line_item_id?.slice(0, 8) || 'Item'}</td>
                      <td className="py-2 text-right font-mono text-xs">{li.quantity_shipped}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {shipment.notes && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</h3>
              <p className="text-sm text-gray-700">{shipment.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditPanel && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-lg p-6 w-[420px]">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Edit Shipment</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Carrier</label>
                <input className="input" value={editForm.carrier} onChange={e => setEditForm({...editForm, carrier: e.target.value})} />
              </div>
              <div>
                <label className="label">Tracking #</label>
                <input className="input" value={editForm.tracking_number} onChange={e => setEditForm({...editForm, tracking_number: e.target.value})} />
              </div>
              <div>
                <label className="label">Shipping Method</label>
                <input className="input" value={editForm.shipping_method} onChange={e => setEditForm({...editForm, shipping_method: e.target.value})} />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input min-h-[60px] resize-y" value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={saveEdit} className="btn-primary flex-1">Save Changes</button>
                <button onClick={() => setShowEditPanel(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
