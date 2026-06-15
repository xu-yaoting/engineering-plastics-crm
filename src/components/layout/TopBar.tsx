import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from '../shared/Icon';

export default function TopBar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const [search, setSearch] = useState('');
  const { t } = useTranslation();
  const [overdueCount, setOverdueCount] = useState(0);
  const [expiringCount, setExpiringCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/tasks/overdue').then(r => r.json()).then(t => setOverdueCount(t.length)).catch(() => {});
    fetch('/api/quotations').then(r => r.json()).then((q: any[]) => {
      const now = new Date();
      const expiring = q.filter((qt: any) => {
        if (!qt.valid_until || qt.status === 'accepted' || qt.status === 'rejected') return false;
        const days = (new Date(qt.valid_until).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return days >= 0 && days <= 7;
      });
      setExpiringCount(expiring.length);
    }).catch(() => {});
  }, []);

  const totalAlerts = overdueCount + expiringCount;

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center gap-4 px-4 flex-shrink-0">
      <button
        onClick={onToggleSidebar}
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 flex-shrink-0"
      >
        <Icon name="menu" size={18} />
      </button>

      <div className="flex-1 max-w-lg relative">
        <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && search.trim()) navigate('/companies'); }}
          placeholder={t('nav.customers') + ', ' + t('nav.contacts') + ', ' + t('nav.quotations') + '...'}
          className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-300 text-sm text-gray-700 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-0"
        />
      </div>

      <div className="flex items-center gap-3">
        {/* Alert indicator */}
        <button
          onClick={() => navigate('/tasks')}
          className={`relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors ${
            totalAlerts > 0 ? 'text-red-500' : 'text-gray-400'
          }`}
          title={`${overdueCount} ${t('status.overdue')}, ${expiringCount} ${t('page.dashboard.expiringQuotes')}`}
        >
          <Icon name="bell" size={18} />
          {totalAlerts > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {totalAlerts > 9 ? '9+' : totalAlerts}
            </span>
          )}
        </button>

        <span className="text-2xs text-gray-400 bg-gray-100 px-2 py-1 rounded-md hidden sm:inline">⌘K</span>
      </div>
    </header>
  );
}
