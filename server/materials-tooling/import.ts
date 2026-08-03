import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import * as XLSX from 'xlsx';

type Actor = { id: string; name: string; role: string };
type JsonObject = Record<string, unknown>;
type PermissionPort = {
  getMaterialsPermission(actor: Actor): { manageMaterials: boolean; viewPrices: boolean };
};

export class MaterialsImportError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
    readonly code = 'MATERIALS_IMPORT_INVALID',
  ) {
    super(message);
    this.name = 'MaterialsImportError';
  }
}

type ImportRow = {
  code: string;
  unit: string;
  quantity: number;
  unitPrice?: number;
  supplierCode?: string;
  supplierName?: string;
  supplierId?: string;
};

type PreviewResult = {
  items: ImportRow[];
  missingItems: string[];
  errors: string[];
  warnings: string[];
};

export function createMaterialsImportService(
  database: Database.Database,
  permissions: PermissionPort,
) {
  function assertManage(actor: Actor): void {
    if (actor.role !== 'admin' && !permissions.getMaterialsPermission(actor).manageMaterials) {
      throw new MaterialsImportError('Material management permission is required', 403, 'MATERIALS_IMPORT_FORBIDDEN');
    }
  }

  function preview(actor: Actor, buffer: Buffer): PreviewResult {
    assertManage(actor);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new MaterialsImportError('Workbook is empty');
    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    if (raw.length === 0) throw new MaterialsImportError('Sheet has no data rows');

    const result: PreviewResult = { items: [], missingItems: [], errors: [], warnings: [] };
    const itemsByCode = new Map(
      (database.prepare('SELECT code, unit FROM mt_items WHERE is_active = 1').all() as { code: string; unit: string }[])
        .map(row => [row.code.toUpperCase(), row] as const),
    );
    const seenCodes = new Set<string>();
    const suppliers = database.prepare('SELECT id, code, name FROM mt_suppliers WHERE is_active = 1')
      .all() as { id: string; code: string; name: string }[];
    const suppliersByCode = new Map(suppliers.map(supplier => [supplier.code.toUpperCase(), supplier]));
    const suppliersByName = new Map(suppliers.map(supplier => [supplier.name.trim().toLocaleLowerCase(), supplier]));

    for (let i = 0; i < raw.length; i += 1) {
      const row = raw[i];
      const rowNum = i + 2; // 1-indexed + header
      const code = String(row.code || row.Code || row.CODE || '').trim().toUpperCase();
      const unit = String(row.unit || row.Unit || row.UOM || '').trim();
      const quantity = Number(row.quantity || row.Quantity || row.QTY || row.opening_balance || 0);
      const rawUnitPrice = row.unit_price ?? row.UnitPrice ?? row.unitPrice;
      const supplierCode = String(row.supplier_code || row.SupplierCode || '').trim();
      const supplierName = String(row.supplier_name || row.SupplierName || '').trim();

      if (!code) { result.errors.push(`Row ${rowNum}: missing item code`); continue; }
      if (seenCodes.has(code)) { result.errors.push(`Row ${rowNum} (${code}): duplicate item code`); continue; }
      seenCodes.add(code);
      if (!Number.isFinite(quantity) || quantity <= 0) { result.errors.push(`Row ${rowNum} (${code}): quantity must be a positive number`); continue; }

      const material = itemsByCode.get(code);
      if (!material) { result.missingItems.push(code); continue; }
      if (!unit) { result.errors.push(`Row ${rowNum} (${code}): unit is required`); continue; }
      if (unit.toLocaleLowerCase() !== material.unit.trim().toLocaleLowerCase()) {
        result.errors.push(`Row ${rowNum} (${code}): unit must match material unit ${material.unit}`);
        continue;
      }

      const importRow: ImportRow = { code, unit: material.unit, quantity };
      if (rawUnitPrice !== undefined && rawUnitPrice !== null && String(rawUnitPrice).trim() !== '') {
        const unitPrice = Number(rawUnitPrice);
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          result.errors.push(`Row ${rowNum} (${code}): unit price must be zero or a positive number`);
          continue;
        }
        importRow.unitPrice = unitPrice;
        if (supplierCode || supplierName) {
          if (unitPrice <= 0) {
            result.errors.push(`Row ${rowNum} (${code}): supplier history requires a positive unit price`);
            continue;
          }
          const supplier = supplierCode
            ? suppliersByCode.get(supplierCode.toUpperCase())
            : suppliersByName.get(supplierName.toLocaleLowerCase());
          if (!supplier || (supplierName && supplier.name.toLocaleLowerCase() !== supplierName.toLocaleLowerCase())) {
            result.errors.push(`Row ${rowNum} (${code}): active supplier was not found`);
            continue;
          }
          importRow.supplierCode = supplierCode;
          importRow.supplierName = supplierName;
          importRow.supplierId = supplier.id;
        }
      }

      result.items.push(importRow);
    }

    if (result.missingItems.length > 0) {
      result.warnings.push(`Unknown items: ${result.missingItems.join(', ')}`);
    }

    return result;
  }

  function confirmImport(actor: Actor, buffer: Buffer, input: { month: string; sourceWorkbook: string; confirm?: boolean }): { created: number } {
    assertManage(actor);
    if (!input.confirm) throw new MaterialsImportError('confirm: true is required to execute import');
    if (!input.month || !/^\d{4}-\d{2}$/.test(input.month)) throw new MaterialsImportError('month must be YYYY-MM format');
    if (!input.sourceWorkbook || !input.sourceWorkbook.trim()) throw new MaterialsImportError('sourceWorkbook name is required');

    const previewResult = preview(actor, buffer);
    if (previewResult.errors.length > 0) throw new MaterialsImportError(`Preview found ${previewResult.errors.length} errors; fix and retry`);
    if (previewResult.missingItems.length > 0) {
      throw new MaterialsImportError(`Unknown item codes: ${previewResult.missingItems.join(', ')}`);
    }

    const month = input.month.trim();
    const sourceWorkbook = input.sourceWorkbook.trim();
    const now = new Date().toISOString();
    const actorId = actor.id;

    return database.transaction(() => {
      const period = database.prepare('SELECT status FROM mt_periods WHERE period_key = ?')
        .get(month) as { status: string } | undefined;
      if (period?.status === 'closed') {
        throw new MaterialsImportError(`Period ${month} is closed`, 409, 'MATERIALS_PERIOD_CLOSED');
      }

      let created = 0;
      const stmt = database.prepare(`
        INSERT INTO mt_movements
          (id, item_id, movement_type, quantity_delta, reference_unit_price,
           movement_date, created_by, created_at, supplier_id,
           reference_quantity, source_workbook, cutover_period)
        VALUES (?, ?, 'opening_balance', ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?)
      `);
      const referencePurchase = database.prepare(`
        INSERT INTO mt_movements
          (id, item_id, movement_type, quantity_delta, reference_unit_price,
           movement_date, created_by, created_at, supplier_id,
           reference_quantity, source_workbook, cutover_period)
        VALUES (?, ?, 'reference_purchase', 0, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const row of previewResult.items) {
        const item = database.prepare('SELECT id, unit FROM mt_items WHERE code = ? AND is_active = 1')
          .get(row.code) as { id: string; unit: string } | undefined;
        if (!item) throw new MaterialsImportError(`Item ${row.code} not found during import (concurrent change)`);
        if (item.unit.trim().toLocaleLowerCase() !== row.unit.trim().toLocaleLowerCase()) {
          throw new MaterialsImportError(`Item ${row.code} unit changed during import`);
        }
        const duplicate = database.prepare(`
          SELECT 1 FROM mt_movements
          WHERE item_id = ? AND movement_type = 'opening_balance' AND cutover_period = ?
        `).get(item.id, month);
        if (duplicate) {
          throw new MaterialsImportError(`Opening balance for ${row.code} already exists in ${month}`, 409, 'MATERIALS_IMPORT_DUPLICATE');
        }

        const id = randomUUID();
        stmt.run(
          id, item.id, row.quantity,
          row.unitPrice != null ? row.unitPrice : null,
          month + '-01', actorId, now, null,
          null, sourceWorkbook, month,
        );
        created += 1;
        if (row.supplierId && row.unitPrice != null && row.unitPrice > 0) {
          referencePurchase.run(
            randomUUID(), item.id, row.unitPrice, month + '-01', actorId, now,
            row.supplierId, row.quantity, sourceWorkbook, month,
          );
          created += 1;
        }
      }

      return { created };
    }).immediate();
  }

  return { preview, confirmImport };
}
