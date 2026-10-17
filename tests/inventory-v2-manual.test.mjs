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

test('inventory V2 exposes manual specification creation without sales-module links', () => {
  assert.match(routeSource, /router\.post\('\/v2\/items'/);
  const v2Section = routeSource.slice(routeSource.indexOf('// ─── Inventory V2'));
  assert.doesNotMatch(v2Section, /company_id|customer_id|quotation_id|order_id|shipment_id|invoice_id|payment_id/);
});

test('manual creation supports a new master SKU, another actual size, and auditable opening stock', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'inventory-v2-manual-'));
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

    const first = service.createItem({
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
      thicknessMm: 2.77,
      quantity: 3,
      actualWeightKg: 2.855,
      userId: 'user-1',
      userName: 'Test User',
    });
    assert.equal(first.sku.sku, 'PEEK-3150-1250-2');
    assert.equal(first.item.actual_weight_kg, 2.855);
    assert.equal(first.item.weight_status, 'actual');
    assert.equal(first.movement.movement_type, 'INBOUND');
    assert.equal(first.movement.quantity_delta, 3);
    assert.equal(first.movement.actual_weight_delta_kg, 8.565);
    assert.equal(service.currentQuantity(first.item.id), 3);

    const second = service.createItem({
      inventorySkuId: first.sku.id,
      shape: 'sheet',
      inventoryType: 'remnant',
      lengthMm: 2050,
      widthMm: 600,
      thicknessMm: 2.77,
      quantity: 5,
      actualWeightKg: 4.5,
    });
    assert.equal(second.sku.id, first.sku.id);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM inventory_skus').get().count, 1);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM inventory_items').get().count, 2);
    assert.equal(service.currentQuantity(second.item.id), 5);
    const stock = service.listStock('sheet');
    assert.equal(stock[0].density_kg_m3, 1320);
    assert.equal(stock[0].total_quantity, 8);

    assert.throws(() => service.createItem({
      inventorySkuId: first.sku.id,
      shape: 'sheet',
      inventoryType: 'remnant',
      lengthMm: 1250,
      widthMm: 620,
      thicknessMm: 2.77,
      quantity: 1,
      actualWeightKg: 2.855,
    }), /already exists/);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM inventory_movements').get().count, 2);
    database.close();
  `);
  try {
    execFileSync(tsx, [runner], { cwd: root, stdio: 'pipe' });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
