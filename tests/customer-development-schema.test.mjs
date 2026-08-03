import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const tsx = path.join(root, 'node_modules', '.bin', 'tsx');
const packageUrl = pathToFileURL(path.join(root, 'package.json')).href;
const databaseModuleUrl = pathToFileURL(path.join(root, 'server', 'db.ts')).href;

test('customer development schema upgrades legacy data once and preserves manual stages', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'customer-development-schema-'));
  const databasePath = path.join(directory, 'legacy.db');
  const runnerPath = path.join(directory, 'run.mts');

  writeFileSync(runnerPath, `
    import assert from 'node:assert/strict';
    import { existsSync } from 'node:fs';
    import { createRequire } from 'node:module';

    const require = createRequire(${JSON.stringify(packageUrl)});
    const Database = require('better-sqlite3');
    const databasePath = process.argv[2];
    const mode = process.argv[3];

    if (!existsSync(databasePath)) {
      const legacy = new Database(databasePath);
      legacy.exec(\`
        CREATE TABLE companies (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          deleted_at TEXT
        );
        CREATE TABLE activities (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          activity_type TEXT NOT NULL,
          direction TEXT,
          created_at TEXT NOT NULL,
          deleted_at TEXT
        );
        CREATE TABLE tasks (
          id TEXT PRIMARY KEY,
          subject TEXT NOT NULL,
          task_type TEXT NOT NULL,
          status TEXT NOT NULL,
          due_date TEXT,
          entity_type TEXT,
          entity_id TEXT,
          created_at TEXT NOT NULL,
          deleted_at TEXT
        );
        CREATE TABLE inquiries (
          id TEXT PRIMARY KEY,
          company_id TEXT NOT NULL,
          deleted_at TEXT
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          company_id TEXT NOT NULL,
          deleted_at TEXT
        );

        INSERT INTO companies(id, name) VALUES
          ('converted-inquiry', 'Converted by inquiry'),
          ('converted-order', 'Converted by order'),
          ('replied', 'Customer replied'),
          ('contacted', 'Outbound contact'),
          ('uncontacted', 'No contact'),
          ('deleted-activity-only', 'Deleted activity only');
        INSERT INTO inquiries(id, company_id) VALUES ('inquiry-1', 'converted-inquiry');
        INSERT INTO orders(id, company_id) VALUES ('order-1', 'converted-order');
        INSERT INTO activities(
          id, entity_type, entity_id, activity_type, direction, created_at, deleted_at
        ) VALUES
          ('activity-inbound', 'company', 'replied', 'email', 'inbound', '2026-07-01', NULL),
          ('activity-outbound', 'company', 'contacted', 'call', 'outbound', '2026-07-02', NULL),
          ('activity-deleted', 'company', 'deleted-activity-only', 'email', 'outbound', '2026-07-03', '2026-07-04');
      \`);
      legacy.close();
    }

    process.env.CRM_DB_PATH = databasePath;
    const { default: database } = await import(${JSON.stringify(databaseModuleUrl)});

    const columns = (table: string) => new Set(
      database.prepare(\`PRAGMA table_info(\${table})\`).all().map((column: any) => column.name),
    );
    assert.ok(columns('companies').has('development_stage'));
    assert.ok(columns('tasks').has('contact_id'));
    assert.ok(columns('activities').has('outcome'));

    const stages = Object.fromEntries(
      database.prepare('SELECT id, development_stage FROM companies').all()
        .map((company: any) => [company.id, company.development_stage]),
    );
    assert.equal(stages['converted-inquiry'], 'converted');
    assert.equal(stages['converted-order'], 'converted');
    assert.equal(stages.replied, 'replied');
    assert.equal(stages.contacted, 'contacted');
    assert.equal(stages.uncontacted, mode === 'preserve' ? 'nurturing' : 'uncontacted');
    assert.equal(stages['deleted-activity-only'], 'uncontacted');

    const indexes = new Set(
      database.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all()
        .map((index: any) => index.name),
    );
    assert.ok(indexes.has('idx_companies_development_stage'));
    assert.ok(indexes.has('idx_tasks_follow_up_due'));
    assert.ok(indexes.has('idx_tasks_contact_id'));
    assert.ok(indexes.has('idx_activities_company_outcome'));

    if (mode === 'initialize') {
      database.prepare(
        "UPDATE companies SET development_stage = 'nurturing' WHERE id = 'uncontacted'",
      ).run();
    }
    database.close();
  `);

  try {
    execFileSync(tsx, [runnerPath, databasePath, 'initialize'], {
      cwd: root,
      env: { ...process.env, CRM_DB_PATH: databasePath },
      stdio: 'pipe',
    });
    execFileSync(tsx, [runnerPath, databasePath, 'preserve'], {
      cwd: root,
      env: { ...process.env, CRM_DB_PATH: databasePath },
      stdio: 'pipe',
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
