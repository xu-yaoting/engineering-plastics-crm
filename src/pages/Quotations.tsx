import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { quotations } from '../lib/api';
import StatusBadge from '../components/shared/StatusBadge';
import { formatCurrency } from '../lib/currency';
import { useTranslation } from 'react-i18next';
import Icon from '../components/shared/Icon';
import CompanyFilterChip from '../components/shared/CompanyFilterChip';
import { exportFullCsv } from '../lib/exportCsv';
import OwnerFilter from '../components/shared/OwnerFilter';
import QuotationEditPanel from '../components/quotations/QuotationEditPanel';
import Pagination from '../components/shared/Pagination';

const QUOTATIONS_PAGE_SIZE = 11;

export default function Quotations() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState('quotation_date_desc');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [currentUserId, setCurrentUserId] = useState('');
  const [showNewQuotation, setShowNewQuotation] = useState(false);
  const [page, setPage] = useState(1);
  const [searchParams] = useSearchParams();
  const paramCompany = searchParams.get('company') || '';
  const handleCurrentUserId = useCallback((userId: string) => setCurrentUserId(userId), []);

  const load = () => {
    setLoading(true);
    setLoadError(false);
    quotations.list()
      .then(data => setList(data))
      .catch(() => {
        setList([]);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = list.filter(q =>
    (!paramCompany || q.company_id === paramCompany) &&
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
  const pageCount = Math.max(1, Math.ceil(sorted.length / QUOTATIONS_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = sorted.slice(
    (currentPage - 1) * QUOTATIONS_PAGE_SIZE,
    currentPage * QUOTATIONS_PAGE_SIZE,
  );

  const paramCompanyName = paramCompany
    ? (list.find((quotation: any) => quotation.company_id === paramCompany)?.company_name || '')
    : '';

  useEffect(() => {
    setPage(1);
  }, [search, filterStatus, sortBy, ownerFilter, paramCompany]);

  useEffect(() => {
    setPage(current => Math.min(current, pageCount));
  }, [pageCount]);

  const renderMobileQuotation = (q: any) => (
    <button
      key={q.id}
      type="button"
      onClick={() => navigate(`/quotations/${q.id}`)}
      className="block w-full rounded-md border border-border bg-surface p-3 text-left transition-colors hover:border-stage-quotation hover:bg-stage-quotation-soft"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium tabular-nums text-stage-quotation">{q.quotation_number}</span>
          <span className="mt-0.5 block truncate text-xs text-ink-muted">{q.company_name || '—'}</span>
        </div>
        <StatusBadge status={q.status} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-xs">
        <div className="min-w-0">
          <dt className="text-2xs text-ink-subtle">{t('page.quotations.total')}</dt>
          <dd className="mt-0.5 truncate tabular-nums font-medium text-ink">{formatCurrency(q.total, q.currency)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-2xs text-ink-subtle">{t('page.quotations.date')}</dt>
          <dd className="mt-0.5 truncate tabular-nums text-ink-muted">{q.quotation_date || q.created_at?.slice(0, 10) || '—'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-2xs text-ink-subtle">{t('page.quotations.validUntil')}</dt>
          <dd className="mt-0.5 truncate tabular-nums text-ink-muted">{q.valid_until || '—'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-2xs text-ink-subtle">{t('accountability.owner')}</dt>
          <dd className="mt-0.5 truncate text-ink-muted">{q.owner_name || t('accountability.unassigned')}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-2xs text-ink-subtle">{t('page.quotations.version')}</dt>
          <dd className="mt-0.5 truncate text-ink-muted">{t('page.quotations.rev')} {q.version || 1}</dd>
        </div>
      </dl>
    </button>
  );

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="px-3">
          <h1 className="page-heading">{t('page.title.quotations')}</h1>
          <p className="page-summary tabular-nums">{sorted.length}{search || filterStatus || paramCompany ? ` / ${list.length}` : ''} {t('common.records')}</p>
        </div>
        <div className="page-actions px-3">
          <button onClick={() => setShowNewQuotation(true)} className="btn-primary btn-sm">
            <Icon name="plus" size={15} className="mr-1.5" />{t('page.quotations.newQuotation')}
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Icon name="search" size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
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
        {paramCompany && (
          <CompanyFilterChip name={paramCompanyName || t('page.quotations.company')} icon="filter" />
        )}
        <button onClick={() => exportFullCsv('/api/quotations', 'quotations')} className="btn-secondary btn-sm ml-auto"><Icon name="download" size="inline" />CSV</button>
      </div>

      {loading ? (
        <div className="data-surface border-t-0 rounded-t-none p-3" aria-label={t('common.loading')}>
          <div className="animate-pulse space-y-2">{[0, 1, 2, 3, 4, 5].map(row => <div key={row} className="h-10 rounded-md bg-surface-hover" />)}</div>
        </div>
      ) : loadError ? (
        <div className="data-surface border-t-0 rounded-t-none p-6" role="alert">
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
          <div className="space-y-2 md:hidden">
            {paged.map(renderMobileQuotation)}
            {sorted.length === 0 && (
              <div className="empty-state rounded-md border border-border bg-surface">
                <p>{t('noData.quotations')}</p>
                <button type="button" onClick={() => setShowNewQuotation(true)} className="btn-primary btn-sm">
                  <Icon name="plus" size={14} className="mr-1.5" />
                  {t('page.quotations.newQuotation')}
                </button>
              </div>
            )}
          </div>
          <div className="md:hidden">
            <Pagination
              page={currentPage}
              pageSize={QUOTATIONS_PAGE_SIZE}
              total={sorted.length}
              onPageChange={setPage}
            />
          </div>
          <div className="hidden data-surface overflow-x-auto md:block">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-surface-subtle">
                <th className="table-header">{t('page.quotations.number')}</th>
                <th className="table-header">{t('page.quotations.date')}</th>
                <th className="table-header">{t('page.quotations.company')}</th>
                <th className="table-header">{t('accountability.owner')}</th>
                <th className="table-header">{t('page.quotations.status')}</th>
                <th className="table-header text-right">{t('page.quotations.total')}</th>
                <th className="table-header">{t('page.quotations.validUntil')}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(q => (
                <tr key={q.id} className="table-row" onClick={() => navigate(`/quotations/${q.id}`)}>
                  <td className="table-cell font-medium text-stage-quotation tabular-nums">
                    {q.quotation_number}
                  </td>
                  <td className="table-cell text-xs text-ink-muted">{q.quotation_date || q.created_at?.slice(0, 10) || '—'}</td>
                  <td className="table-cell text-ink">{q.company_name || '—'}</td>
                  <td className="table-cell text-xs text-ink-muted">{q.owner_name || t('accountability.unassigned')}</td>
                  <td className="table-cell"><StatusBadge status={q.status} /></td>
                  <td className="table-cell text-right tabular-nums text-sm font-medium">{formatCurrency(q.total, q.currency)}</td>
                  <td className="table-cell text-xs text-ink-muted">{q.valid_until || '—'}</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={7}><div className="empty-state">
                  <p>{t('noData.quotations')}</p>
                  <button type="button" onClick={() => setShowNewQuotation(true)} className="btn-primary btn-sm">
                    <Icon name="plus" size={14} className="mr-1.5" />
                    {t('page.quotations.newQuotation')}
                  </button>
                </div></td></tr>
              )}
            </tbody>
          </table>
          <Pagination
            page={currentPage}
            pageSize={QUOTATIONS_PAGE_SIZE}
            total={sorted.length}
            onPageChange={setPage}
          />
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
