import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Icon from '../shared/Icon';
import SidePanel from '../shared/SidePanel';
import { materialsToolingApi } from '../../lib/materials-tooling-api';
import type { MaterialsPermission } from '../../lib/materials-tooling-api';

const STATUS_COLORS: Record<string, string> = {
  in_stock: 'bg-green-50 text-green-600',
  in_use: 'bg-blue-50 text-blue-600',
  loaned: 'bg-amber-50 text-amber-600',
  under_repair: 'bg-yellow-50 text-yellow-600',
  disposed: 'bg-gray-100 text-gray-500',
  lost: 'bg-red-50 text-red-600',
};

const STATUS_OPTIONS = [
  { value: '', labelKey: 'page.materialsTooling.toolingStatus.all' },
  { value: 'in_stock', labelKey: 'page.materialsTooling.toolingStatus.inStock' },
  { value: 'in_use', labelKey: 'page.materialsTooling.toolingStatus.inUse' },
  { value: 'loaned', labelKey: 'page.materialsTooling.toolingStatus.loaned' },
  { value: 'under_repair', labelKey: 'page.materialsTooling.toolingStatus.underRepair' },
  { value: 'disposed', labelKey: 'page.materialsTooling.toolingStatus.disposed' },
  { value: 'lost', labelKey: 'page.materialsTooling.toolingStatus.lost' },
];

type ToolingForm = {
  tooling_code: string; name: string; category: string; specification: string;
  serial_number: string; tracked_quantity: number;
  notes: string;
};

const EMPTY_FORM: ToolingForm = {
  tooling_code: '', name: '', category: '', specification: '',
  serial_number: '', tracked_quantity: 1, notes: '',
};

export function ToolingTab({ permissions }: { permissions: MaterialsPermission | null }) {
  const { t } = useTranslation();
  const [allTooling, setAllTooling] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ToolingForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const load = () => {
    setLoading(true);
    materialsToolingApi.listTooling()
      .then(data => setAllTooling(data.tooling))
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = statusFilter
    ? allTooling.filter(item => item.status === statusFilter)
    : allTooling;

  const save = async () => {
    if (saving) return;
    if (!form.tooling_code || !form.name || !form.category) {
      toast.error(t('page.materialsTooling.error.saveFailed'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tooling_code: form.tooling_code,
        name: form.name,
        category: form.category,
        specification: form.specification,
        serial_number: form.serial_number,
        tracked_quantity: form.tracked_quantity,
        notes: form.notes,
      };
      await materialsToolingApi.createTooling(payload);
      toast.success(t('page.materialsTooling.saved'));
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('page.materialsTooling.error.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const canManage = permissions?.manageMaterials ?? false;
  const viewPrices = permissions?.viewPrices ?? false;
  const openDetail = async (id: string): Promise<void> => {
    try {
      const result = await materialsToolingApi.getTooling(id);
      setSelected(result.tooling);
    } catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
  };
  const statusKey = (status: string): string => (
    status === 'in_stock' ? 'inStock' : status === 'in_use' ? 'inUse'
      : status === 'under_repair' ? 'underRepair' : status
  );

  return (
    <div>
      <div className="toolbar mb-4 justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Icon name="filter" size="toolbar" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              className="input pl-8 w-44"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              aria-label={t('page.materialsTooling.toolingTab')}
            >
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
              ))}
            </select>
          </div>
          <span className="text-xs text-gray-500 tabular-nums">{t('common.records')}: {allTooling.length}</span>
        </div>
        {canManage && (
          <button onClick={() => { setForm(EMPTY_FORM); setShowForm(true); }} className="btn-primary btn-sm">
            <Icon name="plus" size={15} className="mr-1.5" />{t('page.materialsTooling.toolingTab')}
          </button>
        )}
      </div>

      <SidePanel
        open={showForm}
        onClose={() => {
          if (!saving) setShowForm(false);
        }}
        title={t('common.create')}
        subtitle={t('page.materialsTooling.toolingTab')}
        width="w-[min(520px,calc(100vw-1rem))]"
      >
        <fieldset className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <legend className="sr-only">{t('common.create')}</legend>
          <div>
            <label className="label" htmlFor="materials-tooling-tooling-code">{t('page.materialsTooling.code')} *</label>
            <input id="materials-tooling-tooling-code" className="input" value={form.tooling_code}
              onChange={e => setForm(f => ({ ...f, tooling_code: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="materials-tooling-tooling-name">{t('page.materialsTooling.name')} *</label>
            <input id="materials-tooling-tooling-name" className="input" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="materials-tooling-tooling-category">{t('page.materialsTooling.category')}</label>
            <input id="materials-tooling-tooling-category" className="input" value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="materials-tooling-tooling-specification">{t('page.materialsTooling.specification')}</label>
            <input id="materials-tooling-tooling-specification" className="input" value={form.specification}
              onChange={e => setForm(f => ({ ...f, specification: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="materials-tooling-tooling-serial-number">{t('page.materialsTooling.serialNumber')}</label>
            <input id="materials-tooling-tooling-serial-number" className="input" value={form.serial_number}
              onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="materials-tooling-tooling-tracked-quantity">{t('page.materialsTooling.trackedQuantity')}</label>
            <input id="materials-tooling-tooling-tracked-quantity" className="input" type="number" min="1" step="1" value={form.tracked_quantity}
              onChange={e => setForm(f => ({ ...f, tracked_quantity: Number(e.target.value) }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="materials-tooling-tooling-notes">{t('page.materialsTooling.notes')}</label>
            <input id="materials-tooling-tooling-notes" className="input" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </fieldset>
        <div className="sticky bottom-0 z-10 -mx-5 mt-4 flex gap-2 border-t border-gray-200 bg-white px-5 pt-4">
          <button onClick={save} disabled={saving} className="btn-primary btn-sm">
            {saving ? t('common.loading') : t('common.create')}
          </button>
          <button onClick={() => { setShowForm(false); }} disabled={saving}
            className="btn-secondary btn-sm">{t('common.cancel')}</button>
        </div>
      </SidePanel>

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
        {filtered.map((item: any) => {
          const isTerminal = item.status === 'disposed' || item.status === 'lost';
          return (
            <article key={item.id} className={`data-surface space-y-3 p-4 ${isTerminal ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs tabular-nums text-gray-500">{item.tooling_code}</p>
                  <h3 className="break-words font-medium text-gray-900">{item.name}</h3>
                </div>
                <span className={`shrink-0 rounded px-2 py-0.5 text-2xs font-450 ${STATUS_COLORS[item.status] || 'bg-gray-50 text-gray-500'}`}>
                  {t(`page.materialsTooling.toolingStatus.${item.status === 'in_stock' ? 'inStock'
                    : item.status === 'in_use' ? 'inUse'
                    : item.status === 'under_repair' ? 'underRepair'
                    : item.status}`)}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div className="min-w-0">
                  <dt className="section-label">{t('page.materialsTooling.category')}</dt>
                  <dd className="truncate text-gray-700">{item.category || '—'}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="section-label">{t('page.materialsTooling.specification')}</dt>
                  <dd className="truncate text-gray-700">{item.specification || '—'}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="section-label">{t('page.materialsTooling.custodian')}</dt>
                  <dd className="truncate text-gray-700">{item.custodian_user_id || '—'}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="section-label">{t('page.materialsTooling.location')}</dt>
                  <dd className="truncate text-gray-700">{item.location || '—'}</dd>
                </div>
                {viewPrices && (
                  <div>
                    <dt className="section-label">{t('page.materialsTooling.purchasePrice')}</dt>
                    <dd className="tabular-nums text-gray-700">
                      {item.purchase_price != null ? `¥${Number(item.purchase_price).toLocaleString()}` : '—'}
                    </dd>
                  </div>
                )}
              </dl>
              <div className="flex justify-end border-t border-gray-100 pt-3">
                <button className="text-xs font-medium text-blue-600" onClick={() => openDetail(item.id)}>{t('common.view')}</button>
              </div>
            </article>
          );
        })}
        {!loading && filtered.length === 0 && <div className="empty-state">{t('page.materialsTooling.noData')}</div>}
      </div>

      <div className="hidden data-surface overflow-x-auto md:block">
        <table className="w-full">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="table-header">{t('page.materialsTooling.code')}</th>
              <th className="table-header">{t('page.materialsTooling.name')}</th>
              <th className="table-header">{t('page.materialsTooling.category')}</th>
              <th className="table-header">{t('page.materialsTooling.specification')}</th>
              <th className="table-header">{t('page.materialsTooling.statusLabel')}</th>
              <th className="table-header">{t('page.materialsTooling.custodian')}</th>
              <th className="table-header">{t('page.materialsTooling.location')}</th>
              {viewPrices && <th className="table-header text-right">{t('page.materialsTooling.purchasePrice')}</th>}
              <th className="table-header"></th>
            </tr>
          </thead>
          <tbody>
            {loading && [0, 1, 2].map(row => (
              <tr key={row} className="animate-pulse border-b border-gray-100">
                <td colSpan={viewPrices ? 9 : 8} className="px-4 py-3"><div className="h-4 rounded bg-gray-100" /></td>
              </tr>
            ))}
            {filtered.map((item: any) => {
              const isTerminal = item.status === 'disposed' || item.status === 'lost';
              return (
                <tr key={item.id} className={`border-b border-gray-100 ${isTerminal ? 'opacity-60' : ''}`}>
                  <td className="table-cell tabular-nums text-xs text-gray-500">{item.tooling_code}</td>
                  <td className="table-cell font-medium text-gray-900">{item.name}</td>
                  <td className="table-cell text-xs text-gray-500">{item.category || '—'}</td>
                  <td className="table-cell text-xs text-gray-500 max-w-[200px] truncate">{item.specification || '—'}</td>
                  <td className="table-cell">
                    <span className={`inline-flex px-2 py-0.5 rounded text-2xs font-450 ${STATUS_COLORS[item.status] || 'bg-gray-50 text-gray-500'}`}>
                      {t(`page.materialsTooling.toolingStatus.${item.status === 'in_stock' ? 'inStock'
                        : item.status === 'in_use' ? 'inUse'
                        : item.status === 'under_repair' ? 'underRepair'
                        : item.status}`)}
                    </span>
                  </td>
                  <td className="table-cell text-xs text-gray-500">{item.custodian_user_id || '—'}</td>
                  <td className="table-cell text-xs text-gray-500 max-w-[150px] truncate">{item.location || '—'}</td>
                  {viewPrices && item.purchase_price != null && (
                    <td className="table-cell text-right tabular-nums text-xs text-gray-500">
                      ¥{Number(item.purchase_price).toLocaleString()}
                    </td>
                  )}
                  {viewPrices && item.purchase_price == null && (
                    <td className="table-cell text-right text-xs text-gray-400">—</td>
                  )}
                  <td className="table-cell text-right"><button className="text-xs text-blue-600" onClick={() => openDetail(item.id)}>{t('common.view')}</button></td>
                </tr>
              );
            })}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={viewPrices ? 9 : 8}><div className="empty-state">{t('page.materialsTooling.noData')}</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
      <SidePanel
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.tooling_code} · ${selected.name}` : t('page.materialsTooling.toolingTab')}
        subtitle={selected?.specification || undefined}
        width="w-[min(720px,calc(100vw-1rem))]"
      >
        <div className="space-y-2 md:hidden">
          {(selected?.movements ?? []).map((movement: any) => (
            <article key={movement.id} className="data-surface space-y-3 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xs text-gray-500">{String(movement.created_at ?? '').slice(0, 10)}</p>
                  <p className="mt-1 text-sm font-medium tabular-nums text-gray-900">{movement.document_number || '-'}</p>
                </div>
                <span className="shrink-0 rounded bg-gray-50 px-2 py-0.5 text-2xs text-gray-600">
                  {t(`page.materialsTooling.toolingAction.${movement.movement_type}`)}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 text-sm">
                <div className="col-span-2">
                  <dt className="section-label">{t('page.materialsTooling.statusLabel')}</dt>
                  <dd className="mt-1 break-words text-gray-700">
                    {movement.from_status ? t(`page.materialsTooling.toolingStatus.${statusKey(movement.from_status)}`) : '-'} → {t(`page.materialsTooling.toolingStatus.${statusKey(movement.to_status)}`)}
                  </dd>
                </div>
                <div>
                  <dt className="section-label">{t('page.materialsTooling.custodian')}</dt>
                  <dd className="mt-1 break-words text-gray-700">{movement.to_custodian_name || '-'}</dd>
                </div>
                <div>
                  <dt className="section-label">{t('page.materialsTooling.location')}</dt>
                  <dd className="mt-1 break-words text-gray-700">{movement.to_location || '-'}</dd>
                </div>
              </dl>
            </article>
          ))}
          {(selected?.movements ?? []).length === 0 && <div className="empty-state">{t('page.materialsTooling.noData')}</div>}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full"><thead><tr>
            <th className="table-header">{t('page.materialsTooling.requestDate')}</th>
            <th className="table-header">{t('page.materialsTooling.code')}</th>
            <th className="table-header">{t('page.materialsTooling.action')}</th>
            <th className="table-header">{t('page.materialsTooling.statusLabel')}</th>
            <th className="table-header">{t('page.materialsTooling.custodian')}</th>
            <th className="table-header">{t('page.materialsTooling.location')}</th>
          </tr></thead><tbody>
            {(selected?.movements ?? []).map((movement: any) => <tr key={movement.id} className="border-b border-gray-100">
              <td className="table-cell">{String(movement.created_at ?? '').slice(0, 10)}</td>
              <td className="table-cell">{movement.document_number || '-'}</td>
              <td className="table-cell">{t(`page.materialsTooling.toolingAction.${movement.movement_type}`)}</td>
              <td className="table-cell">{movement.from_status ? t(`page.materialsTooling.toolingStatus.${statusKey(movement.from_status)}`) : '-'} → {t(`page.materialsTooling.toolingStatus.${statusKey(movement.to_status)}`)}</td>
              <td className="table-cell">{movement.to_custodian_name || '-'}</td>
              <td className="table-cell">{movement.to_location || '-'}</td>
            </tr>)}
            {(selected?.movements ?? []).length === 0 && <tr><td colSpan={6}><div className="empty-state">{t('page.materialsTooling.noData')}</div></td></tr>}
          </tbody></table>
        </div>
      </SidePanel>
    </div>
  );
}
