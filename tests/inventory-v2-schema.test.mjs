import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const tsx = path.join(root, 'node_modules', '.bin', 'tsx');
const schemaPath = path.join(root, 'server', 'inventory', 'schema.ts');
const schemaUrl = pathToFileURL(schemaPath).href;
const packageUrl = pathToFileURL(path.join(root, 'package.json')).href;

test('inventory V2 schema is isolated from CRM sales records', () => {
  const source = readFileSync(schemaPath, 'utf8');
  for (const table of [
    'inventory_skus',
    'inventory_items',
    'inventory_movements',
    'inventory_rules',
    'inventory_sheet_specifications',
    'inventory_item_measurements',
  ]) {
    assert.match(source, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  }
  assert.doesNotMatch(
    source,
    /REFERENCES\s+(?:companies|contacts|inquiries|quotations|orders|shipments|invoices|payment_records|products|inventory_transactions)\b/i,
  );
  assert.match(source, /inventory movements are append-only/);
});

test('inventory V2 seeds PEEK sheet references and stores warehouse measurements separately', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'inventory-v2-reference-'));
  const runner = path.join(directory, 'run.mts');
  writeFileSync(runner, `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(${JSON.stringify(packageUrl)});
    const Database = require('better-sqlite3');
    const { ensureInventoryV2Schema } = await import(${JSON.stringify(schemaUrl)});
    const database = new Database(':memory:');
    database.pragma('foreign_keys = ON');

    ensureInventoryV2Schema(database);
    ensureInventoryV2Schema(database);

    const references = database.prepare(\`
      SELECT nominal_thickness_mm, reference_thickness_mm,
        reference_length_mm, reference_width_mm, reference_unit_weight_kg,
        source_density_kg_m3, source_note
      FROM inventory_sheet_specifications
      WHERE material_name = 'PEEK' AND active = 1
      ORDER BY nominal_thickness_mm
    \`).all();
    assert.equal(references.length, 20);
    assert.deepEqual(references[0], {
      nominal_thickness_mm: 2,
      reference_thickness_mm: 2.5,
      reference_length_mm: 3150,
      reference_width_mm: 620,
      reference_unit_weight_kg: 6.4,
      source_density_kg_m3: null,
      source_note: null,
    });
    assert.deepEqual(
      references.find((row) => row.nominal_thickness_mm === 5),
      {
        nominal_thickness_mm: 5,
        reference_thickness_mm: 5.6,
        reference_length_mm: 3150,
        reference_width_mm: 1260,
        reference_unit_weight_kg: 29.12,
        source_density_kg_m3: null,
        source_note: null,
      },
    );
    const twelve = references.find((row) => row.nominal_thickness_mm === 12);
    assert.equal(twelve.reference_width_mm, 1250);
    assert.match(twelve.source_note, /category column says 1260 x 3150/i);
    assert.deepEqual(
      references.find((row) => row.nominal_thickness_mm === 60),
      {
        nominal_thickness_mm: 60,
        reference_thickness_mm: 62.5,
        reference_length_mm: 3150,
        reference_width_mm: 1250,
        reference_unit_weight_kg: 322.38,
        source_density_kg_m3: null,
        source_note: null,
      },
    );

    const now = '2026-09-09T00:00:00.000Z';
    database.prepare(\`
      INSERT INTO inventory_skus (
        id, sku, name, material_name, density_kg_m3, shape,
        standard_length_mm, standard_width_mm, standard_thickness_mm,
        unit, source, created_at, updated_at
      ) VALUES ('sku-2', 'PEEK-3150-1250-2', 'PEEK sheet', 'PEEK', 1320, 'sheet',
        3150, 1250, 2, 'pc', 'manual', ?, ?)
    \`).run(now, now);
    database.prepare(\`
      INSERT INTO inventory_items (
        id, inventory_sku_id, inventory_type, length_mm, width_mm, thickness_mm,
        estimated_weight_kg, weight_status, mapping_status, created_at, updated_at
      ) VALUES ('item-2', 'sku-2', 'remnant', 1250, 620, 2,
        2.558, 'estimated', 'auto_matched', ?, ?)
    \`).run(now, now);
    database.prepare(\`
      INSERT INTO inventory_item_measurements (
        id, inventory_item_id, measured_thickness_mm,
        actual_unit_weight_min_kg, actual_unit_weight_max_kg,
        actual_unit_weight_avg_kg, sample_count, measured_at, notes,
        created_by, created_at
      ) VALUES ('measurement-1', 'item-2', 2.77, 2.85, 2.86, 2.855, 2,
        '2026-09-09', 'Warehouse sample', 'u1', ?)
    \`).run(now);
    assert.deepEqual(database.prepare(\`
      SELECT measured_thickness_mm, actual_unit_weight_min_kg,
        actual_unit_weight_max_kg, actual_unit_weight_avg_kg, sample_count
      FROM inventory_item_measurements WHERE id = 'measurement-1'
    \`).get(), {
      measured_thickness_mm: 2.77,
      actual_unit_weight_min_kg: 2.85,
      actual_unit_weight_max_kg: 2.86,
      actual_unit_weight_avg_kg: 2.855,
      sample_count: 2,
    });
    database.close();
  `);
  try {
    execFileSync(tsx, [runner], { cwd: root, stdio: 'pipe' });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('inventory V2 migrates legacy stock without changing legacy rows and is idempotent', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'inventory-v2-schema-'));
  const runner = path.join(directory, 'run.mts');
  writeFileSync(runner, `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(${JSON.stringify(packageUrl)});
    const Database = require('better-sqlite3');
    const { ensureInventoryV2Schema } = await import(${JSON.stringify(schemaUrl)});
    const database = new Database(':memory:');
    database.pragma('foreign_keys = ON');
    database.exec(\`
      CREATE TABLE materials (id TEXT PRIMARY KEY, name TEXT, density_kg_m3 REAL);
      CREATE TABLE products (
        id TEXT PRIMARY KEY, sku TEXT, name TEXT, product_type TEXT,
        length_mm REAL, width_mm REAL, thickness_mm REAL, diameter_mm REAL,
        outer_diameter_mm REAL, inner_diameter_mm REAL, unit TEXT,
        material_id TEXT, created_by TEXT, created_at TEXT, deleted_at TEXT
      );
      CREATE TABLE inventory_transactions (id TEXT PRIMARY KEY, product_id TEXT, quantity REAL);
      INSERT INTO materials VALUES ('peek', 'PEEK', 1320);
      INSERT INTO products VALUES
        ('master10', 'PEEK-3150-1250-10', 'PEEK sheet', 'sheet', 3150, 1250, 10, NULL, NULL, NULL, 'pc', 'peek', 'u1', '2026-01-01', NULL),
        ('half10', 'PEEK-3150-620-10', 'PEEK sheet', 'sheet', 3150, 620, 10, NULL, NULL, NULL, 'pc', 'peek', 'u1', '2026-01-02', NULL),
        ('remnant10', 'PEEK-1260-620-10', 'PEEK sheet', 'sheet', 1260, 620, 10, NULL, NULL, NULL, 'pc', 'peek', 'u1', '2026-01-03', NULL),
        ('missing22', 'PEEK-3150-620-22', 'PEEK sheet', 'sheet', 3150, 620, 22, NULL, NULL, NULL, 'pc', 'peek', 'u1', '2026-01-04', NULL),
        ('rod12', 'PEEK-12-1000', 'PEEK rod', 'rod', 1000, NULL, NULL, 12, NULL, NULL, 'pc', 'peek', 'u1', '2026-01-05', NULL);
      INSERT INTO inventory_transactions VALUES
        ('t1', 'master10', 3), ('t2', 'half10', 8), ('t3', 'remnant10', 2),
        ('t4', 'missing22', 1), ('t5', 'rod12', 10);
    \`);
    const legacyProductsBefore = database.prepare('SELECT COUNT(*) AS count FROM products').get().count;
    const legacyTransactionsBefore = database.prepare('SELECT COUNT(*) AS count FROM inventory_transactions').get().count;
    ensureInventoryV2Schema(database);
    ensureInventoryV2Schema(database);

    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM products').get().count, legacyProductsBefore);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM inventory_transactions').get().count, legacyTransactionsBefore);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM inventory_skus WHERE sku = 'PEEK-3150-1250-10'").get().count, 1);
    assert.equal(database.prepare(\`
      SELECT COUNT(*) AS count FROM inventory_items i
      JOIN inventory_skus s ON s.id = i.inventory_sku_id
      WHERE s.sku = 'PEEK-3150-1250-10'
    \`).get().count, 3);

    const itemTypes = Object.fromEntries(database.prepare(\`
      SELECT legacy_sku, inventory_type FROM inventory_items WHERE legacy_sku IS NOT NULL
    \`).all().map((row) => [row.legacy_sku, row.inventory_type]));
    assert.equal(itemTypes['PEEK-3150-1250-10'], 'full_sheet');
    assert.equal(itemTypes['PEEK-3150-620-10'], 'full_sheet');
    assert.equal(itemTypes['PEEK-1260-620-10'], 'remnant');
    assert.equal(itemTypes['PEEK-12-1000'], 'full_rod');

    const weighted = database.prepare(\`
      SELECT estimated_weight_kg, weight_status FROM inventory_items
      WHERE legacy_sku = 'PEEK-3150-620-10'
    \`).get();
    assert.equal(weighted.weight_status, 'estimated');
    assert.equal(weighted.estimated_weight_kg, 27.842);
    const missing = database.prepare(\`
      SELECT estimated_weight_kg, weight_status FROM inventory_items
      WHERE legacy_sku = 'PEEK-3150-620-22'
    \`).get();
    assert.equal(missing.estimated_weight_kg, null);
    assert.equal(missing.weight_status, 'missing_rule');

    const quantities = Object.fromEntries(database.prepare(\`
      SELECT i.legacy_sku, SUM(m.quantity_delta) AS quantity
      FROM inventory_items i JOIN inventory_movements m ON m.inventory_item_id = i.id
      GROUP BY i.id
    \`).all().map((row) => [row.legacy_sku, row.quantity]));
    assert.equal(quantities['PEEK-3150-620-10'], 8);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM inventory_migration_state').get().count, 1);
    assert.throws(() => database.prepare("DELETE FROM inventory_movements").run(), /append-only/);
    database.close();
  `);
  try {
    execFileSync(tsx, [runner], { cwd: root, stdio: 'pipe' });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
