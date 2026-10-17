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
const schemaUrl = pathToFileURL(path.join(root, 'server', 'inventory', 'schema.ts')).href;
const serviceUrl = pathToFileURL(path.join(root, 'server', 'inventory', 'service.ts')).href;
const routeSource = readFileSync(path.join(root, 'server', 'routes', 'inventory.ts'), 'utf8');

test('inventory imports require preview and confirmation endpoints', () => {
  assert.match(routeSource, /\/v2\/import\/preview/);
  assert.match(routeSource, /\/v2\/import\/confirm/);
  assert.match(routeSource, /Direct inventory import is disabled/);
  assert.doesNotMatch(routeSource, /import-disabled-legacy/);
  assert.doesNotMatch(routeSource, /Stock count: sys=/);
});

test('incremental and scoped snapshot imports preview before writing and stay auditable', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'inventory-v2-import-'));
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
    for (const [id, length, width, quantity] of [['full', 3150, 620, 3], ['old-remnant', 1260, 620, 2]]) {
      database.prepare(\`
        INSERT INTO inventory_items (
          id, inventory_sku_id, inventory_type, length_mm, width_mm, thickness_mm,
          estimated_weight_kg, weight_status, mapping_status, created_at, updated_at
        ) VALUES (?, 's1', ?, ?, ?, 10, 1, 'estimated', 'auto_matched', ?, ?)
      \`).run(id, length === 3150 ? 'full_sheet' : 'remnant', length, width, now, now);
      database.prepare(\`
        INSERT INTO inventory_movements (
          id, movement_number, movement_type, inventory_item_id, quantity_delta,
          occurred_at, created_at
        ) VALUES (?, ?, 'OPENING', ?, ?, ?, ?)
      \`).run('opening-' + id, 'OPEN-' + id, id, quantity, now, now);
    }
    const service = createInventoryV2Service(database);
    const rows = [
      { SKU: 'PEEK-3150-1250-10', ActualDimension: '3150×620×10', Quantity: 5 },
      { SKU: 'PEEK-3150-1250-10', ActualDimension: '980×620×10', Quantity: 1, InventoryType: '余料' },
    ];
    const movementCountBefore = database.prepare('SELECT COUNT(*) AS count FROM inventory_movements').get().count;
    const incremental = service.buildImportPreview(rows, 'incremental', 'sheet');
    assert.equal(incremental.added.length, 1);
    assert.equal(incremental.changed.length, 1);
    assert.equal(incremental.zeroed.length, 0);
    assert.equal(incremental.errors.length, 0);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM inventory_movements').get().count, movementCountBefore);
    assert.throws(
      () => service.confirmImport(rows, 'incremental', 'sheet', 'stale-hash', {}),
      /review the latest differences/,
    );
    const result = service.confirmImport(rows, 'incremental', 'sheet', incremental.preview_hash, { userId: 'u1', userName: 'Tester' });
    assert.equal(result.added, 1);
    assert.equal(result.changed, 1);
    assert.equal(result.zeroed, 0);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM inventory_movements WHERE import_batch_id = ?').get(result.import_batch_id).count, 2);

    const snapshotRows = [
      { SKU: 'PEEK-3150-1250-10', ActualDimension: '3150×620×10', Quantity: 5 },
      { SKU: 'PEEK-3150-1250-10', ActualDimension: '980×620×10', Quantity: 1, InventoryType: 'Remnant' },
    ];
    const snapshot = service.buildImportPreview(snapshotRows, 'snapshot', 'sheet');
    assert.equal(snapshot.zeroed.length, 1);
    assert.equal(snapshot.zeroed[0].existing_item_id, 'old-remnant');
    const snapshotResult = service.confirmImport(snapshotRows, 'snapshot', 'sheet', snapshot.preview_hash, { userId: 'u1', userName: 'Tester' });
    assert.equal(snapshotResult.zeroed, 1);
    assert.equal(service.currentQuantity('old-remnant'), 0);
    const zeroMovement = database.prepare(\`
      SELECT movement_type, quantity_delta, import_batch_id FROM inventory_movements
      WHERE inventory_item_id = 'old-remnant' ORDER BY created_at DESC LIMIT 1
    \`).get();
    assert.equal(zeroMovement.movement_type, 'SNAPSHOT_ADJUSTMENT');
    assert.equal(zeroMovement.quantity_delta, -2);
    assert.equal(zeroMovement.import_batch_id, snapshotResult.import_batch_id);

    const missingRule = service.buildImportPreview([
      { SKU: 'PEEK-3150-1250-10', ActualDimension: '3150×620×22', Quantity: 1 },
    ], 'incremental', 'sheet');
    assert.equal(missingRule.errors.length, 1);
    assert.match(missingRule.errors[0].message, /No weight rule applies/);
    assert.throws(() => service.buildImportPreview(rows, 'snapshot', 'all'), /explicit/);
    database.close();
  `);
  try {
    execFileSync(tsx, [runner], { cwd: root, stdio: 'pipe' });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
