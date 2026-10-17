import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/components/quotations/QuotationEditPanel.tsx', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('QuotationEditPanel.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'updateLine') handler = node.initializer;
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.ok(handler, 'Quotation line editor callback is missing');
const compiled = ts.transpileModule(`module.exports = ${handler.getText(parsed)};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
}).outputText;

function lineFixture(overrides = {}) {
  const sourceLines = [
    { id: 'fixture-line', quantity: 2, unit_price: 100, discount_percent: 10, line_total: 180, description: 'Fixture dimensions', ...overrides },
    { id: 'other-line', quantity: 1, unit_price: 50, discount_percent: 0, line_total: 50 },
  ];
  let current = sourceLines;
  const module = { exports: {} };
  runInNewContext(compiled, { module, setLineItems: update => { current = update(current); } });
  return { action: module.exports, sourceLines, lines: () => current };
}

test('quotation quantity and unit-price edits use gross prices and clear unsupported legacy discounts', () => {
  for (const [field, value, expected] of [['quantity', 3, 300], ['unit_price', 125, 250], ['quantity', 0, 0], ['unit_price', 0, 0]]) {
    const fixture = lineFixture();
    const before = JSON.stringify(fixture.sourceLines);
    fixture.action('fixture-line', field, value);
    assert.equal(fixture.lines()[0].line_total, expected, `${field} edit applied an unsupported discount`);
    assert.equal(fixture.lines()[0].discount_percent, 0);
    assert.equal(fixture.lines()[1], fixture.sourceLines[1]);
    assert.equal(JSON.stringify(fixture.sourceLines), before, 'Editing a line mutated the original data');
  }
  const fractional = lineFixture({ quantity: 1.5, unit_price: 80, discount_percent: 12.5, line_total: 105 });
  fractional.action('fixture-line', 'quantity', 2.25);
  assert.equal(fractional.lines()[0].line_total, 180);
});

test('quotation line pricing ignores omitted, null, zero and legacy percentage fields', () => {
  for (const discount of [undefined, null, 0, 100]) {
    const fixture = lineFixture({ discount_percent: discount });
    fixture.action('fixture-line', 'quantity', 3);
    assert.equal(fixture.lines()[0].line_total, 300);
    assert.equal(fixture.lines()[0].discount_percent, 0);
  }
});

test('descriptive quotation line edits preserve saved amounts and unrelated lines', () => {
  for (const [field, value] of [['description', 'Revised fixture dimensions'], ['unit_of_measure', 'pc'], ['product_grade_snapshot', 'Fixture grade']]) {
    const fixture = lineFixture();
    fixture.action('fixture-line', field, value);
    assert.equal(fixture.lines()[0][field], value);
    assert.equal(fixture.lines()[0].line_total, 180);
    assert.equal(fixture.lines()[0].discount_percent, 10);
    assert.equal(fixture.lines()[1], fixture.sourceLines[1]);
  }
  const missing = lineFixture();
  missing.action('missing-line', 'quantity', 3);
  assert.equal(missing.lines()[0], missing.sourceLines[0]);
  assert.equal(missing.lines()[1], missing.sourceLines[1]);
});

function pricingFixture({ source = {}, form = {}, lines } = {}) {
  const quotation = {
    subtotal: 180, tax_type: 'domestic_vat', domestic_vat_rate: 13,
    export_tax_rebate_rate: 0, shipping_handling: 8, tax_amount: 22.23, total: 201.23,
    discount_percent: 5, discount_amount: 9,
    line_items: [{ id: 'fixture-line', quantity: 2, unit_price: 100, discount_percent: 10, line_total: 180 }],
    ...source,
  };
  const declarations = [];
  function collect(node) {
    if (ts.isVariableDeclaration(node) && ['lineSubtotal', 'pricingUnchanged', 'subtotal', 'calculatedTaxAmount', 'taxAmount', 'total'].includes(node.name.getText(parsed))) {
      declarations.push(`const ${node.getText(parsed)};`);
    }
    ts.forEachChild(node, collect);
  }
  collect(parsed);
  const compiledPricing = ts.transpileModule(`${declarations.join('\n')} module.exports={subtotal,taxAmount,total};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  runInNewContext(compiledPricing, {
    module, quotation, isNew: false,
    lineItems: lines ?? quotation.line_items.map(line => ({ ...line, description: 'Revised description' })),
    form: { tax_type: quotation.tax_type, domestic_vat_rate: quotation.domestic_vat_rate, export_tax_rebate_rate: quotation.export_tax_rebate_rate, shipping_handling: quotation.shipping_handling, internal_notes: 'Revised anonymous note', ...form },
  });
  return JSON.parse(JSON.stringify(module.exports));
}

test('metadata-only quotation edits preserve the saved subtotal, tax and total including header discounts', () => {
  assert.deepEqual(pricingFixture(), { subtotal: 180, taxAmount: 22.23, total: 201.23 });
  assert.deepEqual(pricingFixture({ source: { discount_percent: 100, discount_amount: 180, tax_amount: 0, total: 0, shipping_handling: 0 } }), { subtotal: 180, taxAmount: 0, total: 0 });
});

test('price and shipping changes still recalculate ordinary undiscounted quotations', () => {
  const source = { subtotal: 100, total: 100, tax_amount: 0, tax_type: 'none', domestic_vat_rate: 0, shipping_handling: 0, discount_percent: 0, discount_amount: 0, line_items: [{ id: 'fixture-line', quantity: 2, unit_price: 50, discount_percent: 0, line_total: 100 }] };
  assert.deepEqual(pricingFixture({ source, lines: [{ ...source.line_items[0], quantity: 3, line_total: 150 }] }), { subtotal: 150, taxAmount: 0, total: 150 });
  assert.deepEqual(pricingFixture({ source, form: { shipping_handling: 8 } }), { subtotal: 100, taxAmount: 0, total: 108 });
});
