import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../components/shared/StatusBadge';
import { formatCurrency } from '../lib/currency';
import { useTranslation } from 'react-i18next';
import Icon from '../components/shared/Icon';
import { exportFullCsv } from '../lib/exportCsv';
import OwnerFilter from '../components/shared/OwnerFilter';

export default function Orders() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('order_date_desc');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [currentUserId, setCurrentUserId] = useState('');
  const handleCurrentUserId = useCallback((userId: string) => setCurrentUserId(userId), []);

  useEffect(() => {
    fetch('/api/orders')
      .then(r => r.json())
      .then(setList)
      .finally(() => setLoading(false));
  }, []);

  const filtered = list.filter(o => {
    const matchesSearch = !search || o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_po_number?.toLowerCase().includes(search.toLowerCase());
    const matchesOwner = ownerFilter === 'all' || (ownerFilter === 'mine' && o.owner_user_id === currentUserId) ||
      (ownerFilter === 'unassigned' && !o.owner_user_id) || o.owner_user_id === ownerFilter;
    return matchesSearch && matchesOwner;
  });

  const dateValue = (value: string | undefined | null) => value ? new Date(value).getTime() || 0 : 0;
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'order_date_asc') return dateValue(a.order_date || a.created_at) - dateValue(b.order_date || b.created_at);
    if (sortBy === 'total_desc') return Number(b.total || 0) - Number(a.total || 0);
    if (sortBy === 'total_asc') return Number(a.total || 0) - Number(b.total || 0);
    return dateValue(b.order_date || b.created_at) - dateValue(a.order_date || a.created_at);
  });

  const renderMobileOrder = (o: any) => (
    <button
      key={o.id}
      type="button"
      onClick={() => navigate(`/orders/${o.id}`)}
      className="block w-full rounded-md border border-gray-200 bg-white p-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/30"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium tabular-nums text-blue-600">{o.order_number}</span>
          <span className="mt-0.5 block truncate text-xs text-gray-500">{o.company_name || '—'}</span>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          <StatusBadge status={o.status} />
          <StatusBadge status={o.payment_status} />
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-gray-100 pt-3 text-xs">
        <div className="min-w-0">
          <dt className="text-2xs text-gray-400">{t('page.orders.total')}</dt>
          <dd className="mt-0.5 truncate tabular-nums font-medium text-gray-900">{formatCurrency(o.total, o.currency)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-2xs text-gray-400">{t('page.orders.date')}</dt>
          <dd className="mt-0.5 truncate tabular-nums text-gray-500">{o.order_date?.slice(0, 10) || o.created_at?.slice(0, 10) || '—'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-2xs text-gray-400">{t('accountability.owner')}</dt>
          <dd className="mt-0.5 truncate text-gray-700">{o.owner_name || t('accountability.unassigned')}</dd>
        </div>
      </dl>
    </button>
  );

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-heading">{t('page.title.orders')}</h1>
          <p className="page-summary tabular-nums">{sorted.length}{search ? ` / ${list.length}` : ''} {t('common.records')}</p>
        </div>
      </div>

      <div className="toolbar gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Icon name="search" size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <label className="sr-only" htmlFor="orders-search">{t('common.searchOrders')}</label>
          <input id="orders-search" className="input pl-8" placeholder={t('common.searchOrders')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <label className="sr-only" htmlFor="orders-sort">{t('page.orders.orderDateNewest')}</label>
        <select id="orders-sort" className="input max-w-[220px]" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="order_date_desc">{t('page.orders.orderDateNewest')}</option>
          <option value="order_date_asc">{t('page.orders.orderDateOldest')}</option>
          <option value="total_desc">{t('page.orders.totalHighToLow')}</option>
          <option value="total_asc">{t('page.orders.totalLowToHigh')}</option>
        </select>
        <OwnerFilter value={ownerFilter} onChange={setOwnerFilter} onCurrentUserId={handleCurrentUserId} />
        <button onClick={() => exportFullCsv('/api/orders', 'orders')} className="btn-secondary btn-sm ml-auto"><Icon name="download" size="inline" />CSV</button>
      </div>

      {loading ? (
        <div className="data-surface rounded-t-none p-3" aria-label={t('common.loading')}>
          <div className="animate-pulse space-y-2">{[0, 1, 2, 3, 4, 5].map(row => <div key={row} className="h-10 rounded-md bg-gray-100" />)}</div>
        </div>
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {sorted.map(renderMobileOrder)}
            {sorted.length === 0 && (
              <div className="empty-state rounded-md border border-gray-200 bg-white">{t('noData.orders')}</div>
            )}
          </div>
          <div className="hidden data-surface overflow-x-auto md:block">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="table-header text-center">{t('page.orders.orderNumber')}</th>
                  <th className="table-header text-center">{t('page.orders.company')}</th>
                  <th className="table-header text-center">{t('accountability.owner')}</th>
                  <th className="table-header text-center">{t('page.orders.status')}</th>
                  <th className="table-header text-center">{t('page.orders.payment')}</th>
                  <th className="table-header text-right">{t('page.orders.total')}</th>
                  <th className="table-header text-center">{t('page.orders.date')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((o: any) => (
                  <tr key={o.id} className="table-row" onClick={() => navigate(`/orders/${o.id}`)}>
                    <td className="table-cell font-medium text-blue-600 tabular-nums">{o.order_number}</td>
                    <td className="table-cell text-gray-900">{o.company_name || '—'}</td>
                    <td className="table-cell text-xs text-gray-500">{o.owner_name || t('accountability.unassigned')}</td>
                    <td className="table-cell"><StatusBadge status={o.status} /></td>
                    <td className="table-cell"><StatusBadge status={o.payment_status} /></td>
                    <td className="table-cell text-right tabular-nums text-sm font-medium">{formatCurrency(o.total, o.currency)}</td>
                    <td className="table-cell text-xs text-gray-400">{o.order_date?.slice(0, 10)}</td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr><td colSpan={7}><div className="empty-state">{t('noData.orders')}</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
