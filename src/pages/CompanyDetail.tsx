import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { companies, contacts, activities, tasks, inquiries, quotations } from '../lib/api';
import StatusBadge from '../components/shared/StatusBadge';
import ProductTag from '../components/shared/ProductTag';
import { formatCurrency } from '../lib/currency';
import Icon from '../components/shared/Icon';
import { useTranslation } from 'react-i18next';
import ActivityTimeline from '../components/shared/ActivityTimeline';
import TaskSection from '../components/shared/TaskSection';
import CustomerSummary from '../components/shared/CustomerSummary';
import MeetingNotes from '../components/shared/MeetingNotes';
import ResponsiveWorkspace from '../components/shared/ResponsiveWorkspace';
import CompanyEditPanel from '../components/companies/CompanyEditPanel';
import ContactPanel from '../components/contacts/ContactPanel';

type Contact = {
  id: string; company_id: string; first_name: string; last_name: string;
  job_title?: string; email: string; phone_direct?: string;
  role_in_process?: string; is_primary_contact: number | boolean;
  is_decision_maker: number | boolean;
};

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<any>(null);
  const [contactList, setContactList] = useState<Contact[]>([]);
  const [activityList, setActivityList] = useState<any[]>([]);
  const [taskList, setTaskList] = useState<any[]>([]);
  const [inquiryList, setInquiryList] = useState<any[]>([]);
  const [quotationList, setQuotationList] = useState<any[]>([]);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [contactPanel, setContactPanel] = useState<{ companyId: string; contact?: any } | null>(null);
  const [showMeetingNotes, setShowMeetingNotes] = useState(false);
  const { t } = useTranslation();

  const load = useCallback(() => {
    if (!id) return;
    companies.get(id).then(setCompany);
    contacts.list(id).then(setContactList);
    activities.list('company', id).then(setActivityList);
    tasks.list({ entity_type: 'company', entity_id: id }).then(setTaskList);
    inquiries.list(id).then(setInquiryList);
    quotations.list(id).then(setQuotationList);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Extract product families from inquiries for Product Interest
  const productFamilies = [...new Set(
    inquiryList.map((i: any) => i.target_material_requested?.split(' ')[0]).filter(Boolean)
  )];

  if (!company) return <div className="p-6 text-gray-400">{t('common.loading')}</div>;

  const daysSince = (date: string) => {
    if (!date) return null;
    return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="h-full flex flex-col">
      {/* Record Header */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate(-1)} className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0">{t('common.back')}</button>
            <h1 className="text-2xl font-semibold text-gray-900 truncate">{company.name}</h1>
            <StatusBadge status={company.status} />
            {company.classification && (
              <span className={`text-2xs font-medium px-1.5 py-0.5 rounded ${
                company.classification === 'A' ? 'bg-blue-50 text-blue-600' :
                company.classification === 'B' ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-100 text-gray-500'
              }`}>{company.classification}-Class</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setShowEditPanel(true)} className="btn-ghost btn-sm"><Icon name="square-pen" size={14} className="mr-1.5" />{t('common.edit')}</button>
            <Link to={`/inquiries/new?company=${id}`} className="btn-primary btn-sm"><Icon name="plus" size={16} className="mr-1.5" />{t('page.companyDetail.newInquiry')}</Link>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {company.company_type?.replace('_', ' ')} · {company.industry || 'N/A'}
          {company.city ? ` · ${company.city}, ${company.country}` : ` · ${company.country}`}
          {company.last_activity_at && ` · {t('page.companyDetail.lastActivity', 'Last activity')}: ${daysSince(company.last_activity_at)}d ago`}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden bg-gray-50">
        <ResponsiveWorkspace
            leftPanel={
              <>
{/* LEFT PANEL: Profile + Contacts + {t('page.companyDetail.productInterest')} */}
            <div className="w-[280px] flex-shrink-0 border-r border-gray-200 overflow-y-auto p-4 bg-white space-y-5">
              {/* AI Customer Summary */}
              <CustomerSummary
                company={company}
                inquiries={inquiryList}
                quotations={quotationList}
                orders={[]}
                activities={activityList}
                tasks={taskList}
              />
              {/* {t('page.companyDetail.companyProfile')} */}
              <div>
                <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('page.companyDetail.companyProfile')}</h3>
                <div className="space-y-1.5 text-sm">
                  <div><span className="text-2xs text-gray-400 block">{t('page.companyDetail.legalName')}</span><span className="text-gray-700">{company.name}</span></div>
                  {company.registration_number && <div><span className="text-2xs text-gray-400 block">{t('page.companyDetail.regNumber', 'Reg #')}</span><span className="text-gray-700">{company.registration_number}</span></div>}
                  {company.website && <div><span className="text-2xs text-gray-400 block">{t('page.companyDetail.website')}</span><span className="text-blue-600 text-xs">{company.website}</span></div>}
                </div>
              </div>

              <div>
                <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('page.companyDetail.address')}</h3>
                <p className="text-sm text-gray-700">
                  {company.address_line_1 && <>{company.address_line_1}<br /></>}
                  {company.city}{company.state_province ? `, ${company.state_province}` : ''}{company.postal_code ? ` ${company.postal_code}` : ''}<br />
                  {company.country}
                </p>
              </div>

              <div>
                <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('page.companyDetail.classification')}</h3>
                <div className="space-y-1">
                  <StatusBadge status={company.status} />
                  <div className="text-xs text-gray-500 mt-1">{company.company_type?.replace('_', ' ')} · {company.industry || 'N/A'}</div>
                </div>
              </div>

              {company.credit_limit > 0 && (
                <div>
                  <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('page.companyDetail.credit')}</h3>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between"><span className="text-gray-400">{t('page.companyDetail.terms')}:</span><span>{company.credit_term || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">{t('page.companyDetail.limit')}:</span><span className="font-mono">{formatCurrency(company.credit_limit, 'USD')}</span></div>
                  </div>
                </div>
              )}

              {/* {t('page.companyDetail.keyContacts')} */}
              <div>
                <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {t('page.companyDetail.keyContacts')} ({contactList.length})
                  <button onClick={() => setContactPanel({ companyId: company.id })} className="text-blue-600 hover:text-blue-700 ml-1 text-xs font-medium">+</button>
                </h3>
                <div className="space-y-2">
                  {contactList.slice(0, 4).map((c: Contact) => (
                    <div
                      key={c.id}
                      className="p-2 rounded-lg cursor-pointer hover:bg-gray-50 bg-gray-50/40"
                      onClick={() => setContactPanel({ companyId: company.id, contact: c })}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-gray-900">{c.first_name} {c.last_name}</span>
                        <span className={`w-2 h-2 rounded-full inline-block ${c.is_primary_contact ? 'bg-green-500' : 'bg-gray-300'}`} title={c.is_primary_contact ? 'Primary' : ''} />
                        <span className={`w-2 h-2 rounded-full inline-block ${c.is_decision_maker ? 'bg-red-500' : 'bg-gray-300'}`} title={c.is_decision_maker ? 'Decision Maker' : ''} />
                      </div>
                      <div className="text-2xs text-gray-500">{c.job_title}</div>
                      <div className="text-2xs text-blue-600 truncate">{c.email}</div>
                    </div>
                  ))}
                  {contactList.length === 0 && (
                    <button onClick={() => setContactPanel({ companyId: company.id })} className="text-xs text-blue-600 hover:underline">
                      {t('page.companyDetail.addFirstContact', 'Add first contact')}
                    </button>
                  )}
                  {contactList.length > 4 && (
                    <button onClick={() => setContactPanel({ companyId: company.id })} className="text-xs text-blue-600 hover:underline">
                      {t('page.companyDetail.viewAllContacts', 'View all')} {contactList.length} {t('page.companyDetail.contacts')} 
                    </button>
                  )}
                </div>
              </div>

              {/* {t('page.companyDetail.productInterest')} */}
              {productFamilies.length > 0 && (
                <div>
                  <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('page.companyDetail.productInterest')}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {productFamilies.map((fam: string) => (
                      <ProductTag key={fam} family={fam} />
                    ))}
                  </div>
                </div>
              )}
            </div>

                          </>
            }
            centerPanel={
              <>
{/* CENTER PANEL: Opportunities + Activity Timeline */}
            <div className="flex-1 overflow-y-auto p-4 bg-white">
              <div className="max-w-3xl space-y-6">
                {/* Open Opportunities */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-gray-700">
                      {t('page.companyDetail.pipelineOpportunities', 'Pipeline Opportunities')}{' '}
                      <span className="text-xs font-normal text-gray-400 ml-2">
                        {inquiryList.filter((i: any) => i.status !== 'closed_won' && i.status !== 'closed_lost').length} {t('page.inquiries.number', 'inquiries')} · {quotationList.filter((q: any) => q.status !== 'accepted' && q.status !== 'rejected').length} {t('nav.quotations')}
                      </span>
                    </h2>
                    <Link to={`/inquiries/new?company=${id}`} className="text-xs text-blue-600 hover:underline">{t('common.new')}</Link>
                  </div>
                  <div className="space-y-2">
                    {/* Active Inquiries as opportunity cards */}
                    {inquiryList
                      .filter((i: any) => i.status !== 'closed_won' && i.status !== 'closed_lost')
                      .slice(0, 3)
                      .map((inq: any) => (
                        <Link
                          key={inq.id}
                          to={`/inquiries/${inq.id}`}
                          className="card block p-3 hover:border-emerald-300 hover:shadow-sm transition-all border-l-4 border-l-blue-600"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-gray-900">{inq.target_material_requested || 'Inquiry'}</span>
                                <StatusBadge status={inq.status} />
                              </div>
                              <p className="text-xs text-gray-500 mt-1 line-clamp-1">{inq.application_description?.slice(0, 120)}</p>
                              <div className="flex items-center gap-3 mt-1.5 text-2xs text-gray-400">
                                <span>{inq.inquiry_number}</span>
                                {inq.quantity_estimate && <span>· {inq.quantity_estimate}</span>}
                                <span className={`${inq.urgency === 'immediate' ? 'text-red-500 font-medium' : ''}`}>
                                  · {inq.urgency?.replace(/_/g, ' ')}
                                </span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {inq.estimated_budget > 0 && (
                                <span className="text-xs font-mono font-medium text-gray-900">{formatCurrency(inq.estimated_budget, inq.currency)}</span>
                              )}
                            </div>
                          </div>
                        </Link>
                      ))}

                    {/* Open {t('page.companyDetail.quotations')} as opportunity cards */}
                    {quotationList
                      .filter((q: any) => q.status !== 'accepted' && q.status !== 'rejected' && q.status !== 'expired' && q.status !== 'cancelled')
                      .slice(0, 3)
                      .map((q: any) => (
                        <Link
                          key={q.id}
                          to={`/quotations/${q.id}`}
                          className="card block p-3 hover:border-emerald-300 hover:shadow-sm transition-all border-l-4 border-l-emerald-500"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-gray-900">{q.quotation_number}</span>
                                <StatusBadge status={q.status} />
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-2xs text-gray-400">
                                <span>{q.currency || 'USD'}</span>
                                {q.valid_until && (
                                  <span className={
                                    new Date(q.valid_until).getTime() - Date.now() < 7 * 86400000
                                      ? 'text-red-500 font-medium'
                                      : ''
                                  }>
                                    · {t('page.companyDetail.expires', 'Expires')}: {q.valid_until}
                                  </span>
                                )}
                                <span>· Rev {q.version || 1}</span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className="text-sm font-mono font-semibold text-gray-900">{formatCurrency(q.total, q.currency)}</span>
                            </div>
                          </div>
                        </Link>
                      ))}

                    {/* Empty state */}
                    {inquiryList.filter((i: any) => i.status !== 'closed_won' && i.status !== 'closed_lost').length === 0 &&
                     quotationList.filter((q: any) => q.status !== 'accepted' && q.status !== 'rejected').length === 0 && (
                      <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg">
                        <p className="text-xs text-gray-400 mb-2">{t('page.companyDetail.noActiveOpportunities', 'No active opportunities')}</p>
                        <Link to={`/inquiries/new?company=${id}`} className="text-xs text-blue-600 hover:underline font-medium">
                          {t('page.companyDetail.createInquiry', 'Create Inquiry')}
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200" />

                {/* Activity Timeline */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-gray-700">{t('page.companyDetail.activity')}</h2>
                    <button onClick={() => setShowMeetingNotes(true)} className="btn-ghost btn-sm text-xs"><Icon name="calendar" size={13} className="mr-1.5" />{t('page.companyDetail.logMeeting')}</button>
                  </div>
                  <ActivityTimeline
                    entityType="company"
                    entityId={id!}
                    activities={activityList}
                    onActivityAdded={load}
                  />
                </div>
              </div>
            </div>

                          </>
            }
            rightPanel={
              <>
{/* RIGHT PANEL: Tasks + Summary */}
            <div className="w-[300px] flex-shrink-0 border-l border-gray-200 overflow-y-auto p-4 bg-white space-y-5">
              <div>
                <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Tasks ({taskList.filter((t: any) => t.status !== 'completed').length})</h3>
                <TaskSection
                  tasks={taskList}
                  entityType="company"
                  entityId={id}
                  onTaskChanged={load}
                  compact
                />
              </div>

              {/* {t('page.companyDetail.quickStats')} */}
              <div>
                <h3 className="text-2xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('page.companyDetail.quickStats')}</h3>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-500">{t('page.companyDetail.totalInquiries')}</span>
                    <span className="font-medium">{inquiryList.length}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-500">{t('page.companyDetail.quotations')}</span>
                    <span className="font-medium">{quotationList.length}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Contacts</span>
                    <span className="font-medium">{contactList.length}</span>
                  </div>
                </div>
              </div>
            </div>              </>
            }
            rightPanelLabel="Tasks & Stats"
            rightPanelIcon="☰"
          />
      </div>

      {/* Meeting Notes */}
      <MeetingNotes
        open={showMeetingNotes}
        onClose={() => setShowMeetingNotes(false)}
        entityType="company"
        entityId={id!}
        companyName={company.name}
        onSaved={load}
      />
      {/* Side Panels */}
      <CompanyEditPanel
        company={showEditPanel ? company : null}
        onClose={() => setShowEditPanel(false)}
        onSaved={load}
      />
      {contactPanel && (
        <ContactPanel
          companyId={contactPanel.companyId}
          contact={contactPanel.contact}
          onClose={() => setContactPanel(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
