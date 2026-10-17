import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const templateUrl = pathToFileURL(path.join(root, 'server/pdf-quotation.ts')).href;
const tsx = path.join(root, 'node_modules/.bin/tsx');

test('customer quotation PDF excludes internal notes and retains public commercial terms', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'quotation-pdf-privacy-'));
  const runner = path.join(directory, 'render.mts');
  const pdf = path.join(directory, 'quotation.pdf');
  const privateMarker = 'PRIVATE-ONLY-DO-NOT-PRINT';
  const privateChinese = '内部议价记录';
  const quotation = {
    quotation_number: 'QA-QUOTATION-001',
    company_name: 'Anonymous Test Company',
    contact_name: 'Test Buyer',
    created_at: '2026-10-15T00:00:00.000Z',
    valid_until: '2026-11-15',
    currency: 'USD',
    subtotal: 100,
    shipping_handling: 8,
    total: 108,
    incoterm: 'EXW',
    payment_term: 'Agreed payment schedule',
    delivery_term: 'Agreed delivery schedule',
    internal_notes: `${privateMarker}\n${privateChinese}`,
  };
  const items = [{
    line_number: 1, product_grade_snapshot: 'Fixture material',
    unit_of_measure: 'pc', quantity: 2, unit_price: 50, line_total: 100,
  }];
  writeFileSync(runner, `
    import assert from 'node:assert/strict';
    import { createWriteStream } from 'node:fs';
    const { generateQuotationPDF } = await import(${JSON.stringify(templateUrl)});
    const quotation = ${JSON.stringify(quotation)};
    const before = JSON.stringify(quotation);
    const doc = generateQuotationPDF(quotation, ${JSON.stringify(items)});
    await new Promise((resolve, reject) => {
      const output = createWriteStream(${JSON.stringify(pdf)});
      doc.on('error', reject);
      output.on('error', reject);
      output.on('finish', resolve);
      doc.pipe(output);
      doc.end();
    });
    assert.equal(JSON.stringify(quotation), before, 'Export must not alter stored quotation data');
  `);
  try {
    execFileSync(tsx, [runner], { cwd: root, stdio: 'pipe' });
    const text = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' });
    assert.ok(!text.includes(privateMarker), 'Internal English note leaked into the customer PDF');
    assert.ok(!text.replace(/\s/g, '').includes(privateChinese), 'Internal Chinese note leaked into the customer PDF');
    for (const expected of [
      quotation.quotation_number, quotation.company_name, quotation.contact_name,
      items[0].product_grade_snapshot, 'Incoterm: EXW',
      `Payment Terms: ${quotation.payment_term}`, `Delivery: ${quotation.delivery_term}`,
      'Currency: USD', '$100.00', '$8.00', '$108.00',
      'JEKIN HPM (Jiangsu) Co., Ltd',
    ]) {
      assert.ok(text.includes(expected), `Public quotation PDF lost ${expected}`);
    }
    assert.ok(!text.includes('JEKIN Polymer'), 'Legacy English company name still printed');
    assert.ok(
      text.replace(/\s/g, '').includes('杰京新材料（江苏）有限公司'),
      'Public quotation PDF lost the canonical Chinese company name',
    );
    const previewDirectory = path.join(tmpdir(), 'crm-quotation-public-pdf-preview');
    mkdirSync(previewDirectory, { recursive: true });
    copyFileSync(pdf, path.join(previewDirectory, 'quotation.pdf'));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
