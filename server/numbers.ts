import db from './db.js';

/** Read COMPANY_PREFIX from system_config */
export function getCompanyPrefix(): string {
  const row = db.prepare("SELECT value FROM system_config WHERE key = 'company_prefix'").get() as any;
  return row?.value || 'JEK';
}

/** YYMM from date string, e.g. "2026-06-15" → "2606" */
function yymm(d?: string): string {
  const s = d || new Date().toISOString();
  return s.slice(2, 4) + s.slice(5, 7);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Generate INQ-YYMM-0001 */
export function nextInquiryNumber(): string {
  const yy = yymm();
  const like = `INQ-${yy}-%`;
  const count = (db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE inquiry_number LIKE ?").get(like) as any).c + 1;
  return `INQ-${yy}-${String(count).padStart(4, '0')}`;
}

/** Generate QUO-YYMM-0001 */
export function nextQuotationNumber(): string {
  const yy = yymm();
  const like = `QUO-${yy}-%`;
  const count = (db.prepare("SELECT COUNT(*) as c FROM quotations WHERE quotation_number LIKE ?").get(like) as any).c + 1;
  return `QUO-${yy}-${String(count).padStart(4, '0')}`;
}

/**
 * Generate {PREFIX}-{CUSTOMER_CODE}-{YYMM}-{SEQ2}
 * SEQ is per customer code, not per month.
 */
export function nextOrderNumber(customerCode: string, date?: string): string {
  const prefix = getCompanyPrefix();
  const yy = yymm(date);
  const customerPattern = `${prefix}-${customerCode}-`;
  const rows = db.prepare(`
    SELECT order_number FROM orders
    WHERE deleted_at IS NULL AND order_number LIKE ? ESCAPE '\\'
  `).all(`${escapeLike(customerPattern)}%`) as Array<{ order_number: string }>;
  const orderNumberPattern = new RegExp(`^${escapeRegExp(customerPattern)}\\d{4}-(\\d+)$`);
  const maxSequence = rows.reduce((max, row) => {
    const match = row.order_number.match(orderNumberPattern);
    if (!match) return max;
    const sequence = Number(match[1]);
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);
  const nextSequence = maxSequence + 1;
  return `${customerPattern}${yy}-${String(nextSequence).padStart(2, '0')}`;
}

/**
 * Generate {ORDER_NUMBER}-S{SEQ} for multiple shipments
 */
export function nextShipmentNumber(orderNumber: string): string {
  const count = (db.prepare("SELECT COUNT(*) as c FROM shipments WHERE shipment_number LIKE ?").get(`${orderNumber}-S%`) as any).c + 1;
  return `${orderNumber}-S${count}`;
}

/**
 * Generate {ORDER_NUMBER}-P{SEQ} for multiple payments
 */
export function nextPaymentNumber(orderNumber: string): string {
  const count = (db.prepare("SELECT COUNT(*) as c FROM payment_records WHERE payment_number LIKE ?").get(`${orderNumber}-P%`) as any).c + 1;
  return `${orderNumber}-P${count}`;
}
