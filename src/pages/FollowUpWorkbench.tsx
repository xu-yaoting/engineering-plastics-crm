import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  followUps,
  type DevelopmentStage,
  type FollowUpBucket,
  type FollowUpWorkbenchItem,
} from '../lib/api';
import { calendarDaysSince } from '../lib/dates';
import FollowUpPanel from '../components/companies/FollowUpPanel';
import Icon from '../components/shared/Icon';
import OwnerFilter from '../components/shared/OwnerFilter';
import Pagination from '../components/shared/Pagination';

const DEVELOPMENT_STAGES: DevelopmentStage[] = [
  'uncontacted',
  'contacted',
  'replied',
  'qualified',
  'converted',
  'nurturing',
  'stopped',
];

const STAGE_BADGE_BASE_CLASS = 'inline-flex h-5 items-center rounded px-1.5 text-2xs font-450';
const SUGGEST_BADGE_CLASS = 'inline-flex h-5 items-center rounded border border-brand bg-brand-soft px-2 text-2xs font-450 text-brand';
const FOLLOW_UP_PAGE_SIZE = 7;

function dueBucket(item: FollowUpWorkbenchItem, today: string): FollowUpBucket {
  if (!item.next_follow_up_due_date) return 'none';
  const dueDate = item.next_follow_up_due_date.slice(0, 10);
  if (dueDate < today) return 'overdue';
  // Today is included in This Week — no separate "today" bucket
  const due = new Date(`${dueDate}T00:00:00`);
  const now = new Date(`${today}T00:00:00`);
  if (isNaN(due.getTime())) return 'upcoming';
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  if (due <= weekEnd) return 'thisWeek';
  return 'upcoming';
}

export default function FollowUpWorkbench() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState<FollowUpWorkbenchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<DevelopmentStage | 'all'>('all');
  const [bucket, setBucket] = useState<FollowUpBucket>('thisWeek');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [currentUserId, setCurrentUserId] = useState('');
  const [selected, setSelected] = useState<FollowUpWorkbenchItem | null>(null);
  const [page, setPage] = useState(1);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setItems(await followUps.list());
    } catch {
      setItems([]);
      setLoadError(true);
      toast.error(t('page.customerDevelopment.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const bucketCounts = useMemo(() => {
    const counts: Record<FollowUpBucket, number> = {
      all: items.length,
      overdue: 0,
      today: 0,
      thisWeek: 0,
      upcoming: 0,
      none: 0,
    };
    items.forEach((item) => {
      counts[dueBucket(item, today)] += 1;
    });
    return counts;
  }, [items, today]);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesBucket = bucket === 'all' || dueBucket(item, today) === bucket;
      const matchesStage = stage === 'all' || item.development_stage === stage;
      const matchesOwner = ownerFilter === 'all'
        || (ownerFilter === 'mine' && item.owner_user_id === currentUserId)
        || (ownerFilter === 'unassigned' && !item.owner_user_id)
        || item.owner_user_id === ownerFilter;
      const matchesSearch = !normalizedSearch || [
        item.company_name,
        item.contact_name,
        item.contact_email,
      ].some((value) => value?.toLowerCase().includes(normalizedSearch));
      return matchesBucket && matchesStage && matchesOwner && matchesSearch;
    });
  }, [bucket, currentUserId, items, ownerFilter, search, stage, today]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / FOLLOW_UP_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice(
    (currentPage - 1) * FOLLOW_UP_PAGE_SIZE,
    currentPage * FOLLOW_UP_PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [bucket, ownerFilter, search, stage]);

  useEffect(() => {
    setPage(current => Math.min(current, pageCount));
  }, [pageCount]);

  const buckets: Array<{ key: FollowUpBucket; label: string }> = [
    { key: 'all', label: t('page.customerDevelopment.all') },
    { key: 'thisWeek', label: t('page.customerDevelopment.thisWeek') },
    { key: 'overdue', label: t('page.customerDevelopment.overdue') },
    { key: 'none', label: t('page.customerDevelopment.unscheduled') },
  ];

  const fmtDatePart = (value: string) => value.slice(0, 10);

  const formatDate = (value: string | null) => {
    if (!value) return t('page.customerDevelopment.noNextFollowUp');
    try {
      return new Intl.DateTimeFormat(i18n.language === 'zh' ? 'zh-CN' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(`${fmtDatePart(value)}T00:00:00`));
    } catch {
      return t('page.customerDevelopment.noNextFollowUp');
    }
  };

  const stageColor = (s: DevelopmentStage) => {
    const map: Record<DevelopmentStage, string> = {
      uncontacted: 'bg-surface-hover text-ink-muted',
      contacted: 'bg-brand-soft text-brand',
      replied: 'bg-stage-quotation-soft text-stage-quotation',
      qualified: 'bg-warning-soft text-warning',
      converted: 'bg-success-soft text-success',
      nurturing: 'bg-stage-shipment-soft text-stage-shipment',
      stopped: 'bg-surface-hover text-ink-subtle',
    };
    return map[s] || 'bg-surface-hover text-ink-muted';
  };

  const suggestAction = (stage: DevelopmentStage): string => {
    const key = `page.customerDevelopment.suggestions.${stage}`;
    return t(key) as string;
  };

  const dueDateClass = (item: FollowUpWorkbenchItem) => {
    const itemBucket = dueBucket(item, today);
    if (itemBucket === 'overdue') return 'text-danger font-medium';
    if (itemBucket === 'today') return 'text-warning font-medium';
    return 'text-ink-muted';
  };

  const renderLastActivity = (item: FollowUpWorkbenchItem) => {
    const diff = calendarDaysSince(item.last_activity_at);
    if (diff === null) {
      return <span className="text-xs text-ink-subtle">{t('page.customerDevelopment.noActivity')}</span>;
    }
    const isStale = diff > 30;
    return (
      <div>
        <span className={`block text-xs ${isStale ? 'font-medium text-danger' : 'text-ink-muted'}`}>
          {diff === 0
            ? t('page.customerDevelopment.todayLabel')
            : t('page.customerDevelopment.daysAgo', { count: diff })}
        </span>
        {item.last_activity_subject && (
          <span className="mt-0.5 block truncate text-2xs text-ink-subtle">
            {item.last_activity_subject}
          </span>
        )}
      </div>
    );
  };

  const renderNextAction = (item: FollowUpWorkbenchItem) => item.next_follow_up_due_date ? (
    <>
      <span className="block truncate text-xs font-medium text-ink">
        {formatDate(item.next_follow_up_due_date)}
      </span>
      {item.next_follow_up_subject && (
        <span className="mt-0.5 block truncate text-2xs text-ink-muted">
          {item.next_follow_up_subject}
        </span>
      )}
    </>
  ) : (
    <span className={`${SUGGEST_BADGE_CLASS} truncate`}>
      {suggestAction(item.development_stage)}
    </span>
  );

  return (
    <div className="page-shell">
      <div className="sticky top-0 z-20 bg-canvas">
        <div className="page-header !mb-2 !pb-2">
          <div className="px-3">
            <h1 className="page-heading">{t('page.customerDevelopment.workbench')}</h1>
            <p className="mt-1 text-sm text-ink-muted">{t('page.customerDevelopment.subtitle')}</p>
          </div>
        </div>

        <div className="toolbar flex-wrap rounded-b-none border-b-0">
          <div className="relative min-w-[220px] flex-1">
            <label className="sr-only" htmlFor="follow-up-workbench-search">
              {t('page.customerDevelopment.searchPlaceholder')}
            </label>
            <Icon
              name="search"
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle"
            />
            <input
              id="follow-up-workbench-search"
              className="input pl-8"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('page.customerDevelopment.searchPlaceholder')}
            />
          </div>
          <label className="sr-only" htmlFor="follow-up-workbench-stage">
            {t('page.customerDevelopment.developmentStage')}
          </label>
          <select
            id="follow-up-workbench-stage"
            className="input w-auto min-w-[140px]"
            value={stage}
            onChange={(event) => setStage(event.target.value as DevelopmentStage | 'all')}
          >
            <option value="all">{t('page.customerDevelopment.all')}</option>
            {DEVELOPMENT_STAGES.map((value) => (
              <option key={value} value={value}>
                {t(`page.customerDevelopment.stages.${value}`)}
              </option>
            ))}
          </select>
          <OwnerFilter
            value={ownerFilter}
            onChange={setOwnerFilter}
            onCurrentUserId={setCurrentUserId}
          />
        </div>

        <div className="segmented-control w-full rounded-none border-x border-border border-b-0 border-t-0 bg-surface-subtle px-2 py-1" role="tablist">
        {buckets.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`segmented-option ${bucket === item.key ? 'segmented-option-active' : ''}`}
            onClick={() => setBucket(item.key)}
            aria-pressed={bucket === item.key}
          >
            {item.label}
            <span className="ml-1 tabular-nums text-2xs text-ink-subtle">
              {bucketCounts[item.key]}
            </span>
          </button>
        ))}
      </div>
      </div>

      {loading ? (
        <div className="data-surface space-y-2 rounded-t-none border-t-0 p-4" aria-label={t('common.loading')}>
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="h-12 animate-pulse rounded bg-surface-hover" />
          ))}
        </div>
      ) : loadError ? (
        <div className="data-surface rounded-t-none border-t-0 p-6" role="alert">
          <div className="empty-state">
            <p>{t('page.error.loadFailed')}</p>
            <button type="button" onClick={load} className="btn-secondary btn-sm mt-3">
              <Icon name="refresh" size={14} className="mr-1.5" />
              {t('common.refresh')}
            </button>
          </div>
        </div>
      ) : (
        <>
        <div className="mt-2 space-y-2 md:hidden">
          {paged.map((item) => (
            <article key={item.company_id} className="rounded-md border border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => navigate(`/companies/${item.company_id}`)}
                >
                  <span className="block truncate text-sm font-medium text-ink hover:text-brand">
                    {item.company_name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-muted">
                    {item.contact_name || '—'}
                    {item.contact_email ? ` · ${item.contact_email}` : ''}
                  </span>
                </button>
                <span className={`${STAGE_BADGE_BASE_CLASS} shrink-0 ${stageColor(item.development_stage)}`}>
                  {t(`page.customerDevelopment.stages.${item.development_stage}`)}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
                <div className="min-w-0">
                  <span className="block text-2xs text-ink-subtle">{t('page.companyDetail.lastActivity')}</span>
                  <div className="mt-1 min-w-0">{renderLastActivity(item)}</div>
                </div>
                <div className="min-w-0">
                  <span className="block text-2xs text-ink-subtle">{t('page.customerDevelopment.nextAction')}</span>
                  <div className="mt-1 min-w-0">{renderNextAction(item)}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                <span className="min-w-0 truncate text-xs text-ink-muted">
                  {item.owner_name || t('accountability.unassigned')}
                </span>
                <button
                  type="button"
                  className="btn-ghost btn-sm min-h-9 shrink-0"
                  onClick={() => setSelected(item)}
                >
                  {t('page.customerDevelopment.logFollowUp')}
                </button>
              </div>
            </article>
          ))}
          {filtered.length === 0 && (
            <div className="empty-state rounded-md border border-border bg-surface">
              <Icon name={bucket === 'overdue' ? 'check' : 'calendar'} size={20} />
              <p>
                {bucket === 'overdue' ? t('page.customerDevelopment.emptyOverdue')
                  : bucket === 'today' ? t('page.customerDevelopment.emptyToday')
                  : bucket === 'thisWeek' ? t('page.customerDevelopment.emptyThisWeek')
                  : bucket === 'none' ? t('page.customerDevelopment.emptyNoAction')
                  : t('page.customerDevelopment.noCompanies')}
              </p>
            </div>
          )}
        </div>
        <div className="md:hidden">
          <Pagination
            page={currentPage}
            pageSize={FOLLOW_UP_PAGE_SIZE}
            total={filtered.length}
            onPageChange={setPage}
          />
        </div>
        <div className="hidden data-surface overflow-x-auto rounded-t-none border-t-0 md:block">
          <table className="data-table table-fixed w-full min-w-[860px]">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="table-header w-[28%]">{t('page.contacts.company')}</th>
                <th className="table-header w-[13%]">{t('page.customerDevelopment.developmentStage')}</th>
                <th className="table-header w-[15%]">{t('page.companyDetail.lastActivity')}</th>
                <th className="table-header w-[22%]">{t('page.customerDevelopment.nextAction')}</th>
                <th className="table-header w-[10%]">{t('accountability.owner')}</th>
                <th className="table-header w-[12%]">{t('common.moreActions')}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((item) => (
                <tr key={item.company_id} className="table-row">
                  <td className="py-2 pl-3 text-left">
                    <button
                      type="button"
                      className="w-full text-left truncate"
                      onClick={() => navigate(`/companies/${item.company_id}`)}
                    >
                      <span className="block truncate text-sm font-medium text-ink hover:text-brand">
                        {item.company_name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-muted">
                        {item.contact_name || '—'}
                        {item.contact_email ? ` · ${item.contact_email}` : ''}
                      </span>
                    </button>
                  </td>
                  <td>
                    <span className={`${STAGE_BADGE_BASE_CLASS} ${stageColor(item.development_stage)}`}>
                      {t(`page.customerDevelopment.stages.${item.development_stage}`)}
                    </span>
                  </td>
                  <td>
                    {renderLastActivity(item)}
                  </td>
                  <td className="py-2">
                    {renderNextAction(item)}
                  </td>
                  <td className="text-xs text-ink-muted">
                    {item.owner_name || t('accountability.unassigned')}
                  </td>
                  <td className="whitespace-nowrap">
                    <button
                      type="button"
                      className="btn-ghost btn-xs"
                      onClick={() => setSelected(item)}
                    >
                      {t('page.customerDevelopment.logFollowUp')}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <Icon name={bucket === 'overdue' ? 'check' : 'calendar'} size={20} />
                      <p>
                        {bucket === 'overdue' ? t('page.customerDevelopment.emptyOverdue')
                          : bucket === 'today' ? t('page.customerDevelopment.emptyToday')
                          : bucket === 'thisWeek' ? t('page.customerDevelopment.emptyThisWeek')
                          : bucket === 'none' ? t('page.customerDevelopment.emptyNoAction')
                          : t('page.customerDevelopment.noCompanies')}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Pagination
            page={currentPage}
            pageSize={FOLLOW_UP_PAGE_SIZE}
            total={filtered.length}
            onPageChange={setPage}
          />
        </div>
        </>
      )}

      <FollowUpPanel
        open={!!selected}
        company={selected ? {
          id: selected.company_id,
          name: selected.company_name,
          development_stage: selected.development_stage,
        } : null}
        contacts={selected?.contact_id ? [{
          id: selected.contact_id,
          name: selected.contact_name || undefined,
        }] : []}
        currentTask={selected?.next_follow_up_task_id ? {
          id: selected.next_follow_up_task_id,
          subject: selected.next_follow_up_subject || '',
          contact_id: selected.next_follow_up_contact_id,
        } : null}
        suggestedSubject={selected?.next_follow_up_due_date ? undefined : suggestAction(selected?.development_stage || 'uncontacted')}
        onClose={() => setSelected(null)}
        onSaved={() => { load(); }}
      />
    </div>
  );
}
