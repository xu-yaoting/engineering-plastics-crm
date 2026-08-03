import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import type Database from 'better-sqlite3';
import * as XLSX from 'xlsx';

const require = createRequire(import.meta.url);

declare namespace PDFKit {
  interface PDFDocument extends NodeJS.ReadableStream {
    page: { width: number; height: number };
    y: number;
    font(source: string): this;
    fontSize(size: number): this;
    fillColor(color: string): this;
    lineWidth(width: number): this;
    rect(x: number, y: number, width: number, height: number): this;
    stroke(color?: string): this;
    text(text: string, x?: number, y?: number, options?: Record<string, unknown>): this;
    text(text: string, options?: Record<string, unknown>): this;
    addPage(options?: Record<string, unknown>): this;
    end(): void;
  }
}

type PdfConstructor = new (options?: Record<string, unknown>) => PDFKit.PDFDocument;
const PDFDocument = require('pdfkit') as PdfConstructor;

type Actor = { id: string; name: string; role: string };
type PermissionPort = {
  getMaterialsPermission(actor: Actor): {
    viewPrices: boolean;
    managePeriods: boolean;
  };
};
type Row = Record<string, unknown>;

export class MaterialsReportingError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
    readonly code = 'MATERIALS_REPORTING_INVALID',
  ) {
    super(message);
    this.name = 'MaterialsReportingError';
  }
}

export function createMaterialsReportingService(
  database: Database.Database,
  permissions: PermissionPort,
): {
  getOverview(actor: Actor): Row;
  getLedger(actor: Actor, input: { month: unknown; search?: unknown; category?: unknown }): Row;
  getPriceHistory(actor: Actor, itemId: string): Row;
  assertPeriodOpen(date: unknown): void;
  closePeriod(actor: Actor, month: unknown): Row;
  reopenPeriod(actor: Actor, month: unknown, input: unknown): Row;
  exportLedgerXlsx(actor: Actor, month: unknown): { buffer: Buffer; filename: string };
  exportLedgerPdf(actor: Actor, month: unknown): Promise<{ buffer: Buffer; filename: string }>;
} {
  database.exec(`
    CREATE TRIGGER IF NOT EXISTS mt_period_snapshots_no_update
    BEFORE UPDATE ON mt_period_snapshots
    BEGIN SELECT RAISE(ABORT, 'Period snapshots are immutable'); END;
    CREATE TRIGGER IF NOT EXISTS mt_period_snapshots_no_delete
    BEFORE DELETE ON mt_period_snapshots
    BEGIN SELECT RAISE(ABORT, 'Period snapshots are immutable'); END;
  `);

  function parseMonth(value: unknown): { month: string; start: string; end: string } {
    if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
      throw new MaterialsReportingError('Month must use YYYY-MM format');
    }
    const year = Number(value.slice(0, 4));
    const monthNumber = Number(value.slice(5, 7));
    const next = monthNumber === 12
      ? `${String(year + 1).padStart(4, '0')}-01-01`
      : `${String(year).padStart(4, '0')}-${String(monthNumber + 1).padStart(2, '0')}-01`;
    return { month: value, start: `${value}-01`, end: next };
  }

  function numeric(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  function previousMonth(month: string): string {
    const year = Number(month.slice(0, 4));
    const value = Number(month.slice(5, 7));
    return value === 1
      ? `${String(year - 1).padStart(4, '0')}-12`
      : `${String(year).padStart(4, '0')}-${String(value - 1).padStart(2, '0')}`;
  }

  function getLedger(
    actor: Actor,
    input: { month: unknown; search?: unknown; category?: unknown },
  ): Row {
    const period = parseMonth(input.month);
    if (input.search !== undefined && typeof input.search !== 'string') {
      throw new MaterialsReportingError('Search must be a string');
    }
    if (input.category !== undefined && typeof input.category !== 'string') {
      throw new MaterialsReportingError('Category must be a string');
    }
    const search = typeof input.search === 'string' ? input.search.trim() : '';
    const category = typeof input.category === 'string' ? input.category.trim() : '';
    const storedPeriod = database.prepare('SELECT * FROM mt_periods WHERE period_key = ?')
      .get(period.month) as Row | undefined;
    const storedSnapshot = storedPeriod?.status === 'closed'
      ? database.prepare(`
        SELECT snapshot_json FROM mt_period_snapshots
        WHERE period_key = ? ORDER BY version DESC LIMIT 1
      `).get(period.month) as { snapshot_json: string } | undefined
      : undefined;
    if (storedSnapshot) {
      let snapshot: Row;
      try { snapshot = JSON.parse(storedSnapshot.snapshot_json) as Row; }
      catch { throw new MaterialsReportingError('Period snapshot is invalid', 409, 'MATERIALS_REPORTING_INTEGRITY_ERROR'); }
      const snapshotRows = Array.isArray(snapshot.rows) ? snapshot.rows as Row[] : [];
      const selected = snapshotRows.filter((row) => (
        (!search || String(row.name).toLocaleLowerCase().includes(search.toLocaleLowerCase())
          || String(row.code).toLocaleLowerCase().includes(search.toLocaleLowerCase()))
        && (!category || row.category === category)
      ));
      if (!permissions.getMaterialsPermission(actor).viewPrices) {
        const redacted = selected.map((row) => {
          const copy = { ...row };
          for (const field of ['opening', 'receipts', 'returns', 'issues', 'scrap', 'closing']) {
            const quantity = (copy[field] as Row | undefined)?.quantity ?? 0;
            copy[field] = { quantity };
          }
          if (copy.sources && typeof copy.sources === 'object') {
            copy.sources = Object.fromEntries(Object.entries(copy.sources as Row).map(([bucket, entries]) => [
              bucket,
              Array.isArray(entries) ? entries.map((entry) => {
                const value = { ...(entry as Row) };
                delete value.referenceUnitPrice;
                delete value.amount;
                delete value.priceUnavailable;
                return value;
              }) : [],
            ]));
          }
          return copy;
        });
        return { month: period.month, status: 'closed', rows: redacted };
      }
      return { ...snapshot, status: 'closed', rows: selected };
    }
    const priorSnapshot = database.prepare(`
      SELECT snapshot.snapshot_json, snapshot.version
      FROM mt_periods period
      JOIN mt_period_snapshots snapshot ON snapshot.period_key = period.period_key
      WHERE period.period_key = ? AND period.status = 'closed'
      ORDER BY snapshot.version DESC LIMIT 1
    `).get(previousMonth(period.month)) as { snapshot_json: string; version: number } | undefined;
    const priorClosing = new Map<string, Row>();
    if (priorSnapshot) {
      try {
        const parsed = JSON.parse(priorSnapshot.snapshot_json) as Row;
        if (Array.isArray(parsed.rows)) {
          for (const row of parsed.rows as Row[]) {
            if (typeof row.itemId === 'string' && row.closing && typeof row.closing === 'object') {
              priorClosing.set(row.itemId, row.closing as Row);
            }
          }
        }
      } catch {
        throw new MaterialsReportingError('Prior period snapshot is invalid', 409, 'MATERIALS_REPORTING_INTEGRITY_ERROR');
      }
    }
    const items = database.prepare(`
      SELECT id, code, name, category, specification, unit
      FROM mt_items
      WHERE (? = '' OR name LIKE ? ESCAPE '\\' OR code LIKE ? ESCAPE '\\')
        AND (? = '' OR category = ?)
      ORDER BY code COLLATE NOCASE, id
    `).all(
      search, `%${search.replace(/[\\%_]/g, '\\$&')}%`, `%${search.replace(/[\\%_]/g, '\\$&')}%`,
      category, category,
    ) as Row[];
    const movementStatement = database.prepare(`
      SELECT movement.movement_type, movement.quantity_delta, movement.reference_unit_price,
        movement.movement_date, movement.created_at, movement.id,
        movement.source_workbook, movement.cutover_period,
        document.id AS document_id, document.document_number
      FROM mt_movements movement
      LEFT JOIN mt_documents document ON document.id = movement.document_id
      WHERE movement.item_id = ? AND movement.movement_date < ?
      ORDER BY movement.movement_date, movement.created_at, movement.id
    `);
    const showPrices = permissions.getMaterialsPermission(actor).viewPrices;
    const rows = items.map((item) => {
      const movements = movementStatement.all(item.id, period.end) as Row[];
      let openingQuantity = 0;
      let openingAmount = 0;
      let receiptQuantity = 0;
      let receiptAmount = 0;
      let returnQuantity = 0;
      let returnAmount = 0;
      let issueQuantity = 0;
      let scrapQuantity = 0;
      let adjustmentQuantity = 0;
      let returnPriceUnavailable = false;
      const sources: Record<string, Row[]> = {
        opening: [], receipts: [], returns: [], issues: [], scrap: [], adjustment: [],
      };
      for (const movement of movements) {
        const quantity = numeric(movement.quantity_delta);
        const price = movement.reference_unit_price === null ? null : numeric(movement.reference_unit_price);
        if (String(movement.movement_date) < period.start) {
          openingQuantity += quantity;
          openingAmount += quantity * (price ?? 0);
          sources.opening.push({
            kind: 'movement', movementId: movement.id, movementType: movement.movement_type,
            documentId: movement.document_id, documentNumber: movement.document_number,
            date: movement.movement_date, quantity,
            sourceWorkbook: movement.source_workbook, cutoverPeriod: movement.cutover_period,
            referenceUnitPrice: price ?? 0, amount: quantity * (price ?? 0),
          });
          continue;
        }
        switch (movement.movement_type) {
          case 'purchase_receipt':
            receiptQuantity += quantity;
            receiptAmount += quantity * (price ?? 0);
            sources.receipts.push({ documentId: movement.document_id, documentNumber: movement.document_number, date: movement.movement_date, quantity, referenceUnitPrice: price, amount: quantity * (price ?? 0) });
            break;
          case 'material_return':
            returnQuantity += quantity;
            returnAmount += quantity * (price ?? 0);
            if (price === null) returnPriceUnavailable = true;
            sources.returns.push({ documentId: movement.document_id, documentNumber: movement.document_number, date: movement.movement_date, quantity, referenceUnitPrice: price ?? 0, amount: quantity * (price ?? 0), priceUnavailable: price === null });
            break;
          case 'material_issue': issueQuantity += -quantity; sources.issues.push({ documentId: movement.document_id, documentNumber: movement.document_number, date: movement.movement_date, quantity: -quantity, referenceUnitPrice: price ?? 0, amount: -quantity * (price ?? 0) }); break;
          case 'scrap': scrapQuantity += -quantity; sources.scrap.push({ documentId: movement.document_id, documentNumber: movement.document_number, date: movement.movement_date, quantity: -quantity, referenceUnitPrice: price ?? 0, amount: -quantity * (price ?? 0) }); break;
          case 'count_adjustment':
          case 'void_reversal': adjustmentQuantity += quantity; sources.adjustment.push({ documentId: movement.document_id, documentNumber: movement.document_number, date: movement.movement_date, quantity, referenceUnitPrice: price ?? 0, amount: quantity * (price ?? 0) }); break;
          default: break;
        }
      }
      const carried = priorClosing.get(String(item.id));
      if (carried) {
        openingQuantity = numeric(carried.quantity);
        openingAmount = numeric(carried.amount);
        sources.opening = [{
          kind: 'period_snapshot', periodKey: previousMonth(period.month),
          snapshotVersion: priorSnapshot?.version,
        }];
      }
      const weightedQuantity = openingQuantity + receiptQuantity;
      const referenceUnitPrice = Math.abs(weightedQuantity) < 0.000001
        ? 0
        : (openingAmount + receiptAmount) / weightedQuantity;
      const closingQuantity = openingQuantity + receiptQuantity + returnQuantity
        - issueQuantity - scrapQuantity + adjustmentQuantity;
      const row: Row = {
        itemId: item.id,
        code: item.code,
        name: item.name,
        category: item.category,
        specification: item.specification,
        unit: item.unit,
        opening: { quantity: openingQuantity },
        receipts: { quantity: receiptQuantity },
        returns: { quantity: returnQuantity },
        issues: { quantity: issueQuantity },
        scrap: { quantity: scrapQuantity },
        adjustment: { quantity: adjustmentQuantity },
        closing: { quantity: closingQuantity },
        sources,
      };
      if (showPrices) {
        row.opening = { quantity: openingQuantity, unitPrice: openingQuantity ? openingAmount / openingQuantity : 0, amount: openingAmount };
        row.receipts = { quantity: receiptQuantity, unitPrice: receiptQuantity ? receiptAmount / receiptQuantity : 0, amount: receiptAmount };
        row.returns = { quantity: returnQuantity, unitPrice: returnQuantity ? returnAmount / returnQuantity : 0, amount: returnAmount, priceUnavailable: returnPriceUnavailable };
        row.issues = { quantity: issueQuantity, unitPrice: referenceUnitPrice, amount: issueQuantity * referenceUnitPrice };
        row.scrap = { quantity: scrapQuantity, unitPrice: referenceUnitPrice, amount: scrapQuantity * referenceUnitPrice };
        row.closing = { quantity: closingQuantity, unitPrice: referenceUnitPrice, amount: closingQuantity * referenceUnitPrice };
      } else {
        row.sources = Object.fromEntries(Object.entries(sources).map(([bucket, entries]) => [
          bucket,
          entries.map(({ referenceUnitPrice: _price, amount: _amount, priceUnavailable: _unavailable, ...entry }) => entry),
        ]));
      }
      return row;
    });
    return {
      month: period.month,
      status: storedPeriod?.status ?? 'open',
      referenceNotice: showPrices ? 'Reference amounts are not an accounting record.' : undefined,
      rows,
    };
  }

  function getOverview(actor: Actor): Row {
    const access = permissions.getMaterialsPermission(actor);
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const start = `${month}-01`;
    const end = month === '9999-12'
      ? '9999-12-31'
      : new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1))
        .toISOString().slice(0, 10);
    const pending = database.prepare(`
      SELECT COUNT(*) AS count FROM mt_documents WHERE status = 'pending_approval'
    `).get() as { count: number };
    const lowStock = database.prepare(`
      SELECT item.id, item.code, item.name, item.unit, item.safety_quantity,
        COALESCE(SUM(movement.quantity_delta), 0) AS current_quantity
      FROM mt_items item
      LEFT JOIN mt_movements movement ON movement.item_id = item.id
      WHERE item.is_active = 1
      GROUP BY item.id
      HAVING current_quantity < item.safety_quantity
      ORDER BY item.code COLLATE NOCASE, item.id
    `).all() as Row[];
    const totals = database.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN movement_type = 'purchase_receipt' THEN quantity_delta ELSE 0 END), 0) AS receipt_quantity,
        COALESCE(SUM(CASE WHEN movement_type = 'purchase_receipt' THEN quantity_delta * COALESCE(reference_unit_price, 0) ELSE 0 END), 0) AS receipt_amount,
        COALESCE(SUM(CASE WHEN movement_type = 'material_issue' THEN -quantity_delta ELSE 0 END), 0) AS issue_quantity,
        COALESCE(SUM(CASE WHEN movement_type = 'material_issue' THEN -quantity_delta * COALESCE(reference_unit_price, 0) ELSE 0 END), 0) AS issue_amount
      FROM mt_movements
      WHERE movement_date >= ? AND movement_date < ?
    `).get(start, end) as Row;
    const overdue = database.prepare(`
      SELECT COUNT(*) AS count FROM mt_tooling_assets
      WHERE next_maintenance_date IS NOT NULL AND next_maintenance_date < ?
        AND status NOT IN ('disposed', 'lost')
    `).get(today) as { count: number };
    const currentMonth: Row = {
      receiptQuantity: Number(totals.receipt_quantity),
      issueQuantity: Number(totals.issue_quantity),
    };
    if (access.viewPrices) {
      currentMonth.receiptAmount = Number(totals.receipt_amount);
      currentMonth.issueReferenceAmount = Number(totals.issue_amount);
    }
    return {
      month,
      pendingApprovals: Number(pending.count),
      lowStockItems: lowStock.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        unit: row.unit,
        safetyQuantity: Number(row.safety_quantity),
        currentQuantity: Number(row.current_quantity),
      })),
      currentMonth,
      overdueToolingCount: Number(overdue.count),
    };
  }

  function getPriceHistory(actor: Actor, itemId: string): Row {
    if (!permissions.getMaterialsPermission(actor).viewPrices) {
      throw new MaterialsReportingError(
        'Purchase price permission is required', 403, 'MATERIALS_REPORTING_FORBIDDEN',
      );
    }
    const item = database.prepare('SELECT id, code, name, unit FROM mt_items WHERE id = ?')
      .get(itemId) as Row | undefined;
    if (!item) {
      throw new MaterialsReportingError('Material item not found', 404, 'MATERIALS_REPORTING_NOT_FOUND');
    }
    const purchases = database.prepare(`
      SELECT movement.id, movement.document_id, movement.movement_date AS purchase_date,
        movement.quantity_delta AS quantity, movement.reference_unit_price AS unit_price,
        movement.quantity_delta * movement.reference_unit_price AS amount,
        supplier.id AS supplier_id, supplier.name AS supplier_name,
        document.document_number, document.invoice_number, document.contract_number,
        movement.created_at
      FROM mt_movements movement
      JOIN mt_documents document ON document.id = movement.document_id
      LEFT JOIN mt_suppliers supplier ON supplier.id = movement.supplier_id
      WHERE movement.item_id = ? AND movement.movement_type = 'purchase_receipt'
        AND movement.reference_unit_price IS NOT NULL AND document.status <> 'voided'
      ORDER BY purchase_date DESC, movement.created_at DESC, movement.id DESC
    `).all(itemId) as Row[];
    const attachmentStatement = database.prepare(`
      SELECT id, category, original_name, mime_type, size_bytes, uploaded_at, notes
      FROM mt_attachments
      WHERE document_id = ? AND deleted_at IS NULL
        AND category IN ('quotation','contract','invoice','delivery_note','acceptance_record')
      ORDER BY uploaded_at, id
    `);
    const normalized = purchases.map((purchase) => ({
      id: purchase.id,
      purchaseDate: purchase.purchase_date,
      quantity: numeric(purchase.quantity),
      unitPrice: numeric(purchase.unit_price),
      amount: numeric(purchase.amount),
      supplierId: purchase.supplier_id,
      supplierName: purchase.supplier_name,
      documentNumber: purchase.document_number,
      invoiceNumber: purchase.invoice_number,
      contractNumber: purchase.contract_number,
      evidence: (attachmentStatement.all(purchase.document_id) as Row[]).map((attachment) => ({
        id: attachment.id,
        category: attachment.category,
        originalName: attachment.original_name,
        mimeType: attachment.mime_type,
        sizeBytes: numeric(attachment.size_bytes),
        uploadedAt: attachment.uploaded_at,
        notes: attachment.notes,
      })),
    }));
    const latest = normalized[0] ?? null;
    const previous = normalized[1] ?? null;
    const bySupplier = new Map<string, { supplierId: unknown; supplierName: unknown; prices: number[] }>();
    for (const purchase of normalized) {
      const key = String(purchase.supplierId ?? 'unknown');
      const entry = bySupplier.get(key) ?? {
        supplierId: purchase.supplierId,
        supplierName: purchase.supplierName,
        prices: [],
      };
      entry.prices.push(purchase.unitPrice);
      bySupplier.set(key, entry);
    }
    return {
      item,
      latest,
      minimumUnitPrice: normalized.length ? Math.min(...normalized.map((purchase) => purchase.unitPrice)) : null,
      maximumUnitPrice: normalized.length ? Math.max(...normalized.map((purchase) => purchase.unitPrice)) : null,
      changeFromPrevious: latest && previous ? latest.unitPrice - previous.unitPrice : null,
      recentPurchases: normalized.slice(0, 3),
      purchases: normalized,
      suppliers: [...bySupplier.values()].map((entry) => ({
        supplierId: entry.supplierId,
        supplierName: entry.supplierName,
        purchaseCount: entry.prices.length,
        minimumUnitPrice: Math.min(...entry.prices),
        maximumUnitPrice: Math.max(...entry.prices),
        latestUnitPrice: entry.prices[0],
      })),
    };
  }

  function assertPeriodOpen(date: unknown): void {
    if (typeof date !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(date)) return;
    const month = date.slice(0, 7);
    const row = database.prepare('SELECT status FROM mt_periods WHERE period_key = ?').get(month) as { status: string } | undefined;
    if (row?.status === 'closed') {
      throw new MaterialsReportingError(
        `Period ${month} is closed`, 409, 'MATERIALS_PERIOD_CLOSED',
      );
    }
  }

  function writePeriodAudit(actor: Actor, month: string, action: string, changes: Row): void {
    database.prepare(`
      INSERT INTO audit_log
        (id, entity_type, entity_id, user_id, user_name, action, changes, created_at)
      VALUES (?, 'mt_period', ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(), month, actor.id, actor.name, action, JSON.stringify(changes), new Date().toISOString(),
    );
  }

  function closePeriod(actor: Actor, monthValue: unknown): Row {
    if (!permissions.getMaterialsPermission(actor).managePeriods) {
      throw new MaterialsReportingError('Period management permission is required', 403, 'MATERIALS_REPORTING_FORBIDDEN');
    }
    const period = parseMonth(monthValue);
    return database.transaction(() => {
      const laterClosed = database.prepare(`
        SELECT period_key FROM mt_periods
        WHERE period_key > ? AND status = 'closed'
        ORDER BY period_key DESC LIMIT 1
      `).get(period.month) as { period_key: string } | undefined;
      if (laterClosed) {
        throw new MaterialsReportingError(
          `Reopen later closed period ${laterClosed.period_key} first`, 409, 'MATERIALS_PERIOD_SEQUENCE_CONFLICT',
        );
      }
      const current = database.prepare('SELECT * FROM mt_periods WHERE period_key = ?').get(period.month) as Row | undefined;
      if (current?.status === 'closed') {
        throw new MaterialsReportingError('Period is already closed', 409, 'MATERIALS_PERIOD_CONFLICT');
      }
      const pendingApprovals = database.prepare(`
        SELECT COUNT(*) AS count FROM mt_documents
        WHERE COALESCE(execution_date, request_date) >= ?
          AND COALESCE(execution_date, request_date) < ? AND status = 'pending_approval'
      `).get(period.start, period.end) as { count: number };
      const pendingExecution = database.prepare(`
        SELECT COUNT(*) AS count FROM mt_documents
        WHERE COALESCE(execution_date, request_date) >= ? AND COALESCE(execution_date, request_date) < ?
          AND status IN ('approved', 'pending_execution')
          AND document_type <> 'purchase_request'
      `).get(period.start, period.end) as { count: number };
      const missingSignedCopies = database.prepare(`
        SELECT COUNT(*) AS count FROM mt_documents
        WHERE COALESCE(execution_date, request_date) >= ? AND COALESCE(execution_date, request_date) < ?
          AND status IN ('executed', 'awaiting_signed_copy')
      `).get(period.start, period.end) as { count: number };
      const negativeQuantities = database.prepare(`
        SELECT COUNT(*) AS count FROM (
          SELECT item.id FROM mt_items item
          LEFT JOIN mt_movements movement ON movement.item_id = item.id AND movement.movement_date < ?
          GROUP BY item.id HAVING COALESCE(SUM(movement.quantity_delta), 0) < -0.000001
        ) negative
      `).get(period.end) as { count: number };
      const blockers = {
        pendingApprovals: Number(pendingApprovals.count),
        pendingExecution: Number(pendingExecution.count),
        missingSignedCopies: Number(missingSignedCopies.count),
        negativeQuantities: Number(negativeQuantities.count),
      };
      if (Object.values(blockers).some((count) => count > 0)) {
        throw new MaterialsReportingError(
          `Period cannot close: ${JSON.stringify(blockers)}`, 409, 'MATERIALS_PERIOD_BLOCKED',
        );
      }
      database.prepare(`
        INSERT INTO mt_periods(period_key,status,closed_by,closed_at)
        VALUES(?,'open',NULL,NULL)
        ON CONFLICT(period_key) DO NOTHING
      `).run(period.month);
      const systemActor: Actor = { id: actor.id, name: actor.name, role: 'admin' };
      const snapshot = getLedger(systemActor, { month: period.month });
      const versionRow = database.prepare(`
        SELECT COALESCE(MAX(version), 0) + 1 AS version
        FROM mt_period_snapshots WHERE period_key = ?
      `).get(period.month) as { version: number };
      const now = new Date().toISOString();
      database.prepare(`
        INSERT INTO mt_period_snapshots(id,period_key,version,snapshot_json,created_by,created_at)
        VALUES(?,?,?,?,?,?)
      `).run(randomUUID(), period.month, versionRow.version, JSON.stringify(snapshot), actor.id, now);
      const changed = database.prepare(`
        UPDATE mt_periods SET status='closed',closed_by=?,closed_at=? WHERE period_key=? AND status='open'
      `).run(actor.id, now, period.month);
      if (changed.changes !== 1) {
        throw new MaterialsReportingError('Period changed during close', 409, 'MATERIALS_PERIOD_CONFLICT');
      }
      writePeriodAudit(actor, period.month, 'close_period', {
        status: { old: 'open', new: 'closed' }, snapshotVersion: versionRow.version,
      });
      return database.prepare('SELECT * FROM mt_periods WHERE period_key = ?').get(period.month) as Row;
    }).immediate();
  }

  function reopenPeriod(actor: Actor, monthValue: unknown, input: unknown): Row {
    if (actor.role !== 'admin') {
      throw new MaterialsReportingError('Administrator access is required', 403, 'MATERIALS_REPORTING_FORBIDDEN');
    }
    const period = parseMonth(monthValue);
    if (!input || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype) {
      throw new MaterialsReportingError('Reopen request must contain a reason');
    }
    const body = input as Row;
    if (Reflect.ownKeys(body).length !== 1 || typeof body.reason !== 'string' || !body.reason.trim()) {
      throw new MaterialsReportingError('Reopen request must contain exactly one non-empty reason');
    }
    const reason = body.reason.trim();
    return database.transaction(() => {
      const laterClosed = database.prepare(`
        SELECT period_key FROM mt_periods
        WHERE period_key > ? AND status = 'closed'
        ORDER BY period_key DESC LIMIT 1
      `).get(period.month) as { period_key: string } | undefined;
      if (laterClosed) {
        throw new MaterialsReportingError(
          `Reopen later closed period ${laterClosed.period_key} first`, 409, 'MATERIALS_PERIOD_SEQUENCE_CONFLICT',
        );
      }
      const now = new Date().toISOString();
      const changed = database.prepare(`
        UPDATE mt_periods
        SET status='open',reopened_by=?,reopened_at=?,reopen_reason=?
        WHERE period_key=? AND status='closed'
      `).run(actor.id, now, reason, period.month);
      if (changed.changes !== 1) {
        throw new MaterialsReportingError('Only a closed period can be reopened', 409, 'MATERIALS_PERIOD_CONFLICT');
      }
      writePeriodAudit(actor, period.month, 'reopen_period', {
        status: { old: 'closed', new: 'open' }, reason,
      });
      return database.prepare('SELECT * FROM mt_periods WHERE period_key = ?').get(period.month) as Row;
    }).immediate();
  }

  function exportLedgerXlsx(actor: Actor, monthValue: unknown): { buffer: Buffer; filename: string } {
    const ledger = getLedger(actor, { month: monthValue });
    const showPrices = permissions.getMaterialsPermission(actor).viewPrices;
    const rows = ledger.rows as Row[];
    const headings = showPrices
      ? [
        ['物资与工装月度收发存明细账'],
        [`${String(ledger.month)}（参考金额，不作为会计记录）`],
        ['序号', '名称', '单位', '期初结存', '', '', '本期入库', '', '', '领用发出', '', '', '结存', '', '', '备注'],
        ['', '', '', '数量', '单价', '金额', '数量', '单价', '金额', '数量', '单价', '金额', '数量', '单价', '金额', ''],
      ]
      : [
        ['物资与工装月度收发存明细账'],
        [String(ledger.month)],
        ['序号', '名称', '单位', '期初结存', '本期入库', '退回', '领用发出', '报废', '盘点调整', '结存', '备注'],
      ];
    const data = rows.map((row, index) => {
      const opening = row.opening as Row;
      const receipts = row.receipts as Row;
      const returns = row.returns as Row;
      const issues = row.issues as Row;
      const scrap = row.scrap as Row;
      const adjustment = row.adjustment as Row;
      const closing = row.closing as Row;
      const notes = [
        numeric(returns.quantity) ? `退回 ${numeric(returns.quantity).toFixed(2)}` : '',
        numeric(scrap.quantity) ? `报废 ${numeric(scrap.quantity).toFixed(2)}` : '',
        numeric(adjustment.quantity) ? `盘点调整 ${numeric(adjustment.quantity) > 0 ? '+' : ''}${numeric(adjustment.quantity).toFixed(2)}` : '',
        showPrices && returns.priceUnavailable ? '退回参考价不可用' : '',
      ].filter(Boolean).join('；');
      if (!showPrices) {
        return [index + 1, row.name, row.unit, opening.quantity, receipts.quantity,
          returns.quantity, issues.quantity, scrap.quantity, adjustment.quantity,
          closing.quantity, notes];
      }
      const incomingQuantity = numeric(receipts.quantity) + numeric(returns.quantity);
      const incomingAmount = numeric(receipts.amount) + numeric(returns.amount);
      const outgoingQuantity = numeric(issues.quantity) + numeric(scrap.quantity);
      const outgoingAmount = numeric(issues.amount) + numeric(scrap.amount);
      return [
        index + 1, row.name, row.unit,
        opening.quantity, opening.unitPrice, opening.amount,
        incomingQuantity, incomingQuantity ? incomingAmount / incomingQuantity : 0, incomingAmount,
        outgoingQuantity, outgoingQuantity ? outgoingAmount / outgoingQuantity : 0, outgoingAmount,
        closing.quantity, closing.unitPrice, closing.amount, notes,
      ];
    });
    const sheet = XLSX.utils.aoa_to_sheet([...headings, ...data]);
    const columnCount = showPrices ? 16 : 11;
    sheet['!merges'] = showPrices
      ? [
        { s: { r: 0, c: 0 }, e: { r: 0, c: columnCount - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: columnCount - 1 } },
        { s: { r: 2, c: 3 }, e: { r: 2, c: 5 } },
        { s: { r: 2, c: 6 }, e: { r: 2, c: 8 } },
        { s: { r: 2, c: 9 }, e: { r: 2, c: 11 } },
        { s: { r: 2, c: 12 }, e: { r: 2, c: 14 } },
      ]
      : [
        { s: { r: 0, c: 0 }, e: { r: 0, c: columnCount - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: columnCount - 1 } },
      ];
    sheet['!cols'] = Array.from({ length: columnCount }, (_, index) => ({
      wch: index === 1 ? 26 : index === columnCount - 1 ? 20 : 12,
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, '月度明细账');
    const output = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    return { buffer: Buffer.from(output), filename: `materials-ledger-${String(ledger.month)}.xlsx` };
  }

  async function exportLedgerPdf(
    actor: Actor,
    monthValue: unknown,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const ledger = getLedger(actor, { month: monthValue });
    const showPrices = permissions.getMaterialsPermission(actor).viewPrices;
    const rows = ledger.rows as Row[];
    const regularFont = path.resolve(process.cwd(), 'server/fonts/NotoSansSC-Regular.ttf');
    const boldFont = path.resolve(process.cwd(), 'server/fonts/NotoSansSC-Bold.ttf');
    const document = new PDFDocument({ size: 'A3', layout: 'landscape', margin: 36 });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    const completed = new Promise<Buffer>((resolve, reject) => {
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);
    });
    const left = 36;
    const pageBottom = 805;
    const cell = (
      text: string, x: number, y: number, width: number, height: number,
      options: { bold?: boolean; align?: 'left' | 'center' | 'right'; size?: number } = {},
    ): void => {
      document.rect(x, y, width, height).lineWidth(0.45).stroke('#6B7280');
      document.font(options.bold ? boldFont : regularFont)
        .fontSize(options.size ?? 7.5).fillColor('#111827')
        .text(text, x + 3, y + Math.max(3, (height - (options.size ?? 7.5) - 2) / 2), {
          width: width - 6,
          height: height - 4,
          align: options.align ?? 'center',
          ellipsis: true,
          lineBreak: false,
        });
    };
    const drawPageHeader = (): number => {
      document.font(boldFont).fontSize(18).fillColor('#111827')
        .text('物资与工装月度收发存明细账', left, 28, { width: 1118, align: 'center' });
      document.font(regularFont).fontSize(9).fillColor('#374151').text(
        `${String(ledger.month)}${showPrices ? ' · 参考金额，不作为会计记录' : ''}`,
        left, 56, { width: 1118, align: 'center' },
      );
      if (showPrices) {
        const widths = [32, 150, 36, ...Array(12).fill(60), 180];
        let x = left;
        for (const [label, index] of [['序号', 0], ['名称 / 编码', 1], ['单位', 2]] as const) {
          cell(label, x, 78, widths[index], 42, { bold: true }); x += widths[index];
        }
        for (const label of ['期初结存', '本期入库', '领用发出', '结存']) {
          cell(label, x, 78, 180, 21, { bold: true });
          let subX = x;
          for (const sub of ['数量', '单价', '金额']) {
            cell(sub, subX, 99, 60, 21, { bold: true }); subX += 60;
          }
          x += 180;
        }
        cell('备注', x, 78, 180, 42, { bold: true });
        return 120;
      }
      const widths = [32, 250, 40, ...Array(7).fill(90), 166];
      let x = left;
      for (const [index, label] of ['序号', '名称 / 编码', '单位', '期初', '入库', '退回', '领用', '报废', '调整', '结存', '备注'].entries()) {
        cell(label, x, 84, widths[index], 28, { bold: true }); x += widths[index];
      }
      return 112;
    };
    let y = drawPageHeader();
    for (const [index, row] of rows.entries()) {
      if (y + 24 > pageBottom) {
        document.addPage({ size: 'A3', layout: 'landscape', margin: 36 });
        y = drawPageHeader();
      }
      const opening = row.opening as Row;
      const receipts = row.receipts as Row;
      const returns = row.returns as Row;
      const issues = row.issues as Row;
      const scrap = row.scrap as Row;
      const adjustment = row.adjustment as Row;
      const closing = row.closing as Row;
      if (showPrices) {
        const incomingQuantity = numeric(receipts.quantity) + numeric(returns.quantity);
        const incomingAmount = numeric(receipts.amount) + numeric(returns.amount);
        const outgoingQuantity = numeric(issues.quantity) + numeric(scrap.quantity);
        const outgoingAmount = numeric(issues.amount) + numeric(scrap.amount);
        const values = [
          String(index + 1), `${String(row.name)} / ${String(row.code)}`, String(row.unit),
          numeric(opening.quantity).toFixed(2), numeric(opening.unitPrice).toFixed(4), numeric(opening.amount).toFixed(2),
          incomingQuantity.toFixed(2), (incomingQuantity ? incomingAmount / incomingQuantity : 0).toFixed(4), incomingAmount.toFixed(2),
          outgoingQuantity.toFixed(2), (outgoingQuantity ? outgoingAmount / outgoingQuantity : 0).toFixed(4), outgoingAmount.toFixed(2),
          numeric(closing.quantity).toFixed(2), numeric(closing.unitPrice).toFixed(4), numeric(closing.amount).toFixed(2),
          [
            numeric(returns.quantity) ? `退回 ${numeric(returns.quantity).toFixed(2)}` : '',
            numeric(scrap.quantity) ? `报废 ${numeric(scrap.quantity).toFixed(2)}` : '',
            numeric(adjustment.quantity) ? `盘点调整 ${numeric(adjustment.quantity) > 0 ? '+' : ''}${numeric(adjustment.quantity).toFixed(2)}` : '',
            returns.priceUnavailable ? '退回参考价不可用' : '',
          ].filter(Boolean).join('；'),
        ];
        const widths = [32, 150, 36, ...Array(12).fill(60), 180];
        let x = left;
        values.forEach((value, column) => {
          cell(value, x, y, widths[column], 24, {
            align: column === 1 ? 'left' : column >= 3 && column <= 14 ? 'right' : 'center',
          });
          x += widths[column];
        });
      } else {
        const values = [
          String(index + 1), `${String(row.name)} / ${String(row.code)}`, String(row.unit),
          numeric(opening.quantity).toFixed(2), numeric(receipts.quantity).toFixed(2), numeric(returns.quantity).toFixed(2),
          numeric(issues.quantity).toFixed(2), numeric(scrap.quantity).toFixed(2), numeric(adjustment.quantity).toFixed(2),
          numeric(closing.quantity).toFixed(2), [
            numeric(returns.quantity) ? `退回 ${numeric(returns.quantity).toFixed(2)}` : '',
            numeric(scrap.quantity) ? `报废 ${numeric(scrap.quantity).toFixed(2)}` : '',
            numeric(adjustment.quantity) ? `盘点调整 ${numeric(adjustment.quantity) > 0 ? '+' : ''}${numeric(adjustment.quantity).toFixed(2)}` : '',
          ].filter(Boolean).join('；'),
        ];
        const widths = [32, 250, 40, ...Array(7).fill(90), 166];
        let x = left;
        values.forEach((value, column) => {
          cell(value, x, y, widths[column], 24, { align: column === 1 ? 'left' : column >= 3 ? 'right' : 'center' });
          x += widths[column];
        });
      }
      y += 24;
    }
    document.end();
    return { buffer: await completed, filename: `materials-ledger-${String(ledger.month)}.pdf` };
  }

  return {
    getOverview, getLedger, getPriceHistory, assertPeriodOpen, closePeriod, reopenPeriod,
    exportLedgerXlsx, exportLedgerPdf,
  };
}
