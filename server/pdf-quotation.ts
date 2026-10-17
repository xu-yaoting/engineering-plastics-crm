import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FONT_R = path.join(__dirname, 'fonts', 'NotoSansSC-Regular.ttf');
const FONT_B = path.join(__dirname, 'fonts', 'NotoSansSC-Bold.ttf');

const BLUE = '#2185ff';

const COMPANY = '杰京新材料（江苏）有限公司';
const COMPANY_EN = 'JEKIN HPM (Jiangsu) Co., Ltd';
const ADDR = '江苏省盐城市亭湖区新盐路18号';
const EMAIL = 'nathan@jekinpolymer.com';
const PHONE = '135 8563 5052';

const ML = 50;
const CW = 495;
const PH = 841.89;

export function generateQuotationPDF(quotation: any, lineItems: any[]): PDFKit.PDFDocument {

  const doc = new PDFDocument({ size: 'A4', margin: ML });
  doc.registerFont('R', FONT_R);
  doc.registerFont('B', FONT_B);

  // Helper: single table cell
  function cell(x: number, y: number, w: number, txt: string, opts: { align?: string; bold?: boolean; sz?: number; clr?: string } = {}) {
    doc.font(opts.bold ? 'B' : 'R')
       .fontSize(opts.sz || 8)
       .fill(opts.clr || '#222222')
       .text(txt, x, y, { width: w, align: (opts.align || 'left') as 'left' | 'center' | 'right' | 'justify', lineBreak: false });
  }

  // ── 1. HEADER ──
  let y = ML;
  // Company name
  doc.font('B').fontSize(20).fill('#1a1a2e').text(COMPANY, ML, y);
  y += 30;
  doc.font('R').fontSize(9).fill('#666').text(COMPANY_EN, ML, y);
  y += 18;

  // Blue line
  doc.rect(ML, y, CW, 2).fill(BLUE);
  y += 12;

  // QUOTATION title (right-aligned)
  doc.font('B').fontSize(16).fill('#1a1a2e').text('QUOTATION', ML + CW - 180, y, { width: 180, align: 'right' });

  // Company info (left)
  const lh = 16; // line height for 8pt
  const bX = ML, bY = y + 26;
  doc.font('R').fontSize(8).fill('#444');
  doc.text(ADDR, bX, bY);
  doc.text(EMAIL + '  |  ' + PHONE, bX, bY + lh);

  // Quote info (right)
  const rX = ML + CW - 180;
  doc.text('No: ' + (quotation.quotation_number || ''), rX, bY, { width: 180, align: 'right' });
  doc.text('Date: ' + (quotation.created_at?.slice(0, 10) || ''), rX, bY + lh, { width: 180, align: 'right' });
  doc.text('Valid until: ' + (quotation.valid_until || ''), rX, bY + lh * 2, { width: 180, align: 'right' });

  // Customer section
  y = bY + lh * 2 + lh + 6;  // enough space after "Valid until" line
  doc.rect(ML, y, CW, 1).fill('#e0e0e0');  // ← separator line MOVED DOWN
  y += 12;
  doc.font('B').fontSize(9).fill('#1a1a2e').text('Customer', ML, y);
  y += 16;
  doc.font('R').fontSize(9).fill('#444').text(quotation.company_name || '', ML, y);
  y += 14;
  if (quotation.contact_name) {
    doc.text('Attn: ' + quotation.contact_name, ML, y);
    y += 14;
  }

  // ── 2. TABLE ──
  y += 10;
  // Column order: #, Product, QTY, Unit, Unit Price, Total
  // align[i] = alignment for column i (both header and data)
  // Columns evenly distributed with 4px gaps and 6px outer padding
  const colAlign = ['center', 'left', 'right', 'center', 'right', 'right'];
  const PAD = 6;   // left/right padding for the table
  const GAP = 4;   // gap between columns
  // Available width: CW - PAD*2 - GAP*5 = 495-12-20 = 463 for column content
  const cols = [
    { x: PAD,              w: 22, label: '#' },
    { x: PAD+22+GAP,       w: 148, label: 'Product / Grade' },
    { x: PAD+22+GAP+148+GAP, w: 50, label: 'QTY' },
    { x: PAD+22+GAP+148+GAP+50+GAP, w: 50, label: 'Unit' },
    { x: PAD+22+GAP+148+GAP+50+GAP+50+GAP, w: 85, label: 'Unit Price' },
    { x: PAD+22+GAP+148+GAP+50+GAP+50+GAP+85+GAP, w: 108, label: 'Total' },
  ];

  // Table header
  doc.rect(ML, y, CW, 22).fill(BLUE);
  cols.forEach((c, i) => {
    doc.font('B').fontSize(8).fill('#ffffff')
      .text(c.label, ML + c.x, y + 6, { width: c.w, align: colAlign[i] as any, lineBreak: false });
  });
  doc.fill('#000000');
  y += 22;

  // Table rows
  const sym = quotation.currency === 'CNY' ? '¥' : '$';
  const FMT = (v: number) => sym + (v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (!lineItems || lineItems.length === 0) {
    // No items — show placeholder
    doc.rect(ML, y, CW, 30).fill('#f8f9fa');
    cell(ML, y + 8, CW, 'No line items.', { align: 'center', clr: '#999' });
    y += 30;
  } else {
    lineItems.forEach((item, idx) => {
      if (y > PH - 100) { doc.addPage(); y = ML + 22; }

      // Row background
      if (idx % 2 === 0) doc.rect(ML, y, CW, 20).fill('#f8f9fa');

      // Each cell (values in same order as cols)
      const vals = [
        String(item.line_number || idx + 1),
        item.product_grade_snapshot || '',
        String(item.quantity ?? ''),
        item.unit_of_measure || '',
        FMT(item.unit_price),
        FMT(item.line_total),
      ];
      cols.forEach((c, i) => {
        cell(ML + c.x, y + 4, c.w, vals[i] || '', { align: colAlign[i] });
      });

      // Row border
      doc.strokeColor('#e0e0e0').lineWidth(0.5).moveTo(ML, y + 20).lineTo(ML + CW, y + 20).stroke();
      y += 20;
    });
  }

  // ── 3. TOTALS ──
  y += 8;
  const tx = ML + 300;
  const tw = CW - 300;

  const sums: { label: string; value: string }[] = [
    { label: 'Subtotal', value: FMT(quotation.subtotal) },
  ];
  if (quotation.discount_percent > 0) {
    sums.push({ label: `Discount (${quotation.discount_percent}%)`, value: '-' + FMT(quotation.discount_amount) });
  }
  if (quotation.shipping_handling > 0) {
    sums.push({ label: 'Shipping', value: FMT(quotation.shipping_handling) });
  }

  sums.forEach((s, i) => {
    cell(tx + 8, y + i * 20, tw - 16, s.label, { sz: 9, clr: '#444' });
    cell(tx + 8, y + i * 20, tw - 16, s.value, { sz: 9, bold: true, align: 'right', clr: '#444' });
  });

  y += sums.length * 20;
  doc.rect(tx, y, tw, 24).fill(BLUE);
  doc.font('B').fontSize(11).fill('#fff').text('Total', tx + 8, y + 6);
  doc.text(FMT(quotation.total), tx + 8, y + 6, { width: tw - 16, align: 'right', lineBreak: false });
  y += 30;

  // ── 4. TERMS ──
  if (y > PH - 80) { doc.addPage(); y = ML; }
  doc.font('B').fontSize(9).fill('#1a1a2e').text('Terms & Conditions', ML, y);
  y += 16;
  doc.font('R').fontSize(8).fill('#666');

  // Keep this customer-facing list limited to commercial terms.
  const terms = [
    quotation.incoterm && `Incoterm: ${quotation.incoterm}`,
    quotation.payment_term && `Payment Terms: ${quotation.payment_term}`,
    quotation.delivery_term && `Delivery: ${quotation.delivery_term}`,
    `Currency: ${quotation.currency || 'USD'}`,
  ].filter(Boolean) as string[];

  terms.forEach(t => {
    doc.text('•  ' + t, ML + 4, y);
    y += 14;
  });

  // ── 5. FOOTER ──
  const ftrY = PH - ML - 30;
  doc.rect(ML, ftrY, CW, 0.5).fill('#e0e0e0');
  doc.font('R').fontSize(7).fill('#999')
    .text([COMPANY, ADDR, EMAIL, PHONE].join('  |  '), ML, ftrY + 8, { width: CW, align: 'center' });

  return doc;
}
