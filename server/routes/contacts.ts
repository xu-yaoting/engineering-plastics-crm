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

function clearOtherPrimaryContacts(req: Request, companyId: unknown, contactId: string, now: string): void {
  if (typeof companyId !== 'string' || !companyId) return;
  const previous = db.prepare('SELECT * FROM contacts WHERE company_id = ? AND id != ? AND is_primary_contact = 1 AND deleted_at IS NULL')
    .all(companyId, contactId) as Record<string, unknown>[];
  for (const contact of previous) {
    db.prepare('UPDATE contacts SET is_primary_contact = 0, updated_by = ?, updated_at = ? WHERE id = ?')
      .run(req.user!.id, now, contact.id);
    writeAudit(req, 'contact', contact.id as string, 'update', computeChanges(contact, { ...contact, is_primary_contact: 0 }));
  }
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
  const companyId = company_id || null;

  // Verify FK: company must exist
  if (companyId) {
    if (typeof companyId !== 'string') return res.status(400).json({ success: false, message: 'Selected company does not exist' });
    const co = db.prepare("SELECT id FROM companies WHERE id = ? AND deleted_at IS NULL").get(companyId);
    if (!co) return res.status(400).json({ success: false, message: 'Selected company does not exist' });
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.transaction(() => {
    if (is_primary_contact) clearOtherPrimaryContacts(req, companyId, id, now);
    db.prepare(`
    INSERT INTO contacts (id, company_id, salutation, first_name, last_name, job_title,
      department, role_in_process, email, phone_direct, phone_mobile,
      wechat_id, is_primary_contact, is_decision_maker, notes, created_by, updated_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, companyId, salutation, first_name, last_name, job_title,
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
  const companySubmitted = Object.prototype.hasOwnProperty.call(req.body, 'company_id');
  const companyId = companySubmitted ? req.body.company_id || null : before.company_id;
  if (companySubmitted) req.body.company_id = companyId;
  if (companyId !== before.company_id && companyId !== null) {
    const company = typeof companyId === 'string'
      ? db.prepare('SELECT id FROM companies WHERE id = ? AND deleted_at IS NULL').get(companyId) : undefined;
    if (!company) return res.status(400).json({ success: false, message: 'Selected company does not exist' });
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
    const primary = Object.prototype.hasOwnProperty.call(req.body, 'is_primary_contact') ? req.body.is_primary_contact : before.is_primary_contact;
    if (primary && (companyId !== before.company_id || req.body.is_primary_contact)) {
      clearOtherPrimaryContacts(req, companyId, req.params.id, now);
    }
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
