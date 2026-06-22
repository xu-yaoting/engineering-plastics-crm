import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { validate } from '../validate';
import { nextShipmentNumber } from '../numbers';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const q = req.query.q as string | undefined;
  let sql = `
    SELECT s.*, o.order_number, o.company_id, c.name as company_name
    FROM shipments s
    LEFT JOIN orders o ON s.order_id = o.id
    LEFT JOIN companies c ON o.company_id = c.id
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
    SELECT s.*, o.order_number, c.name as company_name
    FROM shipments s
    LEFT JOIN orders o ON s.order_id = o.id
    LEFT JOIN companies c ON o.company_id = c.id
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
  const shipment_number = nextShipmentNumber(ord.order_number);

  const {
    order_id, shipping_type, carrier, tracking_number, shipping_address, notes, status,
    container_no, vessel, voyage, awb, airline, express_provider,
    etd, eta, estimated_delivery_date,
  } = req.body;

  db.prepare(`
    INSERT INTO shipments (id, shipment_number, order_id, shipping_type, carrier,
      tracking_number, shipping_address, notes, status,
      container_no, vessel, voyage, awb, airline, express_provider,
      etd, eta, estimated_delivery_date,
      created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?)
  `).run(id, shipment_number, order_id, shipping_type || 'sea_freight', carrier,
    tracking_number, shipping_address, notes, status || 'pending_pickup',
    container_no, vessel, voyage, awb, airline, express_provider,
    etd, eta, estimated_delivery_date,
    now, now);

  db.prepare("UPDATE orders SET status = CASE WHEN status = 'shipped' THEN 'shipped' ELSE 'partially_shipped' END WHERE id = ?").run(order_id);
  res.status(201).json(db.prepare("SELECT * FROM shipments WHERE id = ?").get(id));
});

router.put('/:id', (req: Request, res: Response) => {
  const now = new Date().toISOString();

  // Exclude non-editable fields
  const { id: _, created_at: __, shipment_number: ___, ...dataFields } = req.body;

  const fields = Object.entries(dataFields)
    .filter(([_, v]) => v !== undefined)
    .map(([k]) => `${k} = ?`).join(', ');
  const values = Object.entries(dataFields)
    .filter(([_, v]) => v !== undefined)
    .map(([_, v]) => v);

  if (fields) {
    const result = db.prepare(`UPDATE shipments SET ${fields}, updated_at = ? WHERE id = ?`).run(...values, now, req.params.id);
    if (result.changes === 0) return res.status(404).json({ success: false, message: 'Record not found' });
  }
  res.json(db.prepare("SELECT * FROM shipments WHERE id = ?").get(req.params.id));
});

router.delete('/:id', (req: Request, res: Response) => {
  db.prepare("UPDATE shipments SET deleted_at = ? WHERE id = ?").run(new Date().toISOString(), req.params.id);
  res.status(204).send();
});

export default router;
