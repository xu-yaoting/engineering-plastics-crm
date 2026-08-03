import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { inquiries } from '../lib/api';
import StatusBadge from '../components/shared/StatusBadge';
import { useTranslation } from 'react-i18next';
import Icon from '../components/shared/Icon';
import { exportFullCsv } from '../lib/exportCsv';
import { formatCurrency } from '../lib/currency';
import OwnerFilter from '../components/shared/OwnerFilter';

export default function Opportunities() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [currentUserId, setCurrentUserId] = useState('');
  const handleCurrentUserId = useCallback((userId: string) => setCurrentUserId(userId), []);

  useEffect(() => {
    inquiries.list().then(setList).finally(() => setLoading(false));
  }, []);

  const filtered = list.filter(i =>
    (i.inquiry_number?.toLowerCase().includes(search.toLowerCase()) ||
     i.company_name?.toLowerCase().includes(search.toLowerCase()) ||
     i.target_material_requested?.toLowerCase().includes(search.toLowerCase())) &&
    (!filterStatus || i.status === filterStatus) &&
    (ownerFilter === 'all' ||
      (ownerFilter === 'mine' && i.owner_user_id === currentUserId) ||
      (ownerFilter === 'unassigned' && !i.owner_user_id) ||
      i.owner_user_id === ownerFilter)
  );

  const urgencyColor = (u: string) => {
    if (u === 'immediate') return 'text-red-500 font-medium';
    if (u === 'within_2_weeks') return 'text-yellow-600';
    return 'text-gray-400';
  };

  const urgencyLabel = (u?: string) => {
    if (u === 'immediate') return t('page.inquiries.immediate');
    if (u === 'within_2_weeks') return t('page.inquiries.within2Weeks');
    if (u === 'within_1_month') return t('page.inquiries.within1Month');
    if (u === 'no_rush') return t('page.inquiries.noRush');
    return u || '—';
  };

  const renderMobileCard = (inq: any) => (
    <button
      key={inq.id}
      type="button"
      onClick={() => navigate(`/opportunities/${inq.id}`)}
      className="block w-full rounded-md border border-gray-200 bg-white p-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/30"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium tabular-nums text-blue-600">
            {inq.inquiry_number}
          </span>
          <span className="mt-0.5 block truncate text-xs text-gray-500">
            {inq.company_name || '—'}
          </span>
        </div>
        <StatusBadge status={inq.status} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-gray-100 pt-3 text-xs">
        <div className="min-w-0">
          <dt className="text-2xs text-gray-400">{t('page.opportunities.material')}</dt>
          <dd className="mt-0.5 truncate font-medium text-gray-700">
            {inq.target_material_requested || '—'}
            {inq.quantity_estimate && (
              <span className="ml-1 text-2xs font-normal text-gray-400">
                · {inq.quantity_estimate}
              </span>
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-2xs text-gray-400">{t('page.opportunities.quotation')}</dt>
          <dd className="mt-0.5 truncate">
            {inq.latest_quotation_id ? (
              <span className="tabular-nums font-medium text-gray-900">
                {formatCurrency(inq.latest_quotation_total || 0, inq.latest_quotation_currency || 'USD')}
              </span>
            ) : (
              <span className="text-gray-400">{t('page.opportunities.noQuotation')}</span>
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-2xs text-gray-400">{t('page.inquiries.urgency')}</dt>
          <dd className={`mt-0.5 truncate ${urgencyColor(inq.urgency)}`}>
            {urgencyLabel(inq.urgency)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-2xs text-gray-400">{t('page.opportunities.owner')}</dt>
          <dd className="mt-0.5 truncate text-gray-700">
            {inq.owner_name || t('accountability.unassigned')}
          </dd>
        </div>
      </dl>
    </button>
  );

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-heading">{t('page.title.opportunities')}</h1>
          <p className="page-summary tabular-nums">
            {filtered.length}{search || filterStatus ? ` / ${list.length}` : ''} {t('common.records')}
          </p>
        </div>
        <div className="page-actions">
          <Link to="/opportunities/new" className="btn-primary btn-sm">
            <Icon name="plus" size={15} className="mr-1.5" />
            {t('page.opportunities.new')}
          </Link>
          <button
            onClick={() => exportFullCsv('/api/inquiries', 'opportunities')}
            className="btn-secondary btn-sm"
          >
            <Icon name="download" size={14} className="mr-1" />CSV
          </button>
        </div>
      </div>

      <div className="toolbar gap-3">
        <div className="relative w-full max-w-sm">
          <Icon
            name="search"
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <label className="sr-only" htmlFor="opportunities-search">
            {t('page.opportunities.search')}
          </label>
          <input
            id="opportunities-search"
            className="input w-full pl-9"
            placeholder={t('page.opportunities.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <label className="sr-only" htmlFor="opportunities-status-filter">
          {t('page.opportunities.allStatus')}
        </label>
        <select
          id="opportunities-status-filter"
          className="input max-w-[180px]"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">{t('page.opportunities.allStatus')}</option>
          <option value="open">{t('status.open')}</option>
          <option value="under_review">{t('status.underReview')}</option>
          <option value="quoted">{t('status.quoted')}</option>
          <option value="closed_won">{t('status.won')}</option>
          <option value="closed_lost">{t('status.lost')}</option>
        </select>
        <OwnerFilter
          value={ownerFilter}
          onChange={setOwnerFilter}
          onCurrentUserId={handleCurrentUserId}
        />
      </div>

      {loading ? (
        <div className="data-surface p-3" aria-label={t('common.loading')}>
          <div className="animate-pulse space-y-2">
            {[0, 1, 2, 3, 4].map(row => (
              <div key={row} className="h-10 rounded bg-gray-100" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {filtered.map(renderMobileCard)}
            {filtered.length === 0 && (
              <div className="empty-state rounded-md border border-gray-200 bg-white">
                {t('noData.opportunities')}
              </div>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden data-surface overflow-x-auto md:block">
            <table className="w-full min-w-[900px]">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="table-header">{t('page.opportunities.number')}</th>
                  <th className="table-header">{t('page.opportunities.company')}</th>
                  <th className="table-header">{t('page.opportunities.material')}</th>
                  <th className="table-header">{t('page.inquiries.status')}</th>
                  <th className="table-header">{t('page.opportunities.quotation')}</th>
                  <th className="table-header text-right">{t('page.opportunities.amount')}</th>
                  <th className="table-header">{t('page.opportunities.owner')}</th>
                  <th className="table-header">{t('page.opportunities.created')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inq => (
                  <tr
                    key={inq.id}
                    className="table-row"
                    onClick={() => navigate(`/opportunities/${inq.id}`)}
                  >
                    <td className="table-cell font-medium text-blue-600 tabular-nums">
                      {inq.inquiry_number}
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-900">{inq.company_name || '—'}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-xs font-medium">
                        {inq.target_material_requested || '—'}
                      </span>
                      {inq.quantity_estimate && (
                        <span className="text-2xs text-gray-400 ml-1">
                          · {inq.quantity_estimate}
                        </span>
                      )}
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={inq.status} />
                    </td>
                    <td className="table-cell">
                      {inq.latest_quotation_id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs tabular-nums text-blue-600">
                            {inq.latest_quotation_number}
                          </span>
                          <StatusBadge status={inq.latest_quotation_status} />
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">
                          {t('page.opportunities.noQuotation')}
                        </span>
                      )}
                    </td>
                    <td className="table-cell text-right tabular-nums text-sm font-medium">
                      {inq.latest_quotation_id
                        ? formatCurrency(
                            inq.latest_quotation_total || 0,
                            inq.latest_quotation_currency || 'USD',
                          )
                        : '—'}
                    </td>
                    <td className="table-cell text-xs text-gray-500">
                      {inq.owner_name || t('accountability.unassigned')}
                    </td>
                    <td className="table-cell text-2xs text-gray-400 tabular-nums">
                      {inq.created_at?.slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="empty-state">{t('noData.opportunities')}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
