import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { quotations, activities } from '../lib/api';
import StatusBadge from '../components/shared/StatusBadge';
import { formatCurrency } from '../lib/currency';
import Icon from '../components/shared/Icon';
import QuotationEditPanel from '../components/quotations/QuotationEditPanel';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

export default function QuotationDetail() {
  const { t } = useTranslation();
  const statusOptions = [
    { value: 'draft', label: t('status.draft') },
    { value: 'pending_approval', label: t('status.pendingApproval', 'Pending Approval') },
    { value: 'approved', label: t('status.approved', 'Approved') },
    { value: 'sent', label: t('status.sent') },
    { value: 'negotiating', label: t('status.negotiating') },
    { value: 'accepted', label: t('status.accepted') },
    { value: 'rejected', label: t('status.rejected') },
    { value: 'expired', label: t('status.expired') },
  ];
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quotation, setQuotation] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [activityList, setActivityList] = useState<any[]>([]);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [showSamplePanel, setShowSamplePanel] = useState(false);
  const [sampleInfo, setSampleInfo] = useState({ purpose: '', quantity: '', shipping_address: '' });
  const [sampleStatus, setSampleStatus] = useState<any>(null);

  const load = () => {
    if (!id) return;
    quotations.get(id).then(data => {
      setQuotation(data);
      setLineItems(data.line_items || []);
      // Check order_id from server response (SQL subquery)
      if (data.order_id) {
        setOrderId(data.order_id);
      }
    });
    activities.list('quotation', id).then(setActivityList);
    // Also directly check if any order references this quotation
    fetch(`/api/orders`).then(r => r.json()).then((orders: any[]) => {
      const match = orders.find((o: any) => o.quotation_id === id && !o.deleted_at);
      if (match) setOrderId(match.id);
    }).catch(() => {});
  };

  useEffect(() => { load(); }, [id]);

  const changeStatus = async (newStatus: string) => {
    if (!id) return;
    try {
      await quotations.update(id, { status: newStatus });
      await activities.create({
        entity_type: 'quotation', entity_id: id,
        activity_type: 'status_change',
        subject: `Status changed to ${newStatus}`,
      });
      setShowStatusMenu(false);
      load();
    } catch (e) {
      toast.error('Failed to change status');
    }
  };

  const createOrder = async () => {
    if (!id || !quotation) return;
    setCreatingOrder(true);
    try {
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: quotation.company_id,
          contact_id: quotation.contact_id,
          quotation_id: id,
          currency: quotation.currency,
          incoterm: quotation.incoterm,
          payment_term: quotation.payment_term,
          subtotal: quotation.subtotal || subtotal,
          total: quotation.total || subtotal,
          discount_percent: quotation.discount_percent,
          discount_amount: quotation.discount_amount,
          tax_type: quotation.tax_type,
          domestic_vat_rate: quotation.domestic_vat_rate,
          export_tax_rebate_rate: quotation.export_tax_rebate_rate,
          tax_amount: quotation.tax_amount,
          shipping_handling: quotation.shipping_handling,
          line_items: lineItems.map((item: any) => ({
            line_number: item.line_number,
            product_grade_snapshot: item.product_grade_snapshot,
            unit_of_measure: item.unit_of_measure,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_percent: item.discount_percent,
            line_total: item.line_total,
            description: item.description,
          })),
        }),
      });
      const order = await orderRes.json();

      await activities.create({
        entity_type: 'quotation', entity_id: id,
        activity_type: 'status_change',
        subject: `Order ${order.order_number} created from this quotation`,
      });

      await quotations.update(id, { status: 'accepted' });
      toast.success('Order created from quotation');
      navigate(`/orders/${order.id}`);
    } catch (e) {
      toast.error('Failed to create order');
    } finally {
      setCreatingOrder(false);
    }
  };

  const duplicate = async () => {
    if (!quotation) return;
    try {
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: quotation.company_id,
          contact_id: quotation.contact_id,
          inquiry_id: quotation.inquiry_id,
          currency: quotation.currency,
          subtotal: quotation.subtotal || 0,
          total: quotation.total || 0,
        }),
      });
      const dup = await res.json();
      navigate(`/quotations/${dup.id}`);
    } catch (e) {
      toast.error('Failed to duplicate quotation');
    }
  };

  const remove = async () => {
    if (!id) return;
    try {
      await quotations.update(id, { deleted_at: new Date().toISOString() });
      toast.success('Quotation deleted');
      navigate('/quotations');
    } catch (e) {
      toast.error('Failed to delete quotation');
    }
  };

  const requestSample = async () => {
    if (!id || !quotation) return;
    try {
      const res = await fetch('/api/sample-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quotation_id: id,
          company_id: quotation.company_id,
          contact_id: quotation.contact_id,
          purpose: sampleInfo.purpose || 'Sample for quotation ' + quotation.quotation_number,
          shipping_address: sampleInfo.shipping_address || '',
          sample_charge: 0,
          status: 'approved',
        }),
      });
      const sample = await res.json();
      toast.success('Sample request created');
      setSampleStatus(sample);
      setShowSamplePanel(false);
    } catch (e) {
      toast.error('Failed to create sample request');
    }
  };

  if (!quotation) return <div className="p-6 text-gray-400">{t('common.loading')}</div>;

  const subtotal = lineItems.reduce((sum: number, item: any) => sum + (item.line_total || 0), 0);
  const taxAmount = quotation.tax_amount || 0;

  return (
    <div className="h-full flex flex-col">
      {/* Record Header */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate(-1)} className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0">{t('common.back')}</button>
            <h1 className="text-2xl font-semibold text-gray-900">{quotation.quotation_number}</h1>
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className="flex items-center gap-1 cursor-pointer"
              >
                <StatusBadge status={quotation.status} />
                <span className="text-2xs text-gray-400">▼</span>
              </button>
              {showStatusMenu && (
                <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-md z-10 py-1">
                  {statusOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => changeStatus(opt.value)}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${
                        quotation.status === opt.value ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="text-2xs text-gray-400">{t('page.quotationDetail.rev', 'Rev')} {quotation.version || 1}</span>
          </div>
          <div className="flex items-center gap-2">
            <a href={`/api/quotations/${id}/pdf`} target="_blank" rel="noopener" className="btn-primary btn-sm no-underline inline-flex items-center gap-1"><Icon name="download" size={14} className="mr-1.5" />{t('page.quotationDetail.downloadPdf', 'PDF')}</a>
            <button onClick={() => setShowEditPanel(true)} className="btn-primary btn-sm"><Icon name="square-pen" size={14} className="mr-1.5" />{t('common.edit')}</button>
            <button onClick={() => {
              if (orderId) return;
              setSampleInfo({
                purpose: `Sample for ${quotation.quotation_number}`,
                quantity: lineItems[0] ? `${lineItems[0].quantity} ${lineItems[0].unit_of_measure}` : '',
                shipping_address: '',
              });
              setShowSamplePanel(true);
            }} className={`btn-secondary btn-sm ${orderId ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!!orderId}><Icon name="flask-conical" size={14} className="mr-1.5" />Sample</button>
            <button onClick={createOrder} disabled={!!orderId || creatingOrder} className={`btn-secondary btn-sm ${orderId ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {creatingOrder ? t('page.quotationDetail.editPanel.saving', 'Creating...') : <><Icon name="package" size={14} className="mr-1.5" />{t('page.quotationDetail.createOrder')}</>}
            </button>
            {orderId && (
              <Link to={`/orders/${orderId}`} className="btn-primary btn-sm no-underline inline-flex items-center gap-1">
                <Icon name="package" size={14} />View Order
              </Link>
            )}
            {quotation.status === 'pending_approval' && (
              <>
                <button onClick={() => {
                  const name = prompt('Approver name (optional):');
                  fetch(`/api/quotations/${id}/approve`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'approve', approved_by: name || '' }),
                  }).then(r => r.json()).then(() => { toast.success('Approved'); load(); });
                }} className="btn-primary btn-sm" style={{background:'#16a34a'}}><Icon name="check" size={14} className="mr-1.5" />Approve</button>
                <button onClick={() => {
                  fetch(`/api/quotations/${id}/approve`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'reject' }),
                  }).then(r => r.json()).then(() => { toast.success('Rejected — returned to draft'); load(); });
                }} className="btn-secondary btn-sm" style={{color:'#dc2626',borderColor:'#dc2626'}}>Reject</button>
              </>
            )}
            {/* Actions dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowActionsMenu(!showActionsMenu)}
                className="btn-ghost btn-sm"
              >
                ⋮
              </button>
              {showActionsMenu && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-md z-10 py-1">
                  <button onClick={() => { setShowActionsMenu(false); duplicate(); }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                    <Icon name="copy" size={13} />{t('common.duplicate')}
                  </button>
                  <a href={`/api/quotations/${id}/pdf`} target="_blank" rel="noopener"
                     className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 no-underline">
                    <Icon name="file-down" size={13} />{t('page.quotationDetail.downloadPdf', 'Download PDF')}
                  </a>
                  {!confirmDelete ? (
                    <button onClick={() => setConfirmDelete(true)} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
                      <Icon name="delete" size={13} />{t('common.delete')}
                    </button>
                  ) : (
                    <div className="px-3 py-2">
                      <p className="text-2xs text-red-600 mb-1.5">{t('common.confirmDelete', 'Confirm delete?')}</p>
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
        </div>
        <div className="text-xs text-gray-500">
          <Link to={`/companies/${quotation.company_id}`} className="text-blue-600 hover:underline">{quotation.company_name}</Link>
          {quotation.contact_name && ` · ${t('page.inquiryDetail.contact')}: ${quotation.contact_name}`}
          {` · ${quotation.currency || 'USD'}`}
          {quotation.quotation_date && ` · ${t('page.quotationDetail.quotationDate', 'Date')}: ${quotation.quotation_date}`}
          {quotation.valid_until && ` · ${t('page.quotationDetail.validUntil', 'Valid until')}: ${quotation.valid_until}`}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-5">
              {/* Line Items Table */}
              <div className="card">
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('page.orderDetail.lineItems')} ({lineItems.length})</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="table-header w-10">#</th>
                      <th className="table-header">{t('page.quotationDetail.product')}</th>
                      <th className="table-header text-right">{t('page.quotationDetail.qty')}</th>
                      <th className="table-header">{t('page.quotationDetail.unit')}</th>
                      <th className="table-header text-right">{t('page.quotationDetail.unitPrice')}</th>
                      <th className="table-header text-right">{t('page.quotationDetail.total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item: any) => (
                      <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="table-cell text-xs text-gray-400">{item.line_number}</td>
                        <td className="table-cell">
                          <span className="text-sm text-gray-900">{item.product_grade_snapshot}</span>
                          {item.description && <span className="text-2xs text-gray-400 block">{item.description}</span>}
                        </td>
                        <td className="table-cell text-right font-mono text-sm">{item.quantity}</td>
                        <td className="table-cell text-xs text-gray-500">{item.unit_of_measure}</td>
                        <td className="table-cell text-right font-mono text-sm">{formatCurrency(item.unit_price, quotation.currency)}</td>
                        <td className="table-cell text-right font-mono text-sm font-medium">{formatCurrency(item.line_total, quotation.currency)}</td>
                      </tr>
                    ))}
                    {lineItems.length === 0 && (
                      <tr><td colSpan={6} className="text-center py-8 text-xs text-gray-400">{t('common.no')} line items</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Terms */}
              <div className="card p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('page.quotationDetail.terms')}</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><span className="text-2xs text-gray-400 block">{t('page.quotationDetail.incoterm')}</span><span className="text-gray-700">{quotation.incoterm || '—'}</span></div>
                  <div className="col-span-2"><span className="text-2xs text-gray-400 block">{t('page.quotationDetail.payment')}</span><span className="text-gray-700">{quotation.payment_term || '—'}</span></div>
                  <div className="col-span-3"><span className="text-2xs text-gray-400 block">{t('page.quotationDetail.delivery')}</span><span className="text-gray-700">{quotation.delivery_term || '—'}</span></div>
                </div>
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-4">
              <div className="card p-4">
                <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('page.quotationDetail.pricingSummary')}</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>{t('page.quotationDetail.subtotal')}</span>
                    <span className="font-mono">{formatCurrency(quotation.subtotal ?? subtotal, quotation.currency)}</span>
                  </div>
                  {quotation.discount_percent > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>{t('page.quotationDetail.discount')} ({quotation.discount_percent}%)</span>
                      <span className="font-mono">-{formatCurrency(quotation.discount_amount || 0, quotation.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-500">
                    <span>{t('page.quotationDetail.shipping')}</span>
                    <span className="font-mono">{formatCurrency(quotation.shipping_handling || 0, quotation.currency)}</span>
                  </div>
                  {quotation.tax_type && quotation.tax_type !== 'none' && (
                    <div className="flex justify-between text-gray-500">
                      <span>
                        {quotation.tax_type === 'domestic_vat' ? `VAT (${quotation.domestic_vat_rate || 0}%)` :
                         `Rebate (${quotation.export_tax_rebate_rate || 0}%)`}
                      </span>
                      <span className={`font-mono ${quotation.tax_type === 'export' ? 'text-green-600' : ''}`}>
                        {quotation.tax_type === 'domestic_vat' ? `+${formatCurrency(taxAmount, quotation.currency)}` : `-${formatCurrency(quotation.total ? (quotation.subtotal || subtotal) * (quotation.export_tax_rebate_rate || 0) / 100 : 0, quotation.currency)}`}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-gray-900 pt-2 border-t border-gray-200">
                    <span>{t('page.quotationDetail.total')}</span>
                    <span className="font-mono text-base">{formatCurrency(quotation.total ?? subtotal, quotation.currency)}</span>
                  </div>
                  {quotation.margin_estimate_percent != null && (
                    <div className="flex justify-between text-green-600 text-xs pt-1">
                      <span>{t('page.quotationDetail.estMargin', 'Est. Margin')}</span>
                      <span>{quotation.margin_estimate_percent}%</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="card p-4">
                <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('page.quotationDetail.taxation')}</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('page.quotationDetail.type')}</span>
                    <span className="font-medium">{quotation.tax_type === 'domestic_vat' ? t('page.quotationDetail.editPanel.domesticVat') : quotation.tax_type === 'export' ? t('page.quotationDetail.editPanel.exportTax') : t('common.na', 'N/A')}</span>
                  </div>
                  {quotation.domestic_vat_rate > 0 && (
                    <div className="flex justify-between"><span className="text-gray-500">{t('page.quotationDetail.vatRate', 'VAT Rate')}</span><span>{quotation.domestic_vat_rate}%</span></div>
                  )}
                  {quotation.export_tax_rebate_rate > 0 && (
                    <div className="flex justify-between"><span className="text-gray-500">{t('page.quotationDetail.rebate')}</span><span className="text-green-600">{quotation.export_tax_rebate_rate}%</span></div>
                  )}
                </div>
              </div>

              <div className="card p-4">
                <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('page.quotationDetail.recentActivity')}</h3>
                <div className="space-y-2">
                  {activityList.slice(0, 5).map((a: any) => (
                    <div key={a.id} className="text-xs text-gray-600">
                      <span className="text-gray-400">{new Date(a.created_at).toLocaleDateString()}</span>
                      {' · '}{a.subject}
                    </div>
                  ))}
                  {activityList.length === 0 && <p className="text-xs text-gray-400">{t('common.no')} activity</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sample Request Panel */}
      {showSamplePanel && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-lg p-6 w-[460px]">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Request Sample — {quotation.quotation_number}</h3>
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-3 text-sm">
                <div className="font-medium text-gray-900">{quotation.company_name}</div>
                {lineItems.length > 0 && (
                  <div className="text-xs text-gray-600 mt-1">
                    Items: {lineItems.map((li: any) => `${li.quantity}x ${li.product_grade_snapshot}`).join(', ')}
                  </div>
                )}
              </div>
              <div>
                <label className="label">Sample Purpose</label>
                <input className="input" value={sampleInfo.purpose} onChange={e => setSampleInfo({...sampleInfo, purpose: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Quantity</label>
                  <input className="input" value={sampleInfo.quantity} onChange={e => setSampleInfo({...sampleInfo, quantity: e.target.value})} />
                </div>
                <div>
                  <label className="label">Shipping Address</label>
                  <input className="input" value={sampleInfo.shipping_address} onChange={e => setSampleInfo({...sampleInfo, shipping_address: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={requestSample} className="btn-primary flex-1">Create Sample Request</button>
                <button onClick={() => setShowSamplePanel(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Panel */}
      {showEditPanel && (
        <QuotationEditPanel
          quotation={{ ...quotation, line_items: lineItems }}
          onClose={() => setShowEditPanel(false)}
          onSaved={load}
        />
      )}

      {/* Email Draft */}
      
    </div>
  );
}
