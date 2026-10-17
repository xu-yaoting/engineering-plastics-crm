import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import XLSX from 'xlsx';
import db from '../db.js';
import { validate } from '../validate.js';
import { updateProductWeight, getMaterialDensity } from '../weight.js';
import { computeChanges, writeAudit } from '../audit.js';
import { createInventoryV2Service, InventoryMovementType } from '../inventory/service.js';
import { exportInventoryWorkbook } from '../inventory/export.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const router = Router();
const inventoryV2 = createInventoryV2Service(db);

function parseInventoryUpload(file: Express.Multer.File): Record<string, unknown>[] {
  if (file.originalname.toLowerCase().endsWith('.csv')) {
    const text = file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map((header) => header.trim());
    return lines.slice(1).map((line) => {
      const values = line.split(',').map((value) => value.trim());
      return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
    });
  }
  const workbook = XLSX.read(file.buffer, { type: 'buffer' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];
}

const MATERIAL_UPDATE_FIELDS = [
  'name',
  'density_kg_m3',
  'category',
] as const;

const PRODUCT_UPDATE_FIELDS = [
  'sku',
  'name',
  'category',
  'product_type',
  'stock_tracking_mode',
  'length_mm',
  'width_mm',
  'thickness_mm',
  'diameter_mm',
  'outer_diameter_mm',
  'inner_diameter_mm',
  'unit_weight_kg',
  'material_id',
  'unit',
  'safety_stock_qty',
  'safety_stock_weight_kg',
] as const;

// ─── Helper: compute total_weight_kg for a transaction ───
function txnWeight(product_id: string, qty: number): number {
  const prod = db.prepare("SELECT unit_weight_kg FROM products WHERE id = ?").get(product_id) as any;
  return Math.abs(qty) * (prod?.unit_weight_kg || 0);
}

function currentStock(productId: string): number {
  const row = db.prepare("SELECT COALESCE(SUM(quantity), 0) AS current FROM inventory_transactions WHERE product_id = ?")
    .get(productId) as { current: number };
  return row?.current || 0;
}

// ─── Materials ───

router.get('/materials', (_req: Request, res: Response) => {
  res.json(db.prepare("SELECT * FROM materials WHERE deleted_at IS NULL ORDER BY name").all());
});

router.post('/materials', (req: Request, res: Response) => {
  const err = validate(req.body, ['name', 'density_kg_m3']);
  if (err) return res.status(400).json({ error: err });
  const id = uuidv4(); const now = new Date().toISOString();
  db.prepare("INSERT INTO materials (id, name, density_kg_m3, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, req.body.name, req.body.density_kg_m3, req.body.category || null, now, now);
  res.status(201).json(db.prepare("SELECT * FROM materials WHERE id = ?").get(id));
});

router.put('/materials/:id', (req: Request, res: Response) => {
  const now = new Date().toISOString();
  const mat = db.prepare("SELECT * FROM materials WHERE id = ? AND deleted_at IS NULL").get(req.params.id) as any;
  if (!mat) return res.status(404).json({ error: 'Not found' });
  if (mat.system_material && req.body.density_kg_m3 !== undefined && req.body.density_kg_m3 !== mat.density_kg_m3) {
    // Recalculate all products using this material
    db.prepare("UPDATE materials SET density_kg_m3 = ?, updated_at = ? WHERE id = ?")
      .run(req.body.density_kg_m3, now, req.params.id);
    const prods = db.prepare("SELECT id FROM products WHERE material_id = ?").all(req.params.id) as any[];
    for (const p of prods) updateProductWeight(p.id);
    return res.json(db.prepare("SELECT * FROM materials WHERE id = ?").get(req.params.id));
  }
  const updateFields = MATERIAL_UPDATE_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(req.body, field)
  );
  if (updateFields.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
  const fields = updateFields.map((field) => `${field} = ?`).join(', ');
  const values = updateFields.map((field) => req.body[field]);
  db.prepare(`UPDATE materials SET ${fields}, updated_at = ? WHERE id = ?`).run(...values, now, req.params.id);
  res.json(db.prepare("SELECT * FROM materials WHERE id = ?").get(req.params.id));
});

router.delete('/materials/:id', (req: Request, res: Response) => {
  const now = new Date().toISOString();
  const mat = db.prepare("SELECT id, system_material FROM materials WHERE id = ? AND deleted_at IS NULL").get(req.params.id) as any;
  if (!mat) return res.status(404).json({ error: 'Not found' });
  if (mat.system_material) return res.status(400).json({ error: 'System material cannot be deleted' });

  const result = db.prepare("UPDATE materials SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL")
    .run(now, now, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});

// ─── Products ───

router.get('/products', (_req: Request, res: Response) => {
  const products = db.prepare(`
    SELECT p.*, m.name as material_name, m.density_kg_m3
    FROM products p LEFT JOIN materials m ON p.material_id = m.id
    WHERE p.deleted_at IS NULL ORDER BY p.name
  `).all();
  res.json(products);
});

router.post('/products', (req: Request, res: Response) => {
  const err = validate(req.body, ['sku', 'name']);
  if (err) return res.status(400).json({ error: err });
  const existing = db.prepare("SELECT id FROM products WHERE sku = ? AND deleted_at IS NULL").get(req.body.sku);
  if (existing) return res.status(400).json({ error: 'SKU already exists' });
  const id = uuidv4(); const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare(`
    INSERT INTO products (id, sku, name, category, product_type, stock_tracking_mode,
      length_mm, width_mm, thickness_mm, diameter_mm, outer_diameter_mm, inner_diameter_mm,
      unit_weight_kg, material_id, unit, safety_stock_qty, safety_stock_weight_kg,
      created_by, updated_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.body.sku, req.body.name, req.body.category || null,
    req.body.product_type || 'part', req.body.stock_tracking_mode || 'piece',
    req.body.length_mm || null, req.body.width_mm || null, req.body.thickness_mm || null,
    req.body.diameter_mm || null, req.body.outer_diameter_mm || null, req.body.inner_diameter_mm || null,
    req.body.unit_weight_kg || 0, req.body.material_id || null, req.body.unit || 'pc',
      req.body.safety_stock_qty || 0, req.body.safety_stock_weight_kg || 0,
      req.user!.id, req.user!.id, now, now);
    updateProductWeight(id);
    const created = db.prepare("SELECT * FROM products WHERE id = ?").get(id) as Record<string, unknown>;
    writeAudit(req, 'product', id, 'create', computeChanges(null, created));
  })();
  res.status(201).json(db.prepare("SELECT * FROM products WHERE id = ?").get(id));
});

router.put('/products/:id', (req: Request, res: Response) => {
  const now = new Date().toISOString();
  if (req.body.sku !== undefined) {
    const existing = db.prepare("SELECT id FROM products WHERE sku = ? AND id != ? AND deleted_at IS NULL")
      .get(req.body.sku, req.params.id);
    if (existing) return res.status(400).json({ error: 'SKU already exists' });
  }
  const updateFields = PRODUCT_UPDATE_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(req.body, field)
  );
  if (updateFields.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
  const fields = updateFields.map((field) => `${field} = ?`).join(', ');
  const values = updateFields.map((field) => req.body[field]);
  const before = db.prepare("SELECT * FROM products WHERE id = ? AND deleted_at IS NULL").get(req.params.id) as Record<string, unknown> | undefined;
  if (!before) return res.status(404).json({ error: 'Not found' });
  const dimFields = ['product_type', 'length_mm', 'width_mm', 'thickness_mm', 'diameter_mm', 'outer_diameter_mm', 'inner_diameter_mm', 'material_id', 'unit_weight_kg'];
  db.transaction(() => {
    db.prepare(`UPDATE products SET ${fields}, updated_by = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`)
      .run(...values, req.user!.id, now, req.params.id);
    if (dimFields.some(f => f in req.body)) updateProductWeight(req.params.id);
    const after = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id) as Record<string, unknown>;
    writeAudit(req, 'product', req.params.id, 'update', computeChanges(before, after));
  })();
  res.json(db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id));
});

router.delete('/products/:id', (req: Request, res: Response) => {
  const now = new Date().toISOString();
  const before = db.prepare("SELECT * FROM products WHERE id = ? AND deleted_at IS NULL").get(req.params.id) as Record<string, unknown> | undefined;
  if (!before) return res.status(404).json({ error: 'Not found' });
  db.transaction(() => {
    db.prepare("UPDATE products SET deleted_at = ?, updated_by = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL")
      .run(now, req.user!.id, now, req.params.id);
    writeAudit(req, 'product', req.params.id, 'delete', { sku: before.sku, name: before.name });
  })();
  res.status(204).send();
});

// ─── Warehouses ───

router.get('/warehouses', (_req: Request, res: Response) => {
  res.json(db.prepare("SELECT * FROM warehouses WHERE deleted_at IS NULL ORDER BY is_default DESC, name").all());
});

router.post('/warehouses', (req: Request, res: Response) => {
  const err = validate(req.body, ['name']);
  if (err) return res.status(400).json({ error: err });
  const id = uuidv4(); const now = new Date().toISOString();
  db.prepare("INSERT INTO warehouses (id, name, location, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, req.body.name, req.body.location || null, req.body.is_default ? 1 : 0, now, now);
  res.status(201).json(db.prepare("SELECT * FROM warehouses WHERE id = ?").get(id));
});

// ─── Ledger ───

router.get('/ledger', (req: Request, res: Response) => {
  const { product_id, type, limit } = req.query;
  let sql = `SELECT t.*, p.name as product_name, p.sku as product_sku
    FROM inventory_transactions t LEFT JOIN products p ON t.product_id = p.id WHERE 1=1`;
  const params: any[] = [];
  if (product_id) { sql += " AND t.product_id = ?"; params.push(product_id); }
  if (type) { sql += " AND t.transaction_type = ?"; params.push(type); }
  sql += " ORDER BY t.transaction_date DESC, t.created_at DESC";
  if (limit) { sql += " LIMIT ?"; params.push(parseInt(limit as string)); }
  res.json(db.prepare(sql).all(...params));
});

// ─── Current Stock (qty + weight) ───

router.get('/stock', (_req: Request, res: Response) => {
  const stock = db.prepare(`
    SELECT p.id, p.sku, p.name, p.category, p.unit, p.product_type, p.stock_tracking_mode,
      p.unit_weight_kg, p.safety_stock_qty, p.safety_stock_weight_kg,
      COALESCE(SUM(t.quantity), 0) as current_stock,
      COALESCE(SUM(t.total_weight_kg), 0) as current_weight_kg,
      m.name as material_name
    FROM products p
    LEFT JOIN inventory_transactions t ON p.id = t.product_id
    LEFT JOIN materials m ON p.material_id = m.id
    WHERE p.deleted_at IS NULL
    GROUP BY p.id
    ORDER BY p.name
  `).all();
  res.json(stock);
});

// ─── Low Stock (dual threshold: qty OR weight) ───

router.get('/low-stock', (_req: Request, res: Response) => {
  const lowStock = db.prepare(`
    SELECT p.id, p.sku, p.name, p.category, p.unit, p.safety_stock_qty, p.safety_stock_weight_kg,
      COALESCE(SUM(t.quantity), 0) as current_stock,
      COALESCE(SUM(t.total_weight_kg), 0) as current_weight_kg,
      m.name as material_name
    FROM products p
    LEFT JOIN inventory_transactions t ON p.id = t.product_id
    LEFT JOIN materials m ON p.material_id = m.id
    WHERE p.deleted_at IS NULL
      AND (p.safety_stock_qty > 0 OR p.safety_stock_weight_kg > 0)
    GROUP BY p.id
    HAVING (p.safety_stock_qty > 0 AND current_stock < p.safety_stock_qty)
        OR (p.safety_stock_weight_kg > 0 AND current_weight_kg < p.safety_stock_weight_kg)
    ORDER BY MIN(current_stock, current_weight_kg) ASC
  `).all();
  res.json(lowStock);
});

// ─── Stock In (with weight) ───

router.post('/stock-in', (req: Request, res: Response) => {
  const err = validate(req.body, ['product_id', 'quantity']);
  if (err) return res.status(400).json({ error: err });
  const id = uuidv4(); const now = new Date().toISOString();
  const count = (db.prepare("SELECT COUNT(*) as c FROM inventory_transactions").get() as any).c + 1;
  const txnNumber = `SI-${now.slice(2,4)}-${String(count).padStart(5, '0')}`;
  const qty = Math.abs(req.body.quantity);
  const weight = txnWeight(req.body.product_id, qty);
  const beforeQuantity = currentStock(req.body.product_id);
  db.transaction(() => {
    db.prepare(`INSERT INTO inventory_transactions (id, transaction_number, transaction_type,
    product_id, warehouse_id, quantity, unit, total_weight_kg, reference_type, reference_id,
    notes, operator, created_by, transaction_date, created_at, updated_at)
    VALUES (?, ?, 'stock_in', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, txnNumber, req.body.product_id, req.body.warehouse_id || null,
      qty, req.body.unit || 'pc', weight,
      req.body.reference_type || null, req.body.reference_id || null,
      req.body.notes || null, req.user!.name, req.user!.id,
      req.body.transaction_date || now.slice(0, 10), now, now);
    writeAudit(req, 'inventory_transaction', id, 'stock_in', {
      product_id: req.body.product_id, transaction_number: txnNumber,
      before_quantity: beforeQuantity, change_quantity: qty, after_quantity: beforeQuantity + qty,
    });
  })();
  res.status(201).json(db.prepare("SELECT * FROM inventory_transactions WHERE id = ?").get(id));
});

// ─── Stock Out (with weight + inventory check) ───

router.post('/stock-out', (req: Request, res: Response) => {
  const err = validate(req.body, ['product_id', 'quantity']);
  if (err) return res.status(400).json({ error: err });
  const product = db.prepare("SELECT id, name, sku FROM products WHERE id = ? AND deleted_at IS NULL").get(req.body.product_id) as any;
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const beforeQuantity = currentStock(req.body.product_id);
  const requestedQty = Math.abs(req.body.quantity);
  if (beforeQuantity < requestedQty) {
    return res.status(400).json({ error: 'Insufficient inventory', product_sku: product.sku, product_name: product.name, currentStock: beforeQuantity, requestedQuantity: requestedQty });
  }
  const id = uuidv4(); const now = new Date().toISOString();
  const count = (db.prepare("SELECT COUNT(*) as c FROM inventory_transactions").get() as any).c + 1;
  const txnNumber = `SO-${now.slice(2,4)}-${String(count).padStart(5, '0')}`;
  const weight = txnWeight(req.body.product_id, requestedQty);
  db.transaction(() => {
    db.prepare(`INSERT INTO inventory_transactions (id, transaction_number, transaction_type,
    product_id, warehouse_id, quantity, unit, total_weight_kg, reference_type, reference_id,
    notes, operator, created_by, transaction_date, created_at, updated_at)
    VALUES (?, ?, 'stock_out', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, txnNumber, req.body.product_id, req.body.warehouse_id || null,
      -requestedQty, req.body.unit || 'pc', -weight,
      req.body.reference_type || null, req.body.reference_id || null,
      req.body.notes || null, req.user!.name, req.user!.id,
      req.body.transaction_date || now.slice(0, 10), now, now);
    writeAudit(req, 'inventory_transaction', id, 'stock_out', {
      product_id: req.body.product_id, transaction_number: txnNumber,
      before_quantity: beforeQuantity, change_quantity: -requestedQty, after_quantity: beforeQuantity - requestedQty,
    });
  })();
  res.status(201).json(db.prepare("SELECT * FROM inventory_transactions WHERE id = ?").get(id));
});

// ─── Stock Adjustment (with weight) ───

router.post('/adjustment', (req: Request, res: Response) => {
  const err = validate(req.body, ['product_id', 'quantity']);
  if (err) return res.status(400).json({ error: err });
  const id = uuidv4(); const now = new Date().toISOString();
  const count = (db.prepare("SELECT COUNT(*) as c FROM inventory_transactions").get() as any).c + 1;
  const txnNumber = `ADJ-${now.slice(2,4)}-${String(count).padStart(5, '0')}`;
  const quantity = Number(req.body.quantity);
  const weight = Math.sign(quantity) * txnWeight(req.body.product_id, quantity);
  const beforeQuantity = currentStock(req.body.product_id);
  db.transaction(() => {
    db.prepare(`INSERT INTO inventory_transactions (id, transaction_number, transaction_type,
    product_id, warehouse_id, quantity, unit, total_weight_kg, notes, operator, created_by, transaction_date, created_at, updated_at)
    VALUES (?, ?, 'adjustment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, txnNumber, req.body.product_id, req.body.warehouse_id || null,
      quantity, req.body.unit || 'pc', weight,
      req.body.notes || null, req.user!.name, req.user!.id,
      req.body.transaction_date || now.slice(0, 10), now, now);
    writeAudit(req, 'inventory_transaction', id, 'adjustment', {
      product_id: req.body.product_id, transaction_number: txnNumber,
      before_quantity: beforeQuantity, change_quantity: quantity, after_quantity: beforeQuantity + quantity,
    });
  })();
  res.status(201).json(db.prepare("SELECT * FROM inventory_transactions WHERE id = ?").get(id));
});

// ─── Inventory V2 (fully isolated from CRM sales records) ───

router.get('/v2/stock', (req: Request, res: Response) => {
  res.json(inventoryV2.listStock(String(req.query.shape || ''), String(req.query.q || '')));
});

router.get('/v2/weight-review', (_req: Request, res: Response) => {
  res.json(inventoryV2.listWeightReview());
});

router.get('/v2/ledger', (req: Request, res: Response) => {
  res.json(inventoryV2.listMovements(
    req.query.item_id ? String(req.query.item_id) : undefined,
    Number(req.query.limit || 200),
  ));
});

router.get('/v2/export.xlsx', (req: Request, res: Response) => {
  const shape = req.query.shape === 'sheet' || req.query.shape === 'rod' ? req.query.shape : null;
  const q = String(req.query.q || '');
  const exported = exportInventoryWorkbook(
    shape === 'rod' ? [] : inventoryV2.listStock('sheet', q),
    shape === 'sheet' ? [] : inventoryV2.listStock('rod', q),
    new Date(),
    shape ? [shape] : undefined,
  );
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${exported.filename}"`,
    'Content-Length': String(exported.buffer.length),
  });
  res.send(exported.buffer);
});

router.post('/v2/items', (req: Request, res: Response) => {
  const nullableNumber = (value: unknown): number | null => (
    value === undefined || value === null || value === '' ? null : Number(value)
  );
  try {
    const result = inventoryV2.createItem({
      inventorySkuId: req.body.inventory_sku_id || null,
      sku: req.body.sku,
      name: req.body.name,
      materialName: req.body.material_name,
      densityKgM3: nullableNumber(req.body.density_kg_m3),
      shape: req.body.shape,
      standardLengthMm: nullableNumber(req.body.standard_length_mm),
      standardWidthMm: nullableNumber(req.body.standard_width_mm),
      standardThicknessMm: nullableNumber(req.body.standard_thickness_mm),
      standardDiameterMm: nullableNumber(req.body.standard_diameter_mm),
      standardOuterDiameterMm: nullableNumber(req.body.standard_outer_diameter_mm),
      standardInnerDiameterMm: nullableNumber(req.body.standard_inner_diameter_mm),
      inventoryType: req.body.inventory_type,
      lengthMm: nullableNumber(req.body.length_mm),
      widthMm: nullableNumber(req.body.width_mm),
      thicknessMm: nullableNumber(req.body.thickness_mm),
      diameterMm: nullableNumber(req.body.diameter_mm),
      outerDiameterMm: nullableNumber(req.body.outer_diameter_mm),
      innerDiameterMm: nullableNumber(req.body.inner_diameter_mm),
      quantity: Number(req.body.quantity),
      actualWeightKg: nullableNumber(req.body.actual_weight_kg),
      notes: req.body.notes,
      occurredAt: req.body.occurred_at,
      userId: req.user!.id,
      userName: req.user!.name,
    });
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Inventory specification creation failed';
    res.status(message.includes('not found') ? 404 : 400).json({ error: message });
  }
});

router.post('/v2/items/:id/measurements', (req: Request, res: Response) => {
  const nullableNumber = (value: unknown): number | null => (
    value === undefined || value === null || value === '' ? null : Number(value)
  );
  try {
    const measurement = inventoryV2.recordMeasurement({
      inventoryItemId: req.params.id,
      measuredThicknessMm: nullableNumber(req.body.measured_thickness_mm),
      actualUnitWeightMinKg: nullableNumber(req.body.actual_unit_weight_min_kg),
      actualUnitWeightMaxKg: nullableNumber(req.body.actual_unit_weight_max_kg),
      actualUnitWeightAvgKg: nullableNumber(req.body.actual_unit_weight_avg_kg),
      sampleCount: req.body.sample_count === undefined ? 1 : Number(req.body.sample_count),
      measuredAt: req.body.measured_at,
      notes: req.body.notes,
      userId: req.user!.id,
    });
    res.status(201).json(measurement);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Inventory measurement failed';
    res.status(message.includes('not found') ? 404 : 400).json({ error: message });
  }
});

router.post('/v2/movements', (req: Request, res: Response) => {
  const movementType = String(req.body.movement_type || '').toUpperCase() as InventoryMovementType;
  if (!['INBOUND', 'OUTBOUND', 'ADJUSTMENT'].includes(movementType)) {
    return res.status(400).json({ error: 'Unsupported inventory movement type' });
  }
  try {
    const movement = inventoryV2.recordMovement({
      inventoryItemId: req.body.inventory_item_id,
      movementType,
      quantity: Number(req.body.quantity),
      notes: req.body.notes,
      occurredAt: req.body.occurred_at,
      userId: req.user!.id,
      userName: req.user!.name,
    });
    res.status(201).json(movement);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Inventory movement failed';
    res.status(message.includes('not found') ? 404 : 400).json({ error: message });
  }
});

router.post('/v2/cuts', (req: Request, res: Response) => {
  try {
    const result = inventoryV2.cut({
      sourceItemId: req.body.source_item_id,
      quantity: Number(req.body.quantity || 1),
      lengthMm: req.body.length_mm === undefined ? undefined : Number(req.body.length_mm),
      widthMm: req.body.width_mm === undefined ? undefined : Number(req.body.width_mm),
      thicknessMm: req.body.thickness_mm === undefined ? undefined : Number(req.body.thickness_mm),
      diameterMm: req.body.diameter_mm === undefined ? undefined : Number(req.body.diameter_mm),
      outerDiameterMm: req.body.outer_diameter_mm === undefined ? undefined : Number(req.body.outer_diameter_mm),
      innerDiameterMm: req.body.inner_diameter_mm === undefined ? undefined : Number(req.body.inner_diameter_mm),
      actualWeightKg: req.body.actual_weight_kg === undefined ? undefined : Number(req.body.actual_weight_kg),
      notes: req.body.notes,
      occurredAt: req.body.occurred_at,
      userId: req.user!.id,
      userName: req.user!.name,
    });
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cutting failed';
    res.status(message.includes('not found') ? 404 : 400).json({ error: message });
  }
});

router.get('/v2/rules', (_req: Request, res: Response) => {
  res.json(inventoryV2.listRules());
});

router.put('/v2/rules/:id', (req: Request, res: Response) => {
  try {
    res.json(inventoryV2.updateRule(req.params.id, req.body));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Rule update failed';
    res.status(message.includes('not found') ? 404 : 400).json({ error: message });
  }
});

router.post('/v2/import/preview', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const rows = parseInventoryUpload(req.file);
    if (rows.length === 0) return res.status(400).json({ error: 'File is empty' });
    res.json(inventoryV2.buildImportPreview(
      rows,
      req.body.mode || 'incremental',
      req.body.scope || 'all',
    ));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import preview failed';
    res.status(400).json({ error: message });
  }
});

router.post('/v2/import/confirm', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const result = inventoryV2.confirmImport(
      parseInventoryUpload(req.file),
      req.body.mode || 'incremental',
      req.body.scope || 'all',
      String(req.body.preview_hash || ''),
      { userId: req.user!.id, userName: req.user!.name },
    );
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import confirmation failed';
    res.status(message.includes('changed after preview') ? 409 : 400).json({ error: message });
  }
});

router.post('/import', upload.single('file'), (_req: Request, res: Response) => {
  res.status(409).json({
    error: 'Direct inventory import is disabled. Preview with /v2/import/preview, then confirm with /v2/import/confirm.',
  });
});


export default router;
