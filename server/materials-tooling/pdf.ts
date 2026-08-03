import { createHash, randomUUID } from 'node:crypto';
import {
  mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type Database from 'better-sqlite3';

const require = createRequire(import.meta.url);

declare namespace PDFKit {
  interface PDFDocument extends NodeJS.ReadableStream {
    page: { width: number; height: number };
    x: number;
    y: number;
    info: Record<string, unknown>;
    addPage(): this;
    bufferedPageRange(): { start: number; count: number };
    fill(): this;
    fillColor(color: string): this;
    font(source: string): this;
    fontSize(size: number): this;
    heightOfString(text: string, options?: Record<string, unknown>): number;
    lineTo(x: number, y: number): this;
    lineWidth(width: number): this;
    moveTo(x: number, y: number): this;
    rect(x: number, y: number, width: number, height: number): this;
    restore(): this;
    save(): this;
    stroke(color?: string): this;
    strokeColor(color: string): this;
    switchToPage(index: number): this;
    text(text: string, x?: number, y?: number, options?: Record<string, unknown>): this;
    end(): void;
  }
}

type PdfConstructor = new (options?: Record<string, unknown>) => PDFKit.PDFDocument;
const PDFDocument = require('pdfkit') as PdfConstructor;

type Actor = { id: string; name: string; role: string };
type JsonObject = Record<string, unknown>;
type PdfVariant = 'application' | 'approved';

type PermissionPort = {
  getMaterialsPermission(actor: Actor): { viewPrices: boolean };
};

export type MaterialPdfOptions = {
  storageRoot?: string;
  now?: () => Date;
};

type FrozenApproval = {
  approver_user_id: string;
  approver_name: string;
  comment: string | null;
  decided_at: string;
};

export type MaterialDocumentPdfInput = {
  header: JsonObject;
  lines: JsonObject[];
  applicantName: string;
  approval?: FrozenApproval;
  generatedAt: string;
  showPrices: boolean;
};

export type MaterialPdfResult = {
  buffer: Buffer;
  filename: string;
  redacted: boolean;
  sha256: string;
};

const DOCUMENT_TYPE_NAMES: Record<string, string> = {
  purchase_request: '物料采购申请单',
  purchase_receipt: '采购入库验收单',
  material_issue: '物料领用单',
  material_return: '物料退回单',
  scrap: '物料报废单',
  count_adjustment: '盘点调整单',
  tooling_movement: '工装流转单',
};
const PURCHASE_TYPES = new Set(['purchase_request', 'purchase_receipt']);
const FROZEN_STATUSES = new Set(['pending_approval']);
const REGULAR_FONT = path.resolve(process.cwd(), 'server/fonts/NotoSansSC-Regular.ttf');
const BOLD_FONT = path.resolve(process.cwd(), 'server/fonts/NotoSansSC-Bold.ttf');
const PAGE_MARGIN = 42;
const CONTENT_WIDTH = 511;

export class MaterialsPdfError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
    readonly code = 'MATERIALS_PDF_INVALID',
  ) {
    super(message);
  }
}

function isPlainObject(value: unknown): value is JsonObject {
  return value !== null
    && typeof value === 'object'
    && Object.getPrototypeOf(value) === Object.prototype;
}

function textValue(value: unknown, fallback = '-'): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function formatNumber(value: unknown, digits = 2): string {
  const number = numberValue(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(digits);
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return parsed.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

function drawRule(doc: PDFKit.PDFDocument, y: number): void {
  doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + CONTENT_WIDTH, y)
    .lineWidth(0.6).strokeColor('#9CA3AF').stroke();
}

function drawDocumentHeader(doc: PDFKit.PDFDocument, input: MaterialDocumentPdfInput, variant: PdfVariant): void {
  const header = input.header;
  const type = String(header.document_type);
  doc.font(BOLD_FONT).fontSize(16).fillColor('#17202A')
    .text('JEKIN HPM (Jiangsu) Co., Ltd.', PAGE_MARGIN, 38, { width: CONTENT_WIDTH, align: 'center' });
  doc.font(BOLD_FONT).fontSize(20)
    .text(DOCUMENT_TYPE_NAMES[type] ?? '物料与工装单据', PAGE_MARGIN, 66, { width: CONTENT_WIDTH, align: 'center' });
  doc.font(REGULAR_FONT).fontSize(8.5).fillColor('#4B5563')
    .text(
      '单号：' + textValue(header.document_number)
      + '    版本：v' + String(header.version)
      + '    版式：' + (variant === 'approved' ? '审批版' : '申请版'),
      PAGE_MARGIN, 96, { width: CONTENT_WIDTH, align: 'center' },
    );
  drawRule(doc, 115);
  doc.font(REGULAR_FONT).fontSize(9).fillColor('#1F2937');
  let y = 126;
  const field = (label: string, value: unknown, x: number, width: number): void => {
    const rendered = optionalText(value);
    if (rendered) doc.text(label + '：' + rendered, x, y, { width, lineBreak: false, ellipsis: true });
  };
  field('申请人', input.applicantName, PAGE_MARGIN, 160);
  field('部门', header.department, 215, 160);
  field('申请日期', header.request_date, 395, 158);
  y += 19;
  field('要求日期', header.required_date, PAGE_MARGIN, 160);
  field(type === 'purchase_receipt' ? '收货/执行日期' : '执行日期', header.execution_date, 215, 170);
  field('领用/验收人', optionalText(header.recipient_display_name) ?? header.recipient_name, 395, 158);
  const hidePurchaseDetails = PURCHASE_TYPES.has(type) && !input.showPrices;
  if (PURCHASE_TYPES.has(type) && !hidePurchaseDetails) {
    y += 19;
    field('供应商', optionalText(header.supplier_name) ?? header.supplier_id, PAGE_MARGIN, 160);
    field('合同号', header.contract_number, 215, 170);
    field('发票号', header.invoice_number, 395, 158);
  }
  if (!hidePurchaseDetails) {
    const purpose = optionalText(header.purpose);
    if (purpose) {
      y += 19;
      doc.text('用途：' + purpose, PAGE_MARGIN, y, { width: CONTENT_WIDTH, height: 18, ellipsis: true });
    }
    const inspection = optionalText(header.inspection_result);
    if (inspection) {
      y += 19;
      doc.text('验收结果：' + inspection, PAGE_MARGIN, y, { width: CONTENT_WIDTH, height: 18, ellipsis: true });
    }
    const notes = optionalText(header.notes);
    if (notes) {
      y += 19;
      doc.text('单据备注：' + notes, PAGE_MARGIN, y, { width: CONTENT_WIDTH, height: 18, ellipsis: true });
    }
  }
  const ruleY = y + 25;
  drawRule(doc, ruleY);
  doc.y = ruleY + 11;
}

type Column = { label: string; width: number; align?: string };

function columns(showPrices: boolean): Column[] {
  if (showPrices) {
    return [
      { label: '序号', width: 32, align: 'center' },
      { label: '名称/代码', width: 122 },
      { label: '规格', width: 88 },
      { label: '单位', width: 44, align: 'center' },
      { label: '数量', width: 55, align: 'right' },
      { label: '含税单价', width: 78, align: 'right' },
      { label: '金额', width: 92, align: 'right' },
    ];
  }
  return [
    { label: '序号', width: 38, align: 'center' },
    { label: '名称/代码', width: 190 },
    { label: '规格', width: 125 },
    { label: '单位', width: 58, align: 'center' },
    { label: '申请/执行数量', width: 100, align: 'right' },
  ];
}

function drawTableHeader(doc: PDFKit.PDFDocument, tableColumns: Column[], y: number): number {
  doc.save().rect(PAGE_MARGIN, y, CONTENT_WIDTH, 24).fillColor('#E8EEF5').fill().restore();
  let x = PAGE_MARGIN;
  doc.font(BOLD_FONT).fontSize(8).fillColor('#243447');
  for (const column of tableColumns) {
    doc.text(column.label, x + 4, y + 7, {
      width: column.width - 8, align: column.align ?? 'left', lineBreak: false,
    });
    x += column.width;
  }
  doc.moveTo(PAGE_MARGIN, y + 24).lineTo(PAGE_MARGIN + CONTENT_WIDTH, y + 24)
    .lineWidth(0.5).strokeColor('#9CA3AF').stroke();
  return y + 24;
}

function addContinuationPage(doc: PDFKit.PDFDocument, input: MaterialDocumentPdfInput, variant: PdfVariant): number {
  doc.addPage();
  doc.font(BOLD_FONT).fontSize(10).fillColor('#17202A')
    .text(
      (DOCUMENT_TYPE_NAMES[String(input.header.document_type)] ?? '物料单据')
      + ' - ' + textValue(input.header.document_number) + '（续）',
      PAGE_MARGIN, 38, { width: CONTENT_WIDTH },
    );
  doc.font(REGULAR_FONT).fontSize(8).fillColor('#4B5563')
    .text('v' + String(input.header.version) + ' / ' + (variant === 'approved' ? '审批版' : '申请版'), PAGE_MARGIN, 55);
  drawRule(doc, 72);
  return 86;
}

function lineCells(line: JsonObject, input: MaterialDocumentPdfInput): string[] {
  const requested = numberValue(line.requested_quantity);
  const executed = numberValue(line.execution_quantity);
  const quantity = executed > 0 ? executed : requested;
  const hidePurchaseDetails = PURCHASE_TYPES.has(String(input.header.document_type)) && !input.showPrices;
  const notes = hidePurchaseDetails ? null : optionalText(line.notes);
  const itemLabel = textValue(line.item_name) + ' / ' + textValue(line.item_code)
    + (notes ? '\n备注：' + notes : '');
  const base = [
    String(line.line_number),
    itemLabel,
    textValue(line.specification),
    textValue(line.unit),
    formatNumber(quantity, 4),
  ];
  if (!input.showPrices) return base;
  const price = numberValue(line.tax_inclusive_unit_price);
  return [...base, price.toFixed(2), (quantity * price).toFixed(2)];
}

function drawLines(doc: PDFKit.PDFDocument, input: MaterialDocumentPdfInput, variant: PdfVariant): void {
  const tableColumns = columns(input.showPrices);
  let y = drawTableHeader(doc, tableColumns, doc.y);
  doc.font(REGULAR_FONT).fontSize(8).fillColor('#1F2937');
  for (const line of input.lines) {
    const cells = lineCells(line, input);
    let rowHeight = 24;
    for (let index = 0; index < cells.length; index += 1) {
      rowHeight = Math.max(rowHeight, doc.heightOfString(cells[index], {
        width: tableColumns[index].width - 8, lineGap: 1,
      }) + 10);
    }
    if (y + rowHeight > doc.page.height - 96) {
      y = addContinuationPage(doc, input, variant);
      y = drawTableHeader(doc, tableColumns, y);
      doc.font(REGULAR_FONT).fontSize(8).fillColor('#1F2937');
    }
    let x = PAGE_MARGIN;
    for (let index = 0; index < cells.length; index += 1) {
      const column = tableColumns[index];
      doc.text(cells[index], x + 4, y + 6, {
        width: column.width - 8, height: rowHeight - 8,
        align: column.align ?? 'left', ellipsis: true,
      });
      x += column.width;
    }
    doc.moveTo(PAGE_MARGIN, y + rowHeight).lineTo(PAGE_MARGIN + CONTENT_WIDTH, y + rowHeight)
      .lineWidth(0.35).strokeColor('#D1D5DB').stroke();
    y += rowHeight;
  }
  doc.y = y + 12;
}

function ensureSpace(doc: PDFKit.PDFDocument, input: MaterialDocumentPdfInput, variant: PdfVariant, height: number): void {
  if (doc.y + height <= doc.page.height - 74) return;
  doc.y = addContinuationPage(doc, input, variant);
}

function drawApprovalAndSignatures(doc: PDFKit.PDFDocument, input: MaterialDocumentPdfInput, variant: PdfVariant): void {
  if (variant === 'approved' && input.approval) {
    ensureSpace(doc, input, variant, 72);
    const comment = PURCHASE_TYPES.has(String(input.header.document_type)) && !input.showPrices
      ? '已脱敏'
      : textValue(input.approval.comment);
    doc.font(BOLD_FONT).fontSize(9).fillColor('#17202A').text('线上审批记录', PAGE_MARGIN, doc.y);
    doc.font(REGULAR_FONT).fontSize(8.5).fillColor('#374151')
      .text('审批人：' + input.approval.approver_name + '    时间：' + formatDateTime(input.approval.decided_at), PAGE_MARGIN, doc.y + 7, { width: CONTENT_WIDTH })
      .text('意见：' + comment, PAGE_MARGIN, doc.y + 5, { width: CONTENT_WIDTH, height: 28, ellipsis: true });
    doc.y += 12;
  }
  ensureSpace(doc, input, variant, 90);
  drawRule(doc, doc.y);
  const type = String(input.header.document_type);
  let labels: string[];
  if (type === 'tooling_movement') {
    labels = ['申请人签字', '审批人签字', '移交人签字', '接收人签字'];
  } else {
    const finalLabel = type === 'material_issue' ? '领用人签字' : '领用/验收签字';
    labels = ['申请人签字', '审批人签字', '仓管签字', finalLabel];
  }
  const width = CONTENT_WIDTH / labels.length;
  const top = doc.y + 18;
  doc.font(REGULAR_FONT).fontSize(8.5).fillColor('#374151');
  labels.forEach((label, index) => {
    doc.text(label + '：', PAGE_MARGIN + index * width, top, { width: width - 8 });
    doc.moveTo(PAGE_MARGIN + index * width, top + 42)
      .lineTo(PAGE_MARGIN + (index + 1) * width - 10, top + 42)
      .lineWidth(0.5).strokeColor('#9CA3AF').stroke();
  });
  doc.y = top + 56;
}

function drawToolingRequest(doc: PDFKit.PDFDocument, input: MaterialDocumentPdfInput): void {
  const header = input.header;
  if (String(header.document_type) !== 'tooling_movement') return;
  const request = header.tooling_request as Record<string, unknown> | undefined;
  if (!request) return;

  ensureSpace(doc, input, 'approved', 120);
  drawRule(doc, doc.y);

  const y = doc.y + 8;
  const leftX = PAGE_MARGIN;
  const rightX = PAGE_MARGIN + 260;
  const labelW = 70;
  const valueW = 180;
  doc.font(BOLD_FONT).fontSize(9).fillColor('#17202A').text('工装信息', leftX, y);
  doc.font(REGULAR_FONT).fontSize(8.5).fillColor('#1F2937');

  const field = (label: string, value: unknown, x: number, rowY: number): void => {
    const rendered = textValue(value);
    doc.fillColor('#4B5563').text(label, x, rowY, { width: labelW, lineBreak: false });
    doc.fillColor('#1F2937').text(rendered, x + labelW, rowY, { width: valueW, lineBreak: false, ellipsis: true });
  };

  const actionName = (action: unknown): string => {
    switch (action) {
      case 'issue': return '领用';
      case 'return': return '归还';
      case 'loan': return '借出';
      case 'transfer': return '转交';
      case 'repair': return '送修';
      case 'repair_completion': return '修复完成';
      case 'disposal': return '报废';
      case 'loss_report': return '遗失报告';
      default: return textValue(action);
    }
  };

  const statusName = (status: unknown): string => {
    switch (status) {
      case 'in_stock': return '在库';
      case 'in_use': return '在用';
      case 'loaned': return '借出';
      case 'under_repair': return '维修中';
      case 'disposed': return '已报废';
      case 'lost': return '已遗失';
      default: return textValue(status);
    }
  };

  const targetStatus = (action: unknown, currentStatus: unknown): unknown => {
    switch (action) {
      case 'issue': return 'in_use';
      case 'return': return 'in_stock';
      case 'loan': return 'loaned';
      case 'transfer': return currentStatus;
      case 'repair': return 'under_repair';
      case 'repair_completion': return 'in_stock';
      case 'disposal': return 'disposed';
      case 'loss_report': return 'lost';
      default: return null;
    }
  };

  const row1 = y + 16;
  field('编号：', request.asset_code, leftX, row1);
  field('名称：', request.asset_name, rightX, row1);

  const row2 = row1 + 20;
  field('规格：', request.asset_specification, leftX, row2);
  field('动作：', actionName(request.action), rightX, row2);

  const row3 = row2 + 20;
  field('当前状态：', statusName(request.current_status), leftX, row3);
  field('目标状态：', statusName(targetStatus(request.action, request.current_status)), rightX, row3);

  const row4 = row3 + 20;
  const toCustodian = request.to_custodian_name
    ?? (request.to_custodian_user_id ? String(request.to_custodian_user_id).slice(0, 8) : null);
  field('目标保管人：', toCustodian, leftX, row4);
  field('目标位置：', request.to_location, rightX, row4);

  let lastY = row4;
  const reason = request.reason;
  if (reason && String(reason).trim()) {
    lastY = row4 + 20;
    doc.fillColor('#4B5563').text('原因：', leftX, lastY, { width: labelW, lineBreak: false });
    doc.fillColor('#1F2937').text(String(reason).trim(), leftX + labelW, lastY, { width: CONTENT_WIDTH - labelW - PAGE_MARGIN, height: 36, ellipsis: true });
  }

  // Draw a visible border around the tooling info section
  const sectionTop = y - 2;
  const sectionHeight = (lastY + 24) - sectionTop;
  doc.rect(PAGE_MARGIN, sectionTop, CONTENT_WIDTH, sectionHeight)
    .lineWidth(0.5).strokeColor('#D1D5DB').stroke();

  doc.y = sectionTop + sectionHeight + 8;
}

export function generateMaterialDocumentPdf(
  input: MaterialDocumentPdfInput,
  variant: PdfVariant,
): PDFKit.PDFDocument {
  const stableDate = new Date(input.generatedAt);
  const doc = new PDFDocument({
    size: 'A4', layout: 'portrait', margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
    bufferPages: true, compress: false, autoFirstPage: true,
    info: {
      Title: textValue(input.header.document_number) + ' ' + (variant === 'approved' ? '审批版' : '申请版'),
      Author: 'JEKIN HPM (Jiangsu) Co., Ltd.',
      CreationDate: stableDate,
      ModDate: stableDate,
    },
  });
  doc.font(REGULAR_FONT);
  drawDocumentHeader(doc, input, variant);
  drawToolingRequest(doc, input);
  drawLines(doc, input, variant);
  drawApprovalAndSignatures(doc, input, variant);
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc.font(REGULAR_FONT).fontSize(7.5).fillColor('#6B7280')
      .text('生成时间：' + formatDateTime(input.generatedAt), PAGE_MARGIN, doc.page.height - 76, { width: 360, lineBreak: false })
      .text('第 ' + (index + 1) + ' / ' + range.count + ' 页', 430, doc.page.height - 76, { width: 123, align: 'right', lineBreak: false });
  }
  return doc;
}

function bufferPdf(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function secureStorageRoot(configured?: string): string {
  const root = path.resolve(configured ?? path.resolve(process.cwd(), 'data/materials-tooling/snapshots'));
  for (const unsafe of ['public', 'dist']) {
    const unsafeRoot = path.resolve(process.cwd(), unsafe);
    if (root === unsafeRoot || root.startsWith(unsafeRoot + path.sep)) {
      throw new MaterialsPdfError('PDF snapshots must use private storage', 409, 'MATERIALS_PDF_STORAGE_INVALID');
    }
  }
  return root;
}

export function createMaterialsPdfService(
  database: Database.Database,
  permissions: PermissionPort,
  options: MaterialPdfOptions = {},
) {
  const storageRoot = secureStorageRoot(options.storageRoot);
  const now = options.now ?? (() => new Date());

  function audit(actor: Actor, documentId: string, action: string, details: JsonObject): void {
    database.prepare('INSERT INTO audit_log (id,entity_type,entity_id,user_id,user_name,action,changes,created_at) VALUES (?,?,?,?,?,?,?,?)').run(
      randomUUID(), 'mt_document', documentId, actor.id, actor.name, action,
      JSON.stringify(details), now().toISOString(),
    );
  }

  function validatedInput(documentId: string, variant: PdfVariant, showPrices: boolean): {
    input: MaterialDocumentPdfInput;
    version: number;
    documentNumber: string;
    procurement: boolean;
  } {
    const current = database.prepare('SELECT * FROM mt_documents WHERE id=?').get(documentId) as JsonObject | undefined;
    if (!current) throw new MaterialsPdfError('Document not found', 404, 'MATERIALS_DOCUMENT_NOT_FOUND');
    const version = Number(current.version);
    const frozen = database.prepare('SELECT * FROM mt_document_versions WHERE document_id=? AND version=?').get(documentId, version) as JsonObject | undefined;
    if (!frozen) throw new MaterialsPdfError('Document version is not frozen', 409, 'MATERIALS_PDF_NOT_READY');
    const snapshotJson = String(frozen.snapshot_json);
    if (createHash('sha256').update(snapshotJson).digest('hex') !== frozen.snapshot_sha256) {
      throw new MaterialsPdfError('Document version integrity check failed', 409, 'MATERIALS_DOCUMENT_INTEGRITY_ERROR');
    }
    let parsed: unknown;
    try { parsed = JSON.parse(snapshotJson); } catch { parsed = null; }
    if (!isPlainObject(parsed) || !isPlainObject(parsed.header) || !Array.isArray(parsed.lines)) {
      throw new MaterialsPdfError('Document version integrity check failed', 409, 'MATERIALS_DOCUMENT_INTEGRITY_ERROR');
    }
    const header = parsed.header;
    const lines = parsed.lines;
    if (
      header.id !== documentId
      || Number(header.version) !== version
      || header.document_type !== current.document_type
      || !FROZEN_STATUSES.has(String(header.status))
      || typeof header.document_number !== 'string'
      || typeof header.applicant_name !== 'string'
      || !header.applicant_name.trim()
      || (header.supplier_id != null
        && (typeof header.supplier_name !== 'string' || !header.supplier_name.trim()))
      || lines.some((line) => !isPlainObject(line)
        || !Number.isInteger(Number(line.line_number))
        || numberValue(line.requested_quantity) <= 0
        || typeof line.unit !== 'string'
        || typeof line.item_code !== 'string'
        || !line.item_code.trim()
        || typeof line.item_name !== 'string'
        || !line.item_name.trim()
        || (line.specification !== null && typeof line.specification !== 'string'))
    ) {
      throw new MaterialsPdfError('Document version integrity check failed', 409, 'MATERIALS_DOCUMENT_INTEGRITY_ERROR');
    }
    let approval: FrozenApproval | undefined;
    if (variant === 'approved') {
      if (typeof header.assigned_approver_name !== 'string' || !header.assigned_approver_name.trim()) {
        throw new MaterialsPdfError('Document version integrity check failed', 409, 'MATERIALS_DOCUMENT_INTEGRITY_ERROR');
      }
      const frozenApproval = database.prepare(
        "SELECT approver_user_id,comment,decided_at FROM mt_approvals WHERE document_id=? AND version=? AND decision='approved' AND approver_user_id=?",
      ).get(documentId, version, String(header.assigned_approver_user_id)) as Omit<FrozenApproval, 'approver_name'> | undefined;
      if (!frozenApproval) throw new MaterialsPdfError('Approved PDF is not available', 409, 'MATERIALS_PDF_NOT_APPROVED');
      approval = { ...frozenApproval, approver_name: header.assigned_approver_name.trim() };
    }
    const procurement = PURCHASE_TYPES.has(String(header.document_type));
    return {
      input: {
        header,
        lines: lines as JsonObject[],
        applicantName: header.applicant_name.trim(),
        approval,
        generatedAt: String(approval?.decided_at ?? frozen.submitted_at),
        showPrices: procurement ? showPrices : false,
      },
      version,
      documentNumber: String(header.document_number),
      procurement,
    };
  }

  function existingCanonical(documentId: string, version: number, variant: PdfVariant): Buffer | null {
    const row = database.prepare('SELECT relative_path,sha256 FROM mt_snapshots WHERE document_id=? AND version=? AND variant=?').get(documentId, version, variant) as { relative_path: string; sha256: string } | undefined;
    if (!row) return null;
    if (path.isAbsolute(row.relative_path) || row.relative_path.includes('..') || row.relative_path.includes('/') || row.relative_path.includes('\\')) {
      throw new MaterialsPdfError('Stored PDF path is invalid', 409, 'MATERIALS_PDF_INTEGRITY_ERROR');
    }
    const absolutePath = path.join(storageRoot, row.relative_path);
    if (!absolutePath.startsWith(storageRoot + path.sep)) throw new MaterialsPdfError('Stored PDF path is invalid', 409, 'MATERIALS_PDF_INTEGRITY_ERROR');
    let buffer: Buffer;
    try { buffer = readFileSync(absolutePath); } catch {
      throw new MaterialsPdfError('Stored PDF is unavailable', 409, 'MATERIALS_PDF_INTEGRITY_ERROR');
    }
    if (createHash('sha256').update(buffer).digest('hex') !== row.sha256) {
      throw new MaterialsPdfError('Stored PDF integrity check failed', 409, 'MATERIALS_PDF_INTEGRITY_ERROR');
    }
    return buffer;
  }

  async function get(actor: Actor, documentId: string, variant: PdfVariant): Promise<MaterialPdfResult> {
    const canViewPrices = permissions.getMaterialsPermission(actor).viewPrices;
    const data = validatedInput(documentId, variant, canViewPrices);
    const redacted = data.procurement && !canViewPrices;
    if (!redacted) {
      const existing = existingCanonical(documentId, data.version, variant);
      if (existing) {
        audit(actor, documentId, 'download_material_pdf', { documentId, version: data.version, variant, redacted: false });
        return {
          buffer: existing,
          filename: data.documentNumber + '-v' + data.version + '-' + variant + '.pdf',
          redacted: false,
          sha256: createHash('sha256').update(existing).digest('hex'),
        };
      }
    }
    const buffer = await bufferPdf(generateMaterialDocumentPdf(data.input, variant));
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    if (redacted) {
      audit(actor, documentId, 'download_material_pdf', { documentId, version: data.version, variant, redacted: true });
      return { buffer, filename: data.documentNumber + '-v' + data.version + '-' + variant + '-redacted.pdf', redacted: true, sha256 };
    }
    const relativePath = randomUUID() + '.pdf';
    const temporaryPath = path.join(storageRoot, '.' + randomUUID() + '.tmp');
    const finalPath = path.join(storageRoot, relativePath);
    try {
      mkdirSync(storageRoot, { recursive: true });
      writeFileSync(temporaryPath, buffer, { flag: 'wx' });
      renameSync(temporaryPath, finalPath);
      database.transaction(() => {
        database.prepare('INSERT INTO mt_snapshots (id,document_id,version,variant,relative_path,sha256,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)').run(
          randomUUID(), documentId, data.version, variant, relativePath, sha256, actor.id, now().toISOString(),
        );
        audit(actor, documentId, 'generate_material_pdf', { documentId, version: data.version, variant, sha256 });
        audit(actor, documentId, 'download_material_pdf', { documentId, version: data.version, variant, redacted: false });
      }).immediate();
    } catch (error) {
      try { unlinkSync(temporaryPath); } catch { /* no temporary file */ }
      try { unlinkSync(finalPath); } catch { /* no final file */ }
      throw error;
    }
    return {
      buffer,
      filename: data.documentNumber + '-v' + data.version + '-' + variant + '.pdf',
      redacted: false,
      sha256,
    };
  }

  return { get };
}
