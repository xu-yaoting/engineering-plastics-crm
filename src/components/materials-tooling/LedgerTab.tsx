import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Icon from '../shared/Icon';
import ConfirmDialog from '../shared/ConfirmDialog';
import { materialsToolingApi } from '../../lib/materials-tooling-api';
import type { MaterialsPermission } from '../../lib/materials-tooling-api';

export function LedgerTab({ permissions }: { permissions: MaterialsPermission | null }) {
  const { t } = useTranslation();
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [month, setMonth] = useState(defaultMonth);
  const [search, setSearch] = useState('');
  const [ledger, setLedger] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingXlsx, setDownloadingXlsx] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showClosePeriodConfirm, setShowClosePeriodConfirm] = useState(false);
  const [closingPeriod, setClosingPeriod] = useState(false);

  const viewPrices = permissions?.viewPrices ?? false;
  const canManagePeriods = permissions?.managePeriods ?? false;

  const load = () => {
    setLoading(true);
    materialsToolingApi.listLedger(month)
      .then(data => setLedger(data.ledger))
      .catch(err => toast.error(err.message))
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

  return (
    <div>
      <div className="toolbar mb-4 justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Icon name="calendar" size="toolbar" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
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
            isClosed ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-600'
          }`}>
            {isClosed
              ? t('page.materialsTooling.periodClosed')
              : t('page.materialsTooling.periodOpen')}
          </span>
          <div className="relative">
            <Icon name="search" size="toolbar" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
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
            <button onClick={() => setShowClosePeriodConfirm(true)} className="btn-secondary btn-sm text-amber-600">
              {t('page.materialsTooling.closePeriod')}
            </button>
          )}
          {canManagePeriods && isClosed && (
            <button onClick={reopenPeriod} className="btn-secondary btn-sm text-red-600">
              {t('page.materialsTooling.reopenPeriod')}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2 md:hidden">
        {loading && [0, 1, 2].map(row => (
          <div key={row} className="data-surface animate-pulse p-4">
            <div className="h-4 w-2/3 rounded bg-gray-100" />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="h-3 rounded bg-gray-100" />
              <div className="h-3 rounded bg-gray-100" />
              <div className="h-3 rounded bg-gray-100" />
              <div className="h-3 rounded bg-gray-100" />
            </div>
          </div>
        ))}
        {filtered.map((row: any, i: number) => {
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
                <p className="truncate text-xs tabular-nums text-gray-500">{row.code}</p>
                <h3 className="break-words font-medium text-gray-900">{row.name}</h3>
                <p className="truncate text-xs text-gray-500">{row.category || '—'} · {row.unit}</p>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="section-label">{t('page.materialsTooling.openingQty')}</dt>
                  <dd className="tabular-nums text-gray-900">{opening.quantity ?? 0}</dd>
                </div>
                <div>
                  <dt className="section-label">{t('page.materialsTooling.closingQty')}</dt>
                  <dd className="tabular-nums font-medium text-gray-900">{closing.quantity ?? 0}</dd>
                </div>
                <div>
                  <dt className="section-label">{t('page.materialsTooling.receiptQty')}</dt>
                  <dd className="tabular-nums text-green-600">{receiptQuantity}</dd>
                </div>
                <div>
                  <dt className="section-label">{t('page.materialsTooling.issueQty')}</dt>
                  <dd className="tabular-nums text-red-600">{-(issues.quantity ?? 0)}</dd>
                </div>
                <div>
                  <dt className="section-label">{t('page.materialsTooling.scrapQty')}</dt>
                  <dd className="tabular-nums text-red-600">{-(scrap.quantity ?? 0)}</dd>
                </div>
                <div>
                  <dt className="section-label">{t('page.materialsTooling.adjustmentQty')}</dt>
                  <dd className="tabular-nums text-gray-700">{adjustment.quantity ?? 0}</dd>
                </div>
              </dl>
              {viewPrices && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gray-100 pt-3 text-sm">
                  <div>
                    <dt className="section-label">{t('page.materialsTooling.receiptAmount')}</dt>
                    <dd className="tabular-nums text-gray-700">{receiptAmount ? `¥${Number(receiptAmount).toLocaleString()}` : '—'}</dd>
                  </div>
                  <div>
                    <dt className="section-label">{t('page.materialsTooling.issueAmount')}</dt>
                    <dd className="tabular-nums text-gray-700">{issues.amount ? `¥${Number(issues.amount).toLocaleString()}` : '—'}</dd>
                  </div>
                  <div>
                    <dt className="section-label">{t('page.materialsTooling.closingAmount')}</dt>
                    <dd className="tabular-nums text-gray-700">{closing.amount ? `¥${Number(closing.amount).toLocaleString()}` : '—'}</dd>
                  </div>
                </dl>
              )}
            </article>
          );
        })}
        {!loading && filtered.length === 0 && <div className="empty-state">{t('page.materialsTooling.noData')}</div>}
      </div>

      <div className="hidden data-surface overflow-x-auto md:block">
        <table className="w-full" style={{ minWidth: '900px' }}>
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-gray-200 bg-gray-50">
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
              <tr key={row} className="animate-pulse border-b border-gray-100">
                <td colSpan={viewPrices ? 13 : 10} className="px-4 py-3"><div className="h-4 rounded bg-gray-100" /></td>
              </tr>
            ))}
            {filtered.map((row: any, i: number) => {
              const opening = row.opening || {};
              const receipts = row.receipts || {};
              const returns = row.returns || {};
              const issues = row.issues || {};
              const scrap = row.scrap || {};
              const adjustment = row.adjustment || {};
              const closing = row.closing || {};
              return (
                <tr key={row.code || i} className="border-b border-gray-100">
                  <td className="table-cell tabular-nums text-xs text-gray-500">{row.code}</td>
                  <td className="table-cell font-medium text-gray-900">{row.name}</td>
                  <td className="table-cell text-xs text-gray-500">{row.category || '—'}</td>
                  <td className="table-cell text-xs text-gray-500">{row.unit}</td>
                  <td className="table-cell text-right tabular-nums text-sm text-gray-900">{opening.quantity ?? 0}</td>
                  <td className="table-cell text-right tabular-nums text-sm text-green-600">{(receipts.quantity ?? 0) + (returns.quantity ?? 0)}</td>
                  {viewPrices && <td className="table-cell text-right tabular-nums text-xs text-gray-500">{(receipts.amount ?? 0) + (returns.amount ?? 0) ? `¥${Number((receipts.amount ?? 0) + (returns.amount ?? 0)).toLocaleString()}` : '—'}</td>}
                  <td className="table-cell text-right tabular-nums text-sm text-red-600">{-(issues.quantity ?? 0)}</td>
                  <td className="table-cell text-right tabular-nums text-sm text-red-600">{-(scrap.quantity ?? 0)}</td>
                  {viewPrices && <td className="table-cell text-right tabular-nums text-xs text-gray-500">{issues.amount ? `¥${Number(issues.amount).toLocaleString()}` : '—'}</td>}
                  <td className="table-cell text-right tabular-nums text-sm text-gray-900">{closing.quantity ?? 0}</td>
                  <td className="table-cell text-right tabular-nums text-xs text-gray-500">{adjustment.quantity ?? 0}</td>
                  {viewPrices && <td className="table-cell text-right tabular-nums text-xs text-gray-500">{closing.amount ? `¥${Number(closing.amount).toLocaleString()}` : '—'}</td>}
                </tr>
              );
            })}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={viewPrices ? 13 : 10}><div className="empty-state">{t('page.materialsTooling.noData')}</div></td></tr>
            )}
          </tbody>
        </table>
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
