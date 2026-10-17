import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { computeChanges, writeAudit } from '../audit.js';
import { validate } from '../validate.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT s.*, c.name as company_name, owner.name as owner_name,
      creator.name as created_by_name, updater.name as updated_by_name
    FROM sample_requests s
    LEFT JOIN companies c ON s.company_id = c.id
    LEFT JOIN users owner ON s.owner_user_id = owner.id
    LEFT JOIN users creator ON s.created_by = creator.id
    LEFT JOIN users updater ON s.updated_by = updater.id
    WHERE s.deleted_at IS NULL
    ORDER BY s.created_at DESC
  `).all();
  res.json(rows);
});

router.post('/', (req: Request, res: Response) => {
  const error = validate(req.body, ['company_id', 'purpose']);
  if (error) return res.status(400).json({ success: false, message: error });
  const { company_id } = req.body;
  const quotationId = req.body.quotation_id || null;
  const contactId = req.body.contact_id || null;
  const company = typeof company_id === 'string'
    ? db.prepare('SELECT owner_user_id FROM companies WHERE id = ? AND deleted_at IS NULL').get(company_id) as { owner_user_id?: string } | undefined : undefined;
  if (!company) return res.status(400).json({ success: false, message: 'Selected company does not exist' });
  const quotation = typeof quotationId === 'string'
    ? db.prepare('SELECT company_id, owner_user_id FROM quotations WHERE id = ? AND deleted_at IS NULL').get(quotationId) as { company_id: string; owner_user_id?: string } | undefined : undefined;
  if (quotationId && (!quotation || quotation.company_id !== company_id)) {
    return res.status(400).json({ success: false, message: 'Selected quotation does not belong to the company' });
  }
  if (contactId) {
    const contact = typeof contactId === 'string'
      ? db.prepare('SELECT id FROM contacts WHERE id = ? AND company_id = ? AND deleted_at IS NULL').get(contactId, company_id) : undefined;
    if (!contact) return res.status(400).json({ success: false, message: 'Selected contact does not belong to the company' });
  }
  const id = uuidv4();
  const now = new Date().toISOString();
  const count = (db.prepare("SELECT COUNT(*) as c FROM sample_requests").get() as any).c + 1;
  const sample_request_number = `SMP-${now.slice(2,4)}-${String(count).padStart(4, '0')}`;

  const { purpose, shipping_address, sample_charge, status } = req.body;
  const ownerUserId = req.body.owner_user_id || quotation?.owner_user_id || company?.owner_user_id || req.user!.id;
  const owner = db.prepare("SELECT name FROM users WHERE id = ? AND is_active = 1").get(ownerUserId) as { name: string } | undefined;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO sample_requests (id, sample_request_number, company_id, contact_id, quotation_id,
        purpose, shipping_address, sample_charge, status, owner_user_id, assigned_to,
        created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, sample_request_number, company_id, contactId, quotationId,
      purpose, shipping_address, sample_charge || 0, status || 'approved', ownerUserId,
      owner?.name || null, req.user!.id, req.user!.id, now, now);
    writeAudit(req, 'sample_request', id, 'create', computeChanges(null, {
      sample_request_number, company_id, quotation_id: quotationId, owner_user_id: ownerUserId,
      status: status || 'approved',
    }));
  })();

  res.status(201).json(db.prepare("SELECT * FROM sample_requests WHERE id = ?").get(id));
});

export default router;
