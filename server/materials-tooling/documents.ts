import { createHash, randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import {
  MATERIAL_DOCUMENT_TYPES,
  type MaterialDocumentType,
  type MaterialsPermission,
} from './permissions.js';

type Actor = { id: string; name: string; role: string };
type PermissionPort = {
  getMaterialsPermission(actor: Actor): MaterialsPermission;
  resolveApprover(type: MaterialDocumentType, applicantUserId?: string): string;
};
type JsonObject = Record<string, unknown>;

const PREFIX: Record<MaterialDocumentType, string> = {
  purchase_request: 'PR', purchase_receipt: 'GR', material_issue: 'MI',
  material_return: 'MR', scrap: 'MS', count_adjustment: 'CA', tooling_movement: 'TM',
};
const CREATE_FIELDS = new Set([
  'document_type', 'department', 'request_date', 'required_date', 'execution_date', 'purpose',
  'supplier_id', 'supplier_name', 'invoice_number', 'contract_number', 'notes', 'recipient_user_id',
  'recipient_name', 'inspection_result', 'lines', 'tooling_request',
]);
const UPDATE_FIELDS = new Set([...CREATE_FIELDS].filter((field) => field !== 'document_type'));
const LINE_FIELDS = new Set([
  'material_item_id', 'requested_quantity', 'execution_quantity', 'unit',
  'tax_inclusive_unit_price', 'related_request_line_id', 'related_issue_line_id',
  'return_condition', 'system_quantity', 'counted_quantity', 'adjustment_delta', 'notes',
]);
const DATE_FIELDS = ['request_date', 'required_date', 'execution_date'] as const;
const TEXT_FIELDS = [
  'department', 'purpose', 'supplier_name', 'invoice_number', 'contract_number', 'notes', 'recipient_user_id',
  'recipient_name', 'inspection_result',
] as const;
const TOOLING_REQUEST_FIELDS = new Set([
  'asset_id', 'action', 'to_custodian_user_id', 'to_location', 'reason',
]);
const TOOLING_ACTIONS = [
  'issue', 'return', 'loan', 'transfer', 'repair', 'repair_completion',
  'disposal', 'loss_report',
] as const;
type ToolingAction = typeof TOOLING_ACTIONS[number];

export class MaterialsDocumentError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 403 | 404 | 409 = 400,
    readonly code = 'MATERIALS_DOCUMENT_INVALID',
  ) { super(message); this.name = 'MaterialsDocumentError'; }
}

function plain(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new MaterialsDocumentError(`${label} must be a plain object`);
  }
  return value as JsonObject;
}
function exact(value: unknown, allowed: Set<string>, label: string, allowEmpty = false): JsonObject {
  const body = plain(value, label);
  const keys = Reflect.ownKeys(body);
  if ((!allowEmpty && keys.length === 0) || keys.some((key) => typeof key !== 'string' || !allowed.has(key))) {
    throw new MaterialsDocumentError(`${label} contains unsupported fields`);
  }
  return body;
}
function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new MaterialsDocumentError(`${label} must be a non-empty string`);
  return value.trim();
}
function optionalText(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new MaterialsDocumentError(`${label} must be a string`);
  return value.trim() || null;
}
function date(value: unknown, label: string, required = false): string | null {
  if ((value === undefined || value === null || value === '') && !required) return null;
  const text = nonEmptyString(value, label);
  const parsed = new Date(`${text}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new MaterialsDocumentError(`${label} must be YYYY-MM-DD`);
  }
  return text;
}
function finite(value: unknown, label: string, minimum: number, required = true): number | null {
  if (!required && (value === undefined || value === null)) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
    throw new MaterialsDocumentError(`${label} must be a finite number >= ${minimum}`);
  }
  return value;
}
function audit(database: Database.Database, actor: Actor, document: JsonObject, action: string, details: JsonObject = {}): void {
  const safe = {
    document_number: document.document_number,
    document_type: document.document_type,
    status: document.status,
    version: document.version,
    ...details,
  };
  database.prepare(`INSERT INTO audit_log
    (id,entity_type,entity_id,user_id,user_name,action,changes,created_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(
    randomUUID(), 'mt_document', document.id, actor.id, actor.name, action,
    JSON.stringify(safe), new Date().toISOString(),
  );
}

export function createMaterialsDocumentService(database: Database.Database, permissions: PermissionPort) {
  const incompleteHistory = database.prepare(`SELECT 1 FROM mt_documents document
    WHERE document.status IN (
      'pending_approval','approved','rejected','pending_execution','executed',
      'awaiting_signed_copy','completed'
    ) AND NOT EXISTS (
      SELECT 1 FROM mt_document_versions version
      WHERE version.document_id=document.id AND version.version=document.version
    )
    UNION ALL
    SELECT 1 FROM mt_approvals approval
    WHERE NOT EXISTS (
      SELECT 1 FROM mt_document_versions version
      WHERE version.document_id=approval.document_id AND version.version=approval.version
    ) LIMIT 1`).get();
  if (incompleteHistory) {
    throw new Error('Materials document version history is incomplete; manual migration is required');
  }
  const withSupplierDisplay = (row: JsonObject): JsonObject => {
    if (row.supplier_name != null || row.supplier_id == null) return row;
    const supplier = database.prepare('SELECT name FROM mt_suppliers WHERE id=?').get(row.supplier_id) as { name: string } | undefined;
    return { ...row, supplier_name: supplier?.name ?? null };
  };
  const fetchRaw = (id: string): JsonObject | undefined => {
    const row = database.prepare('SELECT * FROM mt_documents WHERE id=?').get(id) as JsonObject | undefined;
    return row ? withSupplierDisplay(row) : undefined;
  };
  const fetchLines = (id: string): JsonObject[] => database.prepare('SELECT * FROM mt_document_lines WHERE document_id=? ORDER BY line_number').all(id) as JsonObject[];
  const fetchToolingRequest = (id: string): JsonObject | null => (
    database.prepare('SELECT * FROM mt_tooling_requests WHERE document_id=?').get(id) as JsonObject | undefined
  ) ?? null;
  const requireDocument = (id: string): JsonObject => {
    const row = fetchRaw(id);
    if (!row) throw new MaterialsDocumentError('Document not found', 404, 'MATERIALS_DOCUMENT_NOT_FOUND');
    return row;
  };
  function redactPayload(payload: JsonObject, type: unknown, canViewPrices: boolean): JsonObject {
    const result = { ...payload };
    const lines = Array.isArray(result.lines) ? result.lines.map((line) => ({ ...(line as JsonObject) })) : [];
    if (Array.isArray(result.lines)) result.lines = lines;
    if (!canViewPrices) {
      delete result.invoice_number; delete result.contract_number;
      for (const line of lines) delete line.tax_inclusive_unit_price;
      if (type === 'purchase_request' || type === 'purchase_receipt') {
        delete result.supplier_id; delete result.supplier_name;
        delete result.purpose; delete result.notes; delete result.rejection_reason; delete result.void_reason; delete result.inspection_result;
        for (const line of lines) delete line.notes;
      }
    }
    return result;
  }
  function redact(document: JsonObject, canViewPrices: boolean, includeHistory = false): JsonObject {
    const result = redactPayload({ ...document, lines: fetchLines(String(document.id)) }, document.document_type, canViewPrices);
    result.tooling_request = fetchToolingRequest(String(document.id));
    if (!includeHistory) return result;
    result.versions = (database.prepare(`SELECT version,snapshot_json,submitted_by,submitted_at,snapshot_sha256
      FROM mt_document_versions WHERE document_id=? ORDER BY version`).all(document.id) as JsonObject[]).map((row) => {
      const snapshotJson = String(row.snapshot_json);
      let snapshot: { header: JsonObject; lines: JsonObject[] };
      try {
        const parsed = JSON.parse(snapshotJson) as unknown;
        if (!parsed || typeof parsed !== 'object' || Object.getPrototypeOf(parsed) !== Object.prototype) throw new Error('invalid root');
        const candidate = parsed as { header?: unknown; lines?: unknown };
        if (!candidate.header || typeof candidate.header !== 'object' || Object.getPrototypeOf(candidate.header) !== Object.prototype) throw new Error('invalid header');
        if (!Array.isArray(candidate.lines) || candidate.lines.some((line) => !line || typeof line !== 'object' || Object.getPrototypeOf(line) !== Object.prototype)) throw new Error('invalid lines');
        if (createHash('sha256').update(snapshotJson).digest('hex') !== row.snapshot_sha256) throw new Error('hash mismatch');
        snapshot = { header: candidate.header as JsonObject, lines: candidate.lines as JsonObject[] };
      } catch {
        throw new MaterialsDocumentError('Document version integrity check failed', 409, 'MATERIALS_DOCUMENT_INTEGRITY_ERROR');
      }
      const version: JsonObject = {
        version: row.version,
        submittedBy: row.submitted_by,
        submittedAt: row.submitted_at,
        snapshot: {
          header: redactPayload(snapshot.header, document.document_type, canViewPrices),
          lines: (redactPayload({ lines: snapshot.lines }, document.document_type, canViewPrices).lines as JsonObject[]),
        },
      };
      if (canViewPrices || (document.document_type !== 'purchase_request' && document.document_type !== 'purchase_receipt')) version.sha256 = row.snapshot_sha256;
      return version;
    });
    result.approvals = (database.prepare(`SELECT version,approver_user_id,decision,comment,decided_at
      FROM mt_approvals WHERE document_id=? ORDER BY version,decided_at`).all(document.id) as JsonObject[]).map((row) => {
      const approval: JsonObject = {
        version: row.version,
        approverUserId: row.approver_user_id,
        decision: row.decision,
        comment: row.comment,
        decidedAt: row.decided_at,
      };
      if (!canViewPrices && (document.document_type === 'purchase_request' || document.document_type === 'purchase_receipt')) delete approval.comment;
      return approval;
    });
    return result;
  }
  function freezeVersion(
    document: JsonObject,
    version: number,
    actor: Actor,
    approver: string | null,
    workflowStatus: 'pending_approval' | 'pending_execution',
  ): void {
    const submittedAt = new Date().toISOString();
    const applicant = database.prepare('SELECT name FROM users WHERE id=?').get(document.applicant_user_id) as { name: string } | undefined;
    const assignedApprover = approver
      ? database.prepare('SELECT name FROM users WHERE id=?').get(approver) as { name: string } | undefined
      : null;
    if (!applicant || (approver && !assignedApprover)) {
      throw new MaterialsDocumentError('Document participant display names are unavailable', 409, 'MATERIALS_DOCUMENT_INTEGRITY_ERROR');
    }
    let supplierName = optionalText(document.supplier_name, 'supplier_name');
    if (!supplierName && document.supplier_id != null) {
      const supplier = database.prepare('SELECT name FROM mt_suppliers WHERE id=?').get(document.supplier_id) as { name: string } | undefined;
      if (!supplier) throw new MaterialsDocumentError('Document supplier display name is unavailable', 409, 'MATERIALS_DOCUMENT_INTEGRITY_ERROR');
      supplierName = supplier.name;
    }
    let recipientDisplayName = optionalText(document.recipient_name, 'recipient_name');
    if (!recipientDisplayName && document.recipient_user_id != null) {
      const recipient = database.prepare('SELECT name FROM users WHERE id=?').get(document.recipient_user_id) as { name: string } | undefined;
      if (!recipient) throw new MaterialsDocumentError('Document recipient display name is unavailable', 409, 'MATERIALS_DOCUMENT_INTEGRITY_ERROR');
      recipientDisplayName = recipient.name;
    }
    const lines = database.prepare(`SELECT line.*,item.code item_code,item.name item_name,item.specification
      FROM mt_document_lines line
      JOIN mt_items item ON item.id=line.material_item_id
      WHERE line.document_id=? ORDER BY line.line_number`).all(document.id) as JsonObject[];
    const expectedLineCount = (database.prepare('SELECT COUNT(*) count FROM mt_document_lines WHERE document_id=?').get(document.id) as { count: number }).count;
    if (lines.length !== expectedLineCount) {
      throw new MaterialsDocumentError('Document material display data is unavailable', 409, 'MATERIALS_DOCUMENT_INTEGRITY_ERROR');
    }
    let frozenToolingRequest: JsonObject | null = null;
    if (document.document_type === 'tooling_movement') {
      const request = database.prepare(`SELECT request.*,asset.tooling_code asset_code,
          asset.name asset_name,asset.specification asset_specification,
          asset.status current_status,asset.custodian_user_id current_custodian_user_id,
          asset.location current_location,current_custodian.name current_custodian_name,
          target_custodian.name to_custodian_name
        FROM mt_tooling_requests request
        JOIN mt_tooling_assets asset ON asset.id=request.asset_id
        LEFT JOIN users current_custodian ON current_custodian.id=asset.custodian_user_id
        LEFT JOIN users target_custodian ON target_custodian.id=request.to_custodian_user_id
        WHERE request.document_id=?`).get(document.id) as JsonObject | undefined;
      if (!request) throw new MaterialsDocumentError(
        'Tooling movement request is required before submission', 409, 'MATERIALS_DOCUMENT_INTEGRITY_ERROR',
      );
      frozenToolingRequest = request;
    }
    const header: JsonObject = {
      ...document,
      applicant_name: applicant.name,
      version,
      status: workflowStatus,
      assigned_approver_user_id: approver,
      assigned_approver_name: assignedApprover?.name ?? null,
      supplier_name: supplierName,
      recipient_display_name: recipientDisplayName,
      tooling_request: frozenToolingRequest,
      rejection_reason: null,
      updated_by: actor.id,
      updated_at: submittedAt,
    };
    const snapshotJson = JSON.stringify({ header, lines });
    const sha256 = createHash('sha256').update(snapshotJson).digest('hex');
    database.prepare(`INSERT INTO mt_document_versions
      (document_id,version,snapshot_json,snapshot_sha256,submitted_by,submitted_at)
      VALUES (?,?,?,?,?,?)`).run(document.id, version, snapshotJson, sha256, actor.id, submittedAt);
  }
  function requireFrozenVersion(document: JsonObject): void {
    if (!database.prepare('SELECT 1 FROM mt_document_versions WHERE document_id=? AND version=?').get(document.id, document.version)) {
      throw new MaterialsDocumentError('Document version history is incomplete', 409, 'MATERIALS_DOCUMENT_INTEGRITY_ERROR');
    }
  }
  function authorizeType(actor: Actor, type: MaterialDocumentType): void {
    if (type !== 'material_issue' && !permissions.getMaterialsPermission(actor).manageMaterials) {
      throw new MaterialsDocumentError('Material management permission is required', 403, 'MATERIALS_DOCUMENT_FORBIDDEN');
    }
  }
  function validateType(value: unknown): MaterialDocumentType {
    if (typeof value !== 'string' || !MATERIAL_DOCUMENT_TYPES.includes(value as MaterialDocumentType)) {
      throw new MaterialsDocumentError('Unsupported document_type');
    }
    return value as MaterialDocumentType;
  }
  function validateSupplier(id: unknown): string | null {
    if (id === undefined || id === null || id === '') return null;
    const supplierId = nonEmptyString(id, 'supplier_id');
    if (!database.prepare('SELECT 1 FROM mt_suppliers WHERE id=? AND is_active=1').get(supplierId)) {
      throw new MaterialsDocumentError('Active supplier not found', 404, 'MATERIALS_DOCUMENT_NOT_FOUND');
    }
    return supplierId;
  }
  function validateLines(type: MaterialDocumentType, value: unknown): JsonObject[] {
    if (type === 'tooling_movement') {
      if (!Array.isArray(value) || value.length !== 0) throw new MaterialsDocumentError('Tooling movements do not accept material lines');
      return [];
    }
    if (!Array.isArray(value) || value.length === 0) throw new MaterialsDocumentError('lines must be a non-empty array');
    return value.map((entry, index) => {
      const line = exact(entry, LINE_FIELDS, `lines[${index}]`);
      const itemId = nonEmptyString(line.material_item_id, `lines[${index}].material_item_id`);
      const item = database.prepare('SELECT unit FROM mt_items WHERE id=? AND is_active=1').get(itemId) as { unit: string } | undefined;
      if (!item) throw new MaterialsDocumentError('Active material item not found', 404, 'MATERIALS_DOCUMENT_NOT_FOUND');
      const unit = nonEmptyString(line.unit, `lines[${index}].unit`);
      if (unit !== item.unit) throw new MaterialsDocumentError('Line unit must match material item unit');
      const requested = finite(line.requested_quantity, `lines[${index}].requested_quantity`, Number.MIN_VALUE)!;
      const execution = line.execution_quantity === undefined
        ? (type === 'purchase_request' ? 0 : requested)
        : finite(line.execution_quantity, `lines[${index}].execution_quantity`, 0)!;
      const price = finite(line.tax_inclusive_unit_price, 'tax_inclusive_unit_price', 0, false);
      if (price !== null && type !== 'purchase_request' && type !== 'purchase_receipt') {
        throw new MaterialsDocumentError('Prices are only allowed on purchase documents');
      }
      const countValues = [line.system_quantity, line.counted_quantity, line.adjustment_delta];
      if (type !== 'count_adjustment' && countValues.some((v) => v !== undefined && v !== null)) {
        throw new MaterialsDocumentError('Count fields are only allowed on count adjustments');
      }
      let systemQuantity: number | null = null; let countedQuantity: number | null = null; let adjustmentDelta: number | null = null;
      if (type === 'count_adjustment') {
        if (countValues.some((v) => v === undefined || v === null)) throw new MaterialsDocumentError('All count fields are required');
        systemQuantity = finite(line.system_quantity, 'system_quantity', 0)!;
        countedQuantity = finite(line.counted_quantity, 'counted_quantity', 0)!;
        adjustmentDelta = finite(line.adjustment_delta, 'adjustment_delta', -Infinity)!;
        if (Math.abs((countedQuantity - systemQuantity) - adjustmentDelta) >= 0.000001) throw new MaterialsDocumentError('adjustment_delta is inconsistent');
      }
      if (line.related_request_line_id != null) {
        if (type !== 'purchase_receipt') throw new MaterialsDocumentError('Request links are only allowed on purchase receipts');
        const linked = database.prepare(`SELECT 1 FROM mt_document_lines linked JOIN mt_documents document ON document.id=linked.document_id WHERE linked.id=? AND linked.material_item_id=? AND document.document_type='purchase_request' AND document.status IN ('approved','pending_execution','executed','awaiting_signed_copy','completed')`).get(line.related_request_line_id, itemId);
        if (!linked) throw new MaterialsDocumentError('Related purchase request line not found', 404, 'MATERIALS_DOCUMENT_NOT_FOUND');
      }
      if (line.related_issue_line_id != null) {
        if (type !== 'material_return') throw new MaterialsDocumentError('Issue links are only allowed on material returns');
        const linked = database.prepare(`SELECT 1 FROM mt_document_lines linked JOIN mt_documents document ON document.id=linked.document_id WHERE linked.id=? AND linked.material_item_id=? AND document.document_type='material_issue' AND document.status IN ('executed','awaiting_signed_copy','completed')`).get(line.related_issue_line_id, itemId);
        if (!linked) throw new MaterialsDocumentError('Related material issue line not found', 404, 'MATERIALS_DOCUMENT_NOT_FOUND');
      }
      if (type !== 'material_return' && line.return_condition != null) throw new MaterialsDocumentError('return_condition is only allowed on material returns');
      return {
        material_item_id: itemId, requested_quantity: requested, execution_quantity: execution, unit,
        tax_inclusive_unit_price: price, related_request_line_id: optionalText(line.related_request_line_id, 'related_request_line_id'),
        related_issue_line_id: optionalText(line.related_issue_line_id, 'related_issue_line_id'),
        return_condition: optionalText(line.return_condition, 'return_condition'), system_quantity: systemQuantity,
        counted_quantity: countedQuantity, adjustment_delta: adjustmentDelta, notes: optionalText(line.notes, 'line notes'),
      };
    });
  }
  function validateToolingRequest(type: MaterialDocumentType, value: unknown): JsonObject | null {
    if (type !== 'tooling_movement') {
      if (value !== undefined) throw new MaterialsDocumentError('tooling_request is only allowed on tooling movements');
      return null;
    }
    if (value === undefined || value === null) return null;
    const request = exact(value, TOOLING_REQUEST_FIELDS, 'tooling_request');
    const assetId = nonEmptyString(request.asset_id, 'tooling_request.asset_id');
    if (!database.prepare('SELECT 1 FROM mt_tooling_assets WHERE id=?').get(assetId)) {
      throw new MaterialsDocumentError('Tooling asset not found', 404, 'MATERIALS_DOCUMENT_NOT_FOUND');
    }
    const action = nonEmptyString(request.action, 'tooling_request.action') as ToolingAction;
    if (!TOOLING_ACTIONS.includes(action)) throw new MaterialsDocumentError('Unsupported tooling action');
    const toCustodianUserId = optionalText(request.to_custodian_user_id, 'tooling_request.to_custodian_user_id');
    if (toCustodianUserId && !database.prepare('SELECT 1 FROM users WHERE id=? AND is_active=1').get(toCustodianUserId)) {
      throw new MaterialsDocumentError('Active target custodian not found', 404, 'MATERIALS_DOCUMENT_NOT_FOUND');
    }
    const toLocation = optionalText(request.to_location, 'tooling_request.to_location');
    const reason = optionalText(request.reason, 'tooling_request.reason');
    if ((action === 'issue' || action === 'loan') && !toCustodianUserId) {
      throw new MaterialsDocumentError(`${action} requires a target custodian`);
    }
    if (['return', 'repair', 'repair_completion'].includes(action) && !toLocation) {
      throw new MaterialsDocumentError(`${action} requires a target location`);
    }
    if (action === 'transfer' && !toCustodianUserId && !toLocation) {
      throw new MaterialsDocumentError('transfer requires a target custodian or location');
    }
    if ((action === 'disposal' || action === 'loss_report') && !reason) {
      throw new MaterialsDocumentError(`${action} requires a reason`);
    }
    return {
      asset_id: assetId, action, to_custodian_user_id: toCustodianUserId,
      to_location: toLocation, reason,
    };
  }
  function writeToolingRequest(documentId: string, request: JsonObject | null): void {
    if (!request) {
      database.prepare('DELETE FROM mt_tooling_requests WHERE document_id=?').run(documentId);
      return;
    }
    database.prepare(`INSERT INTO mt_tooling_requests
      (document_id,asset_id,action,to_custodian_user_id,to_location,reason)
      VALUES (?,?,?,?,?,?)
      ON CONFLICT(document_id) DO UPDATE SET
        asset_id=excluded.asset_id,action=excluded.action,
        to_custodian_user_id=excluded.to_custodian_user_id,
        to_location=excluded.to_location,reason=excluded.reason`).run(
      documentId, request.asset_id, request.action, request.to_custodian_user_id,
      request.to_location, request.reason,
    );
  }
  function nextNumber(type: MaterialDocumentType, requestDate: string): string {
    const year = requestDate.slice(0, 4); const stem = `${PREFIX[type]}-${year}-`;
    const row = database.prepare('SELECT MAX(CAST(substr(document_number,-4) AS INTEGER)) n FROM mt_documents WHERE document_type=? AND document_number LIKE ?').get(type, `${stem}%`) as { n: number | null };
    if ((row.n ?? 0) >= 9999) throw new MaterialsDocumentError(`Document number sequence is exhausted for ${type} ${year}`, 409);
    return `${stem}${String((row.n ?? 0) + 1).padStart(4, '0')}`;
  }
  function insertLines(documentId: string, lines: JsonObject[]): void {
    const statement = database.prepare(`INSERT INTO mt_document_lines
      (id,document_id,line_number,material_item_id,requested_quantity,execution_quantity,unit,tax_inclusive_unit_price,related_request_line_id,related_issue_line_id,return_condition,system_quantity,counted_quantity,adjustment_delta,notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    lines.forEach((line, index) => statement.run(randomUUID(), documentId, index + 1,
      line.material_item_id, line.requested_quantity, line.execution_quantity, line.unit,
      line.tax_inclusive_unit_price, line.related_request_line_id, line.related_issue_line_id,
      line.return_condition, line.system_quantity, line.counted_quantity, line.adjustment_delta, line.notes));
  }
  function normalizedFields(body: JsonObject): JsonObject {
    const result: JsonObject = { supplier_id: validateSupplier(body.supplier_id) };
    for (const field of DATE_FIELDS) result[field] = date(body[field], field, field === 'request_date');
    for (const field of TEXT_FIELDS) result[field] = optionalText(body[field], field);
    return result;
  }
  function validateHeader(type: MaterialDocumentType, fields: JsonObject): void {
    const has = (field: string) => fields[field] !== undefined && fields[field] !== null && fields[field] !== '';
    const forbid = (field: string) => { if (has(field)) throw new MaterialsDocumentError(`${field} is not allowed on ${type}`); };
    if (type === 'purchase_request') {
      for (const field of ['invoice_number','contract_number','inspection_result','recipient_user_id','recipient_name']) forbid(field);
    } else if (type === 'purchase_receipt') {
      for (const field of ['recipient_user_id','recipient_name']) forbid(field);
    } else if (type === 'material_issue') {
      for (const field of ['supplier_id','supplier_name','invoice_number','contract_number','inspection_result']) forbid(field);
      if (!has('recipient_user_id') && !has('recipient_name')) throw new MaterialsDocumentError('A recipient is required on material issues');
    } else {
      for (const field of ['supplier_id','supplier_name','invoice_number','contract_number','inspection_result','recipient_user_id','recipient_name']) forbid(field);
    }
    if (has('recipient_user_id') && !database.prepare('SELECT 1 FROM users WHERE id=? AND is_active=1').get(fields.recipient_user_id)) {
      throw new MaterialsDocumentError('Active recipient user not found', 404, 'MATERIALS_DOCUMENT_NOT_FOUND');
    }
  }
  function create(actor: Actor, input: unknown): JsonObject {
    const body = exact(input, CREATE_FIELDS, 'Document'); const type = validateType(body.document_type); authorizeType(actor, type);
    if (type !== 'purchase_request' && type !== 'purchase_receipt' && (body.invoice_number != null || body.contract_number != null)) {
      throw new MaterialsDocumentError('Invoice and contract fields are only allowed on purchase documents');
    }
    const id = randomUUID(); const now = new Date().toISOString();
    return database.transaction(() => {
      const fields = normalizedFields(body); validateHeader(type, fields);
      const toolingRequest = validateToolingRequest(type, body.tooling_request);
      const lines = validateLines(type, body.lines);
      const number = nextNumber(type, String(fields.request_date));
      database.prepare(`INSERT INTO mt_documents
        (id,document_number,document_type,version,status,applicant_user_id,department,request_date,required_date,execution_date,purpose,supplier_id,supplier_name,invoice_number,contract_number,created_by,updated_by,created_at,updated_at,notes,recipient_user_id,recipient_name,inspection_result)
        VALUES (?,?,?,1,'draft',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        id, number, type, actor.id, fields.department, fields.request_date, fields.required_date,
        fields.execution_date, fields.purpose, fields.supplier_id, fields.supplier_name, fields.invoice_number,
        fields.contract_number, actor.id, actor.id, now, now, fields.notes, fields.recipient_user_id,
        fields.recipient_name, fields.inspection_result,
      ); insertLines(id, lines); writeToolingRequest(id, toolingRequest);
      const document = requireDocument(id); audit(database, actor, document, 'create');
      return redact(document, permissions.getMaterialsPermission(actor).viewPrices);
    }).immediate();
  }
  function update(actor: Actor, id: string, input: unknown): JsonObject {
    const body = exact(input, UPDATE_FIELDS, 'Document');
    return database.transaction(() => {
      const current = requireDocument(id);
      if (current.status !== 'draft' && current.status !== 'rejected') throw new MaterialsDocumentError('Only draft or rejected documents can be edited', 409);
      if (actor.role !== 'admin' && (current.document_type !== 'material_issue' || current.applicant_user_id !== actor.id) && !permissions.getMaterialsPermission(actor).manageMaterials) throw new MaterialsDocumentError('Document edit is forbidden', 403);
      const fields: JsonObject = { ...current };
      if ('supplier_id' in body) fields.supplier_id = validateSupplier(body.supplier_id);
      for (const field of DATE_FIELDS) if (field in body) fields[field] = date(body[field], field, field === 'request_date');
      for (const field of TEXT_FIELDS) if (field in body) fields[field] = optionalText(body[field], field);
      if (String(fields.request_date).slice(0,4) !== String(current.document_number).slice(3,7)) throw new MaterialsDocumentError('request_date year cannot differ from document number year',409);
      validateHeader(current.document_type as MaterialDocumentType, fields);
      const lines = body.lines === undefined ? null : validateLines(current.document_type as MaterialDocumentType, body.lines);
      const toolingRequest = body.tooling_request === undefined
        ? null
        : validateToolingRequest(current.document_type as MaterialDocumentType, body.tooling_request);
      const nextVersion = current.status === 'rejected'
        ? Number((database.prepare('SELECT MAX(version) version FROM mt_document_versions WHERE document_id=?').get(id) as { version: number | null }).version ?? current.version) + 1
        : Number(current.version);
      database.prepare(`UPDATE mt_documents SET department=?,request_date=?,required_date=?,execution_date=?,purpose=?,supplier_id=?,supplier_name=?,invoice_number=?,contract_number=?,notes=?,recipient_user_id=?,recipient_name=?,inspection_result=?,status='draft',version=?,assigned_approver_user_id=NULL,rejection_reason=NULL,updated_by=?,updated_at=? WHERE id=?`).run(
        fields.department, fields.request_date, fields.required_date, fields.execution_date, fields.purpose,
        fields.supplier_id, fields.supplier_name, fields.invoice_number, fields.contract_number, fields.notes, fields.recipient_user_id,
        fields.recipient_name, fields.inspection_result, nextVersion, actor.id, new Date().toISOString(), id,
      ); if (lines) { database.prepare('DELETE FROM mt_document_lines WHERE document_id=?').run(id); insertLines(id, lines); }
      if (body.tooling_request !== undefined) writeToolingRequest(id, toolingRequest);
      const document = requireDocument(id); audit(database, actor, document, 'update', {
        status: { old: current.status, next: document.status },
        version: { old: current.version, next: document.version },
      }); return redact(document, permissions.getMaterialsPermission(actor).viewPrices);
    }).immediate();
  }
  function workflow(actor: Actor, id: string, action: 'submit'|'approve'|'reject'|'withdraw', input: unknown): JsonObject {
    let reason: string | null = null; let comment: string | null = null;
    if (action === 'submit') exact(input, new Set(), 'Submission', true);
    if (action === 'approve') { const b = exact(input, new Set(['comment']), 'Approval', true); comment = optionalText(b.comment, 'comment'); }
    if (action === 'reject') { const b = exact(input, new Set(['reason','comment']), 'Rejection'); reason = nonEmptyString(b.reason, 'reason'); comment = optionalText(b.comment, 'comment'); }
    if (action === 'withdraw') { const b = exact(input, new Set(['reason']), 'Withdrawal', true); reason = optionalText(b.reason, 'reason'); }
    return database.transaction(() => {
      const current = requireDocument(id); const status = String(current.status);
      let next: 'pending_approval' | 'pending_execution' | 'rejected' | 'withdrawn' | 'approved';
      let version = Number(current.version);
      let approver: string | null = typeof current.assigned_approver_user_id === 'string'
        ? current.assigned_approver_user_id
        : null;
      if (action === 'submit') {
        if (status !== 'draft' && status !== 'rejected') throw new MaterialsDocumentError('Only draft or rejected documents can be submitted', 409);
        if (current.applicant_user_id !== actor.id && actor.role !== 'admin') throw new MaterialsDocumentError('Only the applicant can submit', 403);
        if (current.document_type !== 'count_adjustment') {
          try {
            approver = permissions.resolveApprover(current.document_type as MaterialDocumentType, String(current.applicant_user_id));
          } catch (error) {
            // A small-team deployment may intentionally omit approval configuration.
            // Keep the frozen document/audit trail, but route new work straight to execution.
            if (error instanceof Error && /No active and authorized approver is configured/.test(error.message)) approver = null;
            else throw error;
          }
        } else {
          approver = null;
        }
        if (status === 'rejected') {
          requireFrozenVersion(current);
          const frozen = database.prepare('SELECT MAX(version) version FROM mt_document_versions WHERE document_id=?').get(id) as { version: number | null };
          version = Number(frozen.version ?? current.version) + 1;
        }
        next = approver ? 'pending_approval' : 'pending_execution';
        freezeVersion(current, version, actor, approver, next); reason = null;
      } else if (action === 'withdraw') {
        if (!['draft','pending_approval','rejected'].includes(status)) throw new MaterialsDocumentError('Document cannot be withdrawn', 409);
        if (current.applicant_user_id !== actor.id && actor.role !== 'admin') throw new MaterialsDocumentError('Only applicant or administrator can withdraw', 403);
        if (status !== 'draft') requireFrozenVersion(current);
        next = 'withdrawn';
      } else {
        if (status !== 'pending_approval') throw new MaterialsDocumentError('Document is not pending approval', 409);
        const p = permissions.getMaterialsPermission(actor);
        if (!p.approve || current.assigned_approver_user_id !== actor.id) throw new MaterialsDocumentError('Assigned approver permission is required', 403);
        if ((current.document_type === 'purchase_request' || current.document_type === 'purchase_receipt') && !p.viewPrices) throw new MaterialsDocumentError('Purchase document approval requires price access', 403);
        if (current.applicant_user_id === actor.id) throw new MaterialsDocumentError('Self approval is forbidden', 409);
        requireFrozenVersion(current);
        next = action === 'reject' ? 'rejected' : (current.document_type === 'purchase_request' ? 'approved' : 'pending_execution');
        database.prepare('INSERT INTO mt_approvals(id,document_id,version,approver_user_id,decision,comment,decided_at) VALUES(?,?,?,?,?,?,?)').run(
          randomUUID(), id, version, actor.id, action === 'reject' ? 'rejected' : 'approved', comment ?? reason, new Date().toISOString());
      }
      database.prepare('UPDATE mt_documents SET status=?,version=?,assigned_approver_user_id=?,rejection_reason=?,updated_by=?,updated_at=? WHERE id=?').run(
        next, version, approver, action === 'reject' ? reason : null, actor.id, new Date().toISOString(), id);
      const document = requireDocument(id); audit(database, actor, document, action, {
        status: { old: status, next }, version: { old: Number(current.version), next: version },
        reasonProvided: Boolean(reason), commentProvided: Boolean(comment),
      });
      return redact(document, permissions.getMaterialsPermission(actor).viewPrices);
    }).immediate();
  }
  function voidAndReplace(actor: Actor, id: string, input: unknown): JsonObject {
    if (actor.role !== 'admin') throw new MaterialsDocumentError('Administrator access is required', 403);
    const body = exact(input, new Set(['reason']), 'Void replacement'); const reason = nonEmptyString(body.reason, 'reason');
    return database.transaction(() => {
      const original = requireDocument(id);
      if (!['executed','awaiting_signed_copy','completed'].includes(String(original.status)) || original.replaced_by_document_id) throw new MaterialsDocumentError('Document cannot be replaced', 409);
      requireFrozenVersion(original);
      if (database.prepare('SELECT 1 FROM mt_movements WHERE document_id=? LIMIT 1').get(id)) throw new MaterialsDocumentError('Documents with stock movements require an atomic reversal before voiding',409);
      const originalLines = fetchLines(id); const replacementId = randomUUID(); const now = new Date().toISOString();
      const number = nextNumber(original.document_type as MaterialDocumentType, String(original.request_date));
      database.prepare(`INSERT INTO mt_documents
        (id,document_number,document_type,version,status,applicant_user_id,department,request_date,required_date,execution_date,purpose,supplier_id,supplier_name,invoice_number,contract_number,replaces_document_id,created_by,updated_by,created_at,updated_at,notes,recipient_user_id,recipient_name,inspection_result)
        VALUES (?,?,?,1,'draft',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        replacementId, number, original.document_type, original.applicant_user_id, original.department,
        original.request_date, original.required_date, null, original.purpose,
        original.supplier_id, original.supplier_name, original.invoice_number, original.contract_number, id, actor.id, actor.id,
        now, now, original.notes, original.recipient_user_id, original.recipient_name, original.inspection_result);
      insertLines(replacementId, originalLines);
      const toolingRequest = fetchToolingRequest(id);
      writeToolingRequest(replacementId, toolingRequest);
      const changed = database.prepare("UPDATE mt_documents SET status='voided',void_reason=?,replaced_by_document_id=?,updated_by=?,updated_at=? WHERE id=? AND replaced_by_document_id IS NULL AND status IN ('executed','awaiting_signed_copy','completed')").run(reason,replacementId,actor.id,now,id);
      if (changed.changes !== 1) throw new MaterialsDocumentError('Document was already changed or replaced',409);
      const old = requireDocument(id); const replacement = requireDocument(replacementId); audit(database,actor,old,'void',{
        status:{old:original.status,next:'voided'}, version:{old:original.version,next:original.version},
        reasonProvided:true,replacement_document_number:number,
      }); audit(database,actor,replacement,'create_replacement',{replaces_document_number:original.document_number});
      return redact(replacement, true);
    }).immediate();
  }
  return {
    list: (actor: Actor) => (database.prepare('SELECT * FROM mt_documents ORDER BY created_at DESC,document_number DESC').all() as JsonObject[]).map((row) => redact(withSupplierDisplay(row), permissions.getMaterialsPermission(actor).viewPrices)),
    get: (actor: Actor, id: string) => redact(requireDocument(id), permissions.getMaterialsPermission(actor).viewPrices, true),
    create, update,
    submit: (a:Actor,id:string,b:unknown) => workflow(a,id,'submit',b),
    approve: (a:Actor,id:string,b:unknown) => workflow(a,id,'approve',b),
    reject: (a:Actor,id:string,b:unknown) => workflow(a,id,'reject',b),
    withdraw: (a:Actor,id:string,b:unknown) => workflow(a,id,'withdraw',b),
    voidAndReplace,
  };
}
