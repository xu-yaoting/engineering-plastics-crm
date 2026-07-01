import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import XLSX from 'xlsx';
import db from '../db.js';
import { validate } from '../validate.js';
import { updateProductWeight, getMaterialDensity } from '../weight.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const router = Router();

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
  db.prepare(`
    INSERT INTO products (id, sku, name, category, product_type, stock_tracking_mode,
      length_mm, width_mm, thickness_mm, diameter_mm, outer_diameter_mm, inner_diameter_mm,
      unit_weight_kg, material_id, unit, safety_stock_qty, safety_stock_weight_kg, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.body.sku, req.body.name, req.body.category || null,
    req.body.product_type || 'part', req.body.stock_tracking_mode || 'piece',
    req.body.length_mm || null, req.body.width_mm || null, req.body.thickness_mm || null,
    req.body.diameter_mm || null, req.body.outer_diameter_mm || null, req.body.inner_diameter_mm || null,
    req.body.unit_weight_kg || 0, req.body.material_id || null, req.body.unit || 'pc',
    req.body.safety_stock_qty || 0, req.body.safety_stock_weight_kg || 0, now, now);
  // Auto-calculate weight
  updateProductWeight(id);
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
  const result = db.prepare(`UPDATE products SET ${fields}, updated_at = ? WHERE id = ? AND deleted_at IS NULL`)
    .run(...values, now, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  // Recalculate weight if dimensions or material changed
  const dimFields = ['product_type', 'length_mm', 'width_mm', 'thickness_mm', 'diameter_mm', 'outer_diameter_mm', 'inner_diameter_mm', 'material_id', 'unit_weight_kg'];
  if (dimFields.some(f => f in req.body)) updateProductWeight(req.params.id);
  res.json(db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id));
});

router.delete('/products/:id', (req: Request, res: Response) => {
  const now = new Date().toISOString();
  const result = db.prepare("UPDATE products SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL")
    .run(now, now, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
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
  db.prepare(`INSERT INTO inventory_transactions (id, transaction_number, transaction_type,
    product_id, warehouse_id, quantity, unit, total_weight_kg, reference_type, reference_id,
    notes, operator, transaction_date, created_at, updated_at)
    VALUES (?, ?, 'stock_in', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, txnNumber, req.body.product_id, req.body.warehouse_id || null,
      qty, req.body.unit || 'pc', weight,
      req.body.reference_type || null, req.body.reference_id || null,
      req.body.notes || null, req.body.operator || null,
      req.body.transaction_date || now.slice(0, 10), now, now);
  res.status(201).json(db.prepare("SELECT * FROM inventory_transactions WHERE id = ?").get(id));
});

// ─── Stock Out (with weight + inventory check) ───

router.post('/stock-out', (req: Request, res: Response) => {
  const err = validate(req.body, ['product_id', 'quantity']);
  if (err) return res.status(400).json({ error: err });
  const product = db.prepare("SELECT id, name, sku FROM products WHERE id = ? AND deleted_at IS NULL").get(req.body.product_id) as any;
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const stockRow = db.prepare("SELECT COALESCE(SUM(quantity), 0) as current FROM inventory_transactions WHERE product_id = ?").get(req.body.product_id) as any;
  const currentStock = stockRow?.current || 0;
  const requestedQty = Math.abs(req.body.quantity);
  if (currentStock < requestedQty) {
    return res.status(400).json({ error: 'Insufficient inventory', product_sku: product.sku, product_name: product.name, currentStock, requestedQuantity: requestedQty });
  }
  const id = uuidv4(); const now = new Date().toISOString();
  const count = (db.prepare("SELECT COUNT(*) as c FROM inventory_transactions").get() as any).c + 1;
  const txnNumber = `SO-${now.slice(2,4)}-${String(count).padStart(5, '0')}`;
  const weight = txnWeight(req.body.product_id, requestedQty);
  db.prepare(`INSERT INTO inventory_transactions (id, transaction_number, transaction_type,
    product_id, warehouse_id, quantity, unit, total_weight_kg, reference_type, reference_id,
    notes, operator, transaction_date, created_at, updated_at)
    VALUES (?, ?, 'stock_out', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, txnNumber, req.body.product_id, req.body.warehouse_id || null,
      -requestedQty, req.body.unit || 'pc', -weight,
      req.body.reference_type || null, req.body.reference_id || null,
      req.body.notes || null, req.body.operator || null,
      req.body.transaction_date || now.slice(0, 10), now, now);
  res.status(201).json(db.prepare("SELECT * FROM inventory_transactions WHERE id = ?").get(id));
});

// ─── Stock Adjustment (with weight) ───

router.post('/adjustment', (req: Request, res: Response) => {
  const err = validate(req.body, ['product_id', 'quantity']);
  if (err) return res.status(400).json({ error: err });
  const id = uuidv4(); const now = new Date().toISOString();
  const count = (db.prepare("SELECT COUNT(*) as c FROM inventory_transactions").get() as any).c + 1;
  const txnNumber = `ADJ-${now.slice(2,4)}-${String(count).padStart(5, '0')}`;
  const weight = txnWeight(req.body.product_id, req.body.quantity);
  db.prepare(`INSERT INTO inventory_transactions (id, transaction_number, transaction_type,
    product_id, warehouse_id, quantity, unit, total_weight_kg, notes, operator, transaction_date, created_at, updated_at)
    VALUES (?, ?, 'adjustment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, txnNumber, req.body.product_id, req.body.warehouse_id || null,
      req.body.quantity, req.body.unit || 'pc', weight,
      req.body.notes || null, req.body.operator || null,
      req.body.transaction_date || now.slice(0, 10), now, now);
  res.status(201).json(db.prepare("SELECT * FROM inventory_transactions WHERE id = ?").get(id));
});

// ─── Import (CSV / XLSX) ───

router.post('/import', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const importType = (req.body.type || 'stock-initial').trim();
    const operator = req.body.operator || 'Import';
    let rows: Record<string, any>[] = [];
    const ext = req.file.originalname.toLowerCase();
    if (ext.endsWith('.csv')) {
      const text = req.file.buffer.toString('utf-8');
      const lines = text.split('\n').filter(Boolean);
      const headers = lines[0].split(',').map(h => h.trim());
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim());
        const row: Record<string, any> = {};
        headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
        rows.push(row);
      }
    } else {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws);
    }
    if (rows.length === 0) return res.status(400).json({ error: 'File is empty' });
    const now = new Date().toISOString();
    const results: any[] = []; let created = 0, skipped = 0, errors: string[] = [];

    if (importType === 'products') {
      for (const row of rows) {
        const sku = (row.SKU || row.sku || '').toString().trim();
        const name = (row.Name || row.name || row.Product || '').toString().trim();
        if (!sku || !name) { errors.push('Row skipped: missing SKU or Name'); skipped++; continue; }
        if (db.prepare("SELECT id FROM products WHERE sku = ? AND deleted_at IS NULL").get(sku)) { skipped++; continue; }
        const id = uuidv4();
        const productType = (row.Type || row.product_type || 'part').toString().trim().toLowerCase();
        db.prepare(`INSERT INTO products (id, sku, name, category, product_type, unit, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(id, sku, name, (row.Category || row.category || '').toString() || null,
            productType, (row.Unit || row.unit || 'pc').toString(), now, now);
        if (row.material_id || row.MaterialID) {
          db.prepare("UPDATE products SET material_id = ? WHERE id = ?").run(row.material_id || row.MaterialID, id);
        }
        updateProductWeight(id);
        created++; results.push({ sku, name, action: 'created' });
      }
    } else {
      for (const row of rows) {
        const sku = (row.SKU || row.sku || '').toString().trim();
        if (!sku) { errors.push('Row skipped: missing SKU'); skipped++; continue; }
        const product = db.prepare("SELECT id, name FROM products WHERE sku = ? AND deleted_at IS NULL").get(sku) as any;
        if (!product) { errors.push(`SKU "${sku}" not found`); skipped++; continue; }
        const remark = (row.Remark || row.remark || row.Notes || row.notes || '').toString().trim();

        if (importType === 'stock-count') {
          const stockRow = db.prepare("SELECT COALESCE(SUM(quantity), 0) as current FROM inventory_transactions WHERE product_id = ?").get(product.id) as any;
          const systemQty = stockRow?.current || 0;
          const actualQty = parseFloat(row.ActualQty || row.actualQty || row.Actual || row.actual || row.Quantity || row.quantity || 0) || 0;
          const diff = actualQty - systemQty;
          if (diff === 0) { skipped++; continue; }
          const id = uuidv4(); const c = (db.prepare("SELECT COUNT(*) as c FROM inventory_transactions").get() as any).c + 1;
          const weight = txnWeight(product.id, diff);
          db.prepare(`INSERT INTO inventory_transactions (id, transaction_number, transaction_type,
            product_id, quantity, unit, total_weight_kg, notes, operator, transaction_date, created_at, updated_at)
            VALUES (?, ?, 'adjustment', ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(id, `ADJ-${now.slice(2,4)}-${String(c).padStart(5, '0')}`, product.id, diff, row.Unit || 'pc', weight,
              `Stock count: sys=${systemQty} act=${actualQty}${remark ? ' — ' + remark : ''}`, operator, now.slice(0, 10), now, now);
          created++; results.push({ sku, name: product.name, action: 'adjustment', diff: `${systemQty}→${actualQty}` });
        } else {
          const qty = parseFloat(row.Quantity || row.quantity || row.Qty || row.qty || 0) || 0;
          if (qty <= 0) { skipped++; continue; }
          const id = uuidv4(); const c = (db.prepare("SELECT COUNT(*) as c FROM inventory_transactions").get() as any).c + 1;
          const weight = txnWeight(product.id, qty);
          db.prepare(`INSERT INTO inventory_transactions (id, transaction_number, transaction_type,
            product_id, quantity, unit, total_weight_kg, notes, operator, transaction_date, created_at, updated_at)
            VALUES (?, ?, 'stock_in', ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(id, `SI-${now.slice(2,4)}-${String(c).padStart(5, '0')}`, product.id, qty, row.Unit || 'pc', weight,
              remark || (importType === 'stock-initial' ? 'Opening balance' : 'Bulk import'), operator, now.slice(0, 10), now, now);
          created++; results.push({ sku, name: product.name, qty, action: 'stock_in' });
        }
      }
    }
    res.json({ success: true, importType, total: rows.length, created, skipped, errors: errors.slice(0, 20), results });
  } catch (e: any) { console.error('Import failed', e); res.status(500).json({ error: 'Import failed', detail: e.message }); }
});

export default router;
