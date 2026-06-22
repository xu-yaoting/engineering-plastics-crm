import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { validate } from '../validate';
import { nextInquiryNumber } from '../numbers';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { status, company_id } = req.query;
  const q = req.query.q as string | undefined;
  let query = `SELECT i.*, c.name as company_name FROM inquiries i
    LEFT JOIN companies c ON i.company_id = c.id WHERE i.deleted_at IS NULL`;
  const params: string[] = [];
  if (status) { query += " AND i.status = ?"; params.push(status as string); }
  if (company_id) { query += " AND i.company_id = ?"; params.push(company_id as string); }
  if (q) {
    query += " AND (i.inquiry_number LIKE ? OR c.name LIKE ? OR i.target_material_requested LIKE ? OR i.application_description LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  query += " ORDER BY i.created_at DESC";
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req: Request, res: Response) => {
  const inquiry = db.prepare(`
    SELECT i.*, c.name as company_name, c.industry as company_industry,
      ct.first_name || ' ' || ct.last_name as contact_name, ct.email as contact_email
    FROM inquiries i
    LEFT JOIN companies c ON i.company_id = c.id
    LEFT JOIN contacts ct ON i.contact_id = ct.id
    WHERE i.id = ? AND i.deleted_at IS NULL
  `).get(req.params.id);
  if (!inquiry) return res.status(404).json({ error: 'Not found' });
  res.json(inquiry);
});

router.post('/', (req: Request, res: Response) => {
  const err = validate(req.body, ['company_id']);
  if (err) return res.status(400).json({ success: false, message: err });

  // Verify FK: company must exist
  const co = db.prepare("SELECT id FROM companies WHERE id = ? AND deleted_at IS NULL").get(req.body.company_id);
  if (!co) return res.status(400).json({ success: false, message: 'Selected company does not exist' });

  const id = uuidv4();
  const now = new Date().toISOString();
  const inquiry_number = nextInquiryNumber();

  db.prepare(`
    INSERT INTO inquiries (id, inquiry_number, company_id, contact_id, source,
      application_description, target_material_requested, quantity_estimate,
      urgency, estimated_budget, currency, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, inquiry_number, req.body.company_id, req.body.contact_id,
    req.body.source || 'email', req.body.application_description,
    req.body.target_material_requested, req.body.quantity_estimate,
    req.body.urgency || 'within_1_month', req.body.estimated_budget,
    req.body.currency || 'USD', 'open', now, now);

  res.status(201).json(db.prepare("SELECT * FROM inquiries WHERE id = ?").get(id));
});

router.put('/:id', (req: Request, res: Response) => {
  const now = new Date().toISOString();
  const fields = Object.entries(req.body).filter(([k]) => k !== 'id' && k !== 'created_at' && k !== 'inquiry_number')
    .map(([k, v]) => `${k} = ?`).join(', ');
  const values = Object.entries(req.body).filter(([k]) => k !== 'id' && k !== 'created_at' && k !== 'inquiry_number')
    .map(([_, v]) => v);
  const result = db.prepare(`UPDATE inquiries SET ${fields}, updated_at = ? WHERE id = ?`).run(...values, now, req.params.id);
  if (result.changes === 0) return res.status(404).json({ success: false, message: 'Record not found' });
  res.json(db.prepare("SELECT * FROM inquiries WHERE id = ?").get(req.params.id));
});

router.delete('/:id', (req: Request, res: Response) => {
  db.prepare("UPDATE inquiries SET deleted_at = ? WHERE id = ?").run(new Date().toISOString(), req.params.id);
  res.status(204).send();
});

export default router;
