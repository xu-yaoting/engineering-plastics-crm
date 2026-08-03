import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { validate } from '../validate.js';
import { nextInquiryNumber } from '../numbers.js';
import { computeChanges, writeAudit } from '../audit.js';

const router = Router();

const INQUIRY_UPDATE_FIELDS = [
  'company_id',
  'contact_id',
  'project_id',
  'assigned_to',
  'source',
  'application_description',
  'target_material_requested',
  'recommended_product_id',
  'operating_temp_min_c',
  'operating_temp_max_c',
  'chemical_exposure',
  'mechanical_load',
  'regulatory_requirements',
  'quantity_estimate',
  'urgency',
  'estimated_budget',
  'currency',
  'status',
  'lost_reason',
  'converted_to_quotation_id',
  'technical_notes',
  'custom_fields',
  'owner_user_id',
] as const;

router.get('/', (req: Request, res: Response) => {
  const { status, company_id } = req.query;
  const q = req.query.q as string | undefined;
  let query = `SELECT i.*, c.name as company_name, owner.name as owner_name,
    creator.name as created_by_name, updater.name as updated_by_name
    FROM inquiries i
    LEFT JOIN companies c ON i.company_id = c.id
    LEFT JOIN users owner ON owner.id = i.owner_user_id
    LEFT JOIN users creator ON creator.id = i.created_by
    LEFT JOIN users updater ON updater.id = i.updated_by
    WHERE i.deleted_at IS NULL`;
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
      ct.first_name || ' ' || ct.last_name as contact_name, ct.email as contact_email,
      owner.name as owner_name, creator.name as created_by_name, updater.name as updated_by_name
    FROM inquiries i
    LEFT JOIN companies c ON i.company_id = c.id
    LEFT JOIN contacts ct ON i.contact_id = ct.id
    LEFT JOIN users owner ON owner.id = i.owner_user_id
    LEFT JOIN users creator ON creator.id = i.created_by
    LEFT JOIN users updater ON updater.id = i.updated_by
    WHERE i.id = ? AND i.deleted_at IS NULL
  `).get(req.params.id);
  if (!inquiry) return res.status(404).json({ error: 'Not found' });
  const latestQuotation = db.prepare(`
    SELECT id, quotation_number, status, total, currency, valid_until, version, quotation_date
    FROM quotations
    WHERE inquiry_id = ? AND deleted_at IS NULL
    ORDER BY version DESC, created_at DESC
    LIMIT 1
  `).get(req.params.id);
  res.json({ ...inquiry, latest_quotation: latestQuotation || null });
});

router.post('/', (req: Request, res: Response) => {
  const err = validate(req.body, ['company_id']);
  if (err) return res.status(400).json({ success: false, message: err });

  // Verify FK: company must exist
  const company = db.prepare("SELECT * FROM companies WHERE id = ? AND deleted_at IS NULL")
    .get(req.body.company_id) as Record<string, unknown> | undefined;
  if (!company) return res.status(400).json({ success: false, message: 'Selected company does not exist' });
  if (req.body.contact_id) {
    const contact = db.prepare(
      "SELECT id FROM contacts WHERE id = ? AND company_id = ? AND deleted_at IS NULL",
    ).get(req.body.contact_id, req.body.company_id);
    if (!contact) {
      return res.status(400).json({
        success: false,
        message: 'Selected contact does not belong to the company',
      });
    }
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const inquiry_number = nextInquiryNumber();
  const ownerUserId = req.body.owner_user_id || company.owner_user_id || req.user!.id;
  const ownerName = (db.prepare("SELECT name FROM users WHERE id = ?").get(ownerUserId) as { name: string } | undefined)?.name || req.user!.name;

  const createdInquiry = db.transaction(() => {
    db.prepare(`
      INSERT INTO inquiries (id, inquiry_number, company_id, contact_id, source,
        application_description, target_material_requested, quantity_estimate,
        urgency, estimated_budget, currency, status, owner_user_id, assigned_to,
        created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, inquiry_number, req.body.company_id, req.body.contact_id,
      req.body.source || 'email', req.body.application_description,
      req.body.target_material_requested, req.body.quantity_estimate,
      req.body.urgency || 'within_1_month', req.body.estimated_budget,
      req.body.currency || 'USD', 'open', ownerUserId, ownerName,
      req.user!.id, req.user!.id, now, now);
    const created = db.prepare("SELECT * FROM inquiries WHERE id = ?").get(id) as Record<string, unknown>;
    writeAudit(req, 'inquiry', id, 'create', computeChanges(null, created));
    db.prepare(`
      UPDATE companies
      SET development_stage = 'converted', updated_by = ?, updated_at = ?
      WHERE id = ?
    `).run(req.user!.id, now, req.body.company_id);
    const convertedCompany = db.prepare("SELECT * FROM companies WHERE id = ?")
      .get(req.body.company_id) as Record<string, unknown>;
    writeAudit(
      req,
      'company',
      req.body.company_id,
      'update',
      computeChanges(company, convertedCompany),
    );
    return created;
  })();
  res.status(201).json(createdInquiry);
});

router.put('/:id', (req: Request, res: Response) => {
  const now = new Date().toISOString();
  const updateFields = INQUIRY_UPDATE_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(req.body, field)
  );
  if (updateFields.length === 0) {
    return res.status(400).json({ success: false, message: 'No valid fields to update' });
  }
  const before = db.prepare("SELECT * FROM inquiries WHERE id = ? AND deleted_at IS NULL").get(req.params.id) as Record<string, unknown> | undefined;
  if (!before) return res.status(404).json({ success: false, message: 'Record not found' });

  if (Object.prototype.hasOwnProperty.call(req.body, 'owner_user_id')) {
    const requestedOwnerId = req.body.owner_user_id || null;
    const currentOwnerId = before.owner_user_id || null;
    if (requestedOwnerId !== currentOwnerId && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only an administrator can transfer an inquiry owner' });
    }
    if (requestedOwnerId) {
      const owner = db.prepare('SELECT id FROM users WHERE id = ? AND is_active = 1').get(requestedOwnerId);
      if (!owner) return res.status(400).json({ error: 'Selected owner is not an active team member' });
    }
    req.body.owner_user_id = requestedOwnerId;
  }

  const updatedInquiry = db.transaction(() => {
    const fields = updateFields.map((field) => `${field} = ?`).join(', ');
    const values = updateFields.map((field) => req.body[field]);
    db.prepare(`UPDATE inquiries SET ${fields}, updated_by = ?, updated_at = ? WHERE id = ?`).run(...values, req.user!.id, now, req.params.id);
    const after = db.prepare("SELECT * FROM inquiries WHERE id = ?").get(req.params.id) as Record<string, unknown>;
    writeAudit(req, 'inquiry', req.params.id, 'update', computeChanges(before, after));
    return after;
  })();
  res.json(updatedInquiry);
});

router.delete('/:id', (req: Request, res: Response) => {
  const inquiry = db.prepare("SELECT inquiry_number FROM inquiries WHERE id = ? AND deleted_at IS NULL").get(req.params.id) as { inquiry_number: string } | undefined;
  if (!inquiry) return res.status(404).json({ error: 'Not found' });
  db.transaction(() => {
    db.prepare("UPDATE inquiries SET deleted_at = ?, updated_by = ? WHERE id = ?").run(new Date().toISOString(), req.user!.id, req.params.id);
    writeAudit(req, 'inquiry', req.params.id, 'delete', { inquiry_number: inquiry.inquiry_number });
  })();
  res.status(204).send();
});

export default router;
