import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const tsxPath = path.join(projectRoot, 'node_modules', '.bin', 'tsx');
const packageUrl = pathToFileURL(path.join(projectRoot, 'package.json')).href;
const routerUrl = pathToFileURL(path.join(projectRoot, 'server/routes/materials-tooling.ts')).href;
const schemaUrl = pathToFileURL(path.join(projectRoot, 'server/materials-tooling/schema.ts')).href;

test('materials and suppliers expose permission-safe authenticated HTTP CRUD', () => {
  const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'mt-master-'));
  const runnerPath = path.join(temporaryDirectory, 'master-behavior.mts');

  writeFileSync(runnerPath, `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(${JSON.stringify(packageUrl)});
    const Database = require('better-sqlite3');
    const express = require('express');
    const { ensureMaterialsToolingSchema } = await import(${JSON.stringify(schemaUrl)});
    const { createMaterialsToolingRouter, materialsJsonParseErrorHandler } = await import(${JSON.stringify(routerUrl)});

    const database = new Database(':memory:');
    database.pragma('foreign_keys = ON');
    database.exec(\`
      CREATE TABLE users (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL,
        token TEXT, pin_hash TEXT, is_active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE audit_log (
        id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
        user_id TEXT, user_name TEXT NOT NULL, action TEXT NOT NULL,
        changes TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
      );
    \`);
    ensureMaterialsToolingSchema(database);
    const insertUser = database.prepare(
      'INSERT INTO users (id, name, role, is_active) VALUES (?, ?, ?, 1)',
    );
    insertUser.run('admin-1', 'Admin', 'admin');
    insertUser.run('member-1', 'Member', 'member');
    insertUser.run('clerk-1', 'Moana', 'member');
    database.prepare(\`
      INSERT INTO mt_permissions
        (user_id, manage_materials, approve, view_prices, manage_periods, updated_by, updated_at)
      VALUES ('clerk-1', 1, 0, 1, 0, 'admin-1', '2026-07-14T00:00:00.000Z')
    \`).run();

    const users = new Map([
      ['admin', { id: 'admin-1', name: 'Admin', role: 'admin' }],
      ['member', { id: 'member-1', name: 'Member', role: 'member' }],
      ['clerk', { id: 'clerk-1', name: 'Moana', role: 'member' }],
    ]);
    const app = express();
    app.use(express.json());
    assert.equal(typeof materialsJsonParseErrorHandler, 'function');
    app.use(materialsJsonParseErrorHandler);
    app.use((req: any, _res: any, next: () => void) => {
      const user = users.get(String(req.headers['x-test-user'] || ''));
      if (user) req.user = user;
      next();
    });
    app.use('/materials-tooling', createMaterialsToolingRouter(database));

    const server = await new Promise<any>((resolve, reject) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
      listener.on('error', reject);
    });
    const address = server.address();
    assert(address && typeof address === 'object');
    const baseUrl = \`http://127.0.0.1:\${address.port}/materials-tooling\`;

    async function request(pathname: string, options: any = {}) {
      const headers: Record<string, string> = {};
      if (options.user) headers['x-test-user'] = options.user;
      if (options.body !== undefined || options.raw !== undefined) headers['content-type'] = 'application/json';
      const response = await fetch(baseUrl + pathname, {
        method: options.method || 'GET', headers,
        body: options.raw ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
      });
      return { response, body: response.status === 204 ? null : await response.json() };
    }

    try {
      assert.equal((await request('/me')).response.status, 401);
      const me = await request('/me', { user: 'member' });
      assert.equal(me.response.status, 200);
      assert.deepEqual(me.body.permissions, {
        enter: true, manageMaterials: false, approve: false, viewPrices: false, managePeriods: false,
      });
      assert.equal((await request('/items', { user: 'member' })).response.status, 200);
      assert.equal((await request('/suppliers', { user: 'member' })).response.status, 200);

      const itemCountBeforeForbidden = database.prepare('SELECT COUNT(*) count FROM mt_items').get().count;
      assert.equal((await request('/items', { user: 'member', method: 'POST', body: {
        code: 'x', name: 'Blocked', category: '耗材', unit: '个', safety_quantity: 0,
      }})).response.status, 403);
      assert.equal(database.prepare('SELECT COUNT(*) count FROM mt_items').get().count, itemCountBeforeForbidden);

      const supplier = await request('/suppliers', { user: 'clerk', method: 'POST', body: {
        code: ' sup-1 ', name: 'Supplier One', contact_name: 'Amy', phone: '1', notes: 'ok',
      }});
      assert.equal(supplier.response.status, 201);
      assert.equal(supplier.body.supplier.code, 'SUP-1');
      const redactedSuppliers = await request('/suppliers', { user: 'member' });
      assert.equal(redactedSuppliers.response.status, 200);
      assert.deepEqual(redactedSuppliers.body.suppliers, []);
      for (const secret of ['Supplier One', 'Amy', '"phone":"1"', '"notes":"ok"']) {
        assert(!JSON.stringify(redactedSuppliers.body).includes(secret));
      }
      const authorizedSuppliers = await request('/suppliers', { user: 'clerk' });
      assert.equal(authorizedSuppliers.body.suppliers[0].name, 'Supplier One');
      assert.equal(authorizedSuppliers.body.suppliers[0].contact_name, 'Amy');
      const item = await request('/items', { user: 'clerk', method: 'POST', body: {
        code: ' mat-1 ', name: 'Brush', category: '耗材', specification: '25mm', unit: '把',
        warehouse: 'Main', bin_location: 'A1', safety_quantity: 2, notes: 'daily',
      }});
      assert.equal(item.response.status, 201);
      assert.equal(item.body.item.code, 'MAT-1');

      const itemWithDefaultSafety = await request('/items', {
        user: 'clerk', method: 'POST', body: {
          name: 'Default safety', category: '耗材', unit: '个',
        },
      });
      assert.equal(itemWithDefaultSafety.response.status, 201);
      assert.equal(itemWithDefaultSafety.body.item.safety_quantity, 5);
      assert.equal(itemWithDefaultSafety.body.item.code, 'MAT-0002');
      assert.equal((await request('/items/' + itemWithDefaultSafety.body.item.id, {
        user: 'member', method: 'DELETE',
      })).response.status, 403);

      for (const invalid of [
        { code: 'MAT-2', name: 'Bad', category: ['耗材'], unit: '个', safety_quantity: 0 },
        { code: 'MAT-2', name: 'Bad', category: '耗材', unit: '个', safety_quantity: -1 },
        { code: 'MAT-2', name: 'Bad', category: '耗材', unit: '个', safety_quantity: 0, extra: true },
        { code: 'MAT-2', name: 'Bad', category: '耗材', unit: '个', safety_quantity: 0, is_active: 1 },
      ]) assert.equal((await request('/items', { user: 'clerk', method: 'POST', body: invalid })).response.status, 400);
      assert.equal((await request('/items', { user: 'clerk', method: 'POST', body: {
        code: 'mat-1', name: 'Duplicate', category: '耗材', unit: '个', safety_quantity: 0,
      }})).response.status, 409);

      database.prepare(\`
        INSERT INTO mt_movements (
          id, item_id, movement_type, quantity_delta, reference_unit_price, movement_date,
          created_by, created_at, supplier_id, reference_quantity, source_workbook, cutover_period
        ) VALUES ('ref-1', ?, 'reference_purchase', 0, 12.5, '2026-05-02',
          'clerk-1', '2026-05-02T00:00:00Z', ?, 20, 'legacy.xlsx', '2026-05')
      \`).run(item.body.item.id, supplier.body.supplier.id);
      database.prepare(\`
        INSERT INTO mt_movements (
          id, item_id, movement_type, quantity_delta, movement_date, created_by, created_at,
          source_workbook, cutover_period
        ) VALUES ('opening-1', ?, 'opening_balance', 10, '2026-05-01', 'clerk-1',
          '2026-05-01T00:00:00Z', 'legacy.xlsx', '2026-05')
      \`).run(item.body.item.id);

      assert.equal((await request('/items/' + itemWithDefaultSafety.body.item.id, {
        user: 'clerk', method: 'DELETE',
      })).response.status, 204);
      assert.equal((await request('/items/' + item.body.item.id, {
        user: 'clerk', method: 'DELETE',
      })).response.status, 409);

      const memberItems = await request('/items', { user: 'member' });
      assert.equal(memberItems.response.status, 200);
      const memberSerialized = JSON.stringify(memberItems.body);
      assert(!memberSerialized.includes('purchaseSummary'));
      assert(!memberSerialized.includes('12.5'));
      assert(!memberSerialized.includes('Supplier One'));
      const memberItem = memberItems.body.items.find((entry: any) => entry.id === item.body.item.id);
      assert.equal(memberItem.current_quantity, 10);
      const clerkItems = await request('/items', { user: 'clerk' });
      assert.equal(clerkItems.response.status, 200);
      const clerkItem = clerkItems.body.items.find((entry: any) => entry.id === item.body.item.id);
      assert.deepEqual(clerkItem.purchaseSummary, {
        unitPrice: 12.5, purchaseDate: '2026-05-02', supplierId: supplier.body.supplier.id,
        supplierName: 'Supplier One', priceType: 'reference',
      });

      const unitConflict = await request('/items/' + item.body.item.id, {
        user: 'clerk', method: 'PUT', body: { unit: '件' },
      });
      assert.equal(unitConflict.response.status, 409);
      assert.equal((await request('/items/' + item.body.item.id, {
        user: 'clerk', method: 'PUT', body: { code: 'NEW' },
      })).response.status, 400);
      const itemInactive = await request('/items/' + item.body.item.id, {
        user: 'clerk', method: 'PUT', body: { is_active: false },
      });
      assert.equal(itemInactive.response.status, 200);
      assert.equal(itemInactive.body.item.is_active, false);
      assert.equal((await request('/items/' + item.body.item.id, { user: 'clerk', method: 'DELETE' })).response.status, 409);

      assert.equal((await request('/suppliers', { user: 'clerk', method: 'POST', body: {
        code: 'SUP-1', name: 'Again',
      }})).response.status, 409);
      assert.equal((await request('/suppliers/' + supplier.body.supplier.id, {
        user: 'clerk', method: 'PUT', body: { is_active: false },
      })).body.supplier.is_active, false);
      assert.equal((await request('/suppliers/' + supplier.body.supplier.id, { user: 'clerk', method: 'DELETE' })).response.status, 404);

      const audits = database.prepare(\`
        SELECT entity_type, entity_id, user_id, user_name, action, changes FROM audit_log ORDER BY created_at, id
      \`).all();
      assert(audits.some((row: any) => row.entity_type === 'mt_item' && row.entity_id === item.body.item.id && row.user_id === 'clerk-1'));
      assert(audits.some((row: any) => row.entity_type === 'mt_item' && row.action === 'delete' && row.user_name === 'Moana'));
      assert(audits.some((row: any) => row.entity_type === 'mt_supplier' && row.user_name === 'Moana'));
      assert(audits.some((row: any) => JSON.parse(row.changes).is_active?.new === false));

      const itemCountBeforeMalformed = database.prepare('SELECT COUNT(*) count FROM mt_items').get().count;
      const malformed = await request('/items', { user: 'clerk', method: 'POST', raw: '{"code":' });
      assert.equal(malformed.response.status, 400);
      assert.deepEqual(malformed.body, { error: 'MATERIALS_VALIDATION_ERROR', message: 'Malformed JSON body' });
      const malformedSerialized = JSON.stringify(malformed.body).toLowerCase();
      for (const secret of ['stack', 'sql', '/users/', 'syntaxerror']) assert(!malformedSerialized.includes(secret));
      assert.equal(database.prepare('SELECT COUNT(*) count FROM mt_items').get().count, itemCountBeforeMalformed);

      assert.equal((await request('/items/missing', { user: 'clerk', method: 'PUT', body: { name: 'x' } })).response.status, 404);
      assert.equal((await request('/suppliers/missing', { user: 'clerk', method: 'PUT', body: { name: 'x' } })).response.status, 404);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error: Error) => error ? reject(error) : resolve()));
      database.close();
    }
  `);

  try {
    execFileSync(tsxPath, [runnerPath], { cwd: projectRoot, stdio: 'pipe' });
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('server installs malformed JSON handling before auth and mounts materials routes after auth', () => {
  const source = readFileSync(path.join(projectRoot, 'server/index.ts'), 'utf8');
  const jsonParser = source.indexOf('app.use(express.json())');
  const jsonHandler = source.indexOf('app.use(materialsJsonParseErrorHandler)');
  const auth = source.indexOf("app.use('/api', authMiddleware)");
  const route = source.indexOf("app.use('/api/materials-tooling', createMaterialsToolingRouter(db))");
  assert(jsonParser >= 0 && jsonHandler > jsonParser);
  assert(auth > jsonHandler && route > auth);
});
