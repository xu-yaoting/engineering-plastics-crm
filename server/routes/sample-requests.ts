import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT s.*, c.name as company_name
    FROM sample_requests s
    LEFT JOIN companies c ON s.company_id = c.id
    WHERE s.deleted_at IS NULL
    ORDER BY s.created_at DESC
  `).all();
  res.json(rows);
});

router.post('/', (req: Request, res: Response) => {
  const id = uuidv4();
  const now = new Date().toISOString();
  const count = (db.prepare("SELECT COUNT(*) as c FROM sample_requests").get() as any).c + 1;
  const sample_request_number = `SMP-${now.slice(2,4)}-${String(count).padStart(4, '0')}`;

  const { quotation_id, company_id, contact_id, purpose, shipping_address, sample_charge, status } = req.body;

  db.prepare(`
    INSERT INTO sample_requests (id, sample_request_number, company_id, contact_id, quotation_id,
      purpose, shipping_address, sample_charge, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, sample_request_number, company_id, contact_id, quotation_id,
    purpose, shipping_address, sample_charge || 0, status || 'approved', now, now);

  res.status(201).json(db.prepare("SELECT * FROM sample_requests WHERE id = ?").get(id));
});

export default router;
