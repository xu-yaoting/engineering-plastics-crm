import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { validate } from '../validate.js';
import { nextQuotationNumber } from '../numbers.js';
import { generateQuotationPDF } from '../pdf-quotation.js';
import { computeChanges, writeAudit } from '../audit.js';

const router = Router();

const QUOTATION_UPDATE_FIELDS = [
  'company_id',
  'contact_id',
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
  'owner_user_id',
  'application_description',
  'target_material_requested',
  'quantity_estimate',
  'urgency',
  'source',
] as const;

router.get('/', (req: Request, res: Response) => {
  const { status, company_id } = req.query;
  const q = req.query.q as string | undefined;
  let query = `SELECT q.*, c.name as company_name, owner.name as owner_name,
    creator.name as created_by_name, updater.name as updated_by_name
    FROM quotations q
    LEFT JOIN companies c ON q.company_id = c.id
    LEFT JOIN users owner ON owner.id = q.owner_user_id
    LEFT JOIN users creator ON creator.id = q.created_by
    LEFT JOIN users updater ON updater.id = q.updated_by
    WHERE q.deleted_at IS NULL`;
  const params: string[] = [];
  if (status) { query += " AND q.status = ?"; params.push(status as string); }
  if (company_id) { query += " AND q.company_id = ?"; params.push(company_id as string); }
  if (q) {
    query += " AND (q.quotation_number LIKE ? OR c.name LIKE ? OR q.target_material_requested LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  query += " ORDER BY q.created_at DESC";
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req: Request, res: Response) => {
  const quotation = db.prepare(`
    SELECT q.*, c.name as company_name,
      ct.first_name || ' ' || ct.last_name as contact_name,
      (SELECT id FROM orders WHERE quotation_id = q.id AND deleted_at IS NULL LIMIT 1) as order_id,
      owner.name as owner_name, creator.name as created_by_name, updater.name as updated_by_name
    FROM quotations q
    LEFT JOIN companies c ON q.company_id = c.id
    LEFT JOIN contacts ct ON q.contact_id = ct.id
    LEFT JOIN users owner ON owner.id = q.owner_user_id
    LEFT JOIN users creator ON creator.id = q.created_by
    LEFT JOIN users updater ON updater.id = q.updated_by
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

  const lineItems = Array.isArray(req.body.line_items) ? req.body.line_items : [];
  if (lineItems.length === 0) {
    return res.status(400).json({
      success: false,
      code: 'QUOTATION_LINE_ITEMS_REQUIRED',
      message: 'At least one quotation line item is required',
    });
  }

  // Verify FK: company must exist
  const company = db.prepare("SELECT id, owner_user_id FROM companies WHERE id = ? AND deleted_at IS NULL")
    .get(req.body.company_id) as { id: string; owner_user_id: string | null } | undefined;
  if (!company) return res.status(400).json({ success: false, message: 'Selected company does not exist' });

  const id = uuidv4();
  const now = new Date().toISOString();
  const quotation_number = nextQuotationNumber();

  const quotation_date = req.body.quotation_date || new Date().toISOString().slice(0, 10);
  const valid_until = req.body.valid_until || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Auto-approval check: total > 100,000 USD → pending_approval
  const total = req.body.total || 0;
  const status = total > 100000 ? 'pending_approval' : 'draft';
  const now2 = new Date().toISOString();
  const ownerUserId = req.body.owner_user_id || company.owner_user_id || req.user!.id;
  const ownerName = (db.prepare("SELECT name FROM users WHERE id = ?").get(ownerUserId) as { name: string } | undefined)?.name || req.user!.name;

  const createdQuotation = db.transaction(() => {
  db.prepare(`
    INSERT INTO quotations (id, quotation_number, company_id, contact_id,
      quotation_date, valid_until, currency, subtotal, total, status, version,
      approval_requested_at, owner_user_id, assigned_to, created_by, updated_by, created_at, updated_at,
      application_description, target_material_requested, quantity_estimate, urgency, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, quotation_number, req.body.company_id, req.body.contact_id,
    quotation_date, valid_until, req.body.currency || 'USD',
    req.body.subtotal || 0, total, status, 1,
    total > 100000 ? now2 : null, ownerUserId, ownerName, req.user!.id, req.user!.id, now, now,
    req.body.application_description || '',
    req.body.target_material_requested || '',
    req.body.quantity_estimate || '',
    req.body.urgency || 'within_1_month',
    req.body.source || 'email');

  if (lineItems.length > 0) {
    const insert = db.prepare(`
      INSERT INTO quotation_line_items (id, quotation_id, line_number, product_grade_snapshot,
        unit_of_measure, quantity, unit_price, line_total, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const [idx, item] of lineItems.entries()) {
      insert.run(uuidv4(), id, idx + 1, item.product_grade_snapshot,
        item.unit_of_measure, item.quantity, item.unit_price, item.line_total, item.description);
    }
  }
  const created = db.prepare("SELECT * FROM quotations WHERE id = ?").get(id) as Record<string, unknown>;
  writeAudit(req, 'quotation', id, 'create', {
    ...computeChanges(null, created), line_item_count: lineItems.length,
  });
  return created;
  })();
  res.status(201).json(createdQuotation);
});

router.put('/:id', (req: Request, res: Response) => {
  const now = new Date().toISOString();
  const before = db.prepare("SELECT * FROM quotations WHERE id = ? AND deleted_at IS NULL").get(req.params.id) as Record<string, unknown> | undefined;
  if (!before) return res.status(404).json({ success: false, message: 'Record not found' });

  if (Object.prototype.hasOwnProperty.call(req.body, 'owner_user_id')) {
    const requestedOwnerId = req.body.owner_user_id || null;
    const currentOwnerId = before.owner_user_id || null;
    if (requestedOwnerId !== currentOwnerId && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only an administrator can transfer a quotation owner' });
    }
    if (requestedOwnerId) {
      const owner = db.prepare('SELECT id FROM users WHERE id = ? AND is_active = 1').get(requestedOwnerId);
      if (!owner) return res.status(400).json({ error: 'Selected owner is not an active team member' });
    }
    req.body.owner_user_id = requestedOwnerId;
  }

  const dataFields = { ...req.body };
  delete dataFields.line_items;
  const requestedTotal = req.body.total || 0;
  if (requestedTotal > 100000 && before.status === 'draft') {
    dataFields.status = 'pending_approval';
    dataFields.approval_requested_at = now;
  }
  const updateFields = QUOTATION_UPDATE_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(dataFields, field));
  if (updateFields.length === 0 && !req.body.line_items) {
    return res.status(400).json({ success: false, message: 'No valid fields to update' });
  }

  const updateQuotation = db.transaction(() => {

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

  if (updateFields.length > 0) {
    const fields = updateFields.map((field) => `${field} = ?`).join(', ');
    const values = updateFields.map((field) => dataFields[field]);
    const result = db.prepare(`UPDATE quotations SET ${fields}, updated_by = ?, updated_at = ? WHERE id = ?`).run(...values, req.user!.id, now, req.params.id);
    if (result.changes === 0) throw new Error('Quotation update failed');
  } else {
    const existing = db.prepare("SELECT id FROM quotations WHERE id = ? AND deleted_at IS NULL").get(req.params.id);
    if (!existing) throw new Error('Quotation update failed');
  }
  const after = db.prepare("SELECT * FROM quotations WHERE id = ?").get(req.params.id) as Record<string, unknown>;
  writeAudit(req, 'quotation', req.params.id, 'update', {
    ...computeChanges(before, after),
    line_items_replaced: Boolean(req.body.line_items), line_item_count: req.body.line_items?.length,
  });
  return after;
  })();
  res.json(updateQuotation);
});

router.delete('/:id', (req: Request, res: Response) => {
  const quote = db.prepare("SELECT quotation_number FROM quotations WHERE id = ? AND deleted_at IS NULL").get(req.params.id) as { quotation_number: string } | undefined;
  if (!quote) return res.status(404).json({ error: 'Not found' });
  db.transaction(() => {
    db.prepare("UPDATE quotations SET deleted_at = ?, updated_by = ?, updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), req.user!.id, new Date().toISOString(), req.params.id);
    writeAudit(req, 'quotation', req.params.id, 'delete', { quotation_number: quote.quotation_number });
  })();
  res.status(204).send();
});

// Approve or reject a quotation that is pending_approval
router.post('/:id/approve', (req: Request, res: Response) => {
  const { action, approved_by } = req.body; // action: 'approve' | 'reject'
  const now = new Date().toISOString();

  const quote = db.prepare("SELECT id, status, total FROM quotations WHERE id = ? AND deleted_at IS NULL").get(req.params.id) as any;
  if (!quote) return res.status(404).json({ error: 'Not found' });
  if (quote.status !== 'pending_approval') return res.status(400).json({ error: 'Quotation is not pending approval' });
  if (action !== 'approve' && action !== 'reject') return res.status(400).json({ error: 'Action must be "approve" or "reject"' });

  const updatedQuote = db.transaction(() => {
  if (action === 'approve') {
    db.prepare("UPDATE quotations SET status = 'approved', approved_at = ?, approved_by = ?, updated_by = ?, updated_at = ? WHERE id = ?")
      .run(now, approved_by || req.user!.name, req.user!.id, now, req.params.id);
  } else if (action === 'reject') {
    db.prepare("UPDATE quotations SET status = 'draft', approval_requested_at = NULL, approval_requested_by = NULL, updated_by = ?, updated_at = ? WHERE id = ?")
      .run(req.user!.id, now, req.params.id);
  }
  writeAudit(req, 'quotation', req.params.id, action, {
    before: { status: quote.status },
    after: { status: action === 'approve' ? 'approved' : 'draft' }, approved_by: approved_by || null,
  });
  return db.prepare("SELECT * FROM quotations WHERE id = ?").get(req.params.id);
  })();
  res.json(updatedQuote);
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
