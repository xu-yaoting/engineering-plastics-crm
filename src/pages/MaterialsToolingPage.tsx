import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../components/shared/Icon';
import type { MaterialsPermission, Overview, LowStockItem, CurrentMonthSummary } from '../lib/materials-tooling-api';
import { MaterialsTab } from '../components/materials-tooling/MaterialsTab';
import { DocumentsTab } from '../components/materials-tooling/DocumentsTab';
import { LedgerTab } from '../components/materials-tooling/LedgerTab';
import { ToolingTab } from '../components/materials-tooling/ToolingTab';
import { ApprovalsTab } from '../components/materials-tooling/ApprovalsTab';
import { MaterialsSettings } from '../components/materials-tooling/MaterialsSettings';

type Tab = 'overview' | 'materials' | 'documents' | 'ledger' | 'tooling' | 'approvals' | 'settings';

const TABS: { key: Tab; labelKey: string }[] = [
  { key: 'overview', labelKey: 'page.materialsTooling.overviewTab' },
  { key: 'materials', labelKey: 'page.materialsTooling.materialsTab' },
  { key: 'documents', labelKey: 'page.materialsTooling.documentsTab' },
  { key: 'ledger', labelKey: 'page.materialsTooling.ledgerTab' },
  { key: 'tooling', labelKey: 'page.materialsTooling.toolingTab' },
  { key: 'approvals', labelKey: 'page.materialsTooling.approvalsTab' },
  { key: 'settings', labelKey: 'page.materialsTooling.settingsTab' },
];

export default function MaterialsToolingPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('overview');
  const [permissions, setPermissions] = useState<MaterialsPermission | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeTab = TABS.find(item => item.key === tab);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch('/api/materials-tooling/me').then(r => r.json()),
      fetch('/api/materials-tooling/overview').then(r => r.json()),
    ]).then(([meData, overviewData]) => {
      setPermissions(meData.permissions);
      setOverview(overviewData.overview);
    }).catch(err => {
      setError(err instanceof Error ? err.message : 'Load failed');
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-heading">{t('nav.materialsTooling')}</h1>
          <p className="page-summary">{activeTab ? t(activeTab.labelKey) : ''}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200" role="tablist" aria-label={t('nav.materialsTooling')}>
        {TABS.map(item => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            role="tab"
            aria-selected={tab === item.key}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
              tab === item.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
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
      {tab === 'tooling' && <ToolingTab permissions={permissions} />}
      {tab === 'approvals' && <ApprovalsTab permissions={permissions} />}
      {tab === 'settings' && <MaterialsSettings permissions={permissions} />}
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
              <div className="h-3 w-16 rounded bg-gray-100" />
              <div className="mt-2 h-6 w-12 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Icon name="warning" size={24} className="text-red-500" />
        <p className="text-sm text-gray-600">{error}</p>
        <button onClick={onRetry} className="btn-secondary btn-sm">
          {t('common.retry') || 'Retry'}
        </button>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Icon name="package" size={24} className="text-gray-300" />
        <p className="text-sm text-gray-500">{t('page.materialsTooling.noData')}</p>
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
            overview.pendingApprovals > 0 ? 'text-amber-600' : 'text-gray-900'
          }`}>
            {overview.pendingApprovals}
          </div>
        </div>
        <div className="metric-cell">
          <div className="section-label">{t('page.materialsTooling.lowStockItems')}</div>
          <div className={`mt-1 text-2xl font-semibold tabular-nums ${
            overview.lowStockItems.length > 0 ? 'text-red-600' : 'text-green-600'
          }`}>
            {overview.lowStockItems.length}
          </div>
        </div>
        <div className="metric-cell">
          <div className="section-label">{t('page.materialsTooling.monthlyReceipts')}</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">
            {overview.currentMonth.receiptQuantity.toLocaleString()}
          </div>
          {viewPrices && overview.currentMonth.receiptAmount != null && (
            <div className="text-xs text-gray-400 mt-0.5 tabular-nums">
              ¥{Number(overview.currentMonth.receiptAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          )}
        </div>
        <div className="metric-cell">
          <div className="section-label">{t('page.materialsTooling.monthlyIssues')}</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">
            {overview.currentMonth.issueQuantity.toLocaleString()}
          </div>
          {viewPrices && overview.currentMonth.issueReferenceAmount != null && (
            <div className="text-xs text-gray-400 mt-0.5 tabular-nums">
              ¥{Number(overview.currentMonth.issueReferenceAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          )}
        </div>
      </div>

      {/* Overdue tooling count */}
      {overview.overdueToolingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
          <Icon name="warning" size={16} className="text-amber-600" />
          <span className="text-amber-800 font-medium">
            {t('page.materialsTooling.overdueToolingCount', { count: overview.overdueToolingCount })}
          </span>
        </div>
      )}

      {/* Low stock items */}
      {overview.lowStockItems.length > 0 && (
        <div className="data-surface overflow-x-auto">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="section-label text-red-700">{t('page.materialsTooling.lowStockAlerts')}</h3>
          </div>
          <div className="space-y-2 p-3 md:hidden">
            {overview.lowStockItems.map((item: LowStockItem) => (
              <article key={item.id} className="rounded-md border border-red-100 bg-red-50/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-2xs tabular-nums text-gray-500">{item.code}</p>
                    <h4 className="mt-1 break-words text-sm font-medium text-gray-900">{item.name}</h4>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-red-600">
                    {item.current_quantity} {item.unit}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-red-100 pt-3 text-sm">
                  <div>
                    <dt className="section-label">{t('page.materialsTooling.currentQty')}</dt>
                    <dd className="mt-1 tabular-nums text-red-600">{item.current_quantity}</dd>
                  </div>
                  <div>
                    <dt className="section-label">{t('page.materialsTooling.safetyQty')}</dt>
                    <dd className="mt-1 tabular-nums text-gray-700">{item.safety_quantity}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="table-header">{t('page.materialsTooling.code')}</th>
                  <th className="table-header">{t('page.materialsTooling.name')}</th>
                  <th className="table-header text-right">{t('page.materialsTooling.currentQty')}</th>
                  <th className="table-header text-right">{t('page.materialsTooling.safetyQty')}</th>
                  <th className="table-header">{t('page.materialsTooling.unit')}</th>
                </tr>
              </thead>
              <tbody>
                {overview.lowStockItems.map((item: LowStockItem) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="table-cell tabular-nums text-xs text-gray-500">{item.code}</td>
                    <td className="table-cell font-medium text-gray-900">{item.name}</td>
                    <td className="table-cell text-right tabular-nums text-sm text-red-600 font-semibold">
                      {item.current_quantity}
                    </td>
                    <td className="table-cell text-right tabular-nums text-xs text-gray-500">
                      {item.safety_quantity}
                    </td>
                    <td className="table-cell text-xs text-gray-500">{item.unit}</td>
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
