import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { validate } from '../validate';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const q = req.query.q as string | undefined;
  let sql = "SELECT * FROM companies WHERE deleted_at IS NULL";
  const params: string[] = [];
  if (q) {
    sql += " AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR city LIKE ? OR country LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  sql += " ORDER BY updated_at DESC";
  const companies = db.prepare(sql).all(...params);
  res.json(companies);
});

router.get('/:id', (req: Request, res: Response) => {
  const company = db.prepare(
    "SELECT * FROM companies WHERE id = ? AND deleted_at IS NULL"
  ).get(req.params.id);
  if (!company) return res.status(404).json({ error: 'Not found' });
  res.json(company);
});

router.post('/', (req: Request, res: Response) => {
  const err = validate(req.body, ['name']);
  if (err) return res.status(400).json({ success: false, message: err });

  const id = uuidv4();
  const now = new Date().toISOString();
  const {
    name, company_type, industry, registration_number, website,
    phone, email, address_line_1, address_line_2, city, state_province,
    country, postal_code, region, credit_term, credit_limit, status,
    classification, lead_source, first_contact_date, notes
  } = req.body;

  db.prepare(`
    INSERT INTO companies (id, name, company_type, industry, registration_number,
      website, phone, email, address_line_1, address_line_2, city, state_province,
      country, postal_code, region, credit_term, credit_limit, status,
      classification, lead_source, first_contact_date, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, name, company_type || 'end_user', industry, registration_number,
    website, phone, email, address_line_1, address_line_2, city, state_province,
    country || 'US', postal_code, region, credit_term, credit_limit, status || 'active',
    classification || 'C', lead_source, first_contact_date || now, notes, now, now
  );

  const company = db.prepare("SELECT * FROM companies WHERE id = ?").get(id);
  res.status(201).json(company);
});

router.put('/:id', (req: Request, res: Response) => {
  // If name is included in the update, it must not be empty
  if (req.body.name !== undefined) {
    const err = validate(req.body, ['name']);
    if (err) return res.status(400).json({ success: false, message: err });
  }
  const now = new Date().toISOString();
  const fields = Object.entries(req.body)
    .filter(([k]) => k !== 'id' && k !== 'created_at')
    .map(([k, v]) => `${k} = ?`).join(', ');
  const values = Object.entries(req.body)
    .filter(([k]) => k !== 'id' && k !== 'created_at')
    .map(([_, v]) => v);

  const result = db.prepare(`UPDATE companies SET ${fields}, updated_at = ? WHERE id = ? AND deleted_at IS NULL`)
    .run(...values, now, req.params.id);
  if (result.changes === 0) return res.status(404).json({ success: false, message: 'Record not found' });

  const company = db.prepare("SELECT * FROM companies WHERE id = ?").get(req.params.id);
  res.json(company);
});

router.delete('/:id', (req: Request, res: Response) => {
  db.prepare("UPDATE companies SET deleted_at = ? WHERE id = ?")
    .run(new Date().toISOString(), req.params.id);
  res.status(204).send();
});

export default router;
