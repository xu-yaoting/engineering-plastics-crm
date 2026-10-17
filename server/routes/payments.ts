import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { validate } from '../validate.js';
import { nextPaymentNumber } from '../numbers.js';
import { computeChanges, writeAudit } from '../audit.js';
import { canManageOwnedRecord, requireAdministrator, requireOwnedRecord } from '../authorize.js';

const router = Router();

function balanceTolerance(...amounts: number[]): number {
  return Number.EPSILON * Math.max(1, ...amounts.map(amount => Math.abs(amount))) * 4;
}

router.get('/', (req: Request, res: Response) => {
  const q = req.query.q as string | undefined;
  let sql = `
    SELECT i.*, o.order_number, o.currency, o.owner_user_id, c.name as company_name,
      owner.name as owner_name,
      creator.name as created_by_name, updater.name as updated_by_name
    FROM invoices i
    LEFT JOIN orders o ON i.order_id = o.id
    LEFT JOIN companies c ON o.company_id = c.id
    LEFT JOIN users owner ON o.owner_user_id = owner.id
    LEFT JOIN users creator ON i.created_by = creator.id
    LEFT JOIN users updater ON i.updated_by = updater.id
    WHERE i.deleted_at IS NULL`;
  const params: string[] = [];
  if (q) {
    sql += " AND (i.invoice_number LIKE ? OR o.order_number LIKE ? OR c.name LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  sql += " ORDER BY i.created_at DESC";
  const invoices = db.prepare(sql).all(...params) as Array<Record<string, unknown> & { owner_user_id?: string }>;
  res.json(invoices.map(invoice => ({
    ...invoice,
    can_edit: !!req.user && canManageOwnedRecord(req.user, invoice.owner_user_id),
  })));
});

router.get('/:id', (req: Request, res: Response) => {
  const invoice = db.prepare(`
    SELECT i.*, o.order_number, o.owner_user_id, c.name as company_name,
      owner.name as owner_name,
      creator.name as created_by_name, updater.name as updated_by_name
    FROM invoices i
    LEFT JOIN orders o ON i.order_id = o.id
    LEFT JOIN companies c ON o.company_id = c.id
    LEFT JOIN users owner ON o.owner_user_id = owner.id
    LEFT JOIN users creator ON i.created_by = creator.id
    LEFT JOIN users updater ON i.updated_by = updater.id
    WHERE i.id = ? AND i.deleted_at IS NULL
  `).get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Not found' });

  const inv = invoice as any;

  const payments = db.prepare(
    `SELECT p.*, creator.name as created_by_name
     FROM payment_records p
     LEFT JOIN users creator ON p.created_by = creator.id
     WHERE p.invoice_id = ? ORDER BY p.payment_date DESC`
  ).all(req.params.id);

  // Calc overdue status
  const dueDate = new Date(inv.due_date);
  if (inv.status !== 'paid' && inv.status !== 'cancelled' && dueDate < new Date()) {
    db.prepare("UPDATE invoices SET status = 'overdue' WHERE id = ?").run(req.params.id);
    inv.status = 'overdue';
  }

  res.json({
    ...inv,
    can_edit: !!req.user && canManageOwnedRecord(req.user, inv.owner_user_id),
    payments,
  });
});

router.post('/', (req: Request, res: Response) => {
  const err = validate(req.body, ['order_id', 'total']);
  if (err) return res.status(400).json({ success: false, message: err });

  const invoiceTotal = Number(req.body.total);
  if (!Number.isFinite(invoiceTotal) || invoiceTotal <= 0) {
    return res.status(400).json({ success: false, message: 'Invoice total must be greater than 0' });
  }

  // Verify FK: order must exist
  const ord = db.prepare("SELECT id, owner_user_id FROM orders WHERE id = ? AND deleted_at IS NULL")
    .get(req.body.order_id) as { id: string; owner_user_id: string | null } | undefined;
  if (!ord) return res.status(400).json({ success: false, message: 'Selected order does not exist' });
  if (!requireOwnedRecord(req, res, ord.owner_user_id)) return;

  const id = uuidv4();
  const now = new Date().toISOString();
  const count = (db.prepare("SELECT COUNT(*) as c FROM invoices").get() as any).c + 1;
  const invoice_number = `INV-${now.slice(2,4)}-${String(count).padStart(4, '0')}`;

  const { order_id, due_date, invoice_type, notes } = req.body;

  const createdInvoice = db.transaction(() => {
    const resolvedDueDate = due_date || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    db.prepare(`
      INSERT INTO invoices (id, invoice_number, order_id, company_id, invoice_date,
        due_date, total, amount_due, status, notes, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, (SELECT company_id FROM orders WHERE id = ?), ?, ?, ?, ?, 'issued', ?, ?, ?, ?, ?)
    `).run(id, invoice_number, order_id, order_id, now.slice(0, 10),
      resolvedDueDate, invoiceTotal, invoiceTotal, notes || '', req.user!.id, req.user!.id, now, now);
    writeAudit(req, 'invoice', id, 'create', {
      invoice_number,
      order_id,
      due_date: resolvedDueDate,
      total: invoiceTotal,
    });
    return db.prepare("SELECT * FROM invoices WHERE id = ?").get(id);
  })();

  res.status(201).json(createdInvoice);
});

router.put('/:id', (req: Request, res: Response) => {
  const invoice = db.prepare(`
    SELECT i.*, o.owner_user_id
    FROM invoices i
    LEFT JOIN orders o ON i.order_id = o.id
    WHERE i.id = ? AND i.deleted_at IS NULL
  `).get(req.params.id) as any;
  if (!invoice) return res.status(404).json({ error: 'Not found' });
  if (!requireOwnedRecord(req, res, invoice.owner_user_id)) return;

  const total = req.body.total !== undefined ? Number(req.body.total) : Number(invoice.total);
  if (!Number.isFinite(total) || total <= 0) {
    return res.status(400).json({ error: 'Invoice total must be greater than 0' });
  }

  const amountPaid = Number(invoice.amount_paid ?? 0);
  const tolerance = balanceTolerance(total, amountPaid);
  if (amountPaid - total > tolerance) {
    return res.status(400).json({ error: 'Invoice total cannot be less than amount already paid', amountPaid, total });
  }

  const dueDate = req.body.due_date !== undefined ? req.body.due_date : invoice.due_date;
  if (!dueDate) return res.status(400).json({ error: 'Due date is required' });

  const balance = total - amountPaid;
  const amountDue = Math.abs(balance) <= tolerance ? 0 : Math.max(0, balance);
  const status = amountDue <= 0 ? 'paid' : amountPaid > 0 ? 'partial_paid' : 'issued';
  const now = new Date().toISOString();

  const updatedInvoice = db.transaction(() => {
    const notes = req.body.notes ?? invoice.notes ?? '';
    db.prepare(`
      UPDATE invoices
      SET total = ?, amount_due = ?, status = ?, due_date = ?, notes = ?, fully_paid_at = ?, updated_by = ?, updated_at = ?
      WHERE id = ? AND deleted_at IS NULL
    `).run(
      total,
      amountDue,
      status,
      dueDate,
      notes,
      status === 'paid' ? (invoice.fully_paid_at || now) : null,
      req.user!.id,
      now,
      req.params.id,
    );
    writeAudit(req, 'invoice', req.params.id, 'update', computeChanges(invoice, {
      ...invoice, total, amount_due: amountDue, due_date: dueDate, notes, status,
    }));
    return db.prepare("SELECT * FROM invoices WHERE id = ?").get(req.params.id);
  })();

  res.json(updatedInvoice);
});

router.post('/:id/pay', (req: Request, res: Response) => {
  const now = new Date().toISOString();
  const paymentId = uuidv4();
  const { amount, payment_method, reference_number } = req.body;
  const paymentAmount = Number(amount);

  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    return res.status(400).json({ error: 'Payment amount must be greater than 0' });
  }

  const invoice = db.prepare("SELECT i.*, o.order_number, o.owner_user_id FROM invoices i LEFT JOIN orders o ON i.order_id = o.id WHERE i.id = ? AND i.deleted_at IS NULL").get(req.params.id) as any;
  if (!invoice) return res.status(404).json({ error: 'Not found' });
  if (!requireOwnedRecord(req, res, invoice.owner_user_id)) return;

  const remainingDue = Number(invoice.amount_due ?? invoice.total ?? 0);
  const tolerance = balanceTolerance(remainingDue, paymentAmount, Number(invoice.total));
  if (paymentAmount - remainingDue > tolerance) {
    return res.status(400).json({ error: 'Payment exceeds remaining balance', remainingDue, paymentAmount });
  }

  const payment_number = invoice.order_number ? nextPaymentNumber(invoice.order_number) : null;

  const balance = remainingDue - paymentAmount;
  const newDue = Math.abs(balance) <= tolerance ? 0 : Math.max(0, balance);
  const newPaid = newDue === 0 ? Number(invoice.total) : Number(invoice.amount_paid ?? 0) + paymentAmount;
  const newStatus = newDue <= 0 ? 'paid' : 'partial_paid';

  const paidInvoice = db.transaction(() => {
    db.prepare(`
      INSERT INTO payment_records (id, invoice_id, payment_date, amount, payment_method, reference_number, payment_number, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(paymentId, req.params.id, now.slice(0, 10), paymentAmount, payment_method, reference_number, payment_number, req.user!.id, now);

    db.prepare("UPDATE invoices SET amount_paid = ?, amount_due = ?, status = ?, fully_paid_at = ?, updated_by = ?, updated_at = ? WHERE id = ?")
      .run(newPaid, newDue, newStatus, newStatus === 'paid' ? now : null, req.user!.id, now, req.params.id);
    db.prepare("UPDATE orders SET payment_status = ? WHERE id = ?")
      .run(newStatus === 'paid' ? 'paid' : 'partial', invoice.order_id);

    writeAudit(req, 'payment_record', paymentId, 'create', {
      invoice_id: req.params.id,
      payment_number,
      payment_date: now.slice(0, 10),
      amount: paymentAmount,
      payment_method,
      reference_number,
    });
    writeAudit(req, 'invoice', req.params.id, 'payment_applied', {
      before: { amount_paid: invoice.amount_paid, amount_due: remainingDue, status: invoice.status },
      after: { amount_paid: newPaid, amount_due: newDue, status: newStatus },
      payment_record_id: paymentId,
    });
    return db.prepare("SELECT * FROM invoices WHERE id = ?").get(req.params.id);
  })();

  res.json(paidInvoice);
});

router.delete('/:id', (req: Request, res: Response) => {
  if (!requireAdministrator(req, res)) return;
  const invoice = db.prepare("SELECT invoice_number FROM invoices WHERE id = ? AND deleted_at IS NULL").get(req.params.id) as { invoice_number: string } | undefined;
  if (!invoice) return res.status(404).json({ error: 'Not found' });

  db.transaction(() => {
    db.prepare("UPDATE invoices SET deleted_at = ?, updated_by = ? WHERE id = ?")
      .run(new Date().toISOString(), req.user!.id, req.params.id);
    writeAudit(req, 'invoice', req.params.id, 'delete', { invoice_number: invoice.invoice_number });
  })();
  res.status(204).send();
});

export default router;
