import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { Router, type ErrorRequestHandler, type Request, type Response } from 'express';
import multer from 'multer';
import {
  createMaterialsPermissionService,
  type MaterialDocumentType,
  MaterialsAuthorizationError,
  MaterialsConfigurationError,
  MaterialsValidationError,
} from '../materials-tooling/permissions.js';
import {
  createMaterialsDocumentService,
  MaterialsDocumentError,
} from '../materials-tooling/documents.js';
import { createMaterialsMovementService } from '../materials-tooling/movements.js';
import {
  createMaterialsAttachmentService,
  MAX_ATTACHMENT_BYTES,
  MaterialsAttachmentError,
  type AttachmentOptions,
} from '../materials-tooling/attachments.js';
import {
  createMaterialsPdfService,
  MaterialsPdfError,
  type MaterialPdfOptions,
} from '../materials-tooling/pdf.js';
import {
  createMaterialsReportingService,
  MaterialsReportingError,
} from '../materials-tooling/reporting.js';
import {
  createMaterialsToolingService,
  MaterialsToolingError,
} from '../materials-tooling/tooling.js';
import {
  createMaterialsImportService,
  MaterialsImportError,
} from '../materials-tooling/import.js';

type RouteHandler = (req: Request, res: Response) => void;
type RecordValue = Record<string, unknown>;

const ITEM_CREATE_FIELDS = new Set([
  'code', 'name', 'category', 'specification', 'unit', 'warehouse', 'bin_location',
  'safety_quantity', 'notes', 'is_active',
]);
const ITEM_UPDATE_FIELDS = new Set([
  'name', 'category', 'specification', 'unit', 'warehouse', 'bin_location',
  'safety_quantity', 'notes', 'is_active',
]);
const SUPPLIER_CREATE_FIELDS = new Set([
  'code', 'name', 'contact_name', 'phone', 'notes', 'is_active',
]);
const SUPPLIER_UPDATE_FIELDS = new Set([
  'name', 'contact_name', 'phone', 'notes', 'is_active',
]);
const AUDIT_IGNORED_FIELDS = new Set(['created_at', 'updated_at', 'created_by', 'updated_by']);

class MaterialsNotFoundError extends Error {}
class MaterialsConflictError extends Error {}

function isPlainObject(value: unknown): value is RecordValue {
  return value !== null
    && typeof value === 'object'
    && Object.getPrototypeOf(value) === Object.prototype;
}

function safeRoute(handler: RouteHandler): RouteHandler {
  return (req, res): void => {
    try {
      handler(req, res);
    } catch (error) {
      if (error instanceof MaterialsValidationError) {
        res.status(400).json({ error: error.code, message: error.message });
        return;
      }
      if (error instanceof MaterialsAuthorizationError) {
        res.status(403).json({ error: error.code, message: error.message });
        return;
      }
      if (error instanceof MaterialsDocumentError) {
        res.status(error.statusCode).json({ error: error.code, message: error.message });
        return;
      }
      if (error instanceof MaterialsAttachmentError) {
        res.status(error.statusCode).json({ error: error.code, message: error.message });
        return;
      }
      if (error instanceof MaterialsReportingError) {
        res.status(error.statusCode).json({ error: error.code, message: error.message });
        return;
      }
      if (error instanceof MaterialsImportError) {
        res.status(error.statusCode).json({ error: error.code, message: error.message });
        return;
      }
      if (error instanceof MaterialsToolingError) {
        res.status(error.statusCode).json({ error: error.code, message: error.message });
        return;
      }
      if (error instanceof MaterialsNotFoundError) {
        res.status(404).json({ error: 'MATERIALS_NOT_FOUND', message: error.message });
        return;
      }
      if (error instanceof MaterialsConfigurationError || error instanceof MaterialsConflictError) {
        res.status(409).json({
          error: error instanceof MaterialsConfigurationError ? error.code : 'MATERIALS_CONFLICT',
          message: error.message,
        });
        return;
      }
      if (
        error !== null
        && typeof error === 'object'
        && 'code' in error
        && (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY')
      ) {
        res.status(409).json({ error: 'MATERIALS_CONFLICT', message: 'Code already exists' });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

function safePdfRoute(handler: (req: Request, res: Response) => Promise<void>): RouteHandler {
  return (req, res): void => {
    handler(req, res).catch((error: unknown) => {
      if (error instanceof MaterialsPdfError) {
        res.status(error.statusCode).json({ error: error.code, message: error.message });
        return;
      }
      if (error instanceof MaterialsReportingError) {
        res.status(error.statusCode).json({ error: error.code, message: error.message });
        return;
      }
      res.status(500).json({ error: 'MATERIALS_PDF_ERROR', message: 'PDF generation failed' });
    });
  };
}

export const materialsJsonParseErrorHandler: ErrorRequestHandler = (error, _req, res, next): void => {
  if (
    error !== null
    && typeof error === 'object'
    && 'type' in error
    && error.type === 'entity.parse.failed'
  ) {
    res.status(400).json({
      error: 'MATERIALS_VALIDATION_ERROR',
      message: 'Malformed JSON body',
    });
    return;
  }
  next(error);
};

function parseBody(value: unknown, allowedFields: Set<string>, label: string): RecordValue {
  if (!isPlainObject(value)) throw new MaterialsValidationError(`${label} must be a plain object`);
  const keys = Reflect.ownKeys(value);
  if (
    keys.length === 0
    || keys.some((key) => typeof key !== 'string' || !allowedFields.has(key))
  ) {
    throw new MaterialsValidationError(`${label} contains unsupported fields`);
  }
  return value;
}

function requiredString(body: RecordValue, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MaterialsValidationError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(body: RecordValue, field: string): string | null | undefined {
  if (!(field in body)) return undefined;
  const value = body[field];
  if (typeof value !== 'string') throw new MaterialsValidationError(`${field} must be a string`);
  return value.trim() || null;
}

function optionalBoolean(body: RecordValue, field: string): boolean | undefined {
  if (!(field in body)) return undefined;
  if (typeof body[field] !== 'boolean') {
    throw new MaterialsValidationError(`${field} must be a boolean`);
  }
  return body[field];
}

function safetyQuantity(body: RecordValue, required: boolean): number | undefined {
  if (!('safety_quantity' in body)) {
    if (required) throw new MaterialsValidationError('safety_quantity must be a finite non-negative number');
    return undefined;
  }
  const value = body.safety_quantity;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new MaterialsValidationError('safety_quantity must be a finite non-negative number');
  }
  return value;
}

function computeChanges(before: RecordValue | undefined, after: RecordValue): RecordValue {
  const changes: RecordValue = {};
  const fields = new Set([...Object.keys(before ?? {}), ...Object.keys(after)]);
  for (const field of fields) {
    if (AUDIT_IGNORED_FIELDS.has(field)) continue;
    const rawOldValue = before?.[field] ?? null;
    const rawNewValue = after[field] ?? null;
    const oldValue = field === 'is_active' && rawOldValue !== null ? Boolean(rawOldValue) : rawOldValue;
    const newValue = field === 'is_active' && rawNewValue !== null ? Boolean(rawNewValue) : rawNewValue;
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes[field] = { old: oldValue, new: newValue };
    }
  }
  return changes;
}

function writeMaterialsAudit(
  database: Database.Database,
  req: Request,
  entityType: 'mt_item' | 'mt_supplier',
  entityId: string,
  action: 'create' | 'update',
  before: RecordValue | undefined,
  after: RecordValue,
): void {
  if (!req.user) throw new MaterialsAuthorizationError('Authenticated user is required');
  database.prepare(`
    INSERT INTO audit_log (id, entity_type, entity_id, user_id, user_name, action, changes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(), entityType, entityId, req.user.id, req.user.name, action,
    JSON.stringify(computeChanges(before, after)), new Date().toISOString(),
  );
}

function serializeRow(row: RecordValue): RecordValue {
  return { ...row, is_active: Boolean(row.is_active) };
}

function parseApproverBody(value: unknown): string {
  if (!isPlainObject(value)) {
    throw new MaterialsValidationError('Approval configuration must be a plain object');
  }
  const keys = Reflect.ownKeys(value);
  const approverUserId = value.approverUserId;
  if (
    keys.length !== 1
    || keys[0] !== 'approverUserId'
    || typeof approverUserId !== 'string'
    || approverUserId.trim().length === 0
  ) {
    throw new MaterialsValidationError(
      'Approval configuration must contain exactly one non-empty approverUserId string',
    );
  }
  return approverUserId.trim();
}

export function createMaterialsToolingRouter(
  database: Database.Database,
  options: { attachments?: AttachmentOptions; pdfs?: MaterialPdfOptions } = {},
): Router {
  const router = Router();
  const permissions = createMaterialsPermissionService(database);
  const requireEnter = permissions.requireMaterialsPermission('enter');
  const requireManage = permissions.requireMaterialsPermission('manageMaterials');
  const documents = createMaterialsDocumentService(database, permissions);
  const movements = createMaterialsMovementService(database, permissions);
  const attachments = createMaterialsAttachmentService(database, permissions, options.attachments);
  const pdfs = createMaterialsPdfService(database, permissions, options.pdfs);
  const reporting = createMaterialsReportingService(database, permissions);
  const tooling = createMaterialsToolingService(database, permissions);
  const importService = createMaterialsImportService(database, permissions);
  const attachmentUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 },
  });

  router.get('/me', requireEnter, safeRoute((req, res) => {
    res.json({ permissions: permissions.getMaterialsPermission(req.user!) });
  }));

  router.get('/overview', requireEnter, safeRoute((req, res) => {
    res.json({ overview: reporting.getOverview(req.user!) });
  }));

  router.get('/tooling', requireEnter, safeRoute((req, res) => {
    res.json({ tooling: tooling.list(req.user!) });
  }));

  router.get('/tooling/:id', requireEnter, safeRoute((req, res) => {
    res.json({ tooling: tooling.get(req.user!, req.params.id) });
  }));

  router.post('/tooling', requireManage, safeRoute((req, res) => {
    res.status(201).json({ tooling: tooling.create(req.user!, req.body) });
  }));

  router.put('/tooling/:id', requireManage, safeRoute((req, res) => {
    res.json({ tooling: tooling.update(req.user!, req.params.id, req.body) });
  }));

  router.post('/tooling/:id/movements', requireEnter, safeRoute((req, res) => {
    const movement = parseBody(req.body, new Set(['document_id']), 'Tooling movement');
    const documentId = requiredString(movement, 'document_id');
    const current = database.prepare(`
      SELECT request_date, execution_date FROM mt_documents WHERE id = ?
    `).get(documentId) as { request_date: string; execution_date: string | null } | undefined;
    if (current) reporting.assertPeriodOpen(current.execution_date ?? current.request_date);
    res.json({
      tooling: tooling.execute(req.user!, documentId, req.params.id),
    });
  }));

  router.get('/ledger', requireEnter, safeRoute((req, res) => {
    res.json({ ledger: reporting.getLedger(req.user!, {
      month: req.query.month,
      search: req.query.search,
      category: req.query.category,
    }) });
  }));

  router.get('/ledger.xlsx', requireEnter, safeRoute((req, res) => {
    const exported = reporting.exportLedgerXlsx(req.user!, req.query.month);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${exported.filename}"`,
      'Content-Length': String(exported.buffer.length),
    });
    res.send(exported.buffer);
  }));

  router.get('/ledger.pdf', requireEnter, safePdfRoute(async (req, res) => {
    const exported = await reporting.exportLedgerPdf(req.user!, req.query.month);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${exported.filename}"`,
      'Content-Length': String(exported.buffer.length),
    });
    res.send(exported.buffer);
  }));

  router.get('/price-history/:itemId', requireEnter, safeRoute((req, res) => {
    res.json({ priceHistory: reporting.getPriceHistory(req.user!, req.params.itemId) });
  }));

  router.post('/periods/:month/close', requireEnter, safeRoute((req, res) => {
    res.json({ period: reporting.closePeriod(req.user!, req.params.month) });
  }));

  router.post('/periods/:month/reopen', requireEnter, safeRoute((req, res) => {
    res.json({ period: reporting.reopenPeriod(req.user!, req.params.month, req.body) });
  }));

  router.get('/items', requireEnter, safeRoute((req, res) => {
    const canViewPrices = permissions.getMaterialsPermission(req.user!).viewPrices;
    const rows = database.prepare(`
      SELECT item.*, COALESCE(SUM(movement.quantity_delta), 0) AS current_quantity
      FROM mt_items item
      LEFT JOIN mt_movements movement ON movement.item_id = item.id
      GROUP BY item.id
      ORDER BY item.code COLLATE NOCASE, item.id
    `).all() as RecordValue[];

    const priceStatement = canViewPrices ? database.prepare(`
      SELECT unit_price, purchase_date, supplier_id, supplier_name, price_type
      FROM (
        SELECT movement.reference_unit_price AS unit_price,
          movement.movement_date AS purchase_date, supplier.id AS supplier_id,
          supplier.name AS supplier_name, 'reference' AS price_type,
          movement.created_at AS recorded_at
        FROM mt_movements movement
        JOIN mt_suppliers supplier ON supplier.id = movement.supplier_id
        WHERE movement.item_id = ? AND movement.movement_type = 'reference_purchase'
        UNION ALL
        SELECT line.tax_inclusive_unit_price AS unit_price,
          movement.movement_date AS purchase_date, supplier.id AS supplier_id,
          supplier.name AS supplier_name, 'actual' AS price_type,
          movement.created_at AS recorded_at
        FROM mt_movements movement
        JOIN mt_document_lines line ON line.id = movement.document_line_id
        JOIN mt_documents document ON document.id = movement.document_id
        JOIN mt_suppliers supplier ON supplier.id = document.supplier_id
        WHERE movement.item_id = ? AND movement.movement_type = 'purchase_receipt'
          AND line.tax_inclusive_unit_price IS NOT NULL
          AND document.status <> 'voided'
      ) prices
      ORDER BY purchase_date DESC, recorded_at DESC
      LIMIT 1
    `) : null;

    res.json({
      items: rows.map((row) => {
        const item = serializeRow(row);
        if (!priceStatement) return item;
        const price = priceStatement.get(row.id, row.id) as undefined | {
          unit_price: number; purchase_date: string; supplier_id: string;
          supplier_name: string; price_type: string;
        };
        return {
          ...item,
          purchaseSummary: price ? {
            unitPrice: price.unit_price,
            purchaseDate: price.purchase_date,
            supplierId: price.supplier_id,
            supplierName: price.supplier_name,
            priceType: price.price_type,
          } : null,
        };
      }),
    });
  }));

  router.post('/items', requireManage, safeRoute((req, res) => {
    const body = parseBody(req.body, ITEM_CREATE_FIELDS, 'Item');
    const code = requiredString(body, 'code').toUpperCase();
    const name = requiredString(body, 'name');
    const category = requiredString(body, 'category');
    const unit = requiredString(body, 'unit');
    const safety = safetyQuantity(body, false) ?? 0;
    const isActive = optionalBoolean(body, 'is_active') ?? true;
    const id = randomUUID();
    const now = new Date().toISOString();
    const created = database.transaction(() => {
      database.prepare(`
        INSERT INTO mt_items (
          id, code, name, category, specification, unit, warehouse, bin_location,
          safety_quantity, is_active, notes, created_by, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, code, name, category, optionalString(body, 'specification'), unit,
        optionalString(body, 'warehouse'), optionalString(body, 'bin_location'), safety,
        isActive ? 1 : 0, optionalString(body, 'notes'), req.user!.id, req.user!.id, now, now,
      );
      const row = database.prepare('SELECT * FROM mt_items WHERE id = ?').get(id) as RecordValue;
      writeMaterialsAudit(database, req, 'mt_item', id, 'create', undefined, row);
      return serializeRow(row);
    })();
    res.status(201).json({ item: created });
  }));

  router.put('/items/:id', requireManage, safeRoute((req, res) => {
    const body = parseBody(req.body, ITEM_UPDATE_FIELDS, 'Item');
    const before = database.prepare('SELECT * FROM mt_items WHERE id = ?').get(req.params.id) as RecordValue | undefined;
    if (!before) throw new MaterialsNotFoundError('Item not found');
    const updates: string[] = [];
    const values: unknown[] = [];
    for (const field of ['name', 'category', 'unit'] as const) {
      if (field in body) {
        if (field === 'unit' && requiredString(body, field) !== before.unit) {
          const history = database.prepare(`
            SELECT EXISTS(
              SELECT 1 FROM mt_movements WHERE item_id = ?
              UNION ALL
              SELECT 1 FROM mt_document_lines WHERE material_item_id = ?
            ) AS found
          `).get(req.params.id, req.params.id) as { found: number };
          if (history.found) throw new MaterialsConflictError('Unit cannot change after item use');
        }
        updates.push(`${field} = ?`);
        values.push(requiredString(body, field));
      }
    }
    for (const field of ['specification', 'warehouse', 'bin_location', 'notes'] as const) {
      const value = optionalString(body, field);
      if (value !== undefined) { updates.push(`${field} = ?`); values.push(value); }
    }
    const safety = safetyQuantity(body, false);
    if (safety !== undefined) { updates.push('safety_quantity = ?'); values.push(safety); }
    const isActive = optionalBoolean(body, 'is_active');
    if (isActive !== undefined) { updates.push('is_active = ?'); values.push(isActive ? 1 : 0); }
    const updated = database.transaction(() => {
      database.prepare(`UPDATE mt_items SET ${updates.join(', ')}, updated_by = ?, updated_at = ? WHERE id = ?`)
        .run(...values, req.user!.id, new Date().toISOString(), req.params.id);
      const row = database.prepare('SELECT * FROM mt_items WHERE id = ?').get(req.params.id) as RecordValue;
      writeMaterialsAudit(database, req, 'mt_item', req.params.id, 'update', before, row);
      return serializeRow(row);
    })();
    res.json({ item: updated });
  }));

  router.get('/suppliers', requireEnter, safeRoute((req, res) => {
    if (!permissions.getMaterialsPermission(req.user!).viewPrices) {
      res.json({ suppliers: [] });
      return;
    }
    const rows = database.prepare('SELECT * FROM mt_suppliers ORDER BY code COLLATE NOCASE, id').all() as RecordValue[];
    res.json({ suppliers: rows.map(serializeRow) });
  }));

  router.post('/suppliers', requireManage, safeRoute((req, res) => {
    const body = parseBody(req.body, SUPPLIER_CREATE_FIELDS, 'Supplier');
    const id = randomUUID();
    const now = new Date().toISOString();
    const created = database.transaction(() => {
      database.prepare(`
        INSERT INTO mt_suppliers (
          id, code, name, contact_name, phone, notes, is_active,
          created_by, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, requiredString(body, 'code').toUpperCase(), requiredString(body, 'name'),
        optionalString(body, 'contact_name'), optionalString(body, 'phone'),
        optionalString(body, 'notes'), (optionalBoolean(body, 'is_active') ?? true) ? 1 : 0,
        req.user!.id, req.user!.id, now, now,
      );
      const row = database.prepare('SELECT * FROM mt_suppliers WHERE id = ?').get(id) as RecordValue;
      writeMaterialsAudit(database, req, 'mt_supplier', id, 'create', undefined, row);
      return serializeRow(row);
    })();
    res.status(201).json({ supplier: created });
  }));

  router.put('/suppliers/:id', requireManage, safeRoute((req, res) => {
    const body = parseBody(req.body, SUPPLIER_UPDATE_FIELDS, 'Supplier');
    const before = database.prepare('SELECT * FROM mt_suppliers WHERE id = ?').get(req.params.id) as RecordValue | undefined;
    if (!before) throw new MaterialsNotFoundError('Supplier not found');
    const updates: string[] = [];
    const values: unknown[] = [];
    if ('name' in body) { updates.push('name = ?'); values.push(requiredString(body, 'name')); }
    for (const field of ['contact_name', 'phone', 'notes'] as const) {
      const value = optionalString(body, field);
      if (value !== undefined) { updates.push(`${field} = ?`); values.push(value); }
    }
    const isActive = optionalBoolean(body, 'is_active');
    if (isActive !== undefined) { updates.push('is_active = ?'); values.push(isActive ? 1 : 0); }
    const updated = database.transaction(() => {
      database.prepare(`UPDATE mt_suppliers SET ${updates.join(', ')}, updated_by = ?, updated_at = ? WHERE id = ?`)
        .run(...values, req.user!.id, new Date().toISOString(), req.params.id);
      const row = database.prepare('SELECT * FROM mt_suppliers WHERE id = ?').get(req.params.id) as RecordValue;
      writeMaterialsAudit(database, req, 'mt_supplier', req.params.id, 'update', before, row);
      return serializeRow(row);
    })();
    res.json({ supplier: updated });
  }));

  router.get('/documents', requireEnter, safeRoute((req, res) => {
    res.json({ documents: documents.list(req.user!) });
  }));

  router.get('/documents/:id', requireEnter, safeRoute((req, res) => {
    const document = documents.get(req.user!, req.params.id);
    const showsFulfillment = document.document_type === 'purchase_request'
      && ['approved', 'executed', 'awaiting_signed_copy', 'completed'].includes(String(document.status));
    res.json({
      document: showsFulfillment
        ? { ...document, fulfillment: movements.getPurchaseRequestFulfillment(req.params.id) }
        : document,
    });
  }));

  for (const variant of ['application', 'approved'] as const) {
    router.get(`/documents/:id/${variant}.pdf`, requireEnter, safePdfRoute(async (req, res) => {
      const pdf = await pdfs.get(req.user!, req.params.id, variant);
      const encodedName = encodeURIComponent(pdf.filename).replace(
        /['()]/g,
        (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
      );
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedName}`,
        'Content-Length': String(pdf.buffer.length),
      });
      res.send(pdf.buffer);
    }));
  }

  router.post('/documents', requireEnter, safeRoute((req, res) => {
    if (isPlainObject(req.body)) {
      reporting.assertPeriodOpen(req.body.execution_date ?? req.body.request_date);
    }
    res.status(201).json({ document: documents.create(req.user!, req.body) });
  }));

  router.put('/documents/:id', requireEnter, safeRoute((req, res) => {
    const current = database.prepare(`
      SELECT request_date, execution_date FROM mt_documents WHERE id = ?
    `).get(req.params.id) as { request_date: string; execution_date: string | null } | undefined;
    if (current) reporting.assertPeriodOpen(current.execution_date ?? current.request_date);
    if (isPlainObject(req.body)) {
      reporting.assertPeriodOpen(req.body.execution_date ?? req.body.request_date);
    }
    res.json({ document: documents.update(req.user!, req.params.id, req.body) });
  }));

  for (const action of ['submit', 'approve', 'reject', 'withdraw'] as const) {
    router.post(`/documents/:id/${action}`, requireEnter, safeRoute((req, res) => {
      const current = database.prepare(`
        SELECT request_date, execution_date FROM mt_documents WHERE id = ?
      `).get(req.params.id) as { request_date: string; execution_date: string | null } | undefined;
      if (current) reporting.assertPeriodOpen(current.execution_date ?? current.request_date);
      res.json({ document: documents[action](req.user!, req.params.id, req.body) });
    }));
  }

  router.post('/documents/:id/execute', requireEnter, safeRoute((req, res) => {
    const current = database.prepare(`
      SELECT document_type, request_date, execution_date FROM mt_documents WHERE id = ?
    `).get(req.params.id) as {
      document_type: string;
      request_date: string;
      execution_date: string | null;
    } | undefined;
    if (current) reporting.assertPeriodOpen(current.execution_date ?? current.request_date);
    if (current?.document_type === 'tooling_movement') {
      tooling.execute(req.user!, req.params.id);
    } else {
      movements.executeMaterialDocument(req.user!, req.params.id);
    }
    res.json({ document: documents.get(req.user!, req.params.id) });
  }));

  router.post('/documents/:id/void-and-replace', requireEnter, safeRoute((req, res) => {
    const current = database.prepare(`
      SELECT document_type, request_date, execution_date FROM mt_documents WHERE id = ?
    `).get(req.params.id) as { document_type: string; request_date: string; execution_date: string | null } | undefined;
    if (current) reporting.assertPeriodOpen(current.execution_date ?? current.request_date);
    const docType = current?.document_type ?? '';
    if (docType === 'tooling_movement') {
      const result = tooling.voidAndReplace(req.user!, req.params.id, req.body);
      res.json({ tooling: result });
    } else {
      const replacement = movements.voidAndReplaceMaterialDocument(
        req.user!, req.params.id, req.body,
      );
      res.status(201).json({ document: documents.get(req.user!, String(replacement.id)) });
    }
  }));

  router.get('/documents/:id/attachments', requireEnter, safeRoute((req, res) => {
    res.json({ attachments: attachments.list(req.user!, req.params.id) });
  }));

  router.post('/documents/:id/attachments', requireEnter, (req, res): void => {
    attachmentUpload.single('file')(req, res, (error): void => {
      if (error) {
        const tooLarge = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
        res.status(tooLarge ? 413 : 400).json({
          error: tooLarge ? 'MATERIALS_ATTACHMENT_TOO_LARGE' : 'MATERIALS_ATTACHMENT_INVALID',
          message: tooLarge ? 'Attachment is too large' : 'Invalid attachment upload',
        });
        return;
      }
      safeRoute((uploadReq, uploadRes) => {
        const body = uploadReq.body as Record<string, unknown>;
        const attachment = attachments.upload(uploadReq.user!, uploadReq.params.id, uploadReq.file, {
          category: body.category,
          notes: body.notes,
          isSensitive: body.is_sensitive,
        });
        uploadRes.status(201).json({ attachment });
      })(req, res);
    });
  });

  router.post('/attachments/:id/signed-url', requireEnter, safeRoute((req, res) => {
    res.json(attachments.sign(req.user!, req.params.id));
  }));

  router.get('/attachments/:id/download', requireEnter, safeRoute((req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : undefined;
    const attachment = attachments.download(req.user!, req.params.id, token);
    const encodedName = encodeURIComponent(attachment.original_name).replace(
      /['()]/g,
      (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    res.sendFile(attachment.absolutePath, {
      headers: {
        'Content-Type': attachment.mime_type,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedName}`,
      },
    });
  }));

  router.get('/permissions', permissions.requireMaterialsAdministrator, safeRoute((req, res) => {
    res.json({ users: permissions.listUserPermissions(req.user!) });
  }));

  router.put('/permissions/:userId', permissions.requireMaterialsAdministrator, safeRoute((req, res) => {
    const updated = permissions.updateUserPermissions(req.user!, req.params.userId, req.body);
    res.json({ userId: req.params.userId, permissions: updated });
  }));

  router.get('/approval-config', permissions.requireMaterialsAdministrator, safeRoute((req, res) => {
    res.json({ config: permissions.listApprovalConfig(req.user!) });
  }));

  router.put('/approval-config/:documentType', permissions.requireMaterialsAdministrator, safeRoute((req, res) => {
    const approverUserId = parseApproverBody(req.body);
    const updated = permissions.updateApprovalConfig(
      req.user!, req.params.documentType as MaterialDocumentType, approverUserId,
    );
    res.json(updated);
  }));

  const importUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });

  router.post('/imports/cutover/preview', requireManage, importUpload.single('file'), safeRoute((req, res) => {
    if (!req.file) { res.status(400).json({ error: 'MATERIALS_IMPORT_INVALID', message: 'File is required' }); return; }
    const result = importService.preview(req.user!, req.file.buffer);
    res.json(result);
  }));

  router.post('/imports/cutover', requireManage, importUpload.single('file'), safeRoute((req, res) => {
    if (!req.file) { res.status(400).json({ error: 'MATERIALS_IMPORT_INVALID', message: 'File is required' }); return; }
    const body = typeof req.body === 'object' && req.body ? req.body as Record<string, unknown> : {};
    const result = importService.confirmImport(req.user!, req.file.buffer, {
      month: String(body.month || ''),
      sourceWorkbook: String(body.sourceWorkbook || req.file.originalname || ''),
      confirm: body.confirm === true || body.confirm === 'true',
    });
    res.json(result);
  }));

  router.use((_req, res) => {
    res.status(404).json({ error: 'MATERIALS_NOT_FOUND', message: 'Route not found' });
  });

  return router;
}
