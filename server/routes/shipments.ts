import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { validate } from '../validate.js';
import { nextShipmentNumber } from '../numbers.js';
import { computeChanges, writeAudit } from '../audit.js';

const router = Router();

const SHIPMENT_UPDATE_FIELDS = [
  'order_id',
  'shipping_type',
  'carrier',
  'tracking_number',
  'shipping_address',
  'notes',
  'status',
  'container_no',
  'vessel',
  'voyage',
  'awb',
  'airline',
  'express_provider',
  'etd',
  'eta',
  'shipped_at',
  'estimated_delivery_date',
  'actual_delivery_date',
] as const;

router.get('/', (req: Request, res: Response) => {
  const q = req.query.q as string | undefined;
  let sql = `
    SELECT s.*, o.order_number, o.company_id, c.name as company_name,
      creator.name as created_by_name, updater.name as updated_by_name
    FROM shipments s
    LEFT JOIN orders o ON s.order_id = o.id
    LEFT JOIN companies c ON o.company_id = c.id
    LEFT JOIN users creator ON creator.id = s.created_by
    LEFT JOIN users updater ON updater.id = s.updated_by
    WHERE s.deleted_at IS NULL`;
  const params: string[] = [];
  if (q) {
    sql += " AND (s.shipment_number LIKE ? OR o.order_number LIKE ? OR c.name LIKE ? OR s.carrier LIKE ? OR s.tracking_number LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  sql += " ORDER BY s.created_at DESC";
  const shipments = db.prepare(sql).all(...params);
  res.json(shipments);
});

router.get('/:id', (req: Request, res: Response) => {
  const shipment = db.prepare(`
    SELECT s.*, o.order_number, c.name as company_name,
      creator.name as created_by_name, updater.name as updated_by_name
    FROM shipments s
    LEFT JOIN orders o ON s.order_id = o.id
    LEFT JOIN companies c ON o.company_id = c.id
    LEFT JOIN users creator ON creator.id = s.created_by
    LEFT JOIN users updater ON updater.id = s.updated_by
    WHERE s.id = ? AND s.deleted_at IS NULL
  `).get(req.params.id);
  if (!shipment) return res.status(404).json({ error: 'Not found' });
  res.json(shipment as any);
});

router.post('/', (req: Request, res: Response) => {
  const err = validate(req.body, ['order_id']);
  if (err) return res.status(400).json({ success: false, message: err });

  // Verify FK: order must exist
  const ord = db.prepare("SELECT id, order_number FROM orders WHERE id = ? AND deleted_at IS NULL").get(req.body.order_id) as any;
  if (!ord) return res.status(400).json({ success: false, message: 'Selected order does not exist' });

  const id = uuidv4();
  const now = new Date().toISOString();
  const shipment_number = nextShipmentNumber();

  const {
    order_id, shipping_type, carrier, tracking_number, shipping_address, notes, status,
    container_no, vessel, voyage, awb, airline, express_provider,
    etd, eta, shipped_at, estimated_delivery_date,
  } = req.body;

  const createdShipment = db.transaction(() => {
    db.prepare(`
      INSERT INTO shipments (id, shipment_number, order_id, shipping_type, carrier,
        tracking_number, shipping_address, notes, status,
        container_no, vessel, voyage, awb, airline, express_provider,
        etd, eta, shipped_at, estimated_delivery_date, created_by, updated_by,
        created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?)
    `).run(id, shipment_number, order_id, shipping_type || 'express', carrier,
      tracking_number, shipping_address, notes, status || 'pending_pickup',
      container_no, vessel, voyage, awb, airline, express_provider,
      etd, eta, shipped_at, estimated_delivery_date, req.user!.id, req.user!.id, now, now);
    db.prepare("UPDATE orders SET status = CASE WHEN status = 'shipped' THEN 'shipped' ELSE 'partially_shipped' END, updated_by = ?, updated_at = ? WHERE id = ?")
      .run(req.user!.id, now, order_id);
    const created = db.prepare("SELECT * FROM shipments WHERE id = ?").get(id) as Record<string, unknown>;
    writeAudit(req, 'shipment', id, 'create', computeChanges(null, created));
    return created;
  })();
  res.status(201).json(createdShipment);
});

router.put('/:id', (req: Request, res: Response) => {
  const now = new Date().toISOString();

  const updateFields = SHIPMENT_UPDATE_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(req.body, field) && req.body[field] !== undefined
  );
  if (updateFields.length === 0) {
    return res.status(400).json({ success: false, message: 'No valid fields to update' });
  }

  const before = db.prepare("SELECT * FROM shipments WHERE id = ? AND deleted_at IS NULL").get(req.params.id) as Record<string, unknown> | undefined;
  if (!before) return res.status(404).json({ success: false, message: 'Record not found' });
  const updatedShipment = db.transaction(() => {
    const fields = updateFields.map((field) => `${field} = ?`).join(', ');
    const values = updateFields.map((field) => req.body[field]);
    db.prepare(`UPDATE shipments SET ${fields}, updated_by = ?, updated_at = ? WHERE id = ?`).run(...values, req.user!.id, now, req.params.id);
    const after = db.prepare("SELECT * FROM shipments WHERE id = ?").get(req.params.id) as Record<string, unknown>;
    writeAudit(req, 'shipment', req.params.id, 'update', computeChanges(before, after));
    return after;
  })();
  res.json(updatedShipment);
});

router.delete('/:id', (req: Request, res: Response) => {
  const shipment = db.prepare("SELECT shipment_number FROM shipments WHERE id = ? AND deleted_at IS NULL").get(req.params.id) as { shipment_number: string } | undefined;
  if (!shipment) return res.status(404).json({ error: 'Not found' });
  db.transaction(() => {
    db.prepare("UPDATE shipments SET deleted_at = ?, updated_by = ? WHERE id = ?").run(new Date().toISOString(), req.user!.id, req.params.id);
    writeAudit(req, 'shipment', req.params.id, 'delete', { shipment_number: shipment.shipment_number });
  })();
  res.status(204).send();
});

export default router;
