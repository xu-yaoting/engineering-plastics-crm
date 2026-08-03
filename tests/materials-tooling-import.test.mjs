import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const tsx = path.join(root, 'node_modules', '.bin', 'tsx');
const packageUrl = pathToFileURL(path.join(root, 'package.json')).href;
const schemaUrl = pathToFileURL(path.join(root, 'server/materials-tooling/schema.ts')).href;
const importServiceUrl = pathToFileURL(path.join(root, 'server/materials-tooling/import.ts')).href;

test('cutover confirmation does not treat the multipart string false as approval', () => {
  const routeSource = readFileSync(path.join(root, 'server/routes/materials-tooling.ts'), 'utf8');
  assert.match(routeSource, /body\.confirm === true \|\| body\.confirm === 'true'/);
  assert.doesNotMatch(routeSource, /confirm: Boolean\(body\.confirm\)/);
});

test('materials cutover import validates, previews, and executes opening balance imports', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'mt-import-'));
  const runner = path.join(directory, 'run.mts');
  writeFileSync(runner, `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(${JSON.stringify(packageUrl)});
    const Database = require('better-sqlite3');
    const XLSX = require('xlsx') as any;
    const { ensureMaterialsToolingSchema } = await import(${JSON.stringify(schemaUrl)});
    const { createMaterialsImportService, MaterialsImportError } = await import(${JSON.stringify(importServiceUrl)});

    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(\`
      CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE audit_log (id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, user_id TEXT, user_name TEXT NOT NULL, action TEXT NOT NULL, changes TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL);
      INSERT INTO users (id, name, role) VALUES
        ('admin', 'Admin', 'admin'), ('member', 'Member', 'member');
    \`);
    ensureMaterialsToolingSchema(db);
    db.exec(\`
      INSERT INTO mt_permissions (user_id, manage_materials, approve, view_prices, manage_periods, updated_by, updated_at)
      VALUES ('member', 1, 0, 0, 0, 'admin', 'x');
      INSERT INTO mt_items (id, code, name, category, unit, created_by, updated_by, created_at, updated_at)
      VALUES
        ('i1', 'ITEM-A', 'Item A', 'Cat1', 'pc', 'admin', 'admin', 'x', 'x'),
        ('i2', 'ITEM-B', 'Item B', 'Cat1', 'kg', 'admin', 'admin', 'x', 'x'),
        ('i3', 'ITEM-C', 'Item C', 'Cat2', 'pc', 'admin', 'admin', 'x', 'x');
      INSERT INTO mt_suppliers (id, code, name, is_active, created_by, updated_by, created_at, updated_at)
      VALUES ('s1', 'SUP-1', 'Supplier 1', 1, 'admin', 'admin', 'x', 'x');
      INSERT INTO mt_movements (id, item_id, movement_type, quantity_delta, movement_date, created_by, created_at, source_workbook, cutover_period)
      VALUES ('existing', 'i1', 'opening_balance', 10, '2026-06-01', 'admin', 'x', 'initial.xlsx', '2026-06');
    \`);

    function makeWorkbook(rows: Record<string, unknown>[]): Buffer {
      const sheet = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, 'Opening');
      return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    }

    const importSvc = createMaterialsImportService(db, { getMaterialsPermission: () => ({ manageMaterials: true, viewPrices: true }) });

    // Test 1: Preview valid import
    const preview1 = importSvc.preview({ id: 'member', name: 'Member', role: 'member' }, makeWorkbook([
      { code: 'ITEM-A', unit: 'pc', quantity: 50, unit_price: 5.25 },
      { code: 'ITEM-B', unit: 'kg', quantity: 100, unit_price: 0 },
    ]));
    assert.equal(preview1.items.length, 2);
    assert.equal(preview1.errors.length, 0);
    assert.equal(preview1.missingItems.length, 0);
    assert.equal(preview1.items[0].code, 'ITEM-A');
    assert.equal(preview1.items[0].quantity, 50);

    // Test 2: Preview with missing items
    const preview2 = importSvc.preview({ id: 'member', name: 'Member', role: 'member' }, makeWorkbook([
      { code: 'ITEM-A', unit: 'pc', quantity: 30 },
      { code: 'UNKNOWN-X', unit: 'pc', quantity: 10 },
    ]));
    assert.equal(preview2.items.length, 1);
    assert.equal(preview2.missingItems.length, 1);
    assert.equal(preview2.missingItems[0], 'UNKNOWN-X');

    // Test 3: Preview with validation errors
    const preview3 = importSvc.preview({ id: 'member', name: 'Member', role: 'member' }, makeWorkbook([
      { code: '', quantity: 10 },
      { code: 'ITEM-A', quantity: -5 },
    ]));
    assert.equal(preview3.items.length, 0);
    assert.equal(preview3.errors.length, 2);

    // Test 4: Confirm import without confirm flag
    const buffer = makeWorkbook([{ code: 'ITEM-A', unit: 'pc', quantity: 25, unit_price: 4.5 }]);
    assert.throws(() => importSvc.confirmImport(
      { id: 'admin', name: 'Admin', role: 'admin' }, buffer,
      { month: '2026-07', sourceWorkbook: 'cutover.xlsx', confirm: false },
    ), /confirm/);

    // Test 5: Confirm import creates opening_balance movements
    const confirm5 = importSvc.confirmImport(
      { id: 'admin', name: 'Admin', role: 'admin' }, buffer,
      { month: '2026-07', sourceWorkbook: 'cutover.xlsx', confirm: true },
    );
    assert.equal(confirm5.created, 1);
    const movements = db.prepare(
      "SELECT item_id, movement_type, quantity_delta, reference_unit_price, source_workbook, cutover_period FROM mt_movements WHERE movement_type = 'opening_balance' AND id NOT IN ('existing')",
    ).all() as any[];
    assert.equal(movements.length, 1);
    assert.equal(movements[0].item_id, 'i1');
    assert.equal(movements[0].quantity_delta, 25);
    assert.equal(movements[0].reference_unit_price, 4.5);
    assert.equal(movements[0].source_workbook, 'cutover.xlsx');
    assert.equal(movements[0].cutover_period, '2026-07');

    // Test 6: Non-manager access is rejected
    const badPerms = createMaterialsImportService(db, { getMaterialsPermission: () => ({ manageMaterials: false, viewPrices: false }) });
    assert.throws(() => badPerms.preview({ id: 'member', name: 'Member', role: 'member' }, buffer), /permission/);
    assert.throws(() => badPerms.confirmImport({ id: 'member', name: 'Member', role: 'member' }, buffer, { month: '2026-07', sourceWorkbook: 'x', confirm: true }), /permission/);

    // Test 7: Month format validation
    assert.throws(() => importSvc.confirmImport(
      { id: 'admin', name: 'Admin', role: 'admin' }, buffer,
      { month: 'invalid', sourceWorkbook: 'x', confirm: true },
    ), /YYYY-MM/);

    // Test 8: Empty workbook is rejected
    assert.throws(() => importSvc.preview({ id: 'member', name: 'Member', role: 'member' }, makeWorkbook([])), /no data/i);

    // Test 9: Unknown items reject the whole import instead of silently importing a subset
    const badBuffer = makeWorkbook([{ code: 'UNKNOWN', unit: 'pc', quantity: 5 }]);
    const beforeUnknown = db.prepare('SELECT COUNT(*) count FROM mt_movements').get().count;
    assert.throws(() => importSvc.confirmImport(
      { id: 'admin', name: 'Admin', role: 'admin' }, badBuffer,
      { month: '2026-07', sourceWorkbook: 'x', confirm: true },
    ), /unknown item/i);
    assert.equal(db.prepare('SELECT COUNT(*) count FROM mt_movements').get().count, beforeUnknown);

    // Test 10: Case-insensitive code matching
    const preview10 = importSvc.preview({ id: 'member', name: 'Member', role: 'member' }, makeWorkbook([
      { code: 'item-a', unit: 'pc', quantity: 10 },
    ]));
    assert.equal(preview10.items.length, 1);
    assert.equal(preview10.items[0].code, 'ITEM-A');

    // Test 11: Missing/mismatched UOM, duplicate codes and invalid prices are blocking errors
    const invalidPreview = importSvc.preview({ id: 'admin', name: 'Admin', role: 'admin' }, makeWorkbook([
      { code: 'ITEM-A', unit: '', quantity: 1 },
      { code: 'ITEM-B', unit: 'pc', quantity: 1 },
      { code: 'ITEM-C', unit: 'pc', quantity: 1, unit_price: -1 },
      { code: 'ITEM-C', unit: 'pc', quantity: 2 },
    ]));
    assert.equal(invalidPreview.errors.length, 4);
    assert.match(invalidPreview.errors.join(' '), /unit/i);
    assert.match(invalidPreview.errors.join(' '), /duplicate/i);
    assert.match(invalidPreview.errors.join(' '), /price/i);

    // Test 12: Closed periods cannot receive opening balances
    db.prepare("INSERT INTO mt_periods(period_key,status,closed_by,closed_at) VALUES('2026-08','closed','admin','x')").run();
    assert.throws(() => importSvc.confirmImport(
      { id: 'admin', name: 'Admin', role: 'admin' }, buffer,
      { month: '2026-08', sourceWorkbook: 'closed.xlsx', confirm: true },
    ), /closed/i);

    // Test 13: A mixed valid/invalid workbook is all-or-nothing
    const mixedBuffer = makeWorkbook([
      { code: 'ITEM-A', unit: 'pc', quantity: 7 },
      { code: 'UNKNOWN', unit: 'pc', quantity: 3 },
    ]);
    const beforeMixed = db.prepare('SELECT COUNT(*) count FROM mt_movements').get().count;
    assert.throws(() => importSvc.confirmImport(
      { id: 'admin', name: 'Admin', role: 'admin' }, mixedBuffer,
      { month: '2026-09', sourceWorkbook: 'mixed.xlsx', confirm: true },
    ));
    assert.equal(db.prepare('SELECT COUNT(*) count FROM mt_movements').get().count, beforeMixed);

    // Test 14: Trustworthy supplier-priced rows create isolated reference purchase history
    const pricedBuffer = makeWorkbook([
      { code: 'ITEM-B', unit: 'kg', quantity: 12, unit_price: 8.75, supplier_code: 'SUP-1' },
    ]);
    const pricedResult = importSvc.confirmImport(
      { id: 'admin', name: 'Admin', role: 'admin' }, pricedBuffer,
      { month: '2026-10', sourceWorkbook: 'priced.xlsx', confirm: true },
    );
    assert.equal(pricedResult.created, 2);
    assert.deepEqual(db.prepare(\`
      SELECT movement_type, quantity_delta, reference_unit_price, reference_quantity,
        supplier_id, source_workbook, cutover_period
      FROM mt_movements WHERE item_id='i2' AND cutover_period='2026-10'
      ORDER BY movement_type
    \`).all(), [
      { movement_type: 'opening_balance', quantity_delta: 12, reference_unit_price: 8.75,
        reference_quantity: null, supplier_id: null, source_workbook: 'priced.xlsx', cutover_period: '2026-10' },
      { movement_type: 'reference_purchase', quantity_delta: 0, reference_unit_price: 8.75,
        reference_quantity: 12, supplier_id: 's1', source_workbook: 'priced.xlsx', cutover_period: '2026-10' },
    ]);

    const unknownSupplier = importSvc.preview(
      { id: 'admin', name: 'Admin', role: 'admin' },
      makeWorkbook([{ code: 'ITEM-C', unit: 'pc', quantity: 2, unit_price: 3, supplier_code: 'MISSING' }]),
    );
    assert.match(unknownSupplier.errors.join(' '), /supplier/i);

    db.close();
  `);
  try {
    // Raw backtick below closes the outer template -- don't escape it
    // The backtick on this line is the closing of the writeFileSync template
    assert.equal(execFileSync(tsx, [runner], { cwd: root, encoding: 'utf8', stdio: 'pipe' }), '');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
