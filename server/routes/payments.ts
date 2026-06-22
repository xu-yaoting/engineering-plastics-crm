import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { validate } from '../validate';
import { nextPaymentNumber } from '../numbers';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const q = req.query.q as string | undefined;
  let sql = `
    SELECT i.*, o.order_number, o.currency, c.name as company_name
    FROM invoices i
    LEFT JOIN orders o ON i.order_id = o.id
    LEFT JOIN companies c ON o.company_id = c.id
    WHERE i.deleted_at IS NULL`;
  const params: string[] = [];
  if (q) {
    sql += " AND (i.invoice_number LIKE ? OR o.order_number LIKE ? OR c.name LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  sql += " ORDER BY i.created_at DESC";
  const invoices = db.prepare(sql).all(...params);
  res.json(invoices);
});

router.get('/:id', (req: Request, res: Response) => {
  const invoice = db.prepare(`
    SELECT i.*, o.order_number, c.name as company_name
    FROM invoices i
    LEFT JOIN orders o ON i.order_id = o.id
    LEFT JOIN companies c ON o.company_id = c.id
    WHERE i.id = ? AND i.deleted_at IS NULL
  `).get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Not found' });

  const inv = invoice as any;

  const payments = db.prepare(
    "SELECT * FROM payment_records WHERE invoice_id = ? ORDER BY payment_date DESC"
  ).all(req.params.id);

  // Calc overdue status
  const dueDate = new Date(inv.due_date);
  if (inv.status !== 'paid' && inv.status !== 'cancelled' && dueDate < new Date()) {
    db.prepare("UPDATE invoices SET status = 'overdue' WHERE id = ?").run(req.params.id);
    inv.status = 'overdue';
  }

  res.json({ ...inv, payments });
});

router.post('/', (req: Request, res: Response) => {
  const err = validate(req.body, ['order_id', 'total']);
  if (err) return res.status(400).json({ success: false, message: err });

  // Verify FK: order must exist
  const ord = db.prepare("SELECT id FROM orders WHERE id = ? AND deleted_at IS NULL").get(req.body.order_id);
  if (!ord) return res.status(400).json({ success: false, message: 'Selected order does not exist' });

  const id = uuidv4();
  const now = new Date().toISOString();
  const count = (db.prepare("SELECT COUNT(*) as c FROM invoices").get() as any).c + 1;
  const invoice_number = `INV-${now.slice(2,4)}-${String(count).padStart(4, '0')}`;

  const { order_id, total, due_date, invoice_type, notes } = req.body;

  db.prepare(`
    INSERT INTO invoices (id, invoice_number, order_id, company_id, invoice_date,
      due_date, total, amount_due, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, (SELECT company_id FROM orders WHERE id = ?), ?, ?, ?, ?, 'issued', ?, ?, ?)
  `).run(id, invoice_number, order_id, order_id, now.slice(0, 10),
    due_date || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    total, total, notes || '', now, now);

  res.status(201).json(db.prepare("SELECT * FROM invoices WHERE id = ?").get(id));
});

router.post('/:id/pay', (req: Request, res: Response) => {
  const now = new Date().toISOString();
  const paymentId = uuidv4();
  const { amount, payment_method, reference_number } = req.body;

  const invoice = db.prepare("SELECT i.*, o.order_number FROM invoices i LEFT JOIN orders o ON i.order_id = o.id WHERE i.id = ?").get(req.params.id) as any;
  if (!invoice) return res.status(404).json({ error: 'Not found' });

  const payment_number = invoice.order_number ? nextPaymentNumber(invoice.order_number) : null;

  db.prepare(`
    INSERT INTO payment_records (id, invoice_id, payment_date, amount, payment_method, reference_number, payment_number, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(paymentId, req.params.id, now.slice(0, 10), amount, payment_method, reference_number, payment_number, now);

  const newPaid = (invoice.amount_paid || 0) + amount;
  const newDue = Math.max(0, (invoice.amount_due || invoice.total) - amount);
  const newStatus = newDue <= 0 ? 'paid' : 'partial_paid';

  db.prepare("UPDATE invoices SET amount_paid = ?, amount_due = ?, status = ?, fully_paid_at = ?, updated_at = ? WHERE id = ?")
    .run(newPaid, newDue, newStatus, newStatus === 'paid' ? now : null, now, req.params.id);

  if (newStatus === 'paid') {
    db.prepare("UPDATE orders SET payment_status = 'paid' WHERE id = ?").run(invoice.order_id);
  } else {
    db.prepare("UPDATE orders SET payment_status = 'partial' WHERE id = ?").run(invoice.order_id);
  }

  res.json(db.prepare("SELECT * FROM invoices WHERE id = ?").get(req.params.id));
});

router.delete('/:id', (req: Request, res: Response) => {
  db.prepare("UPDATE invoices SET deleted_at = ? WHERE id = ?").run(new Date().toISOString(), req.params.id);
  res.status(204).send();
});

export default router;
