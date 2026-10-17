import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Phone, Mail, FileText, Calendar, RefreshCw, Upload, Settings2 } from 'lucide-react';
import { activities, companies } from '../lib/api';
import { useTranslation } from 'react-i18next';
import Icon from '../components/shared/Icon';
import CompanyFilterChip from '../components/shared/CompanyFilterChip';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import Pagination from '../components/shared/Pagination';
import toast from 'react-hot-toast';

const ACTIVITIES_PAGE_SIZE = 10;

export default function Activities() {
  const { t } = useTranslation();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchParams] = useSearchParams();
  const paramCompany = searchParams.get('company') || '';
  const [companyName, setCompanyName] = useState('');

  const load = () => {
    setLoading(true);
    setLoadError(false);
    activities.recent()
      .then(data => setList(data))
      .catch(() => {
        setList([]);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!paramCompany) {
      setCompanyName('');
      return;
    }
    companies.get(paramCompany)
      .then((data: any) => setCompanyName(data?.name || ''))
      .catch(() => setCompanyName(''));
  }, [paramCompany]);

  const remove = async () => {
    if (!deleteTarget?.id || deleting) return;
    const id = deleteTarget.id;
    setDeleting(true);
    try {
      const res = await fetch(`/api/activities/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      setDeleteTarget(null);
      load();
    } catch (e) {
      console.error('Delete failed', e);
      toast.error(t('page.activities.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const visible = paramCompany
    ? list.filter((a: any) => a.entity_type === 'company' && a.entity_id === paramCompany)
    : list;
  const filtered = visible.filter(a =>
    a.subject?.toLowerCase().includes(search.toLowerCase()) ||
    a.description?.toLowerCase().includes(search.toLowerCase())
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / ACTIVITIES_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice(
    (currentPage - 1) * ACTIVITIES_PAGE_SIZE,
    currentPage * ACTIVITIES_PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [search, paramCompany]);

  useEffect(() => {
    setPage(current => Math.min(current, pageCount));
  }, [pageCount]);

  const activityTypeLabel = (type: string) => {
    const activityLabel = t(`page.activities.${type}`, { defaultValue: '' });
    return activityLabel || t(`page.activityTimeline.${type}`, { defaultValue: type });
  };
  const directionLabel = (direction?: string) => {
    if (!direction) return t('page.activities.internal');
    return t(`page.activities.${direction}`, { defaultValue: direction });
  };
  const directionClass = (direction?: string) => {
    if (direction === 'outbound') return 'bg-brand-soft text-brand';
    if (direction === 'inbound') return 'bg-success-soft text-success';
    return 'bg-surface-hover text-ink-muted';
  };

  const getIcon = (type: string) => {
    const map: Record<string, React.ReactNode> = {
      call: <Phone size={16} strokeWidth={1.75} className="text-ink-subtle" />,
      email: <Mail size={16} strokeWidth={1.75} className="text-ink-subtle" />,
      note: <FileText size={16} strokeWidth={1.75} className="text-ink-subtle" />,
      meeting: <Calendar size={16} strokeWidth={1.75} className="text-ink-subtle" />,
      status_change: <RefreshCw size={16} strokeWidth={1.75} className="text-ink-subtle" />,
      document_upload: <Upload size={16} strokeWidth={1.75} className="text-ink-subtle" />,
      system_event: <Settings2 size={16} strokeWidth={1.75} className="text-ink-subtle" />,
    };
    return map[type] || null;
  };

  const renderMobileActivity = (a: any) => (
    <article key={a.id} className="rounded-md border border-border bg-surface p-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-9 flex-shrink-0 items-center justify-center rounded-md border border-border bg-surface-subtle">
          {getIcon(a.activity_type)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-xs font-450 text-ink-muted">{activityTypeLabel(a.activity_type)}</span>
            <span className="text-2xs text-ink-subtle">·</span>
            <span className="shrink-0 text-2xs tabular-nums text-ink-subtle">{new Date(a.created_at).toLocaleDateString()}</span>
          </div>
          <p className="mt-1 break-words text-sm text-ink">{a.subject}</p>
        </div>
        <button
          onClick={() => setDeleteTarget(a)}
          className="icon-btn -mr-1 -mt-1 flex-shrink-0 text-ink-subtle hover:text-danger"
          aria-label={t('common.delete')}
          title={t('common.delete')}
        >
          <Icon name="delete" size={14} />
        </button>
      </div>
      {(a.description || a.company_name || a.direction) && (
        <div className="mt-3 border-t border-border pt-3">
          {a.description && <p className="break-words text-xs leading-5 text-ink-muted">{a.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-2xs">
            {a.company_name && <span className="max-w-full truncate text-brand">{a.company_name}</span>}
            <span className={`rounded px-1.5 py-0.5 ${directionClass(a.direction)}`}>{directionLabel(a.direction)}</span>
          </div>
        </div>
      )}
    </article>
  );

  return (
    <div className="page-shell max-w-5xl">
      <div className="page-header">
        <div className="px-3">
          <h1 className="page-heading">{t('page.title.activities')}</h1>
          <p className="page-summary tabular-nums">{filtered.length}{search || paramCompany ? ` / ${list.length}` : ''} {t('common.records')}</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="relative w-full max-w-sm">
          <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
          <label className="sr-only" htmlFor="activities-search">{t('page.activities.searchActivities')}</label>
          <input id="activities-search" className="input w-full pl-9" placeholder={t('page.activities.searchActivities')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {paramCompany && (
          <CompanyFilterChip name={companyName} icon="building" className="ml-auto" />
        )}
      </div>

      {loading ? (
        <div className="data-surface p-3" aria-label={t('common.loading')}>
          <div className="animate-pulse space-y-2">
            {[0, 1, 2, 3, 4].map(row => <div key={row} className="h-16 rounded bg-surface-hover" />)}
          </div>
        </div>
      ) : loadError ? (
        <div className="data-surface p-6" role="alert">
          <div className="empty-state">
            <p>{t('page.error.loadFailed')}</p>
            <button type="button" onClick={load} className="btn-secondary btn-sm mt-3">
              <Icon name="refresh" size={14} className="mr-1.5" />
              {t('common.refresh')}
            </button>
          </div>
        </div>
      ) : (
        <div className="data-surface">
          {filtered.length === 0 ? (
            <p className="empty-state">{t('noData.activities')}</p>
          ) : (
            <>
              <div className="space-y-2 p-3 md:hidden">
                {paged.map(renderMobileActivity)}
              </div>
              <div className="hidden md:block">
                <div className="divide-y divide-border">
                  {paged.map((a: any) => (
                    <div key={a.id} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-hover">
                      <span className="mt-0.5 flex size-8 flex-shrink-0 items-center justify-center rounded-md border border-border bg-surface">{getIcon(a.activity_type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-ink-muted">{activityTypeLabel(a.activity_type)}</span>
                          <span className="text-2xs text-ink-subtle">·</span>
                          <span className="text-2xs text-ink-subtle">{new Date(a.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-ink mt-0.5">{a.subject}</p>
                        {a.description && <p className="text-xs text-ink-muted mt-0.5">{a.description}</p>}
                        {a.company_name && (
                          <p className="text-2xs text-brand mt-1">{a.company_name}</p>
                        )}
                      </div>
                      <span className={`text-2xs capitalize px-1.5 py-0.5 rounded ${directionClass(a.direction)}`}>
                        {directionLabel(a.direction)}
                      </span>
                      <button onClick={() => setDeleteTarget(a)} className="icon-btn ml-1 flex-shrink-0 text-ink-subtle hover:text-danger" aria-label={t('common.delete')} title={t('common.delete')}>
                        <Icon name="delete" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          <Pagination
            page={currentPage}
            pageSize={ACTIVITIES_PAGE_SIZE}
            total={filtered.length}
            onPageChange={setPage}
          />
        </div>
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        title={t('common.delete')}
        description={<>{t('common.confirmDelete')} <strong>{deleteTarget?.subject}</strong></>}
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
