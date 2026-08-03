import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

type Actor = { id: string; name: string; role: string };
type PermissionPort = {
  getMaterialsPermission(actor: Actor): { manageMaterials: boolean; viewPrices: boolean };
};
export type AttachmentOptions = {
  storageRoot?: string;
  tokenSecret?: string;
  now?: () => Date;
};
type UploadFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};
type UploadInput = {
  category: unknown;
  notes?: unknown;
  isSensitive?: unknown;
};
type AttachmentRow = {
  id: string;
  document_id: string;
  category: string;
  original_name: string;
  stored_name: string;
  mime_type: string;
  size_bytes: number;
  is_sensitive: number;
  uploaded_by: string;
  uploaded_at: string;
  notes: string | null;
  deleted_at: string | null;
};
export type MaterialsAttachmentService = {
  list(actor: Actor, documentId: string): Array<Record<string, unknown>>;
  upload(actor: Actor, documentId: string, file: UploadFile | undefined, input: UploadInput): Record<string, unknown>;
  sign(actor: Actor, attachmentId: string): { url: string; expiresAt: string };
  download(actor: Actor, attachmentId: string, token?: string): AttachmentRow & { absolutePath: string };
};

const SENSITIVE_CATEGORIES = new Set(['quotation', 'contract', 'invoice']);
const PROCUREMENT_SENSITIVE_CATEGORIES = new Set([
  'signed_copy', 'delivery_note', 'acceptance_record',
]);
const CATEGORIES = new Set([
  'quotation', 'contract', 'invoice', 'delivery_note', 'acceptance_record',
  'signed_copy', 'tooling_photo', 'drawing', 'other',
]);
const FILE_TYPES: Record<string, readonly string[]> = {
  '.pdf': ['application/pdf'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};

export class MaterialsAttachmentError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 403 | 404 | 409 | 413 | 503 = 400,
    readonly code = 'MATERIALS_ATTACHMENT_INVALID',
  ) {
    super(message);
    this.name = 'MaterialsAttachmentError';
  }
}

function safeRoot(configured: string): string {
  const root = path.resolve(configured);
  const cwd = process.cwd();
  for (const forbidden of [path.resolve(cwd, 'public'), path.resolve(cwd, 'dist')]) {
    if (root === forbidden || root.startsWith(`${forbidden}${path.sep}`)) {
      throw new MaterialsAttachmentError('Attachment storage must be private', 409);
    }
  }
  return root;
}

function serialize(row: AttachmentRow): Record<string, unknown> {
  return {
    id: row.id,
    document_id: row.document_id,
    category: row.category,
    original_name: row.original_name,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    is_sensitive: Boolean(row.is_sensitive),
    uploaded_by: row.uploaded_by,
    uploaded_at: row.uploaded_at,
    notes: row.notes,
  };
}

export function createMaterialsAttachmentService(
  database: Database.Database,
  permissions: PermissionPort,
  options: AttachmentOptions = {},
): MaterialsAttachmentService {
  const storageRoot = safeRoot(
    options.storageRoot ?? path.resolve(process.cwd(), 'data/materials-tooling/attachments'),
  );
  const now = options.now ?? (() => new Date());
  const tokenSecret = options.tokenSecret ?? process.env.JWT_SECRET;

  function requireDocument(documentId: string): Record<string, unknown> {
    const document = database.prepare('SELECT * FROM mt_documents WHERE id = ?').get(documentId) as Record<string, unknown> | undefined;
    if (!document) throw new MaterialsAttachmentError('Document not found', 404);
    return document;
  }

  function requireAttachment(id: string): AttachmentRow {
    const row = database.prepare(`
      SELECT * FROM mt_attachments WHERE id = ? AND deleted_at IS NULL
    `).get(id) as AttachmentRow | undefined;
    if (!row) throw new MaterialsAttachmentError('Attachment not found', 404);
    return row;
  }

  function mayView(actor: Actor, row: AttachmentRow): void {
    if (row.is_sensitive && !permissions.getMaterialsPermission(actor).viewPrices) {
      throw new MaterialsAttachmentError('Price access is required', 403, 'MATERIALS_ATTACHMENT_FORBIDDEN');
    }
  }

  function audit(actor: Actor, entityId: string, action: string, changes: Record<string, unknown>): void {
    database.prepare(`
      INSERT INTO audit_log
        (id, entity_type, entity_id, user_id, user_name, action, changes, created_at)
      VALUES (?, 'mt_attachment', ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), entityId, actor.id, actor.name, action, JSON.stringify(changes), now().toISOString());
  }

  function list(actor: Actor, documentId: string): Array<Record<string, unknown>> {
    requireDocument(documentId);
    const canViewPrices = permissions.getMaterialsPermission(actor).viewPrices;
    const rows = database.prepare(`
      SELECT * FROM mt_attachments
      WHERE document_id = ? AND deleted_at IS NULL
        AND (? = 1 OR is_sensitive = 0)
      ORDER BY uploaded_at, id
    `).all(documentId, canViewPrices ? 1 : 0) as AttachmentRow[];
    return rows.map(serialize);
  }

  function upload(actor: Actor, documentId: string, file: UploadFile | undefined, input: UploadInput): Record<string, unknown> {
    const actorPermission = permissions.getMaterialsPermission(actor);
    if (actor.role !== 'admin' && !actorPermission.manageMaterials) {
      throw new MaterialsAttachmentError('Material management permission is required', 403, 'MATERIALS_ATTACHMENT_FORBIDDEN');
    }
    const document = requireDocument(documentId);
    if (document.status === 'voided') throw new MaterialsAttachmentError('Voided documents cannot accept uploads', 409);
    if (!file) throw new MaterialsAttachmentError('file is required');
    if (file.size > MAX_ATTACHMENT_BYTES) throw new MaterialsAttachmentError('Attachment is too large', 413);
    if (
      !file.originalname
      || file.originalname.includes('..')
      || file.originalname.includes('/')
      || file.originalname.includes('\\')
      || file.originalname.includes('\0')
    ) throw new MaterialsAttachmentError('Attachment filename is invalid');
    const extension = path.extname(file.originalname).toLowerCase();
    if (!FILE_TYPES[extension]?.includes(file.mimetype)) {
      throw new MaterialsAttachmentError('Attachment extension and MIME type are not allowed');
    }
    if (typeof input.category !== 'string' || !CATEGORIES.has(input.category)) {
      throw new MaterialsAttachmentError('Attachment category is invalid');
    }
    if (input.notes !== undefined && typeof input.notes !== 'string') {
      throw new MaterialsAttachmentError('Attachment notes must be a string');
    }
    if (input.isSensitive !== undefined && input.isSensitive !== 'true' && input.isSensitive !== 'false') {
      throw new MaterialsAttachmentError('is_sensitive must be true or false');
    }
    const procurementSensitive = PROCUREMENT_SENSITIVE_CATEGORIES.has(input.category)
      && ['purchase_request', 'purchase_receipt'].includes(String(document.document_type));
    const sensitive = SENSITIVE_CATEGORIES.has(input.category)
      || procurementSensitive
      || input.isSensitive === 'true';
    if (sensitive && !actorPermission.viewPrices) {
      throw new MaterialsAttachmentError('Price access is required', 403, 'MATERIALS_ATTACHMENT_FORBIDDEN');
    }
    const id = randomUUID();
    const storedName = `${randomUUID()}${extension}`;
    const temporaryPath = path.join(storageRoot, `.${randomUUID()}.tmp`);
    const finalPath = path.join(storageRoot, storedName);
    if (!finalPath.startsWith(`${storageRoot}${path.sep}`)) {
      throw new MaterialsAttachmentError('Attachment path is invalid', 409);
    }
    try {
      mkdirSync(storageRoot, { recursive: true });
      writeFileSync(temporaryPath, file.buffer, { flag: 'wx' });
      renameSync(temporaryPath, finalPath);
      const uploadedAt = now().toISOString();
      const row = database.transaction(() => {
        const currentDocument = requireDocument(documentId);
        if (currentDocument.status === 'voided') {
          throw new MaterialsAttachmentError('Voided documents cannot accept uploads', 409);
        }
        const currentSensitive = SENSITIVE_CATEGORIES.has(input.category as string)
          || (
            PROCUREMENT_SENSITIVE_CATEGORIES.has(input.category as string)
            && ['purchase_request', 'purchase_receipt'].includes(String(currentDocument.document_type))
          )
          || input.isSensitive === 'true';
        if (currentSensitive && !permissions.getMaterialsPermission(actor).viewPrices) {
          throw new MaterialsAttachmentError('Price access is required', 403, 'MATERIALS_ATTACHMENT_FORBIDDEN');
        }
        if (
          input.category === 'signed_copy'
          && !['executed', 'awaiting_signed_copy'].includes(String(currentDocument.status))
        ) {
          throw new MaterialsAttachmentError('Document is not awaiting a signed copy', 409);
        }
        database.prepare(`
          INSERT INTO mt_attachments (
            id, document_id, category, original_name, stored_name, mime_type, size_bytes,
            is_sensitive, uploaded_by, uploaded_at, tooling_asset_id, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
        `).run(
          id, documentId, input.category, file.originalname, storedName, file.mimetype,
          file.size, currentSensitive ? 1 : 0, actor.id, uploadedAt,
          typeof input.notes === 'string' ? input.notes.trim() || null : null,
        );
        audit(actor, id, 'upload_attachment', {
          attachmentId: id, documentId, category: input.category, sensitive: currentSensitive,
        });
        if (input.category === 'signed_copy') {
          const changed = database.prepare(`
            UPDATE mt_documents
            SET status = 'completed', updated_by = ?, updated_at = ?
            WHERE id = ? AND status IN ('executed', 'awaiting_signed_copy')
          `).run(actor.id, uploadedAt, documentId);
          if (changed.changes !== 1) throw new MaterialsAttachmentError('Document status changed', 409);
          database.prepare(`
            INSERT INTO audit_log
              (id, entity_type, entity_id, user_id, user_name, action, changes, created_at)
            VALUES (?, 'mt_document', ?, ?, ?, 'signed_copy_complete', ?, ?)
          `).run(
            randomUUID(), documentId, actor.id, actor.name,
            JSON.stringify({ status: { old: currentDocument.status, new: 'completed' }, attachmentRecorded: true }),
            uploadedAt,
          );
        }
        return requireAttachment(id);
      }).immediate();
      return serialize(row);
    } catch (error) {
      if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
      if (existsSync(finalPath)) unlinkSync(finalPath);
      throw error;
    }
  }

  function sign(actor: Actor, attachmentId: string): { url: string; expiresAt: string } {
    if (!tokenSecret) {
      throw new MaterialsAttachmentError('Signed attachment links are not configured', 503, 'MATERIALS_ATTACHMENT_UNAVAILABLE');
    }
    const row = requireAttachment(attachmentId);
    mayView(actor, row);
    const expires = Math.floor(now().getTime() / 1000) + 60;
    const payload = Buffer.from(JSON.stringify({ id: attachmentId, uid: actor.id, exp: expires, nonce: randomUUID() })).toString('base64url');
    const signature = createHmac('sha256', tokenSecret).update(payload).digest('base64url');
    const token = `${payload}.${signature}`;
    return {
      url: `/api/materials-tooling/attachments/${encodeURIComponent(attachmentId)}/download?token=${encodeURIComponent(token)}`,
      expiresAt: new Date(expires * 1000).toISOString(),
    };
  }

  function verifyToken(actor: Actor, attachmentId: string, token: string): void {
    if (!tokenSecret) throw new MaterialsAttachmentError('Signed attachment links are not configured', 503);
    const [payload, suppliedSignature, extra] = token.split('.');
    if (!payload || !suppliedSignature || extra) throw new MaterialsAttachmentError('Signed link is invalid', 403);
    const expected = createHmac('sha256', tokenSecret).update(payload).digest();
    let supplied: Buffer;
    try { supplied = Buffer.from(suppliedSignature, 'base64url'); } catch { throw new MaterialsAttachmentError('Signed link is invalid', 403); }
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      throw new MaterialsAttachmentError('Signed link is invalid', 403);
    }
    let value: unknown;
    try { value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { throw new MaterialsAttachmentError('Signed link is invalid', 403); }
    if (!value || typeof value !== 'object') throw new MaterialsAttachmentError('Signed link is invalid', 403);
    const claims = value as { id?: unknown; uid?: unknown; exp?: unknown };
    if (
      claims.id !== attachmentId || claims.uid !== actor.id || typeof claims.exp !== 'number'
      || claims.exp <= Math.floor(now().getTime() / 1000)
    ) throw new MaterialsAttachmentError('Signed link is invalid or expired', 403);
  }

  function download(actor: Actor, attachmentId: string, token?: string): AttachmentRow & { absolutePath: string } {
    const row = requireAttachment(attachmentId);
    if (token) verifyToken(actor, attachmentId, token);
    mayView(actor, row);
    const absolutePath = path.resolve(storageRoot, row.stored_name);
    if (!absolutePath.startsWith(`${storageRoot}${path.sep}`) || !existsSync(absolutePath)) {
      throw new MaterialsAttachmentError('Attachment file is unavailable', 404);
    }
    audit(actor, attachmentId, 'download_attachment', {
      attachmentId, documentId: row.document_id, sensitive: Boolean(row.is_sensitive),
    });
    return { ...row, absolutePath };
  }

  return { list, upload, sign, download };
}
