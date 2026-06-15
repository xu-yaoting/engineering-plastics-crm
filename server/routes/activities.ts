import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { entity_type, entity_id, limit: limitParam } = req.query;
  let query = "SELECT * FROM activities WHERE deleted_at IS NULL";
  const params: string[] = [];

  if (entity_type && entity_id) {
    query += " AND entity_type = ? AND entity_id = ?";
    params.push(entity_type as string, entity_id as string);
  }

  query += " ORDER BY created_at DESC";

  const limit = parseInt(limitParam as string) || 50;
  query += " LIMIT ?";
  params.push(String(limit));

  res.json(db.prepare(query).all(...params));
});

router.get('/recent', (_req: Request, res: Response) => {
  const activities = db.prepare(`
    SELECT a.*, c.name as company_name
    FROM activities a
    LEFT JOIN companies c ON (a.entity_type = 'company' AND a.entity_id = c.id)
    WHERE a.deleted_at IS NULL
    ORDER BY a.created_at DESC LIMIT 20
  `).all();
  res.json(activities);
});

router.post('/', (req: Request, res: Response) => {
  const id = uuidv4();
  const now = new Date().toISOString();
  const { entity_type, entity_id, activity_type, subject, description,
    direction, channel, duration_minutes, linked_entity_type, linked_entity_id } = req.body;

  db.prepare(`
    INSERT INTO activities (id, entity_type, entity_id, activity_type, subject, description,
      direction, channel, duration_minutes, linked_entity_type, linked_entity_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, entity_type, entity_id, activity_type, subject, description,
    direction, channel, duration_minutes, linked_entity_type, linked_entity_id, now, now);

  if (entity_type === 'company') {
    db.prepare("UPDATE companies SET last_activity_at = ? WHERE id = ?").run(now, entity_id);
  }

  res.status(201).json(db.prepare("SELECT * FROM activities WHERE id = ?").get(id));
});

router.delete('/:id', (req: Request, res: Response) => {
  db.prepare("UPDATE activities SET deleted_at = ? WHERE id = ?").run(new Date().toISOString(), req.params.id);
  res.status(204).send();
});

export default router;
