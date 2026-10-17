import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pageSource = readFileSync(new URL('../src/pages/InventoryPage.tsx', import.meta.url), 'utf8');
const dictionarySource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');
const v2Source = pageSource.slice(pageSource.indexOf('function InventoryV2Page'));

test('inventory page defaults to the isolated V2 workspace', () => {
  assert.match(pageSource, /export default function InventoryPage\(\) \{\s*return <InventoryV2Page \/>/);
  assert.doesNotMatch(pageSource, /function LegacyInventoryPage|function DashboardTab|function ProductsTab|function StockForm|function TransactionForm|function ImportTab/);
  assert.match(v2Source, /\['sheet', 'rod'\]/);
  assert.match(v2Source, /aria-selected=\{shape === item\}/);
  assert.match(v2Source, /group\.items\.map/);
  assert.match(v2Source, /standard_thickness_mm/);
  assert.match(v2Source, /standard_diameter_mm/);
});

test('master SKU rows are single-open accessible collapsible panels', () => {
  assert.match(v2Source, /const \[expandedSkuId, setExpandedSkuId\] = useState<string \| null>\(null\)/);
  assert.match(v2Source, /const isExpanded = expandedSkuId === group\.id/);
  assert.match(v2Source, /aria-expanded=\{isExpanded\}/);
  assert.match(v2Source, /aria-controls=\{itemsId\}/);
  assert.match(v2Source, /setExpandedSkuId\(isExpanded \? null : group\.id\)/);
  assert.match(v2Source, /\{isExpanded && \(/);
  assert.match(v2Source, /name=\{isExpanded \? 'chevron-down' : 'chevron-right'\}/);
  assert.ok((v2Source.match(/setExpandedSkuId\(null\)/g) || []).length >= 2);
});

test('V2 UI only calls isolated inventory endpoints', () => {
  assert.match(v2Source, /\/api\/inventory\/v2\/stock/);
  assert.match(v2Source, /\/api\/inventory\/v2\/ledger/);
  assert.match(v2Source, /\/api\/inventory\/v2\/movements/);
  assert.match(v2Source, /\/api\/inventory\/v2\/cuts/);
  assert.doesNotMatch(v2Source, /\/api\/(companies|inquiries|quotations|orders|shipments|payments)/);
  assert.doesNotMatch(v2Source, /reference_type|reference_id|customer_id|order_id/);
});

test('V2 uses manual stock specification entry and a read-only Excel download', () => {
  assert.match(v2Source, /\/api\/inventory\/v2\/items/);
  assert.match(v2Source, /\/api\/inventory\/v2\/export\.xlsx/);
  assert.match(v2Source, /new URLSearchParams\(\{ shape \}\)/);
  assert.match(v2Source, /inventory_sku_id: createForm\.inventorySkuId/);
  assert.match(v2Source, /actual_weight_kg: Number\(createForm\.actualWeightKg\)/);
  assert.match(v2Source, /URL\.createObjectURL\(blob\)/);
  assert.match(v2Source, /downloadInventory/);
  assert.doesNotMatch(v2Source, /\/api\/inventory\/v2\/import\/(preview|confirm)/);
  assert.doesNotMatch(v2Source, /\['stock', 'ledger', 'import'\]/);
});

test('manual entry supports existing and new master SKUs with labeled shape-specific dimensions', () => {
  assert.match(v2Source, /createForm\.mode === 'existing'/);
  assert.match(v2Source, /createForm\.mode === 'new'/);
  assert.match(v2Source, /inventory-v2-existing-sku/);
  assert.match(v2Source, /inventory-v2-new-sku/);
  assert.match(v2Source, /inventory-v2-standard-thickness/);
  assert.match(v2Source, /inventory-v2-standard-diameter/);
  assert.match(v2Source, /inventory-v2-create-actual-weight/);
  assert.match(v2Source, /<SidePanel[\s\S]*createOpen/);
  for (const key of ['addSpecification', 'exportExcel', 'actualWeightHelp', 'densityHelp']) {
    assert.match(dictionarySource, new RegExp(`${key}:`));
  }
});

test('V2 exposes weight evidence and the four allowed inventory types', () => {
  assert.match(pageSource, /actual_weight_kg/);
  assert.match(pageSource, /estimated_weight_kg/);
  assert.match(v2Source, /weight_basis/);
  for (const type of ['full_sheet', 'full_rod', 'full_tube', 'remnant']) {
    assert.match(dictionarySource, new RegExp(`${type}:`));
  }
});

test('stock rows explain the displayed weight source without overwriting legacy estimates', () => {
  assert.match(v2Source, /weight_basis/);
  assert.match(v2Source, /page\.inventory\.v2\.weightBasis/);
  assert.match(v2Source, /measured_thickness_mm/);
  assert.match(v2Source, /reference_thickness_mm/);
  assert.match(v2Source, /recommended_estimated_weight_kg/);
  assert.match(v2Source, /legacy_estimate/);
  assert.match(v2Source, /page\.inventory\.v2\.recommendedEstimate/);
});

test('each actual specification can record labeled warehouse measurements in a side panel', () => {
  assert.match(v2Source, /openMeasurement\(group, item\)/);
  assert.match(v2Source, /\/api\/inventory\/v2\/items\/\$\{measurement\.item\.id\}\/measurements/);
  assert.match(v2Source, /<form onSubmit=\{submitMeasurement\}/);
  for (const id of [
    'inventory-v2-measured-thickness',
    'inventory-v2-actual-weight-min',
    'inventory-v2-actual-weight-max',
    'inventory-v2-actual-weight-average',
    'inventory-v2-measurement-sample-count',
       'inventory-v2-measured-at',
          'inventory-v2-measurement-notes',
  ]) {
    assert.match(v2Source, new RegExp(`htmlFor="${id}"`));
    assert.match(v2Source, new RegExp(`id="${id}"`));
  }
  assert.match(v2Source, /measured_thickness_mm/);
  assert.match(v2Source, /actual_unit_weight_min_kg/);
  assert.match(v2Source, /actual_unit_weight_max_kg/);
  assert.match(v2Source, /actual_unit_weight_avg_kg/);
  assert.match(v2Source, /sample_count/);
  assert.match(v2Source, /measured_at/);
  assert.match(v2Source, /measurementSaved/);
  assert.match(v2Source, /measurementFailed/);
});

test('V2 cutting form records remnant dimensions and explains lineage', () => {
  assert.match(v2Source, /source_item_id: selected\.item\.id/);
  assert.match(v2Source, /inventory-v2-cut-length/);
  assert.match(v2Source, /inventory-v2-cut-width/);
  assert.match(v2Source, /cutLineageHelp/);
  assert.match(v2Source, /parent_item_id/);
});
