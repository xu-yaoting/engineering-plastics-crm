import Database from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';

export type InventoryMovementType = 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT';

type InventoryShape = 'sheet' | 'rod' | 'tube';
type InventoryType = 'full_sheet' | 'full_rod' | 'full_tube' | 'remnant';

type CreateItemInput = {
  inventorySkuId?: string | null;
  sku?: string;
  name?: string;
  materialName?: string;
  densityKgM3?: number | null;
  shape: InventoryShape;
  standardLengthMm?: number | null;
  standardWidthMm?: number | null;
  standardThicknessMm?: number | null;
  standardDiameterMm?: number | null;
  standardOuterDiameterMm?: number | null;
  standardInnerDiameterMm?: number | null;
  inventoryType: InventoryType;
  lengthMm?: number | null;
  widthMm?: number | null;
  thicknessMm?: number | null;
  diameterMm?: number | null;
  outerDiameterMm?: number | null;
  innerDiameterMm?: number | null;
  quantity: number;
  actualWeightKg?: number | null;
  notes?: string;
  occurredAt?: string;
  userId?: string | null;
  userName?: string | null;
};

type MovementInput = {
  inventoryItemId: string;
  movementType: InventoryMovementType;
  quantity: number;
  notes?: string;
  occurredAt?: string;
  userId?: string | null;
  userName?: string | null;
};

type CutInput = {
  sourceItemId: string;
  quantity: number;
  lengthMm?: number;
  widthMm?: number;
  thicknessMm?: number;
  diameterMm?: number;
  outerDiameterMm?: number;
  innerDiameterMm?: number;
  actualWeightKg?: number | null;
  notes?: string;
  occurredAt?: string;
  userId?: string | null;
  userName?: string | null;
};

type MeasurementInput = {
  inventoryItemId: string;
  measuredThicknessMm?: number | null;
  actualUnitWeightMinKg?: number | null;
  actualUnitWeightMaxKg?: number | null;
  actualUnitWeightAvgKg?: number | null;
  sampleCount?: number;
  measuredAt?: string;
  notes?: string;
  userId?: string | null;
};

type ImportMode = 'incremental' | 'snapshot';
type ImportScope = 'sheet' | 'rod' | 'tube' | 'all';

type NormalizedImportRow = {
  row_number: number;
  sku_id: string;
  sku: string;
  shape: 'sheet' | 'rod' | 'tube';
  inventory_type: 'full_sheet' | 'full_rod' | 'full_tube' | 'remnant';
  length_mm: number | null;
  width_mm: number | null;
  thickness_mm: number | null;
  diameter_mm: number | null;
  outer_diameter_mm: number | null;
  inner_diameter_mm: number | null;
  quantity: number;
  estimated_weight_kg: number | null;
  actual_weight_kg: number | null;
  weight_status: 'estimated' | 'actual' | 'missing_rule';
  existing_item_id: string | null;
  current_quantity: number;
  previous_actual_weight_kg: number | null;
};

type ImportPreview = {
  mode: ImportMode;
  scope: ImportScope;
  added: NormalizedImportRow[];
  changed: NormalizedImportRow[];
  unchanged: NormalizedImportRow[];
  zeroed: NormalizedImportRow[];
  errors: { row_number: number; message: string }[];
  preview_hash: string;
};

type InventoryItemRow = {
  id: string;
  inventory_sku_id: string;
  inventory_type: string;
  length_mm: number | null;
  width_mm: number | null;
  thickness_mm: number | null;
  diameter_mm: number | null;
  outer_diameter_mm: number | null;
  inner_diameter_mm: number | null;
  estimated_weight_kg: number | null;
  actual_weight_kg: number | null;
  weight_status: 'estimated' | 'actual' | 'missing_rule';
  material_name: string;
  density_kg_m3: number | null;
  shape: InventoryShape;
  standard_thickness_mm: number | null;
};

type SheetReferenceRow = {
  reference_thickness_mm: number;
  reference_length_mm: number;
  reference_width_mm: number;
  reference_unit_weight_kg: number;
  source_label: string;
  source_note: string | null;
};

type MeasurementRow = {
  id: string;
  measured_thickness_mm: number | null;
  actual_unit_weight_min_kg: number | null;
  actual_unit_weight_max_kg: number | null;
  actual_unit_weight_avg_kg: number | null;
  sample_count: number;
  measured_at: string;
};

type WeightBasis = 'scale' | 'measured_thickness' | 'supplier_reference'
  | 'tolerance_rule' | 'geometric' | 'legacy_estimate' | 'missing_rule';

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function normalizeSearch(value: string): string[] {
  return value
    .toUpperCase()
    .replace(/[Ø⌀×X*\-_/]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function movementNumber(prefix: string): string {
  return `${prefix}-${new Date().toISOString().replace(/\D/g, '').slice(2, 14)}-${randomUUID().slice(0, 8)}`;
}

function firstValue(row: Record<string, unknown>, names: string[]): unknown {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name) && row[name] !== '') return row[name];
  }
  return undefined;
}

function optionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dimensionKey(row: Pick<NormalizedImportRow,
  'sku' | 'length_mm' | 'width_mm' | 'thickness_mm' | 'diameter_mm' | 'outer_diameter_mm' | 'inner_diameter_mm'>): string {
  const value = (part: number | null) => part === null ? '' : Number(part).toFixed(4);
  return [
    row.sku,
    value(row.length_mm), value(row.width_mm), value(row.thickness_mm),
    value(row.diameter_mm), value(row.outer_diameter_mm), value(row.inner_diameter_mm),
  ].join('|');
}

export function createInventoryV2Service(database: Database.Database) {
  function getItem(itemId: string): InventoryItemRow | undefined {
    return database.prepare(`
      SELECT i.*, s.material_name, s.density_kg_m3, s.shape, s.standard_thickness_mm
      FROM inventory_items i
      JOIN inventory_skus s ON s.id = i.inventory_sku_id
      WHERE i.id = ? AND i.deleted_at IS NULL AND s.deleted_at IS NULL
    `).get(itemId) as InventoryItemRow | undefined;
  }

  function currentQuantity(itemId: string): number {
    const row = database.prepare(`
      SELECT COALESCE(SUM(quantity_delta), 0) AS quantity
      FROM inventory_movements
      WHERE inventory_item_id = ?
    `).get(itemId) as { quantity: number };
    return Number(row.quantity || 0);
  }

  function latestMeasurement(itemId: string, requireScaleWeight = false): MeasurementRow | undefined {
    return database.prepare(`
      SELECT id, measured_thickness_mm, actual_unit_weight_min_kg,
        actual_unit_weight_max_kg, actual_unit_weight_avg_kg,
        sample_count, measured_at
      FROM inventory_item_measurements
      WHERE inventory_item_id = ?
        AND (? = 0 OR actual_unit_weight_avg_kg IS NOT NULL)
      ORDER BY measured_at DESC, created_at DESC
      LIMIT 1
    `).get(itemId, requireScaleWeight ? 1 : 0) as MeasurementRow | undefined;
  }

  function sheetReference(materialName: string, nominalThicknessMm: number): SheetReferenceRow | undefined {
    return database.prepare(`
      SELECT reference_thickness_mm, reference_length_mm, reference_width_mm,
        reference_unit_weight_kg, source_label, source_note
      FROM inventory_sheet_specifications
      WHERE material_name = ? AND nominal_thickness_mm = ? AND active = 1
      ORDER BY updated_at DESC
      LIMIT 1
    `).get(materialName.trim().toUpperCase(), nominalThicknessMm) as SheetReferenceRow | undefined;
  }

  function calculateWeightEstimate(item: Pick<InventoryItemRow,
    'shape' | 'material_name' | 'density_kg_m3' | 'length_mm' | 'width_mm' | 'thickness_mm'
    | 'diameter_mm' | 'outer_diameter_mm' | 'inner_diameter_mm'>,
  measuredThicknessMm?: number | null): {
    weight: number | null;
    basis: Exclude<WeightBasis, 'scale' | 'legacy_estimate'>;
    calculationThicknessMm: number | null;
    reference: SheetReferenceRow | undefined;
  } {
    const density = Number(item.density_kg_m3 || 0);
    if (density <= 0) {
      return { weight: null, basis: 'missing_rule', calculationThicknessMm: null, reference: undefined };
    }
    if (item.shape === 'sheet') {
      const length = Number(item.length_mm || 0);
      const width = Number(item.width_mm || 0);
      const nominalThickness = Number(item.thickness_mm || 0);
      if (length <= 0 || width <= 0 || nominalThickness <= 0) {
        return { weight: null, basis: 'missing_rule', calculationThicknessMm: null, reference: undefined };
      }
      const reference = sheetReference(item.material_name, nominalThickness);
      let calculationThickness = nominalThickness;
      let basis: 'measured_thickness' | 'supplier_reference' | 'tolerance_rule' | 'geometric' = 'geometric';
      if (measuredThicknessMm !== undefined && measuredThicknessMm !== null) {
        calculationThickness = Number(measuredThicknessMm);
        basis = 'measured_thickness';
      } else if (reference) {
        calculationThickness = Number(reference.reference_thickness_mm);
        basis = 'supplier_reference';
      } else if (item.material_name.trim().toUpperCase() === 'PEEK') {
        const rule = database.prepare(`
          SELECT tolerance_mm FROM inventory_rules
          WHERE rule_type = 'thickness_tolerance'
            AND material_name = 'PEEK' AND shape = 'sheet' AND active = 1
            AND ? BETWEEN min_thickness_mm AND max_thickness_mm
          ORDER BY min_thickness_mm DESC LIMIT 1
        `).get(nominalThickness) as { tolerance_mm: number } | undefined;
        if (!rule) {
          return { weight: null, basis: 'missing_rule', calculationThicknessMm: null, reference };
        }
        calculationThickness += Number(rule.tolerance_mm);
        basis = 'tolerance_rule';
      }
      return {
        weight: round3(length * width * calculationThickness / 1_000_000_000 * density),
        basis,
        calculationThicknessMm: calculationThickness,
        reference,
      };
    }
    if (item.shape === 'rod') {
      const diameter = Number(item.diameter_mm || 0);
      const length = Number(item.length_mm || 0);
      if (diameter <= 0 || length <= 0) {
        return { weight: null, basis: 'missing_rule', calculationThicknessMm: null, reference: undefined };
      }
      return {
        weight: round3(Math.PI * (diameter / 2) ** 2 * length / 1_000_000_000 * density),
        basis: 'geometric',
        calculationThicknessMm: null,
        reference: undefined,
      };
    }
    const outer = Number(item.outer_diameter_mm || 0);
    const inner = Number(item.inner_diameter_mm || 0);
    const length = Number(item.length_mm || 0);
    if (outer <= 0 || inner < 0 || outer <= inner || length <= 0) {
      return { weight: null, basis: 'missing_rule', calculationThicknessMm: null, reference: undefined };
    }
    return {
      weight: round3(Math.PI * ((outer / 2) ** 2 - (inner / 2) ** 2) * length / 1_000_000_000 * density),
      basis: 'geometric',
      calculationThicknessMm: null,
      reference: undefined,
    };
  }

  function calculateEstimatedWeight(item: Pick<InventoryItemRow,
    'shape' | 'material_name' | 'density_kg_m3' | 'length_mm' | 'width_mm' | 'thickness_mm'
    | 'diameter_mm' | 'outer_diameter_mm' | 'inner_diameter_mm'>,
  measuredThicknessMm?: number | null): number | null {
    return calculateWeightEstimate(item, measuredThicknessMm).weight;
  }

  function listStock(shape?: string, search = ''): unknown[] {
    const params: unknown[] = [];
    let where = "WHERE s.deleted_at IS NULL AND i.deleted_at IS NULL";
    if (shape === 'sheet' || shape === 'rod' || shape === 'tube') {
      where += ' AND s.shape = ?';
      params.push(shape);
    }
    const rows = database.prepare(`
      SELECT
        s.id AS sku_id, s.sku, s.name, s.material_name, s.density_kg_m3, s.shape,
        s.standard_length_mm, s.standard_width_mm, s.standard_thickness_mm,
        s.standard_diameter_mm, s.standard_outer_diameter_mm, s.standard_inner_diameter_mm,
        s.unit, i.id AS item_id, i.inventory_type,
        i.length_mm, i.width_mm, i.thickness_mm, i.diameter_mm,
        i.outer_diameter_mm, i.inner_diameter_mm,
        i.estimated_weight_kg, i.actual_weight_kg, i.weight_status,
        i.legacy_sku, i.mapping_status, i.parent_item_id,
        COALESCE(SUM(m.quantity_delta), 0) AS current_quantity
      FROM inventory_skus s
      JOIN inventory_items i ON i.inventory_sku_id = s.id
      LEFT JOIN inventory_movements m ON m.inventory_item_id = i.id
      ${where}
      GROUP BY i.id
      ORDER BY s.material_name,
        CASE WHEN s.shape = 'sheet' THEN s.standard_thickness_mm ELSE s.standard_diameter_mm END,
        s.sku, i.length_mm DESC, i.width_mm DESC
    `).all(...params) as Record<string, any>[];
    const tokens = normalizeSearch(search);
    const filtered = tokens.length === 0 ? rows : rows.filter((row) => {
      const haystack = normalizeSearch([
        row.sku, row.material_name, row.legacy_sku,
        row.length_mm, row.width_mm, row.thickness_mm,
        row.diameter_mm, row.outer_diameter_mm, row.inner_diameter_mm,
      ].filter((value) => value !== null && value !== undefined).join(' '));
      return tokens.every((token) => haystack.some((part) => part.includes(token)));
    });
    const groups = new Map<string, Record<string, any>>();
    for (const row of filtered) {
      if (!groups.has(row.sku_id)) {
        groups.set(row.sku_id, {
          id: row.sku_id,
          sku: row.sku,
          name: row.name,
          material_name: row.material_name,
          density_kg_m3: row.density_kg_m3,
          shape: row.shape,
          standard_length_mm: row.standard_length_mm,
          standard_width_mm: row.standard_width_mm,
          standard_thickness_mm: row.standard_thickness_mm,
          standard_diameter_mm: row.standard_diameter_mm,
          standard_outer_diameter_mm: row.standard_outer_diameter_mm,
          standard_inner_diameter_mm: row.standard_inner_diameter_mm,
          unit: row.unit,
          total_quantity: 0,
          items: [],
        });
      }
      const group = groups.get(row.sku_id)!;
      const quantity = Number(row.current_quantity || 0);
      const measurement = latestMeasurement(row.item_id);
      const scaleMeasurement = latestMeasurement(row.item_id, true);
      const estimate = calculateWeightEstimate({
        shape: row.shape as InventoryShape,
        material_name: String(row.material_name),
        density_kg_m3: row.density_kg_m3 === null ? null : Number(row.density_kg_m3),
        length_mm: row.length_mm === null ? null : Number(row.length_mm),
        width_mm: row.width_mm === null ? null : Number(row.width_mm),
        thickness_mm: row.thickness_mm === null ? null : Number(row.thickness_mm),
        diameter_mm: row.diameter_mm === null ? null : Number(row.diameter_mm),
        outer_diameter_mm: row.outer_diameter_mm === null ? null : Number(row.outer_diameter_mm),
        inner_diameter_mm: row.inner_diameter_mm === null ? null : Number(row.inner_diameter_mm),
      }, measurement?.measured_thickness_mm);
      const actualWeight = scaleMeasurement?.actual_unit_weight_avg_kg ?? row.actual_weight_kg;
      const storedEstimate = row.estimated_weight_kg === null ? null : Number(row.estimated_weight_kg);
      const recommendationDiffers = actualWeight === null
        && measurement?.measured_thickness_mm == null
        && storedEstimate !== null
        && estimate.weight !== null
        && Math.abs(storedEstimate - estimate.weight) >= 0.0005;
      const displayedEstimate = recommendationDiffers ? storedEstimate : estimate.weight;
      const weightBasis: WeightBasis = actualWeight !== null
        ? 'scale'
        : recommendationDiffers
          ? 'legacy_estimate'
          : estimate.basis;
      group.total_quantity += quantity;
      group.items.push({
        id: row.item_id,
        inventory_type: row.inventory_type,
        length_mm: row.length_mm,
        width_mm: row.width_mm,
        thickness_mm: row.thickness_mm,
        diameter_mm: row.diameter_mm,
        outer_diameter_mm: row.outer_diameter_mm,
        inner_diameter_mm: row.inner_diameter_mm,
        estimated_weight_kg: displayedEstimate,
        stored_estimated_weight_kg: storedEstimate,
        recommended_estimated_weight_kg: estimate.weight,
        recommended_weight_basis: estimate.basis,
        actual_weight_kg: actualWeight,
        actual_weight_min_kg: scaleMeasurement?.actual_unit_weight_min_kg ?? actualWeight,
        actual_weight_max_kg: scaleMeasurement?.actual_unit_weight_max_kg ?? actualWeight,
        measurement_sample_count: scaleMeasurement?.sample_count ?? (actualWeight === null ? 0 : 1),
        measured_thickness_mm: measurement?.measured_thickness_mm ?? null,
        calculation_thickness_mm: estimate.calculationThicknessMm,
        reference_thickness_mm: estimate.reference?.reference_thickness_mm ?? null,
        reference_length_mm: estimate.reference?.reference_length_mm ?? null,
        reference_width_mm: estimate.reference?.reference_width_mm ?? null,
        reference_unit_weight_kg: estimate.reference?.reference_unit_weight_kg ?? null,
        reference_source: estimate.reference?.source_label ?? null,
        reference_note: estimate.reference?.source_note ?? null,
        weight_basis: weightBasis,
        display_weight_kg: actualWeight ?? displayedEstimate,
        weight_status: actualWeight !== null ? 'actual' : displayedEstimate === null ? 'missing_rule' : 'estimated',
        legacy_sku: row.legacy_sku,
        mapping_status: row.mapping_status,
        parent_item_id: row.parent_item_id,
        current_quantity: quantity,
      });
    }
    return [...groups.values()];
  }

  function listWeightReview(): {
    generated_at: string;
    summary: {
      review_item_count: number;
      affected_quantity: number;
      current_total_weight_kg: number;
      recommended_total_weight_kg: number;
      difference_total_weight_kg: number;
    };
    items: Array<Record<string, any>>;
  } {
    const groups = listStock() as Array<Record<string, any>>;
    const items: Array<Record<string, any>> = groups.flatMap((group) => (
      (group.items as Array<Record<string, any>>)
        .filter((item) => (
          item.weight_basis === 'legacy_estimate'
          && item.actual_weight_kg === null
          && item.stored_estimated_weight_kg !== null
          && item.recommended_estimated_weight_kg !== null
        ))
        .map((item) => {
          const quantity = Number(item.current_quantity || 0);
          const currentWeight = Number(item.stored_estimated_weight_kg);
          const recommendedWeight = Number(item.recommended_estimated_weight_kg);
          return {
            inventory_item_id: item.id,
            inventory_sku_id: group.id,
            sku: group.sku,
            material_name: group.material_name,
            shape: group.shape,
            inventory_type: item.inventory_type,
            length_mm: item.length_mm,
            width_mm: item.width_mm,
            thickness_mm: item.thickness_mm,
            diameter_mm: item.diameter_mm,
            current_quantity: quantity,
            current_estimated_weight_kg: currentWeight,
            recommended_estimated_weight_kg: recommendedWeight,
            difference_unit_weight_kg: round3(recommendedWeight - currentWeight),
            current_total_weight_kg: round3(currentWeight * quantity),
            recommended_total_weight_kg: round3(recommendedWeight * quantity),
            difference_total_weight_kg: round3((recommendedWeight - currentWeight) * quantity),
            recommended_weight_basis: item.recommended_weight_basis,
            calculation_thickness_mm: item.calculation_thickness_mm,
            reference_thickness_mm: item.reference_thickness_mm,
            reference_length_mm: item.reference_length_mm,
            reference_width_mm: item.reference_width_mm,
            reference_unit_weight_kg: item.reference_unit_weight_kg,
            reference_source: item.reference_source,
            reference_note: item.reference_note,
          };
        })
    ));
    const currentTotal = items.reduce((total, item) => total + Number(item.current_total_weight_kg), 0);
    const recommendedTotal = items.reduce((total, item) => total + Number(item.recommended_total_weight_kg), 0);
    return {
      generated_at: new Date().toISOString(),
      summary: {
        review_item_count: items.length,
        affected_quantity: items.reduce((total, item) => total + Number(item.current_quantity), 0),
        current_total_weight_kg: round3(currentTotal),
        recommended_total_weight_kg: round3(recommendedTotal),
        difference_total_weight_kg: round3(recommendedTotal - currentTotal),
      },
      items,
    };
  }

  function createItem(input: CreateItemInput): { sku: unknown; item: unknown; movement: unknown | null } {
    if (!['sheet', 'rod', 'tube'].includes(input.shape)) throw new Error('Inventory shape is invalid');
    const allowedTypes: Record<InventoryShape, InventoryType[]> = {
      sheet: ['full_sheet', 'remnant'],
      rod: ['full_rod', 'remnant'],
      tube: ['full_tube', 'remnant'],
    };
    if (!allowedTypes[input.shape].includes(input.inventoryType)) {
      throw new Error('Inventory type does not match the selected shape');
    }

    const quantity = Number(input.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) throw new Error('Quantity must be zero or greater');
    const actualWeight = input.actualWeightKg === null || input.actualWeightKg === undefined
      ? null
      : Number(input.actualWeightKg);
    if (actualWeight !== null && (!Number.isFinite(actualWeight) || actualWeight <= 0)) {
      throw new Error('Actual unit weight must be positive');
    }

    const dimensions = {
      length_mm: input.lengthMm ?? null,
      width_mm: input.shape === 'sheet' ? input.widthMm ?? null : null,
      thickness_mm: input.shape === 'sheet' ? input.thicknessMm ?? null : null,
      diameter_mm: input.shape === 'rod' ? input.diameterMm ?? null : null,
      outer_diameter_mm: input.shape === 'tube' ? input.outerDiameterMm ?? null : null,
      inner_diameter_mm: input.shape === 'tube' ? input.innerDiameterMm ?? null : null,
    };
    const requiredDimensions = input.shape === 'sheet'
      ? [dimensions.length_mm, dimensions.width_mm, dimensions.thickness_mm]
      : input.shape === 'rod'
        ? [dimensions.diameter_mm, dimensions.length_mm]
        : [dimensions.outer_diameter_mm, dimensions.length_mm];
    if (requiredDimensions.some((value) => value === null || !Number.isFinite(Number(value)) || Number(value) <= 0)) {
      throw new Error(`Incomplete ${input.shape} dimensions`);
    }
    if (input.shape === 'tube' && (
      dimensions.inner_diameter_mm === null
      || !Number.isFinite(Number(dimensions.inner_diameter_mm))
      || Number(dimensions.inner_diameter_mm) < 0
      || Number(dimensions.outer_diameter_mm) <= Number(dimensions.inner_diameter_mm)
    )) throw new Error('Tube inner diameter must be zero or greater and smaller than outer diameter');

    return database.transaction(() => {
      const now = new Date().toISOString();
      let sku = input.inventorySkuId
        ? database.prepare('SELECT * FROM inventory_skus WHERE id = ? AND deleted_at IS NULL').get(input.inventorySkuId) as Record<string, any> | undefined
        : undefined;
      if (input.inventorySkuId && !sku) throw new Error('Inventory SKU not found');
      if (sku && sku.shape !== input.shape) throw new Error('Inventory SKU shape does not match the selected shape');

      if (!sku) {
        const skuCode = String(input.sku || '').trim();
        const materialName = String(input.materialName || '').trim();
        const density = Number(input.densityKgM3);
        if (!skuCode) throw new Error('SKU is required');
        if (!materialName) throw new Error('Material name is required');
        if (!Number.isFinite(density) || density <= 0) throw new Error('Material density must be positive');
        if (database.prepare('SELECT 1 FROM inventory_skus WHERE sku = ?').get(skuCode)) {
          throw new Error('SKU already exists; select the existing SKU');
        }

        const standardDimensions = {
          standard_length_mm: input.standardLengthMm ?? null,
          standard_width_mm: input.shape === 'sheet' ? input.standardWidthMm ?? null : null,
          standard_thickness_mm: input.shape === 'sheet' ? input.standardThicknessMm ?? null : null,
          standard_diameter_mm: input.shape === 'rod' ? input.standardDiameterMm ?? null : null,
          standard_outer_diameter_mm: input.shape === 'tube' ? input.standardOuterDiameterMm ?? null : null,
          standard_inner_diameter_mm: input.shape === 'tube' ? input.standardInnerDiameterMm ?? null : null,
        };
        const requiredStandardDimensions = input.shape === 'sheet'
          ? [standardDimensions.standard_length_mm, standardDimensions.standard_width_mm, standardDimensions.standard_thickness_mm]
          : input.shape === 'rod'
            ? [standardDimensions.standard_diameter_mm, standardDimensions.standard_length_mm]
            : [standardDimensions.standard_outer_diameter_mm, standardDimensions.standard_length_mm];
        if (requiredStandardDimensions.some((value) => value === null || !Number.isFinite(Number(value)) || Number(value) <= 0)) {
          throw new Error(`Incomplete standard ${input.shape} dimensions`);
        }
        if (input.shape === 'tube' && (
          standardDimensions.standard_inner_diameter_mm === null
          || !Number.isFinite(Number(standardDimensions.standard_inner_diameter_mm))
          || Number(standardDimensions.standard_inner_diameter_mm) < 0
          || Number(standardDimensions.standard_outer_diameter_mm) <= Number(standardDimensions.standard_inner_diameter_mm)
        )) throw new Error('Standard tube inner diameter must be zero or greater and smaller than outer diameter');

        const skuId = randomUUID();
        database.prepare(`
          INSERT INTO inventory_skus (
            id, sku, name, material_name, density_kg_m3, shape,
            standard_length_mm, standard_width_mm, standard_thickness_mm,
            standard_diameter_mm, standard_outer_diameter_mm, standard_inner_diameter_mm,
            unit, source, created_by, updated_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pc', 'manual', ?, ?, ?, ?)
        `).run(
          skuId, skuCode, String(input.name || skuCode).trim() || skuCode,
          materialName, density, input.shape,
          standardDimensions.standard_length_mm, standardDimensions.standard_width_mm,
          standardDimensions.standard_thickness_mm, standardDimensions.standard_diameter_mm,
          standardDimensions.standard_outer_diameter_mm, standardDimensions.standard_inner_diameter_mm,
          input.userId || null, input.userId || null, now, now,
        );
        sku = database.prepare('SELECT * FROM inventory_skus WHERE id = ?').get(skuId) as Record<string, any>;
      }

      const duplicate = database.prepare(`
        SELECT id FROM inventory_items
        WHERE inventory_sku_id = ? AND deleted_at IS NULL
          AND length_mm IS ? AND width_mm IS ? AND thickness_mm IS ?
          AND diameter_mm IS ? AND outer_diameter_mm IS ? AND inner_diameter_mm IS ?
        LIMIT 1
      `).get(
        sku.id,
        dimensions.length_mm, dimensions.width_mm, dimensions.thickness_mm,
        dimensions.diameter_mm, dimensions.outer_diameter_mm, dimensions.inner_diameter_mm,
      );
      if (duplicate) throw new Error('This actual inventory specification already exists under the SKU');

      const estimatedWeight = calculateEstimatedWeight({
        shape: sku.shape,
        material_name: sku.material_name,
        density_kg_m3: sku.density_kg_m3,
        ...dimensions,
      });
      if (estimatedWeight === null && actualWeight === null) {
        throw new Error('No weight rule applies; provide actual unit weight or configure a rule');
      }

      const itemId = randomUUID();
      database.prepare(`
        INSERT INTO inventory_items (
          id, inventory_sku_id, inventory_type, length_mm, width_mm, thickness_mm,
          diameter_mm, outer_diameter_mm, inner_diameter_mm,
          estimated_weight_kg, actual_weight_kg, weight_status, mapping_status,
          created_by, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'auto_matched', ?, ?, ?, ?)
      `).run(
        itemId, sku.id, input.inventoryType,
        dimensions.length_mm, dimensions.width_mm, dimensions.thickness_mm,
        dimensions.diameter_mm, dimensions.outer_diameter_mm, dimensions.inner_diameter_mm,
        estimatedWeight, actualWeight, actualWeight === null ? 'estimated' : 'actual',
        input.userId || null, input.userId || null, now, now,
      );

      const movement = quantity === 0 ? null : recordMovement({
        inventoryItemId: itemId,
        movementType: 'INBOUND',
        quantity,
        notes: input.notes || 'Manual inventory specification creation',
        occurredAt: input.occurredAt,
        userId: input.userId,
        userName: input.userName,
      });
      return {
        sku: database.prepare('SELECT * FROM inventory_skus WHERE id = ?').get(sku.id),
        item: database.prepare('SELECT * FROM inventory_items WHERE id = ?').get(itemId),
        movement,
      };
    })();
  }

  function listMovements(itemId?: string, limit = 200): unknown[] {
    const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 1000);
    return database.prepare(`
      SELECT m.*, s.sku, i.inventory_type,
        i.length_mm, i.width_mm, i.thickness_mm, i.diameter_mm,
        i.outer_diameter_mm, i.inner_diameter_mm
      FROM inventory_movements m
      JOIN inventory_items i ON i.id = m.inventory_item_id
      JOIN inventory_skus s ON s.id = i.inventory_sku_id
      WHERE (? IS NULL OR m.inventory_item_id = ?)
      ORDER BY m.occurred_at DESC, m.created_at DESC
      LIMIT ?
    `).all(itemId || null, itemId || null, safeLimit);
  }

  function recordMovement(input: MovementInput): unknown {
    const item = getItem(input.inventoryItemId);
    if (!item) throw new Error('Inventory item not found');
    const requested = Number(input.quantity);
    if (!Number.isFinite(requested) || requested === 0) throw new Error('Quantity must be non-zero');
    const quantityDelta = input.movementType === 'OUTBOUND'
      ? -Math.abs(requested)
      : input.movementType === 'INBOUND'
        ? Math.abs(requested)
        : requested;
    const beforeQuantity = currentQuantity(item.id);
    if (beforeQuantity + quantityDelta < 0) throw new Error('Insufficient inventory');
    const unitEstimated = item.estimated_weight_kg;
    const unitActual = item.actual_weight_kg;
    const id = randomUUID();
    const now = new Date().toISOString();
    database.prepare(`
      INSERT INTO inventory_movements (
        id, movement_number, movement_type, inventory_item_id, quantity_delta,
        estimated_weight_delta_kg, actual_weight_delta_kg, notes,
        created_by, operator_name, occurred_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      movementNumber(input.movementType === 'INBOUND' ? 'IN' : input.movementType === 'OUTBOUND' ? 'OUT' : 'ADJ'),
      input.movementType,
      item.id,
      quantityDelta,
      unitEstimated === null ? null : round3(quantityDelta * unitEstimated),
      unitActual === null ? null : round3(quantityDelta * unitActual),
      input.notes || null,
      input.userId || null,
      input.userName || null,
      input.occurredAt || now,
      now,
    );
    return database.prepare('SELECT * FROM inventory_movements WHERE id = ?').get(id);
  }

  function recordMeasurement(input: MeasurementInput): unknown {
    const item = getItem(input.inventoryItemId);
    if (!item) throw new Error('Inventory item not found');
    const measuredThickness = optionalNumber(input.measuredThicknessMm);
    if (measuredThickness !== null && (item.shape !== 'sheet' || measuredThickness <= 0)) {
      throw new Error('Measured thickness must be positive and belongs to sheet inventory');
    }

    let minimumWeight = optionalNumber(input.actualUnitWeightMinKg);
    let maximumWeight = optionalNumber(input.actualUnitWeightMaxKg);
    let averageWeight = optionalNumber(input.actualUnitWeightAvgKg);
    const hasScaleWeight = minimumWeight !== null || maximumWeight !== null || averageWeight !== null;
    if (hasScaleWeight) {
      minimumWeight ??= averageWeight ?? maximumWeight;
      maximumWeight ??= averageWeight ?? minimumWeight;
      averageWeight ??= minimumWeight !== null && maximumWeight !== null
        ? round3((minimumWeight + maximumWeight) / 2)
        : null;
      if (
        minimumWeight === null || maximumWeight === null || averageWeight === null
        || minimumWeight <= 0 || maximumWeight < minimumWeight
        || averageWeight < minimumWeight || averageWeight > maximumWeight
      ) throw new Error('Actual unit weight range is invalid');
    }
    if (measuredThickness === null && averageWeight === null) {
      throw new Error('Provide measured thickness or actual unit weight');
    }

    const sampleCount = Number(input.sampleCount ?? 1);
    if (!Number.isInteger(sampleCount) || sampleCount <= 0) throw new Error('Sample count must be a positive integer');
    const measuredAt = String(input.measuredAt || new Date().toISOString().slice(0, 10));
    const now = new Date().toISOString();
    const measurementId = randomUUID();
    const measuredEstimate = measuredThickness === null
      ? item.estimated_weight_kg
      : calculateEstimatedWeight(item, measuredThickness);

    return database.transaction(() => {
      database.prepare(`
        INSERT INTO inventory_item_measurements (
          id, inventory_item_id, measured_thickness_mm,
          actual_unit_weight_min_kg, actual_unit_weight_max_kg,
          actual_unit_weight_avg_kg, sample_count, measured_at, notes,
          created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        measurementId,
        item.id,
        measuredThickness,
        minimumWeight,
        maximumWeight,
        averageWeight,
        sampleCount,
        measuredAt,
        input.notes || null,
        input.userId || null,
        now,
      );
      database.prepare(`
        UPDATE inventory_items
        SET estimated_weight_kg = ?, actual_weight_kg = COALESCE(?, actual_weight_kg),
          weight_status = CASE WHEN COALESCE(?, actual_weight_kg) IS NOT NULL THEN 'actual'
            WHEN ? IS NOT NULL THEN 'estimated' ELSE 'missing_rule' END,
          updated_by = ?, updated_at = ?
        WHERE id = ?
      `).run(
        measuredEstimate,
        averageWeight,
        averageWeight,
        measuredEstimate,
        input.userId || null,
        now,
        item.id,
      );
      return database.prepare('SELECT * FROM inventory_item_measurements WHERE id = ?').get(measurementId);
    })();
  }

  function cut(input: CutInput): { sourceMovement: unknown; remnantMovement: unknown; remnantItem: unknown } {
    const source = getItem(input.sourceItemId);
    if (!source) throw new Error('Source inventory item not found');
    const quantity = Math.abs(Number(input.quantity || 1));
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Quantity must be positive');
    if (currentQuantity(source.id) < quantity) throw new Error('Insufficient inventory');

    const dimensions = {
      length_mm: input.lengthMm ?? source.length_mm,
      width_mm: input.widthMm ?? source.width_mm,
      thickness_mm: input.thicknessMm ?? source.thickness_mm,
      diameter_mm: input.diameterMm ?? source.diameter_mm,
      outer_diameter_mm: input.outerDiameterMm ?? source.outer_diameter_mm,
      inner_diameter_mm: input.innerDiameterMm ?? source.inner_diameter_mm,
    };
    if (Number(dimensions.length_mm || 0) <= 0) throw new Error('Remnant length must be positive');
    if (source.shape === 'sheet') {
      if (Number(dimensions.width_mm || 0) <= 0 || Number(dimensions.thickness_mm || 0) <= 0) {
        throw new Error('Sheet remnant dimensions are incomplete');
      }
      if (Number(dimensions.thickness_mm) !== Number(source.thickness_mm)) {
        throw new Error('Cutting cannot change sheet thickness');
      }
    }
    if (source.shape === 'rod' && Number(dimensions.diameter_mm) !== Number(source.diameter_mm)) {
      throw new Error('Cutting cannot change rod diameter');
    }
    if (source.shape === 'tube' && (
      Number(dimensions.outer_diameter_mm) !== Number(source.outer_diameter_mm)
      || Number(dimensions.inner_diameter_mm) !== Number(source.inner_diameter_mm)
    )) throw new Error('Cutting cannot change tube diameters');

    const now = new Date().toISOString();
    const occurredAt = input.occurredAt || now;
    return database.transaction(() => {
      let remnant = database.prepare(`
        SELECT * FROM inventory_items
        WHERE inventory_sku_id = ? AND inventory_type = 'remnant'
          AND length_mm IS ? AND width_mm IS ? AND thickness_mm IS ?
          AND diameter_mm IS ? AND outer_diameter_mm IS ? AND inner_diameter_mm IS ?
          AND parent_item_id = ? AND deleted_at IS NULL
        LIMIT 1
      `).get(
        source.inventory_sku_id,
        dimensions.length_mm, dimensions.width_mm, dimensions.thickness_mm,
        dimensions.diameter_mm, dimensions.outer_diameter_mm, dimensions.inner_diameter_mm,
        source.id,
      ) as InventoryItemRow | undefined;
      if (!remnant) {
        const remnantId = randomUUID();
        const estimated = calculateEstimatedWeight({ ...source, ...dimensions });
        database.prepare(`
          INSERT INTO inventory_items (
            id, inventory_sku_id, inventory_type, length_mm, width_mm, thickness_mm,
            diameter_mm, outer_diameter_mm, inner_diameter_mm,
            estimated_weight_kg, actual_weight_kg, weight_status, mapping_status,
            parent_item_id, created_by, updated_by, created_at, updated_at
          ) VALUES (?, ?, 'remnant', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'auto_matched', ?, ?, ?, ?, ?)
        `).run(
          remnantId, source.inventory_sku_id,
          dimensions.length_mm, dimensions.width_mm, dimensions.thickness_mm,
          dimensions.diameter_mm, dimensions.outer_diameter_mm, dimensions.inner_diameter_mm,
          estimated,
          input.actualWeightKg ?? null,
          input.actualWeightKg !== null && input.actualWeightKg !== undefined ? 'actual' : estimated === null ? 'missing_rule' : 'estimated',
          source.id,
          input.userId || null,
          input.userId || null,
          now,
          now,
        );
        remnant = getItem(remnantId);
      }
      const consumeId = randomUUID();
      const createId = randomUUID();
      const consumeNumber = movementNumber('CUT-C');
      const createNumber = movementNumber('CUT-R');
      database.prepare(`
        INSERT INTO inventory_movements (
          id, movement_number, movement_type, inventory_item_id, source_item_id,
          related_movement_id, quantity_delta, estimated_weight_delta_kg,
          actual_weight_delta_kg, notes, created_by, operator_name, occurred_at, created_at
        ) VALUES (?, ?, 'CUT_CONSUME', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        consumeId, consumeNumber, source.id, source.id, createId, -quantity,
        source.estimated_weight_kg === null ? null : round3(-quantity * source.estimated_weight_kg),
        source.actual_weight_kg === null ? null : round3(-quantity * source.actual_weight_kg),
        input.notes || null, input.userId || null, input.userName || null, occurredAt, now,
      );
      database.prepare(`
        INSERT INTO inventory_movements (
          id, movement_number, movement_type, inventory_item_id, source_item_id,
          related_movement_id, quantity_delta, estimated_weight_delta_kg,
          actual_weight_delta_kg, notes, created_by, operator_name, occurred_at, created_at
        ) VALUES (?, ?, 'CUT_REMNANT_CREATE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        createId, createNumber, remnant!.id, source.id, consumeId, quantity,
        remnant!.estimated_weight_kg === null ? null : round3(quantity * remnant!.estimated_weight_kg),
        remnant!.actual_weight_kg === null ? null : round3(quantity * remnant!.actual_weight_kg),
        input.notes || null, input.userId || null, input.userName || null, occurredAt, now,
      );
      return {
        sourceMovement: database.prepare('SELECT * FROM inventory_movements WHERE id = ?').get(consumeId),
        remnantMovement: database.prepare('SELECT * FROM inventory_movements WHERE id = ?').get(createId),
        remnantItem: database.prepare('SELECT * FROM inventory_items WHERE id = ?').get(remnant!.id),
      };
    })();
  }

  function listRules(): unknown[] {
    return database.prepare(`
      SELECT * FROM inventory_rules
      ORDER BY material_name, shape, rule_type, min_thickness_mm, length_mm, width_mm
    `).all();
  }

  function normalizeInventoryType(value: unknown, shape: 'sheet' | 'rod' | 'tube'): NormalizedImportRow['inventory_type'] | null {
    const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    const aliases: Record<string, NormalizedImportRow['inventory_type']> = {
      full_sheet: 'full_sheet', '整板': 'full_sheet',
      full_rod: 'full_rod', '整棒': 'full_rod',
      full_tube: 'full_tube', '整管': 'full_tube',
      remnant: 'remnant', '余料': 'remnant',
    };
    if (normalized) return aliases[normalized] || null;
    return shape === 'sheet' ? 'full_sheet' : shape === 'rod' ? 'full_rod' : 'full_tube';
  }

  function parseDimensions(row: Record<string, unknown>, shape: 'sheet' | 'rod' | 'tube') {
    let length = optionalNumber(firstValue(row, ['Length', 'length', 'LengthMm', 'length_mm', '实际长度']));
    let width = optionalNumber(firstValue(row, ['Width', 'width', 'WidthMm', 'width_mm', '实际宽度']));
    let thickness = optionalNumber(firstValue(row, ['Thickness', 'thickness', 'ThicknessMm', 'thickness_mm', '实际厚度']));
    let diameter = optionalNumber(firstValue(row, ['Diameter', 'diameter', 'DiameterMm', 'diameter_mm', '实际直径']));
    let outer = optionalNumber(firstValue(row, ['OuterDiameter', 'outer_diameter_mm', '外径']));
    let inner = optionalNumber(firstValue(row, ['InnerDiameter', 'inner_diameter_mm', '内径']));
    const text = String(firstValue(row, ['ActualDimension', 'ActualDimensions', 'Dimensions', 'Specification', '实际尺寸', '规格']) || '');
    const parts = text.replace(/[Ø⌀]/g, '').split(/[×xX*]/).map((part) => Number(part.trim())).filter(Number.isFinite);
    if (parts.length > 0) {
      if (shape === 'sheet' && parts.length >= 3) [length, width, thickness] = parts;
      if (shape === 'rod' && parts.length >= 2) [diameter, length] = parts;
      if (shape === 'tube' && parts.length >= 3) [outer, inner, length] = parts;
    }
    return {
      length_mm: length,
      width_mm: shape === 'sheet' ? width : null,
      thickness_mm: shape === 'sheet' ? thickness : null,
      diameter_mm: shape === 'rod' ? diameter : null,
      outer_diameter_mm: shape === 'tube' ? outer : null,
      inner_diameter_mm: shape === 'tube' ? inner : null,
    };
  }

  function inferInventoryType(
    sku: Record<string, any>,
    dimensions: ReturnType<typeof parseDimensions>,
    supplied: unknown,
  ): NormalizedImportRow['inventory_type'] | null {
    if (supplied !== undefined && supplied !== null && String(supplied).trim() !== '') {
      return normalizeInventoryType(supplied, sku.shape);
    }
    if (sku.shape === 'sheet') {
      const fullSizeRule = database.prepare(`
        SELECT 1 FROM inventory_rules
        WHERE material_name = ? AND shape = 'sheet' AND rule_type = 'full_size' AND active = 1
          AND length_mm = ? AND width_mm = ? LIMIT 1
      `).get(sku.material_name, dimensions.length_mm, dimensions.width_mm);
      if (fullSizeRule || (
        Number(dimensions.length_mm) === Number(sku.standard_length_mm)
        && Number(dimensions.width_mm) === Number(sku.standard_width_mm)
      )) return 'full_sheet';
      return 'remnant';
    }
    if (sku.shape === 'rod') {
      return Number(dimensions.length_mm) === Number(sku.standard_length_mm)
        && Number(dimensions.diameter_mm) === Number(sku.standard_diameter_mm)
        ? 'full_rod' : 'remnant';
    }
    return Number(dimensions.length_mm) === Number(sku.standard_length_mm)
      && Number(dimensions.outer_diameter_mm) === Number(sku.standard_outer_diameter_mm)
      && Number(dimensions.inner_diameter_mm) === Number(sku.standard_inner_diameter_mm)
      ? 'full_tube' : 'remnant';
  }

  function buildImportPreview(
    rows: Record<string, unknown>[],
    mode: ImportMode,
    scope: ImportScope,
  ): ImportPreview {
    if (!['incremental', 'snapshot'].includes(mode)) throw new Error('Import mode must be incremental or snapshot');
    if (!['sheet', 'rod', 'tube', 'all'].includes(scope)) throw new Error('Import scope is invalid');
    if (mode === 'snapshot' && scope === 'all') throw new Error('Snapshot import requires an explicit sheet, rod, or tube scope');

    const errors: ImportPreview['errors'] = [];
    const normalized: NormalizedImportRow[] = [];
    const seen = new Set<string>();
    rows.forEach((raw, index) => {
      const rowNumber = index + 2;
      const skuCode = String(firstValue(raw, ['SKU', 'sku', '主体SKU', '标准SKU']) || '').trim();
      if (!skuCode) {
        errors.push({ row_number: rowNumber, message: 'Missing SKU' });
        return;
      }
      const sku = database.prepare('SELECT * FROM inventory_skus WHERE sku = ? AND deleted_at IS NULL').get(skuCode) as Record<string, any> | undefined;
      if (!sku) {
        errors.push({ row_number: rowNumber, message: `SKU "${skuCode}" not found; mapping was not guessed` });
        return;
      }
      if (scope !== 'all' && sku.shape !== scope) {
        errors.push({ row_number: rowNumber, message: `SKU "${skuCode}" is outside the ${scope} import scope` });
        return;
      }
      const dimensions = parseDimensions(raw, sku.shape);
      const required = sku.shape === 'sheet'
        ? [dimensions.length_mm, dimensions.width_mm, dimensions.thickness_mm]
        : sku.shape === 'rod'
          ? [dimensions.diameter_mm, dimensions.length_mm]
          : [dimensions.outer_diameter_mm, dimensions.inner_diameter_mm, dimensions.length_mm];
      if (required.some((value) => value === null || Number(value) <= 0)) {
        errors.push({ row_number: rowNumber, message: `Incomplete ${sku.shape} dimensions` });
        return;
      }
      const quantity = optionalNumber(firstValue(raw, ['Quantity', 'quantity', 'Qty', 'qty', '数量']));
      if (quantity === null || quantity < 0) {
        errors.push({ row_number: rowNumber, message: 'Quantity must be zero or greater' });
        return;
      }
      const inventoryType = inferInventoryType(
        sku,
        dimensions,
        firstValue(raw, ['InventoryType', 'inventory_type', '库存类型']),
      );
      if (!inventoryType) {
        errors.push({ row_number: rowNumber, message: 'Inventory type must be Full Sheet, Full Rod, Full Tube, or Remnant' });
        return;
      }
      const actualWeight = optionalNumber(firstValue(raw, ['ActualWeightKg', 'actual_weight_kg', '实际重量kg', '实际重量']));
      const estimatedWeight = calculateEstimatedWeight({
        shape: sku.shape,
        material_name: sku.material_name,
        density_kg_m3: sku.density_kg_m3,
        ...dimensions,
      });
      if (estimatedWeight === null && actualWeight === null) {
        errors.push({ row_number: rowNumber, message: 'No weight rule applies; provide actual_weight_kg or configure a rule' });
        return;
      }
      const candidate: NormalizedImportRow = {
        row_number: rowNumber,
        sku_id: sku.id,
        sku: sku.sku,
        shape: sku.shape,
        inventory_type: inventoryType,
        ...dimensions,
        quantity,
        estimated_weight_kg: estimatedWeight,
        actual_weight_kg: actualWeight,
        weight_status: actualWeight !== null ? 'actual' : estimatedWeight === null ? 'missing_rule' : 'estimated',
        existing_item_id: null,
        current_quantity: 0,
        previous_actual_weight_kg: null,
      };
      const key = dimensionKey(candidate);
      if (seen.has(key)) {
        errors.push({ row_number: rowNumber, message: `Duplicate inventory specification for ${sku.sku}` });
        return;
      }
      seen.add(key);
      const existing = database.prepare(`
        SELECT i.id, i.actual_weight_kg,
          COALESCE(SUM(m.quantity_delta), 0) AS current_quantity
        FROM inventory_items i
        LEFT JOIN inventory_movements m ON m.inventory_item_id = i.id
        WHERE i.inventory_sku_id = ? AND i.deleted_at IS NULL
          AND i.length_mm IS ? AND i.width_mm IS ? AND i.thickness_mm IS ?
          AND i.diameter_mm IS ? AND i.outer_diameter_mm IS ? AND i.inner_diameter_mm IS ?
        GROUP BY i.id LIMIT 1
      `).get(
        sku.id,
        dimensions.length_mm, dimensions.width_mm, dimensions.thickness_mm,
        dimensions.diameter_mm, dimensions.outer_diameter_mm, dimensions.inner_diameter_mm,
      ) as { id: string; actual_weight_kg: number | null; current_quantity: number } | undefined;
      if (existing) {
        candidate.existing_item_id = existing.id;
        candidate.current_quantity = Number(existing.current_quantity || 0);
        candidate.previous_actual_weight_kg = existing.actual_weight_kg;
      }
      normalized.push(candidate);
    });

    const added = normalized.filter((row) => !row.existing_item_id);
    const changed = normalized.filter((row) => row.existing_item_id && (
      row.quantity !== row.current_quantity
      || row.actual_weight_kg !== row.previous_actual_weight_kg
    ));
    const unchanged = normalized.filter((row) => row.existing_item_id && !changed.includes(row));
    const zeroed: NormalizedImportRow[] = [];
    if (mode === 'snapshot') {
      const currentRows = database.prepare(`
        SELECT s.id AS sku_id, s.sku, s.shape, i.*,
          COALESCE(SUM(m.quantity_delta), 0) AS current_quantity
        FROM inventory_skus s
        JOIN inventory_items i ON i.inventory_sku_id = s.id
        LEFT JOIN inventory_movements m ON m.inventory_item_id = i.id
        WHERE s.deleted_at IS NULL AND i.deleted_at IS NULL AND s.shape = ?
        GROUP BY i.id
      `).all(scope) as Record<string, any>[];
      for (const existing of currentRows) {
        if (Number(existing.current_quantity || 0) === 0) continue;
        const key = dimensionKey(existing as NormalizedImportRow);
        if (seen.has(key)) continue;
        zeroed.push({
          row_number: 0,
          sku_id: existing.sku_id,
          sku: existing.sku,
          shape: existing.shape,
          inventory_type: existing.inventory_type,
          length_mm: existing.length_mm,
          width_mm: existing.width_mm,
          thickness_mm: existing.thickness_mm,
          diameter_mm: existing.diameter_mm,
          outer_diameter_mm: existing.outer_diameter_mm,
          inner_diameter_mm: existing.inner_diameter_mm,
          quantity: 0,
          estimated_weight_kg: existing.estimated_weight_kg,
          actual_weight_kg: existing.actual_weight_kg,
          weight_status: existing.weight_status,
          existing_item_id: existing.id,
          current_quantity: Number(existing.current_quantity),
          previous_actual_weight_kg: existing.actual_weight_kg,
        });
      }
    }
    const hashPayload = JSON.stringify({ mode, scope, added, changed, unchanged, zeroed, errors });
    return {
      mode, scope, added, changed, unchanged, zeroed, errors,
      preview_hash: createHash('sha256').update(hashPayload).digest('hex'),
    };
  }

  function confirmImport(
    rows: Record<string, unknown>[],
    mode: ImportMode,
    scope: ImportScope,
    expectedHash: string,
    actor: { userId?: string | null; userName?: string | null },
  ): { import_batch_id: string; added: number; changed: number; unchanged: number; zeroed: number } {
    return database.transaction(() => {
      const preview = buildImportPreview(rows, mode, scope);
      if (preview.errors.length > 0) throw new Error('Import preview contains errors');
      if (!expectedHash || preview.preview_hash !== expectedHash) {
        throw new Error('Inventory changed after preview; review the latest differences before confirming');
      }
      const now = new Date().toISOString();
      const batchId = randomUUID();
      const insertMovement = database.prepare(`
        INSERT INTO inventory_movements (
          id, movement_number, movement_type, inventory_item_id, quantity_delta,
          estimated_weight_delta_kg, actual_weight_delta_kg, import_batch_id,
          notes, created_by, operator_name, occurred_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const applyMovement = (row: NormalizedImportRow, itemId: string, type: 'ADJUSTMENT' | 'SNAPSHOT_ADJUSTMENT') => {
        const delta = row.quantity - row.current_quantity;
        const actualCorrection = row.actual_weight_kg === null && row.previous_actual_weight_kg === null
          ? null
          : round3(
            row.quantity * (row.actual_weight_kg || 0)
            - row.current_quantity * (row.previous_actual_weight_kg || 0),
          );
        if (delta === 0 && actualCorrection === 0) return;
        insertMovement.run(
          randomUUID(), movementNumber(type === 'SNAPSHOT_ADJUSTMENT' ? 'SNAP' : 'IMP'), type,
          itemId, delta,
          row.estimated_weight_kg === null ? null : round3(delta * row.estimated_weight_kg),
          actualCorrection,
          batchId,
          `Excel ${mode} import`,
          actor.userId || null,
          actor.userName || null,
          now,
          now,
        );
      };

      for (const row of preview.added) {
        const itemId = randomUUID();
        database.prepare(`
          INSERT INTO inventory_items (
            id, inventory_sku_id, inventory_type, length_mm, width_mm, thickness_mm,
            diameter_mm, outer_diameter_mm, inner_diameter_mm,
            estimated_weight_kg, actual_weight_kg, weight_status, mapping_status,
            created_by, updated_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'auto_matched', ?, ?, ?, ?)
        `).run(
          itemId, row.sku_id, row.inventory_type,
          row.length_mm, row.width_mm, row.thickness_mm,
          row.diameter_mm, row.outer_diameter_mm, row.inner_diameter_mm,
          row.estimated_weight_kg, row.actual_weight_kg, row.weight_status,
          actor.userId || null, actor.userId || null, now, now,
        );
        applyMovement(row, itemId, mode === 'snapshot' ? 'SNAPSHOT_ADJUSTMENT' : 'ADJUSTMENT');
      }
      for (const row of preview.changed) {
        database.prepare(`
          UPDATE inventory_items
          SET inventory_type = ?, estimated_weight_kg = ?, actual_weight_kg = ?,
            weight_status = ?, updated_by = ?, updated_at = ?
          WHERE id = ?
        `).run(
          row.inventory_type, row.estimated_weight_kg, row.actual_weight_kg,
          row.weight_status, actor.userId || null, now, row.existing_item_id,
        );
        applyMovement(row, row.existing_item_id!, mode === 'snapshot' ? 'SNAPSHOT_ADJUSTMENT' : 'ADJUSTMENT');
      }
      for (const row of preview.zeroed) applyMovement(row, row.existing_item_id!, 'SNAPSHOT_ADJUSTMENT');
      return {
        import_batch_id: batchId,
        added: preview.added.length,
        changed: preview.changed.length,
        unchanged: preview.unchanged.length,
        zeroed: preview.zeroed.length,
      };
    })();
  }

  function updateRule(ruleId: string, values: Record<string, unknown>): unknown {
    const allowed = [
      'min_thickness_mm', 'max_thickness_mm', 'length_mm', 'width_mm',
      'tolerance_mm', 'inventory_type', 'active',
    ];
    const fields = allowed.filter((field) => Object.prototype.hasOwnProperty.call(values, field));
    if (fields.length === 0) throw new Error('No valid rule fields to update');
    const result = database.prepare(`
      UPDATE inventory_rules SET ${fields.map((field) => `${field} = ?`).join(', ')}, updated_at = ?
      WHERE id = ?
    `).run(...fields.map((field) => values[field]), new Date().toISOString(), ruleId);
    if (result.changes === 0) throw new Error('Inventory rule not found');
    return database.prepare('SELECT * FROM inventory_rules WHERE id = ?').get(ruleId);
  }

  return {
    listStock,
    listWeightReview,
    createItem,
    listMovements,
    recordMovement,
    recordMeasurement,
    cut,
    listRules,
    updateRule,
    currentQuantity,
    calculateEstimatedWeight,
    buildImportPreview,
    confirmImport,
  };
}
