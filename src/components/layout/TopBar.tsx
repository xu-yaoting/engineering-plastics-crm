import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from '../shared/Icon';

export default function TopBar({
  onToggleSidebar,
  navigationExpanded,
}: {
  onToggleSidebar: () => void;
  navigationExpanded: boolean;
}) {
  const [search, setSearch] = useState('');
  const { t, i18n } = useTranslation();
  const [overdueCount, setOverdueCount] = useState(0);
  const [expiringCount, setExpiringCount] = useState(0);
  const [alertLoadError, setAlertLoadError] = useState(false);
  const navigate = useNavigate();

  const loadAlerts = () => {
    setAlertLoadError(false);
    Promise.all([
      fetch('/api/tasks/overdue').then(async res => {
        if (!res.ok) throw new Error(`Overdue tasks request failed: ${res.status}`);
        return res.json();
      }),
      fetch('/api/quotations').then(async res => {
        if (!res.ok) throw new Error(`Quotations request failed: ${res.status}`);
        return res.json();
      }),
    ]).then(([tasks, quotations]) => {
      setOverdueCount(tasks.length);
      const now = new Date();
      const expiring = quotations.filter((qt: any) => {
        if (!qt.valid_until || qt.status === 'accepted' || qt.status === 'rejected') return false;
        const days = (new Date(qt.valid_until).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return days >= 0 && days <= 7;
      });
      setExpiringCount(expiring.length);
    }).catch(() => {
      setOverdueCount(0);
      setExpiringCount(0);
      setAlertLoadError(true);
    });
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const totalAlerts = overdueCount + expiringCount;
  const zhInterface = (i18n.language || 'zh').startsWith('zh');
  const listSeparator = zhInterface ? '、' : ', ';
  const ellipsis = zhInterface ? '…' : '...';

  return (
    <header className="h-14 bg-surface border-b border-border flex items-center gap-4 px-4 flex-shrink-0">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="icon-btn"
        aria-label={t('nav.workspace')}
        aria-expanded={navigationExpanded}
      >
        <Icon name="menu" size={18} />
      </button>

      <div className="flex-1 max-w-lg relative">
        <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
        <label className="sr-only" htmlFor="top-bar-search">{t('common.search')}</label>
        <input
          id="top-bar-search"
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && search.trim()) navigate('/companies'); }}
          placeholder={t('nav.customers') + listSeparator + t('nav.contacts') + listSeparator + t('nav.quotations') + ellipsis}
          className="input h-9 pl-9 pr-12"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:inline rounded border border-border bg-surface-subtle px-1.5 py-0.5 text-2xs font-450 text-ink-subtle">⌘K</span>
      </div>

      <div className="flex items-center gap-3">
        {/* Alert indicator */}
        <button
          type="button"
          onClick={() => alertLoadError ? loadAlerts() : navigate('/tasks')}
          className={`icon-btn relative ${
            totalAlerts > 0 || alertLoadError ? 'text-danger' : 'text-ink-subtle'
          }`}
          title={alertLoadError ? t('page.error.loadFailed') : `${overdueCount} ${t('status.overdue')}, ${expiringCount} ${t('page.dashboard.expiringQuotes')}`}
          aria-label={alertLoadError ? t('page.error.loadFailed') : `${overdueCount} ${t('status.overdue')}, ${expiringCount} ${t('page.dashboard.expiringQuotes')}`}
        >
          <Icon name={alertLoadError ? 'warning' : 'bell'} size={18} />
          {(totalAlerts > 0 || alertLoadError) && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-danger text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
              {alertLoadError ? '!' : totalAlerts > 9 ? '9+' : totalAlerts}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
