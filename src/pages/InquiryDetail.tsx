import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { inquiries, activities, tasks, team, type TeamMember } from '../lib/api';
import StatusBadge from '../components/shared/StatusBadge';
import ActivityTimeline from '../components/shared/ActivityTimeline';
import TaskSection from '../components/shared/TaskSection';
import EmailDraftPanel from '../components/shared/EmailDraftPanel';
import QuotationEditPanel from '../components/quotations/QuotationEditPanel';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import SidePanel from '../components/shared/SidePanel';
import Icon from '../components/shared/Icon';
import { formatCurrency } from '../lib/currency';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import AccountabilityPanel from '../components/shared/AccountabilityPanel';
import { useAuth } from '../lib/auth';

const statusOptions = [
  { value: 'open', labelKey: 'status.open', color: 'badge-blue' },
  { value: 'under_review', labelKey: 'status.underReview', color: 'badge-yellow' },
  { value: 'quoted', labelKey: 'status.quoted', color: 'badge-green' },
  { value: 'closed_won', labelKey: 'status.won', color: 'badge-green' },
  { value: 'closed_lost', labelKey: 'status.lost', color: 'badge-red' },
];

function InquiryDetailSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex h-full flex-col">
      <div aria-hidden="true" className="flex h-full flex-col animate-pulse motion-reduce:animate-none">
        <header className="shrink-0 border-b border-gray-200 bg-white px-5 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-8 w-8 rounded-md bg-gray-100" />
              <div className="h-6 w-40 rounded bg-gray-200" />
              <div className="h-5 w-20 rounded bg-gray-100" />
            </div>
            <div className="h-8 w-32 rounded-md bg-gray-100" />
          </div>
          <div className="mt-2 h-3 w-80 max-w-full rounded bg-gray-100" />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto bg-gray-50">
          <div className="mx-auto max-w-5xl p-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <section className="space-y-5 lg:col-span-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="rounded-md border border-gray-200 bg-white p-4">
                    <div className="h-3 w-36 rounded bg-gray-200" />
                    <div className="mt-4 h-16 rounded bg-gray-100" />
                  </div>
                ))}
              </section>
              <aside className="space-y-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-md border border-gray-200 bg-white p-4">
                    <div className="h-3 w-24 rounded bg-gray-200" />
                    <div className="mt-4 h-12 rounded bg-gray-100" />
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

export default function InquiryDetail() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [inquiry, setInquiry] = useState<any>(null);
  const [activityList, setActivityList] = useState<any[]>([]);
  const [taskList, setTaskList] = useState<any[]>([]);
  const [noteText, setNoteText] = useState('');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showQuotationPanel, setShowQuotationPanel] = useState(false);
  const [showEmailDraft, setShowEmailDraft] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editDescriptionError, setEditDescriptionError] = useState('');
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [editForm, setEditForm] = useState({
    application_description: '', target_material_requested: '', quantity_estimate: '',
    urgency: 'within_1_month', source: '', owner_user_id: '',
  });

  useEffect(() => {
    if (user?.role === 'admin') {
      team.list().then(setMembers).catch(() => setMembers([]));
    }
  }, [user?.role]);

  const load = () => {
    if (!id) return;
    inquiries.get(id).then(setInquiry);
    activities.list('inquiry', id).then(setActivityList);
    tasks.list({ entity_type: 'inquiry', entity_id: id }).then(setTaskList);
  };

  useEffect(() => { load(); }, [id]);

  const changeStatus = async (newStatus: string) => {
    if (!id) return;
    try {
      await inquiries.update(id, { status: newStatus });
      await activities.create({
        entity_type: 'inquiry', entity_id: id,
        activity_type: 'status_change',
        subject: t('page.inquiryDetail.statusChanged', { status: t(statusOptions.find(opt => opt.value === newStatus)?.labelKey || 'status.open') }),
      });
      setShowStatusMenu(false);
      load();
    } catch (e) {
      toast.error(t('page.inquiryDetail.statusChangeFailed'));
    }
  };

  const startQuotation = () => {
    if (!inquiry) return;
    setShowQuotationPanel(true);
  };

  const handleQuotationSaved = async (savedQuotation?: any) => {
    setShowQuotationPanel(false);
    if (!id || !savedQuotation?.id) {
      load();
      return;
    }

    try {
      await inquiries.update(id, { status: 'quoted', converted_to_quotation_id: savedQuotation.id });
      await activities.create({
        entity_type: 'inquiry', entity_id: id,
        activity_type: 'status_change',
        subject: t('page.inquiryDetail.quotationActivity', { number: savedQuotation.quotation_number }),
      });
    } catch (e) {
      // The quote is already saved; surface a sync issue without pretending the quote failed.
      toast.error(t('page.inquiryDetail.quotationCreateFailed'));
    }

    // Stay on the opportunity detail page after creating a quotation.
    // The quotation block will auto-refresh with the new quotation data.
    load();
  };

  const logActivity = async (type: string) => {
    if (!id || !inquiry) return;
    await activities.create({
      entity_type: 'inquiry', entity_id: id,
      activity_type: type,
      subject: type === 'note' ? noteText : `${type} on ${inquiry.inquiry_number}`,
      description: type !== 'note' ? noteText : '',
    });
    setNoteText('');
    load();
  };

  const duplicate = async () => {
    if (!inquiry) return;
    try {
      const dup = await inquiries.create({
        company_id: inquiry.company_id,
        contact_id: inquiry.contact_id,
        source: inquiry.source || 'email',
        application_description: inquiry.application_description,
        target_material_requested: inquiry.target_material_requested,
        quantity_estimate: inquiry.quantity_estimate,
        urgency: inquiry.urgency,
        currency: inquiry.currency,
      });
      toast.success(t('page.inquiryDetail.inquiryDuplicated'));
      navigate(`/inquiries/${dup.id}`);
    } catch (e) {
      toast.error(t('page.inquiryDetail.duplicateFailed'));
    }
  };

  const remove = async () => {
    if (!id || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/inquiries/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error(t('page.inquiryDetail.deleteFailed'));
        return;
      }
      toast.success(t('page.inquiryDetail.inquiryDeleted'));
      navigate('/inquiries');
    } catch (e) {
      toast.error(t('page.inquiryDetail.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const saveEdit = async () => {
    if (!id || savingEdit) return;
    if (!editForm.application_description.trim()) {
      setEditDescriptionError(t('page.inquiryNew.descriptionRequired'));
      descriptionInputRef.current?.focus();
      return;
    }
    setEditDescriptionError('');
    setSavingEdit(true);
    try {
      await inquiries.update(id, editForm);
      setShowEditPanel(false);
      toast.success(t('page.inquiryDetail.inquiryUpdated'));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('page.inquiryDetail.inquirySaveFailed'));
    } finally {
      setSavingEdit(false);
    }
  };

  if (!inquiry) return <InquiryDetailSkeleton label={t('common.loading')} />;

  const urgencyColor = (u: string) => {
    if (u === 'immediate') return 'text-red-600 bg-red-50';
    if (u === 'within_2_weeks') return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-500 bg-gray-100';
  };

  const urgencyLabel = (urgency?: string): string => {
    const key = urgency === 'immediate' ? 'immediate'
      : urgency === 'within_2_weeks' ? 'within2Weeks'
        : urgency === 'within_1_month' ? 'within1Month'
          : urgency === 'no_rush' ? 'noRush'
            : 'within1Month';
    return String(t(`page.inquiryNew.${key}`, urgency || ''));
  };

  const sourceLabel = (source?: string): string => {
    const key = source === 'phone_wechat' ? 'phoneWechat'
      : source === 'social_media' ? 'socialMedia'
        : source === 'alibaba_platform' ? 'alibabaPlatform'
          : source === 'trade_show' ? 'tradeShow'
            : source || 'email';
    return String(t(`page.inquiryNew.${key}`, source || ''));
  };

  const latestQuotation = inquiry.latest_quotation;
  const canQuote = !latestQuotation && (inquiry.status === 'open' || inquiry.status === 'under_review');
  const quotationDraft = {
    company_id: inquiry.company_id,
    contact_id: inquiry.contact_id,
    inquiry_id: id,
    inquiry_number: inquiry.inquiry_number,
    company_name: inquiry.company_name,
    contact_name: inquiry.contact_name,
    target_material_requested: inquiry.target_material_requested,
    quantity_estimate: inquiry.quantity_estimate,
    currency: inquiry.currency || 'USD',
  };

  return (
    <div className="h-full flex flex-col">
      {/* Record Header */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white px-5 py-3">
        <div className="page-header mb-0 min-h-0 items-center">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate(-1)} className="icon-btn" aria-label={t('common.back')} title={t('common.back')}><Icon name="back" size={16} /></button>
            <h1 className="page-heading truncate tabular-nums">{inquiry.inquiry_number}</h1>
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className="flex items-center gap-1 cursor-pointer"
                aria-label={t('page.inquiryDetail.status')}
              >
                <StatusBadge status={inquiry.status} />
                <Icon name="chevron-down" size={12} className="text-gray-400" />
              </button>
              {showStatusMenu && (
                <div className="menu-surface absolute left-0 top-full mt-1 w-44">
                  {statusOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => changeStatus(opt.value)}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${
                        inquiry.status === opt.value ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                      }`}
                    >
                      {t(opt.labelKey)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="page-actions">
            <button onClick={() => {
              setEditForm({
                application_description: inquiry.application_description || '',
                target_material_requested: inquiry.target_material_requested || '',
                quantity_estimate: inquiry.quantity_estimate || '',
                urgency: inquiry.urgency || 'within_1_month',
                source: inquiry.source || '',
                owner_user_id: inquiry.owner_user_id || '',
              });
              setSavingEdit(false);
              setEditDescriptionError('');
              setShowEditPanel(true);
            }} className="btn-primary btn-sm"><Icon name="square-pen" size={14} className="mr-1.5" />{t('common.edit')}</button>
            {latestQuotation ? (
              <Link to={`/quotations/${latestQuotation.id}`} className="btn-secondary btn-sm">
                <Icon name="file-edit" size={14} className="mr-1.5" />{t('nav.quotations')}
              </Link>
            ) : canQuote && (
              <button onClick={startQuotation} className="btn-secondary btn-sm">
                <Icon name="plus" size={14} className="mr-1.5" />{t('page.inquiryDetail.createQuotation')}
              </button>
            )}
            {/* Actions */}
            <div className="relative">
              <button onClick={() => setShowActionsMenu(!showActionsMenu)} className="icon-btn" aria-label={t('common.moreActions')} title={t('common.moreActions')}><Icon name="more" size={16} /></button>
              {showActionsMenu && (
                <div className="menu-surface absolute right-0 top-full mt-1 w-40">
                  <button onClick={() => { setShowActionsMenu(false); duplicate(); }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                    <Icon name="copy" size={13} />{t('common.duplicate')}
                  </button>
                  <button onClick={() => {
                    setConfirmDelete(true);
                    setShowActionsMenu(false);
                  }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
                    <Icon name="delete" size={13} />{t('common.delete')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="break-words text-xs text-gray-500">
          <Link to={`/companies/${inquiry.company_id}`} className="text-blue-600 hover:underline">{inquiry.company_name}</Link>
          {inquiry.contact_name && ` · ${t('page.inquiryDetail.contact')}: ${inquiry.contact_name}`}
          {` · ${t('page.inquiryDetail.created')}: ${inquiry.created_at?.slice(0, 10)} · ${t('page.inquiryDetail.source')}: ${sourceLabel(inquiry.source)}`}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-5">
              {/* Application Description */}
              <div className="card p-4">
                <h3 className="section-label mb-3">{t('page.inquiryDetail.applicationDescription')}</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{inquiry.application_description || t('page.inquiryDetail.noDescription')}</p>
              </div>

              {/* Technical Details */}
              <div className="card p-4">
                <h3 className="section-label mb-3">{t('page.inquiryDetail.technicalDetails')}</h3>
                <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-2xs text-gray-400 block">{t('page.inquiryDetail.targetMaterial')}</span>
                    <span className="font-medium text-gray-900">{inquiry.target_material_requested || '—'}</span>
                  </div>
                  <div>
                    <span className="text-2xs text-gray-400 block">{t('page.inquiryDetail.quantity')}</span>
                    <span className="text-gray-700">{inquiry.quantity_estimate || '—'}</span>
                  </div>
                  {inquiry.chemical_exposure && (
                    <div className="col-span-1 sm:col-span-2">
                      <span className="text-2xs text-gray-400 block">{t('page.inquiryDetail.chemicalExposure')}</span>
                      <span className="text-gray-700">{inquiry.chemical_exposure}</span>
                    </div>
                  )}
                  {inquiry.mechanical_load && (
                    <div className="col-span-1 sm:col-span-2">
                      <span className="text-2xs text-gray-400 block">{t('page.inquiryDetail.mechanicalLoad')}</span>
                      <span className="text-gray-700">{inquiry.mechanical_load}</span>
                    </div>
                  )}
                  {inquiry.regulatory_requirements && (
                    <div className="col-span-1 sm:col-span-2">
                      <span className="text-2xs text-gray-400 block">{t('page.inquiryDetail.regulatoryRequirements')}</span>
                      <span className="text-gray-700">
                        {typeof inquiry.regulatory_requirements === 'string'
                          ? inquiry.regulatory_requirements
                          : JSON.stringify(inquiry.regulatory_requirements)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Latest quotation — commercial response stays in context without repeating the request form. */}
              <div className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="section-label">{t('nav.quotations')}</h3>
                  {latestQuotation ? (
                    <Link to={`/quotations/${latestQuotation.id}`} className="text-xs text-blue-600 hover:underline">
                      {latestQuotation.quotation_number}
                    </Link>
                  ) : (
                    <span className="text-2xs text-gray-400">—</span>
                  )}
                </div>
                {latestQuotation ? (
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-2xs text-gray-400 block">{t('page.quotationDetail.total')}</span>
                      <span className="font-medium tabular-nums text-gray-900">
                        {formatCurrency(latestQuotation.total || 0, latestQuotation.currency || inquiry.currency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-2xs text-gray-400 block">{t('page.inquiryDetail.status')}</span>
                      <StatusBadge status={latestQuotation.status} />
                    </div>
                    <div>
                      <span className="text-2xs text-gray-400 block">{t('page.quotationDetail.validUntil')}</span>
                      <span className="text-gray-700">{latestQuotation.valid_until || '—'}</span>
                    </div>
                    <div>
                      <span className="text-2xs text-gray-400 block">{t('page.quotations.version')}</span>
                      <span className="text-gray-700">{t('page.quotations.rev', { version: latestQuotation.version || 1 })}</span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-gray-400">{t('page.inquiryDetail.createQuotation')}</p>
                )}
              </div>

              {/* Activity Timeline */}
              <div className="card p-4">
                <h3 className="section-label mb-4">{t('page.inquiryDetail.activity')}</h3>
                <ActivityTimeline
                  entityType="inquiry"
                  entityId={id!}
                  activities={activityList}
                  onActivityAdded={load}
                />
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-4">
              <div className="card p-4">
                <AccountabilityPanel entityType="inquiry" entityId={id!} record={inquiry} />
              </div>
              <div className="card p-4">
                <h3 className="section-label mb-3">{t('page.inquiryDetail.details')}</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-2xs text-gray-400 block">{t('page.inquiryDetail.status')}</span>
                    <div className="mt-1"><StatusBadge status={inquiry.status} /></div>
                  </div>
                  <div>
                    <span className="text-2xs text-gray-400 block">{t('page.inquiryDetail.urgency')}</span>
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-2xs font-450 mt-1 ${urgencyColor(inquiry.urgency)}`}>
                      {urgencyLabel(inquiry.urgency)}
                    </span>
                  </div>

                  <div>
                    <span className="text-2xs text-gray-400 block">{t('page.inquiryDetail.source')}</span>
                    <span className="text-gray-700">{sourceLabel(inquiry.source)}</span>
                  </div>
                </div>
              </div>

              <div className="card p-4">
                <h3 className="section-label mb-3">{t('page.inquiryDetail.customer')}</h3>
                <Link to={`/companies/${inquiry.company_id}`} className="text-sm text-blue-600 hover:underline block mb-2">
                  {inquiry.company_name}
                </Link>
                {inquiry.contact_name && (
                  <div className="text-sm text-gray-700">
                    <span className="text-2xs text-gray-400 block">{t('page.inquiryDetail.contact')}</span>
                        <span className="break-words">{inquiry.contact_name}</span>
                        {inquiry.contact_email && <span className="ml-1 break-words text-xs text-gray-400">({inquiry.contact_email})</span>}
                  </div>
                )}
              </div>

              <div className="card p-4">
                <h3 className="section-label mb-3">{t('page.inquiryDetail.tasks')}</h3>
                <TaskSection
                  tasks={taskList}
                  entityType="inquiry"
                  entityId={id}
                  onTaskChanged={load}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Panel */}
      <SidePanel
        open={showEditPanel}
        onClose={() => setShowEditPanel(false)}
        title={t('page.inquiryDetail.editInquiry')}
        subtitle={inquiry.inquiry_number}
        width="w-[min(540px,calc(100vw-1rem))]"
      >
            <div className="space-y-4">
              {user?.role === 'admin' && (
                <div>
                  <label className="label" htmlFor="inquiry-edit-owner">{t('accountability.owner')}</label>
                  <select
                    id="inquiry-edit-owner"
                    className="input"
                    value={editForm.owner_user_id}
                    onChange={e => setEditForm({ ...editForm, owner_user_id: e.target.value })}
                  >
                    <option value="">{t('accountability.unassigned')}</option>
                    {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="label" htmlFor="inquiry-edit-description">{t('page.inquiryDetail.applicationDescription')} *</label>
                <textarea
                  ref={descriptionInputRef}
                  id="inquiry-edit-description"
                  className={`${editDescriptionError ? 'input-error' : 'input'} min-h-[80px] resize-y`}
                  value={editForm.application_description}
                  required
                  aria-invalid={!!editDescriptionError}
                  aria-describedby={editDescriptionError ? 'inquiry-edit-description-error' : undefined}
                  onChange={e => {
                    setEditForm({...editForm, application_description: e.target.value});
                    if (e.target.value.trim()) setEditDescriptionError('');
                  }}
                />
                {editDescriptionError && <p id="inquiry-edit-description-error" role="alert" className="field-error">{editDescriptionError}</p>}
              </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="inquiry-edit-material">{t('page.inquiryDetail.targetMaterial')}</label>
                  <input id="inquiry-edit-material" className="input" value={editForm.target_material_requested}
                    onChange={e => setEditForm({...editForm, target_material_requested: e.target.value})} />
                </div>
                <div>
                  <label className="label" htmlFor="inquiry-edit-quantity">{t('page.inquiryDetail.quantity')}</label>
                  <input id="inquiry-edit-quantity" className="input" value={editForm.quantity_estimate}
                    onChange={e => setEditForm({...editForm, quantity_estimate: e.target.value})} />
                </div>
              </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="inquiry-edit-urgency">{t('page.inquiryDetail.urgency')}</label>
                  <select id="inquiry-edit-urgency" className="input" value={editForm.urgency}
                    onChange={e => setEditForm({...editForm, urgency: e.target.value})}>
                    <option value="immediate">{t('page.inquiryNew.immediate')}</option>
                    <option value="within_2_weeks">{t('page.inquiryNew.within2Weeks')}</option>
                    <option value="within_1_month">{t('page.inquiryNew.within1Month')}</option>
                    <option value="no_rush">{t('page.inquiryNew.noRush')}</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="inquiry-edit-source">{t('page.inquiryDetail.source')}</label>
                  <select id="inquiry-edit-source" className="input" value={editForm.source}
                    onChange={e => setEditForm({...editForm, source: e.target.value})}>
                    <option value="email">{t('page.inquiryNew.email')}</option>
                    <option value="phone_wechat">{t('page.inquiryNew.phoneWechat')}</option>
                    <option value="website">{t('page.inquiryNew.website')}</option>
                    <option value="social_media">{t('page.inquiryNew.socialMedia')}</option>
                    <option value="alibaba_platform">{t('page.inquiryNew.alibabaPlatform')}</option>
                    <option value="trade_show">{t('page.inquiryNew.tradeShow')}</option>
                    <option value="referral">{t('page.inquiryNew.referral')}</option>
                  </select>
                </div>
              </div>
                  <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                    <button onClick={saveEdit} disabled={savingEdit} className="btn-primary w-full sm:flex-1">
                      {savingEdit ? t('page.inquiryDetail.saving') : t('page.companies.saveChanges')}
                    </button>
                    <button onClick={() => setShowEditPanel(false)} disabled={savingEdit} className="btn-secondary w-full sm:w-auto">{t('common.cancel')}</button>
              </div>
            </div>
      </SidePanel>

      {/* Contextual quotation flow: request and customer data are inherited read-only. */}
      {showQuotationPanel && (
        <QuotationEditPanel
          quotation={quotationDraft}
          onClose={() => setShowQuotationPanel(false)}
          onSaved={handleQuotationSaved}
        />
      )}

      {/* Email Draft */}
      <EmailDraftPanel
        open={showEmailDraft}
        onClose={() => setShowEmailDraft(false)}
        context={{
          company: inquiry.company_name || '',
          contact: inquiry.contact_name || '',
          product: inquiry.target_material_requested || '',
          inquiry_number: inquiry.inquiry_number || '',
          industry: inquiry.company_industry || '',
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={t('common.delete')}
        description={<>{t('common.confirmDelete')} <strong>{inquiry.inquiry_number}</strong></>}
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
