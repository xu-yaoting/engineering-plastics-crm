import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import db from './db.js';

export type AuditChanges = Record<string, unknown>;

type AuditRecord = Record<string, unknown> | null | undefined;

const IGNORED_AUDIT_FIELDS = new Set([
  'updated_at', 'created_at', 'deleted_at', 'created_by', 'updated_by',
  'token', 'pin_hash', 'pin_salt',
]);

export function computeChanges(before: AuditRecord, after: AuditRecord): AuditChanges {
  const beforeRecord = before ?? {};
  const afterRecord = after ?? {};
  const fields = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]);
  const changes: AuditChanges = {};

  for (const field of fields) {
    if (IGNORED_AUDIT_FIELDS.has(field)) continue;
    if (JSON.stringify(beforeRecord[field]) === JSON.stringify(afterRecord[field])) continue;
    changes[field] = { old: beforeRecord[field] ?? null, new: afterRecord[field] ?? null };
  }

  return changes;
}

export function writeAudit(
  req: Request,
  entityType: string,
  entityId: string,
  action: string,
  changes: AuditChanges = {},
): void {
  if (!req.user) {
    throw new Error('Authenticated user is required for audit logging');
  }

  db.prepare(`
    INSERT INTO audit_log (id, entity_type, entity_id, user_id, user_name, action, changes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    entityType,
    entityId,
    req.user.id,
    req.user.name,
    action,
    JSON.stringify(changes),
    new Date().toISOString(),
  );
}

export const auditRouter = Router();

auditRouter.get('/', (req: Request, res: Response) => {
  const entityType = typeof req.query.entity_type === 'string' ? req.query.entity_type.trim() : '';
  const entityId = typeof req.query.entity_id === 'string' ? req.query.entity_id.trim() : '';
  const requestedLimit = Number(req.query.limit ?? 100);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 200) : 100;

  if (!entityType || !entityId) {
    return res.status(400).json({ error: 'entity_type and entity_id are required' });
  }

  const rows = db.prepare(`
    SELECT id, entity_type, entity_id, user_id, user_name, action, changes, created_at
    FROM audit_log
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(entityType, entityId, limit) as Array<Record<string, unknown> & { changes: string }>;

  res.json(rows.map(row => ({
    ...row,
    changes: (() => {
      try { return JSON.parse(row.changes || '{}'); } catch { return {}; }
    })(),
  })));
});
