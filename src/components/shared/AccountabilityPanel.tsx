import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { audit, type AuditEntry } from '../../lib/api';
import Icon from './Icon';

type AccountableRecord = {
  owner_name?: string | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
};

type Props = {
  entityType: string;
  entityId: string;
  record: AccountableRecord;
  showOwner?: boolean;
};

export default function AccountabilityPanel({ entityType, entityId, record, showOwner = true }: Props) {
  const { t, i18n } = useTranslation();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loadError, setLoadError] = useState(false);

  const load = () => {
    setLoadError(false);
    audit.list(entityType, entityId, 12)
      .then(setEntries)
      .catch(() => {
        setEntries([]);
        setLoadError(true);
      });
  };
  useEffect(() => {
    load();
  }, [entityId, entityType]);

  const actionLabel = (action: string) => t(`accountability.actions.${action}`, { defaultValue: action });
  const formatValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') return t('accountability.empty', { defaultValue: 'Empty' });
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return text.length > 36 ? `${text.slice(0, 33)}...` : text;
  };
  const fieldLabel = (field: string) => t(`accountability.fields.${field}`, {
    defaultValue: field.replaceAll('_', ' '),
  });

  return (
    <section className="space-y-4">
      <div>
        <h3 className="section-label mb-3">{t('accountability.responsibility', { defaultValue: 'Responsibility' })}</h3>
        <dl className="space-y-2 text-xs">
          {showOwner && <div className="flex justify-between gap-3"><dt className="text-ink-subtle">{t('accountability.owner', { defaultValue: 'Owner' })}</dt><dd className="text-ink text-right">{record.owner_name || t('accountability.unassigned', { defaultValue: 'Unassigned' })}</dd></div>}
          <div className="flex justify-between gap-3"><dt className="text-ink-subtle">{t('accountability.createdBy', { defaultValue: 'Created by' })}</dt><dd className="text-ink text-right">{record.created_by_name || '—'}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-ink-subtle">{t('accountability.updatedBy', { defaultValue: 'Last updated by' })}</dt><dd className="text-ink text-right">{record.updated_by_name || '—'}</dd></div>
        </dl>
      </div>

      <div>
        <h3 className="section-label mb-3 flex items-center gap-1.5"><Icon name="clock" size={13} />{t('accountability.history', { defaultValue: 'Operation history' })}</h3>
        {loadError ? (
          <div className="rounded-md border border-danger bg-danger-soft p-3" role="alert">
            <p className="text-xs text-danger">{t('page.error.loadFailed')}</p>
            <button type="button" onClick={load} className="mt-2 text-xs font-medium text-danger hover:underline">
              {t('common.refresh')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const changeEntries = entry.action === 'update' ? Object.entries(entry.changes || {}).slice(0, 3) : [];
              return (
                <div key={entry.id} className="border-l border-border pl-3 text-xs">
                  <div className="text-ink"><span className="font-medium">{entry.user_name}</span> · {actionLabel(entry.action)}</div>
                  <div className="mt-0.5 text-2xs text-ink-subtle">
                    {new Date(entry.created_at).toLocaleString(i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US')}
                    {Object.keys(entry.changes || {}).length > 0 && ` · ${t('accountability.fieldsChanged', { count: Object.keys(entry.changes).length, defaultValue: '{{count}} fields' })}`}
                  </div>
                  {changeEntries.length > 0 && (
                    <div className="mt-1 space-y-0.5 text-2xs text-ink-muted">
                      {changeEntries.map(([field, change]) => (
                        <div key={field} className="break-words">
                          <span className="text-ink-subtle">{fieldLabel(field)}:</span>{' '}
                          {formatValue(change.old)} {t('accountability.changedTo', { defaultValue: 'to' })} {formatValue(change.new)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {entries.length === 0 && <p className="text-xs text-ink-subtle">{t('accountability.noHistory', { defaultValue: 'No operation history' })}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
