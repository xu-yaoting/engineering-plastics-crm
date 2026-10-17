import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Icon from '../shared/Icon';
import ConfirmDialog from '../shared/ConfirmDialog';
import Pagination from '../shared/Pagination';
import { materialsToolingApi } from '../../lib/materials-tooling-api';
import type { MaterialsPermission } from '../../lib/materials-tooling-api';

const MATERIALS_LEDGER_PAGE_SIZE = 10;

export function LedgerTab({ permissions }: { permissions: MaterialsPermission | null }) {
  const { t } = useTranslation();
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [month, setMonth] = useState(defaultMonth);
  const [search, setSearch] = useState('');
  const [ledger, setLedger] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [page, setPage] = useState(1);
  const [downloadingXlsx, setDownloadingXlsx] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showClosePeriodConfirm, setShowClosePeriodConfirm] = useState(false);
  const [closingPeriod, setClosingPeriod] = useState(false);

  const viewPrices = permissions?.viewPrices ?? false;
  const canManagePeriods = permissions?.managePeriods ?? false;

  const load = () => {
    setLoading(true);
    setLoadError(false);
    materialsToolingApi.listLedger(month)
      .then(data => setLedger(data.ledger))
      .catch(err => {
        setLedger(null);
        setLoadError(true);
        toast.error(err.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [month]);

  const downloadXlsx = async () => {
    setDownloadingXlsx(true);
    try {
      const blob = await materialsToolingApi.downloadLedgerXlsx(month);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `materials-ledger-${month}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('page.materialsTooling.export.exporting'));
    } finally {
      setDownloadingXlsx(false);
    }
  };

  const downloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const blob = await materialsToolingApi.downloadLedgerPdf(month);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `materials-ledger-${month}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('page.materialsTooling.export.exporting'));
    } finally {
      setDownloadingPdf(false);
    }
  };

  const closePeriod = async () => {
    if (closingPeriod) return;
    setClosingPeriod(true);
    try {
      await materialsToolingApi.closePeriod(month);
      setShowClosePeriodConfirm(false);
      toast.success(t('page.materialsTooling.periodClosedToast'));
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('page.materialsTooling.closePeriod'));
    } finally {
      setClosingPeriod(false);
    }
  };

  const reopenPeriod = () => {
    const reason = window.prompt(t('page.materialsTooling.reopenReason'));
    if (!reason) return;
    materialsToolingApi.reopenPeriod(month, { reason })
      .then(() => { toast.success(t('page.materialsTooling.periodReopenedToast')); load(); })
      .catch(err => toast.error(err.message));
  };

  const rows = Array.isArray(ledger?.rows) ? ledger.rows : [];
  const isClosed = ledger?.status === 'closed';
  const filtered = search
    ? rows.filter((row: any) =>
        (row.code || '').toLowerCase().includes(search.toLowerCase())
        || (row.name || '').toLowerCase().includes(search.toLowerCase())
        || (row.category || '').toLowerCase().includes(search.toLowerCase()))
    : rows;
  const pageCount = Math.max(1, Math.ceil(filtered.length / MATERIALS_LEDGER_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice(
    (currentPage - 1) * MATERIALS_LEDGER_PAGE_SIZE,
    currentPage * MATERIALS_LEDGER_PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [month, search]);

  useEffect(() => {
    setPage(current => Math.min(current, pageCount));
  }, [pageCount]);

  return (
    <div>
      <div className="toolbar justify-between flex-wrap gap-3 mb-4 md:mb-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Icon name="calendar" size="toolbar" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <label className="sr-only" htmlFor="materials-ledger-month">{t('page.materialsTooling.month')}</label>
            <input
              id="materials-ledger-month"
              className="input pl-8 w-44"
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
            />
          </div>
          <span className={`inline-flex px-2 py-0.5 rounded text-2xs font-450 ${
            isClosed ? 'bg-surface-hover text-ink-muted' : 'bg-success-soft text-success'
          }`}>
            {isClosed
              ? t('page.materialsTooling.periodClosed')
              : t('page.materialsTooling.periodOpen')}
          </span>
          <div className="relative">
            <Icon name="search" size="toolbar" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <label className="sr-only" htmlFor="materials-ledger-search">{t('common.search')}</label>
            <input
              id="materials-ledger-search"
              className="input pl-8 w-48"
              placeholder={t('common.search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadXlsx} disabled={downloadingXlsx || !ledger} className="btn-secondary btn-sm">
            <Icon name="download" size={14} className="mr-1" />
            {downloadingXlsx ? t('common.loading') : t('page.materialsTooling.export.downloadXlsx')}
          </button>
          <button onClick={downloadPdf} disabled={downloadingPdf || !ledger} className="btn-secondary btn-sm">
            <Icon name="file-down" size={14} className="mr-1" />
            {downloadingPdf ? t('common.loading') : t('page.materialsTooling.export.downloadPdf')}
          </button>
          {canManagePeriods && !isClosed && (
            <button onClick={() => setShowClosePeriodConfirm(true)} className="btn-secondary btn-sm text-warning">
              {t('page.materialsTooling.closePeriod')}
            </button>
          )}
          {canManagePeriods && isClosed && (
            <button onClick={reopenPeriod} className="btn-secondary btn-sm text-danger">
              {t('page.materialsTooling.reopenPeriod')}
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="data-surface mb-4 p-4" role="alert">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-muted">{t('page.error.loadFailed')}</p>
            <button type="button" onClick={load} className="btn-secondary btn-sm">
              {t('common.refresh')}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2 md:hidden">
        {loading && [0, 1, 2].map(row => (
          <div key={row} className="data-surface animate-pulse p-4">
            <div className="h-4 w-2/3 rounded bg-surface-hover" />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="h-3 rounded bg-surface-hover" />
              <div className="h-3 rounded bg-surface-hover" />
              <div className="h-3 rounded bg-surface-hover" />
              <div className="h-3 rounded bg-surface-hover" />
            </div>
          </div>
        ))}
        {paged.map((row: any, i: number) => {
          const opening = row.opening || {};
          const receipts = row.receipts || {};
          const returns = row.returns || {};
          const issues = row.issues || {};
          const scrap = row.scrap || {};
          const adjustment = row.adjustment || {};
          const closing = row.closing || {};
          const receiptQuantity = (receipts.quantity ?? 0) + (returns.quantity ?? 0);
          const receiptAmount = (receipts.amount ?? 0) + (returns.amount ?? 0);
          return (
            <article key={row.code || i} className="data-surface space-y-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-xs tabular-nums text-ink-muted">{row.code}</p>
                <h3 className="break-words font-medium text-ink">{row.name}</h3>
                <p className="truncate text-xs text-ink-muted">{row.category || '—'} · {row.unit}</p>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="section-label">{t('page.materialsTooling.openingQty')}</dt>
                  <dd className="tabular-nums text-ink">{opening.quantity ?? 0}</dd>
                </div>
                <div>
                  <dt className="section-label">{t('page.materialsTooling.closingQty')}</dt>
                  <dd className="tabular-nums font-medium text-ink">{closing.quantity ?? 0}</dd>
                </div>
                <div>
                  <dt className="section-label">{t('page.materialsTooling.receiptQty')}</dt>
                  <dd className="tabular-nums text-success">{receiptQuantity}</dd>
                </div>
                <div>
                  <dt className="section-label">{t('page.materialsTooling.issueQty')}</dt>
                  <dd className="tabular-nums text-danger">{-(issues.quantity ?? 0)}</dd>
                </div>
                <div>
                  <dt className="section-label">{t('page.materialsTooling.scrapQty')}</dt>
                  <dd className="tabular-nums text-danger">{-(scrap.quantity ?? 0)}</dd>
                </div>
                <div>
                  <dt className="section-label">{t('page.materialsTooling.adjustmentQty')}</dt>
                  <dd className="tabular-nums text-ink">{adjustment.quantity ?? 0}</dd>
                </div>
              </dl>
              {viewPrices && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 text-sm">
                  <div>
                    <dt className="section-label">{t('page.materialsTooling.receiptAmount')}</dt>
                    <dd className="tabular-nums text-ink">{receiptAmount ? `¥${Number(receiptAmount).toLocaleString()}` : '—'}</dd>
                  </div>
                  <div>
                    <dt className="section-label">{t('page.materialsTooling.issueAmount')}</dt>
                    <dd className="tabular-nums text-ink">{issues.amount ? `¥${Number(issues.amount).toLocaleString()}` : '—'}</dd>
                  </div>
                  <div>
                    <dt className="section-label">{t('page.materialsTooling.closingAmount')}</dt>
                    <dd className="tabular-nums text-ink">{closing.amount ? `¥${Number(closing.amount).toLocaleString()}` : '—'}</dd>
                  </div>
                </dl>
              )}
            </article>
          );
        })}
        {!loading && !loadError && filtered.length === 0 && <div className="empty-state">{t('page.materialsTooling.noData')}</div>}
        <Pagination
          page={currentPage}
          pageSize={MATERIALS_LEDGER_PAGE_SIZE}
          total={filtered.length}
          onPageChange={setPage}
        />
      </div>

      <div className="hidden data-surface overflow-x-auto border-t-0 rounded-t-none md:block">
        <table className="w-full" style={{ minWidth: '900px' }}>
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-canvas">
              <th className="table-header">{t('page.materialsTooling.code')}</th>
              <th className="table-header">{t('page.materialsTooling.name')}</th>
              <th className="table-header">{t('page.materialsTooling.category')}</th>
              <th className="table-header">{t('page.materialsTooling.unit')}</th>
              <th className="table-header text-right">{t('page.materialsTooling.openingQty')}</th>
              <th className="table-header text-right">{t('page.materialsTooling.receiptQty')}</th>
              {viewPrices && <th className="table-header text-right">{t('page.materialsTooling.receiptAmount')}</th>}
              <th className="table-header text-right">{t('page.materialsTooling.issueQty')}</th>
              <th className="table-header text-right">{t('page.materialsTooling.scrapQty')}</th>
              {viewPrices && <th className="table-header text-right">{t('page.materialsTooling.issueAmount')}</th>}
              <th className="table-header text-right">{t('page.materialsTooling.closingQty')}</th>
              <th className="table-header text-right">{t('page.materialsTooling.adjustmentQty')}</th>
              {viewPrices && <th className="table-header text-right">{t('page.materialsTooling.closingAmount')}</th>}
            </tr>
          </thead>
          <tbody>
            {loading && [0, 1, 2].map(row => (
              <tr key={row} className="animate-pulse border-b border-border">
                <td colSpan={viewPrices ? 13 : 10} className="px-4 py-3"><div className="h-4 rounded bg-surface-hover" /></td>
              </tr>
            ))}
            {paged.map((row: any, i: number) => {
              const opening = row.opening || {};
              const receipts = row.receipts || {};
              const returns = row.returns || {};
              const issues = row.issues || {};
              const scrap = row.scrap || {};
              const adjustment = row.adjustment || {};
              const closing = row.closing || {};
              return (
                <tr key={row.code || i} className="border-b border-border">
                  <td className="table-cell tabular-nums text-xs text-ink-muted">{row.code}</td>
                  <td className="table-cell font-medium text-ink">{row.name}</td>
                  <td className="table-cell text-xs text-ink-muted">{row.category || '—'}</td>
                  <td className="table-cell text-xs text-ink-muted">{row.unit}</td>
                  <td className="table-cell text-right tabular-nums text-sm text-ink">{opening.quantity ?? 0}</td>
                  <td className="table-cell text-right tabular-nums text-sm text-success">{(receipts.quantity ?? 0) + (returns.quantity ?? 0)}</td>
                  {viewPrices && <td className="table-cell text-right tabular-nums text-xs text-ink-muted">{(receipts.amount ?? 0) + (returns.amount ?? 0) ? `¥${Number((receipts.amount ?? 0) + (returns.amount ?? 0)).toLocaleString()}` : '—'}</td>}
                  <td className="table-cell text-right tabular-nums text-sm text-danger">{-(issues.quantity ?? 0)}</td>
                  <td className="table-cell text-right tabular-nums text-sm text-danger">{-(scrap.quantity ?? 0)}</td>
                  {viewPrices && <td className="table-cell text-right tabular-nums text-xs text-ink-muted">{issues.amount ? `¥${Number(issues.amount).toLocaleString()}` : '—'}</td>}
                  <td className="table-cell text-right tabular-nums text-sm text-ink">{closing.quantity ?? 0}</td>
                  <td className="table-cell text-right tabular-nums text-xs text-ink-muted">{adjustment.quantity ?? 0}</td>
                  {viewPrices && <td className="table-cell text-right tabular-nums text-xs text-ink-muted">{closing.amount ? `¥${Number(closing.amount).toLocaleString()}` : '—'}</td>}
                </tr>
              );
            })}
            {!loading && !loadError && filtered.length === 0 && (
              <tr><td colSpan={viewPrices ? 13 : 10}><div className="empty-state">{t('page.materialsTooling.noData')}</div></td></tr>
            )}
          </tbody>
        </table>
        <Pagination
          page={currentPage}
          pageSize={MATERIALS_LEDGER_PAGE_SIZE}
          total={filtered.length}
          onPageChange={setPage}
        />
      </div>
      <ConfirmDialog
        open={showClosePeriodConfirm}
        title={t('page.materialsTooling.closePeriod')}
        description={t('page.materialsTooling.closePeriodConfirm', { month })}
        confirmLabel={t('page.materialsTooling.closePeriod')}
        busy={closingPeriod}
        onConfirm={closePeriod}
        onCancel={() => setShowClosePeriodConfirm(false)}
      />
    </div>
  );
}
