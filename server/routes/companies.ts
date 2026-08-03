import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import XLSX from 'xlsx';
import db from '../db.js';
import { validate } from '../validate.js';
import { computeChanges, writeAudit } from '../audit.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

const COMPANY_UPDATE_FIELDS = [
  'name',
  'company_type',
  'industry',
  'registration_number',
  'website',
  'phone',
  'email',
  'address_line_1',
  'address_line_2',
  'city',
  'state_province',
  'country',
  'postal_code',
  'region',
  'credit_term',
  'credit_limit',
  'status',
  'classification',
  'lead_source',
  'first_contact_date',
  'last_activity_at',
  'tags',
  'notes',
  'customer_code',
  'owner_user_id',
] as const;

router.get('/', (req: Request, res: Response) => {
  const q = req.query.q as string | undefined;
  let sql = `SELECT c.*, owner.name AS owner_name, creator.name AS created_by_name, updater.name AS updated_by_name
    FROM companies c
    LEFT JOIN users owner ON owner.id = c.owner_user_id
    LEFT JOIN users creator ON creator.id = c.created_by
    LEFT JOIN users updater ON updater.id = c.updated_by
    WHERE c.deleted_at IS NULL`;
  const params: string[] = [];
  if (q) {
    sql += " AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.city LIKE ? OR c.country LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  sql += " ORDER BY c.updated_at DESC";
  const companies = db.prepare(sql).all(...params);
  res.json(companies);
});

router.get('/:id', (req: Request, res: Response) => {
  const company = db.prepare(
    `SELECT c.*, owner.name AS owner_name, creator.name AS created_by_name, updater.name AS updated_by_name
     FROM companies c
     LEFT JOIN users owner ON owner.id = c.owner_user_id
     LEFT JOIN users creator ON creator.id = c.created_by
     LEFT JOIN users updater ON updater.id = c.updated_by
     WHERE c.id = ? AND c.deleted_at IS NULL`
  ).get(req.params.id);
  if (!company) return res.status(404).json({ error: 'Not found' });
  res.json(company);
});

router.post('/', (req: Request, res: Response) => {
  const err = validate(req.body, ['name']);
  if (err) return res.status(400).json({ success: false, message: err });

  // Validate customer_code uniqueness
  const code = (req.body.customer_code || '').toString().trim().toUpperCase();
  if (code) {
    const dup = db.prepare("SELECT id FROM companies WHERE customer_code = ? AND deleted_at IS NULL").get(code);
    if (dup) return res.status(400).json({ success: false, message: `Customer code "${code}" is already in use` });
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const {
    name, company_type, industry, registration_number, website,
    phone, email, address_line_1, address_line_2, city, state_province,
    country, postal_code, region, credit_term, credit_limit, status,
    classification, lead_source, first_contact_date, notes
  } = req.body;

  const createCompany = db.transaction(() => {
    db.prepare(`
    INSERT INTO companies (id, name, company_type, industry, registration_number,
      website, phone, email, address_line_1, address_line_2, city, state_province,
      country, postal_code, region, credit_term, credit_limit, status,
      classification, lead_source, first_contact_date, notes, customer_code, owner_user_id,
      created_by, updated_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, name, company_type || 'end_user', industry, registration_number,
    website, phone, email, address_line_1, address_line_2, city, state_province,
    country || 'US', postal_code, region, credit_term, credit_limit, status || 'active',
      classification || 'C', lead_source, first_contact_date || now, notes, code || null,
      req.user!.id, req.user!.id, req.user!.id, now, now
    );
    const created = db.prepare("SELECT * FROM companies WHERE id = ?").get(id) as Record<string, unknown>;
    writeAudit(req, 'company', id, 'create', computeChanges(null, created));
  });
  createCompany();

  const company = db.prepare("SELECT * FROM companies WHERE id = ?").get(id);
  res.status(201).json(company);
});

router.put('/:id', (req: Request, res: Response) => {
  if (req.body.name !== undefined) {
    const err = validate(req.body, ['name']);
    if (err) return res.status(400).json({ success: false, message: err });
  }
  // Validate customer_code uniqueness (exclude self)
  const code = req.body.customer_code;
  if (code !== undefined) {
    const clean = code.toString().trim().toUpperCase();
    const dup = db.prepare("SELECT id FROM companies WHERE customer_code = ? AND id != ? AND deleted_at IS NULL").get(clean, req.params.id);
    if (dup) return res.status(400).json({ success: false, message: `Customer code "${clean}" is already in use` });
    req.body.customer_code = clean || null;
  }

  const before = db.prepare("SELECT * FROM companies WHERE id = ? AND deleted_at IS NULL").get(req.params.id) as Record<string, unknown> | undefined;
  if (!before) return res.status(404).json({ success: false, message: 'Record not found' });

  if (Object.prototype.hasOwnProperty.call(req.body, 'owner_user_id')) {
    const requestedOwnerId = req.body.owner_user_id || null;
    req.body.owner_user_id = requestedOwnerId;

    if (requestedOwnerId !== (before.owner_user_id || null) && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only administrators can transfer company ownership' });
    }

    if (requestedOwnerId && req.user!.role === 'admin') {
      const owner = db.prepare('SELECT id FROM users WHERE id = ? AND is_active = 1').get(requestedOwnerId);
      if (!owner) return res.status(400).json({ success: false, message: 'Invalid or inactive owner' });
    }
  }

  const updateFields = COMPANY_UPDATE_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(req.body, field)
  );
  if (updateFields.length === 0) {
    return res.status(400).json({ success: false, message: 'No valid fields to update' });
  }

  const now = new Date().toISOString();
  const fields = updateFields.map((field) => `${field} = ?`).join(', ');
  const values = updateFields.map((field) => req.body[field]);

  db.transaction(() => {
    db.prepare(`UPDATE companies SET ${fields}, updated_by = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`)
      .run(...values, req.user!.id, now, req.params.id);
    const after = db.prepare("SELECT * FROM companies WHERE id = ?").get(req.params.id) as Record<string, unknown>;
    writeAudit(req, 'company', req.params.id, 'update', computeChanges(before, after));
  })();

  const company = db.prepare("SELECT * FROM companies WHERE id = ?").get(req.params.id);
  res.json(company);
});

router.delete('/:id', (req: Request, res: Response) => {
  const before = db.prepare("SELECT * FROM companies WHERE id = ? AND deleted_at IS NULL").get(req.params.id) as Record<string, unknown> | undefined;
  if (!before) return res.status(404).json({ error: 'Not found' });
  db.transaction(() => {
    db.prepare("UPDATE companies SET deleted_at = ?, updated_by = ? WHERE id = ?")
      .run(new Date().toISOString(), req.user!.id, req.params.id);
    writeAudit(req, 'company', req.params.id, 'delete', { name: before.name });
  })();
  res.status(204).send();
});

// ─── Companies Import (CSV / XLSX) ───

router.post('/import', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Parse file
    let rows: Record<string, any>[] = [];
    const ext = req.file.originalname.toLowerCase();
    if (ext.endsWith('.csv')) {
      const text = req.file.buffer.toString('utf-8');
      const lines = text.split('\n').filter(Boolean);
      const headers = lines[0].split(',').map(h => h.trim());
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim());
        const row: Record<string, any> = {};
        headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
        rows.push(row);
      }
    } else {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws);
    }

    if (rows.length === 0) return res.status(400).json({ error: 'File is empty' });

    const now = new Date().toISOString();
    let created = 0, skipped = 0, errors: string[] = [];
    const results: any[] = [];

    for (const row of rows) {
      const name = (row.Name || row.name || row.CompanyName || '').toString().trim();
      if (!name) { errors.push('Row skipped: missing Name'); skipped++; continue; }

      // Check for duplicate by name
      const existing = db.prepare("SELECT id FROM companies WHERE name = ? AND deleted_at IS NULL").get(name);
      if (existing) { skipped++; results.push({ name, action: 'skipped (duplicate)' }); continue; }

      const customerCode = (row.CustomerCode || row.customer_code || '').toString().trim().toUpperCase() || null;
      if (customerCode) {
        const dup = db.prepare("SELECT id FROM companies WHERE customer_code = ? AND deleted_at IS NULL").get(customerCode);
        if (dup) { errors.push(`Row skipped: customer code "${customerCode}" already in use`); skipped++; continue; }
      }

      const id = uuidv4();
      db.transaction(() => {
        db.prepare(`
        INSERT INTO companies (id, name, company_type, industry, registration_number,
          website, phone, email, address_line_1, address_line_2, city, state_province,
          country, postal_code, region, credit_term, credit_limit, status,
          classification, lead_source, first_contact_date, notes, customer_code, owner_user_id,
          created_by, updated_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, name,
        (row.Type || row.company_type || 'end_user').toString().replace(' ', '_').toLowerCase(),
        row.Industry || row.industry || null,
        row.RegistrationNo || row.registration_number || null,
        row.Website || row.website || null,
        row.Phone || row.phone || null,
        row.Email || row.email || null,
        row.Address1 || row.address_line_1 || null,
        row.Address2 || row.address_line_2 || null,
        row.City || row.city || null,
        row.State || row.state_province || null,
        row.Country || row.country || 'US',
        row.PostalCode || row.postal_code || null,
        null, null, null,
        (row.Status || row.status || 'active').toString().toLowerCase(),
        (row.Classification || row.classification || 'C').toString().toUpperCase(),
          null, null, null, customerCode, req.user!.id, req.user!.id, req.user!.id, now, now
        );
        const createdCompany = db.prepare("SELECT * FROM companies WHERE id = ?").get(id) as Record<string, unknown>;
        writeAudit(req, 'company', id, 'import', computeChanges(null, createdCompany));
      })();
      created++;
      results.push({ name, action: 'created' });
    }

    res.json({ success: true, total: rows.length, created, skipped, errors: errors.slice(0, 20), results });
  } catch (e: any) {
    res.status(500).json({ error: 'Import failed', detail: e.message });
  }
});

export default router;
