import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { validate } from '../validate';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { company_id } = req.query;
  const q = req.query.q as string | undefined;
  let query = "SELECT c.*, co.name as company_name FROM contacts c LEFT JOIN companies co ON c.company_id = co.id WHERE c.deleted_at IS NULL";
  const params: string[] = [];
  if (company_id) {
    query += " AND c.company_id = ?";
    params.push(company_id as string);
  }
  if (q) {
    query += " AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ? OR co.name LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  query += " ORDER BY c.is_primary_contact DESC, c.last_name ASC";
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req: Request, res: Response) => {
  const contact = db.prepare(
    "SELECT c.*, co.name as company_name FROM contacts c LEFT JOIN companies co ON c.company_id = co.id WHERE c.id = ? AND c.deleted_at IS NULL"
  ).get(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Not found' });
  res.json(contact);
});

router.post('/', (req: Request, res: Response) => {
  const err = validate(req.body, ['first_name', 'email']);
  if (err) return res.status(400).json({ success: false, message: err });

  const { company_id, salutation, first_name, last_name, job_title, department,
    role_in_process, email, phone_direct, phone_mobile, is_primary_contact,
    is_decision_maker, notes } = req.body;

  // Verify FK: company must exist
  if (company_id) {
    const co = db.prepare("SELECT id FROM companies WHERE id = ? AND deleted_at IS NULL").get(company_id);
    if (!co) return res.status(400).json({ success: false, message: 'Selected company does not exist' });
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  if (is_primary_contact) {
    db.prepare("UPDATE contacts SET is_primary_contact = 0 WHERE company_id = ?").run(company_id);
  }

  db.prepare(`
    INSERT INTO contacts (id, company_id, salutation, first_name, last_name, job_title,
      department, role_in_process, email, phone_direct, phone_mobile,
      is_primary_contact, is_decision_maker, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, company_id, salutation, first_name, last_name, job_title,
    department, role_in_process || 'procurement', email, phone_direct, phone_mobile,
    is_primary_contact ? 1 : 0, is_decision_maker ? 1 : 0, notes, now, now);

  res.status(201).json(db.prepare("SELECT * FROM contacts WHERE id = ?").get(id));
});

router.put('/:id', (req: Request, res: Response) => {
  // If first_name or email is included in the update, they must not be empty
  if (req.body.first_name !== undefined || req.body.email !== undefined) {
    const err = validate(req.body, [
      ...(req.body.first_name !== undefined ? ['first_name'] : []),
      ...(req.body.email !== undefined ? ['email'] : []),
    ]);
    if (err) return res.status(400).json({ success: false, message: err });
  }
  const now = new Date().toISOString();
  if (req.body.is_primary_contact) {
    const contact = db.prepare("SELECT company_id FROM contacts WHERE id = ?").get(req.params.id) as any;
    if (contact) db.prepare("UPDATE contacts SET is_primary_contact = 0 WHERE company_id = ?").run(contact.company_id);
  }
  const fields = Object.entries(req.body).filter(([k]) => k !== 'id' && k !== 'created_at')
    .map(([k, v]) => `${k} = ?`).join(', ');
  const values = Object.entries(req.body).filter(([k]) => k !== 'id' && k !== 'created_at')
    .map(([_, v]) => v);
  const result = db.prepare(`UPDATE contacts SET ${fields}, updated_at = ? WHERE id = ? AND deleted_at IS NULL`)
    .run(...values, now, req.params.id);
  if (result.changes === 0) return res.status(404).json({ success: false, message: 'Record not found' });
  res.json(db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id));
});

router.delete('/:id', (req: Request, res: Response) => {
  db.prepare("UPDATE contacts SET deleted_at = ? WHERE id = ?")
    .run(new Date().toISOString(), req.params.id);
  res.status(204).send();
});

export default router;
