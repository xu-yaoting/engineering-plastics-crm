import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const quotationSource = readFileSync(new URL('../server/pdf-quotation.ts', import.meta.url), 'utf8');
const materialsPdfSource = readFileSync(new URL('../server/materials-tooling/pdf.ts', import.meta.url), 'utf8');

test('quotation PDF pins the canonical company names', () => {
  assert.match(quotationSource, /const COMPANY = '杰京新材料（江苏）有限公司';/);
  assert.match(quotationSource, /const COMPANY_EN = 'JEKIN HPM \(Jiangsu\) Co\., Ltd';/);
  assert.doesNotMatch(quotationSource, /JEKIN Polymer/);
});

test('materials tooling PDF uses the exact canonical company name', () => {
  assert.match(materialsPdfSource, /'JEKIN HPM \(Jiangsu\) Co\., Ltd'/);
  assert.doesNotMatch(materialsPdfSource, /'JEKIN HPM \(Jiangsu\) Co\., Ltd\.'/);
});
