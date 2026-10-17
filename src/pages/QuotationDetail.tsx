import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
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
        <header className="flex-shrink-0 border-b border-border bg-surface px-5 py-3">
          <div className="flex min-h-8 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-8 w-8 rounded-md bg-border-strong" />
              <div className="h-5 w-36 rounded bg-border-strong" />
              <div className="h-5 w-20 rounded bg-surface-hover" />
            </div>
            <div className="h-8 w-40 rounded-md bg-border-strong" />
          </div>
          <div className="mt-2 h-3 w-64 max-w-full rounded bg-surface-hover" />
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-canvas">
          <div className="mx-auto max-w-5xl space-y-6 p-6">
            <section className="commercial-summary rounded-md border border-border bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="space-y-3">
                  <div className="h-3 w-20 rounded bg-surface-hover" />
                  <div className="h-8 w-44 rounded bg-border-strong" />
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  <div className="h-3 w-24 rounded bg-surface-hover" />
                  <div className="h-3 w-20 rounded bg-surface-hover" />
                  <div className="h-4 w-28 rounded bg-border-strong" />
                  <div className="h-4 w-24 rounded bg-border-strong" />
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <section className="space-y-5 lg:col-span-2">
                <div className="rounded-md border border-border bg-surface">
                  <div className="border-b border-border px-4 py-3">
                    <div className="h-3 w-24 rounded bg-border-strong" />
                  </div>
                  <div className="divide-y divide-border">
                    {Array.from({ length: 4 }, (_, index) => (
                      <div key={index} className="grid grid-cols-[minmax(0,2fr)_repeat(3,minmax(56px,1fr))] gap-3 px-4 py-4">
                        <div className="h-4 w-4/5 rounded bg-border-strong" />
                        <div className="h-4 rounded bg-surface-hover" />
                        <div className="h-4 rounded bg-surface-hover" />
                        <div className="h-4 rounded bg-border-strong" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="h-28 rounded-md border border-border bg-surface p-4">
                  <div className="h-3 w-20 rounded bg-border-strong" />
                  <div className="mt-4 h-4 w-3/4 rounded bg-surface-hover" />
                </div>
              </section>

              <aside className="space-y-4">
                {[144, 176, 112].map((height, index) => (
                  <div key={index} className="rounded-md border border-border bg-surface p-4" style={{ height }}>
                    <div className="h-3 w-24 rounded bg-border-strong" />
                    <div className="mt-4 space-y-3">
                      <div className="h-3 w-full rounded bg-surface-hover" />
                      <div className="h-3 w-4/5 rounded bg-surface-hover" />
                      <div className="h-3 w-2/3 rounded bg-surface-hover" />
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
  const [loadError, setLoadError] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const actionsBtnRef = useRef<HTMLButtonElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const orderCreationInFlight = useRef(false);
  const createdOrderRef = useRef<{ quotationId: string; orderId: string } | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const duplicationInFlight = useRef(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [savingApproval, setSavingApproval] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [showSamplePanel, setShowSamplePanel] = useState(false);
  const [sampleInfo, setSampleInfo] = useState({ purpose: '', quantity: '', shipping_address: '' });
  const [sampleStatus, setSampleStatus] = useState<any>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const downloadingPdfInFlight = useRef(false);

  const load = () => {
    if (!id) {
      setLoadError(true);
      return;
    }
    setLoadError(false);
    Promise.all([
      quotations.get(id),
      activities.list('quotation', id),
      fetch('/api/orders').then(async res => {
        if (!res.ok) throw new Error(`Orders request failed: ${res.status}`);
        return res.json();
      }),
    ])
      .then(([data, activitiesData, orders]: [any, any[], any[]]) => {
        setQuotation(data);
        setLineItems(data.line_items || []);
        setActivityList(activitiesData);
        const match = orders.find((o: any) => o.quotation_id === id && !o.deleted_at);
        setOrderId(match?.id || data.order_id || null);
      })
      .catch(() => {
        setQuotation(null);
        setLineItems([]);
        setActivityList([]);
        setOrderId(null);
        setLoadError(true);
      });
  };

  useEffect(() => { load(); }, [id]);

  const readError = async (res: Response, fallback: string) => {
    const data = await res.json().catch(() => null);
    return data?.error || data?.message || fallback;
  };

  const downloadPdf = async () => {
    if (!id || downloadingPdfInFlight.current) return;
    downloadingPdfInFlight.current = true;
    setDownloadingPdf(true);
    let objectUrl: string | null = null;
    try {
      const res = await fetch(`/api/quotations/${id}/pdf`);
      if (!res.ok) throw new Error(await readError(res, t('page.error.loadFailed')));
      objectUrl = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${quotation.quotation_number || 'quotation'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      const downloadUrl = objectUrl;
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      objectUrl = null;
      setShowActionsMenu(false);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : t('page.error.loadFailed'));
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      downloadingPdfInFlight.current = false;
      setDownloadingPdf(false);
    }
  };

  const changeStatus = async (newStatus: string) => {
    if (!id || changingStatus || savingApproval) return;
    setChangingStatus(true);
    try {
      try {
        await quotations.update(id, { status: newStatus });
      } catch {
        toast.error(t('page.quotationDetail.statusChangeFailed'));
        return;
      }
      setShowStatusMenu(false);
      load();
      try {
        await activities.create({
          entity_type: 'quotation', entity_id: id,
          activity_type: 'status_change',
          subject: t('page.quotationDetail.statusChanged', { status: statusOptions.find(opt => opt.value === newStatus)?.label || newStatus }),
        });
      } catch {
        toast.error(t('page.activityTimeline.activityLogFailed'));
      }
    } finally {
      setChangingStatus(false);
    }
  };

  const handleApproval = async (action: 'approve' | 'reject') => {
    if (!id || savingApproval || changingStatus) return;
    const approverName = action === 'approve' ? prompt(t('page.quotationDetail.approverName')) : '';
    setSavingApproval(true);
    try {
      const res = await fetch(`/api/quotations/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, approved_by: approverName || '' }),
      });
      if (!res.ok) {
        toast.error(await readError(res, t('page.quotationDetail.statusChangeFailed')));
        return;
      }
      toast.success(t(action === 'approve' ? 'page.quotationDetail.approvedToast' : 'page.quotationDetail.rejectedToast'));
      load();
    } catch {
      toast.error(t('page.quotationDetail.statusChangeFailed'));
    } finally {
      setSavingApproval(false);
    }
  };

  const createOrder = async () => {
    if (!id || !quotation || orderCreationInFlight.current) return;
    const existingOrderId = orderId || (createdOrderRef.current?.quotationId === id ? createdOrderRef.current.orderId : null);
    if (existingOrderId) {
      navigate(`/orders/${existingOrderId}`);
      return;
    }
    orderCreationInFlight.current = true;
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
          subtotal: quotation.subtotal ?? subtotal,
          total: quotation.total ?? subtotal,
          discount_percent: 0,
          discount_amount: 0,
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
            discount_percent: 0,
            line_total: item.line_total,
            description: item.description,
          })),
        }),
      });
      if (!orderRes.ok) {
        throw new Error(await readError(orderRes, t('page.quotationDetail.orderCreateFailed')));
      }
      const order = await orderRes.json().catch(() => null);
      if (!order?.id) throw new Error(t('page.quotationDetail.orderCreateFailed'));
      createdOrderRef.current = { quotationId: id, orderId: order.id };
      setOrderId(order.id);

      const followUpFailures: string[] = [];
      try {
        await activities.create({
          entity_type: 'quotation', entity_id: id,
          activity_type: 'status_change',
          subject: t('page.quotationDetail.orderActivity', { number: order.order_number }),
        });
      } catch {
        followUpFailures.push(t('page.activityTimeline.activityLogFailed'));
      }
      try {
        await quotations.update(id, { status: 'accepted' });
      } catch {
        followUpFailures.push(t('page.quotationDetail.statusChangeFailed'));
      }
      if (followUpFailures.length) {
        toast.error(`${t('page.quotationDetail.orderCreated')} · ${followUpFailures.join(' · ')}`);
      } else {
        toast.success(t('page.quotationDetail.orderCreated'));
      }
      navigate(`/orders/${order.id}`);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : t('page.quotationDetail.orderCreateFailed'));
    } finally {
      orderCreationInFlight.current = false;
      setCreatingOrder(false);
    }
  };

  const duplicate = async () => {
    if (!quotation || duplicationInFlight.current) return;
    duplicationInFlight.current = true;
    setDuplicating(true);
    try {
      const copiedLines = lineItems.map((item: any, index: number) => ({
        line_number: item.line_number || index + 1,
        product_grade_snapshot: item.product_grade_snapshot,
        unit_of_measure: item.unit_of_measure,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: 0,
        line_total: item.quantity * item.unit_price,
        description: item.description,
      }));
      const copiedSubtotal = copiedLines.reduce((sum: number, item: { line_total: number }) => sum + item.line_total, 0);
      const copiedTax = quotation.tax_type === 'domestic_vat' ? copiedSubtotal * (quotation.domestic_vat_rate || 0) / 100 : 0;
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: quotation.company_id,
          contact_id: quotation.contact_id,
          currency: quotation.currency,
          subtotal: copiedSubtotal,
          total: copiedSubtotal + copiedTax + (quotation.shipping_handling || 0),
          discount_percent: 0,
          discount_amount: 0,
          application_description: quotation.application_description || '',
          urgency: quotation.urgency || 'within_1_month',
          source: quotation.source || 'email',
          incoterm: quotation.incoterm || '',
          payment_term: quotation.payment_term || '',
          delivery_term: quotation.delivery_term || '',
          tax_type: quotation.tax_type || 'none',
          domestic_vat_rate: quotation.domestic_vat_rate || 0,
          export_tax_rebate_rate: quotation.export_tax_rebate_rate || 0,
          tax_amount: copiedTax,
          shipping_handling: quotation.shipping_handling || 0,
          internal_notes: quotation.internal_notes ?? '',
          quotation_date: quotation.quotation_date || new Date().toISOString().slice(0, 10),
          valid_until: quotation.valid_until || '',
          line_items: copiedLines,
        }),
      });
      const dup = await res.json().catch(() => null);
      if (!res.ok || !dup?.id) throw new Error(dup?.error || dup?.message || t('page.quotationDetail.duplicateFailed'));
      navigate(`/quotations/${dup.id}`);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : t('page.quotationDetail.duplicateFailed'));
    } finally {
      duplicationInFlight.current = false;
      setDuplicating(false);
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
      if (!res.ok) {
        throw new Error(await readError(res, t('page.quotationDetail.sampleRequestFailed')));
      }
      const sample = await res.json();
      toast.success(t('page.quotationDetail.sampleRequestCreated'));
      setSampleStatus(sample);
      setShowSamplePanel(false);
    } catch (e) {
      toast.error(t('page.quotationDetail.sampleRequestFailed'));
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

  if (!quotation) return <QuotationDetailSkeleton label={t('common.loading')} />;

  const subtotal = lineItems.reduce((sum: number, item: any) => sum + (item.line_total || 0), 0);
  const taxAmount = quotation.tax_amount || 0;

  return (
    <div className="h-full flex flex-col">
      {/* Record Header */}
      <div className="flex-shrink-0 border-b border-border bg-surface px-5 py-3">
        <div className="page-header mb-0 min-h-0 items-stretch sm:items-center">
          <div className="flex min-w-0 items-start gap-2 sm:items-center sm:gap-3">
            <Link to="/quotations" className="icon-btn" aria-label={t('common.back')} title={t('common.back')}><Icon name="back" size={16} /></Link>
            <h1 className="page-heading min-w-0 flex-1 text-lg sm:text-2xl tabular-nums">{quotation.quotation_number}</h1>
            <div className="relative">
                <button
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                  disabled={changingStatus || savingApproval}
                  className="flex items-center gap-1 cursor-pointer"
                aria-label={t('page.quotations.status')}
              >
                <StatusBadge status={quotation.status} />
                <Icon name="chevron-down" size={12} className="text-ink-subtle" />
              </button>
              {showStatusMenu && (
                <div className="menu-surface absolute left-0 top-full mt-1 w-40">
                  {statusOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => changeStatus(opt.value)}
                      disabled={changingStatus || savingApproval}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-surface-hover ${
                        quotation.status === opt.value ? 'bg-stage-quotation-soft text-stage-quotation font-medium' : 'text-ink-muted'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="shrink-0 text-2xs text-ink-subtle">{t('page.quotationDetail.rev')} {quotation.version || 1}</span>
          </div>
          <div className="page-actions w-full max-w-none flex-nowrap overflow-x-auto whitespace-nowrap pb-1 sm:w-auto sm:max-w-[62%] sm:flex-wrap [&>*]:shrink-0">
            <button onClick={() => setShowEditPanel(true)} className="btn-primary btn-sm"><Icon name="square-pen" size={14} className="mr-1.5" />{t('common.edit')}</button>
            <button onClick={createOrder} disabled={!!orderId || creatingOrder} aria-busy={creatingOrder} className={`btn-primary btn-sm ${orderId ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {creatingOrder ? t('page.quotationDetail.editPanel.saving') : <><Icon name="package" size={14} className="mr-1.5" />{t('page.quotationDetail.createOrder')}</>}
            </button>
            {orderId && (
              <Link to={`/orders/${orderId}`} className="btn-primary btn-sm no-underline inline-flex items-center gap-1">
                <Icon name="package" size={14} />{t('page.quotationDetail.viewOrder')}
              </Link>
            )}
            {quotation.status === 'pending_approval' && (
              <>
                <button onClick={() => handleApproval('approve')} disabled={savingApproval || changingStatus} className="btn-sm inline-flex items-center rounded bg-success-600 px-3 text-white transition-colors hover:bg-success"><Icon name="check" size={14} className="mr-1.5" />{t('page.quotationDetail.approve')}</button>
                <button onClick={() => handleApproval('reject')} disabled={savingApproval || changingStatus} className="btn-secondary btn-sm border-danger text-danger hover:bg-danger-soft">{t('page.quotationDetail.reject')}</button>
              </>
            )}
            {/* Actions dropdown */}
            <button
              ref={actionsBtnRef}
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              className="icon-btn"
              aria-label={t('common.moreActions')}
              title={t('common.moreActions')}
            >
              <Icon name="more" size={16} />
            </button>
            {showActionsMenu && actionsBtnRef.current && createPortal(
              <div className="menu-surface fixed z-50 w-44 py-1"
                style={{
                  top: actionsBtnRef.current.getBoundingClientRect().bottom + 4,
                  right: window.innerWidth - actionsBtnRef.current.getBoundingClientRect().right,
                }}
              >
                <button type="button" onClick={downloadPdf} disabled={downloadingPdf} aria-busy={downloadingPdf}
                   className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-ink-muted hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed">
                  <Icon name="file-down" size={13} />{t('page.quotationDetail.downloadPdf')}
                </button>
                <button onClick={() => { setShowActionsMenu(false); duplicate(); }} disabled={duplicating} aria-busy={duplicating} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-ink-muted hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed">
                  <Icon name="copy" size={13} />{t('common.duplicate')}
                </button>
                <button onClick={() => {
                  setShowActionsMenu(false);
                  if (orderId) return;
                  setSampleInfo({ purpose: t('page.quotationDetail.sampleFor', { number: quotation.quotation_number }), quantity: lineItems[0] ? `${lineItems[0].quantity} ${lineItems[0].unit_of_measure}` : '', shipping_address: '' });
                  setShowSamplePanel(true);
                }} className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-xs ${orderId ? 'text-ink-subtle cursor-not-allowed' : 'text-ink-muted hover:bg-surface-hover'}`} disabled={!!orderId}>
                  <Icon name="flask-conical" size={13} />{t('page.quotationDetail.sample')}
                </button>
                <button onClick={() => { setShowActionsMenu(false); setConfirmDelete(true); }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-danger hover:bg-danger-soft">
                  <Icon name="delete" size={13} />{t('common.delete')}
                </button>
              </div>,
              document.body
            )}
          </div>
        </div>
        <div className="text-xs text-ink-muted">
          <Link to={`/companies/${quotation.company_id}`} className="text-brand hover:underline">{quotation.company_name}</Link>
          {quotation.contact_name && ` · ${t('page.inquiryDetail.contact')}: ${quotation.contact_name}`}
          {` · ${quotation.currency || 'USD'}`}
          {quotation.quotation_date && ` · ${t('page.quotationDetail.quotationDate')}: ${quotation.quotation_date}`}
          {quotation.valid_until && ` · ${t('page.quotationDetail.validUntil')}: ${quotation.valid_until}`}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <div>
          <div className="section-band commercial-summary mb-6 p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="section-label text-ink-subtle">{t('page.quotationDetail.total')}</p>
                <p className="mt-1 text-2xl font-semibold text-ink tabular-nums">{formatCurrency(quotation.total ?? subtotal, quotation.currency)}</p>
              </div>
              <StatusBadge status={quotation.status} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 md:grid-cols-4">
              <div><span className="text-2xs text-ink-subtle">{t('page.inquiryDetail.customer')}</span><div className="mt-1 text-sm"><Link to={`/companies/${quotation.company_id}`} className="text-brand hover:underline">{quotation.company_name}</Link></div></div>
              <div><span className="text-2xs text-ink-subtle">{t('page.quotationDetail.quotationDate')}</span><div className="mt-1 text-sm text-ink-muted">{quotation.quotation_date || '—'}</div></div>
              <div><span className="text-2xs text-ink-subtle">{t('page.quotationDetail.validUntil')}</span><div className="mt-1 text-sm text-ink-muted">{quotation.valid_until || '—'}</div></div>
              <div><span className="text-2xs text-ink-subtle">{t('page.quotationDetail.currency')}</span><div className="mt-1 text-sm text-ink-muted">{quotation.currency || 'USD'}</div></div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-5">
              {/* Line Items Table */}
              <div className="data-surface overflow-x-auto">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h3 className="section-label">{t('page.orderDetail.lineItems')} ({lineItems.length})</h3>
                </div>
                <div className="space-y-2 p-3 md:hidden">
                  {lineItems.map((item: any) => (
                    <article key={item.id} className="rounded border border-border bg-surface-subtle p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-2xs tabular-nums text-ink-subtle">#{item.line_number}</p>
                          <h4 className="break-words text-sm font-medium text-ink">{item.product_grade_snapshot}</h4>
                          {item.description && <p className="mt-1 break-words text-2xs text-ink-muted">{item.description}</p>}
                        </div>
                        <span className="shrink-0 text-sm font-medium tabular-nums text-ink">
                          {formatCurrency(item.line_total, quotation.currency)}
                        </span>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 text-sm">
                        <div>
                          <dt className="section-label">{t('page.quotationDetail.qty')}</dt>
                          <dd className="tabular-nums text-ink-muted">{item.quantity}</dd>
                        </div>
                        <div>
                          <dt className="section-label">{t('page.quotationDetail.unit')}</dt>
                          <dd className="text-ink-muted">{item.unit_of_measure}</dd>
                        </div>
                        <div>
                          <dt className="section-label">{t('page.quotationDetail.unitPrice')}</dt>
                          <dd className="tabular-nums text-ink-muted">{formatCurrency(item.unit_price, quotation.currency)}</dd>
                        </div>
                        <div>
                          <dt className="section-label">{t('page.quotationDetail.total')}</dt>
                          <dd className="tabular-nums font-medium text-ink">{formatCurrency(item.line_total, quotation.currency)}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                  {lineItems.length === 0 && <div className="empty-state">{t('page.quotationDetail.noLineItems')}</div>}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[680px]">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-border bg-surface-subtle">
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
                        <tr key={item.id} className="border-b border-border hover:bg-surface-hover">
                          <td className="table-cell text-xs text-ink-subtle">{item.line_number}</td>
                          <td className="table-cell">
                            <span className="text-sm text-ink">{item.product_grade_snapshot}</span>
                            {item.description && <span className="block text-2xs text-ink-subtle">{item.description}</span>}
                          </td>
                          <td className="table-cell text-right tabular-nums text-sm">{item.quantity}</td>
                          <td className="table-cell text-xs text-ink-muted">{item.unit_of_measure}</td>
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

              {/* Pricing Summary */}
              <div className="card p-4">
                <h3 className="section-label mb-3">{t('page.quotationDetail.pricingSummary')}</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-ink-muted">
                    <span>{t('page.quotationDetail.subtotal')}</span>
                    <span className="tabular-nums">{formatCurrency(quotation.subtotal ?? subtotal, quotation.currency)}</span>
                  </div>
                  {quotation.shipping_handling > 0 && (
                    <div className="flex justify-between text-ink-muted">
                      <span>{t('page.quotationDetail.shipping')}</span>
                      <span className="tabular-nums">{formatCurrency(quotation.shipping_handling, quotation.currency)}</span>
                    </div>
                  )}
                  {quotation.tax_type && quotation.tax_type !== 'none' && (
                    <div className="flex justify-between text-xs text-ink-subtle">
                      <span>{quotation.tax_type === 'domestic_vat' ? `VAT ${quotation.domestic_vat_rate || 0}%` : `${t('page.quotationDetail.editPanel.exportTax')} ${quotation.export_tax_rebate_rate || 0}%`}</span>
                      <span className="tabular-nums">{quotation.tax_type === 'domestic_vat' ? `+${formatCurrency(taxAmount, quotation.currency)}` : ''}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-2 font-semibold text-ink">
                    <span>{t('page.quotationDetail.total')}</span>
                    <span className="tabular-nums text-base">{formatCurrency(quotation.total ?? subtotal, quotation.currency)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-4">
              {/* Terms */}
              <div className="card p-4">
                <h3 className="section-label mb-3">{t('page.quotationDetail.terms')}</h3>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div><span className="block text-2xs text-ink-subtle">{t('page.quotationDetail.incoterm')}</span><span className="text-ink-muted">{quotation.incoterm || '—'}</span></div>
                  <div><span className="block text-2xs text-ink-subtle">{t('page.quotationDetail.payment')}</span><span className="text-ink-muted">{quotation.payment_term || '—'}</span></div>
                  <div><span className="block text-2xs text-ink-subtle">{t('page.quotationDetail.delivery')}</span><span className="text-ink-muted">{quotation.delivery_term || '—'}</span></div>
                </div>
              </div>

              {/* Responsibility */}
              <div className="card p-4">
                <AccountabilityPanel entityType="quotation" entityId={id!} record={quotation} />
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
          <div className="bg-brand-soft rounded-lg p-3 text-sm">
            <div className="font-medium text-ink">{quotation.company_name}</div>
            {lineItems.length > 0 && (
              <div className="text-xs text-ink-muted mt-1">
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
