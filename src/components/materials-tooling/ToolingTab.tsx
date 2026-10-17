import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Icon from '../shared/Icon';
import SidePanel from '../shared/SidePanel';
import Pagination from '../shared/Pagination';
import { materialsToolingApi } from '../../lib/materials-tooling-api';
import type { MaterialsPermission } from '../../lib/materials-tooling-api';

const TOOLING_PAGE_SIZE = 10;
const TOOLING_MOVEMENTS_PAGE_SIZE = 10;

const STATUS_COLORS: Record<string, string> = {
  in_stock: 'bg-success-soft text-success',
  in_use: 'bg-brand-soft text-brand',
  loaned: 'bg-warning-soft text-warning',
  under_repair: 'bg-warning-soft text-warning',
  disposed: 'bg-surface-hover text-ink-muted',
  lost: 'bg-danger-soft text-danger',
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

export function ToolingTab({
  permissions,
  onStatsChange,
}: {
  permissions: MaterialsPermission | null;
  onStatsChange?: (stats: { filtered: number; total: number } | null) => void;
}) {
  const { t } = useTranslation();
  const [allTooling, setAllTooling] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ToolingForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [detailErrorId, setDetailErrorId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [movementPage, setMovementPage] = useState(1);

  const load = () => {
    setLoading(true);
    setLoadError(false);
    materialsToolingApi.listTooling()
      .then(data => setAllTooling(data.tooling))
      .catch(err => {
        setAllTooling([]);
        setLoadError(true);
        toast.error(err.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = statusFilter
    ? allTooling.filter(item => item.status === statusFilter)
    : allTooling;
  const pageCount = Math.max(1, Math.ceil(filtered.length / TOOLING_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice(
    (currentPage - 1) * TOOLING_PAGE_SIZE,
    currentPage * TOOLING_PAGE_SIZE,
  );
  const selectedMovements = selected?.movements ?? [];
  const movementPageCount = Math.max(1, Math.ceil(selectedMovements.length / TOOLING_MOVEMENTS_PAGE_SIZE));
  const currentMovementPage = Math.min(movementPage, movementPageCount);
  const pagedMovements = selectedMovements.slice(
    (currentMovementPage - 1) * TOOLING_MOVEMENTS_PAGE_SIZE,
    currentMovementPage * TOOLING_MOVEMENTS_PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    setPage(current => Math.min(current, pageCount));
  }, [pageCount]);

  useEffect(() => {
    setMovementPage(1);
  }, [selected?.id]);

  useEffect(() => {
    setMovementPage(current => Math.min(current, movementPageCount));
  }, [movementPageCount]);

  useEffect(() => {
    if (loading || loadError) return;
    onStatsChange?.({ filtered: filtered.length, total: allTooling.length });
  }, [loading, loadError, filtered.length, allTooling.length, onStatsChange]);

  const save = async () => {
    if (saving) return;
    if (!form.name || !form.category) {
      toast.error(t('page.materialsTooling.error.saveFailed'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        category: form.category,
        specification: form.specification,
        notes: form.notes,
      };
      if (editId) {
        await materialsToolingApi.updateTooling(editId, payload);
      } else {
        await materialsToolingApi.createTooling({
          tooling_code: form.tooling_code,
          ...payload,
          serial_number: form.serial_number,
          tracked_quantity: form.tracked_quantity,
        });
      }
      toast.success(t('page.materialsTooling.saved'));
      setShowForm(false);
      setEditId(null);
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
  const openEdit = (item: any): void => {
    setEditId(item.id);
    setForm({
      tooling_code: item.tooling_code || '',
      name: item.name || '',
      category: item.category || '',
      specification: item.specification || '',
      serial_number: item.serial_number || '',
      tracked_quantity: Number(item.tracked_quantity) || 1,
      notes: item.notes || '',
    });
    setShowForm(true);
  };
  const openDetail = async (id: string): Promise<void> => {
    setSelected(null);
    setDetailErrorId(null);
    try {
      const result = await materialsToolingApi.getTooling(id);
      setSelected(result.tooling);
    } catch (error) {
      setDetailErrorId(id);
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };
  const statusKey = (status: string): string => (
    status === 'in_stock' ? 'inStock' : status === 'in_use' ? 'inUse'
      : status === 'under_repair' ? 'underRepair' : status
  );

  return (
    <div>
      <div className="toolbar justify-between flex-wrap gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative w-full sm:w-44">
            <Icon name="filter" size="toolbar" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <select
              className="input pl-8 w-full"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              aria-label={t('page.materialsTooling.toolingTab')}
            >
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
              ))}
            </select>
          </div>
        </div>
        {canManage && (
          <button onClick={() => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); }} className="btn-primary btn-sm shrink-0">
            <Icon name="plus" size={15} className="mr-1.5" />{t('page.materialsTooling.addTooling')}
          </button>
        )}
      </div>

      <SidePanel
        open={showForm}
        onClose={() => {
          if (!saving) { setShowForm(false); setEditId(null); }
        }}
        title={editId ? t('common.edit') : t('common.create')}
        subtitle={editId ? form.tooling_code : t('page.materialsTooling.toolingTab')}
        width="w-[min(520px,calc(100vw-1rem))]"
      >
        <fieldset className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <legend className="sr-only">{t('common.create')}</legend>
          <div>
            <label className="label" htmlFor="materials-tooling-tooling-code">{t('page.materialsTooling.code')}</label>
            <input id="materials-tooling-tooling-code" className="input" value={form.tooling_code}
              onChange={e => setForm(f => ({ ...f, tooling_code: e.target.value }))}
              disabled={!!editId}
              placeholder={editId ? t('page.materialsTooling.code') : 'TLG-0001'} />
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
              onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))}
              disabled={!!editId} />
          </div>
          <div>
            <label className="label" htmlFor="materials-tooling-tooling-tracked-quantity">{t('page.materialsTooling.trackedQuantity')}</label>
            <input id="materials-tooling-tooling-tracked-quantity" className="input" type="number" min="1" step="1" value={form.tracked_quantity}
              onChange={e => setForm(f => ({ ...f, tracked_quantity: Number(e.target.value) }))}
              disabled={!!editId} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="materials-tooling-tooling-notes">{t('page.materialsTooling.notes')}</label>
            <input id="materials-tooling-tooling-notes" className="input" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </fieldset>
        <div className="sticky bottom-0 z-10 -mx-5 mt-4 flex gap-2 border-t border-border bg-surface px-5 pt-4">
          <button onClick={save} disabled={saving} className="btn-primary btn-sm">
            {saving ? t('common.loading') : editId ? t('common.save') : t('common.create')}
          </button>
          <button onClick={() => { setShowForm(false); setEditId(null); }} disabled={saving}
            className="btn-secondary btn-sm">{t('common.cancel')}</button>
        </div>
      </SidePanel>

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

      {detailErrorId && (
        <div className="data-surface mb-4 p-4" role="alert">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-muted">{t('page.error.loadFailed')}</p>
            <button type="button" onClick={() => { void openDetail(detailErrorId); }} className="btn-secondary btn-sm">
              {t('common.refresh')}
            </button>
          </div>
        </div>
      )}

      <div className="md:hidden">
        <div className="data-surface divide-y divide-border border-t-0 rounded-t-none">
          {loading && [0, 1, 2, 3, 4].map(row => (
            <div key={row} className="animate-pulse space-y-2 p-3">
              <div className="h-3 w-20 rounded bg-surface-hover" />
              <div className="h-3.5 w-2/3 rounded bg-surface-hover" />
              <div className="h-3 w-1/2 rounded bg-surface-hover" />
            </div>
          ))}
          {paged.map((item: any) => {
            const isTerminal = item.status === 'disposed' || item.status === 'lost';
            return (
              <article key={item.id} className={`p-3 ${isTerminal ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-2xs tabular-nums text-ink-muted">{item.tooling_code}</p>
                  <span className={`shrink-0 rounded px-2 py-0.5 text-2xs font-450 ${STATUS_COLORS[item.status] || 'bg-canvas text-ink-muted'}`}>
                    {t(`page.materialsTooling.toolingStatus.${statusKey(item.status)}`)}
                  </span>
                </div>
                <h3 className="mt-0.5 truncate text-sm font-medium text-ink">{item.name}</h3>
                <p className="mt-0.5 truncate text-xs text-ink-muted">
                  {item.category || '—'} · {item.specification || '—'}
                </p>
                <p className="mt-0.5 truncate text-xs text-ink-muted">
                  {item.location || '—'}{item.custodian_name ? ` · ${item.custodian_name}` : ''}{viewPrices && item.purchase_price != null ? ` · ¥${Number(item.purchase_price).toLocaleString()}` : ''}
                </p>
                <div className="mt-2 flex items-center justify-end gap-4 border-t border-border pt-2">
                  {canManage && <button className="text-xs font-medium text-brand" onClick={() => openEdit(item)}>{t('common.edit')}</button>}
                  <button className="text-xs font-medium text-brand" onClick={() => openDetail(item.id)}>{t('common.view')}</button>
                </div>
              </article>
            );
          })}
          {!loading && !loadError && filtered.length === 0 && <div className="empty-state">{t('page.materialsTooling.noData')}</div>}
          <Pagination
            page={currentPage}
            pageSize={TOOLING_PAGE_SIZE}
            total={filtered.length}
            onPageChange={setPage}
          />
        </div>
      </div>

      <div className="hidden data-surface overflow-x-auto border-t-0 rounded-t-none md:block">
        <table className="w-full">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-canvas">
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
              <tr key={row} className="animate-pulse border-b border-border">
                <td colSpan={viewPrices ? 9 : 8} className="px-4 py-3"><div className="h-4 rounded bg-surface-hover" /></td>
              </tr>
            ))}
            {paged.map((item: any) => {
              const isTerminal = item.status === 'disposed' || item.status === 'lost';
              return (
                <tr key={item.id} className={`border-b border-border ${isTerminal ? 'opacity-60' : ''}`}>
                  <td className="table-cell tabular-nums text-xs text-ink-muted">{item.tooling_code}</td>
                  <td className="table-cell font-medium text-ink">{item.name}</td>
                  <td className="table-cell text-xs text-ink-muted">{item.category || '—'}</td>
                  <td className="table-cell text-xs text-ink-muted max-w-[200px] truncate">{item.specification || '—'}</td>
                  <td className="table-cell">
                    <span className={`inline-flex px-2 py-0.5 rounded text-2xs font-450 ${STATUS_COLORS[item.status] || 'bg-canvas text-ink-muted'}`}>
                      {t(`page.materialsTooling.toolingStatus.${item.status === 'in_stock' ? 'inStock'
                        : item.status === 'in_use' ? 'inUse'
                        : item.status === 'under_repair' ? 'underRepair'
                        : item.status}`)}
                    </span>
                  </td>
                  <td className="table-cell text-xs text-ink-muted">{item.custodian_name || '—'}</td>
                  <td className="table-cell text-xs text-ink-muted max-w-[150px] truncate">{item.location || '—'}</td>
                  {viewPrices && item.purchase_price != null && (
                    <td className="table-cell text-right tabular-nums text-xs text-ink-muted">
                      ¥{Number(item.purchase_price).toLocaleString()}
                    </td>
                  )}
                  {viewPrices && item.purchase_price == null && (
                    <td className="table-cell text-right text-xs text-ink-subtle">—</td>
                  )}
                  <td className="table-cell text-right">
                    {canManage && <button className="mr-3 text-xs text-brand" onClick={() => openEdit(item)}>{t('common.edit')}</button>}
                    <button className="text-xs text-brand" onClick={() => openDetail(item.id)}>{t('common.view')}</button>
                  </td>
                </tr>
              );
            })}
            {!loading && !loadError && filtered.length === 0 && (
              <tr><td colSpan={viewPrices ? 9 : 8}><div className="empty-state">{t('page.materialsTooling.noData')}</div></td></tr>
            )}
          </tbody>
        </table>
        <Pagination
          page={currentPage}
          pageSize={TOOLING_PAGE_SIZE}
          total={filtered.length}
          onPageChange={setPage}
        />
      </div>
      <SidePanel
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.tooling_code} · ${selected.name}` : t('page.materialsTooling.toolingTab')}
        subtitle={selected?.specification || undefined}
        width="w-[min(720px,calc(100vw-1rem))]"
      >
        <div className="space-y-2 md:hidden">
          {pagedMovements.map((movement: any) => (
            <article key={movement.id} className="data-surface space-y-3 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xs text-ink-muted">{String(movement.created_at ?? '').slice(0, 10)}</p>
                  <p className="mt-1 text-sm font-medium tabular-nums text-ink">{movement.document_number || '-'}</p>
                </div>
                <span className="shrink-0 rounded bg-canvas px-2 py-0.5 text-2xs text-ink-muted">
                  {t(`page.materialsTooling.toolingAction.${movement.movement_type}`)}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
                <div className="col-span-2">
                  <dt className="section-label">{t('page.materialsTooling.statusLabel')}</dt>
                  <dd className="mt-1 break-words text-ink">
                    {movement.from_status ? t(`page.materialsTooling.toolingStatus.${statusKey(movement.from_status)}`) : '-'} → {t(`page.materialsTooling.toolingStatus.${statusKey(movement.to_status)}`)}
                  </dd>
                </div>
                <div>
                  <dt className="section-label">{t('page.materialsTooling.custodian')}</dt>
                  <dd className="mt-1 break-words text-ink">{movement.to_custodian_name || '-'}</dd>
                </div>
                <div>
                  <dt className="section-label">{t('page.materialsTooling.location')}</dt>
                  <dd className="mt-1 break-words text-ink">{movement.to_location || '-'}</dd>
                </div>
              </dl>
            </article>
          ))}
          {selectedMovements.length === 0 && <div className="empty-state">{t('page.materialsTooling.noData')}</div>}
          <Pagination
            page={currentMovementPage}
            pageSize={TOOLING_MOVEMENTS_PAGE_SIZE}
            total={selectedMovements.length}
            onPageChange={setMovementPage}
          />
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
            {pagedMovements.map((movement: any) => <tr key={movement.id} className="border-b border-border">
              <td className="table-cell">{String(movement.created_at ?? '').slice(0, 10)}</td>
              <td className="table-cell">{movement.document_number || '-'}</td>
              <td className="table-cell">{t(`page.materialsTooling.toolingAction.${movement.movement_type}`)}</td>
              <td className="table-cell">{movement.from_status ? t(`page.materialsTooling.toolingStatus.${statusKey(movement.from_status)}`) : '-'} → {t(`page.materialsTooling.toolingStatus.${statusKey(movement.to_status)}`)}</td>
              <td className="table-cell">{movement.to_custodian_name || '-'}</td>
              <td className="table-cell">{movement.to_location || '-'}</td>
            </tr>)}
            {selectedMovements.length === 0 && <tr><td colSpan={6}><div className="empty-state">{t('page.materialsTooling.noData')}</div></td></tr>}
          </tbody></table>
          <Pagination
            page={currentMovementPage}
            pageSize={TOOLING_MOVEMENTS_PAGE_SIZE}
            total={selectedMovements.length}
            onPageChange={setMovementPage}
          />
        </div>
      </SidePanel>
    </div>
  );
}
