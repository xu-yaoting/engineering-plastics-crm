import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { validate } from '../validate.js';
import { nextQuotationNumber } from '../numbers.js';
import { generateQuotationPDF } from '../pdf-quotation.js';

const router = Router();

const QUOTATION_UPDATE_FIELDS = [
  'company_id',
  'contact_id',
  'inquiry_id',
  'project_id',
  'assigned_to',
  'quotation_date',
  'valid_until',
  'incoterm',
  'currency',
  'exchange_rate',
  'payment_term',
  'delivery_term',
  'subtotal',
  'discount_percent',
  'discount_amount',
  'tax_type',
  'domestic_vat_rate',
  'export_tax_rebate_rate',
  'tax_amount',
  'shipping_handling',
  'total',
  'margin_estimate_percent',
  'cost_total_estimate',
  'status',
  'version',
  'parent_version_id',
  'approval_requested_at',
  'approval_requested_by',
  'approved_at',
  'approved_by',
  'sent_at',
  'customer_acknowledged_at',
  'accepted_at',
  'rejection_reason',
  'internal_notes',
  'terms_and_conditions',
  'custom_fields',
] as const;

router.get('/', (req: Request, res: Response) => {
  const { status, company_id } = req.query;
  const q = req.query.q as string | undefined;
  let query = `SELECT q.*, c.name as company_name FROM quotations q
    LEFT JOIN companies c ON q.company_id = c.id WHERE q.deleted_at IS NULL`;
  const params: string[] = [];
  if (status) { query += " AND q.status = ?"; params.push(status as string); }
  if (company_id) { query += " AND q.company_id = ?"; params.push(company_id as string); }
  if (q) {
    query += " AND (q.quotation_number LIKE ? OR c.name LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like);
  }
  query += " ORDER BY q.created_at DESC";
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req: Request, res: Response) => {
  const quotation = db.prepare(`
    SELECT q.*, c.name as company_name,
      ct.first_name || ' ' || ct.last_name as contact_name,
      (SELECT id FROM orders WHERE quotation_id = q.id AND deleted_at IS NULL LIMIT 1) as order_id
    FROM quotations q
    LEFT JOIN companies c ON q.company_id = c.id
    LEFT JOIN contacts ct ON q.contact_id = ct.id
    WHERE q.id = ? AND q.deleted_at IS NULL
  `).get(req.params.id);
  if (!quotation) return res.status(404).json({ error: 'Not found' });

  const line_items = db.prepare(
    "SELECT * FROM quotation_line_items WHERE quotation_id = ? ORDER BY line_number"
  ).all(req.params.id);

  res.json({ ...quotation as any, line_items });
});

router.post('/', (req: Request, res: Response) => {
  const err = validate(req.body, ['company_id', 'currency']);
  if (err) return res.status(400).json({ success: false, message: err });

  // Verify FK: company must exist
  const co = db.prepare("SELECT id FROM companies WHERE id = ? AND deleted_at IS NULL").get(req.body.company_id);
  if (!co) return res.status(400).json({ success: false, message: 'Selected company does not exist' });

  const id = uuidv4();
  const now = new Date().toISOString();
  const quotation_number = nextQuotationNumber();

  const quotation_date = req.body.quotation_date || new Date().toISOString().slice(0, 10);
  const valid_until = req.body.valid_until || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Auto-approval check: total > 100,000 USD → pending_approval
  const total = req.body.total || 0;
  const status = total > 100000 ? 'pending_approval' : 'draft';
  const now2 = new Date().toISOString();

  db.prepare(`
    INSERT INTO quotations (id, quotation_number, company_id, contact_id, inquiry_id,
      quotation_date, valid_until, currency, subtotal, total, status, version,
      approval_requested_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, quotation_number, req.body.company_id, req.body.contact_id,
    req.body.inquiry_id, quotation_date, valid_until, req.body.currency || 'USD',
    req.body.subtotal || 0, total, status, 1,
    total > 100000 ? now2 : null, now, now);

  if (req.body.line_items) {
    const insert = db.prepare(`
      INSERT INTO quotation_line_items (id, quotation_id, line_number, product_grade_snapshot,
        unit_of_measure, quantity, unit_price, line_total, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const [idx, item] of (req.body.line_items as any[]).entries()) {
      insert.run(uuidv4(), id, idx + 1, item.product_grade_snapshot,
        item.unit_of_measure, item.quantity, item.unit_price, item.line_total, item.description);
    }
  }

  res.status(201).json(db.prepare("SELECT * FROM quotations WHERE id = ?").get(id));
});

router.put('/:id', (req: Request, res: Response) => {
  const now = new Date().toISOString();

  // Handle line_items: delete old ones and insert new ones
  if (req.body.line_items) {
    const items = req.body.line_items as any[];
    db.prepare("DELETE FROM quotation_line_items WHERE quotation_id = ?").run(req.params.id);
    const insert = db.prepare(`
      INSERT INTO quotation_line_items (id, quotation_id, line_number, product_grade_snapshot,
        unit_of_measure, quantity, unit_price, discount_percent, line_total, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const [idx, item] of items.entries()) {
      insert.run(uuidv4(), req.params.id, idx + 1, item.product_grade_snapshot,
        item.unit_of_measure, item.quantity, item.unit_price, item.discount_percent || 0,
        item.line_total, item.description || null);
    }
  }

  // Update quotation table fields (exclude line_items and non-editable fields)
  const dataFields = { ...req.body };
  delete dataFields.line_items;

  // Auto-approval: if total > 100k and status is 'draft', escalate to pending_approval
  const total = req.body.total || 0;
  const current = db.prepare("SELECT status FROM quotations WHERE id = ?").get(req.params.id) as any;
  if (total > 100000 && current?.status === 'draft') {
    dataFields.status = 'pending_approval';
    dataFields.approval_requested_at = now;
  }

  const updateFields = QUOTATION_UPDATE_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(dataFields, field)
  );
  if (updateFields.length > 0) {
    const fields = updateFields.map((field) => `${field} = ?`).join(', ');
    const values = updateFields.map((field) => dataFields[field]);
    const result = db.prepare(`UPDATE quotations SET ${fields}, updated_at = ? WHERE id = ?`).run(...values, now, req.params.id);
    if (result.changes === 0) return res.status(404).json({ success: false, message: 'Record not found' });
  } else if (!req.body.line_items) {
    return res.status(400).json({ success: false, message: 'No valid fields to update' });
  } else {
    const existing = db.prepare("SELECT id FROM quotations WHERE id = ? AND deleted_at IS NULL").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Record not found' });
  }

  res.json(db.prepare("SELECT * FROM quotations WHERE id = ?").get(req.params.id));
});

router.delete('/:id', (req: Request, res: Response) => {
  db.prepare("UPDATE quotations SET deleted_at = ?, updated_at = ? WHERE id = ?")
    .run(new Date().toISOString(), new Date().toISOString(), req.params.id);
  res.status(204).send();
});

// Approve or reject a quotation that is pending_approval
router.post('/:id/approve', (req: Request, res: Response) => {
  const { action, approved_by } = req.body; // action: 'approve' | 'reject'
  const now = new Date().toISOString();

  const quote = db.prepare("SELECT id, status, total FROM quotations WHERE id = ? AND deleted_at IS NULL").get(req.params.id) as any;
  if (!quote) return res.status(404).json({ error: 'Not found' });
  if (quote.status !== 'pending_approval') return res.status(400).json({ error: 'Quotation is not pending approval' });

  if (action === 'approve') {
    db.prepare("UPDATE quotations SET status = 'approved', approved_at = ?, approved_by = ?, updated_at = ? WHERE id = ?")
      .run(now, approved_by || '', now, req.params.id);
  } else if (action === 'reject') {
    db.prepare("UPDATE quotations SET status = 'draft', approval_requested_at = NULL, approval_requested_by = NULL, updated_at = ? WHERE id = ?")
      .run(now, req.params.id);
  } else {
    return res.status(400).json({ error: 'Action must be "approve" or "reject"' });
  }

  res.json(db.prepare("SELECT * FROM quotations WHERE id = ?").get(req.params.id));
});

router.get('/:id/pdf', (req: Request, res: Response) => {
  const quotation = db.prepare(`
    SELECT q.*, c.name as company_name,
      ct.first_name || ' ' || ct.last_name as contact_name
    FROM quotations q
    LEFT JOIN companies c ON q.company_id = c.id
    LEFT JOIN contacts ct ON q.contact_id = ct.id
    WHERE q.id = ? AND q.deleted_at IS NULL
  `).get(req.params.id) as any;
  if (!quotation) return res.status(404).json({ error: 'Not found' });

  const line_items = db.prepare(
    "SELECT * FROM quotation_line_items WHERE quotation_id = ? ORDER BY line_number"
  ).all(req.params.id) as any[];

  const doc = generateQuotationPDF(quotation, line_items);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${quotation.quotation_number || 'quotation'}.pdf"`);
  doc.pipe(res);
  doc.end();
});

export default router;
