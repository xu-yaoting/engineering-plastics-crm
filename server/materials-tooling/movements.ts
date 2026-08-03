import { createHash, randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { MaterialsDocumentError } from './documents.js';
import type { MaterialDocumentType } from './permissions.js';

type Actor = { id: string; name: string; role: string };
type JsonObject = Record<string, unknown>;
type PermissionPort = {
  getMaterialsPermission(actor: Actor): { manageMaterials: boolean };
};

type FrozenDocument = {
  header: JsonObject;
  lines: JsonObject[];
};

export type ExecutableMaterialDocumentType = Exclude<
  MaterialDocumentType,
  'purchase_request' | 'tooling_movement'
>;
export type PurchaseRequestFulfillmentStatus = 'open' | 'partially_received' | 'fulfilled';
export type PurchaseRequestFulfillment = {
  status: PurchaseRequestFulfillmentStatus;
  requestedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  lines: Array<{
    lineId: string;
    materialItemId: string;
    requestedQuantity: number;
    receivedQuantity: number;
    remainingQuantity: number;
    status: PurchaseRequestFulfillmentStatus;
  }>;
};
export type MaterialsMovementService = {
  getCurrentQuantity(itemId: string, asOf?: string): number;
  getPurchaseRequestFulfillment(documentId: string): PurchaseRequestFulfillment;
  executeMaterialDocument(actor: Actor, documentId: string): JsonObject;
  voidAndReplaceMaterialDocument(actor: Actor, documentId: string, input: unknown): JsonObject;
};

const EXECUTABLE_TYPES: readonly ExecutableMaterialDocumentType[] = [
  'purchase_receipt', 'material_issue', 'material_return', 'scrap', 'count_adjustment',
] as const;
const DOCUMENT_PREFIX: Record<MaterialDocumentType, string> = {
  purchase_request: 'PR', purchase_receipt: 'GR', material_issue: 'MI',
  material_return: 'MR', scrap: 'MS', count_adjustment: 'CA', tooling_movement: 'TM',
};

function isExecutableType(value: string): value is ExecutableMaterialDocumentType {
  return EXECUTABLE_TYPES.includes(value as ExecutableMaterialDocumentType);
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new MaterialsDocumentError(`${label} must be a finite number`, 409, 'MATERIALS_EXECUTION_INVALID');
  }
  return value;
}

function parseFrozenVersion(
  database: Database.Database,
  document: JsonObject,
): FrozenDocument {
  const row = database.prepare(`
    SELECT snapshot_json, snapshot_sha256
    FROM mt_document_versions
    WHERE document_id = ? AND version = ?
  `).get(document.id, document.version) as {
    snapshot_json: string;
    snapshot_sha256: string;
  } | undefined;
  if (!row || createHash('sha256').update(row.snapshot_json).digest('hex') !== row.snapshot_sha256) {
    throw new MaterialsDocumentError(
      'Approved document version integrity check failed', 409, 'MATERIALS_DOCUMENT_INTEGRITY_ERROR',
    );
  }
  try {
    const parsed = JSON.parse(row.snapshot_json) as unknown;
    if (!parsed || typeof parsed !== 'object' || Object.getPrototypeOf(parsed) !== Object.prototype) {
      throw new Error('invalid root');
    }
    const frozen = parsed as { header?: unknown; lines?: unknown };
    if (
      !frozen.header
      || typeof frozen.header !== 'object'
      || Object.getPrototypeOf(frozen.header) !== Object.prototype
      || !Array.isArray(frozen.lines)
      || frozen.lines.some((line) => !line || typeof line !== 'object' || Object.getPrototypeOf(line) !== Object.prototype)
    ) throw new Error('invalid shape');
    const header = frozen.header as JsonObject;
    if (
      header.id !== document.id
      || header.version !== document.version
      || header.document_type !== document.document_type
      || header.status !== 'pending_approval'
    ) throw new Error('header mismatch');
    return { header, lines: frozen.lines as JsonObject[] };
  } catch {
    throw new MaterialsDocumentError(
      'Approved document version integrity check failed', 409, 'MATERIALS_DOCUMENT_INTEGRITY_ERROR',
    );
  }
}

function latestActualPurchasePrice(
  database: Database.Database,
  itemId: string,
  movementDate: string,
): number | null {
  const row = database.prepare(`
    SELECT movement.reference_unit_price
    FROM mt_movements movement
    JOIN mt_documents document ON document.id = movement.document_id
    WHERE movement.item_id = ?
      AND movement.movement_type = 'purchase_receipt'
      AND movement.movement_date <= ?
      AND movement.reference_unit_price IS NOT NULL
      AND document.status <> 'voided'
    ORDER BY movement.movement_date DESC, movement.created_at DESC, movement.id DESC
    LIMIT 1
  `).get(itemId, movementDate) as { reference_unit_price: number } | undefined;
  return row?.reference_unit_price ?? null;
}

export function createMaterialsMovementService(
  database: Database.Database,
  permissions?: PermissionPort,
): MaterialsMovementService {
  const quantityStatement = database.prepare(`
    SELECT COALESCE(SUM(quantity_delta), 0) AS quantity
    FROM mt_movements
    WHERE item_id = ? AND (? IS NULL OR movement_date <= ?)
  `);

  function getCurrentQuantity(itemId: string, asOf?: string): number {
    const row = quantityStatement.get(itemId, asOf ?? null, asOf ?? null) as { quantity: number };
    return Number(row.quantity);
  }

  function requireApprovedFrozenVersion(document: JsonObject): FrozenDocument {
    const frozen = parseFrozenVersion(database, document);
    const assignedApproverUserId = frozen.header.assigned_approver_user_id;
    if (typeof assignedApproverUserId !== 'string' || !assignedApproverUserId.trim()) {
      throw new MaterialsDocumentError(
        'The approved version has no assigned approver', 409, 'MATERIALS_DOCUMENT_INTEGRITY_ERROR',
      );
    }
    if (!database.prepare(`
      SELECT 1 FROM mt_approvals
      WHERE document_id = ? AND version = ? AND approver_user_id = ? AND decision = 'approved'
      LIMIT 1
    `).get(document.id, document.version, assignedApproverUserId)) {
      throw new MaterialsDocumentError(
        'The current document version has not been approved', 409, 'MATERIALS_EXECUTION_CONFLICT',
      );
    }
    return frozen;
  }

  function getPurchaseRequestFulfillment(documentId: string): PurchaseRequestFulfillment {
    const document = database.prepare('SELECT * FROM mt_documents WHERE id = ?').get(documentId) as JsonObject | undefined;
    if (!document || document.document_type !== 'purchase_request') {
      throw new MaterialsDocumentError('Purchase request not found', 404, 'MATERIALS_DOCUMENT_NOT_FOUND');
    }
    if (!['approved', 'executed', 'awaiting_signed_copy', 'completed'].includes(String(document.status))) {
      throw new MaterialsDocumentError('Purchase request is not approved', 409, 'MATERIALS_EXECUTION_CONFLICT');
    }
    const frozen = requireApprovedFrozenVersion(document);
    const lines = frozen.lines.map((line, index) => {
      const lineId = String(line.id ?? '');
      const materialItemId = String(line.material_item_id ?? '');
      const requestedQuantity = finiteNumber(line.requested_quantity, `Request line ${index + 1} quantity`);
      if (!lineId || !materialItemId || requestedQuantity <= 0) {
        throw new MaterialsDocumentError(
          'Approved purchase request line is invalid', 409, 'MATERIALS_DOCUMENT_INTEGRITY_ERROR',
        );
      }
      const received = database.prepare(`
        SELECT COALESCE(SUM(movement.quantity_delta), 0) AS quantity
        FROM mt_movements movement
        JOIN mt_document_lines receipt_line ON receipt_line.id = movement.document_line_id
        JOIN mt_documents receipt_document ON receipt_document.id = movement.document_id
        WHERE receipt_line.related_request_line_id = ?
          AND movement.movement_type = 'purchase_receipt'
          AND receipt_document.status <> 'voided'
      `).get(lineId) as { quantity: number };
      const receivedQuantity = Number(received.quantity);
      const remainingQuantity = Math.max(0, requestedQuantity - receivedQuantity);
      const status: PurchaseRequestFulfillmentStatus = receivedQuantity <= 0.000001
        ? 'open'
        : remainingQuantity <= 0.000001 ? 'fulfilled' : 'partially_received';
      return {
        lineId, materialItemId, requestedQuantity, receivedQuantity, remainingQuantity, status,
      };
    });
    const requestedQuantity = lines.reduce((sum, line) => sum + line.requestedQuantity, 0);
    const receivedQuantity = lines.reduce((sum, line) => sum + line.receivedQuantity, 0);
    const remainingQuantity = lines.reduce((sum, line) => sum + line.remainingQuantity, 0);
    const status: PurchaseRequestFulfillmentStatus = receivedQuantity <= 0.000001
      ? 'open'
      : remainingQuantity <= 0.000001 ? 'fulfilled' : 'partially_received';
    return { status, requestedQuantity, receivedQuantity, remainingQuantity, lines };
  }

  function approvedRequestQuantity(lineId: unknown, itemId: string): number {
    const request = database.prepare(`
      SELECT request.*
      FROM mt_document_lines request_line
      JOIN mt_documents request ON request.id = request_line.document_id
      WHERE request_line.id = ? AND request.document_type = 'purchase_request'
        AND request.status IN ('approved', 'executed', 'awaiting_signed_copy', 'completed')
    `).get(lineId) as JsonObject | undefined;
    if (!request) {
      throw new MaterialsDocumentError('Related purchase request is not executable', 409, 'MATERIALS_EXECUTION_INVALID');
    }
    const frozen = requireApprovedFrozenVersion(request);
    const requestLine = frozen.lines.find((line) => line.id === lineId && line.material_item_id === itemId);
    if (!requestLine) {
      throw new MaterialsDocumentError(
        'Related line is absent from the approved purchase request', 409, 'MATERIALS_DOCUMENT_INTEGRITY_ERROR',
      );
    }
    const requestedQuantity = finiteNumber(requestLine.requested_quantity, 'Approved request quantity');
    if (requestedQuantity <= 0) {
      throw new MaterialsDocumentError('Approved request quantity is invalid', 409, 'MATERIALS_DOCUMENT_INTEGRITY_ERROR');
    }
    return requestedQuantity;
  }

  function executeMaterialDocument(actor: Actor, documentId: string): JsonObject {
    if (!permissions || (actor.role !== 'admin' && !permissions.getMaterialsPermission(actor).manageMaterials)) {
      throw new MaterialsDocumentError(
        'Material management permission is required', 403, 'MATERIALS_DOCUMENT_FORBIDDEN',
      );
    }
    return database.transaction(() => {
      const document = database.prepare('SELECT * FROM mt_documents WHERE id = ?').get(documentId) as JsonObject | undefined;
      if (!document) {
        throw new MaterialsDocumentError('Document not found', 404, 'MATERIALS_DOCUMENT_NOT_FOUND');
      }
      const type = String(document.document_type);
      if (!isExecutableType(type) || document.status !== 'pending_execution') {
        throw new MaterialsDocumentError('Document is not pending execution', 409, 'MATERIALS_EXECUTION_CONFLICT');
      }
      if (database.prepare('SELECT 1 FROM mt_movements WHERE document_id = ? LIMIT 1').get(documentId)) {
        throw new MaterialsDocumentError('Document was already executed', 409, 'MATERIALS_EXECUTION_CONFLICT');
      }

      const frozen = requireApprovedFrozenVersion(document);
      if (frozen.lines.length === 0) {
        throw new MaterialsDocumentError('Executable document has no frozen lines', 409, 'MATERIALS_EXECUTION_INVALID');
      }
      const movementDateValue = frozen.header.execution_date ?? frozen.header.request_date;
      if (typeof movementDateValue !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(movementDateValue)) {
        throw new MaterialsDocumentError('Execution date is invalid', 409, 'MATERIALS_EXECUTION_INVALID');
      }
      const movementDate = movementDateValue;
      const createdAt = new Date().toISOString();

      for (const [index, line] of frozen.lines.entries()) {
        const lineId = String(line.id ?? '');
        const itemId = String(line.material_item_id ?? '');
        const currentLine = database.prepare(`
          SELECT line.id, line.material_item_id, item.unit
          FROM mt_document_lines line
          JOIN mt_items item ON item.id = line.material_item_id
          WHERE line.id = ? AND line.document_id = ? AND line.material_item_id = ?
        `).get(lineId, documentId, itemId) as { id: string; material_item_id: string; unit: string } | undefined;
        if (!currentLine || line.unit !== currentLine.unit) {
          throw new MaterialsDocumentError(
            `Frozen line ${index + 1} does not match the material master`, 409, 'MATERIALS_EXECUTION_INVALID',
          );
        }
        const executionQuantity = finiteNumber(line.execution_quantity, `Line ${index + 1} execution quantity`);
        if (type !== 'count_adjustment' && executionQuantity <= 0) {
          throw new MaterialsDocumentError(
            `Line ${index + 1} execution quantity must be positive`, 409, 'MATERIALS_EXECUTION_INVALID',
          );
        }

        let delta: number;
        let referencePrice: number | null = null;
        if (type === 'purchase_receipt') {
          delta = executionQuantity;
          referencePrice = finiteNumber(line.tax_inclusive_unit_price, `Line ${index + 1} price`);
          if (referencePrice < 0) {
            throw new MaterialsDocumentError('Purchase price cannot be negative', 409, 'MATERIALS_EXECUTION_INVALID');
          }
          if (line.related_request_line_id) {
            const requestedQuantity = approvedRequestQuantity(line.related_request_line_id, itemId);
            const received = database.prepare(`
              SELECT COALESCE(SUM(movement.quantity_delta), 0) AS quantity
              FROM mt_movements movement
              JOIN mt_document_lines receipt_line ON receipt_line.id = movement.document_line_id
              JOIN mt_documents receipt_document ON receipt_document.id = movement.document_id
              WHERE receipt_line.related_request_line_id = ?
                AND movement.movement_type = 'purchase_receipt'
                AND receipt_document.status <> 'voided'
            `).get(line.related_request_line_id) as { quantity: number };
            if (Number(received.quantity) + delta > requestedQuantity + 0.000001) {
              throw new MaterialsDocumentError(
                'Receipt exceeds the remaining approved request quantity', 409, 'MATERIALS_EXECUTION_CONFLICT',
              );
            }
          }
        } else if (type === 'material_return') {
          delta = executionQuantity;
          if (line.related_issue_line_id) {
            const issue = database.prepare(`
              SELECT movement.reference_unit_price, movement.quantity_delta
              FROM mt_movements movement
              JOIN mt_documents issue_document ON issue_document.id = movement.document_id
              WHERE movement.document_line_id = ? AND movement.item_id = ?
                AND movement.movement_type = 'material_issue'
                AND issue_document.status IN ('executed', 'awaiting_signed_copy', 'completed')
              ORDER BY movement.created_at DESC, movement.id DESC LIMIT 1
            `).get(line.related_issue_line_id, itemId) as {
              reference_unit_price: number | null;
              quantity_delta: number;
            } | undefined;
            if (!issue) {
              throw new MaterialsDocumentError('Related issue has not been executed', 409, 'MATERIALS_EXECUTION_INVALID');
            }
            const returned = database.prepare(`
              SELECT COALESCE(SUM(movement.quantity_delta), 0) AS quantity
              FROM mt_movements movement
              JOIN mt_document_lines return_line ON return_line.id = movement.document_line_id
              JOIN mt_documents return_document ON return_document.id = movement.document_id
              WHERE return_line.related_issue_line_id = ?
                AND movement.movement_type = 'material_return'
                AND return_document.status <> 'voided'
            `).get(line.related_issue_line_id) as { quantity: number };
            if (Number(returned.quantity) + delta > Math.abs(Number(issue.quantity_delta)) + 0.000001) {
              throw new MaterialsDocumentError(
                'Return exceeds the remaining issued quantity', 409, 'MATERIALS_EXECUTION_CONFLICT',
              );
            }
            referencePrice = issue.reference_unit_price;
          } else {
            referencePrice = latestActualPurchasePrice(database, itemId, movementDate);
          }
        } else if (type === 'count_adjustment') {
          delta = finiteNumber(line.adjustment_delta, `Line ${index + 1} adjustment delta`);
          const systemQuantity = finiteNumber(line.system_quantity, `Line ${index + 1} system quantity`);
          const countedQuantity = finiteNumber(line.counted_quantity, `Line ${index + 1} counted quantity`);
          if (
            Math.abs((countedQuantity - systemQuantity) - delta) >= 0.000001
            || Math.abs(getCurrentQuantity(itemId) - systemQuantity) >= 0.000001
          ) {
            throw new MaterialsDocumentError(
              'Count adjustment is stale or inconsistent', 409, 'MATERIALS_EXECUTION_CONFLICT',
            );
          }
          referencePrice = latestActualPurchasePrice(database, itemId, movementDate);
        } else {
          delta = -executionQuantity;
          referencePrice = latestActualPurchasePrice(database, itemId, movementDate);
        }

        if (delta < 0 && getCurrentQuantity(itemId) + delta < -0.000001) {
          throw new MaterialsDocumentError(
            'Execution would create negative stock', 409, 'MATERIALS_INSUFFICIENT_STOCK',
          );
        }
        if (delta !== 0) {
          database.prepare(`
            INSERT INTO mt_movements (
              id, item_id, document_id, document_line_id, movement_type, quantity_delta,
              reference_unit_price, movement_date, created_by, created_at, supplier_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            randomUUID(), itemId, documentId, lineId, type, delta, referencePrice,
            movementDate, actor.id, createdAt,
            type === 'purchase_receipt' ? frozen.header.supplier_id : null,
          );
        }
      }

      const changed = database.prepare(`
        UPDATE mt_documents
        SET status = 'executed', execution_date = ?, executed_by_user_id = ?,
          updated_by = ?, updated_at = ?
        WHERE id = ? AND status = 'pending_execution'
      `).run(movementDate, actor.id, actor.id, createdAt, documentId);
      if (changed.changes !== 1) {
        throw new MaterialsDocumentError('Document changed during execution', 409, 'MATERIALS_EXECUTION_CONFLICT');
      }
      database.prepare(`
        INSERT INTO audit_log
          (id, entity_type, entity_id, user_id, user_name, action, changes, created_at)
        VALUES (?, 'mt_document', ?, ?, ?, 'execute', ?, ?)
      `).run(
        randomUUID(), documentId, actor.id, actor.name,
        JSON.stringify({
          document_number: document.document_number,
          document_type: type,
          status: { old: 'pending_execution', new: 'executed' },
          version: document.version,
        }),
        createdAt,
      );
      return database.prepare('SELECT * FROM mt_documents WHERE id = ?').get(documentId) as JsonObject;
    }).immediate();
  }

  function voidAndReplaceMaterialDocument(actor: Actor, documentId: string, input: unknown): JsonObject {
    if (actor.role !== 'admin') {
      throw new MaterialsDocumentError(
        'Administrator access is required', 403, 'MATERIALS_DOCUMENT_FORBIDDEN',
      );
    }
    if (!input || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype) {
      throw new MaterialsDocumentError('Void replacement must be a plain object');
    }
    const body = input as JsonObject;
    const keys = Reflect.ownKeys(body);
    if (keys.length !== 1 || keys[0] !== 'reason' || typeof body.reason !== 'string' || !body.reason.trim()) {
      throw new MaterialsDocumentError('Void replacement must contain exactly one non-empty reason');
    }
    const reason = body.reason.trim();

    return database.transaction(() => {
      const original = database.prepare('SELECT * FROM mt_documents WHERE id = ?').get(documentId) as JsonObject | undefined;
      if (!original) {
        throw new MaterialsDocumentError('Document not found', 404, 'MATERIALS_DOCUMENT_NOT_FOUND');
      }
      if (
        !['executed', 'awaiting_signed_copy', 'completed'].includes(String(original.status))
        || original.replaced_by_document_id
      ) {
        throw new MaterialsDocumentError('Document cannot be replaced', 409, 'MATERIALS_EXECUTION_CONFLICT');
      }
      const type = String(original.document_type) as MaterialDocumentType;
      if (type === 'tooling_movement') {
        throw new MaterialsDocumentError(
          'Tooling movement reversal is not supported here', 409, 'MATERIALS_EXECUTION_CONFLICT',
        );
      }
      requireApprovedFrozenVersion(original);
      if (
        type === 'material_issue'
        && database.prepare(`
          SELECT 1
          FROM mt_document_lines issue_line
          JOIN mt_document_lines return_line
            ON return_line.related_issue_line_id = issue_line.id
          JOIN mt_documents return_document ON return_document.id = return_line.document_id
          WHERE issue_line.document_id = ?
            AND return_document.document_type = 'material_return'
            AND return_document.status NOT IN ('voided', 'withdrawn')
          LIMIT 1
        `).get(documentId)
      ) {
        throw new MaterialsDocumentError(
          'Issue is referenced by an active material return', 409, 'MATERIALS_EXECUTION_CONFLICT',
        );
      }

      const originalMovements = database.prepare(`
        SELECT * FROM mt_movements
        WHERE document_id = ? AND movement_type = ?
        ORDER BY created_at, id
      `).all(documentId, type) as JsonObject[];
      if (
        originalMovements.length > 0
        && !database.prepare(`
          SELECT 1 FROM audit_log
          WHERE entity_type = 'mt_document' AND entity_id = ? AND action = 'execute'
          LIMIT 1
        `).get(documentId)
      ) {
        throw new MaterialsDocumentError(
          'Document movement history is incomplete', 409, 'MATERIALS_DOCUMENT_INTEGRITY_ERROR',
        );
      }
      const reversalByItem = new Map<string, number>();
      for (const movement of originalMovements) {
        const itemId = String(movement.item_id);
        const reversal = -finiteNumber(movement.quantity_delta, 'Original movement quantity');
        reversalByItem.set(itemId, (reversalByItem.get(itemId) ?? 0) + reversal);
      }
      for (const [itemId, reversal] of reversalByItem) {
        if (getCurrentQuantity(itemId) + reversal < -0.000001) {
          throw new MaterialsDocumentError(
            'Reversal would create negative stock', 409, 'MATERIALS_INSUFFICIENT_STOCK',
          );
        }
      }

      const now = new Date().toISOString();
      const insertReversal = database.prepare(`
        INSERT INTO mt_movements (
          id, item_id, document_id, document_line_id, movement_type, quantity_delta,
          reference_unit_price, movement_date, created_by, created_at, supplier_id
        ) VALUES (?, ?, ?, ?, 'void_reversal', ?, ?, ?, ?, ?, ?)
      `);
      for (const movement of originalMovements) {
        insertReversal.run(
          randomUUID(), movement.item_id, documentId, movement.document_line_id,
          -finiteNumber(movement.quantity_delta, 'Original movement quantity'),
          movement.reference_unit_price, movement.movement_date, actor.id, now, movement.supplier_id,
        );
      }

      const requestDate = String(original.request_date);
      const year = requestDate.slice(0, 4);
      const stem = `${DOCUMENT_PREFIX[type]}-${year}-`;
      const sequence = database.prepare(`
        SELECT MAX(CAST(substr(document_number, -4) AS INTEGER)) AS value
        FROM mt_documents
        WHERE document_type = ? AND document_number LIKE ?
      `).get(type, `${stem}%`) as { value: number | null };
      if ((sequence.value ?? 0) >= 9999) {
        throw new MaterialsDocumentError('Document number sequence is exhausted', 409, 'MATERIALS_EXECUTION_CONFLICT');
      }
      const replacementId = randomUUID();
      const replacementNumber = `${stem}${String((sequence.value ?? 0) + 1).padStart(4, '0')}`;
      database.prepare(`
        INSERT INTO mt_documents (
          id, document_number, document_type, version, status, applicant_user_id,
          department, request_date, required_date, execution_date, purpose, supplier_id,
          invoice_number, contract_number, replaces_document_id, replaced_by_document_id,
          assigned_approver_user_id, rejection_reason, void_reason, created_by, updated_by,
          created_at, updated_at, notes, executed_by_user_id, recipient_user_id,
          recipient_name, inspection_result
        ) VALUES (
          ?, ?, ?, 1, 'draft', ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL,
          NULL, NULL, NULL, ?, ?, ?, ?, ?, NULL, ?, ?, ?
        )
      `).run(
        replacementId, replacementNumber, type, original.applicant_user_id,
        original.department, original.request_date, original.required_date, original.purpose,
        original.supplier_id, original.invoice_number, original.contract_number, documentId,
        actor.id, actor.id, now, now, original.notes, original.recipient_user_id,
        original.recipient_name, original.inspection_result,
      );
      const originalLines = database.prepare(`
        SELECT * FROM mt_document_lines WHERE document_id = ? ORDER BY line_number
      `).all(documentId) as JsonObject[];
      const insertLine = database.prepare(`
        INSERT INTO mt_document_lines (
          id, document_id, line_number, material_item_id, requested_quantity,
          execution_quantity, unit, tax_inclusive_unit_price, related_request_line_id,
          related_issue_line_id, return_condition, system_quantity, counted_quantity,
          adjustment_delta, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const line of originalLines) {
        insertLine.run(
          randomUUID(), replacementId, line.line_number, line.material_item_id,
          line.requested_quantity, line.execution_quantity, line.unit,
          line.tax_inclusive_unit_price, line.related_request_line_id,
          line.related_issue_line_id, line.return_condition, line.system_quantity,
          line.counted_quantity, line.adjustment_delta, line.notes,
        );
      }
      const changed = database.prepare(`
        UPDATE mt_documents
        SET status = 'voided', void_reason = ?, replaced_by_document_id = ?,
          updated_by = ?, updated_at = ?
        WHERE id = ? AND replaced_by_document_id IS NULL
          AND status IN ('executed', 'awaiting_signed_copy', 'completed')
      `).run(reason, replacementId, actor.id, now, documentId);
      if (changed.changes !== 1) {
        throw new MaterialsDocumentError('Document changed during replacement', 409, 'MATERIALS_EXECUTION_CONFLICT');
      }

      const writeAudit = (entityId: string, action: string, changes: JsonObject): void => {
        database.prepare(`
          INSERT INTO audit_log
            (id, entity_type, entity_id, user_id, user_name, action, changes, created_at)
          VALUES (?, 'mt_document', ?, ?, ?, ?, ?, ?)
        `).run(randomUUID(), entityId, actor.id, actor.name, action, JSON.stringify(changes), now);
      };
      writeAudit(documentId, 'void', {
        document_number: original.document_number,
        document_type: type,
        status: { old: original.status, new: 'voided', next: 'voided' },
        version: { old: original.version, new: original.version, next: original.version },
        reasonProvided: true,
        replacement_document_number: replacementNumber,
      });
      writeAudit(replacementId, 'create_replacement', {
        document_number: replacementNumber,
        document_type: type,
        status: { old: null, new: 'draft' },
        version: 1,
        replaces_document_number: original.document_number,
      });
      return database.prepare('SELECT * FROM mt_documents WHERE id = ?').get(replacementId) as JsonObject;
    }).immediate();
  }

  return {
    getCurrentQuantity,
    getPurchaseRequestFulfillment,
    executeMaterialDocument,
    voidAndReplaceMaterialDocument,
  };
}
