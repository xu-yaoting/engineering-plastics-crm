import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const permissionsUrl = pathToFileURL(
  path.join(projectRoot, 'server/materials-tooling/permissions.ts'),
).href;
const schemaUrl = pathToFileURL(
  path.join(projectRoot, 'server/materials-tooling/schema.ts'),
).href;
const packageUrl = pathToFileURL(path.join(projectRoot, 'package.json')).href;

test('materials tooling permission service enforces access and static approval configuration', () => {
  const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'mt-permissions-'));
  const runnerPath = path.join(temporaryDirectory, 'permissions-behavior.ts');

  writeFileSync(runnerPath, `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';

    const require = createRequire(${JSON.stringify(packageUrl)});
    const Database = require('better-sqlite3');

    const { ensureMaterialsToolingSchema } = await import(${JSON.stringify(schemaUrl)});
    const {
      MaterialsAuthorizationError,
      MaterialsConfigurationError,
      MaterialsValidationError,
      configureMaterialsPermissionService,
      getMaterialsPermission,
      requireMaterialsPermission,
      resolveApprover,
      updateApprovalConfig,
      updateUserPermissions,
    } = await import(${JSON.stringify(permissionsUrl)});

    const deferredMiddleware = requireMaterialsPermission('enter');
    assert.equal(typeof deferredMiddleware, 'function', 'middleware can be declared before service configuration');
    assert.throws(
      () => deferredMiddleware({} as never, {} as never, () => {}),
      /has not been configured/,
      'an invoked but unconfigured public wrapper fails clearly',
    );

    const database = new Database(':memory:');
    database.pragma('foreign_keys = ON');
    database.exec(\`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1
      )
    \`);
    ensureMaterialsToolingSchema(database);

    const insertUser = database.prepare(
      'INSERT INTO users (id, name, role, is_active) VALUES (?, ?, ?, ?)',
    );
    insertUser.run('admin-1', 'Administrator', 'admin', 1);
    insertUser.run('member-1', 'Member', 'member', 1);
    insertUser.run('clerk-1', 'Clerk', 'member', 1);
    insertUser.run('approver-1', 'Approver', 'member', 1);
    insertUser.run('inactive-1', 'Inactive', 'member', 0);

    configureMaterialsPermissionService(database);

    assert.deepEqual(getMaterialsPermission({ id: 'admin-1', role: 'admin' }), {
      enter: true,
      manageMaterials: true,
      approve: true,
      viewPrices: true,
      managePeriods: true,
    });
    assert.deepEqual(getMaterialsPermission({ id: 'member-1', role: 'member' }), {
      enter: true,
      manageMaterials: false,
      approve: false,
      viewPrices: false,
      managePeriods: false,
    });

    const storedPermissions = updateUserPermissions(
      { id: 'admin-1', role: 'admin' },
      'clerk-1',
      { manageMaterials: true, approve: false, viewPrices: true, managePeriods: false },
    );
    assert.deepEqual(storedPermissions, {
      enter: true,
      manageMaterials: true,
      approve: false,
      viewPrices: true,
      managePeriods: false,
    });
    assert.deepEqual(
      database.prepare('SELECT manage_materials, approve, view_prices, manage_periods, updated_by FROM mt_permissions WHERE user_id = ?').get('clerk-1'),
      { manage_materials: 1, approve: 0, view_prices: 1, manage_periods: 0, updated_by: 'admin-1' },
    );

    updateUserPermissions(
      { id: 'admin-1', role: 'admin' },
      'clerk-1',
      { manageMaterials: false, approve: true, viewPrices: false, managePeriods: true },
    );
    assert.deepEqual(
      database.prepare('SELECT manage_materials, approve, view_prices, manage_periods FROM mt_permissions WHERE user_id = ?').get('clerk-1'),
      { manage_materials: 0, approve: 1, view_prices: 0, manage_periods: 1 },
      'permission updates must upsert and normalize booleans to integers',
    );
    assert.deepEqual(
      updateUserPermissions(
        { id: 'admin-1', role: 'admin' },
        'admin-1',
        { manageMaterials: false, approve: false, viewPrices: false, managePeriods: false },
      ),
      {
        enter: true,
        manageMaterials: true,
        approve: true,
        viewPrices: true,
        managePeriods: true,
      },
      'global administrators remain fully authorized regardless of stored module flags',
    );

    const permissionStateBeforeInvalidWrites = database.prepare(
      'SELECT manage_materials, approve, view_prices, manage_periods, updated_by, updated_at FROM mt_permissions WHERE user_id = ?',
    ).get('clerk-1');
    const invalidPermissionPayloads: unknown[] = [
      { manageMaterials: true, approve: false, viewPrices: true },
      { manageMaterials: true, approve: false, viewPrices: true, managePeriods: false, extra: false },
      { manageMaterials: 'false', approve: false, viewPrices: true, managePeriods: false },
      { manageMaterials: 1, approve: false, viewPrices: true, managePeriods: false },
      null,
      [],
      Object.assign(Object.create(null), {
        manageMaterials: true, approve: false, viewPrices: true, managePeriods: false,
      }),
    ];
    for (const payload of invalidPermissionPayloads) {
      assert.throws(
        () => updateUserPermissions(
          { id: 'admin-1', role: 'admin' },
          'clerk-1',
          payload as never,
        ),
        (error: unknown) => error instanceof MaterialsValidationError && error.statusCode === 400,
      );
      assert.deepEqual(
        database.prepare(
          'SELECT manage_materials, approve, view_prices, manage_periods, updated_by, updated_at FROM mt_permissions WHERE user_id = ?',
        ).get('clerk-1'),
        permissionStateBeforeInvalidWrites,
        'invalid permission payloads must not change stored permissions',
      );
    }

    assert.throws(
      () => updateUserPermissions(
        { id: 'member-1', role: 'member' },
        'clerk-1',
        { manageMaterials: true, approve: true, viewPrices: true, managePeriods: true },
      ),
      (error: unknown) => error instanceof MaterialsAuthorizationError && error.statusCode === 403,
    );
    assert.throws(
      () => updateUserPermissions(
        { id: 'admin-1', role: 'admin' },
        'inactive-1',
        { manageMaterials: true, approve: false, viewPrices: false, managePeriods: false },
      ),
      (error: unknown) => error instanceof MaterialsConfigurationError && error.statusCode === 409,
    );

    assert.throws(
      () => updateApprovalConfig(
        { id: 'admin-1', role: 'admin' },
        'purchase_request',
        'approver-1',
      ),
      (error: unknown) => error instanceof MaterialsConfigurationError && error.statusCode === 409,
      'a non-admin approver must have the module approve permission',
    );
    updateUserPermissions(
      { id: 'admin-1', role: 'admin' },
      'approver-1',
      { manageMaterials: false, approve: true, viewPrices: false, managePeriods: false },
    );
    updateApprovalConfig(
      { id: 'admin-1', role: 'admin' },
      'purchase_request',
      'approver-1',
    );
    assert.equal(resolveApprover('purchase_request', 'member-1'), 'approver-1');
    assert.deepEqual(
      database.prepare('SELECT approver_user_id, updated_by FROM mt_approval_config WHERE document_type = ?').get('purchase_request'),
      { approver_user_id: 'approver-1', updated_by: 'admin-1' },
    );

    database.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run('approver-1');
    assert.throws(
      () => resolveApprover('purchase_request', 'member-1'),
      (error: unknown) => error instanceof MaterialsConfigurationError && error.statusCode === 409,
      'configured approver must still be active when a document is submitted',
    );
    database.prepare('UPDATE users SET is_active = 1 WHERE id = ?').run('approver-1');
    assert.throws(
      () => resolveApprover('purchase_request', 'approver-1'),
      (error: unknown) => error instanceof MaterialsConfigurationError && error.statusCode === 409,
      'applicants cannot approve their own documents',
    );
    assert.throws(
      () => resolveApprover('material_issue', 'member-1'),
      (error: unknown) => error instanceof MaterialsConfigurationError && error.statusCode === 409,
      'missing static configuration must be identifiable',
    );
    assert.throws(
      () => updateApprovalConfig(
        { id: 'admin-1', role: 'admin' },
        'material_issue',
        'inactive-1',
      ),
      (error: unknown) => error instanceof MaterialsConfigurationError && error.statusCode === 409,
    );
    assert.throws(
      () => updateApprovalConfig(
        { id: 'member-1', role: 'member' },
        'material_issue',
        'member-1',
      ),
      (error: unknown) => error instanceof MaterialsAuthorizationError && error.statusCode === 403,
    );

    function responseRecorder() {
      return {
        statusCode: 200,
        body: undefined as unknown,
        status(code: number) { this.statusCode = code; return this; },
        json(body: unknown) { this.body = body; return this; },
      };
    }

    let nextCalls = 0;
    const unauthenticatedResponse = responseRecorder();
    requireMaterialsPermission('enter')(
      {}, unauthenticatedResponse as never, () => { nextCalls += 1; },
    );
    assert.equal(unauthenticatedResponse.statusCode, 401);
    assert.equal(nextCalls, 0);

    const memberResponse = responseRecorder();
    requireMaterialsPermission('enter')(
      { user: { id: 'member-1', name: 'Member', role: 'member' } } as never,
      memberResponse as never,
      () => { nextCalls += 1; },
    );
    assert.equal(nextCalls, 1, 'every authenticated member may enter');

    const forbiddenResponse = responseRecorder();
    requireMaterialsPermission('viewPrices')(
      { user: { id: 'member-1', name: 'Member', role: 'member' } } as never,
      forbiddenResponse as never,
      () => { nextCalls += 1; },
    );
    assert.equal(forbiddenResponse.statusCode, 403);
    assert.equal(nextCalls, 1);

    const adminResponse = responseRecorder();
    requireMaterialsPermission('managePeriods')(
      { user: { id: 'admin-1', name: 'Administrator', role: 'admin' } } as never,
      adminResponse as never,
      () => { nextCalls += 1; },
    );
    assert.equal(nextCalls, 2, 'administrators bypass stored module permissions');

    database.close();
  `, 'utf8');

  try {
    const output = execFileSync(process.execPath, [runnerPath], {
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
