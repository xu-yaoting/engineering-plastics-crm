import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { computeChanges, writeAudit } from '../audit.js';

const router = Router();

const DEVELOPMENT_STAGES = new Set([
  'uncontacted', 'contacted', 'replied', 'qualified', 'converted', 'nurturing', 'stopped',
]);
const ACTIVITY_OUTCOMES = new Set([
  'no_response', 'replied', 'interested', 'no_current_need', 'not_interested',
]);

router.get('/follow-ups', (req: Request, res: Response) => {
  const bucket = typeof req.query.bucket === 'string' ? req.query.bucket : 'all';
  const stage = typeof req.query.stage === 'string' ? req.query.stage : '';
  const ownerUserId = typeof req.query.owner_user_id === 'string' ? req.query.owner_user_id : '';
  const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const allowedBuckets = new Set(['all', 'overdue', 'today', 'upcoming', 'none']);
  if (!allowedBuckets.has(bucket)) {
    return res.status(400).json({ success: false, message: 'Invalid follow-up bucket' });
  }
  if (stage && !DEVELOPMENT_STAGES.has(stage)) {
    return res.status(400).json({ success: false, message: 'Invalid development stage' });
  }

  let query = `
    SELECT
      c.id AS company_id,
      c.name AS company_name,
      c.development_stage,
      c.status AS company_status,
      c.classification,
      c.owner_user_id,
      owner.name AS owner_name,
      contact.id AS contact_id,
      contact.first_name || ' ' || contact.last_name AS contact_name,
      contact.email AS contact_email,
      contact.phone_direct AS contact_phone_direct,
      contact.phone_mobile AS contact_phone_mobile,
      latest.activity_type AS last_activity_type,
      latest.subject AS last_activity_subject,
      latest.outcome AS last_outcome,
      latest.created_at AS last_activity_at,
      next_task.id AS next_follow_up_task_id,
      next_task.subject AS next_follow_up_subject,
      next_task.due_date AS next_follow_up_due_date,
      next_task.due_time AS next_follow_up_due_time,
      next_task.priority AS next_follow_up_priority,
      next_task.contact_id AS next_follow_up_contact_id,
      next_task.assigned_to_user_id AS next_follow_up_assignee_id
    FROM companies c
    LEFT JOIN users owner ON owner.id = c.owner_user_id
    LEFT JOIN contacts contact ON contact.id = (
      SELECT candidate.id
      FROM contacts candidate
      WHERE candidate.company_id = c.id
        AND candidate.deleted_at IS NULL
        AND candidate.is_active = 1
      ORDER BY candidate.is_primary_contact DESC, candidate.created_at ASC
      LIMIT 1
    )
    LEFT JOIN activities latest ON latest.id = (
      SELECT recent.id
      FROM activities recent
      WHERE recent.entity_type = 'company'
        AND recent.entity_id = c.id
        AND recent.deleted_at IS NULL
      ORDER BY recent.created_at DESC, recent.id DESC
      LIMIT 1
    )
    LEFT JOIN tasks next_task ON next_task.id = (
      SELECT pending.id
      FROM tasks pending
      WHERE pending.entity_type = 'company'
        AND pending.entity_id = c.id
        AND pending.task_type = 'follow_up'
        AND pending.status IN ('pending', 'in_progress')
        AND pending.deleted_at IS NULL
      ORDER BY pending.due_date IS NULL, pending.due_date ASC, pending.due_time ASC, pending.created_at ASC
      LIMIT 1
    )
    WHERE c.deleted_at IS NULL`;
  const params: string[] = [];

  if (bucket === 'overdue') query += " AND next_task.due_date < date('now')";
  if (bucket === 'today') query += " AND next_task.due_date = date('now')";
  if (bucket === 'upcoming') query += " AND next_task.due_date > date('now')";
  if (bucket === 'none') query += ' AND next_task.id IS NULL';
  if (stage) {
    query += ' AND c.development_stage = ?';
    params.push(stage);
  }
  if (ownerUserId) {
    query += ' AND c.owner_user_id = ?';
    params.push(ownerUserId);
  }
  if (search) {
    query += ' AND (c.name LIKE ? OR contact.first_name LIKE ? OR contact.last_name LIKE ? OR contact.email LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  query += `
    ORDER BY
      next_task.due_date IS NULL,
      next_task.due_date ASC,
      CASE next_task.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      c.name ASC`;

  res.json(db.prepare(query).all(...params));
});

router.post('/follow-ups', (req: Request, res: Response) => {
  const companyId = typeof req.body.company_id === 'string' ? req.body.company_id.trim() : '';
  const contactId = typeof req.body.contact_id === 'string' && req.body.contact_id.trim()
    ? req.body.contact_id.trim()
    : null;
  const activityType = typeof req.body.activity_type === 'string' ? req.body.activity_type.trim() : '';
  const subject = typeof req.body.subject === 'string' ? req.body.subject.trim() : '';
  const outcome = typeof req.body.outcome === 'string' && req.body.outcome.trim()
    ? req.body.outcome.trim()
    : null;
  const developmentStage = typeof req.body.development_stage === 'string'
    ? req.body.development_stage.trim()
    : '';
  const currentTaskId = typeof req.body.current_task_id === 'string' && req.body.current_task_id.trim()
    ? req.body.current_task_id.trim()
    : null;
  const nextTask = req.body.next_task && typeof req.body.next_task === 'object'
    ? req.body.next_task as Record<string, unknown>
    : null;

  if (!companyId || !activityType || !subject) {
    return res.status(400).json({
      success: false,
      message: 'company_id, activity_type, and subject are required',
    });
  }
  if (outcome && !ACTIVITY_OUTCOMES.has(outcome)) {
    return res.status(400).json({ success: false, message: 'Invalid activity outcome' });
  }
  if (developmentStage && !DEVELOPMENT_STAGES.has(developmentStage)) {
    return res.status(400).json({ success: false, message: 'Invalid development stage' });
  }

  const company = db.prepare(
    'SELECT * FROM companies WHERE id = ? AND deleted_at IS NULL',
  ).get(companyId) as Record<string, unknown> | undefined;
  if (!company) {
    return res.status(400).json({ success: false, message: 'Selected company does not exist' });
  }
  if (contactId) {
    const contact = db.prepare(
      'SELECT id FROM contacts WHERE id = ? AND company_id = ? AND deleted_at IS NULL',
    ).get(contactId, companyId);
    if (!contact) {
      return res.status(400).json({
        success: false,
        message: 'Selected contact does not belong to the company',
      });
    }
  }

  let currentTask: Record<string, unknown> | undefined;
  if (currentTaskId) {
    currentTask = db.prepare(`
      SELECT * FROM tasks
      WHERE id = ?
        AND entity_type = 'company'
        AND entity_id = ?
        AND task_type = 'follow_up'
        AND status IN ('pending', 'in_progress')
        AND deleted_at IS NULL
    `).get(currentTaskId, companyId) as Record<string, unknown> | undefined;
    if (!currentTask) {
      return res.status(400).json({
        success: false,
        message: 'Current follow-up task is not open for this company',
      });
    }
  }

  let nextTaskSubject = '';
  let nextTaskDueDate = '';
  let nextTaskContactId = contactId;
  let nextTaskAssigneeId = req.user!.id;
  if (nextTask) {
    nextTaskSubject = typeof nextTask.subject === 'string' ? nextTask.subject.trim() : '';
    nextTaskDueDate = typeof nextTask.due_date === 'string' ? nextTask.due_date.trim() : '';
    if (!nextTaskSubject || !/^\d{4}-\d{2}-\d{2}$/.test(nextTaskDueDate)) {
      return res.status(400).json({
        success: false,
        message: 'next_task subject and due_date are required',
      });
    }
    if (typeof nextTask.contact_id === 'string' && nextTask.contact_id.trim()) {
      nextTaskContactId = nextTask.contact_id.trim();
      const nextContact = db.prepare(
        'SELECT id FROM contacts WHERE id = ? AND company_id = ? AND deleted_at IS NULL',
      ).get(nextTaskContactId, companyId);
      if (!nextContact) {
        return res.status(400).json({
          success: false,
          message: 'Next-task contact does not belong to the company',
        });
      }
    }
    if (typeof nextTask.assigned_to_user_id === 'string' && nextTask.assigned_to_user_id.trim()) {
      nextTaskAssigneeId = nextTask.assigned_to_user_id.trim();
      const assignee = db.prepare(
        'SELECT id FROM users WHERE id = ? AND is_active = 1',
      ).get(nextTaskAssigneeId);
      if (!assignee) {
        return res.status(400).json({ success: false, message: 'Invalid next-task assignee' });
      }
    }
  }

  const activityId = uuidv4();
  const nextTaskId = nextTask ? uuidv4() : null;
  const now = new Date().toISOString();
  const result = db.transaction(() => {
    db.prepare(`
      INSERT INTO activities (
        id, entity_type, entity_id, activity_type, subject, description,
        direction, outcome, channel, duration_minutes, linked_entity_type, linked_entity_id,
        created_by, updated_by, created_at, updated_at
      ) VALUES (?, 'company', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      activityId, companyId, activityType, subject, req.body.description || null,
      req.body.direction || null, outcome, req.body.channel || null,
      req.body.duration_minutes || null, contactId ? 'contact' : null, contactId,
      req.user!.id, req.user!.id, now, now,
    );
    const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId) as Record<string, unknown>;
    writeAudit(req, 'activity', activityId, 'create', computeChanges(null, activity));

    let completedTask: Record<string, unknown> | null = null;
    if (currentTaskId && currentTask) {
      db.prepare(`
        UPDATE tasks
        SET status = 'completed', completed_at = ?, updated_by = ?, updated_at = ?
        WHERE id = ?
      `).run(now, req.user!.id, now, currentTaskId);
      completedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(currentTaskId) as Record<string, unknown>;
      writeAudit(req, 'task', currentTaskId, 'update', computeChanges(currentTask, completedTask));
    }

    let createdNextTask: Record<string, unknown> | null = null;
    if (nextTask && nextTaskId) {
      db.prepare(`
        INSERT INTO tasks (
          id, subject, description, task_type, priority, status, due_date, due_time,
          entity_type, entity_id, contact_id, reminder_at, tags, assigned_to_user_id,
          created_by, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, 'follow_up', ?, 'pending', ?, ?, 'company', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        nextTaskId, nextTaskSubject, nextTask.description || null, nextTask.priority || 'medium',
        nextTaskDueDate, nextTask.due_time || null, companyId, nextTaskContactId,
        nextTask.reminder_at || null, JSON.stringify(nextTask.tags || []), nextTaskAssigneeId,
        req.user!.id, req.user!.id, now, now,
      );
      createdNextTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(nextTaskId) as Record<string, unknown>;
      writeAudit(req, 'task', nextTaskId, 'create', computeChanges(null, createdNextTask));
    }

    db.prepare(`
      UPDATE companies
      SET last_activity_at = ?,
        development_stage = CASE WHEN ? = '' THEN development_stage ELSE ? END,
        updated_by = ?,
        updated_at = ?
      WHERE id = ?
    `).run(now, developmentStage, developmentStage, req.user!.id, now, companyId);
    const updatedCompany = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as Record<string, unknown>;
    writeAudit(req, 'company', companyId, 'update', computeChanges(company, updatedCompany));

    return {
      activity,
      completed_task: completedTask,
      next_task: createdNextTask,
      company: updatedCompany,
    };
  })();

  res.status(201).json(result);
});

router.get('/', (req: Request, res: Response) => {
  const { entity_type, entity_id, limit: limitParam } = req.query;
  let query = `SELECT a.*, creator.name as created_by_name, updater.name as updated_by_name
    FROM activities a
    LEFT JOIN users creator ON a.created_by = creator.id
    LEFT JOIN users updater ON a.updated_by = updater.id
    WHERE a.deleted_at IS NULL`;
  const params: string[] = [];

  if (entity_type && entity_id) {
    query += " AND a.entity_type = ? AND a.entity_id = ?";
    params.push(entity_type as string, entity_id as string);
  }

  query += " ORDER BY a.created_at DESC";

  const limit = parseInt(limitParam as string) || 50;
  query += " LIMIT ?";
  params.push(String(limit));

  res.json(db.prepare(query).all(...params));
});

router.get('/recent', (_req: Request, res: Response) => {
  const activities = db.prepare(`
    SELECT a.*, c.name as company_name, creator.name as created_by_name
    FROM activities a
    LEFT JOIN companies c ON (a.entity_type = 'company' AND a.entity_id = c.id)
    LEFT JOIN users creator ON a.created_by = creator.id
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

  db.transaction(() => {
    db.prepare(`
      INSERT INTO activities (id, entity_type, entity_id, activity_type, subject, description,
        direction, channel, duration_minutes, linked_entity_type, linked_entity_id,
        created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, entity_type, entity_id, activity_type, subject, description,
      direction, channel, duration_minutes, linked_entity_type, linked_entity_id,
      req.user!.id, req.user!.id, now, now);

    if (entity_type === 'company') {
      db.prepare("UPDATE companies SET last_activity_at = ?, updated_by = ? WHERE id = ?")
        .run(now, req.user!.id, entity_id);
    }
    writeAudit(req, 'activity', id, 'create', computeChanges(null, {
      entity_type, entity_id, activity_type, subject,
    }));
  })();

  res.status(201).json(db.prepare("SELECT * FROM activities WHERE id = ?").get(id));
});

router.delete('/:id', (req: Request, res: Response) => {
  const activity = db.prepare("SELECT * FROM activities WHERE id = ? AND deleted_at IS NULL").get(req.params.id) as Record<string, unknown> | undefined;
  if (!activity) return res.status(404).json({ error: 'Not found' });
  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare("UPDATE activities SET deleted_at = ?, updated_by = ? WHERE id = ?")
      .run(now, req.user!.id, req.params.id);
    writeAudit(req, 'activity', req.params.id, 'delete', computeChanges(activity, { ...activity, deleted_at: now }));
  })();
  res.status(204).send();
});

export default router;
