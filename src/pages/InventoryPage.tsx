import { useState, useEffect, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import SidePanel from '../components/shared/SidePanel';
import Icon from '../components/shared/Icon';
import Pagination from '../components/shared/Pagination';

const INVENTORY_LEDGER_PAGE_SIZE = 10;

type InventoryV2Shape = 'sheet' | 'rod';
type InventoryV2View = 'stock' | 'ledger';

type InventoryV2Item = {
  id: string;
  inventory_type: 'full_sheet' | 'full_rod' | 'full_tube' | 'remnant';
  length_mm: number | null;
  width_mm: number | null;
  thickness_mm: number | null;
  diameter_mm: number | null;
  outer_diameter_mm: number | null;
  inner_diameter_mm: number | null;
  estimated_weight_kg: number | null;
  stored_estimated_weight_kg: number | null;
  recommended_estimated_weight_kg: number | null;
  actual_weight_kg: number | null;
  actual_weight_min_kg: number | null;
  actual_weight_max_kg: number | null;
  measurement_sample_count: number;
  measured_thickness_mm: number | null;
  calculation_thickness_mm: number | null;
  reference_thickness_mm: number | null;
  reference_length_mm: number | null;
  reference_width_mm: number | null;
  reference_unit_weight_kg: number | null;
  reference_source: string | null;
  reference_note: string | null;
  weight_basis: 'scale' | 'measured_thickness' | 'supplier_reference' | 'tolerance_rule' | 'geometric' | 'legacy_estimate' | 'missing_rule';
  display_weight_kg: number | null;
  weight_status: 'estimated' | 'actual' | 'missing_rule';
  parent_item_id: string | null;
  current_quantity: number;
};

type InventoryV2Group = {
  id: string;
  sku: string;
  name: string;
  material_name: string;
  density_kg_m3: number | null;
  shape: InventoryV2Shape;
  standard_length_mm: number | null;
  standard_width_mm: number | null;
  standard_thickness_mm: number | null;
  standard_diameter_mm: number | null;
  unit: string;
  total_quantity: number;
  items: InventoryV2Item[];
};

type InventoryV2CreateForm = {
  mode: 'existing' | 'new';
  inventorySkuId: string;
  sku: string;
  materialName: string;
  densityKgM3: string;
  inventoryType: 'full_sheet' | 'full_rod' | 'remnant';
  standardLengthMm: string;
  standardWidthMm: string;
  standardThicknessMm: string;
  standardDiameterMm: string;
  lengthMm: string;
  widthMm: string;
  thicknessMm: string;
  diameterMm: string;
  quantity: string;
  actualWeightKg: string;
  notes: string;
};

type InventoryV2MeasurementForm = {
  measuredThicknessMm: string;
  actualWeightMinKg: string;
  actualWeightMaxKg: string;
  actualWeightAvgKg: string;
  sampleCount: string;
  measuredAt: string;
  notes: string;
};

function emptyInventoryV2CreateForm(shape: InventoryV2Shape): InventoryV2CreateForm {
  return {
    mode: 'existing',
    inventorySkuId: '',
    sku: '',
    materialName: '',
    densityKgM3: '',
    inventoryType: shape === 'sheet' ? 'full_sheet' : 'full_rod',
    standardLengthMm: '',
    standardWidthMm: '',
    standardThicknessMm: '',
    standardDiameterMm: '',
    lengthMm: '',
    widthMm: '',
    thicknessMm: '',
    diameterMm: '',
    quantity: '0',
    actualWeightKg: '',
    notes: '',
  };
}

function emptyInventoryV2MeasurementForm(): InventoryV2MeasurementForm {
  return {
    measuredThicknessMm: '',
    actualWeightMinKg: '',
    actualWeightMaxKg: '',
    actualWeightAvgKg: '',
    sampleCount: '1',
    measuredAt: new Date().toISOString().slice(0, 10),
    notes: '',
  };
}

function inventoryV2Dimensions(shape: InventoryV2Shape, item: InventoryV2Item | Record<string, any>) {
  if (shape === 'sheet') return `${item.length_mm ?? '—'} × ${item.width_mm ?? '—'} × ${item.thickness_mm ?? '—'} mm`;
  return `Ø${item.diameter_mm ?? '—'} × ${item.length_mm ?? '—'} mm`;
}

function InventoryV2Page() {
  const { t } = useTranslation();
  const [shape, setShape] = useState<InventoryV2Shape>('sheet');
  const [view, setView] = useState<InventoryV2View>('stock');
  const [search, setSearch] = useState('');
  const [expandedSkuId, setExpandedSkuId] = useState<string | null>(null);
  const [groups, setGroups] = useState<InventoryV2Group[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [unfilteredGroups, setUnfilteredGroups] = useState<InventoryV2Group[]>([]);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<{ group: InventoryV2Group; item: InventoryV2Item } | null>(null);
  const [operation, setOperation] = useState<'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT' | 'CUT'>('INBOUND');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [cutLength, setCutLength] = useState('');
  const [cutWidth, setCutWidth] = useState('');
  const [actualWeight, setActualWeight] = useState('');
  const [operationSaving, setOperationSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createOptions, setCreateOptions] = useState<InventoryV2Group[]>([]);
  const [createForm, setCreateForm] = useState<InventoryV2CreateForm>(() => emptyInventoryV2CreateForm('sheet'));
  const [createSaving, setCreateSaving] = useState(false);
  const [measurement, setMeasurement] = useState<{ group: InventoryV2Group; item: InventoryV2Item } | null>(null);
  const [measurementForm, setMeasurementForm] = useState<InventoryV2MeasurementForm>(emptyInventoryV2MeasurementForm);
  const [measurementSaving, setMeasurementSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [stockRes, ledgerRes, scopeRes] = await Promise.all([
        fetch(`/api/inventory/v2/stock?shape=${shape}&q=${encodeURIComponent(search)}`),
        fetch('/api/inventory/v2/ledger?limit=200'),
        search ? fetch(`/api/inventory/v2/stock?shape=${shape}`) : null,
      ]);
      if (!stockRes.ok || !ledgerRes.ok || (scopeRes && !scopeRes.ok)) throw new Error('Inventory V2 request failed');
      const nextGroups = await stockRes.json();
      const nextMovements = await ledgerRes.json();
      const nextScopeGroups = scopeRes ? await scopeRes.json() : nextGroups;
      setGroups(Array.isArray(nextGroups) ? nextGroups : []);
      setMovements(Array.isArray(nextMovements) ? nextMovements : []);
      setUnfilteredGroups(Array.isArray(nextScopeGroups) ? nextScopeGroups : []);
    } catch {
      setGroups([]);
      setMovements([]);
      setUnfilteredGroups([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(load, search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [shape, search]);

  const openOperation = (
    nextOperation: 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT' | 'CUT',
    group: InventoryV2Group,
    item: InventoryV2Item,
  ) => {
    setSelected({ group, item });
    setOperation(nextOperation);
    setQuantity(1);
    setNotes('');
    setCutLength(item.length_mm === null ? '' : String(item.length_mm));
    setCutWidth(item.width_mm === null ? '' : String(item.width_mm));
    setActualWeight('');
  };

  const submitOperation = async () => {
    if (!selected || !Number.isFinite(quantity) || quantity === 0) return;
    setOperationSaving(true);
    try {
      const isCut = operation === 'CUT';
      const payload = isCut ? {
        source_item_id: selected.item.id,
        quantity: Math.abs(quantity),
        length_mm: Number(cutLength),
        ...(selected.group.shape === 'sheet' ? {
          width_mm: Number(cutWidth),
          thickness_mm: selected.item.thickness_mm,
        } : { diameter_mm: selected.item.diameter_mm }),
        ...(actualWeight ? { actual_weight_kg: Number(actualWeight) } : {}),
        notes,
      } : {
        inventory_item_id: selected.item.id,
        movement_type: operation,
        quantity,
        notes,
      };
      const res = await fetch(isCut ? '/api/inventory/v2/cuts' : '/api/inventory/v2/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('page.inventory.v2.operationFailed'));
      toast.success(t('page.inventory.v2.operationSaved'));
      setSelected(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('page.inventory.v2.operationFailed'));
    } finally {
      setOperationSaving(false);
    }
  };

  const openMeasurement = (group: InventoryV2Group, item: InventoryV2Item) => {
    setMeasurement({ group, item });
    setMeasurementForm(emptyInventoryV2MeasurementForm());
  };

  const submitMeasurement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!measurement) return;
    setMeasurementSaving(true);
    try {
      const payload = {
        ...(measurement.group.shape === 'sheet' && measurementForm.measuredThicknessMm.trim()
          ? { measured_thickness_mm: Number(measurementForm.measuredThicknessMm) }
          : {}),
        ...(measurementForm.actualWeightMinKg.trim()
          ? { actual_unit_weight_min_kg: Number(measurementForm.actualWeightMinKg) }
          : {}),
        ...(measurementForm.actualWeightMaxKg.trim()
          ? { actual_unit_weight_max_kg: Number(measurementForm.actualWeightMaxKg) }
          : {}),
        ...(measurementForm.actualWeightAvgKg.trim()
          ? { actual_unit_weight_avg_kg: Number(measurementForm.actualWeightAvgKg) }
          : {}),
        sample_count: Number(measurementForm.sampleCount),
        measured_at: measurementForm.measuredAt,
        notes: measurementForm.notes.trim(),
      };
      const res = await fetch(`/api/inventory/v2/items/${measurement.item.id}/measurements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('page.inventory.v2.measurementFailed'));
      toast.success(t('page.inventory.v2.measurementSaved'));
      setMeasurement(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('page.inventory.v2.measurementFailed'));
    } finally {
      setMeasurementSaving(false);
    }
  };

  const openCreatePanel = async () => {
    setCreateOptions([]);
    setCreateForm(emptyInventoryV2CreateForm(shape));
    setCreateOpen(true);
    try {
      const res = await fetch(`/api/inventory/v2/stock?shape=${shape}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('page.inventory.v2.createOptionsFailed'));
      const options = Array.isArray(data) ? data : [];
      setCreateOptions(options);
      setCreateForm(current => ({
        ...current,
        mode: options.length > 0 ? 'existing' : 'new',
        inventorySkuId: options[0]?.id || '',
      }));
    } catch (error) {
      const fallback = search ? [] : groups;
      setCreateOptions(fallback);
      setCreateForm(current => ({
        ...current,
        mode: fallback.length > 0 ? 'existing' : 'new',
        inventorySkuId: fallback[0]?.id || '',
      }));
      toast.error(error instanceof Error ? error.message : t('page.inventory.v2.createOptionsFailed'));
    }
  };

  const submitCreateItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateSaving(true);
    try {
      const payload = {
        ...(createForm.mode === 'existing' ? {
          inventory_sku_id: createForm.inventorySkuId,
        } : {
          sku: createForm.sku.trim(),
          material_name: createForm.materialName.trim(),
          density_kg_m3: Number(createForm.densityKgM3),
          standard_length_mm: Number(createForm.standardLengthMm),
          ...(shape === 'sheet' ? {
            standard_width_mm: Number(createForm.standardWidthMm),
            standard_thickness_mm: Number(createForm.standardThicknessMm),
          } : {
            standard_diameter_mm: Number(createForm.standardDiameterMm),
          }),
        }),
        shape,
        inventory_type: createForm.inventoryType,
        length_mm: Number(createForm.lengthMm),
        ...(shape === 'sheet' ? {
          width_mm: Number(createForm.widthMm),
          thickness_mm: Number(createForm.thicknessMm),
        } : {
          diameter_mm: Number(createForm.diameterMm),
        }),
        quantity: Number(createForm.quantity),
        ...(createForm.actualWeightKg.trim() ? { actual_weight_kg: Number(createForm.actualWeightKg) } : {}),
        notes: createForm.notes.trim(),
      };
      const res = await fetch('/api/inventory/v2/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('page.inventory.v2.createFailed'));
      toast.success(t('page.inventory.v2.created'));
      setCreateOpen(false);
      setView('stock');
      setSearch('');
      setExpandedSkuId(data.sku?.id || null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('page.inventory.v2.createFailed'));
    } finally {
      setCreateSaving(false);
    }
  };

  const downloadInventory = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ shape });
      if (search.trim()) params.set('q', search.trim());
      const res = await fetch(`/api/inventory/v2/export.xlsx?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('page.inventory.v2.exportFailed'));
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'inventory.xlsx';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(t('page.inventory.v2.exportReady'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('page.inventory.v2.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const visibleItemIds = new Set(unfilteredGroups.flatMap(group => group.items.map(item => item.id)));
  const visibleMovements = movements.filter(movement => visibleItemIds.has(movement.inventory_item_id));
  const ledgerTotalPages = Math.max(1, Math.ceil(visibleMovements.length / INVENTORY_LEDGER_PAGE_SIZE));
  const ledgerSafePage = Math.min(Math.max(ledgerPage, 1), ledgerTotalPages);
  const pagedMovements = visibleMovements.slice(
    (ledgerSafePage - 1) * INVENTORY_LEDGER_PAGE_SIZE,
    ledgerSafePage * INVENTORY_LEDGER_PAGE_SIZE,
  );
  const searchActive = search.trim().length > 0;
  const showFilteredTotals = searchActive && unfilteredGroups.length > 0;
  const totalQuantity = groups.reduce((sum, group) => sum + Number(group.total_quantity || 0), 0);
  const totalWeight = groups.reduce((sum, group) => sum + group.items.reduce((itemSum, item) => (
    itemSum + Number(item.current_quantity || 0) * Number(item.display_weight_kg || 0)
  ), 0), 0);
  const unfilteredTotalQuantity = unfilteredGroups.reduce((sum, group) => sum + Number(group.total_quantity || 0), 0);
  const unfilteredTotalWeight = unfilteredGroups.reduce((sum, group) => sum + group.items.reduce((itemSum, item) => (
    itemSum + Number(item.current_quantity || 0) * Number(item.display_weight_kg || 0)
  ), 0), 0);
  const measurementHasEvidence = measurementForm.measuredThicknessMm.trim() !== ''
    || measurementForm.actualWeightMinKg.trim() !== ''
    || measurementForm.actualWeightMaxKg.trim() !== ''
    || measurementForm.actualWeightAvgKg.trim() !== '';

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="px-3">
          <h1 className="page-heading">{t('nav.inventory')}</h1>
          <p className="page-summary tabular-nums">
            {view === 'stock'
              ? `${groups.length}${showFilteredTotals ? ` / ${unfilteredGroups.length}` : ''} ${t('page.inventory.v2.masterSkus')} · ${totalQuantity}${showFilteredTotals ? ` / ${unfilteredTotalQuantity}` : ''} pc · ${totalWeight.toFixed(1)}${showFilteredTotals ? ` / ${unfilteredTotalWeight.toFixed(1)}` : ''} kg`
              : `${visibleMovements.length} ${t('page.inventory.v2.ledgerView')}`}
          </p>
        </div>
        <div className="page-actions px-3">
          <div className="segmented-control" role="tablist" aria-label={t('page.inventory.v2.views')}>
            {(['stock', 'ledger'] as InventoryV2View[]).map(item => (
              <button
                key={item}
                type="button"
                role="tab"
                id={`inventory-v2-view-${item}`}
                aria-selected={view === item}
                aria-controls="inventory-v2-panel"
                onClick={() => setView(item)}
                className={`segmented-option ${view === item ? 'segmented-option-active' : ''}`}
              >
                {t(`page.inventory.v2.${item}View`)}
              </button>
            ))}
          </div>
          <button type="button" onClick={openCreatePanel} className="btn-primary btn-sm">
            <Icon name="plus" size={14} className="mr-1.5" />
            {t('page.inventory.v2.addSpecification')}
          </button>
          <button type="button" onClick={downloadInventory} disabled={exporting} className="btn-secondary btn-sm">
            <Icon name="download" size={14} className="mr-1.5" />
            {exporting ? t('page.inventory.v2.exporting') : t('page.inventory.v2.exportExcel')}
          </button>
        </div>
      </div>

      <div id="inventory-v2-panel" role="tabpanel" aria-labelledby={`inventory-v2-view-${view}`}>
        <div className="toolbar">
          <div className="segmented-control" role="tablist" aria-label={t('page.inventory.v2.shapeTabs')}>
            {(['sheet', 'rod'] as InventoryV2Shape[]).map(item => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={shape === item}
                onClick={() => { setShape(item); setExpandedSkuId(null); setLedgerPage(1); }}
                className={`segmented-option ${shape === item ? 'segmented-option-active' : ''}`}
              >
                {t(`page.inventory.v2.${item}Tab`)}
              </button>
            ))}
          </div>
          {view === 'stock' && (
            <>
              <div className="relative min-w-0 flex-1 sm:max-w-sm">
                <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
                <label className="sr-only" htmlFor="inventory-v2-search">{t('page.inventory.v2.search')}</label>
                <input id="inventory-v2-search" value={search} onChange={event => { setSearch(event.target.value); setExpandedSkuId(null); }} className="input pl-9" placeholder={t('page.inventory.v2.search')} />
              </div>
              <button type="button" onClick={load} className="btn-secondary btn-sm"><Icon name="refresh" size={14} className="mr-1.5" />{t('common.refresh')}</button>
            </>
          )}
        </div>

        {view === 'stock' && (loading ? (
          <InventoryDashboardSkeleton label={t('common.loading')} />
        ) : loadError ? (
          <InventoryLoadError onRetry={load} />
        ) : groups.length === 0 ? (
          <div className="empty-state data-surface border-t-0 rounded-t-none">
            <p>{searchActive ? t('page.inventory.v2.noStockFiltered') : t('page.inventory.v2.noStock')}</p>
            {searchActive ? (
              <button type="button" onClick={() => setSearch('')} className="btn-secondary btn-sm">{t('common.clearSearch')}</button>
            ) : (
              <button type="button" onClick={openCreatePanel} className="btn-primary btn-sm"><Icon name="plus" size={14} className="mr-1.5" />{t('page.inventory.v2.addSpecification')}</button>
            )}
          </div>
        ) : (
          <div className="data-surface divide-y divide-border border-t-0 rounded-t-none">
            {groups.map(group => {
              const isExpanded = expandedSkuId === group.id;
              const itemsId = `inventory-v2-sku-items-${group.id}`;
              const groupWeight = group.items.reduce((sum, item) => sum + Number(item.current_quantity || 0) * Number(item.display_weight_kg || 0), 0);
              const hasGroupWeight = group.items.some(item => item.display_weight_kg !== null);
              return (
                <section key={group.id}>
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={itemsId}
                    onClick={() => setExpandedSkuId(isExpanded ? null : group.id)}
                    className={`w-full bg-surface-subtle px-4 py-2.5 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${isExpanded ? 'border-b border-border' : ''}`}
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 sm:grid-cols-[minmax(0,1fr)_160px_120px]">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span aria-hidden="true" className="shrink-0 text-ink-subtle">
                          <Icon name={isExpanded ? 'chevron-down' : 'chevron-right'} size={16} />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-ink">{group.sku}</div>
                          <div className="text-xs text-ink-muted">
                            {group.material_name} · {shape === 'sheet' ? `${group.standard_thickness_mm} mm` : `Ø${group.standard_diameter_mm} mm`} · {t('page.inventory.v2.specCount', { count: group.items.length })}
                            {hasGroupWeight && <span className="sm:hidden"> · {groupWeight.toFixed(1)} kg</span>}
                          </div>
                        </div>
                      </div>
                      <div className="hidden text-right text-xs tabular-nums text-ink-muted sm:block">{hasGroupWeight ? `${groupWeight.toFixed(1)} kg` : '—'}</div>
                      <div className="text-right text-sm font-semibold tabular-nums">{group.total_quantity} {group.unit || 'pc'}</div>
                    </div>
                  </button>
                  {isExpanded && (
                    <div id={itemsId} className="divide-y divide-border animate-[fadeIn_150ms_ease-out] motion-reduce:animate-none">
                      {group.items.map(item => (
                        <article key={item.id} className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(220px,1fr)_120px_90px_minmax(220px,280px)_auto] lg:items-center">
                          <div>
                            <div className="font-medium text-ink">{inventoryV2Dimensions(shape, item)}</div>
                            {item.parent_item_id && <div className="mt-1 text-2xs text-ink-subtle">{t('page.inventory.v2.fromCut')}</div>}
                          </div>
                          <div><div className="text-2xs text-ink-subtle">{t('page.inventory.type')}</div><div className="text-xs text-ink">{t(`page.inventory.v2.type.${item.inventory_type}`)}</div></div>
                          <div><div className="text-2xs text-ink-subtle">{t('page.inventory.qty')}</div><div className="font-semibold tabular-nums">{item.current_quantity}</div></div>
                          <div className="space-y-1">
                            <div className="text-2xs text-ink-subtle">{t(`page.inventory.v2.weightBasis.${item.weight_basis}`, { defaultValue: item.weight_basis })}</div>
                            <div className="text-xs font-medium tabular-nums text-ink">{item.display_weight_kg === null ? '—' : `${Number(item.display_weight_kg).toFixed(3)} kg / pc`}</div>
                            {item.actual_weight_min_kg !== null && item.actual_weight_max_kg !== null && item.actual_weight_min_kg !== item.actual_weight_max_kg && (
                              <div className="text-2xs tabular-nums text-ink-muted">{t('page.inventory.v2.scaleWeightRange')}: {Number(item.actual_weight_min_kg).toFixed(3)}–{Number(item.actual_weight_max_kg).toFixed(3)} kg / pc</div>
                            )}
                            {item.measured_thickness_mm !== null && (
                              <div className="text-2xs tabular-nums text-ink-muted">{t('page.inventory.v2.measuredThickness')}: {Number(item.measured_thickness_mm).toFixed(3)} mm</div>
                            )}
                            {item.reference_thickness_mm !== null && (
                              <div className="text-2xs tabular-nums text-ink-muted">
                                {t('page.inventory.v2.supplierReference')}: {item.reference_length_mm !== null && item.reference_width_mm !== null
                                  ? `${Number(item.reference_length_mm).toFixed(0)} × ${Number(item.reference_width_mm).toFixed(0)} × ${Number(item.reference_thickness_mm).toFixed(3)} mm`
                                  : `${Number(item.reference_thickness_mm).toFixed(3)} mm`}
                                {item.reference_unit_weight_kg !== null ? ` · ${Number(item.reference_unit_weight_kg).toFixed(3)} kg / pc` : ''}
                              </div>
                            )}
                            {item.weight_basis === 'legacy_estimate' && item.recommended_estimated_weight_kg !== null && (
                              <div className="text-2xs tabular-nums text-warning">{t('page.inventory.v2.recommendedEstimate')}: {Number(item.recommended_estimated_weight_kg).toFixed(3)} kg / pc</div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5 lg:justify-end">
                            <button type="button" onClick={() => openMeasurement(group, item)} className="btn-secondary btn-sm">{t('page.inventory.v2.recordMeasurement')}</button>
                            <button type="button" onClick={() => openOperation('INBOUND', group, item)} className="btn-secondary btn-sm">{t('page.inventory.stockInTab')}</button>
                            <button type="button" onClick={() => openOperation('OUTBOUND', group, item)} disabled={item.current_quantity <= 0} className="btn-secondary btn-sm">{t('page.inventory.stockOutTab')}</button>
                            <button type="button" onClick={() => openOperation('ADJUSTMENT', group, item)} className="btn-secondary btn-sm">{t('page.inventory.adjustmentTab')}</button>
                            <button type="button" onClick={() => openOperation('CUT', group, item)} disabled={item.current_quantity <= 0} className="btn-secondary btn-sm">{t('page.inventory.v2.cut')}</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        ))}

        {view === 'ledger' && (loading ? (
          <InventoryDashboardSkeleton label={t('common.loading')} />
        ) : loadError ? (
          <InventoryLoadError onRetry={load} />
        ) : (
          <div className="data-surface overflow-x-auto border-t-0 rounded-t-none">
            <table className="w-full min-w-[820px]">
              <thead className="sticky top-0 z-10"><tr><th className="table-header">{t('page.inventory.date')}</th><th className="table-header">{t('page.inventory.v2.movementNumber')}</th><th className="table-header">SKU</th><th className="table-header">{t('page.inventory.dimensions')}</th><th className="table-header">{t('page.inventory.type')}</th><th className="table-header text-right">{t('page.inventory.qty')}</th><th className="table-header">{t('page.inventory.notes')}</th></tr></thead>
              <tbody>
                {pagedMovements.map(movement => <tr key={movement.id} className="border-t border-border"><td className="table-cell whitespace-nowrap">{String(movement.occurred_at || '').slice(0, 10)}</td><td className="table-cell whitespace-nowrap tabular-nums">{movement.movement_number}</td><td className="table-cell font-medium">{movement.sku}</td><td className="table-cell">{inventoryV2Dimensions(shape, movement)}</td><td className="table-cell">{t(`page.inventory.v2.movement.${movement.movement_type}`, { defaultValue: movement.movement_type })}</td><td className={`table-cell text-right tabular-nums ${Number(movement.quantity_delta) < 0 ? 'text-danger' : 'text-success'}`}>{Number(movement.quantity_delta) > 0 ? '+' : ''}{movement.quantity_delta}</td><td className="table-cell text-ink-muted">{movement.notes || '—'}</td></tr>)}
                {visibleMovements.length === 0 && <tr><td colSpan={7}><div className="empty-state">{t('page.inventory.noTransactions')}</div></td></tr>}
              </tbody>
            </table>
            {visibleMovements.length > 0 && (
              <Pagination page={ledgerSafePage} pageSize={INVENTORY_LEDGER_PAGE_SIZE} total={visibleMovements.length} onPageChange={setLedgerPage} />
            )}
          </div>
        ))}
      </div>

      <SidePanel open={!!selected} onClose={() => !operationSaving && setSelected(null)} title={operation === 'CUT' ? t('page.inventory.v2.recordCut') : t(`page.inventory.v2.operation.${operation}`)} subtitle={selected ? `${selected.group.sku} · ${inventoryV2Dimensions(selected.group.shape, selected.item)}` : undefined}>
        {selected && <div className="space-y-4"><div><label className="label" htmlFor="inventory-v2-operation-quantity">{operation === 'ADJUSTMENT' ? t('page.inventory.v2.adjustmentQuantity') : t('page.inventory.qty')}</label><input id="inventory-v2-operation-quantity" type="number" step="1" value={quantity} min={operation === 'ADJUSTMENT' ? undefined : 1} onChange={event => setQuantity(Number(event.target.value))} className="input" /></div>{operation === 'CUT' && <><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><label className="label" htmlFor="inventory-v2-cut-length">{t('page.inventory.length')}</label><input id="inventory-v2-cut-length" type="number" min="0.001" step="0.001" value={cutLength} onChange={event => setCutLength(event.target.value)} className="input" /></div>{selected.group.shape === 'sheet' && <div><label className="label" htmlFor="inventory-v2-cut-width">{t('page.inventory.width')}</label><input id="inventory-v2-cut-width" type="number" min="0.001" step="0.001" value={cutWidth} onChange={event => setCutWidth(event.target.value)} className="input" /></div>}</div><div><label className="label" htmlFor="inventory-v2-cut-actual-weight">{t('page.inventory.v2.actualWeightOptional')}</label><input id="inventory-v2-cut-actual-weight" type="number" min="0" step="0.001" value={actualWeight} onChange={event => setActualWeight(event.target.value)} className="input" /></div><div className="rounded-lg bg-brand-soft p-3 text-xs text-brand-700">{t('page.inventory.v2.cutLineageHelp')}</div></>}<div><label className="label" htmlFor="inventory-v2-operation-notes">{t('page.inventory.notes')}</label><textarea id="inventory-v2-operation-notes" value={notes} onChange={event => setNotes(event.target.value)} className="input min-h-24" /></div><div className="sticky bottom-0 flex gap-2 border-t border-border bg-surface pt-4"><button type="button" onClick={() => setSelected(null)} disabled={operationSaving} className="btn-secondary flex-1">{t('common.cancel')}</button><button type="button" onClick={submitOperation} disabled={operationSaving || quantity === 0} className="btn-primary flex-1">{operationSaving ? t('page.inventory.saving') : t('common.save')}</button></div></div>}
      </SidePanel>

      <SidePanel
        open={!!measurement}
        onClose={() => !measurementSaving && setMeasurement(null)}
        title={t('page.inventory.v2.recordMeasurement')}
        subtitle={measurement ? `${measurement.group.sku} · ${inventoryV2Dimensions(measurement.group.shape, measurement.item)}` : undefined}
        width="w-[min(520px,calc(100vw-1rem))]"
      >
        {measurement && (
          <form onSubmit={submitMeasurement} className="space-y-5">
            <div className="rounded-lg bg-brand-soft p-3 text-xs text-brand-700">{t('page.inventory.v2.measurementHelp')}</div>
            {measurement.group.shape === 'sheet' && (
              <div>
                <label className="label" htmlFor="inventory-v2-measured-thickness">{t('page.inventory.v2.measuredThicknessOptional')}</label>
                <input id="inventory-v2-measured-thickness" type="number" min="0.001" step="0.001" value={measurementForm.measuredThicknessMm} onChange={event => setMeasurementForm(current => ({ ...current, measuredThicknessMm: event.target.value }))} className="input" />
              </div>
            )}
            <fieldset className="space-y-3 rounded-lg border border-border p-4">
              <legend className="section-label px-1">{t('page.inventory.v2.scaleWeightRange')}</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div><label className="label" htmlFor="inventory-v2-actual-weight-min">{t('page.inventory.v2.actualWeightMin')}</label><input id="inventory-v2-actual-weight-min" type="number" min="0.001" step="0.001" value={measurementForm.actualWeightMinKg} onChange={event => setMeasurementForm(current => ({ ...current, actualWeightMinKg: event.target.value }))} className="input" /></div>
                <div><label className="label" htmlFor="inventory-v2-actual-weight-max">{t('page.inventory.v2.actualWeightMax')}</label><input id="inventory-v2-actual-weight-max" type="number" min="0.001" step="0.001" value={measurementForm.actualWeightMaxKg} onChange={event => setMeasurementForm(current => ({ ...current, actualWeightMaxKg: event.target.value }))} className="input" /></div>
                <div><label className="label" htmlFor="inventory-v2-actual-weight-average">{t('page.inventory.v2.actualWeightAverage')}</label><input id="inventory-v2-actual-weight-average" type="number" min="0.001" step="0.001" value={measurementForm.actualWeightAvgKg} onChange={event => setMeasurementForm(current => ({ ...current, actualWeightAvgKg: event.target.value }))} className="input" /></div>
              </div>
            </fieldset>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className="label" htmlFor="inventory-v2-measurement-sample-count">{t('page.inventory.v2.sampleCount')}</label><input id="inventory-v2-measurement-sample-count" required type="number" min="1" step="1" value={measurementForm.sampleCount} onChange={event => setMeasurementForm(current => ({ ...current, sampleCount: event.target.value }))} className="input" /></div>
              <div><label className="label" htmlFor="inventory-v2-measured-at">{t('page.inventory.v2.measuredAt')}</label><input id="inventory-v2-measured-at" required type="date" value={measurementForm.measuredAt} onChange={event => setMeasurementForm(current => ({ ...current, measuredAt: event.target.value }))} className="input" /></div>
            </div>
            <div><label className="label" htmlFor="inventory-v2-measurement-notes">{t('page.inventory.notes')}</label><textarea id="inventory-v2-measurement-notes" value={measurementForm.notes} onChange={event => setMeasurementForm(current => ({ ...current, notes: event.target.value }))} className="input min-h-24" /></div>
            <div className="sticky bottom-0 flex gap-2 border-t border-border bg-surface pt-4">
              <button type="button" onClick={() => setMeasurement(null)} disabled={measurementSaving} className="btn-secondary flex-1">{t('common.cancel')}</button>
              <button type="submit" disabled={measurementSaving || !measurementHasEvidence} className="btn-primary flex-1">{measurementSaving ? t('page.inventory.saving') : t('common.save')}</button>
            </div>
          </form>
        )}
      </SidePanel>

      <SidePanel
        open={createOpen}
        onClose={() => !createSaving && setCreateOpen(false)}
        title={t('page.inventory.v2.addSpecification')}
        subtitle={t(`page.inventory.v2.${shape}Tab`)}
        width="w-[min(520px,calc(100vw-1rem))]"
      >
        <form onSubmit={submitCreateItem} className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="label">{t('page.inventory.v2.masterSkuSource')}</legend>
            <div className="grid grid-cols-2 gap-2">
              <label className={`cursor-pointer rounded-lg border p-3 ${createForm.mode === 'existing' ? 'border-brand bg-brand-soft' : 'border-border'}`}>
                <input
                  type="radio"
                  name="inventory-v2-sku-source"
                  value="existing"
                  checked={createForm.mode === 'existing'}
                  disabled={createOptions.length === 0}
                  onChange={() => setCreateForm(current => ({ ...current, mode: 'existing' }))}
                  className="mr-2"
                />
                <span className="text-sm font-medium">{t('page.inventory.v2.existingMasterSku')}</span>
              </label>
              <label className={`cursor-pointer rounded-lg border p-3 ${createForm.mode === 'new' ? 'border-brand bg-brand-soft' : 'border-border'}`}>
                <input
                  type="radio"
                  name="inventory-v2-sku-source"
                  value="new"
                  checked={createForm.mode === 'new'}
                  onChange={() => setCreateForm(current => ({ ...current, mode: 'new' }))}
                  className="mr-2"
                />
                <span className="text-sm font-medium">{t('page.inventory.v2.newMasterSku')}</span>
              </label>
            </div>
          </fieldset>

          {createForm.mode === 'existing' ? (
            <div>
              <label className="label" htmlFor="inventory-v2-existing-sku">{t('page.inventory.v2.masterSku')}</label>
              <select
                id="inventory-v2-existing-sku"
                required
                value={createForm.inventorySkuId}
                onChange={event => setCreateForm(current => ({ ...current, inventorySkuId: event.target.value }))}
                className="input"
              >
                {createOptions.map(group => <option key={group.id} value={group.id}>{group.sku} · {group.material_name}</option>)}
              </select>
            </div>
          ) : (
            <fieldset className="space-y-3 rounded-lg border border-border p-4">
              <legend className="section-label px-1">{t('page.inventory.v2.newMasterSku')}</legend>
              <div>
                <label className="label" htmlFor="inventory-v2-new-sku">{t('page.inventory.v2.masterSku')}</label>
                <input id="inventory-v2-new-sku" required value={createForm.sku} onChange={event => setCreateForm(current => ({ ...current, sku: event.target.value }))} className="input" placeholder={shape === 'sheet' ? 'PEEK-3150-1250-2' : 'PEEK-12-1000'} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><label className="label" htmlFor="inventory-v2-material">{t('page.inventory.v2.materialName')}</label><input id="inventory-v2-material" required value={createForm.materialName} onChange={event => setCreateForm(current => ({ ...current, materialName: event.target.value }))} className="input" placeholder="PEEK" /></div>
                <div><label className="label" htmlFor="inventory-v2-density">{t('page.inventory.v2.density')}</label><input id="inventory-v2-density" required type="number" min="0.001" step="0.001" value={createForm.densityKgM3} onChange={event => setCreateForm(current => ({ ...current, densityKgM3: event.target.value }))} className="input" /></div>
              </div>
              <p className="text-2xs text-ink-muted">{t('page.inventory.v2.densityHelp')}</p>
              <div className={`grid grid-cols-1 gap-3 ${shape === 'sheet' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                <div><label className="label" htmlFor="inventory-v2-standard-length">{t('page.inventory.v2.standardLength')}</label><input id="inventory-v2-standard-length" required type="number" min="0.001" step="0.001" value={createForm.standardLengthMm} onChange={event => setCreateForm(current => ({ ...current, standardLengthMm: event.target.value }))} className="input" /></div>
                {shape === 'sheet' ? <>
                  <div><label className="label" htmlFor="inventory-v2-standard-width">{t('page.inventory.v2.standardWidth')}</label><input id="inventory-v2-standard-width" required type="number" min="0.001" step="0.001" value={createForm.standardWidthMm} onChange={event => setCreateForm(current => ({ ...current, standardWidthMm: event.target.value }))} className="input" /></div>
                  <div><label className="label" htmlFor="inventory-v2-standard-thickness">{t('page.inventory.v2.standardThickness')}</label><input id="inventory-v2-standard-thickness" required type="number" min="0.001" step="0.001" value={createForm.standardThicknessMm} onChange={event => setCreateForm(current => ({ ...current, standardThicknessMm: event.target.value }))} className="input" /></div>
                </> : <div><label className="label" htmlFor="inventory-v2-standard-diameter">{t('page.inventory.v2.standardDiameter')}</label><input id="inventory-v2-standard-diameter" required type="number" min="0.001" step="0.001" value={createForm.standardDiameterMm} onChange={event => setCreateForm(current => ({ ...current, standardDiameterMm: event.target.value }))} className="input" /></div>}
              </div>
            </fieldset>
          )}

          <fieldset className="space-y-3 rounded-lg border border-border p-4">
            <legend className="section-label px-1">{t('page.inventory.v2.actualSpecification')}</legend>
            <div>
              <label className="label" htmlFor="inventory-v2-create-type">{t('page.inventory.type')}</label>
              <select id="inventory-v2-create-type" value={createForm.inventoryType} onChange={event => setCreateForm(current => ({ ...current, inventoryType: event.target.value as InventoryV2CreateForm['inventoryType'] }))} className="input">
                <option value={shape === 'sheet' ? 'full_sheet' : 'full_rod'}>{t(`page.inventory.v2.type.${shape === 'sheet' ? 'full_sheet' : 'full_rod'}`)}</option>
                <option value="remnant">{t('page.inventory.v2.type.remnant')}</option>
              </select>
            </div>
            <div className={`grid grid-cols-1 gap-3 ${shape === 'sheet' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
              <div><label className="label" htmlFor="inventory-v2-create-length">{t('page.inventory.length')}</label><input id="inventory-v2-create-length" required type="number" min="0.001" step="0.001" value={createForm.lengthMm} onChange={event => setCreateForm(current => ({ ...current, lengthMm: event.target.value }))} className="input" /></div>
              {shape === 'sheet' ? <>
                <div><label className="label" htmlFor="inventory-v2-create-width">{t('page.inventory.width')}</label><input id="inventory-v2-create-width" required type="number" min="0.001" step="0.001" value={createForm.widthMm} onChange={event => setCreateForm(current => ({ ...current, widthMm: event.target.value }))} className="input" /></div>
                <div><label className="label" htmlFor="inventory-v2-create-thickness">{t('page.inventory.thickness')}</label><input id="inventory-v2-create-thickness" required type="number" min="0.001" step="0.001" value={createForm.thicknessMm} onChange={event => setCreateForm(current => ({ ...current, thicknessMm: event.target.value }))} className="input" /></div>
              </> : <div><label className="label" htmlFor="inventory-v2-create-diameter">{t('page.inventory.diameter')}</label><input id="inventory-v2-create-diameter" required type="number" min="0.001" step="0.001" value={createForm.diameterMm} onChange={event => setCreateForm(current => ({ ...current, diameterMm: event.target.value }))} className="input" /></div>}
            </div>
            <p className="text-2xs text-ink-muted">{t('page.inventory.v2.actualSpecificationHelp')}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className="label" htmlFor="inventory-v2-create-quantity">{t('page.inventory.v2.initialQuantity')}</label><input id="inventory-v2-create-quantity" required type="number" min="0" step="1" value={createForm.quantity} onChange={event => setCreateForm(current => ({ ...current, quantity: event.target.value }))} className="input" /></div>
              <div><label className="label" htmlFor="inventory-v2-create-actual-weight">{t('page.inventory.v2.actualWeightOptional')}</label><input id="inventory-v2-create-actual-weight" type="number" min="0.001" step="0.001" value={createForm.actualWeightKg} onChange={event => setCreateForm(current => ({ ...current, actualWeightKg: event.target.value }))} className="input" /></div>
            </div>
            <p className="text-2xs text-ink-muted">{t('page.inventory.v2.actualWeightHelp')}</p>
            <div><label className="label" htmlFor="inventory-v2-create-notes">{t('page.inventory.notes')}</label><textarea id="inventory-v2-create-notes" value={createForm.notes} onChange={event => setCreateForm(current => ({ ...current, notes: event.target.value }))} className="input min-h-20" /></div>
          </fieldset>

          <div className="sticky bottom-0 flex gap-2 border-t border-border bg-surface pt-4">
            <button type="button" onClick={() => setCreateOpen(false)} disabled={createSaving} className="btn-secondary flex-1">{t('common.cancel')}</button>
            <button type="submit" disabled={createSaving || (createForm.mode === 'existing' && !createForm.inventorySkuId)} className="btn-primary flex-1">{createSaving ? t('page.inventory.saving') : t('common.save')}</button>
          </div>
        </form>
      </SidePanel>
    </div>
  );
}

export default function InventoryPage() {
  return <InventoryV2Page />;
}


function InventoryDashboardSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="data-surface border-t-0 rounded-t-none">
      <div aria-hidden="true" className="animate-pulse divide-y divide-border motion-reduce:animate-none">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-40 max-w-full rounded bg-border-strong" />
              <div className="h-2.5 w-56 max-w-full rounded bg-surface-hover" />
            </div>
            <div className="h-3 w-14 shrink-0 rounded bg-border-strong" />
          </div>
        ))}
      </div>
    </div>
  );
}

function InventoryLoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="data-surface border-t-0 rounded-t-none p-6" role="alert">
      <div className="empty-state">
        <p>{t('page.error.loadFailed')}</p>
        <button type="button" onClick={onRetry} className="btn-secondary btn-sm mt-3">
          <Icon name="refresh" size={14} className="mr-1.5" />
          {t('common.refresh')}
        </button>
      </div>
    </div>
  );
}
