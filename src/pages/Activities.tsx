import { useState, useEffect } from 'react';
import { Phone, Mail, FileText, Calendar, RefreshCw, Upload, Settings2 } from 'lucide-react';
import { activities } from '../lib/api';
import { useTranslation } from 'react-i18next';
import Icon from '../components/shared/Icon';
import ConfirmDialog from '../components/shared/ConfirmDialog';

export default function Activities() {
  const { t } = useTranslation();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    activities.recent().then(setList).finally(() => setLoading(false));
  }, []);

  const remove = async () => {
    if (!deleteTarget?.id || deleting) return;
    const id = deleteTarget.id;
    setDeleting(true);
    try {
      const res = await fetch(`/api/activities/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      setDeleteTarget(null);
      activities.recent().then(setList);
    } catch (e) {
      console.error('Delete failed', e);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = list.filter(a =>
    a.subject?.toLowerCase().includes(search.toLowerCase()) ||
    a.description?.toLowerCase().includes(search.toLowerCase())
  );
  const activityTypeLabel = (type: string) => {
    const activityLabel = t(`page.activities.${type}`, { defaultValue: '' });
    return activityLabel || t(`page.activityTimeline.${type}`, { defaultValue: type });
  };
  const directionLabel = (direction?: string) => {
    if (!direction) return t('page.activities.internal');
    return t(`page.activities.${direction}`, { defaultValue: direction });
  };

  const getIcon = (type: string) => {
    const map: Record<string, React.ReactNode> = {
      call: <Phone size={16} strokeWidth={1.75} className="text-gray-400" />,
      email: <Mail size={16} strokeWidth={1.75} className="text-gray-400" />,
      note: <FileText size={16} strokeWidth={1.75} className="text-gray-400" />,
      meeting: <Calendar size={16} strokeWidth={1.75} className="text-gray-400" />,
      status_change: <RefreshCw size={16} strokeWidth={1.75} className="text-gray-400" />,
      document_upload: <Upload size={16} strokeWidth={1.75} className="text-gray-400" />,
      system_event: <Settings2 size={16} strokeWidth={1.75} className="text-gray-400" />,
    };
    return map[type] || null;
  };

  const renderMobileActivity = (a: any) => (
    <article key={a.id} className="rounded-md border border-gray-200 bg-white p-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-9 flex-shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-50">
          {getIcon(a.activity_type)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-xs font-450 text-gray-700">{activityTypeLabel(a.activity_type)}</span>
            <span className="text-2xs text-gray-400">·</span>
            <span className="shrink-0 text-2xs tabular-nums text-gray-400">{new Date(a.created_at).toLocaleDateString()}</span>
          </div>
          <p className="mt-1 break-words text-sm text-gray-900">{a.subject}</p>
        </div>
        <button
          onClick={() => setDeleteTarget(a)}
          className="icon-btn -mr-1 -mt-1 flex-shrink-0 text-gray-300 hover:text-red-500"
          aria-label={t('common.delete')}
          title={t('common.delete')}
        >
          <Icon name="delete" size={14} />
        </button>
      </div>
      {(a.description || a.company_name || a.direction) && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          {a.description && <p className="break-words text-xs leading-5 text-gray-500">{a.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-2xs">
            {a.company_name && <span className="max-w-full truncate text-blue-600">{a.company_name}</span>}
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-400">{directionLabel(a.direction)}</span>
          </div>
        </div>
      )}
    </article>
  );

  return (
    <div className="page-shell max-w-5xl">
      <div className="page-header">
        <div>
          <h1 className="page-heading">{t('page.title.activities')}</h1>
          <p className="page-summary tabular-nums">{t('page.activities.totalActivities', { count: filtered.length })}</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="relative w-full max-w-sm">
          <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <label className="sr-only" htmlFor="activities-search">{t('page.activities.searchActivities')}</label>
          <input id="activities-search" className="input w-full pl-9" placeholder={t('page.activities.searchActivities')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="data-surface p-3" aria-label={t('common.loading')}>
          <div className="animate-pulse space-y-2">
            {[0, 1, 2, 3, 4].map(row => <div key={row} className="h-16 rounded bg-gray-100" />)}
          </div>
        </div>
      ) : (
        <div className="data-surface">
          {filtered.length === 0 ? (
            <p className="empty-state">{t('noData.activities')}</p>
          ) : (
            <>
              <div className="space-y-2 p-3 md:hidden">
                {filtered.map(renderMobileActivity)}
              </div>
              <div className="hidden md:block">
                <div className="divide-y divide-gray-100">
                  {filtered.map((a: any) => (
                    <div key={a.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50">
                      <span className="mt-0.5 flex size-8 flex-shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white">{getIcon(a.activity_type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-700">{activityTypeLabel(a.activity_type)}</span>
                          <span className="text-2xs text-gray-400">·</span>
                          <span className="text-2xs text-gray-400">{new Date(a.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-gray-900 mt-0.5">{a.subject}</p>
                        {a.description && <p className="text-xs text-gray-500 mt-0.5">{a.description}</p>}
                        {a.company_name && (
                          <p className="text-2xs text-blue-600 mt-1">{a.company_name}</p>
                        )}
                      </div>
                      <span className="text-2xs text-gray-400 capitalize px-1.5 py-0.5 bg-gray-100 rounded">
                        {directionLabel(a.direction)}
                      </span>
                      <button onClick={() => setDeleteTarget(a)} className="icon-btn ml-1 flex-shrink-0 text-gray-300 hover:text-red-500" aria-label={t('common.delete')} title={t('common.delete')}>
                        <Icon name="delete" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
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
