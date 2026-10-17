import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { validate } from '../validate.js';
import { nextOrderNumber } from '../numbers.js';
import { computeChanges, writeAudit } from '../audit.js';

const router = Router();

const ORDER_UPDATE_FIELDS = [
  'customer_po_number',
  'order_number',
  'company_id',
  'contact_id',
  'quotation_id',
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
  'owner_user_id',
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

function validateOrderContact(companyId: string, contactId: unknown): string | null {
  if (contactId === undefined || contactId === null) return null;
  if (typeof contactId !== 'string') return 'Selected contact does not belong to the company';
  const contact = db.prepare('SELECT id FROM contacts WHERE id = ? AND company_id = ? AND deleted_at IS NULL')
    .get(contactId, companyId);
  return contact ? null : 'Selected contact does not belong to the company';
}

router.get('/', (req: Request, res: Response) => {
  const q = req.query.q as string | undefined;
  let sql = `
    SELECT o.*, c.name as company_name, owner.name as owner_name,
      creator.name as created_by_name, updater.name as updated_by_name FROM orders o
    LEFT JOIN companies c ON o.company_id = c.id
    LEFT JOIN users owner ON owner.id = o.owner_user_id
    LEFT JOIN users creator ON creator.id = o.created_by
    LEFT JOIN users updater ON updater.id = o.updated_by
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
    SELECT o.*, c.name as company_name, owner.name as owner_name,
      creator.name as created_by_name, updater.name as updated_by_name FROM orders o
    LEFT JOIN companies c ON o.company_id = c.id
    LEFT JOIN users owner ON owner.id = o.owner_user_id
    LEFT JOIN users creator ON creator.id = o.created_by
    LEFT JOIN users updater ON updater.id = o.updated_by
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
  const company = db.prepare("SELECT id, customer_code, owner_user_id FROM companies WHERE id = ? AND deleted_at IS NULL").get(req.body.company_id) as any;
  if (!company) return res.status(400).json({ success: false, message: 'Selected company does not exist' });
  if (!company.customer_code) return res.status(400).json({ success: false, message: 'Company must have a customer_code before creating an order' });
  const quotation = db.prepare("SELECT id, company_id, owner_user_id FROM quotations WHERE id = ? AND deleted_at IS NULL").get(req.body.quotation_id) as any;
  if (!quotation) return res.status(400).json({ success: false, message: 'Selected quotation does not exist' });
  if (quotation.company_id !== req.body.company_id) {
    return res.status(400).json({ success: false, message: 'Selected quotation does not belong to the company' });
  }
  const contactError = validateOrderContact(req.body.company_id, req.body.contact_id);
  if (contactError) return res.status(400).json({ success: false, message: contactError });

  const id = uuidv4();
  const now = new Date().toISOString();
  const orderDate = req.body.order_date || now.slice(0, 10);
  const order_number = nextOrderNumber(company.customer_code, orderDate);
  const ownerUserId = req.body.owner_user_id || quotation.owner_user_id || company.owner_user_id || req.user!.id;
  const ownerName = (db.prepare("SELECT name FROM users WHERE id = ?").get(ownerUserId) as { name: string } | undefined)?.name || req.user!.name;

  const { incoterm, payment_term, tax_type, domestic_vat_rate, export_tax_rebate_rate, shipping_handling, discount_percent, discount_amount, tax_amount, line_items } = req.body;

  const createdOrder = db.transaction(() => {
    db.prepare(`
      INSERT INTO orders (id, order_number, company_id, contact_id, quotation_id,
        currency, incoterm, payment_term, subtotal, discount_percent, discount_amount,
        tax_type, domestic_vat_rate, export_tax_rebate_rate, tax_amount, shipping_handling,
        total, status, order_date, owner_user_id, assigned_to, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, order_number, req.body.company_id, req.body.contact_id,
      req.body.quotation_id, req.body.currency || 'USD',
      incoterm || null, payment_term || null,
      req.body.subtotal || 0, discount_percent || 0, discount_amount || 0,
      tax_type || null, domestic_vat_rate || 0, export_tax_rebate_rate || 0,
      tax_amount || 0, shipping_handling || 0,
      req.body.total || 0, 'draft', orderDate, ownerUserId, ownerName,
      req.user!.id, req.user!.id, now, now);

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
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Record<string, unknown>;
    writeAudit(req, 'order', id, 'create', {
      ...computeChanges(null, order), line_item_count: line_items?.length || 0,
    });
    const orderLineItems = db.prepare("SELECT * FROM order_line_items WHERE order_id = ? ORDER BY line_number").all(id);
    return { ...order as any, line_items: orderLineItems };
  })();

  res.status(201).json(createdOrder);
});

router.put('/:id', (req: Request, res: Response) => {
  const now = new Date().toISOString();
  const before = db.prepare("SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL").get(req.params.id) as Record<string, unknown> | undefined;
  if (!before) return res.status(404).json({ success: false, message: 'Record not found' });

  if (Object.prototype.hasOwnProperty.call(req.body, 'owner_user_id')) {
    const requestedOwnerId = req.body.owner_user_id || null;
    const currentOwnerId = before.owner_user_id || null;
    if (requestedOwnerId !== currentOwnerId && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only an administrator can transfer an order owner' });
    }
    if (requestedOwnerId) {
      const owner = db.prepare('SELECT id FROM users WHERE id = ? AND is_active = 1').get(requestedOwnerId);
      if (!owner) return res.status(400).json({ error: 'Selected owner is not an active team member' });
    }
    req.body.owner_user_id = requestedOwnerId;
  }

  const referenceFields = ['company_id', 'quotation_id', 'contact_id'] as const;
  const referencesChanged = referenceFields.some(field =>
    Object.prototype.hasOwnProperty.call(req.body, field) && req.body[field] !== before[field],
  );
  if (referencesChanged) {
    const companyId = Object.prototype.hasOwnProperty.call(req.body, 'company_id') ? req.body.company_id : before.company_id;
    const quotationId = Object.prototype.hasOwnProperty.call(req.body, 'quotation_id') ? req.body.quotation_id : before.quotation_id;
    const contactId = Object.prototype.hasOwnProperty.call(req.body, 'contact_id') ? req.body.contact_id : before.contact_id;
    const company = typeof companyId === 'string'
      ? db.prepare('SELECT id FROM companies WHERE id = ? AND deleted_at IS NULL').get(companyId) : undefined;
    if (!company) return res.status(400).json({ success: false, message: 'Selected company does not exist' });
    const quotation = typeof quotationId === 'string'
      ? db.prepare('SELECT company_id FROM quotations WHERE id = ? AND deleted_at IS NULL').get(quotationId) as { company_id: string } | undefined : undefined;
    if (!quotation) return res.status(400).json({ success: false, message: 'Selected quotation does not exist' });
    if (quotation.company_id !== companyId) {
      return res.status(400).json({ success: false, message: 'Selected quotation does not belong to the company' });
    }
    const contactError = validateOrderContact(companyId, contactId);
    if (contactError) return res.status(400).json({ success: false, message: contactError });
  }

  const updateFields = ORDER_UPDATE_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(req.body, field));
  if (updateFields.length === 0 && !req.body.line_items) {
    return res.status(400).json({ success: false, message: 'No valid fields to update' });
  }

  const updatedOrder = db.transaction(() => {
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

    if (updateFields.length > 0) {
      const fields = updateFields.map((field) => `${field} = ?`).join(', ');
      const values = updateFields.map((field) => req.body[field]);
      db.prepare(`UPDATE orders SET ${fields}, updated_by = ?, updated_at = ? WHERE id = ?`).run(...values, req.user!.id, now, req.params.id);
    }
    const after = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id) as Record<string, unknown>;
    writeAudit(req, 'order', req.params.id, 'update', {
      ...computeChanges(before, after),
      line_items_replaced: Boolean(req.body.line_items),
      line_item_count: req.body.line_items?.length,
    });
    return after;
  })();
  res.json(updatedOrder);
});

router.delete('/:id', (req: Request, res: Response) => {
  const order = db.prepare("SELECT order_number FROM orders WHERE id = ? AND deleted_at IS NULL").get(req.params.id) as { order_number: string } | undefined;
  if (!order) return res.status(404).json({ error: 'Not found' });
  db.transaction(() => {
    db.prepare("UPDATE orders SET deleted_at = ?, updated_by = ? WHERE id = ?").run(new Date().toISOString(), req.user!.id, req.params.id);
    writeAudit(req, 'order', req.params.id, 'delete', { order_number: order.order_number });
  })();
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
  const before = db.prepare(`
    SELECT item.* FROM order_line_items item
    JOIN orders parent ON parent.id = item.order_id
    WHERE item.id = ? AND parent.deleted_at IS NULL
  `).get(req.params.id) as Record<string, unknown> | undefined;
  if (!before) return res.status(404).json({ success: false, message: 'Record not found' });
  const updatedItem = db.transaction(() => {
    const fields = updateFields.map((field) => `${field} = ?`).join(', ');
    const values = updateFields.map((field) => req.body[field]);
    db.prepare(`UPDATE order_line_items SET ${fields} WHERE id = ?`).run(...values, req.params.id);
    const after = db.prepare("SELECT * FROM order_line_items WHERE id = ?").get(req.params.id) as Record<string, unknown>;
    writeAudit(req, 'order_line_item', req.params.id, 'update', {
      order_id: before.order_id,
      before: Object.fromEntries(updateFields.map((field) => [field, before[field]])),
      after: Object.fromEntries(updateFields.map((field) => [field, after[field]])),
    });
    return after;
  })();
  res.json(updatedItem);
});

export default router;
