import { useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../components/shared/Icon';
import type { MaterialsPermission, Overview, LowStockItem, CurrentMonthSummary } from '../lib/materials-tooling-api';
import { MaterialsTab } from '../components/materials-tooling/MaterialsTab';
import { DocumentsTab } from '../components/materials-tooling/DocumentsTab';
import { LedgerTab } from '../components/materials-tooling/LedgerTab';
import { ToolingTab } from '../components/materials-tooling/ToolingTab';

type Tab = 'overview' | 'materials' | 'documents' | 'ledger' | 'tooling';

const TABS: { key: Tab; labelKey: string }[] = [
  { key: 'overview', labelKey: 'page.materialsTooling.overviewTab' },
  { key: 'materials', labelKey: 'page.materialsTooling.materialsTab' },
  { key: 'documents', labelKey: 'page.materialsTooling.documentsTab' },
  { key: 'ledger', labelKey: 'page.materialsTooling.ledgerTab' },
  { key: 'tooling', labelKey: 'page.materialsTooling.toolingTab' },
];

export default function MaterialsToolingPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('overview');
  const [permissions, setPermissions] = useState<MaterialsPermission | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toolingStats, setToolingStats] = useState<{ filtered: number; total: number } | null>(null);

  const activeTab = TABS.find(item => item.key === tab);

  const handleToolingStats = useCallback((next: { filtered: number; total: number } | null): void => {
    setToolingStats(prev => (
      prev?.filtered === next?.filtered && prev?.total === next?.total ? prev : next
    ));
  }, []);

  const summaryText = tab === 'tooling' && toolingStats
    ? `${toolingStats.filtered !== toolingStats.total ? `${toolingStats.filtered} / ` : ''}${t('page.materialsTooling.toolingCount', { count: toolingStats.total })}`
    : activeTab ? t(activeTab.labelKey) : '';

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch('/api/materials-tooling/me').then(async res => {
        if (!res.ok) throw new Error(`Materials permissions request failed: ${res.status}`);
        return res.json();
      }),
      fetch('/api/materials-tooling/overview').then(async res => {
        if (!res.ok) throw new Error(`Materials overview request failed: ${res.status}`);
        return res.json();
      }),
    ]).then(([meData, overviewData]) => {
      setPermissions(meData.permissions);
      setOverview(overviewData.overview);
    }).catch(err => {
      setPermissions(null);
      setOverview(null);
      setError(err instanceof Error ? err.message : t('page.error.loadFailed'));
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="px-3">
          <h1 className="page-heading">{t('nav.materialsTooling')}</h1>
          <p className="page-summary tabular-nums">{summaryText}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist" aria-label={t('nav.materialsTooling')}>
        {TABS.map(item => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            role="tab"
            aria-selected={tab === item.key}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
              tab === item.key
                ? 'border-brand text-brand'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <OverviewTab
          overview={overview}
          permissions={permissions}
          loading={loading}
          error={error}
          onRetry={load}
        />
      )}
      {tab === 'materials' && <MaterialsTab permissions={permissions} />}
      {tab === 'documents' && <DocumentsTab />}
      {tab === 'ledger' && <LedgerTab permissions={permissions} />}
      {tab === 'tooling' && <ToolingTab permissions={permissions} onStatsChange={handleToolingStats} />}
    </div>
  );
}

// ─── Overview Tab ───

function OverviewTab({
  overview,
  permissions,
  loading,
  error,
  onRetry,
}: {
  overview: Overview | null;
  permissions: MaterialsPermission | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const { t } = useTranslation();

  if (loading && !overview) {
    return (
      <div className="space-y-4 mt-4">
        <div className="metric-strip grid-cols-2 sm:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="metric-cell animate-pulse">
              <div className="h-3 w-16 rounded bg-surface-hover" />
              <div className="mt-2 h-6 w-12 rounded bg-surface-hover" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Icon name="warning" size={24} className="text-danger" />
        <p className="text-sm text-ink-muted">{error}</p>
        <button onClick={onRetry} className="btn-secondary btn-sm">
          {t('common.refresh')}
        </button>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Icon name="package" size={24} className="text-ink-subtle" />
        <p className="text-sm text-ink-muted">{t('page.materialsTooling.noData')}</p>
      </div>
    );
  }

  const viewPrices = permissions?.viewPrices ?? false;

  return (
    <div className="space-y-6">
      {/* Key metrics strip */}
      <div className="metric-strip grid-cols-2 sm:grid-cols-4">
        <div className="metric-cell">
          <div className="section-label">{t('page.materialsTooling.pendingApprovals')}</div>
          <div className={`mt-1 text-2xl font-semibold tabular-nums ${
            overview.pendingApprovals > 0 ? 'text-warning' : 'text-ink'
          }`}>
            {overview.pendingApprovals}
          </div>
        </div>
        <div className="metric-cell">
          <div className="section-label">{t('page.materialsTooling.lowStockItems')}</div>
          <div className={`mt-1 text-2xl font-semibold tabular-nums ${
            overview.lowStockItems.length > 0 ? 'text-danger' : 'text-success'
          }`}>
            {overview.lowStockItems.length}
          </div>
        </div>
        <div className="metric-cell">
          <div className="section-label">{t('page.materialsTooling.monthlyReceipts')}</div>
          <div className="mt-1 text-2xl font-semibold text-ink tabular-nums">
            {overview.currentMonth.receiptQuantity.toLocaleString()}
          </div>
          {viewPrices && overview.currentMonth.receiptAmount != null && (
            <div className="text-xs text-ink-subtle mt-0.5 tabular-nums">
              ¥{Number(overview.currentMonth.receiptAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          )}
        </div>
        <div className="metric-cell">
          <div className="section-label">{t('page.materialsTooling.monthlyIssues')}</div>
          <div className="mt-1 text-2xl font-semibold text-ink tabular-nums">
            {overview.currentMonth.issueQuantity.toLocaleString()}
          </div>
          {viewPrices && overview.currentMonth.issueReferenceAmount != null && (
            <div className="text-xs text-ink-subtle mt-0.5 tabular-nums">
              ¥{Number(overview.currentMonth.issueReferenceAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          )}
        </div>
      </div>

      {/* Overdue tooling count */}
      {overview.overdueToolingCount > 0 && (
        <div className="bg-warning-soft border border-warning rounded-lg px-4 py-3 text-sm flex items-center gap-2">
          <Icon name="warning" size={16} className="text-warning" />
          <span className="text-warning font-medium">
            {t('page.materialsTooling.overdueToolingCount', { count: overview.overdueToolingCount })}
          </span>
        </div>
      )}

      {/* Low stock items */}
      {overview.lowStockItems.length > 0 && (
        <div className="data-surface overflow-x-auto">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="section-label text-danger">{t('page.materialsTooling.lowStockAlerts')}</h3>
          </div>
          <div className="space-y-2 p-3 md:hidden">
            {overview.lowStockItems.map((item: LowStockItem) => (
              <article key={item.id} className="rounded-md border border-danger bg-danger-soft/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-2xs tabular-nums text-ink-muted">{item.code}</p>
                    <h4 className="mt-1 break-words text-sm font-medium text-ink">{item.name}</h4>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-danger">
                    {item.current_quantity} {item.unit}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-danger pt-3 text-sm">
                  <div>
                    <dt className="section-label">{t('page.materialsTooling.currentQty')}</dt>
                    <dd className="mt-1 tabular-nums text-danger">{item.current_quantity}</dd>
                  </div>
                  <div>
                    <dt className="section-label">{t('page.materialsTooling.safetyQty')}</dt>
                    <dd className="mt-1 tabular-nums text-ink">{item.safety_quantity}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-canvas">
                  <th className="table-header">{t('page.materialsTooling.code')}</th>
                  <th className="table-header">{t('page.materialsTooling.name')}</th>
                  <th className="table-header text-right">{t('page.materialsTooling.currentQty')}</th>
                  <th className="table-header text-right">{t('page.materialsTooling.safetyQty')}</th>
                  <th className="table-header">{t('page.materialsTooling.unit')}</th>
                </tr>
              </thead>
              <tbody>
                {overview.lowStockItems.map((item: LowStockItem) => (
                  <tr key={item.id} className="border-b border-border">
                    <td className="table-cell tabular-nums text-xs text-ink-muted">{item.code}</td>
                    <td className="table-cell font-medium text-ink">{item.name}</td>
                    <td className="table-cell text-right tabular-nums text-sm text-danger font-semibold">
                      {item.current_quantity}
                    </td>
                    <td className="table-cell text-right tabular-nums text-xs text-ink-muted">
                      {item.safety_quantity}
                    </td>
                    <td className="table-cell text-xs text-ink-muted">{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
