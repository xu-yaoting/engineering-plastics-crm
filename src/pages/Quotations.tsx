import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { quotations } from '../lib/api';
import StatusBadge from '../components/shared/StatusBadge';
import { formatCurrency } from '../lib/currency';
import { useTranslation } from 'react-i18next';
import Icon from '../components/shared/Icon';
import { exportFullCsv } from '../lib/exportCsv';
import OwnerFilter from '../components/shared/OwnerFilter';
import QuotationEditPanel from '../components/quotations/QuotationEditPanel';

export default function Quotations() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState('quotation_date_desc');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [currentUserId, setCurrentUserId] = useState('');
  const [showNewQuotation, setShowNewQuotation] = useState(false);
  const handleCurrentUserId = useCallback((userId: string) => setCurrentUserId(userId), []);

  const load = () => {
    setLoading(true);
    quotations.list().then(setList).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = list.filter(q =>
    (!filterStatus || q.status === filterStatus) &&
    (ownerFilter === 'all' || (ownerFilter === 'mine' && q.owner_user_id === currentUserId) ||
      (ownerFilter === 'unassigned' && !q.owner_user_id) || q.owner_user_id === ownerFilter) &&
    (q.quotation_number?.toLowerCase().includes(search.toLowerCase()) ||
     q.company_name?.toLowerCase().includes(search.toLowerCase()) ||
     q.inquiry_number?.toLowerCase().includes(search.toLowerCase()))
  );

  const dateValue = (value: string | undefined | null) => value ? new Date(value).getTime() || 0 : 0;
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'quotation_date_asc') return dateValue(a.quotation_date || a.created_at) - dateValue(b.quotation_date || b.created_at);
    if (sortBy === 'total_desc') return Number(b.total || 0) - Number(a.total || 0);
    if (sortBy === 'total_asc') return Number(a.total || 0) - Number(b.total || 0);
    return dateValue(b.quotation_date || b.created_at) - dateValue(a.quotation_date || a.created_at);
  });

  const renderMobileQuotation = (q: any) => (
    <button
      key={q.id}
      type="button"
      onClick={() => navigate(`/quotations/${q.id}`)}
      className="block w-full rounded-md border border-gray-200 bg-white p-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/30"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium tabular-nums text-blue-600">{q.quotation_number}</span>
          <span className="mt-0.5 block truncate text-xs text-gray-500">{q.company_name || '—'}</span>
        </div>
        <StatusBadge status={q.status} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-gray-100 pt-3 text-xs">
        <div className="min-w-0">
          <dt className="text-2xs text-gray-400">{t('page.quotations.total')}</dt>
          <dd className="mt-0.5 truncate tabular-nums font-medium text-gray-900">{formatCurrency(q.total, q.currency)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-2xs text-gray-400">{t('page.quotations.date')}</dt>
          <dd className="mt-0.5 truncate tabular-nums text-gray-500">{q.quotation_date || q.created_at?.slice(0, 10) || '—'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-2xs text-gray-400">{t('page.quotations.validUntil')}</dt>
          <dd className="mt-0.5 truncate tabular-nums text-gray-500">{q.valid_until || '—'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-2xs text-gray-400">{t('accountability.owner')}</dt>
          <dd className="mt-0.5 truncate text-gray-700">{q.owner_name || t('accountability.unassigned')}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-2xs text-gray-400">{t('page.quotations.version')}</dt>
          <dd className="mt-0.5 truncate text-gray-500">{t('page.quotations.rev')} {q.version || 1}</dd>
        </div>
      </dl>
    </button>
  );

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-heading">{t('page.title.quotations')}</h1>
          <p className="page-summary tabular-nums">{sorted.length}{search || filterStatus ? ` / ${list.length}` : ''} {t('common.records')}</p>
        </div>
        <div className="page-actions">
          <button onClick={() => setShowNewQuotation(true)} className="btn-primary btn-sm">
            <Icon name="plus" size={15} className="mr-1.5" />{t('page.quotations.newQuotation')}
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Icon name="search" size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <label className="sr-only" htmlFor="quotations-search">{t('common.searchQuotations')}</label>
          <input id="quotations-search" className="input pl-8" placeholder={t('common.searchQuotations')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <label className="sr-only" htmlFor="quotations-status-filter">{t('page.quotations.status')}</label>
        <select id="quotations-status-filter" className="input max-w-[180px]" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">{t('page.quotations.all')}</option>
          <option value="draft">{t('status.draft')}</option>
          <option value="pending_approval">{t('status.pendingApproval')}</option>
          <option value="approved">{t('status.approved')}</option>
          <option value="sent">{t('status.sent')}</option>
          <option value="negotiating">{t('status.negotiating')}</option>
          <option value="accepted">{t('status.accepted')}</option>
          <option value="rejected">{t('status.rejected')}</option>
          <option value="expired">{t('status.expired')}</option>
        </select>
        <OwnerFilter value={ownerFilter} onChange={setOwnerFilter} onCurrentUserId={handleCurrentUserId} />
        <label className="sr-only" htmlFor="quotations-sort">{t('page.quotations.quotationDateNewest')}</label>
        <select id="quotations-sort" className="input max-w-[220px]" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="quotation_date_desc">{t('page.quotations.quotationDateNewest')}</option>
          <option value="quotation_date_asc">{t('page.quotations.quotationDateOldest')}</option>
          <option value="total_desc">{t('page.quotations.totalHighToLow')}</option>
          <option value="total_asc">{t('page.quotations.totalLowToHigh')}</option>
        </select>
        <button onClick={() => exportFullCsv('/api/quotations', 'quotations')} className="btn-secondary btn-sm ml-auto"><Icon name="download" size="inline" />CSV</button>
      </div>

      {loading ? (
        <div className="data-surface border-t-0 rounded-t-none p-3" aria-label={t('common.loading')}>
          <div className="animate-pulse space-y-2">{[0, 1, 2, 3, 4, 5].map(row => <div key={row} className="h-10 rounded-md bg-gray-100" />)}</div>
        </div>
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {sorted.map(renderMobileQuotation)}
            {sorted.length === 0 && (
              <div className="empty-state rounded-md border border-gray-200 bg-white">{t('noData.quotations')}</div>
            )}
          </div>
          <div className="hidden data-surface overflow-x-auto md:block">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="table-header">{t('page.quotations.number')}</th>
                <th className="table-header">{t('page.quotations.date')}</th>
                <th className="table-header">{t('page.quotations.company')}</th>
                <th className="table-header">{t('accountability.owner')}</th>
                <th className="table-header">{t('page.quotations.status')}</th>
                <th className="table-header text-right">{t('page.quotations.total')}</th>
                <th className="table-header">{t('page.quotations.currency')}</th>
                <th className="table-header">{t('page.quotations.validUntil')}</th>
                <th className="table-header">{t('page.quotations.version')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(q => (
                <tr key={q.id} className="table-row" onClick={() => navigate(`/quotations/${q.id}`)}>
                  <td className="table-cell font-medium text-blue-600 tabular-nums">
                    {q.quotation_number}
                  </td>
                  <td className="table-cell text-xs text-gray-500">{q.quotation_date || q.created_at?.slice(0, 10) || '—'}</td>
                  <td className="table-cell text-gray-900">{q.company_name || '—'}</td>
                  <td className="table-cell text-xs text-gray-500">{q.owner_name || t('accountability.unassigned')}</td>
                  <td className="table-cell"><StatusBadge status={q.status} /></td>
                  <td className="table-cell text-right tabular-nums text-sm font-medium">{formatCurrency(q.total, q.currency)}</td>
                  <td className="table-cell text-xs text-gray-500">{q.currency}</td>
                  <td className="table-cell text-xs text-gray-500">{q.valid_until || '—'}</td>
                  <td className="table-cell text-xs text-gray-500">{t('page.quotations.rev')} {q.version || 1}</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={9}><div className="empty-state">{t('noData.quotations')}</div></td></tr>
              )}
            </tbody>
          </table>
          </div>
        </>
      )}

      {showNewQuotation && (
        <QuotationEditPanel
          quotation={{}}
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
