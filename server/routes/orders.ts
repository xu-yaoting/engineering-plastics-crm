import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { validate } from '../validate.js';
import { nextOrderNumber } from '../numbers.js';

const router = Router();

const ORDER_UPDATE_FIELDS = [
  'customer_po_number',
  'order_number',
  'company_id',
  'contact_id',
  'quotation_id',
  'inquiry_id',
  'project_id',
  'previous_order_id',
  'assigned_to',
  'order_date',
  'requested_delivery_date',
  'confirmed_delivery_date',
  'incoterm',
  'currency',
  'exchange_rate',
  'payment_term',
  'payment_status',
  'subtotal',
  'discount_percent',
  'discount_amount',
  'tax_type',
  'domestic_vat_rate',
  'export_tax_rebate_rate',
  'tax_amount',
  'shipping_handling',
  'total',
  'status',
  'shipping_address',
  'shipping_instructions',
  'internal_notes',
  'custom_fields',
] as const;

const ORDER_LINE_ITEM_UPDATE_FIELDS = [
  'line_number',
  'product_id',
  'product_grade_snapshot',
  'form',
  'description',
  'unit_of_measure',
  'quantity_ordered',
  'quantity_shipped',
  'quantity_delivered',
  'unit_price',
  'discount_percent',
  'line_total',
  'batch_lot_number',
  'status',
  'notes',
] as const;

router.get('/', (req: Request, res: Response) => {
  const q = req.query.q as string | undefined;
  let sql = `
    SELECT o.*, c.name as company_name FROM orders o
    LEFT JOIN companies c ON o.company_id = c.id
    WHERE o.deleted_at IS NULL`;
  const params: string[] = [];
  if (q) {
    sql += " AND (o.order_number LIKE ? OR c.name LIKE ? OR o.customer_po_number LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  sql += " ORDER BY o.created_at DESC";
  const orders = db.prepare(sql).all(...params);
  res.json(orders);
});

router.get('/:id', (req: Request, res: Response) => {
  const order = db.prepare(`
    SELECT o.*, c.name as company_name FROM orders o
    LEFT JOIN companies c ON o.company_id = c.id
    WHERE o.id = ? AND o.deleted_at IS NULL
  `).get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  const line_items = db.prepare(
    "SELECT * FROM order_line_items WHERE order_id = ? ORDER BY line_number"
  ).all(req.params.id);
  res.json({ ...order as any, line_items });
});

router.post('/', (req: Request, res: Response) => {
  const err = validate(req.body, ['company_id', 'quotation_id']);
  if (err) return res.status(400).json({ success: false, message: err });

  // Verify FK references + customer_code
  const co = db.prepare("SELECT id, customer_code FROM companies WHERE id = ? AND deleted_at IS NULL").get(req.body.company_id) as any;
  if (!co) return res.status(400).json({ success: false, message: 'Selected company does not exist' });
  if (!co.customer_code) return res.status(400).json({ success: false, message: 'Company must have a customer_code before creating an order' });
  const qt = db.prepare("SELECT id FROM quotations WHERE id = ? AND deleted_at IS NULL").get(req.body.quotation_id);
  if (!qt) return res.status(400).json({ success: false, message: 'Selected quotation does not exist' });

  const id = uuidv4();
  const now = new Date().toISOString();
  const orderDate = req.body.order_date || now.slice(0, 10);
  const order_number = nextOrderNumber(co.customer_code, orderDate);

  const { incoterm, payment_term, tax_type, domestic_vat_rate, export_tax_rebate_rate, shipping_handling, discount_percent, discount_amount, tax_amount, line_items } = req.body;

  db.prepare(`
    INSERT INTO orders (id, order_number, company_id, contact_id, quotation_id,
      currency, incoterm, payment_term, subtotal, discount_percent, discount_amount,
      tax_type, domestic_vat_rate, export_tax_rebate_rate, tax_amount, shipping_handling,
      total, status, order_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, order_number, req.body.company_id, req.body.contact_id,
    req.body.quotation_id, req.body.currency || 'USD',
    incoterm || null, payment_term || null,
    req.body.subtotal || 0, discount_percent || 0, discount_amount || 0,
    tax_type || null, domestic_vat_rate || 0, export_tax_rebate_rate || 0,
    tax_amount || 0, shipping_handling || 0,
    req.body.total || 0, 'draft', orderDate, now, now);

  // Copy line items from quotation into order
  if (line_items && line_items.length > 0) {
    const liStmt = db.prepare(`
      INSERT INTO order_line_items (id, order_id, line_number, product_grade_snapshot,
        unit_of_measure, quantity_ordered, unit_price, discount_percent, line_total, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of line_items) {
      liStmt.run(uuidv4(), id, item.line_number, item.product_grade_snapshot,
        item.unit_of_measure, item.quantity, item.unit_price, item.discount_percent || 0,
        item.line_total, item.description || null, now);
    }
  }

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  const orderLineItems = db.prepare(
    "SELECT * FROM order_line_items WHERE order_id = ? ORDER BY line_number"
  ).all(id);

  res.status(201).json({ ...order as any, line_items: orderLineItems });
});

router.put('/:id', (req: Request, res: Response) => {
  const now = new Date().toISOString();

  // Handle line_items: delete old ones and insert new ones
  if (req.body.line_items) {
    const items = req.body.line_items as any[];
    db.prepare("DELETE FROM order_line_items WHERE order_id = ?").run(req.params.id);
    const insert = db.prepare(`
      INSERT INTO order_line_items (id, order_id, line_number, product_grade_snapshot,
        unit_of_measure, quantity_ordered, unit_price, discount_percent, line_total, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const [idx, item] of items.entries()) {
      insert.run(uuidv4(), req.params.id, idx + 1, item.product_grade_snapshot,
        item.unit_of_measure, item.quantity || item.quantity_ordered, item.unit_price,
        item.discount_percent || 0, item.line_total, item.description || null, now);
    }
  }

  // Update order table fields (exclude line_items and non-editable fields)
  const updateFields = ORDER_UPDATE_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(req.body, field)
  );
  if (updateFields.length > 0) {
    const fields = updateFields.map((field) => `${field} = ?`).join(', ');
    const values = updateFields.map((field) => req.body[field]);
    const result = db.prepare(`UPDATE orders SET ${fields}, updated_at = ? WHERE id = ?`).run(...values, now, req.params.id);
    if (result.changes === 0) return res.status(404).json({ success: false, message: 'Record not found' });
  } else if (!req.body.line_items) {
    return res.status(400).json({ success: false, message: 'No valid fields to update' });
  }
  res.json(db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id));
});

router.delete('/:id', (req: Request, res: Response) => {
  db.prepare("UPDATE orders SET deleted_at = ? WHERE id = ?").run(new Date().toISOString(), req.params.id);
  res.status(204).send();
});

// Individual order line item updates (e.g. quantity_shipped)
router.put('/line-items/:id', (req: Request, res: Response) => {
  const updateFields = ORDER_LINE_ITEM_UPDATE_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(req.body, field)
  );
  if (updateFields.length === 0) {
    return res.status(400).json({ success: false, message: 'No valid fields to update' });
  }
  const fields = updateFields.map((field) => `${field} = ?`).join(', ');
  const values = updateFields.map((field) => req.body[field]);
  const result = db.prepare(`UPDATE order_line_items SET ${fields} WHERE id = ?`).run(...values, req.params.id);
  if (result.changes === 0) return res.status(404).json({ success: false, message: 'Record not found' });
  res.json(db.prepare("SELECT * FROM order_line_items WHERE id = ?").get(req.params.id));
});

export default router;
