import Database from 'better-sqlite3';

type TableColumn = { name: string; notnull: number };

function addColumnIfMissing(
  database: Database.Database,
  table: string,
  column: string,
  definition: string,
): void {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as TableColumn[];
  if (columns.some((entry) => entry.name === column)) return;
  database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function createMovementGuards(database: Database.Database): void {
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_mt_movements_item_date
      ON mt_movements(item_id, movement_date);
    CREATE TRIGGER IF NOT EXISTS trg_mt_movements_document_type
    BEFORE INSERT ON mt_movements
    WHEN NEW.document_id IS NOT NULL
      AND NEW.movement_type IN (
        'purchase_receipt', 'material_issue', 'material_return', 'scrap', 'count_adjustment'
      )
      AND NOT EXISTS (
        SELECT 1 FROM mt_documents
        WHERE id = NEW.document_id AND document_type = NEW.movement_type
      )
    BEGIN
      SELECT RAISE(ABORT, 'movement document type mismatch');
    END;
    CREATE TRIGGER IF NOT EXISTS trg_mt_movements_append_only_update
    BEFORE UPDATE ON mt_movements
    BEGIN
      SELECT RAISE(ABORT, 'materials movements are append-only');
    END;
    CREATE TRIGGER IF NOT EXISTS trg_mt_movements_append_only_delete
    BEFORE DELETE ON mt_movements
    BEGIN
      SELECT RAISE(ABORT, 'materials movements are append-only');
    END;
  `);
}

function upgradeLegacyCoreTables(database: Database.Database): void {
  database.transaction(() => {
  for (const [column, definition] of [
    ['notes', 'TEXT'],
    ['executed_by_user_id', 'TEXT REFERENCES users(id)'],
    ['recipient_user_id', 'TEXT REFERENCES users(id)'],
    ['recipient_name', 'TEXT'],
    ['inspection_result', 'TEXT'],
    ['supplier_name', 'TEXT'],
  ] as const) addColumnIfMissing(database, 'mt_documents', column, definition);

  addColumnIfMissing(database, 'mt_movements', 'supplier_name', 'TEXT');

  for (const [column, definition] of [
    ['related_issue_line_id', 'TEXT REFERENCES mt_document_lines(id)'],
    ['return_condition', 'TEXT'],
    ['system_quantity', 'REAL CHECK (system_quantity >= 0)'],
    ['counted_quantity', 'REAL CHECK (counted_quantity >= 0)'],
    ['adjustment_delta', 'REAL'],
  ] as const) addColumnIfMissing(database, 'mt_document_lines', column, definition);

  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_mt_document_lines_movement_parent
      ON mt_document_lines(id, document_id, material_item_id);
  `);

  const movementTable = database.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'mt_movements'",
  ).get() as { sql: string | null } | undefined;
  const movementColumns = database.prepare('PRAGMA table_info(mt_movements)').all() as TableColumn[];
  const movementColumnNames = new Set(movementColumns.map((column) => column.name));
  const needsMovementUpgrade = [
    'supplier_id', 'supplier_name', 'reference_quantity', 'source_workbook', 'cutover_period',
  ].some((column) => !movementColumnNames.has(column))
    || !movementTable?.sql?.includes("movement_type = 'reference_purchase' AND quantity_delta = 0");

  if (!needsMovementUpgrade) {
    createMovementGuards(database);
    return;
  }

  const unsupportedReferencePurchase = database.prepare(`
    SELECT id FROM mt_movements WHERE movement_type = 'reference_purchase' LIMIT 1
  `).get() as { id: string } | undefined;
  if (unsupportedReferencePurchase) {
    throw new Error(
      `Cannot automatically upgrade legacy reference purchase ${unsupportedReferencePurchase.id}: supplier metadata is missing`,
    );
  }

  database.exec(`
      CREATE TABLE mt_movements_upgrade (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL REFERENCES mt_items(id),
        document_id TEXT REFERENCES mt_documents(id),
        document_line_id TEXT REFERENCES mt_document_lines(id),
        movement_type TEXT NOT NULL CHECK (movement_type IN (
          'opening_balance', 'purchase_receipt', 'material_issue', 'material_return',
          'scrap', 'count_adjustment', 'void_reversal', 'reference_purchase'
        )),
        quantity_delta REAL NOT NULL CHECK (
          (movement_type = 'opening_balance' AND quantity_delta > 0)
          OR (movement_type IN ('purchase_receipt', 'material_return') AND quantity_delta > 0)
          OR (movement_type IN ('material_issue', 'scrap') AND quantity_delta < 0)
          OR (movement_type IN ('count_adjustment', 'void_reversal') AND quantity_delta <> 0)
          OR (movement_type = 'reference_purchase' AND quantity_delta = 0)
        ),
        reference_unit_price REAL CHECK (reference_unit_price >= 0),
        movement_date TEXT NOT NULL,
        created_by TEXT NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL,
        supplier_id TEXT REFERENCES mt_suppliers(id),
        supplier_name TEXT,
        reference_quantity REAL CHECK (reference_quantity > 0),
        source_workbook TEXT,
        cutover_period TEXT CHECK (
          cutover_period IS NULL
          OR (
            length(cutover_period) = 7
            AND substr(cutover_period, 5, 1) = '-'
            AND substr(cutover_period, 1, 4) GLOB '[0-9][0-9][0-9][0-9]'
            AND substr(cutover_period, 6, 2) IN (
              '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'
            )
          )
        ),
        FOREIGN KEY (document_line_id, document_id, item_id)
          REFERENCES mt_document_lines(id, document_id, material_item_id),
        CHECK (
          (
            movement_type IN ('opening_balance', 'reference_purchase')
            AND document_id IS NULL AND document_line_id IS NULL
          )
          OR (
            movement_type NOT IN ('opening_balance', 'reference_purchase')
            AND document_id IS NOT NULL AND document_line_id IS NOT NULL
          )
        ),
        CHECK (
          movement_type <> 'opening_balance'
          OR (
            source_workbook IS NOT NULL AND length(trim(source_workbook)) > 0
            AND cutover_period IS NOT NULL
          )
        ),
        CHECK (
          movement_type <> 'reference_purchase'
          OR (
            reference_quantity IS NOT NULL AND reference_unit_price IS NOT NULL
            AND reference_unit_price > 0 AND supplier_id IS NOT NULL
            AND source_workbook IS NOT NULL AND length(trim(source_workbook)) > 0
            AND cutover_period IS NOT NULL
          )
        )
      );
      INSERT INTO mt_movements_upgrade (
        id, item_id, document_id, document_line_id, movement_type, quantity_delta,
        reference_unit_price, movement_date, created_by, created_at,
        supplier_id, supplier_name, reference_quantity, source_workbook, cutover_period
      )
      SELECT
        id, item_id, document_id, document_line_id, movement_type, quantity_delta,
        reference_unit_price, movement_date, created_by, created_at,
        ${movementColumnNames.has('supplier_id') ? 'supplier_id' : 'NULL'},
        ${movementColumnNames.has('supplier_name') ? 'supplier_name' : 'NULL'},
        ${movementColumnNames.has('reference_quantity') ? 'reference_quantity' : 'NULL'},
        CASE
          WHEN movement_type = 'opening_balance' THEN COALESCE(
            ${movementColumnNames.has('source_workbook') ? 'source_workbook' : 'NULL'},
            'legacy-schema-migration'
          )
          ELSE ${movementColumnNames.has('source_workbook') ? 'source_workbook' : 'NULL'}
        END,
        CASE
          WHEN movement_type = 'opening_balance' THEN COALESCE(
            ${movementColumnNames.has('cutover_period') ? 'cutover_period' : 'NULL'},
            substr(movement_date, 1, 7)
          )
          ELSE ${movementColumnNames.has('cutover_period') ? 'cutover_period' : 'NULL'}
        END
      FROM mt_movements;
      DROP TABLE mt_movements;
      ALTER TABLE mt_movements_upgrade RENAME TO mt_movements;
  `);
  createMovementGuards(database);
  }).immediate();
}

function upgradeLegacyAttachments(database: Database.Database): void {
  const columns = database.prepare('PRAGMA table_info(mt_attachments)').all() as TableColumn[];
  if (columns.length === 0) return;

  const names = new Set(columns.map((column) => column.name));
  const documentId = columns.find((column) => column.name === 'document_id');
  if (names.has('tooling_asset_id') && names.has('notes') && documentId?.notnull === 0) return;

  const toolingAssetSelect = names.has('tooling_asset_id') ? 'tooling_asset_id' : 'NULL';
  const notesSelect = names.has('notes') ? 'notes' : 'NULL';
  database.transaction(() => {
    database.exec(`
      CREATE TABLE mt_attachments_upgrade (
        id TEXT PRIMARY KEY,
        document_id TEXT REFERENCES mt_documents(id),
        category TEXT NOT NULL CHECK (category IN (
          'quotation', 'contract', 'invoice', 'delivery_note', 'acceptance_record',
          'signed_copy', 'tooling_photo', 'drawing', 'other'
        )),
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL UNIQUE,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
        is_sensitive INTEGER NOT NULL DEFAULT 0 CHECK (is_sensitive IN (0, 1)),
        uploaded_by TEXT NOT NULL REFERENCES users(id),
        uploaded_at TEXT NOT NULL,
        deleted_by TEXT REFERENCES users(id),
        deleted_at TEXT,
        tooling_asset_id TEXT REFERENCES mt_tooling_assets(id),
        notes TEXT,
        CHECK ((deleted_by IS NULL AND deleted_at IS NULL) OR (deleted_by IS NOT NULL AND deleted_at IS NOT NULL)),
        CHECK (
          (document_id IS NOT NULL AND tooling_asset_id IS NULL)
          OR (document_id IS NULL AND tooling_asset_id IS NOT NULL)
        )
      );
      INSERT INTO mt_attachments_upgrade (
        id, document_id, category, original_name, stored_name, mime_type, size_bytes,
        is_sensitive, uploaded_by, uploaded_at, deleted_by, deleted_at, tooling_asset_id, notes
      )
      SELECT
        id, document_id, category, original_name, stored_name, mime_type, size_bytes,
        is_sensitive, uploaded_by, uploaded_at, deleted_by, deleted_at,
        ${toolingAssetSelect}, ${notesSelect}
      FROM mt_attachments;
      DROP TABLE mt_attachments;
      ALTER TABLE mt_attachments_upgrade RENAME TO mt_attachments;
    `);
  }).immediate();
}

function upgradeLegacyToolingMovements(database: Database.Database): void {
  const table = database.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='mt_tooling_movements'",
  ).get() as { sql: string | null } | undefined;
  if (!table?.sql || /['"]loan['"]/.test(table.sql)) return;
  const indexes = database.prepare(
    "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='mt_tooling_movements' AND sql IS NOT NULL",
  ).all() as Array<{ sql: string }>;

  database.transaction(() => {
    database.exec(`
      CREATE TABLE mt_tooling_movements_upgrade (
        id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL REFERENCES mt_tooling_assets(id),
        document_id TEXT NOT NULL REFERENCES mt_documents(id),
        movement_type TEXT NOT NULL CHECK (movement_type IN (
          'issue', 'return', 'loan', 'transfer', 'repair', 'repair_completion',
          'disposal', 'loss_report'
        )),
        from_status TEXT CHECK (from_status IS NULL OR from_status IN (
          'in_stock', 'in_use', 'loaned', 'under_repair', 'disposed', 'lost'
        )),
        to_status TEXT NOT NULL CHECK (to_status IN (
          'in_stock', 'in_use', 'loaned', 'under_repair', 'disposed', 'lost'
        )),
        from_custodian_user_id TEXT REFERENCES users(id),
        to_custodian_user_id TEXT REFERENCES users(id),
        from_location TEXT,
        to_location TEXT,
        reason TEXT,
        created_by TEXT NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL
      );
      INSERT INTO mt_tooling_movements_upgrade
      SELECT * FROM mt_tooling_movements;
      DROP TABLE mt_tooling_movements;
      ALTER TABLE mt_tooling_movements_upgrade RENAME TO mt_tooling_movements;
    `);
    for (const index of indexes) database.exec(index.sql);
  }).immediate();
}

function upgradeToolingMovementsVoidReversal(database: Database.Database): void {
  const table = database.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND tbl_name='mt_tooling_movements'",
  ).get() as { sql: string } | undefined;
  if (!table?.sql || /void_reversal/.test(table.sql)) return;
  const indexes = database.prepare(
    "SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='mt_tooling_movements' AND sql IS NOT NULL",
  ).all() as Array<{ sql: string }>;

  database.transaction(() => {
    database.exec(`
      CREATE TABLE mt_tooling_movements_upgrade (
        id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL REFERENCES mt_tooling_assets(id),
        document_id TEXT NOT NULL REFERENCES mt_documents(id),
        movement_type TEXT NOT NULL CHECK (movement_type IN (
          'issue', 'return', 'loan', 'transfer', 'repair', 'repair_completion',
          'disposal', 'loss_report', 'void_reversal'
        )),
        from_status TEXT CHECK (from_status IS NULL OR from_status IN (
          'in_stock', 'in_use', 'loaned', 'under_repair', 'disposed', 'lost'
        )),
        to_status TEXT NOT NULL CHECK (to_status IN (
          'in_stock', 'in_use', 'loaned', 'under_repair', 'disposed', 'lost'
        )),
        from_custodian_user_id TEXT REFERENCES users(id),
        to_custodian_user_id TEXT REFERENCES users(id),
        from_location TEXT,
        to_location TEXT,
        reason TEXT,
        created_by TEXT NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL
      );
      INSERT INTO mt_tooling_movements_upgrade
      SELECT * FROM mt_tooling_movements;
      DROP TABLE mt_tooling_movements;
      ALTER TABLE mt_tooling_movements_upgrade RENAME TO mt_tooling_movements;
    `);
    for (const index of indexes) database.exec(index.sql);
  }).immediate();
}

export function ensureMaterialsToolingSchema(database: Database.Database): void {
  upgradeLegacyAttachments(database);
  database.exec(`
    CREATE TABLE IF NOT EXISTS mt_permissions (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      manage_materials INTEGER NOT NULL DEFAULT 0 CHECK (manage_materials IN (0, 1)),
      approve INTEGER NOT NULL DEFAULT 0 CHECK (approve IN (0, 1)),
      view_prices INTEGER NOT NULL DEFAULT 0 CHECK (view_prices IN (0, 1)),
      manage_periods INTEGER NOT NULL DEFAULT 0 CHECK (manage_periods IN (0, 1)),
      updated_by TEXT REFERENCES users(id),
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mt_approval_config (
      document_type TEXT PRIMARY KEY CHECK (document_type IN (
        'purchase_request', 'purchase_receipt', 'material_issue', 'material_return',
        'scrap', 'count_adjustment', 'tooling_movement'
      )),
      approver_user_id TEXT NOT NULL REFERENCES users(id),
      updated_by TEXT NOT NULL REFERENCES users(id),
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mt_suppliers (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      contact_name TEXT,
      phone TEXT,
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_by TEXT NOT NULL REFERENCES users(id),
      updated_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mt_items (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      specification TEXT,
      unit TEXT NOT NULL,
      warehouse TEXT,
      bin_location TEXT,
      safety_quantity REAL NOT NULL DEFAULT 0 CHECK (safety_quantity >= 0),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      notes TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      updated_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mt_documents (
      id TEXT PRIMARY KEY,
      document_number TEXT NOT NULL UNIQUE,
      document_type TEXT NOT NULL CHECK (document_type IN (
        'purchase_request', 'purchase_receipt', 'material_issue', 'material_return',
        'scrap', 'count_adjustment', 'tooling_movement'
      )),
      version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'pending_approval', 'approved', 'rejected', 'pending_execution',
        'executed', 'awaiting_signed_copy', 'completed', 'withdrawn', 'voided'
      )),
      applicant_user_id TEXT NOT NULL REFERENCES users(id),
      department TEXT,
      request_date TEXT NOT NULL,
      required_date TEXT,
      execution_date TEXT,
      purpose TEXT,
      supplier_id TEXT REFERENCES mt_suppliers(id),
      supplier_name TEXT,
      invoice_number TEXT,
      contract_number TEXT,
      replaces_document_id TEXT REFERENCES mt_documents(id),
      replaced_by_document_id TEXT REFERENCES mt_documents(id),
      assigned_approver_user_id TEXT REFERENCES users(id),
      rejection_reason TEXT,
      void_reason TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      updated_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      notes TEXT,
      executed_by_user_id TEXT REFERENCES users(id),
      recipient_user_id TEXT REFERENCES users(id),
      recipient_name TEXT,
      inspection_result TEXT,
      CHECK (replaces_document_id IS NULL OR replaces_document_id <> id),
      CHECK (replaced_by_document_id IS NULL OR replaced_by_document_id <> id)
    );

    CREATE TABLE IF NOT EXISTS mt_document_lines (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES mt_documents(id),
      line_number INTEGER NOT NULL CHECK (line_number > 0),
      material_item_id TEXT NOT NULL REFERENCES mt_items(id),
      requested_quantity REAL NOT NULL CHECK (requested_quantity > 0),
      execution_quantity REAL NOT NULL DEFAULT 0 CHECK (execution_quantity >= 0),
      unit TEXT NOT NULL,
      tax_inclusive_unit_price REAL CHECK (tax_inclusive_unit_price >= 0),
      related_request_line_id TEXT REFERENCES mt_document_lines(id),
      related_issue_line_id TEXT REFERENCES mt_document_lines(id),
      return_condition TEXT,
      system_quantity REAL CHECK (system_quantity >= 0),
      counted_quantity REAL CHECK (counted_quantity >= 0),
      adjustment_delta REAL,
      notes TEXT,
      UNIQUE (document_id, line_number),
      UNIQUE (id, document_id, material_item_id),
      CHECK (
        (system_quantity IS NULL AND counted_quantity IS NULL AND adjustment_delta IS NULL)
        OR (
          system_quantity IS NOT NULL
          AND counted_quantity IS NOT NULL
          AND adjustment_delta IS NOT NULL
          AND ABS((counted_quantity - system_quantity) - adjustment_delta) < 0.000001
        )
      )
    );

    CREATE TABLE IF NOT EXISTS mt_approvals (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES mt_documents(id),
      version INTEGER NOT NULL CHECK (version > 0),
      approver_user_id TEXT NOT NULL REFERENCES users(id),
      decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
      comment TEXT,
      decided_at TEXT NOT NULL,
      UNIQUE (document_id, version, approver_user_id),
      FOREIGN KEY (document_id, version) REFERENCES mt_document_versions(document_id, version)
    );

    CREATE TABLE IF NOT EXISTS mt_document_versions (
      document_id TEXT NOT NULL REFERENCES mt_documents(id),
      version INTEGER NOT NULL CHECK (version > 0),
      snapshot_json TEXT NOT NULL CHECK (
        json_valid(snapshot_json)
        AND json_type(snapshot_json) = 'object'
        AND json_type(snapshot_json, '$.header') = 'object'
        AND json_type(snapshot_json, '$.lines') = 'array'
      ),
      snapshot_sha256 TEXT NOT NULL CHECK (
        length(snapshot_sha256) = 64
        AND snapshot_sha256 NOT GLOB '*[^0-9a-f]*'
      ),
      submitted_by TEXT NOT NULL REFERENCES users(id),
      submitted_at TEXT NOT NULL,
      PRIMARY KEY (document_id, version)
    );

    CREATE TABLE IF NOT EXISTS mt_movements (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES mt_items(id),
      document_id TEXT REFERENCES mt_documents(id),
      document_line_id TEXT REFERENCES mt_document_lines(id),
      movement_type TEXT NOT NULL CHECK (movement_type IN (
        'opening_balance', 'purchase_receipt', 'material_issue', 'material_return',
        'scrap', 'count_adjustment', 'void_reversal', 'reference_purchase'
      )),
      quantity_delta REAL NOT NULL CHECK (
        (movement_type = 'opening_balance' AND quantity_delta > 0)
        OR (movement_type IN ('purchase_receipt', 'material_return') AND quantity_delta > 0)
        OR (movement_type IN ('material_issue', 'scrap') AND quantity_delta < 0)
        OR (movement_type IN ('count_adjustment', 'void_reversal') AND quantity_delta <> 0)
        OR (movement_type = 'reference_purchase' AND quantity_delta = 0)
      ),
      reference_unit_price REAL CHECK (reference_unit_price >= 0),
      movement_date TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      supplier_id TEXT REFERENCES mt_suppliers(id),
      supplier_name TEXT,
      reference_quantity REAL CHECK (reference_quantity > 0),
      source_workbook TEXT,
      cutover_period TEXT CHECK (
        cutover_period IS NULL
        OR (
          length(cutover_period) = 7
          AND substr(cutover_period, 5, 1) = '-'
          AND substr(cutover_period, 1, 4) GLOB '[0-9][0-9][0-9][0-9]'
          AND substr(cutover_period, 6, 2) IN (
            '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'
          )
        )
      ),
      FOREIGN KEY (document_line_id, document_id, item_id)
        REFERENCES mt_document_lines(id, document_id, material_item_id),
      CHECK (
        (
          movement_type IN ('opening_balance', 'reference_purchase')
          AND document_id IS NULL
          AND document_line_id IS NULL
        )
        OR (
          movement_type NOT IN ('opening_balance', 'reference_purchase')
          AND document_id IS NOT NULL
          AND document_line_id IS NOT NULL
        )
      ),
      CHECK (
        movement_type <> 'opening_balance'
        OR (
          source_workbook IS NOT NULL
          AND length(trim(source_workbook)) > 0
          AND cutover_period IS NOT NULL
        )
      ),
      CHECK (
        movement_type <> 'reference_purchase'
        OR (
          reference_quantity IS NOT NULL
          AND reference_unit_price IS NOT NULL
          AND reference_unit_price > 0
          AND supplier_id IS NOT NULL
          AND source_workbook IS NOT NULL
          AND length(trim(source_workbook)) > 0
          AND cutover_period IS NOT NULL
        )
      )
    );

    CREATE TABLE IF NOT EXISTS mt_snapshots (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES mt_documents(id),
      version INTEGER NOT NULL CHECK (version > 0),
      variant TEXT NOT NULL CHECK (variant IN ('application', 'approved')),
      relative_path TEXT NOT NULL UNIQUE,
      sha256 TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      UNIQUE (document_id, version, variant)
    );

    CREATE TABLE IF NOT EXISTS mt_attachments (
      id TEXT PRIMARY KEY,
      document_id TEXT REFERENCES mt_documents(id),
      category TEXT NOT NULL CHECK (category IN (
        'quotation', 'contract', 'invoice', 'delivery_note', 'acceptance_record',
        'signed_copy', 'tooling_photo', 'drawing', 'other'
      )),
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL UNIQUE,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
      is_sensitive INTEGER NOT NULL DEFAULT 0 CHECK (is_sensitive IN (0, 1)),
      uploaded_by TEXT NOT NULL REFERENCES users(id),
      uploaded_at TEXT NOT NULL,
      deleted_by TEXT REFERENCES users(id),
      deleted_at TEXT,
      tooling_asset_id TEXT REFERENCES mt_tooling_assets(id),
      notes TEXT,
      CHECK ((deleted_by IS NULL AND deleted_at IS NULL) OR (deleted_by IS NOT NULL AND deleted_at IS NOT NULL)),
      CHECK (
        (document_id IS NOT NULL AND tooling_asset_id IS NULL)
        OR (document_id IS NULL AND tooling_asset_id IS NOT NULL)
      )
    );

    CREATE TABLE IF NOT EXISTS mt_periods (
      period_key TEXT PRIMARY KEY CHECK (
        length(period_key) = 7
        AND substr(period_key, 5, 1) = '-'
        AND substr(period_key, 1, 4) GLOB '[0-9][0-9][0-9][0-9]'
        AND substr(period_key, 6, 2) IN ('01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12')
      ),
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
      closed_by TEXT REFERENCES users(id),
      closed_at TEXT,
      reopened_by TEXT REFERENCES users(id),
      reopened_at TEXT,
      reopen_reason TEXT,
      CHECK (status <> 'closed' OR (closed_by IS NOT NULL AND closed_at IS NOT NULL)),
      CHECK (
        (reopened_by IS NULL AND reopened_at IS NULL AND reopen_reason IS NULL)
        OR (
          reopened_by IS NOT NULL
          AND reopened_at IS NOT NULL
          AND reopen_reason IS NOT NULL
          AND length(trim(reopen_reason)) > 0
        )
      )
    );

    CREATE TABLE IF NOT EXISTS mt_period_snapshots (
      id TEXT PRIMARY KEY,
      period_key TEXT NOT NULL REFERENCES mt_periods(period_key),
      version INTEGER NOT NULL CHECK (version > 0),
      snapshot_json TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      UNIQUE (period_key, version)
    );

    CREATE TABLE IF NOT EXISTS mt_tooling_assets (
      id TEXT PRIMARY KEY,
      tooling_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      specification TEXT,
      serial_number TEXT,
      tracked_quantity REAL NOT NULL DEFAULT 1 CHECK (tracked_quantity > 0),
      status TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN (
        'in_stock', 'in_use', 'loaned', 'under_repair', 'disposed', 'lost'
      )),
      custodian_user_id TEXT REFERENCES users(id),
      location TEXT,
      supplier_id TEXT REFERENCES mt_suppliers(id),
      purchase_price REAL CHECK (purchase_price >= 0),
      contract_number TEXT,
      invoice_number TEXT,
      acquired_at TEXT,
      expected_life_months INTEGER CHECK (expected_life_months > 0),
      next_maintenance_date TEXT,
      notes TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      updated_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mt_tooling_requests (
      document_id TEXT PRIMARY KEY REFERENCES mt_documents(id),
      asset_id TEXT NOT NULL REFERENCES mt_tooling_assets(id),
      action TEXT NOT NULL CHECK (action IN (
        'issue', 'return', 'loan', 'transfer', 'repair', 'repair_completion',
        'disposal', 'loss_report'
      )),
      to_custodian_user_id TEXT REFERENCES users(id),
      to_location TEXT,
      reason TEXT
    );

    CREATE TABLE IF NOT EXISTS mt_tooling_movements (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL REFERENCES mt_tooling_assets(id),
      document_id TEXT NOT NULL REFERENCES mt_documents(id),
      movement_type TEXT NOT NULL CHECK (movement_type IN (
        'issue', 'return', 'loan', 'transfer', 'repair', 'repair_completion', 'disposal', 'loss_report'
      )),
      from_status TEXT CHECK (from_status IS NULL OR from_status IN (
        'in_stock', 'in_use', 'loaned', 'under_repair', 'disposed', 'lost'
      )),
      to_status TEXT NOT NULL CHECK (to_status IN (
        'in_stock', 'in_use', 'loaned', 'under_repair', 'disposed', 'lost'
      )),
      from_custodian_user_id TEXT REFERENCES users(id),
      to_custodian_user_id TEXT REFERENCES users(id),
      from_location TEXT,
      to_location TEXT,
      reason TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_mt_documents_number ON mt_documents(document_number);
    CREATE INDEX IF NOT EXISTS idx_mt_documents_status_date ON mt_documents(status, request_date);
    CREATE INDEX IF NOT EXISTS idx_mt_movements_item_date ON mt_movements(item_id, movement_date);
    CREATE INDEX IF NOT EXISTS idx_mt_attachments_document ON mt_attachments(document_id);
    CREATE INDEX IF NOT EXISTS idx_mt_attachments_tooling_asset ON mt_attachments(tooling_asset_id);
    CREATE INDEX IF NOT EXISTS idx_mt_tooling_assets_status ON mt_tooling_assets(status);
    CREATE INDEX IF NOT EXISTS idx_mt_tooling_assets_custodian ON mt_tooling_assets(custodian_user_id);
    CREATE INDEX IF NOT EXISTS idx_mt_tooling_requests_asset ON mt_tooling_requests(asset_id);
    CREATE INDEX IF NOT EXISTS idx_mt_period_snapshots_period ON mt_period_snapshots(period_key, version);

    CREATE TRIGGER IF NOT EXISTS trg_mt_document_versions_append_only_update
    BEFORE UPDATE ON mt_document_versions
    BEGIN
      SELECT RAISE(ABORT, 'materials document versions are append-only');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_mt_document_versions_append_only_delete
    BEFORE DELETE ON mt_document_versions
    BEGIN
      SELECT RAISE(ABORT, 'materials document versions are append-only');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_mt_approvals_require_version
    BEFORE INSERT ON mt_approvals
    WHEN NOT EXISTS (
      SELECT 1 FROM mt_document_versions
      WHERE document_id = NEW.document_id AND version = NEW.version
    )
    BEGIN
      SELECT RAISE(ABORT, 'approval requires a frozen document version');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_mt_approvals_append_only_update
    BEFORE UPDATE ON mt_approvals
    BEGIN
      SELECT RAISE(ABORT, 'materials approvals are append-only');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_mt_approvals_append_only_delete
    BEFORE DELETE ON mt_approvals
    BEGIN
      SELECT RAISE(ABORT, 'materials approvals are append-only');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_mt_movements_document_type
    BEFORE INSERT ON mt_movements
    WHEN NEW.document_id IS NOT NULL
      AND NEW.movement_type IN (
        'purchase_receipt', 'material_issue', 'material_return', 'scrap', 'count_adjustment'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM mt_documents
        WHERE id = NEW.document_id
          AND document_type = NEW.movement_type
      )
    BEGIN
      SELECT RAISE(ABORT, 'movement document type mismatch');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_mt_movements_append_only_update
    BEFORE UPDATE ON mt_movements
    BEGIN
      SELECT RAISE(ABORT, 'materials movements are append-only');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_mt_movements_append_only_delete
    BEFORE DELETE ON mt_movements
    BEGIN
      SELECT RAISE(ABORT, 'materials movements are append-only');
    END;
  `);
  upgradeLegacyCoreTables(database);
  upgradeLegacyToolingMovements(database);
  upgradeToolingMovementsVoidReversal(database);
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_mt_tooling_movements_asset
      ON mt_tooling_movements(asset_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_mt_tooling_movements_document
      ON mt_tooling_movements(document_id);
  `);
}
