import db from './db';

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
 * SEQ per customer+month, auto-incrementing.
 */
export function nextOrderNumber(customerCode: string): string {
  const prefix = getCompanyPrefix();
  const yy = yymm();
  const pattern = `${prefix}-${customerCode}-${yy}-`;
  const count = (db.prepare("SELECT COUNT(*) as c FROM orders WHERE order_number LIKE ?").get(`${pattern}%`) as any).c + 1;
  return `${pattern}${String(count).padStart(2, '0')}`;
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
