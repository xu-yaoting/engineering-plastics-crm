import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { companies, contacts, activities, tasks, quotations } from '../lib/api';
import StatusBadge from '../components/shared/StatusBadge';
import ClassBadge from '../components/shared/ClassBadge';
import ProductTag from '../components/shared/ProductTag';
import { formatCurrency } from '../lib/currency';
import { daysSince } from '../lib/dates';
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
        <header className="shrink-0 border-b border-border bg-surface px-5 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-8 w-8 rounded-md bg-surface-hover" />
              <div className="h-6 w-48 max-w-[45vw] rounded bg-border-strong" />
              <div className="h-5 w-16 rounded bg-surface-hover" />
            </div>
            <div className="h-8 w-28 rounded-md bg-surface-hover" />
          </div>
          <div className="mt-2 h-3 w-72 max-w-full rounded bg-surface-hover" />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto bg-canvas p-4">
          <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
            <section className="space-y-5">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-md border border-border bg-surface p-4">
                  <div className="h-4 w-36 rounded bg-border-strong" />
                  <div className="mt-4 space-y-3">
                    <div className="h-12 rounded bg-surface-hover" />
                    <div className="h-12 rounded bg-surface-hover" />
                  </div>
                </div>
              ))}
            </section>
            <aside className="space-y-5 rounded-md border border-border bg-surface p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index}>
                  <div className="h-3 w-20 rounded bg-border-strong" />
                  <div className="mt-3 h-10 rounded bg-surface-hover" />
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
  const [loadError, setLoadError] = useState(false);
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
    if (!id) {
      setLoadError(true);
      return;
    }
    setLoadError(false);
    Promise.all([
      companies.get(id),
      contacts.list(id),
      activities.list('company', id),
      tasks.list({ entity_type: 'company', entity_id: id }),
      quotations.list(id),
    ])
      .then(([companyData, contactsData, activitiesData, tasksData, quotationData]) => {
        setCompany(companyData);
        setContactList(contactsData);
        setActivityList(activitiesData);
        setTaskList(tasksData);
        setQuotationList(quotationData);
      })
      .catch(() => {
        setCompany(null);
        setContactList([]);
        setActivityList([]);
        setTaskList([]);
        setQuotationList([]);
        setLoadError(true);
      });
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

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center bg-canvas p-6" role="alert">
        <div className="data-surface w-full max-w-md p-6 text-center">
          <p className="text-sm text-ink-muted">{t('page.error.loadFailed')}</p>
          <button type="button" onClick={load} className="btn-secondary btn-sm mt-3">
            <Icon name="refresh" size={14} className="mr-1.5" />
            {t('common.refresh')}
          </button>
        </div>
      </div>
    );
  }

  if (!company) return <CompanyDetailSkeleton label={t('common.loading')} />;

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
  const railContacts = [...contactList]
    .sort((left, right) => Number(Boolean(right.is_primary_contact)) - Number(Boolean(left.is_primary_contact)))
    .slice(0, 3);
  const hasMoreQuotations = quotationList.length > Math.min(activeQuotations.length, 3);
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
      <div className="flex-shrink-0 border-b border-border bg-surface px-5 py-3">
        <div className="page-header mb-0 min-h-0 items-stretch sm:items-center">
          <div className="flex min-w-0 items-start gap-2 sm:items-center sm:gap-3">
            <Link to="/companies" className="icon-btn" aria-label={t('common.back')} title={t('common.back')}><Icon name="back" size={16} /></Link>
            <h1 className="page-heading min-w-0 flex-1 text-lg sm:text-2xl">{company.name}</h1>
            <StatusBadge status={company.status} />
            <ClassBadge classification={company.classification} />
          </div>
          <div className="page-actions w-full sm:w-auto">
            <button onClick={() => setShowEditPanel(true)} className="btn-ghost btn-sm flex-1 sm:flex-none"><Icon name="square-pen" size={14} className="mr-1.5" />{t('common.edit')}</button>
            <button onClick={() => setShowNewQuotation(true)} className="btn-primary btn-sm flex-1 justify-center sm:flex-none"><Icon name="plus" size={16} className="mr-1.5" />{t('page.quotations.newQuotation')}</button>
          </div>
        </div>
        <div className="text-xs text-ink-muted">
          {companyTypeLabel(company.company_type)} · {company.industry || t('common.na')}
          {company.city ? ` · ${company.city}, ${company.country}` : ` · ${company.country}`}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-canvas">
        <div className="px-4 pt-4 md:px-6">
          <section
            aria-label={t('page.companyDetail.actionSummary')}
            className="data-surface p-4"
          >
            <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-3">
              <ActionMetric
                label={`${t('page.companyDetail.activeQuotations')} (${activeQuotations.length})`}
                value={pipelineValue}
                tone="brand"
              />
              <ActionMetric
                label={t('page.companyDetail.lastActivity')}
                value={company.last_activity_at ? t('page.companyDetail.daysAgo', { count: daysSince(company.last_activity_at) }) : '—'}
                tone="neutral"
              />
              <ActionMetric
                label={t('page.companyDetail.nextFollowUp')}
                value={nextFollowUp}
                tone="warning"
                risk={Boolean(nextFollowUpTask?.due_date && nextFollowUpTask.due_date < new Date().toISOString().slice(0, 10))}
              />
            </div>
          </section>
        </div>
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-start gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
          <main className="min-w-0 space-y-6">
              <div className="w-full space-y-6">
                {/* Quotations / Opportunities */}
                <div className="section-band px-4 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-ink">
                      {t('page.companyDetail.pipelineOpportunities')}{' '}
                      <span className="text-xs font-normal text-ink-subtle ml-2">
                        {activeQuotations.length} {t('nav.quotations')}
                      </span>
                    </h2>
                    <div className="flex items-center gap-3">
                      {hasMoreQuotations && (
                        <Link to={`/quotations?company=${company.id}`} className="text-xs text-brand hover:underline">{t('common.viewAll')}</Link>
                      )}
                      <button onClick={() => setShowNewQuotation(true)} className="text-xs text-brand hover:underline">{t('page.quotations.newQuotation')}</button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {activeQuotations.slice(0, 3).map((q: any) => (
                      <Link
                        key={q.id}
                        to={`/quotations/${q.id}`}
                        className="block rounded border border-border border-l-2 border-l-stage-quotation bg-surface p-3 transition-colors hover:bg-surface-hover"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-stage-quotation">{q.quotation_number}</span>
                              <StatusBadge status={q.status} />
                            </div>
                            {q.target_material_requested && (
                              <p className="text-xs text-ink-muted mt-1 line-clamp-1">{q.target_material_requested}{q.quantity_estimate ? ` · ${q.quantity_estimate}` : ''}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5 text-2xs text-ink-subtle">
                              <span>{q.currency || 'USD'}</span>
                              {q.valid_until && (
                                <span className={new Date(q.valid_until).getTime() - Date.now() < 7 * 86400000 ? 'text-danger font-medium' : ''}>
                                  · {t('page.companyDetail.expires')}: {q.valid_until}
                                </span>
                              )}
                              <span>· {t('page.companyDetail.revision', { version: q.version || 1 })}</span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="text-sm tabular-nums font-semibold text-ink">{formatCurrency(q.total, q.currency)}</span>
                          </div>
                        </div>
                      </Link>
                    ))}

                    {activeQuotations.length === 0 && (
                      <div className="empty-state">
                        <p className="text-xs">{t('page.companyDetail.noActiveOpportunities')}</p>
                        <button onClick={() => setShowNewQuotation(true)} className="btn-primary btn-sm">
                          {t('page.quotations.newQuotation')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-border" />

                {/* Activity Timeline */}
                <div className="section-band px-4 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-ink">{t('page.companyDetail.activity')}</h2>
                    <div className="flex items-center gap-3">
                      {activityList.length > 0 && (
                        <Link to={`/activities?company=${company.id}`} className="text-xs text-brand hover:underline">{t('common.viewAll')}</Link>
                      )}
                      <button onClick={() => setShowMeetingNotes(true)} className="btn-ghost btn-sm text-xs"><Icon name="calendar" size={13} className="mr-1.5" />{t('page.companyDetail.logMeeting')}</button>
                    </div>
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
          <aside className="order-first section-band p-4 lg:order-2 lg:sticky lg:top-4">
            <div className="space-y-5">
              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="section-label">{t('page.companyDetail.keyContacts')} ({contactList.length})</h3>
                  <button
                    type="button"
                    onClick={() => setContactPanel({ companyId: company.id, contact: primaryContact })}
                    className="icon-btn text-brand"
                    aria-label={primaryContact ? t('common.edit') : t('page.companyDetail.addFirstContact')}
                    title={primaryContact ? t('common.edit') : t('page.companyDetail.addFirstContact')}
                  >
                    <Icon name={primaryContact ? 'square-pen' : 'plus'} size={13} />
                  </button>
                </div>
                {railContacts.length > 0 ? (
                  <div className="space-y-2">
                    {railContacts.map(contact => (
                      <div key={contact.id} className="flex items-center gap-1 rounded-md bg-surface-subtle p-2 transition-colors hover:bg-surface-hover">
                        <button
                          type="button"
                          onClick={() => setContactPanel({ companyId: company.id, contact })}
                          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                        >
                          <span className="flex size-8 flex-shrink-0 items-center justify-center rounded-md bg-brand-soft text-xs font-medium text-brand">
                            {contact.first_name?.[0]}{contact.last_name?.[0]}
                          </span>
                          <span className="min-w-0">
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span className="truncate text-sm font-medium text-ink">{contact.first_name} {contact.last_name}</span>
                              {contact.is_primary_contact ? (
                                <span className="badge-blue shrink-0" title={t('page.companyDetail.primaryContactLabel')}>{t('page.contacts.primaryBadge')}</span>
                              ) : null}
                              {contact.is_decision_maker ? (
                                <span className="badge-yellow shrink-0" title={t('page.companyDetail.decisionMakerLabel')}>{t('page.contacts.decisionBadge')}</span>
                              ) : null}
                            </span>
                            <span className="mt-0.5 block truncate text-2xs text-ink-subtle">
                              {contact.job_title || (contact.role_in_process ? t(`page.contacts.roles.${contact.role_in_process}`) : '—')}
                            </span>
                          </span>
                        </button>
                        {(contact.email || company.email) && (
                          <a
                            className="icon-btn h-7 w-7"
                            href={`mailto:${contact.email || company.email}`}
                            title={contact.email || company.email}
                            aria-label={contact.email || company.email}
                          >
                            <Icon name="mail" size={13} />
                          </a>
                        )}
                        {(contact.phone_mobile || contact.phone_direct || company.phone) && (
                          <a
                            className="icon-btn h-7 w-7"
                            href={`tel:${contact.phone_mobile || contact.phone_direct || company.phone}`}
                            title={contact.phone_mobile || contact.phone_direct || company.phone}
                            aria-label={contact.phone_mobile || contact.phone_direct || company.phone}
                          >
                            <Icon name="phone" size={13} />
                          </a>
                        )}
                      </div>
                    ))}
                    <Link
                      to={`/companies/contacts?company=${company.id}`}
                      className="flex items-center gap-1 pt-0.5 text-xs text-brand hover:underline"
                    >
                      <Icon name="chevron-right" size={11} />
                      {contactList.length > 3 ? t('page.companyDetail.viewAllContacts', { count: contactList.length }) : t('page.customerDevelopment.contactDirectory')}
                    </Link>
                  </div>
                ) : (
                  <div className="empty-state">
                    <p className="text-xs">{t('noData.contacts')}</p>
                    <button
                      type="button"
                      onClick={() => setContactPanel({ companyId: company.id })}
                      className="btn-primary btn-sm"
                    >
                      {t('page.companyDetail.addFirstContact')}
                    </button>
                  </div>
                )}
              </section>

              <section className="border-t border-border pt-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="section-label">{t('page.tasks.tasks')} ({pendingTasks.length})</h3>
                  {pendingTasks.length > 3 && (
                    <Link to={`/tasks?company=${company.id}`} className="text-xs text-brand hover:underline">{t('common.viewAll')}</Link>
                  )}
                </div>
                <TaskSection
                  tasks={pendingTasks.slice(0, 3)}
                  entityType="company"
                  entityId={id}
                  onTaskChanged={load}
                  compact
                />
              </section>

              <section className="border-t border-border pt-4">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-ink-subtle">{t('accountability.owner')}</span>
                  <span className="truncate text-right text-ink-muted">
                    {company.owner_name || t('accountability.unassigned')}
                  </span>
                </div>
              </section>

              <section className="border-t border-border pt-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="section-label">{t('page.companyDetail.companyProfile')}</h3>
                  <button
                    type="button"
                    onClick={() => setDetailsPanel('company')}
                    className="icon-btn h-7 w-7 text-ink-subtle hover:text-brand"
                    aria-label={t('page.companyDetail.companyProfile')}
                    title={t('page.companyDetail.companyProfile')}
                  >
                    <Icon name="chevron-right" size={13} />
                  </button>
                </div>
                <dl className="space-y-2 text-xs">
                  {company.website && (
                    <div className="flex items-start justify-between gap-3">
                      <dt className="shrink-0 text-ink-subtle">{t('page.companyDetail.website')}</dt>
                      <dd className="min-w-0 truncate text-right">
                        <a className="text-brand hover:underline" href={websiteHref} target="_blank" rel="noreferrer">{company.website}</a>
                      </dd>
                    </div>
                  )}
                  {company.registration_number && (
                    <div className="flex items-start justify-between gap-3">
                      <dt className="shrink-0 text-ink-subtle">{t('page.companyDetail.regNumber')}</dt>
                      <dd className="min-w-0 truncate text-right tabular-nums text-ink-muted">{company.registration_number}</dd>
                    </div>
                  )}
                  {company.credit_limit > 0 && (
                    <div className="flex items-start justify-between gap-3">
                      <dt className="shrink-0 text-ink-subtle">{t('page.companyDetail.credit')}</dt>
                      <dd className="min-w-0 truncate text-right text-ink-muted">
                        {[company.credit_term, formatCurrency(company.credit_limit, 'USD')].filter(Boolean).join(' · ')}
                      </dd>
                    </div>
                  )}
                </dl>
                {productFamilies.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {productFamilies.map((family: string) => <ProductTag key={family} family={family} />)}
                  </div>
                )}
              </section>

              <section className="border-t border-border pt-4">
                <button type="button" onClick={() => setDetailsPanel('history')} className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-brand">
                  <Icon name="chevron-right" size={11} />{t('accountability.history')}
                </button>
              </section>
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
                  <dt className="text-2xs text-ink-subtle">{t('page.companyDetail.legalName')}</dt>
                  <dd className="mt-0.5 text-ink-muted">{company.name}</dd>
                </div>
                {company.registration_number && (
                  <div>
                    <dt className="text-2xs text-ink-subtle">{t('page.companyDetail.regNumber')}</dt>
                    <dd className="mt-0.5 text-ink-muted">{company.registration_number}</dd>
                  </div>
                )}
                {company.website && (
                  <div>
                    <dt className="text-2xs text-ink-subtle">{t('page.companyDetail.website')}</dt>
                    <dd className="mt-0.5 break-all">
                      <a className="text-brand hover:underline" href={websiteHref} target="_blank" rel="noreferrer">{company.website}</a>
                    </dd>
                  </div>
                )}
              </dl>
            </section>

            <section>
              <h3 className="section-label mb-3">{t('page.companyDetail.address')}</h3>
              <p className="text-sm leading-6 text-ink-muted">
                {company.address_line_1 && <>{company.address_line_1}<br /></>}
                {company.city}{company.state_province ? `, ${company.state_province}` : ''}{company.postal_code ? ` ${company.postal_code}` : ''}<br />
                {company.country || '—'}
              </p>
            </section>

            <section>
              <h3 className="section-label mb-3">{t('page.companyDetail.classification')}</h3>
              <div className="space-y-2">
                <StatusBadge status={company.status} />
                <p className="text-xs text-ink-muted">{companyTypeLabel(company.company_type)} · {company.industry || t('common.na')}</p>
              </div>
            </section>

            {company.credit_limit > 0 && (
              <section>
                <h3 className="section-label mb-3">{t('page.companyDetail.credit')}</h3>
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between gap-3"><dt className="text-ink-subtle">{t('page.companyDetail.terms')}</dt><dd className="text-ink-muted">{company.credit_term || '—'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-ink-subtle">{t('page.companyDetail.limit')}</dt><dd className="tabular-nums text-ink-muted">{formatCurrency(company.credit_limit, 'USD')}</dd></div>
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
  tone = 'brand',
}: {
  label: string;
  value: string;
  risk?: boolean;
  tone?: 'brand' | 'quotation' | 'warning' | 'danger' | 'neutral';
}) {
  const toneClass = risk ? 'border-l-danger' : tone === 'quotation' ? 'border-l-stage-quotation' : tone === 'warning' ? 'border-l-warning' : tone === 'neutral' ? 'border-l-border-strong' : 'border-l-brand';
  const valueClass = risk ? 'text-danger' : tone === 'quotation' ? 'text-stage-quotation' : tone === 'warning' ? 'text-warning' : 'text-ink';
  return (
    <div className={`min-w-0 border-l-2 pl-3 ${toneClass}`}>
      <div className="text-2xs text-ink-subtle">{label}</div>
      <div className={`mt-1 truncate text-sm font-semibold tabular-nums ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}
