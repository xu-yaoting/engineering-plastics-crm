import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { validate } from '../validate';
import { nextQuotationNumber } from '../numbers';
import { generateQuotationPDF } from '../pdf-quotation';

const router = Router();

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
  const { line_items, ...dataFields } = req.body;
  const fields = Object.entries(dataFields).filter(([k]) => k !== 'id' && k !== 'created_at' && k !== 'quotation_number')
    .map(([k, v]) => `${k} = ?`).join(', ');
  const values = Object.entries(dataFields).filter(([k]) => k !== 'id' && k !== 'created_at' && k !== 'quotation_number')
    .map(([_, v]) => v);

  // Auto-approval: if total > 100k and status is 'draft', escalate to pending_approval
  const total = req.body.total || 0;
  const current = db.prepare("SELECT status FROM quotations WHERE id = ?").get(req.params.id) as any;
  if (total > 100000 && current?.status === 'draft') {
    dataFields.status = 'pending_approval';
    dataFields.approval_requested_at = now;
    // Rebuild fields/values with updated data
    const updatedEntries = Object.entries(dataFields).filter(([k]) => k !== 'id' && k !== 'created_at' && k !== 'quotation_number');
    const updFields = updatedEntries.map(([k]) => `${k} = ?`).join(', ');
    const updValues = updatedEntries.map(([_, v]) => v);
    db.prepare(`UPDATE quotations SET ${updFields}, updated_at = ? WHERE id = ?`).run(...updValues, now, req.params.id);
  } else {
    const result = db.prepare(`UPDATE quotations SET ${fields}, updated_at = ? WHERE id = ?`).run(...values, now, req.params.id);
    if (result.changes === 0) return res.status(404).json({ success: false, message: 'Record not found' });
  }

  res.json(db.prepare("SELECT * FROM quotations WHERE id = ?").get(req.params.id));
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
