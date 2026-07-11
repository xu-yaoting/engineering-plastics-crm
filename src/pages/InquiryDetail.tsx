import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { inquiries, quotations as quotationsApi, activities, tasks } from '../lib/api';
import StatusBadge from '../components/shared/StatusBadge';
import ActivityTimeline from '../components/shared/ActivityTimeline';
import TaskSection from '../components/shared/TaskSection';
import EmailDraftPanel from '../components/shared/EmailDraftPanel';
import Icon from '../components/shared/Icon';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

const statusOptions = [
  { value: 'open', labelKey: 'status.open', color: 'badge-blue' },
  { value: 'under_review', labelKey: 'status.underReview', color: 'badge-yellow' },
  { value: 'quoted', labelKey: 'status.quoted', color: 'badge-green' },
  { value: 'closed_won', labelKey: 'status.won', color: 'badge-green' },
  { value: 'closed_lost', labelKey: 'status.lost', color: 'badge-red' },
];

export default function InquiryDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [inquiry, setInquiry] = useState<any>(null);
  const [activityList, setActivityList] = useState<any[]>([]);
  const [taskList, setTaskList] = useState<any[]>([]);
  const [noteText, setNoteText] = useState('');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [showEmailDraft, setShowEmailDraft] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    application_description: '', target_material_requested: '', quantity_estimate: '',
    urgency: 'within_1_month', source: '',
  });

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

  const createQuotation = async () => {
    if (!id || !inquiry) return;
    setCreatingQuote(true);
    try {
      const qt = await quotationsApi.create({
        company_id: inquiry.company_id,
        contact_id: inquiry.contact_id,
        inquiry_id: id,
        currency: inquiry.currency || 'USD',
        subtotal: 0,
        total: 0,
      });

      await inquiries.update(id, { status: 'quoted', converted_to_quotation_id: qt.id });
      await activities.create({
        entity_type: 'inquiry', entity_id: id,
        activity_type: 'status_change',
        subject: t('page.inquiryDetail.quotationActivity', { number: qt.quotation_number }),
      });

      toast.success(t('page.inquiryDetail.quotationCreated'));
      navigate(`/quotations/${qt.id}`);
    } catch (e) {
      toast.error(t('page.inquiryDetail.quotationCreateFailed'));
    } finally {
      setCreatingQuote(false);
    }
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
    if (!id) return;
    try {
      await fetch(`/api/inquiries/${id}`, { method: 'DELETE' });
      toast.success(t('page.inquiryDetail.inquiryDeleted'));
      navigate('/inquiries');
    } catch (e) {
      toast.error(t('page.inquiryDetail.deleteFailed'));
    }
  };

  const saveEdit = async () => {
    if (!id || savingEdit) return;
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

  if (!inquiry) return <div className="p-6 text-gray-400">{t('common.loading')}</div>;

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

  const canQuote = inquiry.status === 'open' || inquiry.status === 'under_review';

  return (
    <div className="h-full flex flex-col">
      {/* Record Header */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate(-1)} className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0">{t('common.back')}</button>
            <h1 className="text-2xl font-semibold text-gray-900">{inquiry.inquiry_number}</h1>
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className="flex items-center gap-1 cursor-pointer"
              >
                <StatusBadge status={inquiry.status} />
                <span className="text-2xs text-gray-400">▼</span>
              </button>
              {showStatusMenu && (
                <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-md z-10 py-1">
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
          <div className="flex items-center gap-2">
            <button onClick={() => {
              setEditForm({
                application_description: inquiry.application_description || '',
                target_material_requested: inquiry.target_material_requested || '',
                quantity_estimate: inquiry.quantity_estimate || '',
                urgency: inquiry.urgency || 'within_1_month',
                source: inquiry.source || '',
              });
              setSavingEdit(false);
              setShowEditPanel(true);
            }} className="btn-primary btn-sm"><Icon name="square-pen" size={14} className="mr-1.5" />{t('common.edit')}</button>
            {canQuote && (
              <button onClick={createQuotation} disabled={creatingQuote} className="btn-secondary btn-sm">
                {creatingQuote ? t('page.inquiryNew.creating') : <><Icon name="plus" size={14} className="mr-1.5" />{t('page.inquiryDetail.createQuotation')}</>}
              </button>
            )}
            {/* Actions */}
            <div className="relative">
              <button onClick={() => setShowActionsMenu(!showActionsMenu)} className="btn-ghost btn-sm">⋮</button>
              {showActionsMenu && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-md z-10 py-1">
                  <button onClick={() => { setShowActionsMenu(false); duplicate(); }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                    <Icon name="copy" size={13} />{t('common.duplicate')}
                  </button>
                  {!confirmDelete ? (
                    <button onClick={() => setConfirmDelete(true)} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
                      <Icon name="delete" size={13} />{t('common.delete')}
                    </button>
                  ) : (
                    <div className="px-3 py-2">
                      <p className="text-2xs text-red-600 mb-1.5">{t('common.confirmDelete')}</p>
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
          <Link to={`/companies/${inquiry.company_id}`} className="text-blue-600 hover:underline">{inquiry.company_name}</Link>
          {inquiry.contact_name && ` · ${t('page.inquiryDetail.contact')}: ${inquiry.contact_name}`}
          {` · ${t('page.inquiryDetail.created')}: ${inquiry.created_at?.slice(0, 10)} · ${t('page.inquiryDetail.source')}: ${sourceLabel(inquiry.source)}`}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-5">
              {/* Application Description */}
              <div className="card p-4">
                <h3 className="text-xs font-450 text-gray-500 uppercase tracking-[0.08em] mb-3">{t('page.inquiryDetail.applicationDescription')}</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{inquiry.application_description || t('page.inquiryDetail.noDescription')}</p>
              </div>

              {/* Technical Details */}
              <div className="card p-4">
                <h3 className="text-xs font-450 text-gray-500 uppercase tracking-[0.08em] mb-3">{t('page.inquiryDetail.technicalDetails')}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-2xs text-gray-400 block">{t('page.inquiryDetail.targetMaterial')}</span>
                    <span className="font-medium text-gray-900">{inquiry.target_material_requested || '—'}</span>
                  </div>
                  <div>
                    <span className="text-2xs text-gray-400 block">{t('page.inquiryDetail.quantity')}</span>
                    <span className="text-gray-700">{inquiry.quantity_estimate || '—'}</span>
                  </div>
                  {inquiry.chemical_exposure && (
                    <div className="col-span-2">
                      <span className="text-2xs text-gray-400 block">{t('page.inquiryDetail.chemicalExposure')}</span>
                      <span className="text-gray-700">{inquiry.chemical_exposure}</span>
                    </div>
                  )}
                  {inquiry.mechanical_load && (
                    <div className="col-span-2">
                      <span className="text-2xs text-gray-400 block">{t('page.inquiryDetail.mechanicalLoad')}</span>
                      <span className="text-gray-700">{inquiry.mechanical_load}</span>
                    </div>
                  )}
                  {inquiry.regulatory_requirements && (
                    <div className="col-span-2">
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

              {/* Activity Timeline */}
              <div className="card p-4">
                <h3 className="text-xs font-450 text-gray-500 uppercase tracking-[0.08em] mb-4">{t('page.inquiryDetail.activity')}</h3>
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
                <h3 className="text-2xs font-450 text-gray-500 uppercase tracking-[0.08em] mb-3">{t('page.inquiryDetail.details')}</h3>
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
                <h3 className="text-2xs font-450 text-gray-500 uppercase tracking-[0.08em] mb-3">{t('page.inquiryDetail.customer')}</h3>
                <Link to={`/companies/${inquiry.company_id}`} className="text-sm text-blue-600 hover:underline block mb-2">
                  {inquiry.company_name}
                </Link>
                {inquiry.contact_name && (
                  <div className="text-sm text-gray-700">
                    <span className="text-2xs text-gray-400 block">{t('page.inquiryDetail.contact')}</span>
                    {inquiry.contact_name}
                    {inquiry.contact_email && <span className="text-xs text-gray-400 ml-1">({inquiry.contact_email})</span>}
                  </div>
                )}
              </div>

              <div className="card p-4">
                <h3 className="text-2xs font-450 text-gray-500 uppercase tracking-[0.08em] mb-3">{t('page.inquiryDetail.tasks')}</h3>
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
      {showEditPanel && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-lg p-6 w-[540px] max-h-[80vh] overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{t('page.inquiryDetail.editInquiry')}</h3>
            <div className="space-y-4">
              <div>
                <label className="label">{t('page.inquiryDetail.applicationDescription')}</label>
                <textarea className="input min-h-[80px] resize-y" value={editForm.application_description}
                  onChange={e => setEditForm({...editForm, application_description: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('page.inquiryDetail.targetMaterial')}</label>
                  <input className="input" value={editForm.target_material_requested}
                    onChange={e => setEditForm({...editForm, target_material_requested: e.target.value})} />
                </div>
                <div>
                  <label className="label">{t('page.inquiryDetail.quantity')}</label>
                  <input className="input" value={editForm.quantity_estimate}
                    onChange={e => setEditForm({...editForm, quantity_estimate: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('page.inquiryDetail.urgency')}</label>
                  <select className="input" value={editForm.urgency}
                    onChange={e => setEditForm({...editForm, urgency: e.target.value})}>
                    <option value="immediate">{t('page.inquiryNew.immediate')}</option>
                    <option value="within_2_weeks">{t('page.inquiryNew.within2Weeks')}</option>
                    <option value="within_1_month">{t('page.inquiryNew.within1Month')}</option>
                    <option value="no_rush">{t('page.inquiryNew.noRush')}</option>
                  </select>
                </div>
                <div>
                  <label className="label">{t('page.inquiryDetail.source')}</label>
                  <select className="input" value={editForm.source}
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
              <div className="flex gap-2 pt-2">
                <button onClick={saveEdit} disabled={savingEdit} className="btn-primary flex-1">
                  {savingEdit ? t('page.inquiryDetail.saving') : t('page.companies.saveChanges')}
                </button>
                <button onClick={() => setShowEditPanel(false)} disabled={savingEdit} className="btn-secondary">{t('common.cancel')}</button>
              </div>
            </div>
          </div>
        </div>
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
    </div>
  );
}
