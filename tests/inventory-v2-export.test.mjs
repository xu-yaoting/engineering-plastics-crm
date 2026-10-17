import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const tsx = path.join(root, 'node_modules', '.bin', 'tsx');
const packageUrl = pathToFileURL(path.join(root, 'package.json')).href;
const exportUrl = pathToFileURL(path.join(root, 'server', 'inventory', 'export.ts')).href;
const routeSource = readFileSync(path.join(root, 'server', 'routes', 'inventory.ts'), 'utf8');

test('inventory V2 exposes a read-only Excel export route', () => {
  assert.match(routeSource, /router\.get\('\/v2\/export\.xlsx'/);
  assert.match(routeSource, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  const exportSection = routeSource.slice(
    routeSource.indexOf("router.get('/v2/export.xlsx'"),
    routeSource.indexOf("router.post('/v2/items'"),
  );
  assert.doesNotMatch(exportSection, /INSERT|UPDATE|DELETE/i);
  assert.match(routeSource, /req\.query\.shape === 'sheet' \|\| req\.query\.shape === 'rod'/);
  assert.match(exportSection, /inventoryV2\.listStock\('sheet', q\)/);
  assert.match(exportSection, /inventoryV2\.listStock\('rod', q\)/);
  assert.match(exportSection, /shape \? \[shape\] : undefined/);
});

test('inventory workbook contains separate sheet and rod tabs with typed quantities and weight provenance', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'inventory-v2-export-'));
  const runner = path.join(directory, 'run.mts');
  writeFileSync(runner, `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(${JSON.stringify(packageUrl)});
    const XLSX = require('xlsx');
    const { exportInventoryWorkbook } = await import(${JSON.stringify(exportUrl)});
    const common = {
      standard_width_mm: null,
      standard_thickness_mm: null,
      standard_diameter_mm: null,
      standard_outer_diameter_mm: null,
      standard_inner_diameter_mm: null,
    };
    const sheetGroups = [{
      ...common,
      sku: 'PEEK-3150-1250-2', material_name: 'PEEK', shape: 'sheet',
      standard_length_mm: 3150, standard_width_mm: 1250, standard_thickness_mm: 2,
      items: [{
        id: 'sheet-1', inventory_type: 'remnant', length_mm: 1250, width_mm: 620, thickness_mm: 2,
        diameter_mm: null, outer_diameter_mm: null, inner_diameter_mm: null,
        estimated_weight_kg: 2.834, stored_estimated_weight_kg: 2.834, recommended_estimated_weight_kg: 2.834,
        actual_weight_kg: 2.855, actual_weight_min_kg: 2.85, actual_weight_max_kg: 2.86,
        measurement_sample_count: 2, measured_thickness_mm: 2.77, calculation_thickness_mm: 2.77,
        reference_thickness_mm: 2.5, reference_length_mm: 3150, reference_width_mm: 620,
        reference_unit_weight_kg: 6.4, reference_source: 'PEEK纯料板材尺寸表', reference_note: null,
        weight_basis: 'scale', display_weight_kg: 2.855,
        weight_status: 'actual', legacy_sku: null, parent_item_id: null, current_quantity: 3,
      }],
    }];
    const rodGroups = [{
      ...common,
      sku: 'PEEK-12-1000', material_name: 'PEEK', shape: 'rod',
      standard_length_mm: 1000, standard_diameter_mm: 12,
      items: [{
        id: 'rod-1', inventory_type: 'full_rod', length_mm: 1000, width_mm: null, thickness_mm: null,
        diameter_mm: 12, outer_diameter_mm: null, inner_diameter_mm: null,
        estimated_weight_kg: 0.149, stored_estimated_weight_kg: 0.149, recommended_estimated_weight_kg: 0.149,
        actual_weight_kg: null, actual_weight_min_kg: null, actual_weight_max_kg: null,
        measurement_sample_count: 0, measured_thickness_mm: null, calculation_thickness_mm: null,
        reference_thickness_mm: null, reference_length_mm: null, reference_width_mm: null,
        reference_unit_weight_kg: null, reference_source: null, reference_note: null,
        weight_basis: 'geometric', display_weight_kg: 0.149,
        weight_status: 'estimated', legacy_sku: 'PEEK-12-1000', parent_item_id: null, current_quantity: 10,
      }],
    }];
    const exported = exportInventoryWorkbook(sheetGroups, rodGroups, new Date('2026-09-09T01:02:03.000Z'));
    assert.equal(exported.filename, 'inventory-2026-09-09.xlsx');
    const workbook = XLSX.read(exported.buffer, { type: 'buffer' });
    assert.deepEqual(workbook.SheetNames, ['板材库存', '棒材库存']);
    const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets['板材库存'], { header: 1, raw: true });
    const rodRows = XLSX.utils.sheet_to_json(workbook.Sheets['棒材库存'], { header: 1, raw: true });
    assert.equal(sheetRows[3][0], '主体 SKU');
    assert.equal(sheetRows[4][3], '1250 × 620 × 2 mm');
    assert.equal(sheetRows[4][5], 3);
    assert.equal(typeof sheetRows[4][5], 'number');
    assert.equal(sheetRows[4][7], 2.855);
    assert.equal(sheetRows[4][8], 2.855);
    assert.equal(sheetRows[4][9], 8.565);
    assert.equal(sheetRows[4][10], '实际称重');
    const sheetHeaders = sheetRows[3];
    const column = (name) => sheetHeaders.indexOf(name);
    assert.equal(sheetRows[4][column('计算采用厚度（mm）')], 2.77);
    assert.equal(sheetRows[4][column('仓库实测厚度（mm）')], 2.77);
    assert.equal(sheetRows[4][column('实称最轻单重（kg/件）')], 2.85);
    assert.equal(sheetRows[4][column('实称最重单重（kg/件）')], 2.86);
    assert.equal(sheetRows[4][column('抽样件数')], 2);
    assert.equal(sheetRows[4][column('厂家参考整板规格')], '3150 × 620 mm');
    assert.equal(sheetRows[4][column('厂家参考厚度（mm）')], 2.5);
    assert.equal(sheetRows[4][column('厂家参考单重（kg/片）')], 6.4);
    assert.equal(sheetRows[4][column('厂家参考来源')], 'PEEK纯料板材尺寸表');
    assert.equal(sheetRows[4][column('建议预计单重（kg/件）')], 2.834);
    assert.equal(rodRows[4][3], 'Ø12 × 1000 mm');
    assert.equal(rodRows[4][10], '按尺寸和密度估算');
    const scopedSheet = exportInventoryWorkbook(sheetGroups, [], new Date('2026-09-09T01:02:03.000Z'), ['sheet']);
    assert.deepEqual(XLSX.read(scopedSheet.buffer, { type: 'buffer' }).SheetNames, ['板材库存']);
    const scopedRod = exportInventoryWorkbook([], rodGroups, new Date('2026-09-09T01:02:03.000Z'), ['rod']);
    assert.deepEqual(XLSX.read(scopedRod.buffer, { type: 'buffer' }).SheetNames, ['棒材库存']);
  `);
  try {
    execFileSync(tsx, [runner], { cwd: root, stdio: 'pipe' });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
