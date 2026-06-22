import db from './db';

export interface ProductDims {
  product_type: 'sheet' | 'rod' | 'tube' | 'part';
  length_mm?: number;
  width_mm?: number;
  thickness_mm?: number;
  diameter_mm?: number;
  outer_diameter_mm?: number;
  inner_diameter_mm?: number;
  unit_weight_kg?: number;
}

/**
 * Calculate unit weight (kg) from product dimensions and material density (kg/m³).
 *
 * Formula: Weight(kg) = Volume(m³) × Density(kg/m³)
 *
 * Sheet:   (L × W × T) / 1e9 × ρ          (mm³ → m³)
 * Rod:     π × (D/2)² × L / 1e9 × ρ
 * Tube:    π × (OD² - ID²) / 4 × L / 1e9 × ρ
 * Part:    manual input unit_weight_kg
 */
export function calcUnitWeight(dims: ProductDims, density_kg_m3: number): number {
  const ρ = density_kg_m3;
  let volume_mm3 = 0;

  switch (dims.product_type) {
    case 'sheet': {
      const L = dims.length_mm || 0;
      const W = dims.width_mm || 0;
      const T = dims.thickness_mm || 0;
      volume_mm3 = L * W * T;
      break;
    }
    case 'rod': {
      const D = dims.diameter_mm || 0;
      const L = dims.length_mm || 0;
      const r = D / 2;
      volume_mm3 = Math.PI * r * r * L;
      break;
    }
    case 'tube': {
      const OD = dims.outer_diameter_mm || 0;
      const ID = dims.inner_diameter_mm || 0;
      const L = dims.length_mm || 0;
      const ro = OD / 2;
      const ri = ID / 2;
      volume_mm3 = Math.PI * (ro * ro - ri * ri) * L;
      break;
    }
    case 'part':
      return dims.unit_weight_kg || 0;
  }

  // mm³ → m³ = / 1e9, then × density (kg/m³)
  return (volume_mm3 / 1_000_000_000) * ρ;
}

/**
 * Round to 3 decimal places (gram precision).
 */
export function round3(kg: number): number {
  return Math.round(kg * 1000) / 1000;
}

/**
 * Get material density from database.
 */
export function getMaterialDensity(materialId: string | null | undefined): number {
  if (!materialId) return 0;
  const row = db.prepare("SELECT density_kg_m3 FROM materials WHERE id = ?").get(materialId) as any;
  return row?.density_kg_m3 || 0;
}

/**
 * Calculate and update unit_weight_kg for a product.
 * Returns the computed weight.
 */
export function updateProductWeight(productId: string): number {
  const prod = db.prepare("SELECT * FROM products WHERE id = ?").get(productId) as any;
  if (!prod) return 0;

  // For Part type, weight is manually entered — preserve existing value
  if (prod.product_type === 'part') {
    const wt = prod.unit_weight_kg || 0;
    db.prepare("UPDATE products SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), productId);
    return wt;
  }

  const density = getMaterialDensity(prod.material_id);
  const weight = round3(calcUnitWeight(prod, density));
  db.prepare("UPDATE products SET unit_weight_kg = ?, updated_at = ? WHERE id = ?")
    .run(weight, new Date().toISOString(), productId);
  return weight;
}
