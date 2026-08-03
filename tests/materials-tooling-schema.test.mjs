import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const schemaPath = new URL('../server/materials-tooling/schema.ts', import.meta.url);
const dbPath = new URL('../server/db.ts', import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));
const tsx = path.join(root, 'node_modules', '.bin', 'tsx');
const packageUrl = pathToFileURL(path.join(root, 'package.json')).href;
const schemaUrl = pathToFileURL(fileURLToPath(schemaPath)).href;

function extractMainSchemaSql() {
  const schemaSource = readFileSync(schemaPath, 'utf8');
  const blocks = [...schemaSource.matchAll(/database\.exec\(`([\s\S]*?)`\);/g)];
  const schemaBlock = blocks.find((match) => match[1].includes('CREATE TABLE IF NOT EXISTS mt_permissions'));
  assert.ok(schemaBlock, 'main materials schema SQL must exist');
  return schemaBlock[1];
}

const EXPECTED_TABLES = [
  'mt_permissions',
  'mt_approval_config',
  'mt_suppliers',
  'mt_items',
  'mt_documents',
  'mt_document_lines',
  'mt_document_versions',
  'mt_approvals',
  'mt_movements',
  'mt_snapshots',
  'mt_attachments',
  'mt_periods',
  'mt_period_snapshots',
  'mt_tooling_assets',
  'mt_tooling_movements',
];

const EXPECTED_COLUMNS = {
  mt_permissions: ['user_id', 'manage_materials', 'approve', 'view_prices', 'manage_periods', 'updated_by', 'updated_at'],
  mt_approval_config: ['document_type', 'approver_user_id', 'updated_by', 'updated_at'],
  mt_suppliers: [
    'id', 'code', 'name', 'contact_name', 'phone', 'notes', 'is_active',
    'created_by', 'updated_by', 'created_at', 'updated_at',
  ],
  mt_items: [
    'id', 'code', 'name', 'category', 'specification', 'unit', 'warehouse', 'bin_location',
    'safety_quantity', 'is_active', 'notes', 'created_by', 'updated_by', 'created_at', 'updated_at',
  ],
  mt_documents: [
    'id', 'document_number', 'document_type', 'version', 'status', 'applicant_user_id',
    'department', 'request_date', 'required_date', 'execution_date', 'purpose', 'supplier_id',
    'invoice_number', 'contract_number', 'replaces_document_id', 'replaced_by_document_id',
    'assigned_approver_user_id', 'rejection_reason', 'void_reason', 'created_by', 'updated_by',
    'created_at', 'updated_at', 'notes', 'executed_by_user_id', 'recipient_user_id',
    'recipient_name', 'inspection_result',
  ],
  mt_document_lines: [
    'id', 'document_id', 'line_number', 'material_item_id', 'requested_quantity',
    'execution_quantity', 'unit', 'tax_inclusive_unit_price', 'related_request_line_id',
    'related_issue_line_id', 'return_condition', 'system_quantity', 'counted_quantity',
    'adjustment_delta', 'notes',
  ],
  mt_document_versions: [
    'document_id', 'version', 'snapshot_json', 'snapshot_sha256', 'submitted_by', 'submitted_at',
  ],
  mt_approvals: ['id', 'document_id', 'version', 'approver_user_id', 'decision', 'comment', 'decided_at'],
  mt_movements: [
    'id', 'item_id', 'document_id', 'document_line_id', 'movement_type', 'quantity_delta',
    'reference_unit_price', 'movement_date', 'created_by', 'created_at', 'supplier_id',
    'reference_quantity', 'source_workbook', 'cutover_period',
  ],
  mt_snapshots: [
    'id', 'document_id', 'version', 'variant', 'relative_path', 'sha256', 'created_by', 'created_at',
  ],
  mt_attachments: [
    'id', 'document_id', 'category', 'original_name', 'stored_name', 'mime_type', 'size_bytes',
    'is_sensitive', 'uploaded_by', 'uploaded_at', 'deleted_by', 'deleted_at',
    'tooling_asset_id', 'notes',
  ],
  mt_periods: [
    'period_key', 'status', 'closed_by', 'closed_at', 'reopened_by', 'reopened_at', 'reopen_reason',
  ],
  mt_period_snapshots: ['id', 'period_key', 'version', 'snapshot_json', 'created_by', 'created_at'],
  mt_tooling_assets: [
    'id', 'tooling_code', 'name', 'category', 'specification', 'serial_number', 'tracked_quantity',
    'status', 'custodian_user_id', 'location', 'supplier_id', 'purchase_price', 'contract_number',
    'invoice_number', 'acquired_at', 'expected_life_months', 'next_maintenance_date', 'notes',
    'created_by', 'updated_by', 'created_at', 'updated_at',
  ],
  mt_tooling_movements: [
    'id', 'asset_id', 'document_id', 'movement_type', 'from_status', 'to_status',
    'from_custodian_user_id', 'to_custodian_user_id', 'from_location', 'to_location',
    'reason', 'created_by', 'created_at',
  ],
};

test('materials tooling schema stays isolated and complete', () => {
  assert.equal(existsSync(schemaPath), true, 'materials tooling schema module must exist');

  const schemaSource = readFileSync(schemaPath, 'utf8');
  const dbSource = readFileSync(dbPath, 'utf8');

  for (const table of EXPECTED_TABLES) {
    assert.match(schemaSource, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  }

  assert.doesNotMatch(
    schemaSource,
    /REFERENCES\s+(?:companies|contacts|inquiries|quotations|orders|shipments|payments|products|inventory_transactions)\b/i,
  );
  assert.match(dbSource, /ensureMaterialsToolingSchema\(db\)/);
  assert.ok(
    dbSource.indexOf('ensureMaterialsToolingSchema(db)') > dbSource.indexOf('CREATE TABLE IF NOT EXISTS audit_log'),
    'materials tooling schema must be initialized after users and audit_log',
  );
});

test('materials tooling SQL executes and only references users or module tables', () => {
  assert.equal(existsSync(schemaPath), true, 'materials tooling schema module must exist');
  const schemaSql = extractMainSchemaSql();

  const database = new Database(':memory:');
  database.pragma('foreign_keys = ON');
  database.exec('CREATE TABLE users (id TEXT PRIMARY KEY)');
  database.exec(schemaSql);

  const tables = new Set(
    database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name),
  );
  for (const table of EXPECTED_TABLES) assert.ok(tables.has(table), `missing ${table}`);

  const allowedTargets = new Set(['users', ...EXPECTED_TABLES]);
  for (const table of EXPECTED_TABLES) {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
    assert.deepEqual(columns, EXPECTED_COLUMNS[table], `${table} columns must match the plan contract`);

    const foreignKeys = database.prepare(`PRAGMA foreign_key_list(${table})`).all();
    for (const foreignKey of foreignKeys) {
      assert.ok(
        allowedTargets.has(foreignKey.table),
        `${table}.${foreignKey.from} references forbidden table ${foreignKey.table}`,
      );
    }
  }

  database.close();
});

test('materials tooling schema upgrades legacy document-only attachments without data loss', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'mt-schema-upgrade-'));
  const runner = path.join(directory, 'run.mts');
  writeFileSync(runner, `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(${JSON.stringify(packageUrl)});
    const Database = require('better-sqlite3');
    const { ensureMaterialsToolingSchema } = await import(${JSON.stringify(schemaUrl)});
    const database = new Database(':memory:');
    database.pragma('foreign_keys = ON');
    database.exec(\`
      CREATE TABLE users (id TEXT PRIMARY KEY);
    \`);
    ensureMaterialsToolingSchema(database);
    database.exec(\`
      DROP TABLE mt_attachments;
      CREATE TABLE mt_attachments (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL REFERENCES mt_documents(id),
        category TEXT NOT NULL,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL UNIQUE,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        is_sensitive INTEGER NOT NULL DEFAULT 0,
        uploaded_by TEXT NOT NULL REFERENCES users(id),
        uploaded_at TEXT NOT NULL,
        deleted_by TEXT,
        deleted_at TEXT
      );
      CREATE INDEX idx_mt_attachments_document ON mt_attachments(document_id);
      INSERT INTO users(id) VALUES ('user-1');
      INSERT INTO mt_documents (
        id, document_number, document_type, applicant_user_id, request_date,
        created_by, updated_by, created_at, updated_at
      ) VALUES (
        'doc-1', 'PR-2026-0001', 'purchase_request', 'user-1', '2026-07-14',
        'user-1', 'user-1', '2026-07-14', '2026-07-14'
      );
      INSERT INTO mt_attachments (
        id, document_id, category, original_name, stored_name, mime_type,
        size_bytes, uploaded_by, uploaded_at
      ) VALUES (
        'attachment-1', 'doc-1', 'invoice', 'invoice.pdf', 'stored-invoice',
        'application/pdf', 100, 'user-1', '2026-07-14'
      );
    \`);
    ensureMaterialsToolingSchema(database);
    const columns = database.prepare('PRAGMA table_info(mt_attachments)').all();
    assert.equal(columns.find((column) => column.name === 'document_id').notnull, 0);
    assert.ok(columns.some((column) => column.name === 'tooling_asset_id'));
    assert.ok(columns.some((column) => column.name === 'notes'));
    assert.deepEqual(
      database.prepare('SELECT id, document_id, tooling_asset_id, notes FROM mt_attachments').get(),
      { id: 'attachment-1', document_id: 'doc-1', tooling_asset_id: null, notes: null },
    );
    assert.doesNotThrow(() => ensureMaterialsToolingSchema(database));
    database.close();
  `);
  try {
    execFileSync(tsx, [runner], { cwd: root, stdio: 'pipe' });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('materials tooling schema upgrades early document and movement tables without data loss', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'mt-core-schema-upgrade-'));
  const runner = path.join(directory, 'run.mts');
  writeFileSync(runner, `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(${JSON.stringify(packageUrl)});
    const Database = require('better-sqlite3');
    const { ensureMaterialsToolingSchema } = await import(${JSON.stringify(schemaUrl)});
    const database = new Database(':memory:');
    database.pragma('foreign_keys = ON');
    database.exec(\`
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE mt_suppliers (id TEXT PRIMARY KEY);
      CREATE TABLE mt_items (
        id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
        category TEXT NOT NULL, specification TEXT, unit TEXT NOT NULL,
        warehouse TEXT, bin_location TEXT, safety_quantity REAL NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1, notes TEXT,
        created_by TEXT NOT NULL REFERENCES users(id), updated_by TEXT NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE mt_documents (
        id TEXT PRIMARY KEY, document_number TEXT NOT NULL UNIQUE, document_type TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'draft',
        applicant_user_id TEXT NOT NULL REFERENCES users(id), department TEXT, request_date TEXT NOT NULL,
        required_date TEXT, execution_date TEXT, purpose TEXT, supplier_id TEXT REFERENCES mt_suppliers(id),
        invoice_number TEXT, contract_number TEXT, replaces_document_id TEXT REFERENCES mt_documents(id),
        replaced_by_document_id TEXT REFERENCES mt_documents(id), assigned_approver_user_id TEXT REFERENCES users(id),
        rejection_reason TEXT, void_reason TEXT, created_by TEXT NOT NULL REFERENCES users(id),
        updated_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE mt_document_lines (
        id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES mt_documents(id),
        line_number INTEGER NOT NULL, material_item_id TEXT NOT NULL REFERENCES mt_items(id),
        requested_quantity REAL NOT NULL, execution_quantity REAL NOT NULL DEFAULT 0,
        unit TEXT NOT NULL, tax_inclusive_unit_price REAL,
        related_request_line_id TEXT REFERENCES mt_document_lines(id), notes TEXT,
        UNIQUE (document_id, line_number)
      );
      CREATE TABLE mt_movements (
        id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES mt_items(id),
        document_id TEXT REFERENCES mt_documents(id), document_line_id TEXT REFERENCES mt_document_lines(id),
        movement_type TEXT NOT NULL, quantity_delta REAL NOT NULL CHECK (quantity_delta <> 0),
        reference_unit_price REAL, movement_date TEXT NOT NULL,
        created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
      );
      INSERT INTO users(id) VALUES ('user-1');
      INSERT INTO mt_items VALUES (
        'item-1', 'MAT-001', 'Brush', 'Consumable', NULL, 'pc', NULL, NULL, 0, 1, NULL,
        'user-1', 'user-1', '2026-07-01', '2026-07-01'
      );
      INSERT INTO mt_documents (
        id, document_number, document_type, status, applicant_user_id, request_date,
        created_by, updated_by, created_at, updated_at
      ) VALUES (
        'doc-1', 'MI-2026-0001', 'material_issue', 'executed', 'user-1', '2026-07-01',
        'user-1', 'user-1', '2026-07-01', '2026-07-01'
      );
      INSERT INTO mt_document_lines (
        id, document_id, line_number, material_item_id, requested_quantity,
        execution_quantity, unit
      ) VALUES ('line-1', 'doc-1', 1, 'item-1', 1, 1, 'pc');
      INSERT INTO mt_movements VALUES (
        'movement-1', 'item-1', 'doc-1', 'line-1', 'material_issue', -1, 10,
        '2026-07-01', 'user-1', '2026-07-01'
      );
    \`);
    ensureMaterialsToolingSchema(database);
    const expected = {
      mt_documents: ['notes', 'executed_by_user_id', 'recipient_user_id', 'recipient_name', 'inspection_result'],
      mt_document_lines: ['related_issue_line_id', 'return_condition', 'system_quantity', 'counted_quantity', 'adjustment_delta'],
      mt_movements: ['supplier_id', 'reference_quantity', 'source_workbook', 'cutover_period'],
    };
    for (const [table, columns] of Object.entries(expected)) {
      const actual = new Set(database.prepare(\`PRAGMA table_info(\${table})\`).all().map((column) => column.name));
      for (const column of columns) assert.ok(actual.has(column), \`missing \${table}.\${column}\`);
    }
    assert.deepEqual(
      database.prepare('SELECT id, movement_type, quantity_delta, reference_unit_price FROM mt_movements').get(),
      { id: 'movement-1', movement_type: 'material_issue', quantity_delta: -1, reference_unit_price: 10 },
    );
    assert.doesNotThrow(() => database.prepare(\`
      SELECT movement.source_workbook, movement.cutover_period, movement.supplier_id
      FROM mt_movements movement WHERE movement.item_id = ?
    \`).all('item-1'));
    assert.doesNotThrow(() => ensureMaterialsToolingSchema(database));
    database.close();
  `);
  try {
    execFileSync(tsx, [runner], { cwd: root, stdio: 'pipe' });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('materials tooling schema enforces domain values and lookup indexes', () => {
  assert.equal(existsSync(schemaPath), true, 'materials tooling schema module must exist');
  const schemaSource = readFileSync(schemaPath, 'utf8');

  for (const value of [
    'purchase_request', 'purchase_receipt', 'material_issue', 'material_return',
    'scrap', 'count_adjustment', 'tooling_movement', 'pending_approval',
    'pending_execution', 'awaiting_signed_copy', 'approved', 'rejected',
    'executed', 'completed', 'withdrawn', 'voided', 'in_stock', 'in_use',
    'loaned', 'under_repair', 'disposed', 'lost',
  ]) {
    assert.match(schemaSource, new RegExp(`'${value}'`), `missing constrained value ${value}`);
  }

  assert.match(schemaSource, /decision\s+TEXT[^,]*CHECK\s*\(decision\s+IN\s*\('approved',\s*'rejected'\)\)/i);
  assert.match(schemaSource, /requested_quantity\s+REAL[^,]*CHECK\s*\(requested_quantity\s*>\s*0\)/i);
  assert.match(schemaSource, /execution_quantity\s+REAL[^,]*CHECK\s*\(execution_quantity\s*>=\s*0\)/i);
  assert.match(schemaSource, /size_bytes\s+INTEGER[^,]*CHECK\s*\(size_bytes\s*>=\s*0\)/i);
  assert.match(
    schemaSource,
    /movement_type\s*=\s*'reference_purchase'\s+AND\s+quantity_delta\s*=\s*0/i,
    'reference-only purchase prices must not change stock quantity',
  );

  for (const index of [
    'idx_mt_documents_number', 'idx_mt_documents_status_date',
    'idx_mt_movements_item_date', 'idx_mt_attachments_document',
    'idx_mt_attachments_tooling_asset',
    'idx_mt_tooling_assets_status', 'idx_mt_tooling_assets_custodian',
    'idx_mt_period_snapshots_period',
  ]) {
    assert.match(schemaSource, new RegExp(`CREATE (?:UNIQUE )?INDEX IF NOT EXISTS ${index}\\b`));
  }
});

test('document versions and approvals are immutable and version-linked', () => {
  const schemaSql = extractMainSchemaSql();

  const database = new Database(':memory:');
  database.pragma('foreign_keys = ON');
  database.exec('CREATE TABLE users (id TEXT PRIMARY KEY)');
  database.exec(schemaSql);
  assert.doesNotThrow(() => database.exec(schemaSql), 'version schema initialization must be idempotent');

  database.prepare('INSERT INTO users (id) VALUES (?)').run('applicant-1');
  database.prepare('INSERT INTO users (id) VALUES (?)').run('approver-1');
  database.prepare(`
    INSERT INTO mt_documents (
      id, document_number, document_type, applicant_user_id, request_date,
      created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'doc-versioned', 'PR-2026-0001', 'purchase_request', 'applicant-1', '2026-07-14',
    'applicant-1', 'applicant-1', '2026-07-14', '2026-07-14',
  );

  const insertVersion = database.prepare(`
    INSERT INTO mt_document_versions (
      document_id, version, snapshot_json, snapshot_sha256, submitted_by, submitted_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const validHash = 'a'.repeat(64);
  for (const [label, snapshot] of [
    ['root', '[]'],
    ['header', '{"header":[],"lines":[]}'],
    ['lines', '{"header":{},"lines":{}}'],
  ]) {
    assert.throws(
      () => insertVersion.run('doc-versioned', 1, snapshot, validHash, 'applicant-1', '2026-07-14'),
      /CHECK constraint failed/,
      `snapshot ${label} shape must be rejected`,
    );
  }
  assert.doesNotThrow(() => insertVersion.run(
    'doc-versioned', 1, '{"header":{},"lines":[]}', validHash, 'applicant-1', '2026-07-14',
  ));

  const insertApproval = database.prepare(`
    INSERT INTO mt_approvals (
      id, document_id, version, approver_user_id, decision, comment, decided_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  assert.throws(
    () => insertApproval.run(
      'approval-orphan', 'doc-versioned', 2, 'approver-1', 'approved', null, '2026-07-14',
    ),
    /approval requires a frozen document version|FOREIGN KEY constraint failed/,
  );
  assert.doesNotThrow(() => insertApproval.run(
    'approval-valid', 'doc-versioned', 1, 'approver-1', 'approved', null, '2026-07-14',
  ));

  assert.throws(
    () => database.prepare('UPDATE mt_document_versions SET submitted_at = ? WHERE document_id = ? AND version = ?')
      .run('2026-07-15', 'doc-versioned', 1),
    /materials document versions are append-only/,
  );
  assert.throws(
    () => database.prepare('DELETE FROM mt_document_versions WHERE document_id = ? AND version = ?')
      .run('doc-versioned', 1),
    /materials document versions are append-only/,
  );
  assert.throws(
    () => database.prepare('UPDATE mt_approvals SET comment = ? WHERE id = ?')
      .run('changed', 'approval-valid'),
    /materials approvals are append-only/,
  );
  assert.throws(
    () => database.prepare('DELETE FROM mt_approvals WHERE id = ?').run('approval-valid'),
    /materials approvals are append-only/,
  );

  database.close();
});

test('materials tooling constraints reject inconsistent movements, owners, and periods', () => {
  const schemaSql = extractMainSchemaSql();

  const database = new Database(':memory:');
  database.pragma('foreign_keys = ON');
  database.exec('CREATE TABLE users (id TEXT PRIMARY KEY)');
  database.exec(schemaSql);
  assert.doesNotThrow(() => database.exec(schemaSql), 'schema initialization must be idempotent');

  database.prepare('INSERT INTO users (id) VALUES (?)').run('user-1');
  database.prepare(`
    INSERT INTO mt_items (
      id, code, name, category, unit, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('item-1', 'ITEM-1', 'Test item', 'consumable', 'piece', 'user-1', 'user-1', '2026-07-14', '2026-07-14');
  database.prepare(`
    INSERT INTO mt_items (
      id, code, name, category, unit, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('item-2', 'ITEM-2', 'Other item', 'consumable', 'piece', 'user-1', 'user-1', '2026-07-14', '2026-07-14');
  database.prepare(`
    INSERT INTO mt_documents (
      id, document_number, document_type, applicant_user_id, request_date,
      created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('doc-1', 'GR-2026-0001', 'purchase_receipt', 'user-1', '2026-07-14', 'user-1', 'user-1', '2026-07-14', '2026-07-14');
  database.prepare(`
    INSERT INTO mt_document_lines (
      id, document_id, line_number, material_item_id, requested_quantity, execution_quantity, unit
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('line-1', 'doc-1', 1, 'item-1', 2, 2, 'piece');
  const insertCountLine = database.prepare(`
    INSERT INTO mt_document_lines (
      id, document_id, line_number, material_item_id, requested_quantity, execution_quantity,
      unit, system_quantity, counted_quantity, adjustment_delta
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  assert.throws(
    () => insertCountLine.run('line-partial-count', 'doc-1', 2, 'item-1', 2, 2, 'piece', 10, null, null),
    /CHECK constraint failed/,
  );
  assert.throws(
    () => insertCountLine.run('line-wrong-delta', 'doc-1', 2, 'item-1', 2, 2, 'piece', 10, 12, 1),
    /CHECK constraint failed/,
  );
  assert.doesNotThrow(() => (
    insertCountLine.run('line-valid-count', 'doc-1', 2, 'item-1', 2, 2, 'piece', 10, 12, 2)
  ));

  const insertMovement = database.prepare(`
    INSERT INTO mt_movements (
      id, item_id, document_id, document_line_id, movement_type, quantity_delta,
      movement_date, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  assert.throws(
    () => insertMovement.run('move-wrong-direction', 'item-1', 'doc-1', 'line-1', 'purchase_receipt', -2, '2026-07-14', 'user-1', '2026-07-14'),
    /CHECK constraint failed/,
  );
  assert.throws(
    () => insertMovement.run('move-orphan', 'item-1', null, null, 'material_issue', -1, '2026-07-14', 'user-1', '2026-07-14'),
    /CHECK constraint failed/,
  );
  assert.throws(
    () => insertMovement.run('move-mismatch', 'item-2', 'doc-1', 'line-1', 'purchase_receipt', 2, '2026-07-14', 'user-1', '2026-07-14'),
    /FOREIGN KEY constraint failed/,
  );
  assert.doesNotThrow(() => (
    insertMovement.run('move-valid', 'item-1', 'doc-1', 'line-1', 'purchase_receipt', 2, '2026-07-14', 'user-1', '2026-07-14')
  ));
  const createDocumentWithLine = (documentType, documentId, lineId, number) => {
    database.prepare(`
      INSERT INTO mt_documents (
        id, document_number, document_type, applicant_user_id, request_date,
        created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(documentId, number, documentType, 'user-1', '2026-07-14', 'user-1', 'user-1', '2026-07-14', '2026-07-14');
    database.prepare(`
      INSERT INTO mt_document_lines (
        id, document_id, line_number, material_item_id, requested_quantity, execution_quantity, unit
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(lineId, documentId, 1, 'item-1', 1, 1, 'piece');
  };
  createDocumentWithLine('material_return', 'doc-return', 'line-return', 'MR-2026-0001');
  createDocumentWithLine('material_issue', 'doc-issue', 'line-issue', 'MI-2026-0001');
  createDocumentWithLine('scrap', 'doc-scrap', 'line-scrap', 'MS-2026-0001');
  createDocumentWithLine('count_adjustment', 'doc-count', 'line-count', 'CA-2026-0001');
  const directionCases = [
    ['material_return', 1, -1, 'doc-return', 'line-return'],
    ['material_issue', -1, 1, 'doc-issue', 'line-issue'],
    ['scrap', -1, 1, 'doc-scrap', 'line-scrap'],
    ['count_adjustment', 1, 0, 'doc-count', 'line-count'],
    ['void_reversal', -1, 0, 'doc-1', 'line-1'],
  ];
  for (const [movementType, validDelta, invalidDelta, documentId, lineId] of directionCases) {
    assert.doesNotThrow(() => insertMovement.run(
      `move-${movementType}-valid`, 'item-1', documentId, lineId, movementType,
      validDelta, '2026-07-14', 'user-1', '2026-07-14',
    ));
    assert.throws(
      () => insertMovement.run(
        `move-${movementType}-invalid`, 'item-1', documentId, lineId, movementType,
        invalidDelta, '2026-07-14', 'user-1', '2026-07-14',
      ),
      /CHECK constraint failed/,
    );
  }
  assert.throws(
    () => insertMovement.run(
      'move-type-mismatch', 'item-1', 'doc-1', 'line-1', 'material_issue',
      -1, '2026-07-14', 'user-1', '2026-07-14',
    ),
    /movement document type mismatch/,
  );

  database.prepare(`
    INSERT INTO mt_suppliers (
      id, code, name, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('supplier-1', 'SUP-1', 'Test supplier', 'user-1', 'user-1', '2026-07-14', '2026-07-14');
  const insertImportedMovement = database.prepare(`
    INSERT INTO mt_movements (
      id, item_id, movement_type, quantity_delta, reference_unit_price, movement_date,
      created_by, created_at, supplier_id, reference_quantity, source_workbook, cutover_period
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  assert.throws(() => insertImportedMovement.run(
    'opening-no-source', 'item-1', 'opening_balance', 10, null, '2026-07-01',
    'user-1', '2026-07-14', null, null, null, '2026-06',
  ), /CHECK constraint failed/);
  assert.throws(() => insertImportedMovement.run(
    'opening-bad-period', 'item-1', 'opening_balance', 10, null, '2026-07-01',
    'user-1', '2026-07-14', null, null, 'opening.xlsx', '2026-13',
  ), /CHECK constraint failed/);
  assert.doesNotThrow(() => insertImportedMovement.run(
    'opening-valid', 'item-1', 'opening_balance', 10, null, '2026-07-01',
    'user-1', '2026-07-14', null, null, 'opening.xlsx', '2026-06',
  ));
  assert.throws(() => insertImportedMovement.run(
    'reference-no-quantity', 'item-1', 'reference_purchase', 0, 12.5, '2026-06-01',
    'user-1', '2026-07-14', 'supplier-1', null, 'prices.xlsx', '2026-06',
  ), /CHECK constraint failed/);
  assert.throws(() => insertImportedMovement.run(
    'reference-no-price', 'item-1', 'reference_purchase', 0, null, '2026-06-01',
    'user-1', '2026-07-14', 'supplier-1', 5, 'prices.xlsx', '2026-06',
  ), /CHECK constraint failed/);
  assert.throws(() => insertImportedMovement.run(
    'reference-no-source', 'item-1', 'reference_purchase', 0, 12.5, '2026-06-01',
    'user-1', '2026-07-14', 'supplier-1', 5, null, '2026-06',
  ), /CHECK constraint failed/);
  assert.throws(() => insertImportedMovement.run(
    'reference-bad-period', 'item-1', 'reference_purchase', 0, 12.5, '2026-06-01',
    'user-1', '2026-07-14', 'supplier-1', 5, 'prices.xlsx', '2026-00',
  ), /CHECK constraint failed/);
  assert.throws(() => insertImportedMovement.run(
    'reference-no-supplier', 'item-1', 'reference_purchase', 0, 12.5, '2026-06-01',
    'user-1', '2026-07-14', null, 5, 'prices.xlsx', '2026-06',
  ), /CHECK constraint failed/);
  assert.throws(() => insertImportedMovement.run(
    'reference-bad-supplier', 'item-1', 'reference_purchase', 0, 12.5, '2026-06-01',
    'user-1', '2026-07-14', 'missing-supplier', 5, 'prices.xlsx', '2026-06',
  ), /FOREIGN KEY constraint failed/);
  assert.doesNotThrow(() => insertImportedMovement.run(
    'reference-valid', 'item-1', 'reference_purchase', 0, 12.5, '2026-06-01',
    'user-1', '2026-07-14', 'supplier-1', 5, 'prices.xlsx', '2026-06',
  ));
  assert.throws(
    () => database.prepare('UPDATE mt_movements SET quantity_delta = ? WHERE id = ?').run(3, 'move-valid'),
    /materials movements are append-only/,
  );
  assert.throws(
    () => database.prepare('DELETE FROM mt_movements WHERE id = ?').run('move-valid'),
    /materials movements are append-only/,
  );
  assert.deepEqual(
    database.prepare('SELECT movement_type, quantity_delta FROM mt_movements WHERE id = ?').get('move-valid'),
    { movement_type: 'purchase_receipt', quantity_delta: 2 },
  );

  database.prepare(`
    INSERT INTO mt_tooling_assets (
      id, tooling_code, name, category, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('tool-1', 'TOOL-1', 'Test tool', 'mold', 'user-1', 'user-1', '2026-07-14', '2026-07-14');
  const insertAttachment = database.prepare(`
    INSERT INTO mt_attachments (
      id, document_id, tooling_asset_id, category, original_name, stored_name,
      mime_type, size_bytes, uploaded_by, uploaded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  assert.throws(
    () => insertAttachment.run('att-none', null, null, 'other', 'none.pdf', 'none', 'application/pdf', 1, 'user-1', '2026-07-14'),
    /CHECK constraint failed/,
  );
  assert.throws(
    () => insertAttachment.run('att-both', 'doc-1', 'tool-1', 'other', 'both.pdf', 'both', 'application/pdf', 1, 'user-1', '2026-07-14'),
    /CHECK constraint failed/,
  );
  assert.doesNotThrow(() => insertAttachment.run(
    'att-doc', 'doc-1', null, 'other', 'doc.pdf', 'doc', 'application/pdf', 1, 'user-1', '2026-07-14',
  ));
  assert.doesNotThrow(() => insertAttachment.run(
    'att-tool', null, 'tool-1', 'tooling_photo', 'tool.png', 'tool', 'image/png', 1, 'user-1', '2026-07-14',
  ));

  const insertPeriod = database.prepare(`
    INSERT INTO mt_periods (period_key, status, closed_by, closed_at)
    VALUES (?, ?, ?, ?)
  `);
  assert.throws(() => insertPeriod.run('2026-13', 'open', null, null), /CHECK constraint failed/);
  assert.throws(() => insertPeriod.run('2026-07', 'closed', null, null), /CHECK constraint failed/);
  assert.doesNotThrow(() => insertPeriod.run('2026-07', 'closed', 'user-1', '2026-07-31'));
  assert.throws(
    () => database.prepare(`
      INSERT INTO mt_periods (period_key, status, reopened_by, reopened_at, reopen_reason)
      VALUES (?, ?, ?, ?, ?)
    `).run('2026-08', 'open', 'user-1', null, 'Correction'),
    /CHECK constraint failed/,
  );
  assert.throws(
    () => database.prepare(`
      INSERT INTO mt_periods (period_key, status, reopened_by, reopened_at, reopen_reason)
      VALUES (?, ?, ?, ?, ?)
    `).run('2026-09', 'open', 'user-1', '2026-09-01', '   '),
    /CHECK constraint failed/,
  );

  database.close();
});
