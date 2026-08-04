import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { ensureMaterialsToolingSchema } from './materials-tooling/schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.CRM_DB_PATH || path.join(__dirname, '..', 'crm.db');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company_type TEXT NOT NULL DEFAULT 'end_user',
    industry TEXT,
    registration_number TEXT,
    website TEXT,
    phone TEXT,
    email TEXT,
    address_line_1 TEXT,
    address_line_2 TEXT,
    city TEXT,
    state_province TEXT,
    country TEXT NOT NULL DEFAULT 'US',
    postal_code TEXT,
    region TEXT,
    credit_term TEXT,
    credit_limit REAL,
    status TEXT NOT NULL DEFAULT 'active',
    classification TEXT DEFAULT 'C',
    lead_source TEXT,
    first_contact_date TEXT,
    last_activity_at TEXT,
    development_stage TEXT NOT NULL DEFAULT 'uncontacted'
      CHECK (development_stage IN ('uncontacted', 'contacted', 'replied', 'qualified', 'converted', 'nurturing', 'stopped')),
    tags TEXT DEFAULT '[]',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id),
    salutation TEXT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    job_title TEXT,
    department TEXT,
    role_in_process TEXT DEFAULT 'procurement',
    email TEXT NOT NULL,
    phone_direct TEXT,
    phone_mobile TEXT,
    wechat_id TEXT,
    is_primary_contact INTEGER DEFAULT 0,
    is_decision_maker INTEGER DEFAULT 0,
    communication_language TEXT DEFAULT 'en',
    preferred_contact_method TEXT,
    timezone TEXT,
    notes TEXT,
    last_contacted_at TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    subject TEXT NOT NULL,
    description TEXT,
    direction TEXT,
    outcome TEXT CHECK (outcome IS NULL OR outcome IN ('no_response', 'replied', 'interested', 'no_current_need', 'not_interested')),
    channel TEXT,
    duration_minutes INTEGER,
    linked_entity_type TEXT,
    linked_entity_id TEXT,
    is_private INTEGER DEFAULT 0,
    attachments TEXT DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    description TEXT,
    task_type TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'pending',
    due_date TEXT,
    due_time TEXT,
    completed_at TEXT,
    is_recurring INTEGER DEFAULT 0,
    recurring_rule TEXT,
    entity_type TEXT,
    entity_id TEXT,
    contact_id TEXT REFERENCES contacts(id),
    reminder_at TEXT,
    reminder_sent INTEGER DEFAULT 0,
    tags TEXT DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS inquiries (
    id TEXT PRIMARY KEY,
    inquiry_number TEXT NOT NULL UNIQUE,
    company_id TEXT NOT NULL REFERENCES companies(id),
    contact_id TEXT REFERENCES contacts(id),
    project_id TEXT,
    assigned_to TEXT,
    source TEXT NOT NULL,
    application_description TEXT NOT NULL,
    target_material_requested TEXT,
    recommended_product_id TEXT,
    operating_temp_min_c REAL,
    operating_temp_max_c REAL,
    chemical_exposure TEXT,
    mechanical_load TEXT,
    regulatory_requirements TEXT DEFAULT '[]',
    quantity_estimate TEXT,
    urgency TEXT DEFAULT 'within_1_month',
    estimated_budget REAL,
    currency TEXT DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'open',
    lost_reason TEXT,
    converted_to_quotation_id TEXT,
    technical_notes TEXT,
    custom_fields TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS quotations (
    id TEXT PRIMARY KEY,
    quotation_number TEXT NOT NULL UNIQUE,
    company_id TEXT NOT NULL REFERENCES companies(id),
    contact_id TEXT REFERENCES contacts(id),
    inquiry_id TEXT REFERENCES inquiries(id),
    project_id TEXT,
    assigned_to TEXT,
    quotation_date TEXT NOT NULL DEFAULT (date('now')),
    valid_until TEXT NOT NULL,
    incoterm TEXT,
    currency TEXT NOT NULL DEFAULT 'USD',
    exchange_rate REAL DEFAULT 1.0,
    payment_term TEXT,
    delivery_term TEXT,
    subtotal REAL NOT NULL DEFAULT 0,
    discount_percent REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    tax_type TEXT,
    domestic_vat_rate REAL DEFAULT 0,
    export_tax_rebate_rate REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    shipping_handling REAL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    margin_estimate_percent REAL,
    cost_total_estimate REAL,
    status TEXT NOT NULL DEFAULT 'draft',
    version INTEGER NOT NULL DEFAULT 1,
    parent_version_id TEXT,
    approval_requested_at TEXT,
    approval_requested_by TEXT,
    approved_at TEXT,
    approved_by TEXT,
    sent_at TEXT,
    customer_acknowledged_at TEXT,
    accepted_at TEXT,
    rejection_reason TEXT,
    internal_notes TEXT,
    terms_and_conditions TEXT,
    custom_fields TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS quotation_line_items (
    id TEXT PRIMARY KEY,
    quotation_id TEXT NOT NULL REFERENCES quotations(id),
    line_number INTEGER NOT NULL,
    product_id TEXT,
    product_grade_snapshot TEXT NOT NULL,
    form TEXT,
    description TEXT,
    unit_of_measure TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    discount_percent REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    line_total REAL NOT NULL,
    delivery_lead_time_days INTEGER,
    cost_estimate REAL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sample_requests (
    id TEXT PRIMARY KEY,
    sample_request_number TEXT NOT NULL UNIQUE,
    company_id TEXT NOT NULL REFERENCES companies(id),
    contact_id TEXT REFERENCES contacts(id),
    quotation_id TEXT,
    inquiry_id TEXT,
    project_id TEXT,
    assigned_to TEXT,
    purpose TEXT NOT NULL,
    sample_charge REAL DEFAULT 0,
    charge_terms TEXT,
    shipping_address TEXT,
    shipping_method TEXT,
    carrier TEXT,
    tracking_number TEXT,
    dispatched_at TEXT,
    delivered_at TEXT,
    expected_test_completion TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    free_sample_budget_used REAL,
    internal_notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sample_line_items (
    id TEXT PRIMARY KEY,
    sample_request_id TEXT NOT NULL REFERENCES sample_requests(id),
    line_number INTEGER NOT NULL,
    product_id TEXT,
    product_grade TEXT NOT NULL,
    form TEXT,
    quantity REAL NOT NULL,
    unit_of_measure TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS shipments (
    id TEXT PRIMARY KEY,
    shipment_number TEXT NOT NULL UNIQUE,
    order_id TEXT NOT NULL REFERENCES orders(id),
    shipping_type TEXT NOT NULL DEFAULT 'sea_freight',
    carrier TEXT,
    tracking_number TEXT,
    shipping_address TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending_pickup',
    container_no TEXT,
    vessel TEXT,
    voyage TEXT,
    awb TEXT,
    airline TEXT,
    express_provider TEXT,
    etd TEXT,
    eta TEXT,
    shipped_at TEXT,
    estimated_delivery_date TEXT,
    actual_delivery_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL UNIQUE,
    order_id TEXT NOT NULL REFERENCES orders(id),
    company_id TEXT REFERENCES companies(id),
    invoice_date TEXT NOT NULL DEFAULT (date('now')),
    due_date TEXT NOT NULL,
    total REAL NOT NULL DEFAULT 0,
    amount_paid REAL DEFAULT 0,
    amount_due REAL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'issued',
    invoice_type TEXT,
    notes TEXT,
    fully_paid_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS payment_records (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id),
    payment_date TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT,
    reference_number TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    customer_po_number TEXT,
    company_id TEXT NOT NULL REFERENCES companies(id),
    contact_id TEXT REFERENCES contacts(id),
    quotation_id TEXT,
    inquiry_id TEXT,
    project_id TEXT,
    previous_order_id TEXT,
    assigned_to TEXT,
    order_date TEXT NOT NULL DEFAULT (date('now')),
    requested_delivery_date TEXT,
    confirmed_delivery_date TEXT,
    incoterm TEXT,
    currency TEXT NOT NULL DEFAULT 'USD',
    exchange_rate REAL DEFAULT 1.0,
    payment_term TEXT,
    payment_status TEXT NOT NULL DEFAULT 'unpaid',
    subtotal REAL NOT NULL DEFAULT 0,
    discount_percent REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    tax_type TEXT,
    domestic_vat_rate REAL DEFAULT 0,
    export_tax_rebate_rate REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    shipping_handling REAL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    shipping_address TEXT,
    shipping_instructions TEXT,
    internal_notes TEXT,
    custom_fields TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS order_line_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    line_number INTEGER NOT NULL,
    product_id TEXT,
    product_grade_snapshot TEXT NOT NULL,
    form TEXT,
    description TEXT,
    unit_of_measure TEXT NOT NULL,
    quantity_ordered REAL NOT NULL,
    quantity_shipped REAL NOT NULL DEFAULT 0,
    quantity_delivered REAL NOT NULL DEFAULT 0,
    unit_price REAL NOT NULL,
    discount_percent REAL DEFAULT 0,
    line_total REAL NOT NULL,
    batch_lot_number TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Inventory Module ──

  -- ── Materials ──

  CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    density_kg_m3 INTEGER NOT NULL,
    category TEXT,
    system_material INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  );

  -- ── Products ──

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT,
    product_type TEXT NOT NULL DEFAULT 'part'
      CHECK(product_type IN ('sheet','rod','tube','part')),
    stock_tracking_mode TEXT NOT NULL DEFAULT 'piece'
      CHECK(stock_tracking_mode IN ('piece','length','weight')),
    length_mm REAL,
    width_mm REAL,
    thickness_mm REAL,
    diameter_mm REAL,
    outer_diameter_mm REAL,
    inner_diameter_mm REAL,
    unit_weight_kg REAL NOT NULL DEFAULT 0,
    material_id TEXT REFERENCES materials(id),
    unit TEXT NOT NULL DEFAULT 'pc',
    safety_stock_qty REAL NOT NULL DEFAULT 0,
    safety_stock_weight_kg REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS warehouses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS inventory_transactions (
    id TEXT PRIMARY KEY,
    transaction_number TEXT NOT NULL UNIQUE,
    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('stock_in','stock_out','adjustment')),
    product_id TEXT NOT NULL REFERENCES products(id),
    warehouse_id TEXT REFERENCES warehouses(id),
    quantity REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'pc',
    total_weight_kg REAL,
    reference_type TEXT,
    reference_id TEXT,
    notes TEXT,
    operator TEXT,
    transaction_date TEXT NOT NULL DEFAULT (date('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ── Seed: Materials ──
const materialSeed: [string, number, string, number][] = [
  ['PEEK', 1320, 'engineering_plastic', 1],
  ['PEEK GF30', 1430, 'engineering_plastic', 1],
  ['PEEK CF30', 1400, 'engineering_plastic', 1],
  ['PEI', 1270, 'engineering_plastic', 1],
  ['PPS', 1350, 'engineering_plastic', 1],
  ['PPSU', 1290, 'engineering_plastic', 1],
  ['POM', 1410, 'engineering_plastic', 1],
  ['PA6', 1130, 'engineering_plastic', 1],
  ['MC Nylon', 1160, 'engineering_plastic', 1],
  ['UHMWPE', 930, 'engineering_plastic', 1],
  ['HDPE', 950, 'engineering_plastic', 1],
  ['PVDF', 1780, 'engineering_plastic', 1],
  ['PTFE', 2200, 'engineering_plastic', 1],
  ['PET', 1370, 'engineering_plastic', 1],
  ['PAI', 1420, 'engineering_plastic', 1],
];
const matIns = db.prepare(`INSERT OR IGNORE INTO materials (id, name, density_kg_m3, category, system_material, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
const matNow = new Date().toISOString();
for (const m of materialSeed) {
  matIns.run(uuidv4(), m[0], m[1], m[2], m[3], matNow, matNow);
}

// ── Schema Migrations (additive only, safe to re-run) ──

function migrate(sql: string) {
  try { db.exec(sql); } catch { /* column/index already exists */ }
}

// 1. Companies.customer_code
migrate("ALTER TABLE companies ADD COLUMN customer_code TEXT");
migrate("CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_customer_code ON companies(customer_code) WHERE customer_code IS NOT NULL");

// 2. Payment records.payment_number
migrate("ALTER TABLE payment_records ADD COLUMN payment_number TEXT");
migrate("CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_records_number ON payment_records(payment_number)");

// 3. Products — new fields (for databases created before schema update)
migrate("ALTER TABLE products ADD COLUMN product_type TEXT DEFAULT 'part'");
migrate("ALTER TABLE products ADD COLUMN stock_tracking_mode TEXT DEFAULT 'piece'");
migrate("ALTER TABLE products ADD COLUMN length_mm REAL");
migrate("ALTER TABLE products ADD COLUMN width_mm REAL");
migrate("ALTER TABLE products ADD COLUMN thickness_mm REAL");
migrate("ALTER TABLE products ADD COLUMN diameter_mm REAL");
migrate("ALTER TABLE products ADD COLUMN outer_diameter_mm REAL");
migrate("ALTER TABLE products ADD COLUMN inner_diameter_mm REAL");
migrate("ALTER TABLE products ADD COLUMN unit_weight_kg REAL DEFAULT 0");
migrate("ALTER TABLE products ADD COLUMN material_id TEXT REFERENCES materials(id)");
migrate("ALTER TABLE products ADD COLUMN safety_stock_qty REAL DEFAULT 0");
migrate("ALTER TABLE products ADD COLUMN safety_stock_weight_kg REAL DEFAULT 0");

// 4. Inventory transactions — weight field
migrate("ALTER TABLE inventory_transactions ADD COLUMN total_weight_kg REAL");

// 5. System config (COMPANY_PREFIX etc.)
db.exec(`
  CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
db.prepare(`INSERT OR IGNORE INTO system_config (key, value, description, updated_at)
  VALUES ('company_prefix', 'JEK', 'Company prefix for order numbers (JEK-SMP-2606-01)', datetime('now'))
`).run();

// ── 6. Users (multi-user support) ──
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    pin_hash TEXT,
    pin_salt TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at TEXT
  )
`);
migrate("ALTER TABLE users ADD COLUMN pin_hash TEXT");
migrate("ALTER TABLE users ADD COLUMN pin_salt TEXT");
migrate("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'");
migrate("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name_nocase ON users(name COLLATE NOCASE)");

// ── 7. Audit log (full change history) ──
db.exec(`
  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    user_id TEXT,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    changes TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
db.exec("CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id)");

ensureMaterialsToolingSchema(db);

// ── 8. Team ownership and automatic actor metadata ──
// Additive migrations preserve all existing local data. Historical rows remain unassigned.
for (const table of ['companies', 'inquiries', 'quotations', 'sample_requests', 'orders']) {
  migrate(`ALTER TABLE ${table} ADD COLUMN owner_user_id TEXT`);
}

for (const table of [
  'companies', 'contacts', 'activities', 'tasks', 'inquiries', 'quotations',
  'sample_requests', 'orders', 'shipments', 'invoices', 'payment_records',
  'products', 'inventory_transactions',
]) {
  migrate(`ALTER TABLE ${table} ADD COLUMN created_by TEXT`);
}

for (const table of [
  'companies', 'contacts', 'activities', 'tasks', 'inquiries', 'quotations',
  'sample_requests', 'orders', 'shipments', 'invoices', 'products',
]) {
  migrate(`ALTER TABLE ${table} ADD COLUMN updated_by TEXT`);
}

migrate("ALTER TABLE tasks ADD COLUMN assigned_to_user_id TEXT");
migrate("ALTER TABLE contacts ADD COLUMN wechat_id TEXT");
migrate("CREATE INDEX IF NOT EXISTS idx_companies_owner_user ON companies(owner_user_id)");
migrate("CREATE INDEX IF NOT EXISTS idx_inquiries_owner_user ON inquiries(owner_user_id)");
migrate("CREATE INDEX IF NOT EXISTS idx_quotations_owner_user ON quotations(owner_user_id)");
migrate("CREATE INDEX IF NOT EXISTS idx_orders_owner_user ON orders(owner_user_id)");
migrate("CREATE INDEX IF NOT EXISTS idx_tasks_assigned_user ON tasks(assigned_to_user_id)");

// ── 9. Customer development and follow-up ──
const companyColumnsBeforeDevelopmentMigration = db.prepare("PRAGMA table_info(companies)").all() as { name: string }[];
const needsDevelopmentStageInitialization = !companyColumnsBeforeDevelopmentMigration.some(
  (column) => column.name === 'development_stage',
);

migrate(`
  ALTER TABLE companies ADD COLUMN development_stage TEXT NOT NULL DEFAULT 'uncontacted'
    CHECK (development_stage IN ('uncontacted', 'contacted', 'replied', 'qualified', 'converted', 'nurturing', 'stopped'))
`);
migrate(`
  ALTER TABLE activities ADD COLUMN outcome TEXT
    CHECK (outcome IS NULL OR outcome IN ('no_response', 'replied', 'interested', 'no_current_need', 'not_interested'))
`);
migrate("ALTER TABLE tasks ADD COLUMN contact_id TEXT REFERENCES contacts(id)");

if (needsDevelopmentStageInitialization) {
  db.exec(`
    UPDATE companies
    SET development_stage = CASE
      WHEN EXISTS (
        SELECT 1 FROM inquiries
        WHERE inquiries.company_id = companies.id
          AND inquiries.deleted_at IS NULL
      ) OR EXISTS (
        SELECT 1 FROM orders
        WHERE orders.company_id = companies.id
          AND orders.deleted_at IS NULL
      ) THEN 'converted'
      WHEN EXISTS (
        SELECT 1 FROM activities
        WHERE activities.entity_type = 'company'
          AND activities.entity_id = companies.id
          AND activities.activity_type IN ('email', 'call', 'meeting')
          AND activities.direction = 'inbound'
          AND activities.deleted_at IS NULL
      ) THEN 'replied'
      WHEN EXISTS (
        SELECT 1 FROM activities
        WHERE activities.entity_type = 'company'
          AND activities.entity_id = companies.id
          AND activities.activity_type IN ('email', 'call', 'meeting')
          AND activities.direction = 'outbound'
          AND activities.deleted_at IS NULL
      ) THEN 'contacted'
      ELSE 'uncontacted'
    END
    WHERE companies.deleted_at IS NULL
  `);
}

migrate(`
  CREATE INDEX IF NOT EXISTS idx_companies_development_stage
  ON companies(development_stage)
  WHERE deleted_at IS NULL
`);
migrate(`
  CREATE INDEX IF NOT EXISTS idx_tasks_follow_up_due
  ON tasks(due_date, assigned_to_user_id, entity_id)
  WHERE task_type = 'follow_up'
    AND status IN ('pending', 'in_progress')
    AND deleted_at IS NULL
`);
migrate(`
  CREATE INDEX IF NOT EXISTS idx_tasks_contact_id
  ON tasks(contact_id)
  WHERE contact_id IS NOT NULL
`);
migrate(`
  CREATE INDEX IF NOT EXISTS idx_activities_company_outcome
  ON activities(entity_id, created_at)
  WHERE entity_type = 'company'
    AND outcome IS NOT NULL
    AND deleted_at IS NULL
`);

// ── 10. Merge inquiry fields into quotations ──
// Fix QT- prefixed numbers from migration v1 → use QUO- prefix
try {
  const qtFix = db.prepare(`
    UPDATE quotations SET quotation_number = 'QUO-' || substr(quotation_number, 4)
    WHERE quotation_number LIKE 'QT-%'
  `).run();
  if (qtFix.changes > 0) console.log(`[migration] Fixed ${qtFix.changes} QT- → QUO- quotation numbers`);
} catch (e) { /* ignore */ }

// Add columns first (idempotent via migrate helper)
migrate("ALTER TABLE quotations ADD COLUMN application_description TEXT");
migrate("ALTER TABLE quotations ADD COLUMN target_material_requested TEXT");
migrate("ALTER TABLE quotations ADD COLUMN quantity_estimate TEXT");
migrate("ALTER TABLE quotations ADD COLUMN urgency TEXT DEFAULT 'within_1_month'");
migrate("ALTER TABLE quotations ADD COLUMN source TEXT DEFAULT 'email'");

// Copy inquiry data (MUST run before disassociation and soft-delete)
try {
  const updated = db.prepare(`
    UPDATE quotations SET
      application_description = COALESCE(NULLIF(quotations.application_description, ''), (SELECT i.application_description FROM inquiries i WHERE i.id = quotations.inquiry_id AND i.deleted_at IS NULL)),
      target_material_requested = COALESCE(NULLIF(quotations.target_material_requested, ''), (SELECT i.target_material_requested FROM inquiries i WHERE i.id = quotations.inquiry_id AND i.deleted_at IS NULL)),
      quantity_estimate = COALESCE(NULLIF(quotations.quantity_estimate, ''), (SELECT i.quantity_estimate FROM inquiries i WHERE i.id = quotations.inquiry_id AND i.deleted_at IS NULL)),
      urgency = COALESCE(NULLIF(quotations.urgency, ''), (SELECT i.urgency FROM inquiries i WHERE i.id = quotations.inquiry_id AND i.deleted_at IS NULL), 'within_1_month'),
      source = COALESCE(NULLIF(quotations.source, ''), (SELECT i.source FROM inquiries i WHERE i.id = quotations.inquiry_id AND i.deleted_at IS NULL), 'email')
    WHERE inquiry_id IS NOT NULL
  `).run();
  console.log(`[migration] Copied inquiry fields to ${updated.changes} linked quotations`);
} catch (e) {
  console.log('[migration] Inquiry field copy skipped');
}

// Disassociate inquiry_id (only AFTER field copy above)
try {
  const disassociated = db.prepare(`UPDATE quotations SET inquiry_id = NULL WHERE inquiry_id IS NOT NULL`).run();
  if (disassociated.changes > 0) console.log(`[migration] Disassociated ${disassociated.changes} quotations from inquiries`);
} catch (e) { /* ignore */ }

// Soft-delete all inquiries (only AFTER field copy above)
try {
  const deleted = db.prepare(`UPDATE inquiries SET deleted_at = ? WHERE deleted_at IS NULL`).run(new Date().toISOString());
  if (deleted.changes > 0) console.log(`[migration] Soft-deleted ${deleted.changes} inquiries`);
} catch (e) { /* ignore */ }

export default db;
