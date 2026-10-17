import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { computeChanges, writeAudit } from '../audit.js';

const router = Router();

const TASK_UPDATE_FIELDS = [
  'subject',
  'description',
  'task_type',
  'priority',
  'status',
  'due_date',
  'due_time',
  'is_recurring',
  'recurring_rule',
  'entity_type',
  'entity_id',
  'reminder_at',
  'reminder_sent',
  'tags',
  'assigned_to_user_id',
] as const;

const TASK_SELECT = `
  SELECT t.*, assignee.name as assignee_name,
    creator.name as created_by_name, updater.name as updated_by_name
  FROM tasks t
  LEFT JOIN users assignee ON t.assigned_to_user_id = assignee.id
  LEFT JOIN users creator ON t.created_by = creator.id
  LEFT JOIN users updater ON t.updated_by = updater.id`;

router.get('/', (req: Request, res: Response) => {
  const { status, entity_type, entity_id } = req.query;
  let query = `${TASK_SELECT} WHERE t.deleted_at IS NULL`;
  const params: string[] = [];

  if (status) { query += " AND t.status = ?"; params.push(status as string); }
  if (entity_type && entity_id) { query += " AND t.entity_type = ? AND t.entity_id = ?"; params.push(entity_type as string, entity_id as string); }

  query += " ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.due_date ASC";
  res.json(db.prepare(query).all(...params));
});

router.get('/overdue', (_req: Request, res: Response) => {
  const tasks = db.prepare(
    `${TASK_SELECT} WHERE t.deleted_at IS NULL AND t.status IN ('pending', 'in_progress') AND t.due_date < date('now') ORDER BY t.due_date ASC`
  ).all();
  res.json(tasks);
});

router.get('/:id', (req: Request, res: Response) => {
  const task = db.prepare(`${TASK_SELECT} WHERE t.id = ? AND t.deleted_at IS NULL`).get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });
  res.json(task);
});

router.post('/', (req: Request, res: Response) => {
  const id = uuidv4();
  const now = new Date().toISOString();
  const { subject, description, task_type, priority, status, due_date,
    due_time, entity_type, entity_id, reminder_at, tags, assigned_to_user_id } = req.body;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO tasks (id, subject, description, task_type, priority, status,
        due_date, due_time, entity_type, entity_id, reminder_at, tags,
        assigned_to_user_id, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, subject, description, task_type || 'other', priority || 'medium',
      status || 'pending', due_date, due_time, entity_type, entity_id, reminder_at,
      JSON.stringify(tags || []), assigned_to_user_id || req.user!.id,
      req.user!.id, req.user!.id, now, now);
    writeAudit(req, 'task', id, 'create', computeChanges(null, {
      subject, status: status || 'pending', assigned_to_user_id: assigned_to_user_id || req.user!.id,
    }));
  })();

  res.status(201).json(db.prepare(`${TASK_SELECT} WHERE t.id = ?`).get(id));
});

router.put('/:id', (req: Request, res: Response) => {
  const now = new Date().toISOString();
  const before = db.prepare("SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL").get(req.params.id) as Record<string, unknown> | undefined;
  if (!before) return res.status(404).json({ success: false, message: 'Record not found' });
  const updates: string[] = [];
  const values: any[] = [];

  if (req.body.status === 'completed') {
    updates.push("completed_at = ?");
    values.push(now);
  } else if (Object.prototype.hasOwnProperty.call(req.body, 'status')) {
    updates.push('completed_at = ?');
    values.push(null);
  }

  const updateFields = TASK_UPDATE_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(req.body, field)
  );
  if (updateFields.length === 0) {
    return res.status(400).json({ success: false, message: 'No valid fields to update' });
  }

  updateFields.forEach((field) => {
    updates.push(`${field} = ?`);
    values.push(req.body[field]);
  });

  updates.push("updated_by = ?", "updated_at = ?");
  values.push(req.user!.id, now, req.params.id);

  const updated = db.transaction(() => {
    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`).run(...values);
    const after = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id) as Record<string, unknown>;
    writeAudit(req, 'task', req.params.id, 'update', computeChanges(before, after));
    return db.prepare(`${TASK_SELECT} WHERE t.id = ?`).get(req.params.id);
  })();
  res.json(updated);
});

router.delete('/:id', (req: Request, res: Response) => {
  const task = db.prepare("SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL").get(req.params.id) as Record<string, unknown> | undefined;
  if (!task) return res.status(404).json({ error: 'Not found' });
  db.transaction(() => {
    db.prepare("UPDATE tasks SET deleted_at = ?, updated_by = ? WHERE id = ?")
      .run(new Date().toISOString(), req.user!.id, req.params.id);
    writeAudit(req, 'task', req.params.id, 'delete', computeChanges(task, { ...task, deleted_at: new Date().toISOString() }));
  })();
  res.status(204).send();
});

export default router;
