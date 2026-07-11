import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

type Tab = 'dashboard' | 'products' | 'ledger' | 'stock-in' | 'stock-out' | 'adjustment' | 'import';

const TABS: { key: Tab; labelKey: string }[] = [
  { key: 'dashboard', labelKey: 'page.inventory.dashboardTab' },
  { key: 'products', labelKey: 'page.inventory.productsTab' },
  { key: 'ledger', labelKey: 'page.inventory.ledgerTab' },
  { key: 'stock-in', labelKey: 'page.inventory.stockInTab' },
  { key: 'stock-out', labelKey: 'page.inventory.stockOutTab' },
  { key: 'adjustment', labelKey: 'page.inventory.adjustmentTab' },
  { key: 'import', labelKey: 'page.inventory.importTab' },
];

export default function InventoryPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [session, setSession] = useState<Record<string, any>>({});

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-4">{t('nav.inventory')}</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map(item => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === item.key
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab onTabChange={setTab} />}
      {tab === 'products' && <ProductsTab />}
      {tab === 'ledger' && <LedgerTab />}
      {tab === 'stock-in' && <StockInTab />}
      {tab === 'stock-out' && <StockOutTab />}
      {tab === 'adjustment' && <AdjustmentTab />}
      {tab === 'import' && <ImportTab />}
    </div>
  );
}

// ─── Dashboard ───

function DashboardTab({ onTabChange }: { onTabChange: (tab: Tab) => void }) {
  const { t } = useTranslation();
  const [stock, setStock] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [allTxns, setAllTxns] = useState<any[]>([]);

  const load = () => {
    fetch('/api/inventory/stock').then(r => r.json()).then(setStock).catch(() => {});
    fetch('/api/inventory/low-stock').then(r => r.json()).then(setLowStock).catch(() => {});
    fetch('/api/inventory/ledger').then(r => r.json()).then(setAllTxns).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const totalProducts = stock.length;
  const totalQty = stock.reduce((s: number, p: any) => s + Math.max(0, p.current_stock), 0);
  const totalWeight = stock.reduce((s: number, p: any) => s + Math.max(0, p.current_weight_kg), 0);

  // 30-day stats
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const recentTxns = allTxns.filter((t: any) => t.transaction_date >= thirtyDaysAgo);
  const stockIn30d = recentTxns.filter((t: any) => t.transaction_type === 'stock_in');
  const stockOut30d = recentTxns.filter((t: any) => t.transaction_type === 'stock_out');
  const adj30d = recentTxns.filter((t: any) => t.transaction_type === 'adjustment');
  const inQty = stockIn30d.reduce((s: number, t: any) => s + Math.abs(t.quantity), 0);
  const inWt = stockIn30d.reduce((s: number, t: any) => s + Math.abs(t.total_weight_kg || 0), 0);
  const outQty = stockOut30d.reduce((s: number, t: any) => s + Math.abs(t.quantity), 0);
  const outWt = stockOut30d.reduce((s: number, t: any) => s + Math.abs(t.total_weight_kg || 0), 0);
  const adjQty = adj30d.reduce((s: number, t: any) => s + Math.abs(t.quantity), 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-2xs font-450 text-gray-500 uppercase tracking-[0.08em]">{t('page.inventory.products')}</div>
          <div className="text-2xl font-semibold text-gray-900 mt-1">{totalProducts}</div>
        </div>
        <div className="card p-4">
          <div className="text-2xs font-450 text-gray-500 uppercase tracking-[0.08em]">{t('page.inventory.totalQty')}</div>
          <div className="text-2xl font-semibold text-gray-900 mt-1">{totalQty.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-0.5">pcs / sheets / m</div>
        </div>
        <div className="card p-4">
          <div className="text-2xs font-450 text-gray-500 uppercase tracking-[0.08em]">{t('page.inventory.totalWeight')}</div>
          <div className="text-2xl font-semibold text-gray-900 mt-1">{totalWeight.toFixed(1)}</div>
          <div className="text-xs text-gray-400 mt-0.5">kg</div>
        </div>
        <div className="card p-4">
          <div className="text-2xs font-450 text-gray-500 uppercase tracking-[0.08em]">{t('page.inventory.lowStock')}</div>
          <div className={`text-2xl font-semibold mt-1 ${lowStock.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {lowStock.length}
          </div>
        </div>
      </div>

      {/* 30-Day Activity */}
      <div className="card p-4">
        <h3 className="text-xs font-450 text-gray-500 uppercase tracking-[0.08em] mb-3">{t('page.inventory.last30DaysActivity')}</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <div className="text-2xs text-gray-400">{t('page.inventory.stockInTab')}</div>
            <div className="text-lg font-semibold text-green-600 tabular-nums">{inQty.toLocaleString()}</div>
            <div className="text-2xs text-gray-400">{inWt.toFixed(1)} kg {t('page.inventory.received')}</div>
          </div>
          <div>
            <div className="text-2xs text-gray-400">{t('page.inventory.stockOutTab')}</div>
            <div className="text-lg font-semibold text-red-600 tabular-nums">{outQty.toLocaleString()}</div>
            <div className="text-2xs text-gray-400">{outWt.toFixed(1)} kg {t('page.inventory.shipped')}</div>
          </div>
          <div>
            <div className="text-2xs text-gray-400">{t('page.inventory.adjustments')}</div>
            <div className="text-lg font-semibold text-yellow-600 tabular-nums">{adjQty.toLocaleString()}</div>
            <div className="text-2xs text-gray-400">{t('page.inventory.unitsAdjusted')}</div>
          </div>
        </div>
      </div>

      {/* Low Stock Alerts — dual threshold */}
      {lowStock.length > 0 && (
        <div className="card">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-xs font-450 text-red-600 uppercase tracking-[0.08em]">{t('page.inventory.lowStockAlerts')}</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="table-header">SKU</th>
                <th className="table-header">{t('page.inventory.product')}</th>
                <th className="table-header text-right">{t('page.inventory.qty')}</th>
                <th className="table-header text-right">{t('page.inventory.minQty')}</th>
                <th className="table-header text-right">{t('page.inventory.weight')}</th>
                <th className="table-header text-right">{t('page.inventory.minWt')}</th>
                <th className="table-header">{t('page.inventory.status')}</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((p: any) => {
                const lowQty = p.safety_stock_qty > 0 && p.current_stock < p.safety_stock_qty;
                const lowWt = p.safety_stock_weight_kg > 0 && p.current_weight_kg < p.safety_stock_weight_kg;
                return (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="table-cell tabular-nums text-xs text-gray-500">{p.sku}</td>
                    <td className="table-cell font-medium text-gray-900">{p.name}</td>
                    <td className={`table-cell text-right tabular-nums text-sm ${lowQty ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                      {Math.max(0, p.current_stock)}
                    </td>
                    <td className="table-cell text-right tabular-nums text-xs text-gray-500">{p.safety_stock_qty || '—'}</td>
                    <td className={`table-cell text-right tabular-nums text-sm ${lowWt ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                      {Math.max(0, p.current_weight_kg || 0).toFixed(1)}
                    </td>
                    <td className="table-cell text-right tabular-nums text-xs text-gray-500">{p.safety_stock_weight_kg ? p.safety_stock_weight_kg + ' kg' : '—'}</td>
                    <td className="table-cell">
                      <div className="flex gap-1">
                        {lowQty && <span className="inline-flex px-1.5 py-0.5 rounded text-2xs font-450 bg-red-50 text-red-600">Qty</span>}
                        {lowWt && <span className="inline-flex px-1.5 py-0.5 rounded text-2xs font-450 bg-red-50 text-red-600">Wt</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Current Inventory — Qty + Weight */}
      <div className="card">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-450 text-gray-500 uppercase tracking-[0.08em]">{t('page.inventory.currentInventory')}</h3>
            <p className="text-2xs text-gray-400 mt-1">
              {t('page.inventory.stockChangeHelp')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onTabChange('products')} className="btn-secondary btn-sm">{t('page.inventory.editProducts')}</button>
            <button onClick={() => onTabChange('adjustment')} className="btn-secondary btn-sm">{t('page.inventory.adjustStock')}</button>
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="table-header">SKU</th>
              <th className="table-header">{t('page.inventory.product')}</th>
              <th className="table-header">{t('page.inventory.material')}</th>
              <th className="table-header">{t('page.inventory.type')}</th>
              <th className="table-header text-right">{t('page.inventory.qty')}</th>
              <th className="table-header text-right">{t('page.inventory.weight')}</th>
              <th className="table-header text-right">{t('page.inventory.unitWt')}</th>
              <th className="table-header text-right">{t('page.inventory.minQty')}</th>
              <th className="table-header text-right">{t('page.inventory.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {stock.map((p: any) => {
              const lowQty = p.safety_stock_qty > 0 && p.current_stock < p.safety_stock_qty;
              const lowWt = p.safety_stock_weight_kg > 0 && p.current_weight_kg < p.safety_stock_weight_kg;
              return (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="table-cell tabular-nums text-xs text-gray-500">{p.sku}</td>
                  <td className="table-cell font-medium text-gray-900">{p.name}</td>
                  <td className="table-cell text-xs text-gray-500">{p.material_name || '—'}</td>
                  <td className="table-cell text-xs text-gray-500 capitalize">{p.product_type || '—'}</td>
                  <td className={`table-cell text-right tabular-nums text-sm ${lowQty ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                    {Math.max(0, p.current_stock)}
                  </td>
                  <td className={`table-cell text-right tabular-nums text-sm ${lowWt ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                    {Math.max(0, p.current_weight_kg || 0).toFixed(1)}
                  </td>
                  <td className="table-cell text-right tabular-nums text-xs text-gray-400">
                    {(p.unit_weight_kg || 0).toFixed(3)}
                  </td>
                  <td className="table-cell text-right tabular-nums text-xs text-gray-500">
                    {p.safety_stock_qty || '—'}
                  </td>
                  <td className="table-cell text-right">
                    <div className="inline-flex items-center gap-2">
                      <button onClick={() => onTabChange('products')} className="text-xs text-blue-600 hover:underline">{t('common.edit')}</button>
                      <button onClick={() => onTabChange('adjustment')} className="text-xs text-yellow-600 hover:underline">{t('page.inventory.adjustmentTab')}</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {stock.length === 0 && (
              <tr><td colSpan={9} className="text-center py-8 text-xs text-gray-400">{t('page.inventory.noProductsInInventory')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Products ───

const PRODUCT_TYPES = [
  { value: 'sheet', labelKey: 'page.inventory.productTypeSheet' },
  { value: 'rod', labelKey: 'page.inventory.productTypeRod' },
  { value: 'tube', labelKey: 'page.inventory.productTypeTube' },
  { value: 'part', labelKey: 'page.inventory.productTypePart' },
];

const TRACKING_MODES = [
  { value: 'piece', labelKey: 'page.inventory.trackingPiece' },
  { value: 'length', labelKey: 'page.inventory.trackingLength' },
  { value: 'weight', labelKey: 'page.inventory.trackingWeight' },
];

const DIM_FIELDS: Record<string, { key: string; labelKey: string; placeholder: string }[]> = {
  sheet: [
    { key: 'length_mm', labelKey: 'page.inventory.length', placeholder: 'mm' },
    { key: 'width_mm', labelKey: 'page.inventory.width', placeholder: 'mm' },
    { key: 'thickness_mm', labelKey: 'page.inventory.thickness', placeholder: 'mm' },
  ],
  rod: [
    { key: 'diameter_mm', labelKey: 'page.inventory.diameter', placeholder: 'mm' },
    { key: 'length_mm', labelKey: 'page.inventory.length', placeholder: 'mm' },
  ],
  tube: [
    { key: 'outer_diameter_mm', labelKey: 'page.inventory.outerDiameter', placeholder: 'mm' },
    { key: 'inner_diameter_mm', labelKey: 'page.inventory.innerDiameter', placeholder: 'mm' },
    { key: 'length_mm', labelKey: 'page.inventory.length', placeholder: 'mm' },
  ],
  part: [
    { key: 'unit_weight_kg', labelKey: 'page.inventory.unitWeight', placeholder: 'kg' },
  ],
};

function ProductsTab() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [form, setForm] = useState<any>({
    sku: '', name: '', category: '',
    product_type: 'sheet', stock_tracking_mode: 'piece',
    length_mm: '', width_mm: '', thickness_mm: '',
    diameter_mm: '', outer_diameter_mm: '', inner_diameter_mm: '',
    unit_weight_kg: '', material_id: '', unit: 'pc',
    safety_stock_qty: 0, safety_stock_weight_kg: 0,
    initial_qty: 0,
  });

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/inventory/products').then(r => r.json()),
      fetch('/api/inventory/materials').then(r => r.json()),
    ]).then(([prods, mats]) => {
      setProducts(prods);
      setMaterials(mats);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const selectedMaterial = materials.find((m: any) => m.id === form.material_id);
  const density = selectedMaterial?.density_kg_m3 || 0;
  const matShort = selectedMaterial?.name?.split(' ')[0] || '';

  // Auto-generate SKU from material + dimensions
  const autoSku = (() => {
    if (form.product_type === 'part') return form.sku || '';
    const parts = [matShort];
    const dimFields = DIM_FIELDS[form.product_type] || [];
    for (const f of dimFields) {
      const v = form[f.key];
      if (v === '' || v === undefined) return form.sku || '';
      parts.push(String(v));
    }
    return parts.filter(Boolean).join('-');
  })();

  // Auto-generate Name = "Material Type" (e.g. "PEEK Sheet")
  const typeLabel = t(PRODUCT_TYPES.find(item => item.value === form.product_type)?.labelKey || 'page.inventory.type');
  const autoName = form.product_type === 'part' ? form.name : (selectedMaterial ? `${selectedMaterial.name} ${typeLabel}` : typeLabel);

  // Auto-update SKU + Name when dims/material change (only for new products)
  useEffect(() => {
    if (editId) return;
    if (form.product_type !== 'part' && autoSku) {
      setForm((prev: any) => ({ ...prev, sku: autoSku, name: autoName }));
    }
  }, [autoSku, autoName, editId, form.product_type]);

  // Compute visual weight preview
  const dims: any = { product_type: form.product_type };
  for (const group of Object.values(DIM_FIELDS)) {
    for (const f of group as any[]) {
      const v = parseFloat(form[f.key]);
      if (!isNaN(v)) dims[f.key] = v;
    }
  }
  const weightPreview = form.product_type === 'part'
    ? (parseFloat(form.unit_weight_kg) || 0)
    : density && dims.length_mm ? calcPreviewWeight(dims, density) : null;

  const save = async () => {
    if (savingProduct) return;
    const currentSku = form.sku?.trim();
    const currentName = form.name?.trim();
    if (!currentSku || !currentName) { toast.error(t('page.inventory.skuNameRequired')); return; }
    const payload: any = { ...form };
    payload.sku = currentSku;
    payload.name = currentName;
    for (const k of ['length_mm','width_mm','thickness_mm','diameter_mm','outer_diameter_mm','inner_diameter_mm','unit_weight_kg','safety_stock_qty','safety_stock_weight_kg']) {
      const v = parseFloat(payload[k]);
      payload[k] = isNaN(v) ? null : v;
    }
    const initialQty = parseInt(form.initial_qty) || 0;
    delete payload.initial_qty;
    setSavingProduct(true);
    try {
      let productId: string | null = null;
      if (editId) {
        const res = await fetch(`/api/inventory/products/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || data?.message || t('page.inventory.updateFailed'));
        }
        productId = editId;
      } else {
        const res = await fetch('/api/inventory/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || data?.message || t('page.inventory.createFailed'));
        }
        const created = await res.json();
        productId = created.id;
      }
      toast.success(editId ? t('page.inventory.productUpdated') : t('page.inventory.productCreated'));
      setShowForm(false); setEditId(null);
      setForm({ sku: '', name: '', category: '', product_type: 'sheet', stock_tracking_mode: 'piece',
        length_mm: '', width_mm: '', thickness_mm: '', diameter_mm: '', outer_diameter_mm: '', inner_diameter_mm: '',
        unit_weight_kg: '', material_id: '', unit: 'pc', safety_stock_qty: 0, safety_stock_weight_kg: 0, initial_qty: 0 });
      load();
      // Create initial stock-in if quantity provided (separate from main success flow)
      if (!editId && initialQty > 0 && productId) {
        try {
          await fetch('/api/inventory/stock-in', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: productId, quantity: initialQty, unit: payload.unit || 'pc', notes: t('page.inventory.initialStock'), operator: 'System' })
          });
        } catch {
          toast.error(t('page.inventory.initialStockFailed'));
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('page.inventory.saveFailed'));
    } finally {
      setSavingProduct(false);
    }
  };

  const deleteProduct = async (id: string, name: string) => {
    if (!window.confirm(t('page.inventory.deleteConfirm', { name }))) return;
    try {
      const res = await fetch(`/api/inventory/products/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || t('page.inventory.deleteFailed'));
        return;
      }
      toast.success(t('page.inventory.productDeleted'));
      if (editId === id) {
        setShowForm(false);
        setEditId(null);
      }
      load();
    } catch {
      toast.error(t('page.inventory.deleteFailed'));
    }
  };

  const edit = (p: any) => {
    setEditId(p.id);
    setForm({
      sku: p.sku, name: p.name, category: p.category || '',
      product_type: p.product_type || 'sheet', stock_tracking_mode: p.stock_tracking_mode || 'piece',
      length_mm: p.length_mm ?? '', width_mm: p.width_mm ?? '', thickness_mm: p.thickness_mm ?? '',
      diameter_mm: p.diameter_mm ?? '', outer_diameter_mm: p.outer_diameter_mm ?? '', inner_diameter_mm: p.inner_diameter_mm ?? '',
      unit_weight_kg: p.unit_weight_kg ?? '', material_id: p.material_id || '', unit: p.unit || 'pc',
      safety_stock_qty: p.safety_stock_qty || 0, safety_stock_weight_kg: p.safety_stock_weight_kg || 0,
    });
    setShowForm(true);
  };

  const set = (field: string, value: any) => setForm((prev: any) => ({ ...prev, [field]: value }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{products.length} {t('page.inventory.products')}</p>
        <button onClick={() => { setEditId(null); setForm({ sku: '', name: '', category: '', product_type: 'sheet', stock_tracking_mode: 'piece',
          length_mm: '', width_mm: '', thickness_mm: '', diameter_mm: '', outer_diameter_mm: '', inner_diameter_mm: '',
          unit_weight_kg: '', material_id: '', unit: 'pc', safety_stock_qty: 0, safety_stock_weight_kg: 0, initial_qty: 0 }); setShowForm(true); }} className="btn-primary btn-sm">{t('page.inventory.addProduct')}</button>
      </div>

      {showForm && (
        <div className="card p-4 mb-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {/* Row 1: SKU (auto-generated) + Name (auto-generated) */}
            <div>
              <input className="input" placeholder="SKU *" value={form.sku} onChange={e => set('sku', e.target.value)} />
              {form.product_type !== 'part' && autoSku && (
                <span className="text-2xs text-gray-400 mt-0.5 block">{t('page.inventory.autoGenerated')}</span>
              )}
            </div>
            <div>
              <input className="input" placeholder={`${t('page.companies.name')} *`} value={form.name} onChange={e => set('name', e.target.value)} />
            </div>

            {/* Row 2: Type + Tracking + Category */}
            <select className="input" value={form.product_type} onChange={e => set('product_type', e.target.value)}>
              {PRODUCT_TYPES.map(item => <option key={item.value} value={item.value}>{t(item.labelKey)}</option>)}
            </select>
            <select className="input" value={form.stock_tracking_mode} onChange={e => set('stock_tracking_mode', e.target.value)}>
              {TRACKING_MODES.map(item => <option key={item.value} value={item.value}>{t(item.labelKey)}</option>)}
            </select>

            {/* Row 3: Category + Unit */}
            <input className="input" placeholder={t('page.inventory.category')} value={form.category} onChange={e => set('category', e.target.value)} />
            <select className="input" value={form.unit} onChange={e => set('unit', e.target.value)}>
              <option value="pc">pc</option><option value="sheet">sheet</option><option value="m">m</option><option value="kg">kg</option>
            </select>

            {/* Row 4+: Dynamic dimension fields */}
            <div className="col-span-2 border-t border-gray-100 pt-3">
              <span className="text-xs font-450 text-gray-500 uppercase tracking-[0.08em]">{t('page.inventory.dimensions')}</span>
            </div>
            <div className="col-span-2 grid grid-cols-3 gap-3">
              {(DIM_FIELDS[form.product_type] || []).map((f: any) => (
                <div key={f.key}>
                  <label className="text-xs text-gray-500">{t(f.labelKey)} <span className="text-gray-400">({f.placeholder})</span></label>
                  <input className="input mt-0.5" type="number" step="0.01" min="0"
                    value={form[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
                </div>
              ))}
            </div>

            {/* Material */}
            <div className="col-span-2 border-t border-gray-100 pt-3">
              <span className="text-xs font-450 text-gray-500 uppercase tracking-[0.08em]">{t('page.inventory.material')}</span>
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <div>
                <select className="input" value={form.material_id} onChange={e => set('material_id', e.target.value)}>
                  <option value="">- {t('page.inventory.noMaterial')} -</option>
                  {materials.map((m: any) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.density_kg_m3} kg/m³)</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center text-sm text-gray-500">
                {density > 0 && <span>{t('page.inventory.density')}: <strong>{density}</strong> kg/m³</span>}
              </div>
            </div>

            {/* Weight Preview */}
            {weightPreview !== null && weightPreview > 0 && (
              <div className="col-span-2 bg-blue-50 rounded-lg px-3 py-2 text-sm">
                <span className="text-blue-700 font-medium">{t('page.inventory.unitWeight')}:</span>
                <span className="text-blue-900 tabular-nums font-semibold ml-2">{weightPreview.toFixed(3)}</span>
                <span className="text-blue-500 ml-1">kg</span>
              </div>
            )}

            {/* Initial Stock (new products only) */}
            {!editId && (
              <div className="col-span-2 border-t border-gray-100 pt-3">
                <span className="text-xs font-450 text-gray-500 uppercase tracking-[0.08em]">{t('page.inventory.initialStock')}</span>
              </div>
            )}
            {!editId && (
              <div className="col-span-1">
                <label className="text-xs text-gray-500">{t('page.inventory.initialQty')}</label>
                <input className="input mt-0.5" type="number" min="0" step="1" value={form.initial_qty}
                  onChange={e => set('initial_qty', parseInt(e.target.value) || 0)} placeholder="0" />
                <span className="text-2xs text-gray-400">{t('page.inventory.initialQtyHelp')}</span>
              </div>
            )}

            {/* Safety Stock */}
            <div className="col-span-2 border-t border-gray-100 pt-3">
              <span className="text-xs font-450 text-gray-500 uppercase tracking-[0.08em]">{t('page.inventory.safetyStock')}</span>
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('page.inventory.minQty')}</label>
              <input className="input mt-0.5" type="number" min="0" value={form.safety_stock_qty}
                onChange={e => set('safety_stock_qty', parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('page.inventory.minWeightKg')}</label>
              <input className="input mt-0.5" type="number" min="0" step="0.001" value={form.safety_stock_weight_kg}
                onChange={e => set('safety_stock_weight_kg', parseFloat(e.target.value) || 0)} />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={save} disabled={savingProduct} className="btn-primary btn-sm">
              {savingProduct ? t('page.inventory.saving') : editId ? t('common.save') : t('common.create')}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); }} disabled={savingProduct} className="btn-secondary btn-sm">{t('common.cancel')}</button>
          </div>
        </div>
      )}

      <div className="card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="table-header">SKU</th>
              <th className="table-header">{t('page.companies.name')}</th>
              <th className="table-header">{t('page.inventory.type')}</th>
              <th className="table-header">{t('page.inventory.material')}</th>
              <th className="table-header text-right">{t('page.inventory.unitWt')}</th>
              <th className="table-header text-right">Min</th>
              <th className="table-header"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p: any) => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="table-cell tabular-nums text-xs text-gray-500">{p.sku}</td>
                <td className="table-cell font-medium text-gray-900">{p.name}</td>
                <td className="table-cell text-xs text-gray-500 capitalize">{p.product_type || '—'}</td>
                <td className="table-cell text-xs text-gray-500">{p.material_name || '—'}</td>
                <td className="table-cell text-right tabular-nums text-sm text-gray-600">{(p.unit_weight_kg || 0).toFixed(3)}</td>
                <td className="table-cell text-right tabular-nums text-xs text-gray-500">
                  {p.safety_stock_qty || '—'}/{p.safety_stock_weight_kg ? p.safety_stock_weight_kg + 'kg' : '—'}
                </td>
                <td className="table-cell text-right">
                  <div className="inline-flex items-center gap-3">
                    <button onClick={() => edit(p)} className="text-xs text-blue-600 hover:underline">{t('common.edit')}</button>
                    <button onClick={() => deleteProduct(p.id, p.name)} className="text-xs text-red-600 hover:underline">{t('common.delete')}</button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && !loading && (
              <tr><td colSpan={7} className="text-center py-8 text-xs text-gray-400">{t('page.inventory.noProductsYet')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Client-side weight preview (mirrors server calc) */
function calcPreviewWeight(dims: any, density: number): number {
  let vol = 0;
  const { product_type, length_mm, width_mm, thickness_mm, diameter_mm, outer_diameter_mm, inner_diameter_mm } = dims;
  switch (product_type) {
    case 'sheet': vol = (length_mm || 0) * (width_mm || 0) * (thickness_mm || 0); break;
    case 'rod':   const rd = (diameter_mm || 0) / 2; vol = Math.PI * rd * rd * (length_mm || 0); break;
    case 'tube':  const ro = (outer_diameter_mm || 0) / 2, ri = (inner_diameter_mm || 0) / 2; vol = Math.PI * (ro*ro - ri*ri) * (length_mm || 0); break;
    default: return 0;
  }
  return (vol / 1_000_000_000) * density;
}

// ─── Ledger ───

function LedgerTab() {
  const { t } = useTranslation();
  const [txns, setTxns] = useState<any[]>([]);
  const [stock, setStock] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/inventory/ledger').then(r => r.json()),
      fetch('/api/inventory/stock').then(r => r.json()),
    ]).then(([txnsData, stockData]) => {
      setTxns(txnsData);
      setStock(stockData);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = filter ? txns.filter((t: any) => t.transaction_type === filter) : txns;

  return (
    <div>
      {/* Current Stock Summary */}
      <div className="card p-4 mb-4">
        <h3 className="text-xs font-450 text-gray-500 uppercase tracking-[0.08em] mb-3">{t('page.inventory.currentStockComputed')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {stock.map((p: any) => (
            <div key={p.id} className={`p-2 rounded-lg border ${p.current_stock < p.safety_stock ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
              <div className="text-2xs text-gray-500 truncate">{p.sku}</div>
              <div className="text-xs font-semibold text-gray-900 truncate">{p.name}</div>
              <div className={`text-sm tabular-nums mt-1 ${p.current_stock < p.safety_stock ? 'text-red-600' : 'text-gray-700'}`}>
                {Math.max(0, p.current_stock)} <span className="text-2xs text-gray-400">{p.unit}</span>
              </div>
            </div>
          ))}
          {stock.length === 0 && <div className="text-xs text-gray-400 col-span-full">{t('page.inventory.noProducts')}</div>}
        </div>
      </div>

      {/* Transactions */}
      <div className="card">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
          <h3 className="text-xs font-450 text-gray-500 uppercase tracking-[0.08em]">{t('page.inventory.transactionHistory')}</h3>
          <select className="input max-w-[160px] text-xs ml-auto" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">{t('page.inventory.allTypes')}</option>
            <option value="stock_in">{t('page.inventory.stockInTab')}</option>
            <option value="stock_out">{t('page.inventory.stockOutTab')}</option>
            <option value="adjustment">{t('page.inventory.adjustmentTab')}</option>
          </select>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="table-header">{t('page.inventory.date')}</th>
              <th className="table-header">#</th>
              <th className="table-header">{t('page.inventory.type')}</th>
              <th className="table-header">{t('page.inventory.product')}</th>
              <th className="table-header text-right">{t('page.inventory.qty')}</th>
              <th className="table-header">{t('page.inventory.reference')}</th>
              <th className="table-header">{t('page.inventory.notes')}</th>
              <th className="table-header">{t('page.inventory.operator')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((txn: any) => (
              <tr key={txn.id} className="border-b border-gray-100">
                <td className="table-cell text-xs text-gray-500">{txn.transaction_date}</td>
                <td className="table-cell tabular-nums text-xs text-gray-500">{txn.transaction_number}</td>
                <td className="table-cell">
                  <span className={`inline-flex px-2 py-0.5 rounded text-2xs font-450 ${
                    txn.transaction_type === 'stock_in' ? 'bg-green-50 text-green-600' :
                    txn.transaction_type === 'stock_out' ? 'bg-red-50 text-red-600' :
                    'bg-yellow-50 text-yellow-600'
                  }`}>
                    {txn.transaction_type === 'stock_in' ? 'IN' : txn.transaction_type === 'stock_out' ? 'OUT' : 'ADJ'}
                  </span>
                </td>
                <td className="table-cell"><span className="font-medium text-gray-900">{txn.product_name || txn.product_sku}</span></td>
                <td className={`table-cell text-right tabular-nums text-sm font-medium ${txn.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {txn.quantity > 0 ? `+${txn.quantity}` : txn.quantity}
                </td>
                <td className="table-cell text-xs text-gray-500">
                  {txn.reference_type === 'order' ? t('page.inventory.orderRef', { id: txn.reference_id?.slice(0,8) }) : txn.reference_type || '—'}
                </td>
                <td className="table-cell text-xs text-gray-400 max-w-[200px] truncate">{txn.notes || '—'}</td>
                <td className="table-cell text-xs text-gray-500">{txn.operator || '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-xs text-gray-400">{t('page.inventory.noTransactions')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Shared: Product + Stock data hook ───

function useProductsAndStock() {
  const [products, setProducts] = useState<any[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, any>>({});
  useEffect(() => {
    fetch('/api/inventory/products').then(r => r.json()).then(setProducts).catch(() => {});
    fetch('/api/inventory/stock').then(r => r.json()).then(data => {
      const map: Record<string, any> = {};
      data.forEach((s: any) => { map[s.id] = s; });
      setStockMap(map);
    }).catch(() => {});
  }, []);
  return { products, stockMap, refreshStock: () => fetch('/api/inventory/stock').then(r => r.json()).then(data => {
    const map: Record<string, any> = {};
    data.forEach((s: any) => { map[s.id] = s; });
    return map;
  }) };
}

// ─── Stock In ───

function StockInTab() {
  const { t } = useTranslation();
  const { products, stockMap, refreshStock } = useProductsAndStock();
  const [form, setForm] = useState({ product_id: '', quantity: 1, unit: 'pc', reference_type: '', reference_id: '', notes: '', operator: '', transaction_date: new Date().toISOString().slice(0, 10) });
  const [saved, setSaved] = useState(0);
  const [saving, setSaving] = useState(false);

  const sel = products.find((p: any) => p.id === form.product_id);
  const stockInfo = stockMap[form.product_id];
  const currentQty = stockInfo ? Math.max(0, stockInfo.current_stock) : 0;
  const currentWt = stockInfo ? Math.max(0, stockInfo.current_weight_kg || 0) : 0;
  const unitWt = sel?.unit_weight_kg || 0;
  const estWt = unitWt > 0 ? form.quantity * unitWt : 0;

  const submit = async () => {
    if (saving) return;
    if (!form.product_id || form.quantity <= 0) { toast.error(t('page.inventory.selectProductQuantity')); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/inventory/stock-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || data?.message || t('page.inventory.failed'));
      toast.success(t('page.inventory.stockInRecorded'));
      setForm(f => ({ ...f, quantity: 1, reference_type: '', reference_id: '', notes: '', operator: '' }));
      setSaved(s => s + 1);
      const newMap = await refreshStock();
      setSaved(s => s); // re-render via dependency
      if (newMap) Object.assign(stockMap, newMap);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('page.inventory.networkError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <TransactionForm
      title={t('page.inventory.stockInTab')} products={products} form={form} setForm={setForm} submit={submit}
      sel={sel} currentQty={currentQty} currentWt={currentWt} unitWt={unitWt} estWt={estWt}
      showRef={true} qtyLabel={`${t('page.inventory.qty')} (+)`} btnColor="bg-green-600"
      saving={saving}
    />
  );
}

// ─── Stock Out (with inventory check) ───

function StockOutTab() {
  const { t } = useTranslation();
  const { products, stockMap, refreshStock } = useProductsAndStock();
  const [form, setForm] = useState({ product_id: '', quantity: 1, unit: 'pc', reference_type: 'order', reference_id: '', notes: '', operator: '', transaction_date: new Date().toISOString().slice(0, 10) });
  const [errInfo, setErrInfo] = useState<any>(null);
  const [saved, setSaved] = useState(0);
  const [saving, setSaving] = useState(false);

  const sel = products.find((p: any) => p.id === form.product_id);
  const stockInfo = stockMap[form.product_id];
  const currentQty = stockInfo ? Math.max(0, stockInfo.current_stock) : 0;
  const currentWt = stockInfo ? Math.max(0, stockInfo.current_weight_kg || 0) : 0;
  const unitWt = sel?.unit_weight_kg || 0;
  const estWt = unitWt > 0 ? form.quantity * unitWt : 0;

  const submit = async () => {
    if (saving) return;
    setErrInfo(null);
    if (!form.product_id || form.quantity <= 0) { toast.error(t('page.inventory.selectProductQuantity')); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/inventory/stock-out', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.error === 'Insufficient inventory') { setErrInfo(data); } else { toast.error(data?.error || data?.message || t('page.inventory.failed')); }
        return;
      }
      toast.success(t('page.inventory.stockOutRecorded'));
      setForm(f => ({ ...f, quantity: 1, reference_type: 'order', reference_id: '', notes: '', operator: '' }));
      setSaved(s => s + 1);
      const newMap = await refreshStock();
      if (newMap) Object.assign(stockMap, newMap);
    } catch { toast.error(t('page.inventory.networkError')); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-xl">
      {errInfo && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-sm">
          <div className="font-semibold text-red-700 mb-1">{t('page.inventory.insufficientInventory')}</div>
          <div className="text-red-600 space-y-0.5">
            <div>{t('page.inventory.product')}: <span className="font-medium">{errInfo.product_sku} — {errInfo.product_name}</span></div>
            <div>{t('page.inventory.current')}: <span className="tabular-nums font-semibold">{errInfo.currentStock}</span> {t('page.inventory.unit')}</div>
            <div>{t('page.inventory.requested')}: <span className="tabular-nums font-semibold">{errInfo.requestedQuantity}</span> {t('page.inventory.unit')}</div>
            <div className="text-xs text-red-500 mt-1">{t('page.inventory.reduceOrStockIn')}</div>
          </div>
        </div>
      )}
      <TransactionForm
        title={t('page.inventory.stockOutTab')} products={products} form={form} setForm={setForm} submit={submit}
        sel={sel} currentQty={currentQty} currentWt={currentWt} unitWt={unitWt} estWt={estWt}
        showRef={true} qtyLabel={`${t('page.inventory.qty')} (-)`} btnColor="bg-red-600" isOut={true}
        saving={saving}
      />
      {errInfo && (
        <div className="mt-3 text-xs text-gray-400">
          {t('page.inventory.notRecorded', { qty: errInfo.currentStock, weight: errInfo.currentStock * (unitWt || 0) })}
        </div>
      )}
    </div>
  );
}

// ─── Stock Adjustment ───

function AdjustmentTab() {
  const { t } = useTranslation();
  const { products, stockMap, refreshStock } = useProductsAndStock();
  const [form, setForm] = useState({ product_id: '', quantity: 0, unit: 'pc', notes: '', operator: '', transaction_date: new Date().toISOString().slice(0, 10) });
  const [saved, setSaved] = useState(0);
  const [saving, setSaving] = useState(false);

  const sel = products.find((p: any) => p.id === form.product_id);
  const stockInfo = stockMap[form.product_id];
  const currentQty = stockInfo ? Math.max(0, stockInfo.current_stock) : 0;
  const currentWt = stockInfo ? Math.max(0, stockInfo.current_weight_kg || 0) : 0;
  const unitWt = sel?.unit_weight_kg || 0;

  const submit = async () => {
    if (saving) return;
    if (!form.product_id || form.quantity === 0) { toast.error(t('page.inventory.selectProductQuantity')); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/inventory/adjustment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || data?.message || t('page.inventory.failed'));
      toast.success(t('page.inventory.adjustmentRecorded'));
      setForm(f => ({ ...f, quantity: 0, notes: '', operator: '' }));
      setSaved(s => s + 1);
      const newMap = await refreshStock();
      if (newMap) Object.assign(stockMap, newMap);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('page.inventory.networkError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl">
      <p className="text-xs text-gray-500 mb-4">
        {t('page.inventory.adjustmentHelp')}<br />
        {t('page.inventory.adjustmentExample')}
      </p>
      <TransactionForm
        title={t('page.inventory.adjustmentTab')} products={products} form={form} setForm={setForm} submit={submit}
        sel={sel} currentQty={currentQty} currentWt={currentWt} unitWt={unitWt} estWt={0}
        showRef={false} qtyLabel={`${t('page.inventory.qty')} (+/-)`} btnColor="bg-yellow-600"
        allowNegative={true} saving={saving}
      />
    </div>
  );
}

// ─── Shared Transaction Form ───

function TransactionForm({ title, products, form, setForm, submit, sel, currentQty, currentWt, unitWt, estWt, showRef, qtyLabel, btnColor, isOut, allowNegative, saving }: {
  title: string; products: any[]; form: any; setForm: (f: any) => void; submit: () => void;
  sel: any; currentQty: number; currentWt: number; unitWt: number; estWt: number;
  showRef: boolean; qtyLabel: string; btnColor: string; isOut?: boolean; allowNegative?: boolean; saving: boolean;
}) {
  const { t } = useTranslation();
  const lowQty = isOut && currentQty === 0;

  return (
    <div className="max-w-xl">
      {/* Product Info + Current Stock */}
      {sel && (
        <div className="mb-4 space-y-2">
          <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{sel.sku}</span>
              <span className="text-xs text-gray-400">— {sel.name}</span>
            </div>
            <div className="flex gap-4 text-xs text-gray-500">
              <span className="capitalize">{sel.product_type}</span>
              {sel.material_name && <span>{sel.material_name}</span>}
              {unitWt > 0 && <span>{unitWt.toFixed(3)} kg/{t('page.inventory.unit')}</span>}
            </div>
          </div>
          <div className={`grid grid-cols-2 gap-3 ${lowQty ? 'bg-red-50 border border-red-200' : 'bg-gray-50'} rounded-lg p-3 text-sm`}>
            <div>
              <span className="text-xs text-gray-500">{t('page.inventory.currentQty')}</span>
              <div className={`tabular-nums font-semibold ${lowQty ? 'text-red-600' : 'text-gray-800'}`}>{currentQty}</div>
            </div>
            <div>
              <span className="text-xs text-gray-500">{t('page.inventory.currentWeight')}</span>
              <div className="tabular-nums font-semibold text-gray-800">{currentWt.toFixed(1)} kg</div>
            </div>
          </div>
          {lowQty && <div className="text-xs text-red-600 font-medium">{t('page.inventory.cannotStockOut')}</div>}
        </div>
      )}

      <div className="card p-4 space-y-4">
        <div>
          <label className="label">{t('page.inventory.productRequired')}</label>
          <select className="input" value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value})}>
            <option value="">{t('page.inventory.selectProduct')}</option>
            {products.map((p: any) => (
              <option key={p.id} value={p.id}>{p.sku} — {p.name} ({p.material_name || p.product_type || '—'})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{qtyLabel}</label>
            <input className="input" type="number" step="1" min={allowNegative ? undefined : (isOut ? 1 : 0)} value={form.quantity}
              onChange={e => setForm({...form, quantity: parseFloat(e.target.value) || 0})} />
          </div>
          <div>
            <label className="label">{t('page.inventory.unit')}</label>
            <select className="input" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}>
              <option value="pc">pc</option><option value="sheet">sheet</option><option value="m">m</option><option value="kg">kg</option>
            </select>
          </div>
        </div>

        {/* Weight preview */}
        {estWt > 0 && (
          <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
            <span className="text-blue-600 font-medium">{t('page.inventory.estWeight')}:</span>
            <span className="text-blue-800 tabular-nums font-semibold">{estWt.toFixed(3)} kg</span>
            <span className="text-blue-400">({form.quantity || 0} × {unitWt.toFixed(3)} kg)</span>
          </div>
        )}

        <div>
          <label className="label">{t('page.inventory.date')}</label>
          <input className="input" type="date" value={form.transaction_date}
            onChange={e => setForm({...form, transaction_date: e.target.value})} />
        </div>

        {showRef && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('page.inventory.referenceType')}</label>
              <select className="input" value={form.reference_type} onChange={e => setForm({...form, reference_type: e.target.value})}>
                <option value="">{t('page.inventory.noneDirect')}</option>
                <option value="order">{t('page.inventory.order')}</option>
                <option value="purchase_order">{t('page.inventory.purchaseOrder')}</option>
                <option value="production">{t('page.inventory.production')}</option>
              </select>
            </div>
            <div>
              <label className="label">{t('page.inventory.referenceId')}</label>
              <input className="input" placeholder={t('page.inventory.placeholderOrderId')} value={form.reference_id}
                onChange={e => setForm({...form, reference_id: e.target.value})} />
            </div>
          </div>
        )}

        <div>
          <label className="label">{t('page.inventory.notes')}</label>
          <input className="input" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder={t('page.inventory.placeholderNotes')} />
        </div>

        <div>
          <label className="label">{t('page.inventory.operator')}</label>
          <input className="input" value={form.operator} onChange={e => setForm({...form, operator: e.target.value})} placeholder={t('page.inventory.placeholderOperator')} />
        </div>

        <button onClick={submit} disabled={saving || (isOut && currentQty === 0)} className={`btn-primary ${btnColor} hover:opacity-90 disabled:opacity-50`}>
          {saving ? t('page.inventory.saving') : title}
        </button>
      </div>
    </div>
  );
}

// ─── Import (CSV / XLSX) ───

function ImportTab() {
  const { t } = useTranslation();
  const [importType, setImportType] = useState('stock-initial');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[] | null>(null);
  const [result, setResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [operator, setOperator] = useState('');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    // Quick preview — read first few lines
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(Boolean);
      if (lines.length < 2) { setPreview([]); return; }
      const headers = lines[0].split(',').map(h => h.trim());
      const rows = lines.slice(1, 6).map(line => {
        const vals = line.split(',').map(v => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = vals[i] || ''; });
        return row;
      });
      setPreview(rows);
    };
    if (f.name.endsWith('.csv')) reader.readAsText(f);
    else setPreview([{ 'Note:': t('page.inventory.xlsxPreviewUnavailable') }]);
  };

  const doImport = async () => {
    if (!file) { toast.error(t('page.inventory.selectFile')); return; }
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', importType);
      fd.append('operator', operator || 'Import');
      const res = await fetch('/api/inventory/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || t('page.inventory.importFailed')); setResult({ error: data }); }
      else { setResult(data); toast.success(t('page.inventory.importCompleteToast', { count: data.created })); }
    } catch { toast.error(t('page.inventory.importFailed')); }
    finally { setImporting(false); }
  };

  return (
    <div className="max-w-2xl">
      <div className="card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">{t('page.inventory.importInventoryData')}</h3>
        <p className="text-xs text-gray-500">{t('page.inventory.importHelp')}</p>

        {/* Import type selector */}
        <div>
          <label className="label mb-1.5">{t('page.inventory.importType')}</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'products', label: t('page.inventory.productsTab'), desc: t('page.inventory.bulkProducts') },
              { key: 'stock-initial', label: t('page.inventory.openingBalance'), desc: t('page.inventory.openingBalanceDesc') },
              { key: 'stock-count', label: t('page.inventory.stockCount'), desc: t('page.inventory.stockCountDesc') },
              { key: 'stock-in', label: t('page.inventory.stockInTab'), desc: t('page.inventory.stockInDesc') },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setImportType(opt.key)}
                className={`text-left p-3 rounded-lg border text-xs transition-colors ${
                  importType === opt.key
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900 mb-0.5">{opt.label}</div>
                <div className="text-gray-500">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Template description */}
        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 leading-relaxed">
          {importType === 'products' && (
            <div>
              <strong>{t('page.inventory.templateColumns')}</strong><br />
              SKU, Name, Type (sheet/rod/tube/part), Category, Unit (pc), MaterialID<br />
              <span className="text-gray-400">{t('page.inventory.dimensionsAuto')}</span>
            </div>
          )}
          {importType === 'stock-initial' && (
            <div>
              <strong>{t('page.inventory.templateColumns')}</strong><br />
              SKU, Quantity, Remark (optional)<br />
              <span className="text-gray-400">{t('page.inventory.unitDefaults')}</span>
            </div>
          )}
          {importType === 'stock-count' && (
            <div>
              <strong>{t('page.inventory.templateColumns')}</strong><br />
              SKU, ActualQty, Remark (optional)<br />
              <span className="text-gray-400">{t('page.inventory.countCompare')}</span>
            </div>
          )}
          {importType === 'stock-in' && (
            <div>
              <strong>{t('page.inventory.templateColumns')}</strong><br />
              SKU, Quantity, Remark (optional)<br />
              <span className="text-gray-400">{t('page.inventory.bulkStockIn')}</span>
            </div>
          )}
        </div>

        {/* File upload */}
        <div>
          <label className="label">{t('page.inventory.file')}</label>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 border-0">
              {t('page.inventory.chooseFile')}
              <input type="file" accept=".csv,.xlsx" onChange={handleFile} className="sr-only" />
            </label>
            <span className="text-xs text-gray-500">{file ? file.name : t('page.inventory.noFileSelected')}</span>
          </div>
        </div>

        <div>
          <label className="label">{t('page.inventory.operatorOptional')}</label>
          <input className="input" value={operator} onChange={e => setOperator(e.target.value)} placeholder={t('page.inventory.placeholderOperator')} />
        </div>

        {/* Preview */}
        {preview && !result && (
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">{t('page.inventory.previewRows')}</div>
            <div className="bg-gray-50 rounded-lg p-2 text-xs tabular-nums overflow-x-auto">
              {preview.length === 0 ? <span className="text-gray-400">{t('page.inventory.emptyFile')}</span> :
                <table><thead><tr>{Object.keys(preview[0]).map(h => <th key={h} className="px-2 py-1 text-left text-gray-400">{h}</th>)}</tr></thead>
                  <tbody>{preview.map((row: any, i: number) => <tr key={i}>{Object.values(row).map((v: any, j: number) => <td key={j} className="px-2 py-0.5 text-gray-700">{String(v || '—')}</td>)}</tr>)}</tbody></table>}
            </div>
          </div>
        )}

        {/* Action */}
        <button onClick={doImport} disabled={!file || importing} className="btn-primary">
          {importing ? t('page.inventory.importing') : t('page.inventory.importButton', { type: importType === 'stock-initial' ? t('page.inventory.openingBalance') : importType === 'stock-count' ? t('page.inventory.stockCount') : importType === 'stock-in' ? t('page.inventory.stockInTab') : t('page.inventory.productsTab') })}
        </button>

        {/* Result */}
        {result && !result.error && (
          <div className={`rounded-lg p-4 text-sm ${result.created > 0 ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
            <div className="font-semibold text-gray-900 mb-1">
              {t('page.inventory.importComplete', { count: result.created })}
            </div>
            <div className="text-xs text-gray-600 space-y-0.5">
              <div>{t('page.inventory.totalRows')}: {result.total}</div>
              <div>{t('page.inventory.skipped')}: {result.skipped}</div>
              {result.errors?.length > 0 && <div className="text-red-600">{t('page.inventory.errors')}: {result.errors.length}</div>}
            </div>
            {result.results?.length > 0 && (
              <div className="mt-2 max-h-32 overflow-y-auto">
                {result.results.slice(0, 20).map((r: any, i: number) => (
                  <div key={i} className="text-2xs text-gray-500">{r.sku} — {r.action}{r.qty ? ` x${r.qty}` : ''}{r.diff ? ` ${r.diff}` : ''}</div>
                ))}
              </div>
            )}
          </div>
        )}
        {result?.error && (
          <div className="rounded-lg p-4 bg-red-50 border border-red-200 text-sm text-red-700">
            {t('page.inventory.importError')}: {result.error.error || t('page.inventory.unknownError')}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared Form ───

function StockForm({ title, products, form, setForm, submit, showRef, qtyLabel, helpText }: {
  title: string;
  products: any[];
  form: any;
  setForm: (f: any) => void;
  submit: () => void;
  showRef: boolean;
  qtyLabel: string;
  helpText?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="max-w-xl">
      {helpText && <p className="text-xs text-gray-500 mb-4">{helpText}</p>}
      <div className="card p-4 space-y-4">
        <div>
          <label className="label">{t('page.inventory.productRequired')}</label>
          <select className="input" value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value})}>
            <option value="">{t('page.inventory.selectProduct')}</option>
            {products.map((p: any) => (
              <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{qtyLabel}</label>
            <input className="input" type="number" step="0.001" value={form.quantity}
              onChange={e => setForm({...form, quantity: parseFloat(e.target.value) || 0})} />
          </div>
          <div>
            <label className="label">{t('page.inventory.unit')}</label>
            <select className="input" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}>
              <option value="kg">kg</option>
              <option value="pc">pc</option>
              <option value="m">m</option>
              <option value="sheet">sheet</option>
              <option value="lb">lb</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">{t('page.inventory.date')}</label>
          <input className="input" type="date" value={form.transaction_date}
            onChange={e => setForm({...form, transaction_date: e.target.value})} />
        </div>
        {showRef && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('page.inventory.referenceType')}</label>
              <select className="input" value={form.reference_type} onChange={e => setForm({...form, reference_type: e.target.value})}>
                <option value="">{t('page.inventory.none')}</option>
                <option value="order">{t('page.inventory.order')}</option>
                <option value="purchase_order">{t('page.inventory.purchaseOrder')}</option>
                <option value="production">{t('page.inventory.production')}</option>
              </select>
            </div>
            <div>
              <label className="label">{t('page.inventory.referenceIdOptional')}</label>
              <input className="input" placeholder={t('page.inventory.placeholderOrderId')} value={form.reference_id}
                onChange={e => setForm({...form, reference_id: e.target.value})} />
            </div>
          </div>
        )}
        <div>
          <label className="label">{t('page.inventory.notes')}</label>
          <input className="input" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder={t('page.inventory.placeholderNotes')} />
        </div>
        <div>
          <label className="label">{t('page.inventory.operator')}</label>
          <input className="input" value={form.operator} onChange={e => setForm({...form, operator: e.target.value})} placeholder={t('page.inventory.placeholderOperator')} />
        </div>
        <button onClick={submit} className="btn-primary">{title}</button>
      </div>
    </div>
  );
}
