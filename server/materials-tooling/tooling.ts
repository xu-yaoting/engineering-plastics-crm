import { createHash, randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

type Actor = { id: string; name: string; role: string };
type PermissionPort = {
  getMaterialsPermission(actor: Actor): { manageMaterials: boolean; viewPrices: boolean };
};
type JsonObject = Record<string, unknown>;

const ASSET_FIELDS = new Set([
  'tooling_code', 'name', 'category', 'specification', 'serial_number', 'tracked_quantity',
  'supplier_id', 'purchase_price', 'contract_number', 'invoice_number', 'acquired_at',
  'expected_life_months', 'next_maintenance_date', 'notes',
]);
const REQUIRED_CREATE_FIELDS = ['tooling_code', 'name', 'category'] as const;
const SENSITIVE_INPUT_FIELDS = new Set([
  'supplier_id', 'purchase_price', 'contract_number', 'invoice_number',
]);
const PRICE_FIELDS = [
  'supplier_id', 'supplier_name', 'purchase_price', 'contract_number', 'invoice_number',
] as const;
const IMMUTABLE_AFTER_CREATE = new Set(['tooling_code', 'serial_number', 'tracked_quantity']);
const LOCKED_AFTER_MOVEMENT = new Set(['name', 'category', 'specification']);
const TERMINAL_STATUSES = new Set(['disposed', 'lost']);
const TOOLING_ACTIONS = [
  'issue', 'return', 'loan', 'transfer', 'repair', 'repair_completion', 'disposal', 'loss_report',
] as const;
type ToolingAction = typeof TOOLING_ACTIONS[number];
type ToolingStatus = 'in_stock' | 'in_use' | 'loaned' | 'under_repair' | 'disposed' | 'lost';
type TransitionRule = {
  from: readonly ToolingStatus[];
  to: ToolingStatus | 'preserve';
  custody: 'target' | 'clear' | 'partial' | 'clear_keep_location';
  requires: 'custodian' | 'location' | 'target' | 'reason' | null;
};
const TRANSITION_RULES: Record<ToolingAction, TransitionRule> = {
  issue: { from: ['in_stock'], to: 'in_use', custody: 'target', requires: 'custodian' },
  loan: { from: ['in_stock'], to: 'loaned', custody: 'target', requires: 'custodian' },
  return: { from: ['in_use', 'loaned'], to: 'in_stock', custody: 'clear', requires: 'location' },
  transfer: {
    from: ['in_stock', 'in_use', 'loaned', 'under_repair'],
    to: 'preserve', custody: 'partial', requires: 'target',
  },
  repair: { from: ['in_stock', 'in_use'], to: 'under_repair', custody: 'clear', requires: 'location' },
  repair_completion: { from: ['under_repair'], to: 'in_stock', custody: 'clear', requires: 'location' },
  disposal: {
    from: ['in_stock', 'in_use', 'loaned', 'under_repair'],
    to: 'disposed', custody: 'clear_keep_location', requires: 'reason',
  },
  loss_report: {
    from: ['in_stock', 'in_use', 'loaned', 'under_repair'],
    to: 'lost', custody: 'clear_keep_location', requires: 'reason',
  },
};
const FORCED_SENSITIVE_ATTACHMENT_CATEGORIES = new Set([
  'quotation', 'contract', 'invoice', 'delivery_note', 'acceptance_record',
]);

export class MaterialsToolingError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 403 | 404 | 409 = 400,
    readonly code = 'MATERIALS_TOOLING_INVALID',
  ) {
    super(message);
    this.name = 'MaterialsToolingError';
  }
}

function body(value: unknown, creating: boolean): JsonObject {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new MaterialsToolingError('Tooling asset must be a plain object');
  }
  const result = value as JsonObject;
  const keys = Reflect.ownKeys(result);
  if (!keys.length || keys.some((key) => typeof key !== 'string' || !ASSET_FIELDS.has(key))) {
    throw new MaterialsToolingError('Tooling asset contains unsupported fields');
  }
  if (creating && REQUIRED_CREATE_FIELDS.some((field) => !(field in result))) {
    throw new MaterialsToolingError('tooling_code, name, and category are required');
  }
  return result;
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new MaterialsToolingError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function optionalText(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new MaterialsToolingError(`${label} must be a string`);
  return value.trim() || null;
}

function optionalDate(value: unknown, label: string): string | null {
  const text = optionalText(value, label);
  if (text === null) return null;
  const parsed = new Date(`${text}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new MaterialsToolingError(`${label} must be YYYY-MM-DD`);
  }
  return text;
}

function optionalPositiveNumber(value: unknown, label: string, integer = false): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || (integer && !Number.isInteger(value))) {
    throw new MaterialsToolingError(`${label} must be a positive ${integer ? 'integer' : 'number'}`);
  }
  return value;
}

function optionalPrice(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new MaterialsToolingError('purchase_price must be a finite non-negative number');
  }
  return value;
}

function redact(row: JsonObject, canViewPrices: boolean): JsonObject {
  if (canViewPrices) return { ...row };
  const result = { ...row };
  for (const field of PRICE_FIELDS) delete result[field];
  return result;
}

export function createMaterialsToolingService(
  database: Database.Database,
  permissions: PermissionPort,
) {
  const selectAsset = database.prepare(`
    SELECT asset.*, supplier.name AS supplier_name
    FROM mt_tooling_assets asset
    LEFT JOIN mt_suppliers supplier ON supplier.id = asset.supplier_id
    WHERE asset.id = ?
  `);

  function assertManage(actor: Actor): void {
    if (actor.role !== 'admin' && !permissions.getMaterialsPermission(actor).manageMaterials) {
      throw new MaterialsToolingError('Material management permission is required', 403, 'MATERIALS_TOOLING_FORBIDDEN');
    }
  }

  function assertSensitiveAccess(actor: Actor, input: JsonObject): void {
    if (
      actor.role !== 'admin'
      && !permissions.getMaterialsPermission(actor).viewPrices
      && Object.keys(input).some((field) => SENSITIVE_INPUT_FIELDS.has(field))
    ) {
      throw new MaterialsToolingError('Price permission is required for procurement fields', 403, 'MATERIALS_TOOLING_PRICE_FORBIDDEN');
    }
  }

  function supplierId(value: unknown): string | null {
    const id = optionalText(value, 'supplier_id');
    if (id && !database.prepare('SELECT 1 FROM mt_suppliers WHERE id = ? AND is_active = 1').get(id)) {
      throw new MaterialsToolingError('Active supplier not found', 404, 'MATERIALS_TOOLING_NOT_FOUND');
    }
    return id;
  }

  function requireAsset(id: string): JsonObject {
    const asset = selectAsset.get(id) as JsonObject | undefined;
    if (!asset) throw new MaterialsToolingError('Tooling asset not found', 404, 'MATERIALS_TOOLING_NOT_FOUND');
    return asset;
  }

  function audit(
    actor: Actor,
    asset: JsonObject,
    action: 'create' | 'update',
    before: JsonObject | undefined,
    changedFields: string[],
  ): void {
    const changes = Object.fromEntries(changedFields
      .filter((field) => !SENSITIVE_INPUT_FIELDS.has(field))
      .map((field) => [field, { old: before?.[field] ?? null, new: asset[field] ?? null }]));
    database.prepare(`INSERT INTO audit_log
      (id,entity_type,entity_id,user_id,user_name,action,changes,created_at)
      VALUES (?,?,?,?,?,?,?,?)`).run(
      randomUUID(), 'mt_tooling_asset', asset.id, actor.id, actor.name, action,
      JSON.stringify({
        tooling_code: asset.tooling_code,
        status: asset.status,
        changes,
        sensitive_fields_changed: changedFields.filter((field) => SENSITIVE_INPUT_FIELDS.has(field)),
      }), new Date().toISOString(),
    );
  }

  function list(actor: Actor): JsonObject[] {
    const rows = database.prepare(`
      SELECT asset.*, supplier.name AS supplier_name
      FROM mt_tooling_assets asset
      LEFT JOIN mt_suppliers supplier ON supplier.id = asset.supplier_id
      ORDER BY asset.tooling_code COLLATE NOCASE, asset.id
    `).all() as JsonObject[];
    const canViewPrices = permissions.getMaterialsPermission(actor).viewPrices;
    return rows.map((row) => redact(row, canViewPrices));
  }

  function get(actor: Actor, id: string): JsonObject {
    const asset = redact(requireAsset(id), permissions.getMaterialsPermission(actor).viewPrices);
    const movements = database.prepare(`
      SELECT movement.*, document.document_number,
        from_user.name AS from_custodian_name, to_user.name AS to_custodian_name
      FROM mt_tooling_movements movement
      JOIN mt_documents document ON document.id = movement.document_id
      LEFT JOIN users from_user ON from_user.id = movement.from_custodian_user_id
      LEFT JOIN users to_user ON to_user.id = movement.to_custodian_user_id
      WHERE movement.asset_id = ?
      ORDER BY movement.created_at DESC, movement.id DESC
    `).all(id) as JsonObject[];
    const canViewPrices = permissions.getMaterialsPermission(actor).viewPrices;
    const evidence = (database.prepare(`
      SELECT id, category, original_name, mime_type, size_bytes, is_sensitive,
        uploaded_by, uploaded_at, notes
      FROM mt_attachments
      WHERE tooling_asset_id = ? AND deleted_at IS NULL
      ORDER BY uploaded_at DESC, id DESC
    `).all(id) as JsonObject[])
      .filter((attachment) => (
        canViewPrices
        || (!Boolean(attachment.is_sensitive)
          && !FORCED_SENSITIVE_ATTACHMENT_CATEGORIES.has(String(attachment.category)))
      ))
      .map((attachment) => ({ ...attachment, is_sensitive: Boolean(attachment.is_sensitive) }));
    return { ...asset, movements, evidence };
  }

  function create(actor: Actor, input: unknown): JsonObject {
    assertManage(actor);
    const values = body(input, true);
    assertSensitiveAccess(actor, values);
    const id = randomUUID();
    const now = new Date().toISOString();
    return database.transaction(() => {
      database.prepare(`INSERT INTO mt_tooling_assets (
        id, tooling_code, name, category, specification, serial_number, tracked_quantity,
        supplier_id, purchase_price, contract_number, invoice_number, acquired_at,
        expected_life_months, next_maintenance_date, notes,
        created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
          id, requiredText(values.tooling_code, 'tooling_code').toUpperCase(),
          requiredText(values.name, 'name'), requiredText(values.category, 'category'),
          optionalText(values.specification, 'specification'), optionalText(values.serial_number, 'serial_number'),
          optionalPositiveNumber(values.tracked_quantity, 'tracked_quantity') ?? 1,
          supplierId(values.supplier_id), optionalPrice(values.purchase_price),
          optionalText(values.contract_number, 'contract_number'), optionalText(values.invoice_number, 'invoice_number'),
          optionalDate(values.acquired_at, 'acquired_at'),
          optionalPositiveNumber(values.expected_life_months, 'expected_life_months', true),
          optionalDate(values.next_maintenance_date, 'next_maintenance_date'), optionalText(values.notes, 'notes'),
          actor.id, actor.id, now, now,
        );
      const asset = requireAsset(id);
      audit(actor, asset, 'create', undefined, Object.keys(values));
      return redact(asset, permissions.getMaterialsPermission(actor).viewPrices);
    }).immediate();
  }

  function update(actor: Actor, id: string, input: unknown): JsonObject {
    assertManage(actor);
    const values = body(input, false);
    assertSensitiveAccess(actor, values);
    return database.transaction(() => {
      const current = requireAsset(id);
      const hasMovement = Boolean(database.prepare('SELECT 1 FROM mt_tooling_movements WHERE asset_id = ? LIMIT 1').get(id));
      const normalizedValue = (field: string): unknown => {
        if (field === 'tooling_code') return requiredText(values[field], field).toUpperCase();
        if (field === 'name' || field === 'category') return requiredText(values[field], field);
        if (field === 'tracked_quantity') {
          const quantity = optionalPositiveNumber(values[field], field);
          if (quantity === null) throw new MaterialsToolingError('tracked_quantity must be a positive number');
          return quantity;
        }
        if (field === 'purchase_price') return optionalPrice(values[field]);
        if (field === 'expected_life_months') return optionalPositiveNumber(values[field], field, true);
        if (field === 'acquired_at' || field === 'next_maintenance_date') return optionalDate(values[field], field);
        if (field === 'supplier_id') return supplierId(values[field]);
        return optionalText(values[field], field);
      };
      const changedFields = Object.keys(values).filter((field) => (
        JSON.stringify(current[field] ?? null) !== JSON.stringify(normalizedValue(field))
      ));
      if (TERMINAL_STATUSES.has(String(current.status)) && changedFields.some((field) => field !== 'notes')) {
        throw new MaterialsToolingError('Only notes can change on disposed or lost tooling', 409, 'MATERIALS_TOOLING_CONFLICT');
      }
      const immutableField = changedFields.find((field) => IMMUTABLE_AFTER_CREATE.has(field));
      if (immutableField) {
        throw new MaterialsToolingError(`${immutableField} cannot change after tooling creation`, 409, 'MATERIALS_TOOLING_CONFLICT');
      }
      const changedLockedField = changedFields.find((field) => (
        hasMovement && LOCKED_AFTER_MOVEMENT.has(field)
      ));
      if (changedLockedField) {
        throw new MaterialsToolingError(`${changedLockedField} cannot change after tooling movement`, 409, 'MATERIALS_TOOLING_CONFLICT');
      }
      if (!changedFields.length) {
        return redact(current, permissions.getMaterialsPermission(actor).viewPrices);
      }
      const updates: string[] = [];
      const parameters: unknown[] = [];
      for (const field of changedFields) {
        updates.push(`${field} = ?`);
        parameters.push(normalizedValue(field));
      }
      const now = new Date().toISOString();
      database.prepare(`UPDATE mt_tooling_assets SET ${updates.join(', ')}, updated_by = ?, updated_at = ? WHERE id = ?`)
        .run(...parameters, actor.id, now, id);
      const asset = requireAsset(id);
      audit(actor, asset, 'update', current, changedFields);
      return redact(asset, permissions.getMaterialsPermission(actor).viewPrices);
    }).immediate();
  }

  function requireFrozenRequest(document: JsonObject): { header: JsonObject; request: JsonObject } {
    const row = database.prepare(`
      SELECT snapshot_json, snapshot_sha256
      FROM mt_document_versions
      WHERE document_id = ? AND version = ?
    `).get(document.id, document.version) as {
      snapshot_json: string;
      snapshot_sha256: string;
    } | undefined;
    if (!row || createHash('sha256').update(row.snapshot_json).digest('hex') !== row.snapshot_sha256) {
      throw new MaterialsToolingError(
        'Approved tooling version integrity check failed', 409, 'MATERIALS_TOOLING_INTEGRITY_ERROR',
      );
    }
    try {
      const snapshot = JSON.parse(row.snapshot_json) as unknown;
      if (!snapshot || typeof snapshot !== 'object' || Object.getPrototypeOf(snapshot) !== Object.prototype) {
        throw new Error('invalid snapshot');
      }
      const header = (snapshot as JsonObject).header;
      if (!header || typeof header !== 'object' || Object.getPrototypeOf(header) !== Object.prototype) {
        throw new Error('invalid header');
      }
      const frozenHeader = header as JsonObject;
      const request = frozenHeader.tooling_request;
      if (
        frozenHeader.id !== document.id
        || frozenHeader.version !== document.version
        || frozenHeader.document_type !== 'tooling_movement'
        || frozenHeader.status !== 'pending_approval'
        || !request
        || typeof request !== 'object'
        || Object.getPrototypeOf(request) !== Object.prototype
      ) throw new Error('snapshot mismatch');
      const approverId = frozenHeader.assigned_approver_user_id;
      if (typeof approverId !== 'string' || !database.prepare(`
        SELECT 1 FROM mt_approvals
        WHERE document_id = ? AND version = ? AND approver_user_id = ? AND decision = 'approved'
      `).get(document.id, document.version, approverId)) throw new Error('approval mismatch');
      return { header: frozenHeader, request: request as JsonObject };
    } catch (error) {
      if (error instanceof MaterialsToolingError) throw error;
      throw new MaterialsToolingError(
        'Approved tooling version integrity check failed', 409, 'MATERIALS_TOOLING_INTEGRITY_ERROR',
      );
    }
  }

  function execute(actor: Actor, documentId: string, pathAssetId?: string): JsonObject {
    assertManage(actor);
    return database.transaction(() => {
      const document = database.prepare('SELECT * FROM mt_documents WHERE id = ?').get(documentId) as JsonObject | undefined;
      if (!document) throw new MaterialsToolingError('Document not found', 404, 'MATERIALS_TOOLING_NOT_FOUND');
      if (document.document_type !== 'tooling_movement' || document.status !== 'pending_execution') {
        throw new MaterialsToolingError('Tooling document is not pending execution', 409, 'MATERIALS_TOOLING_CONFLICT');
      }
      if (database.prepare('SELECT 1 FROM mt_tooling_movements WHERE document_id = ?').get(documentId)) {
        throw new MaterialsToolingError('Tooling document was already executed', 409, 'MATERIALS_TOOLING_CONFLICT');
      }
      const frozen = requireFrozenRequest(document);
      const request = frozen.request;
      const assetId = typeof request.asset_id === 'string' ? request.asset_id : '';
      const actionValue = typeof request.action === 'string' ? request.action : '';
      if (!assetId || !TOOLING_ACTIONS.includes(actionValue as ToolingAction)) {
        throw new MaterialsToolingError('Approved tooling request is invalid', 409, 'MATERIALS_TOOLING_INTEGRITY_ERROR');
      }
      const action = actionValue as ToolingAction;
      if (pathAssetId !== undefined && pathAssetId !== assetId) {
        throw new MaterialsToolingError('Path asset does not match the approved request', 409, 'MATERIALS_TOOLING_CONFLICT');
      }
      const asset = requireAsset(assetId);
      const fromStatus = String(asset.status) as ToolingStatus;
      const fromCustodian = typeof asset.custodian_user_id === 'string' ? asset.custodian_user_id : null;
      const fromLocation = typeof asset.location === 'string' ? asset.location : null;
      const targetCustodian = typeof request.to_custodian_user_id === 'string'
        ? request.to_custodian_user_id : null;
      const targetLocation = typeof request.to_location === 'string' ? request.to_location : null;
      const reason = typeof request.reason === 'string' ? request.reason : null;
      const rule = TRANSITION_RULES[action];
      if (!rule.from.includes(fromStatus)) {
        throw new MaterialsToolingError(
          `${action} is not allowed from ${fromStatus}`, 409, 'MATERIALS_TOOLING_INVALID_TRANSITION',
        );
      }
      if (rule.requires === 'custodian' && !targetCustodian) {
        throw new MaterialsToolingError('Approved request has no target custodian', 409, 'MATERIALS_TOOLING_INTEGRITY_ERROR');
      }
      if (rule.requires === 'location' && !targetLocation) {
        throw new MaterialsToolingError('Approved request has no target location', 409, 'MATERIALS_TOOLING_INTEGRITY_ERROR');
      }
      if (rule.requires === 'target' && !targetCustodian && !targetLocation) {
        throw new MaterialsToolingError('Approved transfer has no target', 409, 'MATERIALS_TOOLING_INTEGRITY_ERROR');
      }
      if (rule.requires === 'reason' && !reason) {
        throw new MaterialsToolingError('Approved terminal action has no reason', 409, 'MATERIALS_TOOLING_INTEGRITY_ERROR');
      }
      const toStatus = rule.to === 'preserve' ? fromStatus : rule.to;
      let toCustodian = fromCustodian;
      let toLocation = fromLocation;
      if (rule.custody === 'target') {
        toCustodian = targetCustodian;
        toLocation = targetLocation;
      } else if (rule.custody === 'clear') {
        toCustodian = null;
        toLocation = targetLocation;
      } else if (rule.custody === 'partial') {
        if (targetCustodian) toCustodian = targetCustodian;
        if (targetLocation) toLocation = targetLocation;
      } else {
        toCustodian = null;
        if (targetLocation) toLocation = targetLocation;
      }
      if (action === 'loss_report' && !database.prepare(`
        SELECT 1 FROM mt_attachments
        WHERE category = 'tooling_photo' AND deleted_at IS NULL
          AND (document_id = ? OR tooling_asset_id = ?)
        LIMIT 1
      `).get(documentId, assetId)) {
        throw new MaterialsToolingError('Loss report requires a tooling photo', 409, 'MATERIALS_TOOLING_EVIDENCE_REQUIRED');
      }

      const now = new Date().toISOString();
      const movementDate = typeof (frozen.header.execution_date ?? frozen.header.request_date) === 'string'
        ? String(frozen.header.execution_date ?? frozen.header.request_date) : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(movementDate)) {
        throw new MaterialsToolingError('Execution date is invalid', 409, 'MATERIALS_TOOLING_INTEGRITY_ERROR');
      }
      const changedAsset = database.prepare(`
        UPDATE mt_tooling_assets
        SET status = ?, custodian_user_id = ?, location = ?, updated_by = ?, updated_at = ?
        WHERE id = ? AND status = ?
      `).run(toStatus, toCustodian, toLocation, actor.id, now, assetId, fromStatus);
      if (changedAsset.changes !== 1) {
        throw new MaterialsToolingError('Tooling asset changed during execution', 409, 'MATERIALS_TOOLING_CONFLICT');
      }
      database.prepare(`INSERT INTO mt_tooling_movements (
        id, asset_id, document_id, movement_type, from_status, to_status,
        from_custodian_user_id, to_custodian_user_id, from_location, to_location,
        reason, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        randomUUID(), assetId, documentId, action, fromStatus, toStatus,
        fromCustodian, toCustodian, fromLocation, toLocation, reason, actor.id, now,
      );
      const changedDocument = database.prepare(`
        UPDATE mt_documents
        SET status = 'executed', execution_date = ?, executed_by_user_id = ?,
          updated_by = ?, updated_at = ?
        WHERE id = ? AND status = 'pending_execution'
      `).run(movementDate, actor.id, actor.id, now, documentId);
      if (changedDocument.changes !== 1) {
        throw new MaterialsToolingError('Tooling document changed during execution', 409, 'MATERIALS_TOOLING_CONFLICT');
      }
      const writeAudit = (entityType: string, entityId: string, changes: JsonObject): void => {
        database.prepare(`INSERT INTO audit_log
          (id,entity_type,entity_id,user_id,user_name,action,changes,created_at)
          VALUES (?,?,?,?,?,'execute',?,?)`).run(
          randomUUID(), entityType, entityId, actor.id, actor.name, JSON.stringify(changes), now,
        );
      };
      writeAudit('mt_tooling_asset', assetId, {
        document_number: document.document_number, movement_type: action,
        status: { old: fromStatus, new: toStatus },
        custodian_user_id: { old: fromCustodian, new: toCustodian },
        location: { old: fromLocation, new: toLocation }, reason,
      });
      writeAudit('mt_document', documentId, {
        document_number: document.document_number, document_type: 'tooling_movement',
        status: { old: 'pending_execution', new: 'executed' }, version: document.version,
      });
      return get(actor, assetId);
    }).immediate();
  }

  function voidAndReplace(actor: Actor, documentId: string, input: unknown): JsonObject {
    if (actor.role !== 'admin') {
      throw new MaterialsToolingError('Administrator access is required', 403, 'MATERIALS_TOOLING_FORBIDDEN');
    }
    const body = input as JsonObject;
    const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : '';
    if (!reason) throw new MaterialsToolingError('Void reason is required', 400, 'MATERIALS_TOOLING_INVALID');

    return database.transaction(() => {
      const document = database.prepare('SELECT * FROM mt_documents WHERE id = ?').get(documentId) as JsonObject | undefined;
      if (!document) throw new MaterialsToolingError('Document not found', 404, 'MATERIALS_TOOLING_NOT_FOUND');
      if (document.document_type !== 'tooling_movement') throw new MaterialsToolingError('Document is not a tooling movement', 409, 'MATERIALS_TOOLING_CONFLICT');
      if (!['executed', 'awaiting_signed_copy', 'completed'].includes(String(document.status))) {
        throw new MaterialsToolingError('Only executed tooling documents can be voided', 409, 'MATERIALS_TOOLING_CONFLICT');
      }
      if (document.replaced_by_document_id) throw new MaterialsToolingError('Document was already replaced', 409, 'MATERIALS_TOOLING_CONFLICT');

      const movement = database.prepare(
        'SELECT * FROM mt_tooling_movements WHERE document_id = ? ORDER BY created_at DESC LIMIT 1',
      ).get(documentId) as JsonObject | undefined;
      if (!movement) throw new MaterialsToolingError('Tooling movement not found', 404, 'MATERIALS_TOOLING_NOT_FOUND');

      const assetId = String(movement.asset_id);
      const subsequentCount = database.prepare(`
        SELECT COUNT(*) AS count FROM mt_tooling_movements
        WHERE asset_id = ? AND created_at > (SELECT created_at FROM mt_tooling_movements WHERE id = ?) AND movement_type != 'void_reversal'
      `).get(assetId, movement.id) as { count: number };
      if (subsequentCount.count > 0) {
        throw new MaterialsToolingError(
          'Cannot void: subsequent tooling movements exist for this asset', 409, 'MATERIALS_TOOLING_CONFLICT',
        );
      }

      const now = new Date().toISOString();
      const reversalId = randomUUID();
      const fromStatus = movement.from_status ?? null;
      const fromCustodian = movement.from_custodian_user_id ?? null;
      const fromLocation = movement.from_location ?? null;

      const movementType = String(movement.movement_type);
      const reversalToStatus = fromStatus ? String(fromStatus) : '';
      const reversalToCustodian = fromCustodian ? String(fromCustodian) : null;
      const reversalToLocation = fromLocation ? String(fromLocation) : null;

      database.prepare(`INSERT INTO mt_tooling_movements
        (id,asset_id,document_id,movement_type,from_status,to_status,
         from_custodian_user_id,to_custodian_user_id,from_location,to_location,
         reason,created_by,created_at)
        VALUES (?,?,?,'void_reversal',?,
          COALESCE(?, (SELECT status FROM mt_tooling_assets WHERE id=?)),
          ?,?,?,?,?,?,?)`).run(
        reversalId, assetId, documentId,
        fromStatus,
        reversalToStatus || String(movement.to_status || ''), assetId,
        fromCustodian ? String(fromCustodian) : null, reversalToCustodian,
        fromLocation ? String(fromLocation) : null, reversalToLocation,
        reason, actor.id, now,
      );

      const updateFields: string[] = [];
      const updateValues: unknown[] = [];
      if (reversalToStatus) { updateFields.push('status = ?'); updateValues.push(reversalToStatus); }
      if (reversalToCustodian) { updateFields.push('custodian_user_id = ?'); updateValues.push(reversalToCustodian); }
      else if (fromCustodian === null && movement.from_custodian_user_id !== undefined) { updateFields.push('custodian_user_id = NULL'); }
      if (reversalToLocation) { updateFields.push('location = ?'); updateValues.push(reversalToLocation); }
      else if (fromLocation === null && movement.from_location !== undefined) { updateFields.push('location = NULL'); }
      updateFields.push('updated_by = ?', 'updated_at = ?');
      updateValues.push(actor.id, now, assetId);
      if (updateFields.length > 2) {
        database.prepare(`UPDATE mt_tooling_assets SET ${updateFields.join(', ')} WHERE id = ?`).run(...updateValues);
      }

      const year = String(document.request_date || now).slice(0, 4);
      const stem = `TM-${year}-`;
      const seqRow = database.prepare(
        'SELECT MAX(CAST(substr(document_number, -4) AS INTEGER)) n FROM mt_documents WHERE document_type = ? AND document_number LIKE ?',
      ).get('tooling_movement', `${stem}%`) as { n: number | null };
      if ((seqRow.n ?? 0) >= 9999) throw new MaterialsToolingError('Document number sequence exhausted', 409);
      const newNumber = `${stem}${String((seqRow.n ?? 0) + 1).padStart(4, '0')}`;
      const replacementId = randomUUID();

      database.prepare(`INSERT INTO mt_documents
        (id,document_number,document_type,version,status,applicant_user_id,department,
         request_date,required_date,execution_date,purpose,supplier_id,invoice_number,
         contract_number,replaces_document_id,assigned_approver_user_id,void_reason,
         created_by,updated_by,created_at,updated_at,notes,recipient_user_id,
         recipient_name,inspection_result)
        SELECT ?,?,document_type,1,'draft',applicant_user_id,department,
          request_date,required_date,NULL,purpose,NULL,NULL,
          NULL,?,NULL,NULL,
          ?,?,?,?,NULL,NULL,NULL,NULL
        FROM mt_documents WHERE id=?`).run(
        replacementId, newNumber, documentId, actor.id, actor.id, now, now, documentId,
      );

      database.prepare(`UPDATE mt_documents SET
        status = 'voided', void_reason = ?, replaced_by_document_id = ?,
        updated_by = ?, updated_at = ?
        WHERE id = ? AND replaced_by_document_id IS NULL
          AND status IN ('executed', 'awaiting_signed_copy', 'completed')
      `).run(reason, replacementId, actor.id, now, documentId);

      const voidChange = database.prepare(
        'SELECT changes() AS c',
      ).get() as { c: number };
      if (voidChange.c !== 1) throw new MaterialsToolingError('Document was already changed', 409);

      database.prepare(`INSERT INTO audit_log
        (id,entity_type,entity_id,user_id,user_name,action,changes,created_at)
        VALUES (?,?,?,?,?,?,?,?)`).run(
        randomUUID(), 'mt_tooling_asset', assetId, actor.id, actor.name, 'void_reversal',
        JSON.stringify({
          document_number: document.document_number,
          movement_type: movementType,
          reversal_movement_id: reversalId,
          replacement_document_number: newNumber,
          reason,
        }), now,
      );
      database.prepare(`INSERT INTO audit_log
        (id,entity_type,entity_id,user_id,user_name,action,changes,created_at)
        VALUES (?,?,?,?,?,?,?,?)`).run(
        randomUUID(), 'mt_document', documentId, actor.id, actor.name, 'void',
        JSON.stringify({
          document_number: document.document_number,
          status: { old: document.status, new: 'voided' },
          reversed_movement_id: reversalId,
          replacement_document_number: newNumber,
          reasonProvided: true,
        }), now,
      );
      database.prepare(`INSERT INTO audit_log
        (id,entity_type,entity_id,user_id,user_name,action,changes,created_at)
        VALUES (?,?,?,?,?,?,?,?)`).run(
        randomUUID(), 'mt_document', replacementId, actor.id, actor.name, 'create_replacement',
        JSON.stringify({
          document_number: newNumber,
          replaces_document_number: document.document_number,
        }), now,
      );

      return get(actor, assetId);
    }).immediate();
  }

  return { list, get, create, update, execute, voidAndReplace };
}
