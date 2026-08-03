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
import FollowUpPanel from '../components/companies/FollowUpPanel';
import Icon from '../components/shared/Icon';
import OwnerFilter from '../components/shared/OwnerFilter';

const DEVELOPMENT_STAGES: DevelopmentStage[] = [
  'uncontacted',
  'contacted',
  'replied',
  'qualified',
  'converted',
  'nurturing',
  'stopped',
];

function dueBucket(item: FollowUpWorkbenchItem, today: string): FollowUpBucket {
  if (!item.next_follow_up_due_date) return 'none';
  const dueDate = item.next_follow_up_due_date.slice(0, 10);
  if (dueDate < today) return 'overdue';
  if (dueDate === today) return 'today';
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
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<DevelopmentStage | 'all'>('all');
  const [bucket, setBucket] = useState<FollowUpBucket>('today');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [currentUserId, setCurrentUserId] = useState('');
  const [selected, setSelected] = useState<FollowUpWorkbenchItem | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await followUps.list());
    } catch {
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

  const buckets: Array<{ key: FollowUpBucket; label: string }> = [
    { key: 'all', label: t('page.customerDevelopment.all') },
    { key: 'today', label: t('page.customerDevelopment.today') },
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
      uncontacted: 'bg-gray-100 text-gray-600',
      contacted: 'bg-blue-50 text-blue-700',
      replied: 'bg-purple-50 text-purple-700',
      qualified: 'bg-amber-50 text-amber-700',
      converted: 'bg-green-50 text-green-700',
      nurturing: 'bg-teal-50 text-teal-700',
      stopped: 'bg-red-50 text-red-700',
    };
    return map[s] || 'bg-gray-100 text-gray-600';
  };

  const daysAgo = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      const then = new Date(`${fmtDatePart(dateStr)}T00:00:00`);
      if (isNaN(then.getTime())) return null;
      const diff = Math.floor((Date.now() - then.getTime()) / 86_400_000);
      return diff;
    } catch {
      return null;
    }
  };

  const suggestAction = (stage: DevelopmentStage): string => {
    const key = `page.customerDevelopment.suggestions.${stage}`;
    return t(key) as string;
  };

  const dueDateClass = (item: FollowUpWorkbenchItem) => {
    const itemBucket = dueBucket(item, today);
    if (itemBucket === 'overdue') return 'text-red-600 font-medium';
    if (itemBucket === 'today') return 'text-yellow-700 font-medium';
    return 'text-gray-600';
  };

  const renderLastActivity = (item: FollowUpWorkbenchItem) => {
    const diff = daysAgo(item.last_activity_at);
    if (diff === null) {
      return <span className="text-xs text-gray-400">{t('page.customerDevelopment.noActivity')}</span>;
    }
    const isStale = diff > 30;
    return (
      <div>
        <span className={`block text-xs ${isStale ? 'font-medium text-red-500' : 'text-gray-700'}`}>
          {diff === 0
            ? t('page.customerDevelopment.todayLabel')
            : t('page.customerDevelopment.daysAgo', { count: diff })}
        </span>
        {item.last_activity_subject && (
          <span className="mt-0.5 block truncate text-2xs text-gray-400">
            {item.last_activity_subject}
          </span>
        )}
      </div>
    );
  };

  const renderNextAction = (item: FollowUpWorkbenchItem) => item.next_follow_up_due_date ? (
    <>
      <span className={`block truncate text-xs ${dueDateClass(item)}`}>
        {formatDate(item.next_follow_up_due_date)}
      </span>
      {item.next_follow_up_subject && (
        <span className="mt-0.5 block truncate text-2xs text-gray-500">
          {item.next_follow_up_subject}
        </span>
      )}
    </>
  ) : (
    <span className="block truncate text-2xs italic text-blue-600">
      <Icon name="lightbulb" size={10} className="mr-1 inline-flex" />
      {suggestAction(item.development_stage)}
    </span>
  );

  return (
    <div className="page-shell">
      <div className="sticky top-0 z-20 space-y-2 bg-gray-50 pb-1 border-b border-gray-200">
        <div className="page-header !pb-1 !mb-0">
          <div className="flex items-baseline gap-3">
            <h1 className="page-heading">{t('page.customerDevelopment.workbench')}</h1>
            <p className="page-summary">{t('page.customerDevelopment.subtitle')}</p>
          </div>
        </div>

        <div className="toolbar flex-wrap">
          <div className="relative min-w-[220px] flex-1">
            <label className="sr-only" htmlFor="follow-up-workbench-search">
              {t('page.customerDevelopment.searchPlaceholder')}
            </label>
            <Icon
              name="search"
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
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

        <div className="segmented-control w-fit" role="tablist">
        {buckets.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`segmented-option ${bucket === item.key ? 'segmented-option-active' : ''}`}
            onClick={() => setBucket(item.key)}
            aria-pressed={bucket === item.key}
          >
            {item.label}
            <span className="ml-1 tabular-nums text-2xs text-gray-400">
              {bucketCounts[item.key]}
            </span>
          </button>
        ))}
      </div>
      </div>

      {loading ? (
        <div className="data-surface space-y-2 p-4" aria-label={t('common.loading')}>
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="h-12 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      ) : (
        <>
        <div className="space-y-2 md:hidden">
          {filtered.map((item) => (
            <article key={item.company_id} className="rounded-md border border-gray-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => navigate(`/companies/${item.company_id}`)}
                >
                  <span className="block truncate text-sm font-medium text-gray-900 hover:text-blue-600">
                    {item.company_name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-gray-500">
                    {item.contact_name || '—'}
                    {item.contact_email ? ` · ${item.contact_email}` : ''}
                  </span>
                </button>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-2xs font-medium ${stageColor(item.development_stage)}`}>
                  {t(`page.customerDevelopment.stages.${item.development_stage}`)}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
                <div className="min-w-0">
                  <span className="block text-2xs text-gray-400">{t('page.companyDetail.lastActivity')}</span>
                  <div className="mt-1 min-w-0">{renderLastActivity(item)}</div>
                </div>
                <div className="min-w-0">
                  <span className="block text-2xs text-gray-400">{t('page.customerDevelopment.nextAction')}</span>
                  <div className="mt-1 min-w-0">{renderNextAction(item)}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
                <span className="min-w-0 truncate text-xs text-gray-500">
                  {item.owner_name || t('accountability.unassigned')}
                </span>
                <button
                  type="button"
                  className="btn-secondary btn-sm min-h-9 shrink-0"
                  onClick={() => setSelected(item)}
                >
                  {t('page.customerDevelopment.logFollowUp')}
                </button>
              </div>
            </article>
          ))}
          {filtered.length === 0 && (
            <div className="empty-state rounded-md border border-gray-200 bg-white">
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
        <div className="hidden data-surface overflow-x-auto md:block">
          <table className="data-table table-fixed w-full min-w-[860px]">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="w-[28%] text-center">{t('page.contacts.company')}</th>
                <th className="w-[13%] text-center">{t('page.customerDevelopment.developmentStage')}</th>
                <th className="w-[15%] text-center">{t('page.companyDetail.lastActivity')}</th>
                <th className="w-[22%] text-center">{t('page.customerDevelopment.nextAction')}</th>
                <th className="w-[10%] text-center">{t('accountability.owner')}</th>
                <th className="w-[12%] text-center">{t('common.moreActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.company_id}>
                  <td className="py-2 pl-4 text-left">
                    <button
                      type="button"
                      className="w-full text-left truncate"
                      onClick={() => navigate(`/companies/${item.company_id}`)}
                    >
                      <span className="block truncate text-sm font-medium text-gray-900 hover:text-blue-600">
                        {item.company_name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-gray-500">
                        {item.contact_name || '—'}
                        {item.contact_email ? ` · ${item.contact_email}` : ''}
                      </span>
                    </button>
                  </td>
                  <td className="text-center">
                    <span className={`inline-flex rounded px-1.5 py-0.5 text-2xs font-medium ${stageColor(item.development_stage)}`}>
                      {t(`page.customerDevelopment.stages.${item.development_stage}`)}
                    </span>
                  </td>
                  <td className="text-center">
                    {renderLastActivity(item)}
                  </td>
                  <td className="py-2 text-center">
                    {renderNextAction(item)}
                  </td>
                  <td className="text-center text-xs text-gray-600">
                    {item.owner_name || t('accountability.unassigned')}
                  </td>
                  <td className="whitespace-nowrap text-center">
                    <button
                      type="button"
                      className="btn-secondary btn-xs"
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
