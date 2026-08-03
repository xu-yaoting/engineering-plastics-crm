import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { auth } from '../../lib/api';
import { materialsToolingApi } from '../../lib/materials-tooling-api';
import type { MaterialsPermission } from '../../lib/materials-tooling-api';

const DOCUMENT_TYPES = [
  'purchase_request', 'purchase_receipt', 'material_issue',
  'material_return', 'scrap', 'count_adjustment', 'tooling_movement',
];

export function MaterialsSettings({ permissions: _permissions }: { permissions: MaterialsPermission | null }) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<any[]>([]);
  const [approvalConfig, setApprovalConfig] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [savingApprover, setSavingApprover] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const load = async (): Promise<void> => {
    setLoading(true);
    try {
      const me = await auth.me();
      const administrator = me.user.role === 'admin';
      setIsAdmin(administrator);
      if (!administrator) return;
      const [permsData, configData] = await Promise.all([
        materialsToolingApi.getPermissions(), materialsToolingApi.getApprovalConfig(),
      ]);
      setUsers(permsData.users || []);
      setApprovalConfig(configData.config || []);
    } catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const toggleUserPermission = async (userId: string, field: string, currentValue: boolean) => {
    setSavingUserId(userId);
    try {
      await materialsToolingApi.updatePermissions(userId, {
        manageMaterials: field === 'manageMaterials' ? !currentValue : !!users.find((u: any) => u.id === userId)?.permissions?.manageMaterials,
        approve: field === 'approve' ? !currentValue : !!users.find((u: any) => u.id === userId)?.permissions?.approve,
        viewPrices: field === 'viewPrices' ? !currentValue : !!users.find((u: any) => u.id === userId)?.permissions?.viewPrices,
        managePeriods: field === 'managePeriods' ? !currentValue : !!users.find((u: any) => u.id === userId)?.permissions?.managePeriods,
      });
      toast.success(t('page.materialsTooling.saved'));
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('page.materialsTooling.error.saveFailed'));
    } finally {
      setSavingUserId(null);
    }
  };

  const updateApprover = async (docType: string, userId: string) => {
    setSavingApprover(docType);
    try {
      await materialsToolingApi.updateApprovalConfig(docType, { approverUserId: userId });
      toast.success(t('page.materialsTooling.saved'));
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('page.materialsTooling.error.saveFailed'));
    } finally {
      setSavingApprover(null);
    }
  };

  if (isAdmin === false) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <p className="text-sm text-gray-500">{t('page.materialsTooling.error.unauthorized')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="data-surface p-4 animate-pulse">
            <div className="h-4 w-32 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Permissions */}
      <div className="space-y-2 md:hidden">
        <div className="px-1">
          <h3 className="section-label">{t('page.materialsTooling.permissionsTitle')}</h3>
        </div>
        {users.map((user: any) => {
          const p = user.permissions || {};
          const permissionRows = [
            { field: 'manageMaterials', label: t('page.materialsTooling.manageMaterialsPermission'), enabled: !!p.manageMaterials },
            { field: 'approve', label: t('page.materialsTooling.approvePermission'), enabled: !!p.approve },
            { field: 'viewPrices', label: t('page.materialsTooling.viewPricesPermission'), enabled: !!p.viewPrices },
            { field: 'managePeriods', label: t('page.materialsTooling.managePeriodsPermission'), enabled: !!p.managePeriods },
          ];
          return (
            <article key={user.id} className="data-surface space-y-3 p-4">
              <h4 className="font-medium text-gray-900">{user.name}</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {permissionRows.map(permission => (
                  <label key={permission.field} className="flex min-h-10 items-center justify-between gap-3 rounded border border-gray-200 px-3 py-2 text-sm text-gray-700">
                    <span>{permission.label}</span>
                    <input
                      id={`materials-settings-${user.id}-${permission.field}-mobile`}
                      type="checkbox"
                      checked={permission.enabled}
                      onChange={() => toggleUserPermission(user.id, permission.field, permission.enabled)}
                      disabled={savingUserId === user.id}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                ))}
              </div>
            </article>
          );
        })}
        {users.length === 0 && <div className="empty-state">{t('page.materialsTooling.noData')}</div>}
      </div>

      <div className="hidden data-surface overflow-x-auto md:block">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="section-label">{t('page.materialsTooling.permissionsTitle')}</h3>
        </div>
        <table className="w-full">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="table-header">{t('page.materialsTooling.name')}</th>
              <th className="table-header text-center">{t('page.materialsTooling.manageMaterialsPermission')}</th>
              <th className="table-header text-center">{t('page.materialsTooling.approvePermission')}</th>
              <th className="table-header text-center">{t('page.materialsTooling.viewPricesPermission')}</th>
              <th className="table-header text-center">{t('page.materialsTooling.managePeriodsPermission')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user: any) => {
              const p = user.permissions || {};
              return (
                <tr key={user.id} className="border-b border-gray-100">
                  <td className="table-cell font-medium text-gray-900">{user.name}</td>
                  <td className="table-cell text-center">
                    <label className="sr-only" htmlFor={`materials-settings-${user.id}-manage-materials`}>
                      {user.name}: {t('page.materialsTooling.manageMaterialsPermission')}
                    </label>
                    <input
                      id={`materials-settings-${user.id}-manage-materials`}
                      type="checkbox"
                      checked={!!p.manageMaterials}
                      onChange={() => toggleUserPermission(user.id, 'manageMaterials', !!p.manageMaterials)}
                      disabled={savingUserId === user.id}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="table-cell text-center">
                    <label className="sr-only" htmlFor={`materials-settings-${user.id}-approve`}>
                      {user.name}: {t('page.materialsTooling.approvePermission')}
                    </label>
                    <input
                      id={`materials-settings-${user.id}-approve`}
                      type="checkbox"
                      checked={!!p.approve}
                      onChange={() => toggleUserPermission(user.id, 'approve', !!p.approve)}
                      disabled={savingUserId === user.id}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="table-cell text-center">
                    <label className="sr-only" htmlFor={`materials-settings-${user.id}-view-prices`}>
                      {user.name}: {t('page.materialsTooling.viewPricesPermission')}
                    </label>
                    <input
                      id={`materials-settings-${user.id}-view-prices`}
                      type="checkbox"
                      checked={!!p.viewPrices}
                      onChange={() => toggleUserPermission(user.id, 'viewPrices', !!p.viewPrices)}
                      disabled={savingUserId === user.id}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="table-cell text-center">
                    <label className="sr-only" htmlFor={`materials-settings-${user.id}-manage-periods`}>
                      {user.name}: {t('page.materialsTooling.managePeriodsPermission')}
                    </label>
                    <input
                      id={`materials-settings-${user.id}-manage-periods`}
                      type="checkbox"
                      checked={!!p.managePeriods}
                      onChange={() => toggleUserPermission(user.id, 'managePeriods', !!p.managePeriods)}
                      disabled={savingUserId === user.id}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr><td colSpan={5}><div className="empty-state">{t('page.materialsTooling.noData')}</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Approval Configuration */}
      <div className="space-y-2 md:hidden">
        <div className="px-1">
          <h3 className="section-label">{t('page.materialsTooling.approvalConfiguration')}</h3>
        </div>
        {DOCUMENT_TYPES.map((docType: string) => {
          const config = approvalConfig.find((entry: any) => entry.documentType === docType);
          const currentApproverId = config?.approver?.id || '';
          return (
            <article key={docType} className="data-surface space-y-2 p-4">
              <div>
                <p className="section-label">{t('page.materialsTooling.documentTypeLabel')}</p>
                <h4 className="font-medium text-gray-900">{t(`page.materialsTooling.documentType.${docType}`)}</h4>
              </div>
              <label className="label" htmlFor={`materials-settings-approver-${docType}-mobile`}>
                {t('page.materialsTooling.approver')}
              </label>
              <select
                id={`materials-settings-approver-${docType}-mobile`}
                className="input w-full text-sm"
                value={currentApproverId}
                onChange={e => updateApprover(docType, e.target.value)}
                disabled={savingApprover === docType}
              >
                <option value="">{t('page.materialsTooling.selectApprover')}</option>
                {users.filter((user: any) => user.role === 'admin' || user.permissions?.approve).map((user: any) => (
                  <option key={user.id} value={user.id}>
                    {user.name} {user.role === 'admin' ? `(${t('userMenu.administrator')})` : ''}
                  </option>
                ))}
              </select>
              {savingApprover === docType && <span className="text-xs text-gray-400">{t('common.loading')}</span>}
            </article>
          );
        })}
      </div>

      <div className="hidden data-surface overflow-x-auto md:block">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="section-label">{t('page.materialsTooling.approvalConfiguration')}</h3>
        </div>
        <table className="w-full">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="table-header">{t('page.materialsTooling.documentTypeLabel')}</th>
              <th className="table-header">{t('page.materialsTooling.approver')}</th>
            </tr>
          </thead>
          <tbody>
            {DOCUMENT_TYPES.map((docType: string) => {
                  const config = approvalConfig.find((entry: any) => entry.documentType === docType);
                  const currentApproverId = config?.approver?.id || '';
              return (
                <tr key={docType} className="border-b border-gray-100">
                  <td className="table-cell text-xs text-gray-500">{t(`page.materialsTooling.documentType.${docType}`)}</td>
                  <td className="table-cell">
                    <label className="sr-only" htmlFor={`materials-settings-approver-${docType}`}>
                      {t(`page.materialsTooling.documentType.${docType}`)}: {t('page.materialsTooling.approver')}
                    </label>
                    <select
                      id={`materials-settings-approver-${docType}`}
                      className="input max-w-[200px] text-xs"
                      value={currentApproverId}
                      onChange={e => updateApprover(docType, e.target.value)}
                      disabled={savingApprover === docType}
                    >
                      <option value="">{t('page.materialsTooling.selectApprover')}</option>
                      {users.filter((user: any) => user.role === 'admin' || user.permissions?.approve).map((user: any) => (
                        <option key={user.id} value={user.id}>
                          {user.name} {user.role === 'admin' ? `(${t('userMenu.administrator')})` : ''}
                        </option>
                      ))}
                    </select>
                    {savingApprover === docType && (
                      <span className="text-xs text-gray-400 ml-2">{t('common.loading')}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
