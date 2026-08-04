import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { companies, contacts, activities, tasks, quotations } from '../lib/api';
import StatusBadge from '../components/shared/StatusBadge';
import ProductTag from '../components/shared/ProductTag';
import { formatCurrency } from '../lib/currency';
import Icon from '../components/shared/Icon';
import { useTranslation } from 'react-i18next';
import ActivityTimeline from '../components/shared/ActivityTimeline';
import TaskSection from '../components/shared/TaskSection';
import MeetingNotes from '../components/shared/MeetingNotes';
import CompanyEditPanel from '../components/companies/CompanyEditPanel';
import ContactPanel from '../components/contacts/ContactPanel';
import QuotationEditPanel from '../components/quotations/QuotationEditPanel';
import AccountabilityPanel from '../components/shared/AccountabilityPanel';
import SidePanel from '../components/shared/SidePanel';

type Contact = {
  id: string; company_id: string; first_name: string; last_name: string;
  job_title?: string; email: string; phone_direct?: string; phone_mobile?: string;
  wechat_id?: string;
  role_in_process?: string; is_primary_contact: number | boolean;
  is_decision_maker: number | boolean;
};

function CompanyDetailSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex h-full flex-col">
      <div aria-hidden="true" className="flex h-full flex-col animate-pulse motion-reduce:animate-none">
        <header className="shrink-0 border-b border-gray-200 bg-white px-5 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-8 w-8 rounded-md bg-gray-100" />
              <div className="h-6 w-48 max-w-[45vw] rounded bg-gray-200" />
              <div className="h-5 w-16 rounded bg-gray-100" />
            </div>
            <div className="h-8 w-28 rounded-md bg-gray-100" />
          </div>
          <div className="mt-2 h-3 w-72 max-w-full rounded bg-gray-100" />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto bg-gray-50 p-4">
          <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
            <section className="space-y-5">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-md border border-gray-200 bg-white p-4">
                  <div className="h-4 w-36 rounded bg-gray-200" />
                  <div className="mt-4 space-y-3">
                    <div className="h-12 rounded bg-gray-100" />
                    <div className="h-12 rounded bg-gray-100" />
                  </div>
                </div>
              ))}
            </section>
            <aside className="space-y-5 rounded-md border border-gray-200 bg-white p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index}>
                  <div className="h-3 w-20 rounded bg-gray-200" />
                  <div className="mt-3 h-10 rounded bg-gray-100" />
                </div>
              ))}
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<any>(null);
  const [contactList, setContactList] = useState<Contact[]>([]);
  const [activityList, setActivityList] = useState<any[]>([]);
  const [taskList, setTaskList] = useState<any[]>([]);
  const [quotationList, setQuotationList] = useState<any[]>([]);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showNewQuotation, setShowNewQuotation] = useState(false);
  const [contactPanel, setContactPanel] = useState<{ companyId: string; contact?: any } | null>(null);
  const [showMeetingNotes, setShowMeetingNotes] = useState(false);
  const [detailsPanel, setDetailsPanel] = useState<'company' | 'history' | null>(null);
  const { t, i18n } = useTranslation();

  const load = useCallback(() => {
    if (!id) return;
    companies.get(id).then(setCompany);
    contacts.list(id).then(setContactList);
    activities.list('company', id).then(setActivityList);
    tasks.list({ entity_type: 'company', entity_id: id }).then(setTaskList);
    quotations.list(id).then(setQuotationList);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Extract product families from inquiries for Product Interest
  const productFamilies = [...new Set(
    quotationList.map((q: any) => q.target_material_requested?.split(' ')[0]).filter(Boolean)
  )];
  const websiteHref = company?.website && /^(https?:)?\/\//i.test(company.website)
    ? company.website
    : company?.website
      ? `https://${company.website}`
      : '';

  if (!company) return <CompanyDetailSkeleton label={t('common.loading')} />;

  const daysSince = (date: string) => {
    if (!date) return null;
    return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
  };
  const companyTypeLabel = (type?: string) => {
    if (type === 'end_user') return t('page.companies.endUser');
    if (type === 'distributor') return t('page.companies.distributor');
    if (type === 'oem') return t('page.companies.oem');
    if (type === 'trading_company') return t('page.companies.trading');
    return type || t('common.na');
  };
  const urgencyLabel = (urgency?: string) => {
    if (urgency === 'immediate') return t('page.inquiries.immediate');
    if (urgency === 'within_2_weeks') return t('page.inquiries.within2Weeks');
    if (urgency === 'within_1_month') return t('page.inquiries.within1Month');
    if (urgency === 'no_rush') return t('page.inquiries.noRush');
    return urgency || '—';
  };
  const activeQuotations = quotationList.filter(
    (quotation: any) => !['accepted', 'rejected', 'expired', 'cancelled'].includes(quotation.status),
  );
  const pendingTasks = taskList.filter((task: any) => task.status !== 'completed');
  const primaryContact = contactList.find((contact) => Boolean(contact.is_primary_contact)) || contactList[0];
  const nextFollowUpTask = [...pendingTasks].sort((left: any, right: any) => {
    if (!left.due_date) return 1;
    if (!right.due_date) return -1;
    return left.due_date.localeCompare(right.due_date);
  })[0];
  const activeQuotationTotals = activeQuotations.reduce<Record<string, number>>(
    (totals, quotation: any) => {
      const currency = quotation.currency || 'USD';
      totals[currency] = (totals[currency] || 0) + (quotation.total || 0);
      return totals;
    },
    {},
  );
  const pipelineValue = Object.entries(activeQuotationTotals)
    .map(([currency, total]) => formatCurrency(total, currency))
    .join(' + ') || '—';
  const nextFollowUp = nextFollowUpTask?.due_date
    ? new Intl.DateTimeFormat(i18n.language === 'zh' ? 'zh-CN' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(`${nextFollowUpTask.due_date}T00:00:00`))
    : t('page.customerDevelopment.noNextFollowUp');
  const nextAction = nextFollowUpTask
    ? {
        label: t('page.companyDetail.openTask', { subject: nextFollowUpTask.subject }),
        to: '/tasks',
      }
    : activeQuotations[0]
      ? {
          label: t('page.customerSummary.followQuotation', {
            number: activeQuotations[0].quotation_number,
          }),
          to: `/quotations/${activeQuotations[0].id}`,
        }
      : {
          label: t('page.quotations.newQuotation'),
          action: () => setShowNewQuotation(true),
        };

  return (
    <div className="h-full flex flex-col">
      {/* Record Header */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white px-5 py-3">
        <div className="page-header mb-0 min-h-0 items-stretch sm:items-center">
          <div className="flex min-w-0 items-start gap-2 sm:items-center sm:gap-3">
            <Link to="/companies" className="icon-btn" aria-label={t('common.back')} title={t('common.back')}><Icon name="back" size={16} /></Link>
            <h1 className="page-heading min-w-0 flex-1 text-lg sm:text-2xl">{company.name}</h1>
            <StatusBadge status={company.status} />
            {company.classification && (
              <span className={`shrink-0 text-2xs font-450 px-1.5 py-0.5 rounded ${
                company.classification === 'A' ? 'bg-blue-50 text-blue-600' :
                company.classification === 'B' ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-100 text-gray-500'
              }`}>{t('page.companyDetail.classLabel', { class: company.classification })}</span>
            )}
          </div>
          <div className="page-actions w-full sm:w-auto">
            <button onClick={() => setShowEditPanel(true)} className="btn-ghost btn-sm flex-1 sm:flex-none"><Icon name="square-pen" size={14} className="mr-1.5" />{t('common.edit')}</button>
            <button onClick={() => setShowNewQuotation(true)} className="btn-primary btn-sm flex-1 justify-center sm:flex-none"><Icon name="plus" size={16} className="mr-1.5" />{t('page.quotations.newQuotation')}</button>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {companyTypeLabel(company.company_type)} · {company.industry || t('common.na')}
          {company.city ? ` · ${company.city}, ${company.country}` : ` · ${company.country}`}
          {company.last_activity_at && ` · ${t('page.companyDetail.lastActivity')}: ${t('page.companyDetail.daysAgo', { count: daysSince(company.last_activity_at) })}`}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="mx-auto w-full max-w-7xl px-4 pt-4">
          <section
            aria-label={t('page.companyDetail.actionSummary')}
            className="data-surface p-4"
          >
            <div className="grid grid-cols-3 gap-x-5 gap-y-3">
              <ActionMetric label={t('page.companyDetail.pipelineValue')} value={pipelineValue} />
              <ActionMetric
                label={t('page.companyDetail.openPipeline')}
                value={t('page.companyDetail.quotationCount', { count: activeQuotations.length })}
              />
              <ActionMetric
                label={t('page.companyDetail.nextFollowUp')}
                value={nextFollowUp}
                risk={Boolean(nextFollowUpTask?.due_date && nextFollowUpTask.due_date < new Date().toISOString().slice(0, 10))}
              />
            </div>
          </section>
        </div>
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-start gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
          <main className="order-1 min-w-0 space-y-6">
              <div className="w-full space-y-6">
                {/* Quotations / Opportunities */}
                <div className="section-band px-4 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-gray-700">
                      {t('page.companyDetail.pipelineOpportunities')}{' '}
                      <span className="text-xs font-normal text-gray-400 ml-2">
                        {activeQuotations.length} {t('nav.quotations')}
                      </span>
                    </h2>
                    <button onClick={() => setShowNewQuotation(true)} className="text-xs text-blue-600 hover:underline">{t('page.quotations.newQuotation')}</button>
                  </div>
                  <div className="space-y-2">
                    {activeQuotations.slice(0, 3).map((q: any) => (
                      <Link
                        key={q.id}
                        to={`/quotations/${q.id}`}
                        className="block rounded border border-gray-200 border-l-2 border-l-blue-600 bg-white p-3 transition-colors hover:bg-gray-50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-900">{q.quotation_number}</span>
                              <StatusBadge status={q.status} />
                            </div>
                            {q.target_material_requested && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-1">{q.target_material_requested}{q.quantity_estimate ? ` · ${q.quantity_estimate}` : ''}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5 text-2xs text-gray-400">
                              <span>{q.currency || 'USD'}</span>
                              {q.valid_until && (
                                <span className={new Date(q.valid_until).getTime() - Date.now() < 7 * 86400000 ? 'text-red-500 font-medium' : ''}>
                                  · {t('page.companyDetail.expires')}: {q.valid_until}
                                </span>
                              )}
                              <span>· {t('page.companyDetail.revision', { version: q.version || 1 })}</span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="text-sm tabular-nums font-semibold text-gray-900">{formatCurrency(q.total, q.currency)}</span>
                          </div>
                        </div>
                      </Link>
                    ))}

                    {activeQuotations.length === 0 && (
                      <div className="empty-state">
                        <p className="text-xs text-gray-400 mb-2">{t('page.companyDetail.noActiveOpportunities')}</p>
                        <button onClick={() => setShowNewQuotation(true)} className="text-xs text-blue-600 hover:underline font-medium">
                          {t('page.quotations.newQuotation')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200" />

                {/* Activity Timeline */}
                <div className="section-band px-4 py-4">
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
          </main>
          <aside className="order-2 section-band p-4 lg:sticky lg:top-4">
            <div className="space-y-5">
              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="section-label">{t('page.companyDetail.primaryContactLabel')}</h3>
                  <button
                    type="button"
                    onClick={() => setContactPanel({ companyId: company.id, contact: primaryContact })}
                    className="icon-btn text-blue-600"
                    aria-label={primaryContact ? t('common.edit') : t('page.companyDetail.addFirstContact')}
                    title={primaryContact ? t('common.edit') : t('page.companyDetail.addFirstContact')}
                  >
                    <Icon name={primaryContact ? 'square-pen' : 'plus'} size={13} />
                  </button>
                </div>
                {primaryContact ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setContactPanel({ companyId: company.id, contact: primaryContact })}
                      className="block w-full rounded-md bg-gray-50 p-3 text-left hover:bg-gray-100"
                    >
                      <span className="block text-sm font-medium text-gray-900">
                        {primaryContact.first_name} {primaryContact.last_name}
                      </span>
                      {primaryContact.job_title && <span className="mt-0.5 block text-xs text-gray-500">{primaryContact.job_title}</span>}
                    </button>
                    {(primaryContact.email || company.email) && (
                      <div className="flex items-center gap-2 text-xs">
                        <a className="min-w-0 truncate text-blue-600 hover:underline" href={`mailto:${primaryContact.email || company.email}`}>
                          {primaryContact.email || company.email}
                        </a>
                        {!primaryContact.email && company.email && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-2xs text-gray-500">{t('page.contacts.company')}</span>}
                      </div>
                    )}
                    {(primaryContact.phone_mobile || primaryContact.phone_direct || company.phone) && (
                      <div className="flex items-center gap-2 text-xs">
                        <a className="min-w-0 truncate text-gray-700 hover:text-blue-600" href={`tel:${primaryContact.phone_mobile || primaryContact.phone_direct || company.phone}`}>
                          {primaryContact.phone_mobile || primaryContact.phone_direct || company.phone}
                        </a>
                        {!primaryContact.phone_mobile && !primaryContact.phone_direct && company.phone && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-2xs text-gray-500">{t('page.contacts.company')}</span>}
                      </div>
                    )}
                    {primaryContact.wechat_id && <div className="truncate text-xs text-gray-500">{t('page.contacts.wechatShort')}: {primaryContact.wechat_id}</div>}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setContactPanel({ companyId: company.id })}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {t('page.companyDetail.addFirstContact')}
                  </button>
                )}
              </section>

              <section className="border-t border-gray-200 pt-4">
                <h3 className="section-label mb-3">{t('page.tasks.tasks')} ({pendingTasks.length})</h3>
                <TaskSection
                  tasks={pendingTasks.slice(0, 3)}
                  entityType="company"
                  entityId={id}
                  onTaskChanged={load}
                  compact
                />
              </section>

              <section className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-gray-400">{t('accountability.owner')}</span>
                  <span className="truncate text-right text-gray-700">
                    {company.owner_name || t('accountability.unassigned')}
                  </span>
                </div>
              </section>

              <div className="space-y-2 border-t border-gray-200 pt-3">
                <Link to="/companies/contacts" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600">
                  <Icon name="chevron-right" size={11} />{t('page.customerDevelopment.contactDirectory')}
                </Link>
                <button type="button" onClick={() => setDetailsPanel('company')} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600">
                  <Icon name="chevron-right" size={11} />{t('page.companyDetail.companyProfile')}
                </button>
                <button type="button" onClick={() => setDetailsPanel('history')} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600">
                  <Icon name="chevron-right" size={11} />{t('accountability.history')}
                </button>
              </div>
            </div>
          </aside>
        </div>
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
      <SidePanel
        open={detailsPanel !== null}
        onClose={() => setDetailsPanel(null)}
        title={detailsPanel === 'company' ? t('page.companyDetail.companyProfile') : t('accountability.history')}
        subtitle={company.name}
      >
        {detailsPanel === 'company' ? (
          <div className="space-y-6">
            <section>
              <h3 className="section-label mb-3">{t('page.companyDetail.companyProfile')}</h3>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-2xs text-gray-400">{t('page.companyDetail.legalName')}</dt>
                  <dd className="mt-0.5 text-gray-700">{company.name}</dd>
                </div>
                {company.registration_number && (
                  <div>
                    <dt className="text-2xs text-gray-400">{t('page.companyDetail.regNumber')}</dt>
                    <dd className="mt-0.5 text-gray-700">{company.registration_number}</dd>
                  </div>
                )}
                {company.website && (
                  <div>
                    <dt className="text-2xs text-gray-400">{t('page.companyDetail.website')}</dt>
                    <dd className="mt-0.5 break-all">
                      <a className="text-blue-600 hover:underline" href={websiteHref} target="_blank" rel="noreferrer">{company.website}</a>
                    </dd>
                  </div>
                )}
              </dl>
            </section>

            <section>
              <h3 className="section-label mb-3">{t('page.companyDetail.address')}</h3>
              <p className="text-sm leading-6 text-gray-700">
                {company.address_line_1 && <>{company.address_line_1}<br /></>}
                {company.city}{company.state_province ? `, ${company.state_province}` : ''}{company.postal_code ? ` ${company.postal_code}` : ''}<br />
                {company.country || '—'}
              </p>
            </section>

            <section>
              <h3 className="section-label mb-3">{t('page.companyDetail.classification')}</h3>
              <div className="space-y-2">
                <StatusBadge status={company.status} />
                <p className="text-xs text-gray-500">{companyTypeLabel(company.company_type)} · {company.industry || t('common.na')}</p>
              </div>
            </section>

            {company.credit_limit > 0 && (
              <section>
                <h3 className="section-label mb-3">{t('page.companyDetail.credit')}</h3>
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between gap-3"><dt className="text-gray-400">{t('page.companyDetail.terms')}</dt><dd className="text-gray-700">{company.credit_term || '—'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-gray-400">{t('page.companyDetail.limit')}</dt><dd className="tabular-nums text-gray-700">{formatCurrency(company.credit_limit, 'USD')}</dd></div>
                </dl>
              </section>
            )}

            {productFamilies.length > 0 && (
              <section>
                <h3 className="section-label mb-3">{t('page.companyDetail.productInterest')}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {productFamilies.map((family: string) => <ProductTag key={family} family={family} />)}
                </div>
              </section>
            )}
          </div>
        ) : (
          <AccountabilityPanel
            entityType="company"
            entityId={id!}
            record={company}
            showOwner={false}
          />
        )}
      </SidePanel>
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
      {showNewQuotation && (
        <QuotationEditPanel
          quotation={{ company_id: id, company_name: company?.name, currency: 'USD' }}
          onClose={() => setShowNewQuotation(false)}
          onSaved={(saved) => {
            setShowNewQuotation(false);
            load();
            if (saved?.id) navigate(`/quotations/${saved.id}`);
          }}
        />
      )}
    </div>
  );
}

function ActionMetric({
  label,
  value,
  risk = false,
}: {
  label: string;
  value: string;
  risk?: boolean;
}) {
  return (
    <div className="min-w-0 border-l border-gray-200 pl-3">
      <div className="text-2xs text-gray-400">{label}</div>
      <div className={`mt-1 truncate text-sm font-semibold tabular-nums ${risk ? 'text-red-600' : 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  );
}
