import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

type LegacyProduct = {
  id: string;
  sku: string;
  name: string;
  product_type: 'sheet' | 'rod' | 'tube' | 'part';
  length_mm: number | null;
  width_mm: number | null;
  thickness_mm: number | null;
  diameter_mm: number | null;
  outer_diameter_mm: number | null;
  inner_diameter_mm: number | null;
  unit: string | null;
  material_name: string | null;
  density_kg_m3: number | null;
  current_quantity: number;
  created_by: string | null;
};

type InventoryShape = 'sheet' | 'rod' | 'tube';
const LEGACY_MIGRATION_KEY = 'legacy-products-v1';

const PEEK_SHEET_REFERENCES: ReadonlyArray<readonly [
  nominalThicknessMm: number,
  referenceThicknessMm: number,
  referenceLengthMm: number,
  referenceWidthMm: number,
  referenceUnitWeightKg: number,
  sourceNote: string | null,
]> = [
  [2, 2.5, 3150, 620, 6.4, null],
  [3, 3.5, 3150, 620, 8.96, null],
  [4, 4.5, 3150, 620, 11.51, null],
  [5, 5.6, 3150, 1260, 29.12, null],
  [6, 6.6, 3150, 1260, 34.32, null],
  [7, 7.8, 3150, 1260, 40.56, null],
  [8, 8.8, 3150, 1260, 45.75, null],
  [10, 10.8, 3150, 1260, 56.15, null],
  [12, 13, 3150, 1250, 67.59, 'The category column says 1260 x 3150 mm; the explicit size column says 1250 x 3150 mm.'],
  [16, 17, 3150, 1250, 88.39, 'The category column says 1260 x 3150 mm; the explicit size column says 1250 x 3150 mm.'],
  [18, 19, 3150, 1250, 98.79, 'The category column says 1260 x 3150 mm; the explicit size column says 1250 x 3150 mm.'],
  [20, 20, 3150, 1250, 103.99, 'The category column says 1260 x 3150 mm; the explicit size column says 1250 x 3150 mm.'],
  [25, 26.5, 3150, 1250, 136.69, null],
  [30, 31.5, 3150, 1250, 162.48, null],
  [35, 36.5, 3150, 1250, 188.27, null],
  [40, 42, 3150, 1250, 216.64, null],
  [45, 47, 3150, 1250, 242.43, null],
  [50, 52, 3150, 1250, 268.22, null],
  [55, 57, 3150, 1250, 294.01, null],
  [60, 62.5, 3150, 1250, 322.38, null],
];

function tableExists(database: Database.Database, table: string): boolean {
  return Boolean(database.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).get(table));
}

function formatDimension(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '';
  return Number.isInteger(value) ? String(value) : String(value).replace(/0+$/, '').replace(/\.$/, '');
}

function peekSheetMasterSku(product: LegacyProduct): string | null {
  if (
    product.product_type !== 'sheet'
    || product.material_name?.trim().toUpperCase() !== 'PEEK'
    || !product.thickness_mm
  ) return null;
  return `PEEK-3150-1250-${formatDimension(product.thickness_mm)}`;
}

function estimatedUnitWeight(
  database: Database.Database,
  product: LegacyProduct,
): { weight: number | null; status: 'estimated' | 'missing_rule' } {
  const density = Number(product.density_kg_m3 || 0);
  if (density <= 0) return { weight: null, status: 'missing_rule' };

  if (product.product_type === 'sheet') {
    const length = Number(product.length_mm || 0);
    const width = Number(product.width_mm || 0);
    const thickness = Number(product.thickness_mm || 0);
    if (length <= 0 || width <= 0 || thickness <= 0) return { weight: null, status: 'missing_rule' };

    let calculationThickness = thickness;
    if (product.material_name?.trim().toUpperCase() === 'PEEK') {
      const rule = database.prepare(`
        SELECT tolerance_mm
        FROM inventory_rules
        WHERE rule_type = 'thickness_tolerance'
          AND material_name = 'PEEK'
          AND shape = 'sheet'
          AND active = 1
          AND ? BETWEEN min_thickness_mm AND max_thickness_mm
        ORDER BY min_thickness_mm DESC
        LIMIT 1
      `).get(thickness) as { tolerance_mm: number } | undefined;
      if (!rule) return { weight: null, status: 'missing_rule' };
      calculationThickness += Number(rule.tolerance_mm);
    }
    return {
      weight: Math.round(((length * width * calculationThickness / 1_000_000_000) * density) * 1000) / 1000,
      status: 'estimated',
    };
  }

  if (product.product_type === 'rod') {
    const diameter = Number(product.diameter_mm || 0);
    const length = Number(product.length_mm || 0);
    if (diameter <= 0 || length <= 0) return { weight: null, status: 'missing_rule' };
    const volume = Math.PI * (diameter / 2) ** 2 * length;
    return { weight: Math.round((volume / 1_000_000_000 * density) * 1000) / 1000, status: 'estimated' };
  }

  if (product.product_type === 'tube') {
    const outer = Number(product.outer_diameter_mm || 0);
    const inner = Number(product.inner_diameter_mm || 0);
    const length = Number(product.length_mm || 0);
    if (outer <= 0 || inner < 0 || outer <= inner || length <= 0) return { weight: null, status: 'missing_rule' };
    const volume = Math.PI * ((outer / 2) ** 2 - (inner / 2) ** 2) * length;
    return { weight: Math.round((volume / 1_000_000_000 * density) * 1000) / 1000, status: 'estimated' };
  }

  return { weight: null, status: 'missing_rule' };
}

function classifyLegacyItem(database: Database.Database, product: LegacyProduct): string {
  if (product.product_type === 'rod') return 'full_rod';
  if (product.product_type === 'tube') return 'full_tube';
  if (product.product_type !== 'sheet') return 'remnant';

  const fullSizeRule = database.prepare(`
    SELECT 1
    FROM inventory_rules
    WHERE rule_type = 'full_size'
      AND material_name = ?
      AND shape = 'sheet'
      AND active = 1
      AND length_mm = ?
      AND width_mm = ?
    LIMIT 1
  `).get(product.material_name, product.length_mm, product.width_mm);
  if (fullSizeRule) return 'full_sheet';

  const masterSku = peekSheetMasterSku(product);
  if (
    masterSku === product.sku
    && product.length_mm === 3150
    && product.width_mm === 1250
  ) return 'full_sheet';
  return 'remnant';
}

function seedRules(database: Database.Database): void {
  const now = new Date().toISOString();
  const insert = database.prepare(`
    INSERT OR IGNORE INTO inventory_rules (
      id, material_name, shape, rule_type, min_thickness_mm, max_thickness_mm,
      length_mm, width_mm, tolerance_mm, inventory_type, active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);
  insert.run('peek-full-sheet-3150x620', 'PEEK', 'sheet', 'full_size', null, null, 3150, 620, null, 'full_sheet', now, now);
  for (const [minimum, maximum, tolerance] of [
    [2, 4, 0.5],
    [5, 10, 0.8],
    [12, 20, 1.0],
    [25, 30, 1.5],
    [35, 60, 3.0],
  ]) {
    insert.run(
      `peek-sheet-tolerance-${minimum}-${maximum}`,
      'PEEK', 'sheet', 'thickness_tolerance', minimum, maximum,
      null, null, tolerance, null, now, now,
    );
  }
}

function seedPeekSheetReferences(database: Database.Database): void {
  const now = new Date().toISOString();
  const insert = database.prepare(`
    INSERT OR IGNORE INTO inventory_sheet_specifications (
      id, material_name, nominal_thickness_mm, reference_thickness_mm,
      reference_length_mm, reference_width_mm, reference_unit_weight_kg,
      source_density_kg_m3, source_label, source_note, active, created_at, updated_at
    ) VALUES (?, 'PEEK', ?, ?, ?, ?, ?, NULL, ?, ?, 1, ?, ?)
  `);
  for (const [
    nominalThicknessMm,
    referenceThicknessMm,
    referenceLengthMm,
    referenceWidthMm,
    referenceUnitWeightKg,
    sourceNote,
  ] of PEEK_SHEET_REFERENCES) {
    insert.run(
      `peek-sheet-reference-${formatDimension(nominalThicknessMm)}`,
      nominalThicknessMm,
      referenceThicknessMm,
      referenceLengthMm,
      referenceWidthMm,
      referenceUnitWeightKg,
      'User-provided PEEK pure sheet size table, 2026-09-09',
      sourceNote,
      now,
      now,
    );
  }
}

function allowThicknessOnlyMeasurements(database: Database.Database): void {
  const columns = database.prepare('PRAGMA table_info(inventory_item_measurements)').all() as Array<{
    name: string;
    notnull: number;
  }>;
  const averageColumn = columns.find((column) => column.name === 'actual_unit_weight_avg_kg');
  if (!averageColumn?.notnull) return;

  database.transaction(() => {
    database.exec(`
      ALTER TABLE inventory_item_measurements RENAME TO inventory_item_measurements_v1;

      CREATE TABLE inventory_item_measurements (
        id TEXT PRIMARY KEY,
        inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id),
        measured_thickness_mm REAL CHECK (measured_thickness_mm IS NULL OR measured_thickness_mm > 0),
        actual_unit_weight_min_kg REAL CHECK (actual_unit_weight_min_kg IS NULL OR actual_unit_weight_min_kg > 0),
        actual_unit_weight_max_kg REAL CHECK (
          actual_unit_weight_max_kg IS NULL
          OR actual_unit_weight_min_kg IS NOT NULL
            AND actual_unit_weight_max_kg >= actual_unit_weight_min_kg
        ),
        actual_unit_weight_avg_kg REAL CHECK (
          actual_unit_weight_avg_kg IS NULL
          OR actual_unit_weight_min_kg IS NOT NULL
            AND actual_unit_weight_max_kg IS NOT NULL
            AND actual_unit_weight_avg_kg >= actual_unit_weight_min_kg
            AND actual_unit_weight_avg_kg <= actual_unit_weight_max_kg
        ),
        sample_count INTEGER NOT NULL DEFAULT 1 CHECK (sample_count > 0),
        measured_at TEXT NOT NULL,
        notes TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL,
        CHECK (
          measured_thickness_mm IS NOT NULL
          OR actual_unit_weight_avg_kg IS NOT NULL
        ),
        CHECK (
          actual_unit_weight_min_kg IS NULL
            AND actual_unit_weight_max_kg IS NULL
            AND actual_unit_weight_avg_kg IS NULL
          OR actual_unit_weight_min_kg IS NOT NULL
            AND actual_unit_weight_max_kg IS NOT NULL
            AND actual_unit_weight_avg_kg IS NOT NULL
        )
      );

      INSERT INTO inventory_item_measurements (
        id, inventory_item_id, measured_thickness_mm,
        actual_unit_weight_min_kg, actual_unit_weight_max_kg,
        actual_unit_weight_avg_kg, sample_count, measured_at, notes,
        created_by, created_at
      )
      SELECT
        id, inventory_item_id, measured_thickness_mm,
        actual_unit_weight_min_kg, actual_unit_weight_max_kg,
        actual_unit_weight_avg_kg, sample_count, measured_at, notes,
        created_by, created_at
      FROM inventory_item_measurements_v1;

      DROP TABLE inventory_item_measurements_v1;
    `);
  })();
}

function migrateLegacyInventory(database: Database.Database): void {
  if (!tableExists(database, 'products') || !tableExists(database, 'inventory_transactions')) return;
  if (database.prepare('SELECT 1 FROM inventory_migration_state WHERE migration_key = ?').get(LEGACY_MIGRATION_KEY)) return;

  const legacyProducts = database.prepare(`
    SELECT
      p.id, p.sku, p.name, p.product_type, p.length_mm, p.width_mm, p.thickness_mm,
      p.diameter_mm, p.outer_diameter_mm, p.inner_diameter_mm, p.unit,
      m.name AS material_name, m.density_kg_m3,
      COALESCE(SUM(t.quantity), 0) AS current_quantity,
      p.created_by
    FROM products p
    LEFT JOIN materials m ON m.id = p.material_id
    LEFT JOIN inventory_transactions t ON t.product_id = p.id
    WHERE p.deleted_at IS NULL
      AND p.product_type IN ('sheet', 'rod', 'tube')
    GROUP BY p.id
    ORDER BY p.created_at, p.id
  `).all() as LegacyProduct[];

  const bySku = new Map(legacyProducts.map((product) => [product.sku, product]));
  const now = new Date().toISOString();

  database.transaction(() => {
    const insertSku = database.prepare(`
      INSERT OR IGNORE INTO inventory_skus (
        id, sku, name, material_name, density_kg_m3, shape,
        standard_length_mm, standard_width_mm, standard_thickness_mm,
        standard_diameter_mm, standard_outer_diameter_mm, standard_inner_diameter_mm,
        unit, source, legacy_product_id, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertItem = database.prepare(`
      INSERT OR IGNORE INTO inventory_items (
        id, inventory_sku_id, inventory_type, length_mm, width_mm, thickness_mm,
        diameter_mm, outer_diameter_mm, inner_diameter_mm,
        estimated_weight_kg, actual_weight_kg, weight_status,
        legacy_product_id, legacy_sku, mapping_status, created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMovement = database.prepare(`
      INSERT OR IGNORE INTO inventory_movements (
        id, movement_number, movement_type, inventory_item_id, quantity_delta,
        estimated_weight_delta_kg, actual_weight_delta_kg,
        notes, created_by, operator_name, occurred_at, created_at
      ) VALUES (?, ?, 'OPENING', ?, ?, ?, NULL, ?, ?, 'Legacy migration', ?, ?)
    `);

    for (const product of legacyProducts) {
      const shape = product.product_type as InventoryShape;
      const derivedMasterSku = peekSheetMasterSku(product) || product.sku;
      const legacyMaster = bySku.get(derivedMasterSku);
      const skuId = `inventory-sku-${legacyMaster?.id || product.id}-${derivedMasterSku}`;
      insertSku.run(
        skuId,
        derivedMasterSku,
        legacyMaster?.name || product.name,
        product.material_name || 'Unspecified',
        product.density_kg_m3,
        shape,
        shape === 'sheet' && derivedMasterSku !== product.sku ? 3150 : (legacyMaster?.length_mm ?? product.length_mm),
        shape === 'sheet' && derivedMasterSku !== product.sku ? 1250 : (legacyMaster?.width_mm ?? product.width_mm),
        legacyMaster?.thickness_mm ?? product.thickness_mm,
        legacyMaster?.diameter_mm ?? product.diameter_mm,
        legacyMaster?.outer_diameter_mm ?? product.outer_diameter_mm,
        legacyMaster?.inner_diameter_mm ?? product.inner_diameter_mm,
        legacyMaster?.unit || product.unit || 'pc',
        legacyMaster ? 'legacy' : 'generated_master',
        legacyMaster?.id || null,
        product.created_by,
        now,
        now,
      );
      const storedSku = database.prepare('SELECT id FROM inventory_skus WHERE sku = ?').get(derivedMasterSku) as { id: string };
      const weight = estimatedUnitWeight(database, product);
      const itemId = `legacy-item-${product.id}`;
      insertItem.run(
        itemId,
        storedSku.id,
        classifyLegacyItem(database, product),
        product.length_mm,
        product.width_mm,
        product.thickness_mm,
        product.diameter_mm,
        product.outer_diameter_mm,
        product.inner_diameter_mm,
        weight.weight,
        weight.status,
        product.id,
        product.sku,
        'auto_matched',
        product.created_by,
        product.created_by,
        now,
        now,
      );
      if (Number(product.current_quantity) !== 0) {
        insertMovement.run(
          `legacy-opening-${product.id}`,
          `MIG-${product.id}`,
          itemId,
          Number(product.current_quantity),
          weight.weight === null ? null : Number(product.current_quantity) * weight.weight,
          `Migrated without modifying legacy product ${product.sku} or its transactions`,
          product.created_by,
          now,
          now,
        );
      }
    }

    database.prepare(`
      INSERT INTO inventory_migration_state (migration_key, completed_at, details_json)
      VALUES (?, ?, ?)
    `).run(LEGACY_MIGRATION_KEY, now, JSON.stringify({ migrated_products: legacyProducts.length }));
  })();
}

export function ensureInventoryV2Schema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS inventory_skus (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      material_name TEXT NOT NULL,
      density_kg_m3 REAL,
      shape TEXT NOT NULL CHECK (shape IN ('sheet', 'rod', 'tube')),
      standard_length_mm REAL,
      standard_width_mm REAL,
      standard_thickness_mm REAL,
      standard_diameter_mm REAL,
      standard_outer_diameter_mm REAL,
      standard_inner_diameter_mm REAL,
      unit TEXT NOT NULL DEFAULT 'pc',
      source TEXT NOT NULL DEFAULT 'manual',
      legacy_product_id TEXT,
      created_by TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory_rules (
      id TEXT PRIMARY KEY,
      material_name TEXT NOT NULL,
      shape TEXT NOT NULL CHECK (shape IN ('sheet', 'rod', 'tube')),
      rule_type TEXT NOT NULL CHECK (rule_type IN ('full_size', 'thickness_tolerance')),
      min_thickness_mm REAL,
      max_thickness_mm REAL,
      length_mm REAL,
      width_mm REAL,
      tolerance_mm REAL,
      inventory_type TEXT CHECK (inventory_type IS NULL OR inventory_type IN ('full_sheet', 'full_rod', 'full_tube', 'remnant')),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_sheet_specifications (
      id TEXT PRIMARY KEY,
      material_name TEXT NOT NULL,
      nominal_thickness_mm REAL NOT NULL CHECK (nominal_thickness_mm > 0),
      reference_thickness_mm REAL NOT NULL CHECK (reference_thickness_mm > 0),
      reference_length_mm REAL NOT NULL CHECK (reference_length_mm > 0),
      reference_width_mm REAL NOT NULL CHECK (reference_width_mm > 0),
      reference_unit_weight_kg REAL NOT NULL CHECK (reference_unit_weight_kg > 0),
      source_density_kg_m3 REAL CHECK (source_density_kg_m3 IS NULL OR source_density_kg_m3 > 0),
      source_label TEXT NOT NULL,
      source_note TEXT,
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (material_name, nominal_thickness_mm, reference_length_mm, reference_width_mm)
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id TEXT PRIMARY KEY,
      inventory_sku_id TEXT NOT NULL REFERENCES inventory_skus(id),
      inventory_type TEXT NOT NULL CHECK (inventory_type IN ('full_sheet', 'full_rod', 'full_tube', 'remnant')),
      length_mm REAL,
      width_mm REAL,
      thickness_mm REAL,
      diameter_mm REAL,
      outer_diameter_mm REAL,
      inner_diameter_mm REAL,
      estimated_weight_kg REAL,
      actual_weight_kg REAL,
      weight_status TEXT NOT NULL CHECK (weight_status IN ('estimated', 'actual', 'missing_rule')),
      legacy_product_id TEXT UNIQUE,
      legacy_sku TEXT,
      mapping_status TEXT NOT NULL DEFAULT 'auto_matched'
        CHECK (mapping_status IN ('auto_matched', 'review_required', 'unmatched')),
      parent_item_id TEXT REFERENCES inventory_items(id),
      created_by TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id TEXT PRIMARY KEY,
      movement_number TEXT NOT NULL UNIQUE,
      movement_type TEXT NOT NULL CHECK (movement_type IN (
        'OPENING', 'INBOUND', 'OUTBOUND', 'ADJUSTMENT',
        'CUT_CONSUME', 'CUT_REMNANT_CREATE', 'SNAPSHOT_ADJUSTMENT'
      )),
      inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id),
      source_item_id TEXT REFERENCES inventory_items(id),
      related_movement_id TEXT,
      quantity_delta REAL NOT NULL,
      estimated_weight_delta_kg REAL,
      actual_weight_delta_kg REAL,
      import_batch_id TEXT,
      notes TEXT,
      created_by TEXT,
      operator_name TEXT,
      occurred_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_item_measurements (
      id TEXT PRIMARY KEY,
      inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id),
      measured_thickness_mm REAL CHECK (measured_thickness_mm IS NULL OR measured_thickness_mm > 0),
      actual_unit_weight_min_kg REAL CHECK (actual_unit_weight_min_kg IS NULL OR actual_unit_weight_min_kg > 0),
      actual_unit_weight_max_kg REAL CHECK (
        actual_unit_weight_max_kg IS NULL
        OR actual_unit_weight_min_kg IS NOT NULL
          AND actual_unit_weight_max_kg >= actual_unit_weight_min_kg
      ),
      actual_unit_weight_avg_kg REAL CHECK (
        actual_unit_weight_avg_kg IS NULL
        OR actual_unit_weight_min_kg IS NOT NULL
          AND actual_unit_weight_max_kg IS NOT NULL
          AND actual_unit_weight_avg_kg >= actual_unit_weight_min_kg
          AND actual_unit_weight_avg_kg <= actual_unit_weight_max_kg
      ),
      sample_count INTEGER NOT NULL DEFAULT 1 CHECK (sample_count > 0),
      measured_at TEXT NOT NULL,
      notes TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      CHECK (
        measured_thickness_mm IS NOT NULL
        OR actual_unit_weight_avg_kg IS NOT NULL
      ),
      CHECK (
        actual_unit_weight_min_kg IS NULL
          AND actual_unit_weight_max_kg IS NULL
          AND actual_unit_weight_avg_kg IS NULL
        OR actual_unit_weight_min_kg IS NOT NULL
          AND actual_unit_weight_max_kg IS NOT NULL
          AND actual_unit_weight_avg_kg IS NOT NULL
      )
    );

    CREATE TABLE IF NOT EXISTS inventory_migration_state (
      migration_key TEXT PRIMARY KEY,
      completed_at TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_inventory_skus_shape_sort
      ON inventory_skus(shape, material_name, standard_thickness_mm, standard_diameter_mm, sku);
    CREATE INDEX IF NOT EXISTS idx_inventory_items_sku
      ON inventory_items(inventory_sku_id, deleted_at);
    CREATE INDEX IF NOT EXISTS idx_inventory_items_parent
      ON inventory_items(parent_item_id) WHERE parent_item_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_inventory_sheet_specs_lookup
      ON inventory_sheet_specifications(material_name, nominal_thickness_mm, active);
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_date
      ON inventory_movements(inventory_item_id, occurred_at, created_at);
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_import
      ON inventory_movements(import_batch_id) WHERE import_batch_id IS NOT NULL;

    CREATE TRIGGER IF NOT EXISTS trg_inventory_movements_append_only_update
    BEFORE UPDATE ON inventory_movements
    BEGIN
      SELECT RAISE(ABORT, 'inventory movements are append-only');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_inventory_movements_append_only_delete
    BEFORE DELETE ON inventory_movements
    BEGIN
      SELECT RAISE(ABORT, 'inventory movements are append-only');
    END;
  `);

  allowThicknessOnlyMeasurements(database);
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_inventory_item_measurements_item_date
      ON inventory_item_measurements(inventory_item_id, measured_at, created_at);
  `);
  seedRules(database);
  seedPeekSheetReferences(database);
  migrateLegacyInventory(database);
}

export function createEmptyInventoryItemId(): string {
  return randomUUID();
}
