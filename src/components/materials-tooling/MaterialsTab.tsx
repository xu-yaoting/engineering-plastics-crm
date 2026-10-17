import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Icon from '../shared/Icon';
import SidePanel from '../shared/SidePanel';
import Pagination from '../shared/Pagination';
import ConfirmDialog from '../shared/ConfirmDialog';
import { materialsToolingApi } from '../../lib/materials-tooling-api';
import type { MaterialsPermission } from '../../lib/materials-tooling-api';

const MATERIALS_PAGE_SIZE = 10;

type ItemForm = {
  code: string; name: string; category: string; specification: string;
  unit: string; warehouse: string; bin_location: string;
  safety_quantity: number; notes: string;
};
type ImportPreview = {
  items: Array<{ code: string; unit: string; quantity: number; unitPrice?: number }>;
  missingItems: string[];
  errors: string[];
  warnings: string[];
};
type AdjustmentForm = {
  systemQuantity: string;
  countedQuantity: string;
  reason: string;
};

const EMPTY_FORM: ItemForm = {
  code: '', name: '', category: '', specification: '', unit: 'pc',
  warehouse: '', bin_location: '', safety_quantity: 5, notes: '',
};
const EMPTY_ADJUSTMENT_FORM: AdjustmentForm = {
  systemQuantity: '0', countedQuantity: '0', reason: '',
};

export function MaterialsTab({ permissions }: { permissions: MaterialsPermission | null }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMonth, setImportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importError, setImportError] = useState(false);
  const [importRetry, setImportRetry] = useState<'preview' | 'confirm' | null>(null);
  const [importing, setImporting] = useState(false);
  const [adjustmentItem, setAdjustmentItem] = useState<any | null>(null);
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentForm>(EMPTY_ADJUSTMENT_FORM);
  const [adjustmentSaving, setAdjustmentSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError(false);
    materialsToolingApi.listItems()
      .then(data => setItems(data.items))
      .catch(err => {
        setItems([]);
        setLoadError(true);
        toast.error(err.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = search
    ? items.filter(item =>
        (item.code || '').toLowerCase().includes(search.toLowerCase())
        || (item.name || '').toLowerCase().includes(search.toLowerCase())
        || (item.category || '').toLowerCase().includes(search.toLowerCase()))
    : items;
  const pageCount = Math.max(1, Math.ceil(filtered.length / MATERIALS_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice(
    (currentPage - 1) * MATERIALS_PAGE_SIZE,
    currentPage * MATERIALS_PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    setPage(current => Math.min(current, pageCount));
  }, [pageCount]);

  const save = async () => {
    if (saving) return;
    if (!form.name || !form.category || !form.unit) {
      toast.error(t('page.materialsTooling.error.saveFailed'));
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        const { code, ...updateData } = form;
        await materialsToolingApi.updateItem(editId, updateData);
        toast.success(t('page.materialsTooling.saved'));
      } else {
        await materialsToolingApi.createItem(form);
        toast.success(t('page.materialsTooling.saved'));
      }
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

  const edit = (item: any) => {
    setEditId(item.id);
    setForm({
      code: item.code, name: item.name, category: item.category,
      specification: item.specification || '', unit: item.unit,
      warehouse: item.warehouse || '', bin_location: item.bin_location || '',
      safety_quantity: item.safety_quantity || 0, notes: item.notes || '',
    });
    setShowForm(true);
  };

  const remove = async (): Promise<void> => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await materialsToolingApi.deleteItem(deleteTarget.id);
      toast.success(t('common.delete'));
      setDeleteTarget(null);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('page.materialsTooling.error.saveFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const openAdjustment = (item: any): void => {
    const currentQuantity = String(item.current_quantity ?? 0);
    setAdjustmentItem(item);
    setAdjustmentForm({ systemQuantity: currentQuantity, countedQuantity: currentQuantity, reason: '' });
  };

  const saveAdjustment = async (): Promise<void> => {
    if (!adjustmentItem || adjustmentSaving) return;
    const systemQuantity = Number(adjustmentForm.systemQuantity);
    const countedQuantity = Number(adjustmentForm.countedQuantity);
    if (!Number.isFinite(systemQuantity) || systemQuantity < 0
      || !Number.isFinite(countedQuantity) || countedQuantity < 0) {
      toast.error(t('page.materialsTooling.error.saveFailed'));
      return;
    }
    const adjustmentDelta = countedQuantity - systemQuantity;
    if (Math.abs(adjustmentDelta) < Number.EPSILON) {
      toast.error(t('page.materialsTooling.error.saveFailed'));
      return;
    }
    setAdjustmentSaving(true);
    try {
      const quantity = Math.abs(adjustmentDelta);
      const reason = adjustmentForm.reason.trim();
      const created = await materialsToolingApi.createDocument({
        document_type: 'count_adjustment',
        request_date: new Date().toISOString().slice(0, 10),
        purpose: reason || undefined,
        lines: [{
          material_item_id: adjustmentItem.id,
          requested_quantity: quantity,
          execution_quantity: quantity,
          unit: adjustmentItem.unit,
          system_quantity: systemQuantity,
          counted_quantity: countedQuantity,
          adjustment_delta: adjustmentDelta,
          notes: reason || undefined,
        }],
      });
      const submitted = await materialsToolingApi.submitDocument(created.document.id);
      if (submitted.document.status !== 'pending_execution') {
        throw new Error(t('page.materialsTooling.status.pendingExecution'));
      }
      await materialsToolingApi.executeDocument(created.document.id);
      toast.success(t('page.materialsTooling.status.executed'));
      setAdjustmentItem(null);
      setAdjustmentForm(EMPTY_ADJUSTMENT_FORM);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('page.materialsTooling.error.saveFailed'));
    } finally {
      setAdjustmentSaving(false);
    }
  };

  const previewImport = async (): Promise<void> => {
    if (!importFile || importing) return;
    setImporting(true);
    setImportError(false);
    setImportRetry('preview');
    try {
      const data = new FormData();
      data.set('file', importFile);
      const preview = await materialsToolingApi.previewCutoverImport(data) as ImportPreview;
      setImportPreview(preview);
      setImportError(false);
    } catch (error) {
      setImportError(true);
      toast.error(error instanceof Error ? error.message : String(error));
    }
    finally { setImporting(false); }
  };

  const confirmImport = async (): Promise<void> => {
    if (!importFile || !importPreview || importPreview.errors.length || importPreview.missingItems.length || importing) return;
    setImporting(true);
    setImportError(false);
    setImportRetry('confirm');
    try {
      const data = new FormData();
      data.set('file', importFile);
      data.set('month', importMonth);
      data.set('sourceWorkbook', importFile.name);
      data.set('confirm', 'true');
      const result = await materialsToolingApi.confirmCutoverImport(data);
      toast.success(t('page.materialsTooling.importCreated', { count: result.created }));
      setShowImport(false); setImportFile(null); setImportPreview(null); load();
      setImportError(false);
    } catch (error) {
      setImportError(true);
      toast.error(error instanceof Error ? error.message : String(error));
    }
    finally { setImporting(false); }
  };

  const viewPrices = permissions?.viewPrices ?? false;

  return (
    <div>
      <div className="toolbar justify-between mb-4 md:mb-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Icon name="search" size="toolbar" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <label className="sr-only" htmlFor="materials-tooling-material-search">{t('common.search')}</label>
            <input
              id="materials-tooling-material-search"
              className="input pl-8 w-64"
              placeholder={t('common.search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <span className="text-xs text-ink-muted tabular-nums">{t('common.records')}: {items.length}</span>
        </div>
        <div className="flex gap-2">
          {permissions?.manageMaterials && <button onClick={() => { setShowImport(value => !value); setImportPreview(null); }} className="btn-secondary btn-sm">{t('page.materialsTooling.openingImport')}</button>}
          {permissions?.manageMaterials && <button onClick={() => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); }} className="btn-primary btn-sm">
            <Icon name="plus" size={15} className="mr-1.5" />{t('page.materialsTooling.materials')}
          </button>}
        </div>
      </div>

      {showImport && <div className="data-surface p-4 mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="label min-w-0">{t('page.materialsTooling.cutoverMonth')}<input type="month" className="input mt-1 w-full min-w-0" value={importMonth} onChange={event => setImportMonth(event.target.value)} /></label>
          <label className="label min-w-0">{t('page.materialsTooling.sourceWorkbook')}<input type="file" accept=".xlsx,.xls" className="input mt-1 w-full min-w-0" onChange={event => { setImportFile(event.target.files?.[0] ?? null); setImportPreview(null); }} /></label>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button className="btn-secondary btn-sm w-full sm:w-auto" disabled={!importFile || importing} onClick={previewImport}>{t('page.materialsTooling.previewImport')}</button>
          <button className="btn-primary btn-sm w-full sm:w-auto" disabled={!importPreview || importPreview.errors.length > 0 || importPreview.missingItems.length > 0 || importing} onClick={confirmImport}>{t('page.materialsTooling.confirmImport')}</button>
        </div>
        {importError && <div className="mt-3 rounded border border-danger/30 bg-danger-soft px-3 py-2" role="alert">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-danger">{t('page.error.loadFailed')}</p>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => {
                if (importRetry === 'preview') void previewImport();
                if (importRetry === 'confirm') void confirmImport();
              }}
            >{t('common.refresh')}</button>
          </div>
        </div>}
        {importPreview && <div className="mt-3 text-sm">
          <p>{t('page.materialsTooling.validImportRows', { count: importPreview.items.length })}</p>
          {importPreview.errors.map(error => <p key={error} className="text-danger">{error}</p>)}
          {importPreview.missingItems.length > 0 && <p className="text-danger">{t('page.materialsTooling.missingItems')}: {importPreview.missingItems.join(', ')}</p>}
          {importPreview.warnings.map(warning => <p key={warning} className="text-warning">{warning}</p>)}
        </div>}
      </div>}

      <SidePanel
        open={showForm}
        onClose={() => {
          if (!saving) {
            setShowForm(false);
            setEditId(null);
          }
        }}
        title={editId ? t('common.edit') : t('common.create')}
        subtitle={editId ? form.code : t('page.materialsTooling.materials')}
        width="w-[min(520px,calc(100vw-1rem))]"
      >
        <fieldset className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <legend className="sr-only">{editId ? t('common.edit') : t('common.create')}</legend>
          <div>
            <label className="label" htmlFor="materials-tooling-material-code">{t('page.materialsTooling.code')}{editId ? ' *' : ''}</label>
            <input id="materials-tooling-material-code" className="input" value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
              disabled={!!editId}
              placeholder={editId ? t('page.materialsTooling.code') : 'MAT-0001'} />
          </div>
          <div>
            <label className="label" htmlFor="materials-tooling-material-name">{t('page.materialsTooling.name')} *</label>
            <input id="materials-tooling-material-name" className="input" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="materials-tooling-material-category">{t('page.materialsTooling.category')}</label>
            <input id="materials-tooling-material-category" className="input" value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="materials-tooling-material-unit">{t('page.materialsTooling.unit')} *</label>
            <select id="materials-tooling-material-unit" className="input" value={form.unit}
              onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
              <option value="pc">pc</option><option value="kg">kg</option>
              <option value="m">m</option><option value="sheet">sheet</option>
              <option value="bottle">bottle</option><option value="pair">pair</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="materials-tooling-material-specification">{t('page.materialsTooling.specification')}</label>
            <input id="materials-tooling-material-specification" className="input" value={form.specification}
              onChange={e => setForm(f => ({ ...f, specification: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="materials-tooling-material-safety-quantity">{t('page.materialsTooling.safetyQty')}</label>
            <input id="materials-tooling-material-safety-quantity" className="input" type="number" min="0" step="0.01" value={form.safety_quantity}
              onChange={e => setForm(f => ({ ...f, safety_quantity: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="materials-tooling-material-notes">{t('page.materialsTooling.notes')}</label>
            <input id="materials-tooling-material-notes" className="input" value={form.notes}
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

      <SidePanel
        open={!!adjustmentItem}
        onClose={() => { if (!adjustmentSaving) setAdjustmentItem(null); }}
        title={t('page.materialsTooling.documentType.count_adjustment')}
        subtitle={adjustmentItem ? `${adjustmentItem.code} · ${adjustmentItem.name}` : ''}
        width="w-[min(520px,calc(100vw-1rem))]"
      >
        {adjustmentItem && <>
          <fieldset className="space-y-3">
            <legend className="sr-only">{t('page.materialsTooling.documentType.count_adjustment')}</legend>
            <label className="label" htmlFor="materials-tooling-adjustment-system-quantity">
              {t('page.materialsTooling.systemQuantity')}
              <input id="materials-tooling-adjustment-system-quantity" className="input mt-1" type="number" min="0" step="any" value={adjustmentForm.systemQuantity} readOnly />
            </label>
            <label className="label" htmlFor="materials-tooling-adjustment-counted-quantity">
              {t('page.materialsTooling.countedQuantity')}
              <input id="materials-tooling-adjustment-counted-quantity" className="input mt-1" type="number" min="0" step="any" value={adjustmentForm.countedQuantity} onChange={event => setAdjustmentForm(value => ({ ...value, countedQuantity: event.target.value }))} />
            </label>
            <label className="label" htmlFor="materials-tooling-adjustment-reason">
              {t('page.materialsTooling.reason')}
              <input id="materials-tooling-adjustment-reason" className="input mt-1" value={adjustmentForm.reason} onChange={event => setAdjustmentForm(value => ({ ...value, reason: event.target.value }))} />
            </label>
          </fieldset>
          <div className="sticky bottom-0 z-10 -mx-5 mt-4 flex gap-2 border-t border-border bg-surface px-5 pt-4">
            <button onClick={saveAdjustment} disabled={adjustmentSaving} className="btn-primary btn-sm">
              {adjustmentSaving ? t('common.loading') : t('page.materialsTooling.execute')}
            </button>
            <button onClick={() => setAdjustmentItem(null)} disabled={adjustmentSaving} className="btn-secondary btn-sm">
              {t('common.cancel')}
            </button>
          </div>
        </>}
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
        {paged.map((item: any) => {
          const lowStock = item.safety_quantity > 0 && item.current_quantity < item.safety_quantity;
          return (
            <article key={item.id} className="data-surface space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs tabular-nums text-ink-muted">{item.code}</p>
                  <h3 className="break-words font-medium text-ink">{item.name}</h3>
                </div>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-2xs font-450 ${
                  item.is_active ? 'bg-success-soft text-success' : 'bg-surface-hover text-ink-muted'
                }`}>
                  {t(item.is_active ? 'page.materialsTooling.active' : 'page.materialsTooling.inactive')}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div className="min-w-0">
                  <dt className="section-label">{t('page.materialsTooling.category')}</dt>
                  <dd className="truncate text-ink">{item.category || '—'}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="section-label">{t('page.materialsTooling.unit')}</dt>
                  <dd className="text-ink">{item.unit}</dd>
                </div>
                <div>
                  <dt className="section-label">{t('page.materialsTooling.currentQty')}</dt>
                  <dd className={`tabular-nums ${lowStock ? 'font-semibold text-danger' : 'text-ink'}`}>
                    {item.current_quantity ?? 0}
                  </dd>
                </div>
                <div>
                  <dt className="section-label">{t('page.materialsTooling.safetyQty')}</dt>
                  <dd className="tabular-nums text-ink">{item.safety_quantity || '—'}</dd>
                </div>
                {viewPrices && (
                  <div>
                    <dt className="section-label">{t('page.materialsTooling.purchasePrice')}</dt>
                    <dd className="tabular-nums text-ink">
                      {item.purchaseSummary?.unitPrice
                        ? `¥${Number(item.purchaseSummary.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                        : '—'}
                    </dd>
                  </div>
                )}
              </dl>
              <div className="flex justify-end border-t border-border pt-3">
                {permissions?.manageMaterials && <button onClick={() => openAdjustment(item)} className="mr-4 text-xs font-medium text-warning hover:underline">
                  {t('page.materialsTooling.documentType.count_adjustment')}
                </button>}
                {permissions?.manageMaterials && <button onClick={() => setDeleteTarget(item)} className="mr-4 text-xs font-medium text-danger hover:underline">
                  {t('common.delete')}
                </button>}
                <button onClick={() => edit(item)} className="text-xs font-medium text-brand hover:underline">
                  {t('common.edit')}
                </button>
              </div>
            </article>
          );
        })}
        {!loading && !loadError && filtered.length === 0 && <div className="empty-state">{t('page.materialsTooling.noData')}</div>}
        <Pagination
          page={currentPage}
          pageSize={MATERIALS_PAGE_SIZE}
          total={filtered.length}
          onPageChange={setPage}
        />
      </div>

      <div className="hidden data-surface overflow-x-auto border-t-0 rounded-t-none md:block">
        <table className="w-full">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-canvas">
              <th className="table-header">{t('page.materialsTooling.code')}</th>
              <th className="table-header">{t('page.materialsTooling.name')}</th>
              <th className="table-header">{t('page.materialsTooling.category')}</th>
              <th className="table-header text-right">{t('page.materialsTooling.currentQty')}</th>
              <th className="table-header text-right">{t('page.materialsTooling.safetyQty')}</th>
              <th className="table-header">{t('page.materialsTooling.unit')}</th>
              {viewPrices && <th className="table-header text-right">{t('page.materialsTooling.purchasePrice')}</th>}
              <th className="table-header">{t('page.materialsTooling.statusLabel')}</th>
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
              const lowStock = item.safety_quantity > 0 && item.current_quantity < item.safety_quantity;
              return (
                <tr key={item.id} className="border-b border-border">
                  <td className="table-cell tabular-nums text-xs text-ink-muted">{item.code}</td>
                  <td className="table-cell font-medium text-ink">{item.name}</td>
                  <td className="table-cell text-xs text-ink-muted">{item.category || '—'}</td>
                  <td className={`table-cell text-right tabular-nums text-sm ${lowStock ? 'text-danger font-semibold' : 'text-ink'}`}>
                    {item.current_quantity ?? 0}
                  </td>
                  <td className="table-cell text-right tabular-nums text-xs text-ink-muted">
                    {item.safety_quantity || '—'}
                  </td>
                  <td className="table-cell text-xs text-ink-muted">{item.unit}</td>
                  {viewPrices && (
                    <td className="table-cell text-right tabular-nums text-xs text-ink-muted">
                      {item.purchaseSummary?.unitPrice
                        ? `¥${Number(item.purchaseSummary.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                  )}
                  <td className="table-cell">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-2xs font-450 ${
                      item.is_active ? 'bg-success-soft text-success' : 'bg-surface-hover text-ink-muted'
                    }`}>
                      {t(item.is_active ? 'page.materialsTooling.active' : 'page.materialsTooling.inactive')}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    {permissions?.manageMaterials && <button onClick={() => openAdjustment(item)} className="mr-3 text-xs text-warning hover:underline">{t('page.materialsTooling.documentType.count_adjustment')}</button>}
                    {permissions?.manageMaterials && <button onClick={() => setDeleteTarget(item)} className="mr-3 text-xs text-danger hover:underline">{t('common.delete')}</button>}
                    <button onClick={() => edit(item)} className="text-xs text-brand hover:underline">{t('common.edit')}</button>
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
          pageSize={MATERIALS_PAGE_SIZE}
          total={filtered.length}
          onPageChange={setPage}
        />
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('common.delete')}
        description={<>{t('common.confirmDelete')} {deleteTarget?.name || deleteTarget?.code || ''}</>}
        busy={deleting}
        onConfirm={remove}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
      />
    </div>
  );
}
