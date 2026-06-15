import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { status, entity_type, entity_id } = req.query;
  let query = "SELECT * FROM tasks WHERE deleted_at IS NULL";
  const params: string[] = [];

  if (status) { query += " AND status = ?"; params.push(status as string); }
  if (entity_type && entity_id) { query += " AND entity_type = ? AND entity_id = ?"; params.push(entity_type as string, entity_id as string); }

  query += " ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, due_date ASC";
  res.json(db.prepare(query).all(...params));
});

router.get('/overdue', (_req: Request, res: Response) => {
  const tasks = db.prepare(
    "SELECT * FROM tasks WHERE deleted_at IS NULL AND status IN ('pending', 'in_progress') AND due_date < date('now') ORDER BY due_date ASC"
  ).all();
  res.json(tasks);
});

router.get('/:id', (req: Request, res: Response) => {
  const task = db.prepare("SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL").get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });
  res.json(task);
});

router.post('/', (req: Request, res: Response) => {
  const id = uuidv4();
  const now = new Date().toISOString();
  const { subject, description, task_type, priority, status, due_date,
    due_time, entity_type, entity_id, reminder_at, tags } = req.body;

  db.prepare(`
    INSERT INTO tasks (id, subject, description, task_type, priority, status,
      due_date, due_time, entity_type, entity_id, reminder_at, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, subject, description, task_type || 'other', priority || 'medium',
    status || 'pending', due_date, due_time, entity_type, entity_id, reminder_at,
    JSON.stringify(tags || []), now, now);

  res.status(201).json(db.prepare("SELECT * FROM tasks WHERE id = ?").get(id));
});

router.put('/:id', (req: Request, res: Response) => {
  const now = new Date().toISOString();
  const updates: string[] = [];
  const values: any[] = [];

  if (req.body.status === 'completed') {
    updates.push("completed_at = ?");
    values.push(now);
  }

  Object.entries(req.body).filter(([k]) => k !== 'id' && k !== 'created_at').forEach(([k, v]) => {
    updates.push(`${k} = ?`);
    values.push(v);
  });

  updates.push("updated_at = ?");
  values.push(now, req.params.id);

  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`).run(...values);
  res.json(db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id));
});

router.delete('/:id', (req: Request, res: Response) => {
  db.prepare("UPDATE tasks SET deleted_at = ? WHERE id = ?").run(new Date().toISOString(), req.params.id);
  res.status(204).send();
});

export default router;
