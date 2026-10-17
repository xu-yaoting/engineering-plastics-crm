import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const tsx = path.join(root, 'node_modules', '.bin', 'tsx');
const packageUrl = pathToFileURL(path.join(root, 'package.json')).href;
const schemaUrl = pathToFileURL(path.join(root, 'server', 'inventory', 'schema.ts')).href;
const serviceUrl = pathToFileURL(path.join(root, 'server', 'inventory', 'service.ts')).href;
const routeSource = readFileSync(path.join(root, 'server', 'routes', 'inventory.ts'), 'utf8');

test('inventory V2 router exposes isolated stock, weight review, measurement, movement, cut, and rule endpoints', () => {
  for (const route of ['/v2/stock', '/v2/weight-review', '/v2/ledger', '/v2/items/:id/measurements', '/v2/movements', '/v2/cuts', '/v2/rules']) {
    assert.match(routeSource, new RegExp(route.replaceAll('/', '\\/')));
  }
  const v2Section = routeSource.slice(routeSource.indexOf('// ─── Inventory V2'));
  assert.doesNotMatch(v2Section, /company_id|customer_id|quotation_id|order_id|shipment_id|invoice_id|payment_id/);
});

test('weight review is a read-only before-and-after preview that excludes actual weights', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'inventory-v2-weight-review-'));
  const runner = path.join(directory, 'run.mts');
  writeFileSync(runner, `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(${JSON.stringify(packageUrl)});
    const Database = require('better-sqlite3');
    const { ensureInventoryV2Schema } = await import(${JSON.stringify(schemaUrl)});
    const { createInventoryV2Service } = await import(${JSON.stringify(serviceUrl)});
    const database = new Database(':memory:');
    database.pragma('foreign_keys = ON');
    ensureInventoryV2Schema(database);
    const now = '2026-09-09T00:00:00.000Z';
    database.prepare(\`
      INSERT INTO inventory_skus (
        id, sku, name, material_name, density_kg_m3, shape,
        standard_length_mm, standard_width_mm, standard_thickness_mm,
        unit, source, created_at, updated_at
      ) VALUES ('review-sku', 'PEEK-3150-1250-6', 'PEEK sheet 6 mm', 'PEEK', 1320, 'sheet', 3150, 1250, 6, 'pc', 'legacy', ?, ?)
    \`).run(now, now);
    const insertItem = database.prepare(\`
      INSERT INTO inventory_items (
        id, inventory_sku_id, inventory_type, length_mm, width_mm, thickness_mm,
        estimated_weight_kg, actual_weight_kg, weight_status, mapping_status, created_at, updated_at
      ) VALUES (?, 'review-sku', 'full_sheet', 3150, 1250, 6, ?, ?, ?, 'auto_matched', ?, ?)
    \`);
    insertItem.run('legacy-estimate', 35.343, null, 'estimated', now, now);
    insertItem.run('scale-weight', 35.343, 34.5, 'actual', now, now);
    const insertMovement = database.prepare(\`
      INSERT INTO inventory_movements (
        id, movement_number, movement_type, inventory_item_id, quantity_delta,
        estimated_weight_delta_kg, actual_weight_delta_kg, occurred_at, created_at
      ) VALUES (?, ?, 'OPENING', ?, ?, ?, ?, ?, ?)
    \`);
    insertMovement.run('movement-legacy', 'OPEN-REVIEW-1', 'legacy-estimate', 2, 70.686, null, now, now);
    insertMovement.run('movement-scale', 'OPEN-REVIEW-2', 'scale-weight', 1, 35.343, 34.5, now, now);

    const service = createInventoryV2Service(database);
    const before = database.prepare('SELECT id, estimated_weight_kg, actual_weight_kg, updated_at FROM inventory_items ORDER BY id').all();
    const review = service.listWeightReview();
    assert.deepEqual(review.summary, {
      review_item_count: 1,
      affected_quantity: 2,
      current_total_weight_kg: 70.686,
      recommended_total_weight_kg: 68.608,
      difference_total_weight_kg: -2.078,
    });
    assert.equal(review.items[0].inventory_item_id, 'legacy-estimate');
    assert.equal(review.items[0].sku, 'PEEK-3150-1250-6');
    assert.equal(review.items[0].current_estimated_weight_kg, 35.343);
    assert.equal(review.items[0].recommended_estimated_weight_kg, 34.304);
    assert.equal(review.items[0].difference_unit_weight_kg, -1.039);
    assert.equal(review.items[0].recommended_weight_basis, 'supplier_reference');
    assert.equal(review.items[0].reference_thickness_mm, 6.6);
    assert.deepEqual(
      database.prepare('SELECT id, estimated_weight_kg, actual_weight_kg, updated_at FROM inventory_items ORDER BY id').all(),
      before,
    );
    database.close();
  `);
  try {
    execFileSync(tsx, [runner], { cwd: root, stdio: 'pipe' });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('inventory V2 measurement route maps thickness and scale evidence without rewriting a master SKU', () => {
  const measurementRoute = routeSource.slice(
    routeSource.indexOf("router.post('/v2/items/:id/measurements'"),
    routeSource.indexOf("router.post('/v2/movements'"),
  );
  assert.match(measurementRoute, /recordMeasurement/);
  assert.match(measurementRoute, /measured_thickness_mm/);
  assert.match(measurementRoute, /actual_unit_weight_min_kg/);
  assert.match(measurementRoute, /actual_unit_weight_max_kg/);
  assert.match(measurementRoute, /actual_unit_weight_avg_kg/);
  assert.match(measurementRoute, /sample_count/);
  assert.match(measurementRoute, /measured_at/);
  assert.doesNotMatch(measurementRoute, /inventory_skus|standard_thickness_mm/);
});

test('inventory V2 groups actual dimensions and cuts remnants atomically', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'inventory-v2-api-'));
  const runner = path.join(directory, 'run.mts');
  writeFileSync(runner, `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(${JSON.stringify(packageUrl)});
    const Database = require('better-sqlite3');
    const { ensureInventoryV2Schema } = await import(${JSON.stringify(schemaUrl)});
    const { createInventoryV2Service } = await import(${JSON.stringify(serviceUrl)});
    const database = new Database(':memory:');
    database.pragma('foreign_keys = ON');
    ensureInventoryV2Schema(database);
    const now = '2026-09-08T00:00:00.000Z';
    database.prepare(\`
      INSERT INTO inventory_skus (
        id, sku, name, material_name, density_kg_m3, shape,
        standard_length_mm, standard_width_mm, standard_thickness_mm,
        unit, source, created_at, updated_at
      ) VALUES ('s1', 'PEEK-3150-1250-10', 'PEEK sheet', 'PEEK', 1320, 'sheet', 3150, 1250, 10, 'pc', 'manual', ?, ?)
    \`).run(now, now);
    database.prepare(\`
      INSERT INTO inventory_items (
        id, inventory_sku_id, inventory_type, length_mm, width_mm, thickness_mm,
        estimated_weight_kg, weight_status, mapping_status, created_at, updated_at
      ) VALUES ('source', 's1', 'full_sheet', 3150, 620, 10, 27.842, 'estimated', 'auto_matched', ?, ?)
    \`).run(now, now);
    database.prepare(\`
      INSERT INTO inventory_movements (
        id, movement_number, movement_type, inventory_item_id, quantity_delta,
        estimated_weight_delta_kg, occurred_at, created_at
      ) VALUES ('opening', 'OPEN-1', 'OPENING', 'source', 3, 83.526, ?, ?)
    \`).run(now, now);
    const service = createInventoryV2Service(database);
    const before = service.listStock('sheet', '3150 620 10');
    assert.equal(before.length, 1);
    assert.equal(before[0].total_quantity, 3);
    assert.equal(before[0].items.length, 1);

    const cut = service.cut({ sourceItemId: 'source', quantity: 1, lengthMm: 2150, widthMm: 620, notes: 'test cut' });
    assert.equal(cut.sourceMovement.movement_type, 'CUT_CONSUME');
    assert.equal(cut.remnantMovement.movement_type, 'CUT_REMNANT_CREATE');
    assert.equal(cut.remnantItem.parent_item_id, 'source');
    assert.equal(cut.remnantItem.inventory_type, 'remnant');
    assert.equal(cut.remnantItem.estimated_weight_kg, 19.003);
    assert.equal(service.currentQuantity('source'), 2);
    assert.equal(service.currentQuantity(cut.remnantItem.id), 1);
    assert.equal(cut.sourceMovement.related_movement_id, cut.remnantMovement.id);
    assert.equal(cut.remnantMovement.related_movement_id, cut.sourceMovement.id);

    assert.throws(
      () => service.cut({ sourceItemId: 'source', quantity: 3, lengthMm: 1000, widthMm: 620 }),
      /Insufficient inventory/,
    );
    assert.equal(service.currentQuantity('source'), 2);

    const adjustment = service.recordMovement({
      inventoryItemId: cut.remnantItem.id,
      movementType: 'ADJUSTMENT',
      quantity: -1,
      notes: 'count correction',
    });
    assert.equal(adjustment.movement_type, 'ADJUSTMENT');
    assert.equal(service.currentQuantity(cut.remnantItem.id), 0);
    database.close();
  `);
  try {
    execFileSync(tsx, [runner], { cwd: root, stdio: 'pipe' });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('inventory V2 reports weight evidence in scale, measured, reference, and fallback order', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'inventory-v2-weight-evidence-'));
  const runner = path.join(directory, 'run.mts');
  writeFileSync(runner, `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(${JSON.stringify(packageUrl)});
    const Database = require('better-sqlite3');
    const { ensureInventoryV2Schema } = await import(${JSON.stringify(schemaUrl)});
    const { createInventoryV2Service } = await import(${JSON.stringify(serviceUrl)});
    const database = new Database(':memory:');
    database.pragma('foreign_keys = ON');
    ensureInventoryV2Schema(database);
    const service = createInventoryV2Service(database);

    const created = service.createItem({
      sku: 'PEEK-3150-1250-2',
      name: 'PEEK sheet 2 mm',
      materialName: 'PEEK',
      densityKgM3: 1320,
      shape: 'sheet',
      standardLengthMm: 3150,
      standardWidthMm: 1250,
      standardThicknessMm: 2,
      inventoryType: 'remnant',
      lengthMm: 1250,
      widthMm: 620,
      thicknessMm: 2,
      quantity: 3,
      userId: 'user-1',
      userName: 'Test User',
    });

    let item = service.listStock('sheet')[0].items[0];
    assert.equal(item.weight_basis, 'supplier_reference');
    assert.equal(item.reference_thickness_mm, 2.5);
    assert.equal(item.reference_unit_weight_kg, 6.4);
    assert.equal(item.calculation_thickness_mm, 2.5);
    assert.equal(item.estimated_weight_kg, 2.558);
    assert.equal(item.display_weight_kg, 2.558);

    service.recordMeasurement({
      inventoryItemId: created.item.id,
      measuredThicknessMm: 2.77,
      sampleCount: 1,
      measuredAt: '2026-09-09',
      userId: 'user-1',
    });
    item = service.listStock('sheet')[0].items[0];
    assert.equal(item.weight_basis, 'measured_thickness');
    assert.equal(item.measured_thickness_mm, 2.77);
    assert.equal(item.calculation_thickness_mm, 2.77);
    assert.equal(item.estimated_weight_kg, 2.834);
    assert.equal(item.actual_weight_kg, null);
    assert.equal(item.display_weight_kg, 2.834);

    service.recordMeasurement({
      inventoryItemId: created.item.id,
      measuredThicknessMm: 2.77,
      actualUnitWeightMinKg: 2.85,
      actualUnitWeightMaxKg: 2.86,
      actualUnitWeightAvgKg: 2.855,
      sampleCount: 2,
      measuredAt: '2026-09-10',
      userId: 'user-1',
    });
    item = service.listStock('sheet')[0].items[0];
    assert.equal(item.weight_basis, 'scale');
    assert.equal(item.weight_status, 'actual');
    assert.equal(item.actual_weight_kg, 2.855);
    assert.equal(item.actual_weight_min_kg, 2.85);
    assert.equal(item.actual_weight_max_kg, 2.86);
    assert.equal(item.measurement_sample_count, 2);
    assert.equal(item.display_weight_kg, 2.855);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM inventory_item_measurements').get().count, 2);
    database.close();
  `);
  try {
    execFileSync(tsx, [runner], { cwd: root, stdio: 'pipe' });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
