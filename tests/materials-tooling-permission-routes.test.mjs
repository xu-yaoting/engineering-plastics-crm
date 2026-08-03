import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const tsxPath = path.join(projectRoot, 'node_modules', '.bin', 'tsx');
const packageUrl = pathToFileURL(path.join(projectRoot, 'package.json')).href;
const routerUrl = pathToFileURL(
  path.join(projectRoot, 'server/routes/materials-tooling.ts'),
).href;
const permissionsUrl = pathToFileURL(
  path.join(projectRoot, 'server/materials-tooling/permissions.ts'),
).href;
const schemaUrl = pathToFileURL(
  path.join(projectRoot, 'server/materials-tooling/schema.ts'),
).href;

test('materials tooling administrator permission routes enforce safe HTTP contracts', () => {
  const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'mt-permission-routes-'));
  const runnerPath = path.join(temporaryDirectory, 'permission-routes-behavior.mts');

  writeFileSync(runnerPath, `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';

    const require = createRequire(${JSON.stringify(packageUrl)});
    const Database = require('better-sqlite3');
    const express = require('express');
    const { ensureMaterialsToolingSchema } = await import(${JSON.stringify(schemaUrl)});
    const { createMaterialsToolingRouter } = await import(${JSON.stringify(routerUrl)});
    const permissionModule = await import(${JSON.stringify(permissionsUrl)});

    const database = new Database(':memory:');
    database.pragma('foreign_keys = ON');
    database.exec(\`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        token TEXT,
        pin_hash TEXT,
        is_active INTEGER NOT NULL DEFAULT 1
      )
    \`);
    ensureMaterialsToolingSchema(database);

    const insertUser = database.prepare(
      'INSERT INTO users (id, name, role, token, pin_hash, is_active) VALUES (?, ?, ?, ?, ?, ?)',
    );
    insertUser.run('admin-1', 'Administrator', 'admin', 'secret-admin-token', 'secret-admin-pin', 1);
    insertUser.run('member-1', 'Member', 'member', 'secret-member-token', 'secret-member-pin', 1);
    insertUser.run('approver-1', 'Approver', 'member', 'secret-approver-token', 'secret-approver-pin', 1);
    insertUser.run('inactive-1', 'Inactive', 'member', 'secret-inactive-token', 'secret-inactive-pin', 0);

    const testUsers = new Map([
      ['admin', { id: 'admin-1', name: 'Administrator', role: 'admin' }],
      ['member', { id: 'member-1', name: 'Member', role: 'member' }],
    ]);
    const app = express();
    app.use(express.json());
    app.use((req: any, _res: any, next: () => void) => {
      const user = testUsers.get(String(req.headers['x-test-user'] || ''));
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

    async function request(
      pathname: string,
      options: { user?: string; method?: string; body?: unknown } = {},
    ) {
      const headers: Record<string, string> = {};
      if (options.user) headers['x-test-user'] = options.user;
      if (options.body !== undefined) headers['content-type'] = 'application/json';
      const response = await fetch(baseUrl + pathname, {
        method: options.method || 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      return { response, body: await response.json() };
    }

    try {
      for (const endpoint of ['/permissions', '/approval-config']) {
        const unauthenticated = await request(endpoint);
        assert.equal(unauthenticated.response.status, 401);
        assert.deepEqual(unauthenticated.body, { error: 'Unauthorized' });

        const forbiddenRead = await request(endpoint, { user: 'member' });
        assert.equal(forbiddenRead.response.status, 403);
      }
      const forbiddenPermissionWrite = await request('/permissions/member-1', {
        user: 'member',
        method: 'PUT',
        body: { manageMaterials: true, approve: false, viewPrices: false, managePeriods: false },
      });
      assert.equal(forbiddenPermissionWrite.response.status, 403);
      const forbiddenApprovalWrite = await request('/approval-config/material_issue', {
        user: 'member', method: 'PUT', body: { approverUserId: 'approver-1' },
      });
      assert.equal(forbiddenApprovalWrite.response.status, 403);

      const initialPermissions = await request('/permissions', { user: 'admin' });
      assert.equal(initialPermissions.response.status, 200);
      assert.equal(initialPermissions.body.users.length, 3, 'inactive users are excluded');
      assert.deepEqual(initialPermissions.body.users.find((user: any) => user.id === 'admin-1'), {
        id: 'admin-1',
        name: 'Administrator',
        role: 'admin',
        permissions: {
          enter: true,
          manageMaterials: true,
          approve: true,
          viewPrices: true,
          managePeriods: true,
        },
      });
      const serializedUsers = JSON.stringify(initialPermissions.body);
      assert(!serializedUsers.includes('secret-'));
      assert(!serializedUsers.includes('token'));
      assert(!serializedUsers.includes('pin_hash'));

      const permissionBeforeInvalid = database.prepare(
        'SELECT * FROM mt_permissions WHERE user_id = ?',
      ).get('member-1');
      for (const invalidBody of [
        { manageMaterials: true, approve: false, viewPrices: false },
        { manageMaterials: true, approve: false, viewPrices: false, managePeriods: false, extra: true },
        { manageMaterials: true, approve: 'false', viewPrices: false, managePeriods: false },
      ]) {
        const invalid = await request('/permissions/member-1', {
          user: 'admin', method: 'PUT', body: invalidBody,
        });
        assert.equal(invalid.response.status, 400);
        assert.deepEqual(
          database.prepare('SELECT * FROM mt_permissions WHERE user_id = ?').get('member-1'),
          permissionBeforeInvalid,
        );
      }

      const inactiveTarget = await request('/permissions/inactive-1', {
        user: 'admin',
        method: 'PUT',
        body: { manageMaterials: true, approve: false, viewPrices: false, managePeriods: false },
      });
      assert.equal(inactiveTarget.response.status, 409);

      const validPermission = await request('/permissions/member-1', {
        user: 'admin',
        method: 'PUT',
        body: { manageMaterials: true, approve: false, viewPrices: true, managePeriods: false },
      });
      assert.equal(validPermission.response.status, 200);
      assert.deepEqual(validPermission.body.permissions, {
        enter: true,
        manageMaterials: true,
        approve: false,
        viewPrices: true,
        managePeriods: false,
      });

      const initialApprovalConfig = await request('/approval-config', { user: 'admin' });
      assert.equal(initialApprovalConfig.response.status, 200);
      assert.equal(initialApprovalConfig.body.config.length, 7);
      assert(initialApprovalConfig.body.config.every((entry: any) => entry.approver === null));

      const unauthorizedApprover = await request('/approval-config/material_issue', {
        user: 'admin', method: 'PUT', body: { approverUserId: 'approver-1' },
      });
      assert.equal(unauthorizedApprover.response.status, 409);

      const grantApprover = await request('/permissions/approver-1', {
        user: 'admin',
        method: 'PUT',
        body: { manageMaterials: false, approve: true, viewPrices: false, managePeriods: false },
      });
      assert.equal(grantApprover.response.status, 200);

      const setApprover = await request('/approval-config/material_issue', {
        user: 'admin', method: 'PUT', body: { approverUserId: 'approver-1' },
      });
      assert.equal(setApprover.response.status, 200);
      assert.deepEqual(setApprover.body, {
        documentType: 'material_issue',
        approver: { id: 'approver-1', name: 'Approver', isActive: true, isAuthorized: true },
      });
      const configuredApproval = await request('/approval-config', { user: 'admin' });
      assert.deepEqual(
        configuredApproval.body.config.find((entry: any) => entry.documentType === 'material_issue'),
        setApprover.body,
      );
      assert(!JSON.stringify(configuredApproval.body).includes('secret-'));

      for (const invalidBody of [
        {},
        { approverUserId: '' },
        { approverUserId: 123 },
        { approverUserId: 'approver-1', applicantUserId: 'member-1' },
      ]) {
        const invalid = await request('/approval-config/purchase_request', {
          user: 'admin', method: 'PUT', body: invalidBody,
        });
        assert.equal(invalid.response.status, 400);
      }
      const invalidDocumentType = await request('/approval-config/not-a-document', {
        user: 'admin', method: 'PUT', body: { approverUserId: 'approver-1' },
      });
      assert.equal(invalidDocumentType.response.status, 409);

      permissionModule.configureMaterialsPermissionService(database);
      const directEntry = permissionModule.updateApprovalConfig(
        { id: 'admin-1', role: 'admin' },
        'purchase_receipt',
        'approver-1',
      );
      assert.deepEqual(directEntry, {
        documentType: 'purchase_receipt',
        approver: { id: 'approver-1', name: 'Approver', isActive: true, isAuthorized: true },
      });

      database.exec('DROP TABLE mt_permissions');
      const internalFailure = await request('/permissions', { user: 'admin' });
      assert.equal(internalFailure.response.status, 500);
      assert.deepEqual(internalFailure.body, { error: 'Internal server error' });
      assert(!JSON.stringify(internalFailure.body).toLowerCase().includes('sql'));
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error?: Error) => {
        if (error) reject(error); else resolve();
      }));
      database.close();
    }
  `, 'utf8');

  try {
    const output = execFileSync(tsxPath, [runnerPath], {
      cwd: projectRoot,
      encoding: 'utf8',
      env: process.env,
      stdio: 'pipe',
    });
    assert.equal(output, '');
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
