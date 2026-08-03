import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { validate } from '../validate.js';
import { computeChanges, writeAudit } from '../audit.js';

const router = Router();

const CONTACT_UPDATE_FIELDS = [
  'company_id',
  'salutation',
  'first_name',
  'last_name',
  'job_title',
  'department',
  'role_in_process',
  'email',
  'phone_direct',
  'phone_mobile',
  'wechat_id',
  'is_primary_contact',
  'is_decision_maker',
  'communication_language',
  'preferred_contact_method',
  'timezone',
  'notes',
  'last_contacted_at',
  'is_active',
] as const;

type ContactUpdateField = typeof CONTACT_UPDATE_FIELDS[number];

function toContactSqlValue(field: ContactUpdateField, value: any) {
  if (field === 'is_primary_contact' || field === 'is_decision_maker' || field === 'is_active') {
    return value ? 1 : 0;
  }
  return value;
}

router.get('/', (req: Request, res: Response) => {
  const { company_id } = req.query;
  const q = req.query.q as string | undefined;
  let query = "SELECT c.*, co.name as company_name, co.country as company_country, co.phone as company_phone, co.email as company_email FROM contacts c LEFT JOIN companies co ON c.company_id = co.id WHERE c.deleted_at IS NULL";
  const params: string[] = [];
  if (company_id) {
    query += " AND c.company_id = ?";
    params.push(company_id as string);
  }
  if (q) {
    query += " AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ? OR co.name LIKE ? OR c.phone_direct LIKE ? OR c.phone_mobile LIKE ? OR c.wechat_id LIKE ? OR co.phone LIKE ? OR co.email LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like, like, like, like);
  }
  query += " ORDER BY c.is_primary_contact DESC, c.last_name ASC";
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req: Request, res: Response) => {
  const contact = db.prepare(
    "SELECT c.*, co.name as company_name, co.country as company_country, co.phone as company_phone, co.email as company_email FROM contacts c LEFT JOIN companies co ON c.company_id = co.id WHERE c.id = ? AND c.deleted_at IS NULL"
  ).get(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Not found' });
  res.json(contact);
});

router.post('/', (req: Request, res: Response) => {
  const err = validate(req.body, ['first_name', 'last_name']);
  if (err) return res.status(400).json({ success: false, message: err });

  const { company_id, salutation, first_name, last_name, job_title, department,
    role_in_process, email, phone_direct, phone_mobile, is_primary_contact,
    is_decision_maker, notes, wechat_id } = req.body;

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

  db.transaction(() => {
    db.prepare(`
    INSERT INTO contacts (id, company_id, salutation, first_name, last_name, job_title,
      department, role_in_process, email, phone_direct, phone_mobile,
      wechat_id, is_primary_contact, is_decision_maker, notes, created_by, updated_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, company_id, salutation, first_name, last_name, job_title,
    department, role_in_process || 'procurement', email || '', phone_direct, phone_mobile,
      wechat_id, is_primary_contact ? 1 : 0, is_decision_maker ? 1 : 0, notes,
      req.user!.id, req.user!.id, now, now);
    const created = db.prepare("SELECT * FROM contacts WHERE id = ?").get(id) as Record<string, unknown>;
    writeAudit(req, 'contact', id, 'create', computeChanges(null, created));
  })();

  res.status(201).json(db.prepare("SELECT * FROM contacts WHERE id = ?").get(id));
});

router.put('/:id', (req: Request, res: Response) => {
  if (req.body.first_name !== undefined || req.body.last_name !== undefined) {
    const err = validate(req.body, [
      ...(req.body.first_name !== undefined ? ['first_name'] : []),
      ...(req.body.last_name !== undefined ? ['last_name'] : []),
    ]);
    if (err) return res.status(400).json({ success: false, message: err });
  }
  const now = new Date().toISOString();
  const before = db.prepare("SELECT * FROM contacts WHERE id = ? AND deleted_at IS NULL").get(req.params.id) as Record<string, unknown> | undefined;
  if (!before) return res.status(404).json({ success: false, message: 'Record not found' });
  if (req.body.is_primary_contact) {
    const contact = db.prepare("SELECT company_id FROM contacts WHERE id = ?").get(req.params.id) as any;
    if (contact) db.prepare("UPDATE contacts SET is_primary_contact = 0 WHERE company_id = ?").run(contact.company_id);
  }
  const updateFields = CONTACT_UPDATE_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(req.body, field)
  );
  if (updateFields.length === 0) {
    return res.status(400).json({ success: false, message: 'No valid fields to update' });
  }
  const fields = updateFields.map((field) => `${field} = ?`).join(', ');
  const values = updateFields.map((field) => toContactSqlValue(field, req.body[field]));
  db.transaction(() => {
    db.prepare(`UPDATE contacts SET ${fields}, updated_by = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`)
      .run(...values, req.user!.id, now, req.params.id);
    const after = db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id) as Record<string, unknown>;
    writeAudit(req, 'contact', req.params.id, 'update', computeChanges(before, after));
  })();
  res.json(db.prepare("SELECT * FROM contacts WHERE id = ?").get(req.params.id));
});

router.delete('/:id', (req: Request, res: Response) => {
  const before = db.prepare("SELECT * FROM contacts WHERE id = ? AND deleted_at IS NULL").get(req.params.id) as Record<string, unknown> | undefined;
  if (!before) return res.status(404).json({ error: 'Not found' });
  db.transaction(() => {
    db.prepare("UPDATE contacts SET deleted_at = ?, updated_by = ? WHERE id = ?")
      .run(new Date().toISOString(), req.user!.id, req.params.id);
    writeAudit(req, 'contact', req.params.id, 'delete', { name: `${before.first_name ?? ''} ${before.last_name ?? ''}`.trim() });
  })();
  res.status(204).send();
});

export default router;
