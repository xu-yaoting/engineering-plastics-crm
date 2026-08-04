import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { quotations, activities } from '../lib/api';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import SidePanel from '../components/shared/SidePanel';
import StatusBadge from '../components/shared/StatusBadge';
import { formatCurrency } from '../lib/currency';
import Icon from '../components/shared/Icon';
import QuotationEditPanel from '../components/quotations/QuotationEditPanel';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import AccountabilityPanel from '../components/shared/AccountabilityPanel';

function QuotationDetailSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex h-full flex-col">
      <div aria-hidden="true" className="flex h-full flex-col animate-pulse motion-reduce:animate-none">
        <header className="flex-shrink-0 border-b border-gray-200 bg-white px-5 py-3">
          <div className="flex min-h-8 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-8 w-8 rounded-md bg-gray-200" />
              <div className="h-5 w-36 rounded bg-gray-200" />
              <div className="h-5 w-20 rounded bg-gray-100" />
            </div>
            <div className="h-8 w-40 rounded-md bg-gray-200" />
          </div>
          <div className="mt-2 h-3 w-64 max-w-full rounded bg-gray-100" />
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

export default function QuotationDetail() {
  const { t } = useTranslation();
  const statusOptions = [
    { value: 'draft', label: t('status.draft') },
    { value: 'pending_approval', label: t('status.pendingApproval') },
    { value: 'approved', label: t('status.approved') },
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
  const [deleting, setDeleting] = useState(false);
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
        subject: t('page.quotationDetail.statusChanged', { status: statusOptions.find(opt => opt.value === newStatus)?.label || newStatus }),
      });
      setShowStatusMenu(false);
      load();
    } catch (e) {
      toast.error(t('page.quotationDetail.statusChangeFailed'));
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
        subject: t('page.quotationDetail.orderActivity', { number: order.order_number }),
      });

      await quotations.update(id, { status: 'accepted' });
      toast.success(t('page.quotationDetail.orderCreated'));
      navigate(`/orders/${order.id}`);
    } catch (e) {
      toast.error(t('page.quotationDetail.orderCreateFailed'));
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
          currency: quotation.currency,
          subtotal: quotation.subtotal || 0,
          total: quotation.total || 0,
          application_description: quotation.application_description || '',
          target_material_requested: quotation.target_material_requested || '',
          quantity_estimate: quotation.quantity_estimate || '',
          urgency: quotation.urgency || 'within_1_month',
          source: quotation.source || 'email',
          line_items: lineItems.map((item: any, index: number) => ({
            line_number: item.line_number || index + 1,
            product_grade_snapshot: item.product_grade_snapshot,
            unit_of_measure: item.unit_of_measure,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_percent: item.discount_percent || 0,
            line_total: item.line_total,
            description: item.description,
          })),
        }),
      });
      const dup = await res.json();
      if (!res.ok || !dup?.id) throw new Error(dup?.message || t('page.quotationDetail.duplicateFailed'));
      navigate(`/quotations/${dup.id}`);
    } catch (e) {
      toast.error(t('page.quotationDetail.duplicateFailed'));
    }
  };

  const remove = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await quotations.delete(id);
      toast.success(t('page.quotationDetail.quotationDeleted'));
      navigate('/quotations');
    } catch (e) {
      toast.error(t('page.quotationDetail.quotationDeleteFailed'));
    } finally {
      setDeleting(false);
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
          purpose: sampleInfo.purpose || t('page.quotationDetail.sampleFor', { number: quotation.quotation_number }),
          shipping_address: sampleInfo.shipping_address || '',
          sample_charge: 0,
          status: 'approved',
        }),
      });
      const sample = await res.json();
      toast.success(t('page.quotationDetail.sampleRequestCreated'));
      setSampleStatus(sample);
      setShowSamplePanel(false);
    } catch (e) {
      toast.error(t('page.quotationDetail.sampleRequestFailed'));
    }
  };

  if (!quotation) return <QuotationDetailSkeleton label={t('common.loading')} />;

  const subtotal = lineItems.reduce((sum: number, item: any) => sum + (item.line_total || 0), 0);
  const taxAmount = quotation.tax_amount || 0;

  return (
    <div className="h-full flex flex-col">
      {/* Record Header */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white px-5 py-3">
        <div className="page-header mb-0 min-h-0 items-stretch sm:items-center">
          <div className="flex min-w-0 items-start gap-2 sm:items-center sm:gap-3">
            <Link to="/quotations" className="icon-btn" aria-label={t('common.back')} title={t('common.back')}><Icon name="back" size={16} /></Link>
            <h1 className="page-heading min-w-0 flex-1 text-lg sm:text-2xl tabular-nums">{quotation.quotation_number}</h1>
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className="flex items-center gap-1 cursor-pointer"
                aria-label={t('page.quotationDetail.status')}
              >
                <StatusBadge status={quotation.status} />
                <Icon name="chevron-down" size={12} className="text-gray-400" />
              </button>
              {showStatusMenu && (
                <div className="menu-surface absolute left-0 top-full mt-1 w-40">
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
            <span className="shrink-0 text-2xs text-gray-400">{t('page.quotationDetail.rev')} {quotation.version || 1}</span>
          </div>
          <div className="page-actions w-full max-w-none flex-nowrap overflow-x-auto whitespace-nowrap pb-1 sm:w-auto sm:max-w-[62%] sm:flex-wrap [&>*]:shrink-0">
            <a href={`/api/quotations/${id}/pdf`} target="_blank" rel="noopener" className="btn-primary btn-sm no-underline inline-flex items-center gap-1"><Icon name="download" size={14} className="mr-1.5" />{t('page.quotationDetail.downloadPdf')}</a>
            <button onClick={() => setShowEditPanel(true)} className="btn-primary btn-sm"><Icon name="square-pen" size={14} className="mr-1.5" />{t('common.edit')}</button>
            <button onClick={() => {
              if (orderId) return;
              setSampleInfo({
                purpose: t('page.quotationDetail.sampleFor', { number: quotation.quotation_number }),
                quantity: lineItems[0] ? `${lineItems[0].quantity} ${lineItems[0].unit_of_measure}` : '',
                shipping_address: '',
              });
              setShowSamplePanel(true);
            }} className={`btn-secondary btn-sm ${orderId ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!!orderId}><Icon name="flask-conical" size={14} className="mr-1.5" />{t('page.quotationDetail.sample')}</button>
            <button onClick={createOrder} disabled={!!orderId || creatingOrder} className={`btn-secondary btn-sm ${orderId ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {creatingOrder ? t('page.quotationDetail.editPanel.saving') : <><Icon name="package" size={14} className="mr-1.5" />{t('page.quotationDetail.createOrder')}</>}
            </button>
            {orderId && (
              <Link to={`/orders/${orderId}`} className="btn-primary btn-sm no-underline inline-flex items-center gap-1">
                <Icon name="package" size={14} />{t('page.quotationDetail.viewOrder')}
              </Link>
            )}
            {quotation.status === 'pending_approval' && (
              <>
                <button onClick={() => {
                  const name = prompt(t('page.quotationDetail.approverName'));
                  fetch(`/api/quotations/${id}/approve`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'approve', approved_by: name || '' }),
                  }).then(r => r.json()).then(() => { toast.success(t('page.quotationDetail.approvedToast')); load(); });
                }} className="btn-sm inline-flex items-center rounded bg-green-600 px-3 text-white transition-colors hover:bg-green-700"><Icon name="check" size={14} className="mr-1.5" />{t('page.quotationDetail.approve')}</button>
                <button onClick={() => {
                  fetch(`/api/quotations/${id}/approve`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'reject' }),
                  }).then(r => r.json()).then(() => { toast.success(t('page.quotationDetail.rejectedToast')); load(); });
                }} className="btn-secondary btn-sm border-red-300 text-red-700 hover:bg-red-50">{t('page.quotationDetail.reject')}</button>
              </>
            )}
            {/* Actions dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowActionsMenu(!showActionsMenu)}
                className="icon-btn"
                aria-label={t('common.moreActions')}
                title={t('common.moreActions')}
              >
                <Icon name="more" size={16} />
              </button>
              {showActionsMenu && (
                <div className="menu-surface absolute right-0 top-full mt-1 w-44">
                  <button onClick={() => { setShowActionsMenu(false); duplicate(); }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                    <Icon name="copy" size={13} />{t('common.duplicate')}
                  </button>
                  <a href={`/api/quotations/${id}/pdf`} target="_blank" rel="noopener"
                     className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 no-underline">
                    <Icon name="file-down" size={13} />{t('page.quotationDetail.downloadPdf')}
                  </a>
                  <button onClick={() => { setShowActionsMenu(false); setConfirmDelete(true); }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
                    <Icon name="delete" size={13} />{t('common.delete')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          <Link to={`/companies/${quotation.company_id}`} className="text-blue-600 hover:underline">{quotation.company_name}</Link>
          {quotation.contact_name && ` · ${t('page.inquiryDetail.contact')}: ${quotation.contact_name}`}
          {` · ${quotation.currency || 'USD'}`}
          {quotation.quotation_date && ` · ${t('page.quotationDetail.quotationDate')}: ${quotation.quotation_date}`}
          {quotation.valid_until && ` · ${t('page.quotationDetail.validUntil')}: ${quotation.valid_until}`}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6">
          <div className="section-band commercial-summary mb-6 p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="section-label text-gray-400">{t('page.quotationDetail.total')}</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">{formatCurrency(quotation.total ?? subtotal, quotation.currency)}</p>
              </div>
              <StatusBadge status={quotation.status} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-gray-200 pt-4 md:grid-cols-4">
              <div><span className="text-2xs text-gray-400">{t('page.inquiryDetail.customer')}</span><div className="mt-1 text-sm"><Link to={`/companies/${quotation.company_id}`} className="text-blue-600 hover:underline">{quotation.company_name}</Link></div></div>
              <div><span className="text-2xs text-gray-400">{t('page.quotationDetail.quotationDate')}</span><div className="mt-1 text-sm text-gray-700">{quotation.quotation_date || '—'}</div></div>
              <div><span className="text-2xs text-gray-400">{t('page.quotationDetail.validUntil')}</span><div className="mt-1 text-sm text-gray-700">{quotation.valid_until || '—'}</div></div>
              <div><span className="text-2xs text-gray-400">{t('page.quotationDetail.currency')}</span><div className="mt-1 text-sm text-gray-700">{quotation.currency || 'USD'}</div></div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-5">
              {/* Line Items Table */}
              <div className="data-surface overflow-x-auto">
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="section-label">{t('page.orderDetail.lineItems')} ({lineItems.length})</h3>
                </div>
                <div className="space-y-2 p-3 md:hidden">
                  {lineItems.map((item: any) => (
                    <article key={item.id} className="rounded border border-gray-200 bg-gray-50/50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-2xs tabular-nums text-gray-400">#{item.line_number}</p>
                          <h4 className="break-words text-sm font-medium text-gray-900">{item.product_grade_snapshot}</h4>
                          {item.description && <p className="mt-1 break-words text-2xs text-gray-500">{item.description}</p>}
                        </div>
                        <span className="shrink-0 text-sm font-medium tabular-nums text-gray-900">
                          {formatCurrency(item.line_total, quotation.currency)}
                        </span>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gray-200 pt-3 text-sm">
                        <div>
                          <dt className="section-label">{t('page.quotationDetail.qty')}</dt>
                          <dd className="tabular-nums text-gray-700">{item.quantity}</dd>
                        </div>
                        <div>
                          <dt className="section-label">{t('page.quotationDetail.unit')}</dt>
                          <dd className="text-gray-700">{item.unit_of_measure}</dd>
                        </div>
                        <div>
                          <dt className="section-label">{t('page.quotationDetail.unitPrice')}</dt>
                          <dd className="tabular-nums text-gray-700">{formatCurrency(item.unit_price, quotation.currency)}</dd>
                        </div>
                        <div>
                          <dt className="section-label">{t('page.quotationDetail.total')}</dt>
                          <dd className="tabular-nums font-medium text-gray-900">{formatCurrency(item.line_total, quotation.currency)}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                  {lineItems.length === 0 && <div className="empty-state">{t('page.quotationDetail.noLineItems')}</div>}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[680px]">
                    <thead className="sticky top-0 z-10">
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
                          <td className="table-cell text-right tabular-nums text-sm">{item.quantity}</td>
                          <td className="table-cell text-xs text-gray-500">{item.unit_of_measure}</td>
                          <td className="table-cell text-right tabular-nums text-sm">{formatCurrency(item.unit_price, quotation.currency)}</td>
                          <td className="table-cell text-right tabular-nums text-sm font-medium">{formatCurrency(item.line_total, quotation.currency)}</td>
                        </tr>
                      ))}
                      {lineItems.length === 0 && (
                        <tr><td colSpan={6}><div className="empty-state">{t('page.quotationDetail.noLineItems')}</div></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Terms */}
              <div className="card p-4">
                <h3 className="section-label mb-3">{t('page.quotationDetail.terms')}</h3>
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
                <AccountabilityPanel entityType="quotation" entityId={id!} record={quotation} />
              </div>
              <div className="card p-4">
                <h3 className="section-label mb-3">{t('page.quotationDetail.pricingSummary')}</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>{t('page.quotationDetail.subtotal')}</span>
                    <span className="tabular-nums">{formatCurrency(quotation.subtotal ?? subtotal, quotation.currency)}</span>
                  </div>
                  {quotation.discount_percent > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>{t('page.quotationDetail.discount')} ({quotation.discount_percent}%)</span>
                      <span className="tabular-nums">-{formatCurrency(quotation.discount_amount || 0, quotation.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-500">
                    <span>{t('page.quotationDetail.shipping')}</span>
                    <span className="tabular-nums">{formatCurrency(quotation.shipping_handling || 0, quotation.currency)}</span>
                  </div>
                  {quotation.tax_type && quotation.tax_type !== 'none' && (
                    <div className="flex justify-between text-gray-500">
                      <span>
                        {quotation.tax_type === 'domestic_vat' ? `VAT (${quotation.domestic_vat_rate || 0}%)` :
                         `Rebate (${quotation.export_tax_rebate_rate || 0}%)`}
                      </span>
                      <span className={`tabular-nums ${quotation.tax_type === 'export' ? 'text-green-600' : ''}`}>
                        {quotation.tax_type === 'domestic_vat' ? `+${formatCurrency(taxAmount, quotation.currency)}` : `-${formatCurrency(quotation.total ? (quotation.subtotal || subtotal) * (quotation.export_tax_rebate_rate || 0) / 100 : 0, quotation.currency)}`}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-gray-900 pt-2 border-t border-gray-200">
                    <span>{t('page.quotationDetail.total')}</span>
                    <span className="tabular-nums text-base">{formatCurrency(quotation.total ?? subtotal, quotation.currency)}</span>
                  </div>
                  {quotation.margin_estimate_percent != null && (
                    <div className="flex justify-between text-green-600 text-xs pt-1">
                      <span>{t('page.quotationDetail.estMargin')}</span>
                      <span>{quotation.margin_estimate_percent}%</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="card p-4">
                <h3 className="section-label mb-3">{t('page.quotationDetail.taxation')}</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('page.quotationDetail.type')}</span>
                    <span className="font-medium">{quotation.tax_type === 'domestic_vat' ? t('page.quotationDetail.editPanel.domesticVat') : quotation.tax_type === 'export' ? t('page.quotationDetail.editPanel.exportTax') : t('common.na')}</span>
                  </div>
                  {quotation.domestic_vat_rate > 0 && (
                    <div className="flex justify-between"><span className="text-gray-500">{t('page.quotationDetail.vatRate')}</span><span>{quotation.domestic_vat_rate}%</span></div>
                  )}
                  {quotation.export_tax_rebate_rate > 0 && (
                    <div className="flex justify-between"><span className="text-gray-500">{t('page.quotationDetail.rebate')}</span><span className="text-green-600">{quotation.export_tax_rebate_rate}%</span></div>
                  )}
                </div>
              </div>

              <div className="card p-4">
                <h3 className="section-label mb-3">{t('page.quotationDetail.recentActivity')}</h3>
                <div className="space-y-2">
                  {activityList.slice(0, 5).map((a: any) => (
                    <div key={a.id} className="text-xs text-gray-600">
                      <span className="text-gray-400">{new Date(a.created_at).toLocaleDateString()}</span>
                      {' · '}{a.subject}
                    </div>
                  ))}
                  {activityList.length === 0 && <p className="text-xs text-gray-400">{t('page.quotationDetail.noActivity')}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sample Request Panel */}
      <SidePanel
        open={showSamplePanel}
        onClose={() => setShowSamplePanel(false)}
        title={t('page.quotationDetail.requestSample')}
        subtitle={quotation.quotation_number}
        width="w-[min(480px,calc(100vw-1rem))]"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-lg p-3 text-sm">
            <div className="font-medium text-gray-900">{quotation.company_name}</div>
            {lineItems.length > 0 && (
              <div className="text-xs text-gray-600 mt-1">
                {t('page.quotationDetail.sampleItems')}: {lineItems.map((li: any) => `${li.quantity}x ${li.product_grade_snapshot}`).join(', ')}
              </div>
            )}
          </div>
          <div>
            <label className="label" htmlFor="quotation-sample-purpose">{t('page.quotationDetail.samplePurpose')}</label>
            <input id="quotation-sample-purpose" className="input" value={sampleInfo.purpose} onChange={e => setSampleInfo({...sampleInfo, purpose: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="quotation-sample-quantity">{t('page.inquiryDetail.quantity')}</label>
              <input id="quotation-sample-quantity" className="input" value={sampleInfo.quantity} onChange={e => setSampleInfo({...sampleInfo, quantity: e.target.value})} />
            </div>
            <div>
              <label className="label" htmlFor="quotation-sample-shipping-address">{t('page.orderDetail.shippingAddress')}</label>
              <input id="quotation-sample-shipping-address" className="input" value={sampleInfo.shipping_address} onChange={e => setSampleInfo({...sampleInfo, shipping_address: e.target.value})} autoComplete="street-address" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={requestSample} className="btn-primary flex-1">{t('page.quotationDetail.createSampleRequest')}</button>
            <button onClick={() => setShowSamplePanel(false)} className="btn-secondary">{t('common.cancel')}</button>
          </div>
        </div>
      </SidePanel>
      <ConfirmDialog
        open={confirmDelete}
        title={t('common.delete')}
        description={<>{t('common.confirmDelete')} <strong>{quotation.quotation_number}</strong></>}
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />

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
