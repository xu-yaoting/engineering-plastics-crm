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
  { value: 'open', label: 'Open', color: 'badge-blue' },
  { value: 'under_review', label: 'Under Review', color: 'badge-yellow' },
  { value: 'quoted', label: 'Quoted', color: 'badge-green' },
  { value: 'closed_won', label: 'Closed Won', color: 'badge-green' },
  { value: 'closed_lost', label: 'Closed Lost', color: 'badge-red' },
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
        subject: `Status changed to ${newStatus.replace(/_/g, ' ')}`,
      });
      setShowStatusMenu(false);
      load();
    } catch (e) {
      toast.error('Failed to change status');
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
        subject: `Quotation ${qt.quotation_number} created from this inquiry`,
      });

      toast.success('Quotation created');
      navigate(`/quotations/${qt.id}`);
    } catch (e) {
      toast.error('Failed to create quotation');
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
      toast.success('Inquiry duplicated');
      navigate(`/inquiries/${dup.id}`);
    } catch (e) {
      toast.error('Failed to duplicate');
    }
  };

  const remove = async () => {
    if (!id) return;
    try {
      await fetch(`/api/inquiries/${id}`, { method: 'DELETE' });
      toast.success('Inquiry deleted');
      navigate('/inquiries');
    } catch (e) {
      toast.error('Failed to delete inquiry');
    }
  };

  const saveEdit = async () => {
    if (!id) return;
    await inquiries.update(id, editForm);
    setShowEditPanel(false);
    load();
  };

  if (!inquiry) return <div className="p-6 text-gray-400">{t('common.loading')}</div>;

  const urgencyColor = (u: string) => {
    if (u === 'immediate') return 'text-red-600 bg-red-50';
    if (u === 'within_2_weeks') return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-500 bg-gray-100';
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
                      {opt.label}
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
              setShowEditPanel(true);
            }} className="btn-primary btn-sm"><Icon name="square-pen" size={14} className="mr-1.5" />{t('common.edit')}</button>
            {canQuote && (
              <button onClick={createQuotation} disabled={creatingQuote} className="btn-secondary btn-sm">
                {creatingQuote ? 'Creating...' : <><Icon name="plus" size={14} className="mr-1.5" />{t('page.inquiryDetail.createQuotation')}</>}
              </button>
            )}
            {/* Actions */}
            <div className="relative">
              <button onClick={() => setShowActionsMenu(!showActionsMenu)} className="btn-ghost btn-sm">⋮</button>
              {showActionsMenu && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-md z-10 py-1">
                  <button onClick={() => { setShowActionsMenu(false); duplicate(); }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                    <Icon name="copy" size={13} />Duplicate
                  </button>
                  {!confirmDelete ? (
                    <button onClick={() => setConfirmDelete(true)} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
                      <Icon name="delete" size={13} />Delete
                    </button>
                  ) : (
                    <div className="px-3 py-2">
                      <p className="text-2xs text-red-600 mb-1.5">Confirm?</p>
                      <div className="flex gap-1">
                        <button onClick={remove} className="text-xs bg-red-600 text-white px-2 py-1 rounded">Yes</button>
                        <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-500 px-2 py-1">No</button>
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
          {inquiry.contact_name && ` · Contact: ${inquiry.contact_name}`}
          {` · Created: ${inquiry.created_at?.slice(0, 10)} · Source: ${inquiry.source}`}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-5">
              {/* Application Description */}
              <div className="card p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('page.inquiryDetail.applicationDescription')}</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{inquiry.application_description || 'No description provided.'}</p>
              </div>

              {/* Technical Details */}
              <div className="card p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('page.inquiryDetail.technicalDetails')}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-2xs text-gray-400 block">{t('page.inquiryDetail.targetMaterial')}</span>
                    <span className="font-medium text-gray-900">{inquiry.target_material_requested || '—'}</span>
                  </div>
                  <div>
                    <span className="text-2xs text-gray-400 block">Quantity</span>
                    <span className="text-gray-700">{inquiry.quantity_estimate || '—'}</span>
                  </div>
                  {inquiry.chemical_exposure && (
                    <div className="col-span-2">
                      <span className="text-2xs text-gray-400 block">Chemical Exposure</span>
                      <span className="text-gray-700">{inquiry.chemical_exposure}</span>
                    </div>
                  )}
                  {inquiry.mechanical_load && (
                    <div className="col-span-2">
                      <span className="text-2xs text-gray-400 block">Mechanical Load</span>
                      <span className="text-gray-700">{inquiry.mechanical_load}</span>
                    </div>
                  )}
                  {inquiry.regulatory_requirements && (
                    <div className="col-span-2">
                      <span className="text-2xs text-gray-400 block">Regulatory Requirements</span>
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
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Activity</h3>
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
                <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Details</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-2xs text-gray-400 block">Status</span>
                    <div className="mt-1"><StatusBadge status={inquiry.status} /></div>
                  </div>
                  <div>
                    <span className="text-2xs text-gray-400 block">Urgency</span>
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-2xs font-medium mt-1 ${urgencyColor(inquiry.urgency)}`}>
                      {inquiry.urgency?.replace(/_/g, ' ') || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-2xs text-gray-400 block">Source</span>
                    <span className="text-gray-700 capitalize">{inquiry.source?.replace(/_/g, ' ') || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="card p-4">
                <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Customer</h3>
                <Link to={`/companies/${inquiry.company_id}`} className="text-sm text-blue-600 hover:underline block mb-2">
                  {inquiry.company_name}
                </Link>
                {inquiry.contact_name && (
                  <div className="text-sm text-gray-700">
                    <span className="text-2xs text-gray-400 block">Contact</span>
                    {inquiry.contact_name}
                    {inquiry.contact_email && <span className="text-xs text-gray-400 ml-1">({inquiry.contact_email})</span>}
                  </div>
                )}
              </div>

              <div className="card p-4">
                <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Tasks</h3>
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
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Edit Inquiry</h3>
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
                  <label className="label">Quantity</label>
                  <input className="input" value={editForm.quantity_estimate}
                    onChange={e => setEditForm({...editForm, quantity_estimate: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Urgency</label>
                  <select className="input" value={editForm.urgency}
                    onChange={e => setEditForm({...editForm, urgency: e.target.value})}>
                    <option value="immediate">Immediate</option>
                    <option value="within_2_weeks">Within 2 Weeks</option>
                    <option value="within_1_month">Within 1 Month</option>
                    <option value="no_rush">No Rush</option>
                  </select>
                </div>
                <div>
                  <label className="label">Source</label>
                  <select className="input" value={editForm.source}
                    onChange={e => setEditForm({...editForm, source: e.target.value})}>
                    <option value="email">Email</option>
                    <option value="phone_wechat">Phone / WeChat</option>
                    <option value="website">Website</option>
                    <option value="social_media">Social Media</option>
                    <option value="alibaba_platform">Alibaba Platform</option>
                    <option value="trade_show">Trade Show</option>
                    <option value="referral">Referral</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={saveEdit} className="btn-primary flex-1">Save Changes</button>
                <button onClick={() => setShowEditPanel(false)} className="btn-secondary">{t('common.cancel')}</button>
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
