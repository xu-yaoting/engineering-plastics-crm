import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Icon from '../shared/Icon';
import SidePanel from '../shared/SidePanel';
import { materialsToolingApi } from '../../lib/materials-tooling-api';
import type { MaterialsPermission } from '../../lib/materials-tooling-api';

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

const EMPTY_FORM: ItemForm = {
  code: '', name: '', category: '', specification: '', unit: 'pc',
  warehouse: '', bin_location: '', safety_quantity: 0, notes: '',
};

export function MaterialsTab({ permissions }: { permissions: MaterialsPermission | null }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMonth, setImportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);

  const load = () => {
    setLoading(true);
    materialsToolingApi.listItems()
      .then(data => setItems(data.items))
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = search
    ? items.filter(item =>
        (item.code || '').toLowerCase().includes(search.toLowerCase())
        || (item.name || '').toLowerCase().includes(search.toLowerCase())
        || (item.category || '').toLowerCase().includes(search.toLowerCase()))
    : items;

  const save = async () => {
    if (saving) return;
    if (!form.code || !form.name || !form.category || !form.unit) {
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

  const previewImport = async (): Promise<void> => {
    if (!importFile || importing) return;
    setImporting(true);
    try {
      const data = new FormData();
      data.set('file', importFile);
      const preview = await materialsToolingApi.previewCutoverImport(data) as ImportPreview;
      setImportPreview(preview);
    } catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
    finally { setImporting(false); }
  };

  const confirmImport = async (): Promise<void> => {
    if (!importFile || !importPreview || importPreview.errors.length || importPreview.missingItems.length || importing) return;
    setImporting(true);
    try {
      const data = new FormData();
      data.set('file', importFile);
      data.set('month', importMonth);
      data.set('sourceWorkbook', importFile.name);
      data.set('confirm', 'true');
      const result = await materialsToolingApi.confirmCutoverImport(data);
      toast.success(t('page.materialsTooling.importCreated', { count: result.created }));
      setShowImport(false); setImportFile(null); setImportPreview(null); load();
    } catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
    finally { setImporting(false); }
  };

  const viewPrices = permissions?.viewPrices ?? false;

  return (
    <div>
      <div className="toolbar mb-4 justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Icon name="search" size="toolbar" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <label className="sr-only" htmlFor="materials-tooling-material-search">{t('common.search')}</label>
            <input
              id="materials-tooling-material-search"
              className="input pl-8 w-64"
              placeholder={t('common.search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <span className="text-xs text-gray-500 tabular-nums">{t('common.records')}: {items.length}</span>
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
        {importPreview && <div className="mt-3 text-sm">
          <p>{t('page.materialsTooling.validImportRows', { count: importPreview.items.length })}</p>
          {importPreview.errors.map(error => <p key={error} className="text-red-600">{error}</p>)}
          {importPreview.missingItems.length > 0 && <p className="text-red-600">{t('page.materialsTooling.missingItems')}: {importPreview.missingItems.join(', ')}</p>}
          {importPreview.warnings.map(warning => <p key={warning} className="text-amber-600">{warning}</p>)}
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
            <label className="label" htmlFor="materials-tooling-material-code">{t('page.materialsTooling.code')} *</label>
            <input id="materials-tooling-material-code" className="input" value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
              disabled={!!editId}
              placeholder={t('page.materialsTooling.code')} />
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
        <div className="sticky bottom-0 z-10 -mx-5 mt-4 flex gap-2 border-t border-gray-200 bg-white px-5 pt-4">
          <button onClick={save} disabled={saving} className="btn-primary btn-sm">
            {saving ? t('common.loading') : editId ? t('common.save') : t('common.create')}
          </button>
          <button onClick={() => { setShowForm(false); setEditId(null); }} disabled={saving}
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
          const lowStock = item.safety_quantity > 0 && item.current_quantity < item.safety_quantity;
          return (
            <article key={item.id} className="data-surface space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs tabular-nums text-gray-500">{item.code}</p>
                  <h3 className="break-words font-medium text-gray-900">{item.name}</h3>
                </div>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-2xs font-450 ${
                  item.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {t(item.is_active ? 'page.materialsTooling.active' : 'page.materialsTooling.inactive')}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div className="min-w-0">
                  <dt className="section-label">{t('page.materialsTooling.category')}</dt>
                  <dd className="truncate text-gray-700">{item.category || '—'}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="section-label">{t('page.materialsTooling.unit')}</dt>
                  <dd className="text-gray-700">{item.unit}</dd>
                </div>
                <div>
                  <dt className="section-label">{t('page.materialsTooling.currentQty')}</dt>
                  <dd className={`tabular-nums ${lowStock ? 'font-semibold text-red-600' : 'text-gray-900'}`}>
                    {item.current_quantity ?? 0}
                  </dd>
                </div>
                <div>
                  <dt className="section-label">{t('page.materialsTooling.safetyQty')}</dt>
                  <dd className="tabular-nums text-gray-700">{item.safety_quantity || '—'}</dd>
                </div>
                {viewPrices && (
                  <div>
                    <dt className="section-label">{t('page.materialsTooling.purchasePrice')}</dt>
                    <dd className="tabular-nums text-gray-700">
                      {item.purchaseSummary?.unitPrice
                        ? `¥${Number(item.purchaseSummary.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                        : '—'}
                    </dd>
                  </div>
                )}
              </dl>
              <div className="flex justify-end border-t border-gray-100 pt-3">
                <button onClick={() => edit(item)} className="text-xs font-medium text-blue-600 hover:underline">
                  {t('common.edit')}
                </button>
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
              <tr key={row} className="animate-pulse border-b border-gray-100">
                <td colSpan={viewPrices ? 9 : 8} className="px-4 py-3"><div className="h-4 rounded bg-gray-100" /></td>
              </tr>
            ))}
            {filtered.map((item: any) => {
              const lowStock = item.safety_quantity > 0 && item.current_quantity < item.safety_quantity;
              return (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="table-cell tabular-nums text-xs text-gray-500">{item.code}</td>
                  <td className="table-cell font-medium text-gray-900">{item.name}</td>
                  <td className="table-cell text-xs text-gray-500">{item.category || '—'}</td>
                  <td className={`table-cell text-right tabular-nums text-sm ${lowStock ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                    {item.current_quantity ?? 0}
                  </td>
                  <td className="table-cell text-right tabular-nums text-xs text-gray-500">
                    {item.safety_quantity || '—'}
                  </td>
                  <td className="table-cell text-xs text-gray-500">{item.unit}</td>
                  {viewPrices && (
                    <td className="table-cell text-right tabular-nums text-xs text-gray-500">
                      {item.purchaseSummary?.unitPrice
                        ? `¥${Number(item.purchaseSummary.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                  )}
                  <td className="table-cell">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-2xs font-450 ${
                      item.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {t(item.is_active ? 'page.materialsTooling.active' : 'page.materialsTooling.inactive')}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    <button onClick={() => edit(item)} className="text-xs text-blue-600 hover:underline">{t('common.edit')}</button>
                  </td>
                </tr>
              );
            })}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={viewPrices ? 9 : 8}><div className="empty-state">{t('page.materialsTooling.noData')}</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
