import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const tsx = path.join(root, 'node_modules', '.bin', 'tsx');
const packageUrl = pathToFileURL(path.join(root, 'package.json')).href;
const schemaUrl = pathToFileURL(path.join(root, 'server/materials-tooling/schema.ts')).href;
const routerUrl = pathToFileURL(path.join(root, 'server/routes/materials-tooling.ts')).href;
const toolingServiceUrl = pathToFileURL(path.join(root, 'server/materials-tooling/tooling.ts')).href;

test('tooling assets are available through the authenticated HTTP interface', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'mt-tooling-'));
  const runner = path.join(directory, 'tooling-behavior.mts');
  writeFileSync(runner, `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(${JSON.stringify(packageUrl)});
    const Database = require('better-sqlite3');
    const express = require('express');
    const { ensureMaterialsToolingSchema } = await import(${JSON.stringify(schemaUrl)});
    const { createMaterialsToolingRouter } = await import(${JSON.stringify(routerUrl)});

    const database = new Database(':memory:');
    database.pragma('foreign_keys = ON');
    database.exec(\`
      CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE audit_log (id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, user_id TEXT, user_name TEXT NOT NULL, action TEXT NOT NULL, changes TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL);
      INSERT INTO users (id, name, role) VALUES
        ('admin', 'Admin', 'admin'), ('member', 'Member', 'member'),
        ('clerk', 'Moana', 'member'), ('manager', 'Manager', 'member');
    \`);
    ensureMaterialsToolingSchema(database);
    database.exec(\`
      INSERT INTO mt_permissions
        (user_id, manage_materials, approve, view_prices, manage_periods, updated_by, updated_at)
      VALUES
        ('clerk', 1, 0, 1, 0, 'admin', '2026-07-15T00:00:00Z'),
        ('manager', 1, 1, 0, 0, 'admin', '2026-07-15T00:00:00Z');
      INSERT INTO mt_approval_config
        (document_type, approver_user_id, updated_by, updated_at)
      VALUES ('tooling_movement', 'manager', 'admin', '2026-07-15T00:00:00Z');
      INSERT INTO mt_suppliers
        (id, code, name, is_active, created_by, updated_by, created_at, updated_at)
      VALUES ('supplier', 'SUP-1', 'Sensitive Supplier', 1, 'admin', 'admin', 'x', 'x');
    \`);
    const users = new Map([
      ['admin', { id: 'admin', name: 'Admin', role: 'admin' }],
      ['member', { id: 'member', name: 'Member', role: 'member' }],
      ['clerk', { id: 'clerk', name: 'Moana', role: 'member' }],
      ['manager', { id: 'manager', name: 'Manager', role: 'member' }],
    ]);
    const app = express();
    app.use(express.json());
    app.use((req: any, _res: any, next: () => void) => {
      req.user = users.get(String(req.headers['x-test-user']));
      next();
    });
    app.use('/materials-tooling', createMaterialsToolingRouter(database));
    const server = await new Promise<any>((resolve, reject) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
      listener.on('error', reject);
    });
    try {
      const base = 'http://127.0.0.1:' + server.address().port + '/materials-tooling';
      async function call(pathname: string, user?: string, method = 'GET', body?: unknown) {
        const response = await fetch(base + pathname, {
          method,
          headers: {
            ...(user ? { 'x-test-user': user } : {}),
            ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        return { status: response.status, body: await response.json() };
      }

      assert.equal((await call('/tooling')).status, 401);
      assert.deepEqual((await call('/tooling', 'member')).body, { tooling: [] });
      assert.equal((await call('/tooling', 'member', 'POST', {
        tooling_code: 'T-0', name: 'Blocked', category: 'Mold',
      })).status, 403);
      assert.equal((await call('/tooling', 'manager', 'POST', {
        tooling_code: 'T-0', name: 'Blind overwrite', category: 'Mold', purchase_price: 1,
      })).status, 403);

      const created = await call('/tooling', 'clerk', 'POST', {
        tooling_code: ' tool-1 ', name: 'Injection Mold', category: 'Mold',
        specification: 'A4', serial_number: 'SN-1', tracked_quantity: 1,
        supplier_id: 'supplier', purchase_price: 12500, contract_number: 'C-1',
        invoice_number: 'I-1', acquired_at: '2026-07-01', expected_life_months: 60,
        next_maintenance_date: '2026-12-01', notes: 'Initial record',
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const assetId = created.body.tooling.id;
      assert.equal(created.body.tooling.tooling_code, 'TOOL-1');
      assert.equal(created.body.tooling.status, 'in_stock');
      assert.equal(created.body.tooling.custodian_user_id, null);
      assert.equal(created.body.tooling.location, null);
      assert.equal(created.body.tooling.purchase_price, 12500);

      const autoCreated = await call('/tooling', 'clerk', 'POST', {
        name: 'Auto-coded Fixture', category: 'Fixture', tracked_quantity: 1,
      });
      assert.equal(autoCreated.status, 201, JSON.stringify(autoCreated.body));
      assert.equal(autoCreated.body.tooling.tooling_code, 'TLG-0001');

      const toolingRequest = await call('/documents', 'clerk', 'POST', {
        document_type: 'tooling_movement', request_date: '2026-07-15', lines: [],
        tooling_request: {
          asset_id: assetId, action: 'issue', to_custodian_user_id: 'member',
          to_location: 'Workshop', reason: 'Production use',
        },
      });
      assert.equal(toolingRequest.status, 201, JSON.stringify(toolingRequest.body));
      const toolingDocumentId = toolingRequest.body.document.id;
      assert.equal(toolingRequest.body.document.tooling_request.asset_id, assetId);
      assert.equal(toolingRequest.body.document.tooling_request.action, 'issue');
      const toolingDetail = await call('/documents/' + toolingDocumentId, 'member');
      assert.equal(toolingDetail.status, 200);
      assert.equal(toolingDetail.body.document.tooling_request.to_custodian_user_id, 'member');
      const updatedToolingRequest = await call('/documents/' + toolingDocumentId, 'clerk', 'PUT', {
        tooling_request: {
          asset_id: assetId, action: 'loan', to_custodian_user_id: 'member',
          to_location: 'External trial', reason: 'Customer validation',
        },
      });
      assert.equal(updatedToolingRequest.status, 200, JSON.stringify(updatedToolingRequest.body));
      assert.equal(updatedToolingRequest.body.document.tooling_request.action, 'loan');
      const clearedToolingRequest = await call('/documents/' + toolingDocumentId, 'clerk', 'PUT', {
        tooling_request: null,
      });
      assert.equal(clearedToolingRequest.status, 200, JSON.stringify(clearedToolingRequest.body));
      assert.equal(clearedToolingRequest.body.document.tooling_request, null);
      const restoredToolingRequest = await call('/documents/' + toolingDocumentId, 'clerk', 'PUT', {
        tooling_request: {
          asset_id: assetId, action: 'loan', to_custodian_user_id: 'member',
          to_location: 'External trial', reason: 'Customer validation',
        },
      });
      assert.equal(restoredToolingRequest.status, 200, JSON.stringify(restoredToolingRequest.body));
      for (const invalidRequest of [
        { asset_id: assetId, action: 'unknown' },
        { asset_id: assetId, action: 'issue' },
        { asset_id: assetId, action: 'return' },
        { asset_id: assetId, action: 'transfer' },
        { asset_id: assetId, action: 'disposal' },
        { asset_id: assetId, action: 'loss_report' },
        { asset_id: 'missing', action: 'repair', to_location: 'Vendor' },
        { asset_id: assetId, action: 'loan', to_custodian_user_id: 'missing' },
      ]) {
        const invalid = await call('/documents', 'clerk', 'POST', {
          document_type: 'tooling_movement', request_date: '2026-07-15', lines: [],
          tooling_request: invalidRequest,
        });
        assert([400, 404].includes(invalid.status), JSON.stringify(invalid.body));
      }
      assert.equal((await call('/documents', 'clerk', 'POST', {
        document_type: 'scrap', request_date: '2026-07-15', lines: [{
          material_item_id: 'missing', requested_quantity: 1, unit: '件',
        }],
        tooling_request: { asset_id: assetId, action: 'disposal', reason: 'No longer usable' },
      })).status, 400, 'non-tooling documents must reject tooling_request before accepting it');
      const requestless = await call('/documents', 'clerk', 'POST', {
        document_type: 'tooling_movement', request_date: '2026-07-15', lines: [],
      });
      assert.equal(requestless.status, 201);
      assert.equal(requestless.body.document.tooling_request, null);
      const requestlessSubmit = await call('/documents/' + requestless.body.document.id + '/submit', 'clerk', 'POST', {});
      assert.equal(requestlessSubmit.status, 409);
      assert.equal(database.prepare('SELECT status FROM mt_documents WHERE id=?').get(requestless.body.document.id).status, 'draft');
      assert.equal(database.prepare('SELECT COUNT(*) count FROM mt_document_versions WHERE document_id=?').get(requestless.body.document.id).count, 0);

      for (const invalid of [
        { tooling_code: 'X', name: 'Bad', category: 'Mold', status: 'in_use' },
        { tooling_code: 'X', name: 'Bad', category: 'Mold', tracked_quantity: 0 },
        { tooling_code: 'X', name: 'Bad', category: 'Mold', acquired_at: '2026-02-30' },
        { tooling_code: 'X', name: 'Bad', category: 'Mold', supplier_id: 'missing' },
      ]) assert([400, 404].includes((await call('/tooling', 'clerk', 'POST', invalid)).status));
      assert.equal((await call('/tooling', 'clerk', 'POST', {
        tooling_code: 'TOOL-1', name: 'Duplicate', category: 'Mold',
      })).status, 409);

      const memberList = await call('/tooling', 'member');
      assert.equal(memberList.status, 200);
      const memberText = JSON.stringify(memberList.body);
      for (const secret of ['12500', 'Sensitive Supplier', 'supplier', 'C-1', 'I-1']) {
        assert(!memberText.includes(secret), secret + ' must be redacted');
      }
      assert.equal(memberList.body.tooling[0].tracked_quantity, 1);
      assert.equal(memberList.body.tooling[0].status, 'in_stock');

      assert.equal((await call('/tooling/' + assetId, 'clerk', 'PUT', { tooling_code: 'TOOL-2' })).status, 409);
      assert.equal((await call('/tooling/' + assetId, 'clerk', 'PUT', { serial_number: 'SN-2' })).status, 409);
      assert.equal((await call('/tooling/' + assetId, 'clerk', 'PUT', { tracked_quantity: 2 })).status, 409);
      assert.equal((await call('/tooling/' + assetId, 'clerk', 'PUT', {
        name: 'Injection Mold Revised', notes: 'Corrected',
      })).status, 200);
      const auditBeforeNoop = database.prepare("SELECT COUNT(*) count FROM audit_log WHERE entity_type='mt_tooling_asset'").get().count;
      assert.equal((await call('/tooling/' + assetId, 'clerk', 'PUT', { name: 'Injection Mold Revised' })).status, 200);
      assert.equal(database.prepare("SELECT COUNT(*) count FROM audit_log WHERE entity_type='mt_tooling_asset'").get().count, auditBeforeNoop,
        'no-op update must not write an audit event');
      assert.equal((await call('/tooling/' + assetId, 'clerk', 'PUT', { purchase_price: 13000 })).status, 200);
      assert.equal((await call('/tooling/' + assetId, 'clerk', 'PUT', { status: 'lost' })).status, 400);
      assert.equal((await call('/tooling/' + assetId, 'clerk', 'PUT', { custodian_user_id: 'member' })).status, 400);
      assert.equal((await call('/tooling/' + assetId, 'manager', 'PUT', { purchase_price: 5 })).status, 403);

      const submittedTooling = await call('/documents/' + toolingDocumentId + '/submit', 'clerk', 'POST', {});
      assert.equal(submittedTooling.status, 200, JSON.stringify(submittedTooling.body));
      const frozenBeforeRename = JSON.parse(database.prepare(
        'SELECT snapshot_json FROM mt_document_versions WHERE document_id=? AND version=1',
      ).get(toolingDocumentId).snapshot_json).header.tooling_request;
      assert.equal(frozenBeforeRename.asset_code, 'TOOL-1');
      assert.equal(frozenBeforeRename.asset_name, 'Injection Mold Revised');
      assert.equal(frozenBeforeRename.asset_specification, 'A4');
      assert.equal(frozenBeforeRename.current_status, 'in_stock');
      assert.equal(frozenBeforeRename.current_custodian_name, null);
      assert.equal(frozenBeforeRename.current_location, null);
      assert.equal(frozenBeforeRename.to_custodian_name, 'Member');
      assert.equal(frozenBeforeRename.action, 'loan');
      database.prepare("UPDATE mt_tooling_assets SET name='Renamed after submission', specification='Changed' WHERE id=?").run(assetId);
      database.prepare("UPDATE users SET name='Member Renamed' WHERE id='member'").run();
      const frozenHistory = await call('/documents/' + toolingDocumentId, 'member');
      const frozenRequest = frozenHistory.body.document.versions[0].snapshot.header.tooling_request;
      assert.equal(frozenRequest.asset_name, 'Injection Mold Revised');
      assert.equal(frozenRequest.asset_specification, 'A4');
      assert.equal(frozenRequest.to_custodian_name, 'Member');
      assert(!JSON.stringify(frozenRequest).includes('Renamed after submission'));
      assert(!JSON.stringify(frozenRequest).includes('Member Renamed'));
      assert.equal((await call('/documents/' + toolingDocumentId + '/approve', 'manager', 'POST', {
        comment: 'Approved tooling request',
      })).status, 200);
      assert.equal(database.prepare('SELECT status FROM mt_documents WHERE id=?').get(toolingDocumentId).status, 'pending_execution');

      database.prepare(\`INSERT INTO mt_periods
        (period_key,status,closed_by,closed_at)
        VALUES ('2026-07','closed','admin','2026-07-15T00:00:00Z')\`).run();
      assert.equal((await call('/tooling/' + assetId + '/movements', 'clerk', 'POST', {
        document_id: toolingDocumentId,
      })).status, 409);
      assert.equal(database.prepare('SELECT status FROM mt_documents WHERE id=?').get(toolingDocumentId).status, 'pending_execution');
      database.prepare("DELETE FROM mt_periods WHERE period_key='2026-07'").run();
      assert.equal((await call('/tooling/not-the-approved-asset/movements', 'clerk', 'POST', {
        document_id: toolingDocumentId,
      })).status, 409);
      assert.equal((await call('/tooling/' + assetId + '/movements', 'member', 'POST', {
        document_id: toolingDocumentId,
      })).status, 403);
      database.prepare(\`UPDATE mt_tooling_requests
        SET action = 'issue', to_location = 'Tampered current request'
        WHERE document_id = ?\`).run(toolingDocumentId);
      const executedTooling = await call('/tooling/' + assetId + '/movements', 'clerk', 'POST', {
        document_id: toolingDocumentId,
      });
      assert.equal(executedTooling.status, 200, JSON.stringify(executedTooling.body));
      assert.equal(executedTooling.body.tooling.status, 'loaned');
      assert.equal(executedTooling.body.tooling.custodian_user_id, 'member');
      assert.equal(executedTooling.body.tooling.location, 'External trial');
      const listedAfterIssue = await call('/tooling', 'clerk');
      const issuedRow = listedAfterIssue.body.tooling.find((row: any) => row.id === assetId);
      assert.equal(issuedRow.custodian_name, 'Member Renamed',
        'tooling list must resolve custodian names for display');
      assert.equal(issuedRow.custodian_user_id, 'member');
      assert.equal(database.prepare('SELECT status FROM mt_documents WHERE id=?').get(toolingDocumentId).status, 'executed');
      assert.equal(database.prepare('SELECT COUNT(*) count FROM mt_tooling_movements WHERE document_id=?').get(toolingDocumentId).count, 1);
      assert.equal(database.prepare('SELECT COUNT(*) count FROM mt_movements').get().count, 0);
      assert.equal((await call('/documents/' + toolingDocumentId + '/execute', 'clerk', 'POST', {})).status, 409);
      assert.equal(database.prepare('SELECT COUNT(*) count FROM mt_tooling_movements WHERE document_id=?').get(toolingDocumentId).count, 1);

      const resubmittedRequest = await call('/documents', 'clerk', 'POST', {
        document_type: 'tooling_movement', request_date: '2026-07-15', lines: [],
        tooling_request: {
          asset_id: assetId, action: 'issue', to_custodian_user_id: 'member',
          to_location: 'Workshop', reason: 'Initial request',
        },
      });
      const resubmittedDocumentId = resubmittedRequest.body.document.id;
      assert.equal((await call('/documents/' + resubmittedDocumentId + '/submit', 'clerk', 'POST', {})).status, 200);
      assert.equal((await call('/documents/' + resubmittedDocumentId + '/reject', 'manager', 'POST', {
        reason: 'Use the loan process',
      })).status, 200);
      assert.equal((await call('/documents/' + resubmittedDocumentId, 'clerk', 'PUT', {
        tooling_request: {
          asset_id: assetId, action: 'loan', to_custodian_user_id: 'member',
          to_location: 'External trial', reason: 'Revised request',
        },
      })).status, 200);
      assert.equal((await call('/documents/' + resubmittedDocumentId + '/submit', 'clerk', 'POST', {})).status, 200);
      const resubmittedVersions = database.prepare(
        'SELECT version, snapshot_json FROM mt_document_versions WHERE document_id=? ORDER BY version',
      ).all(resubmittedDocumentId).map((row: any) => ({
        version: row.version,
        request: JSON.parse(row.snapshot_json).header.tooling_request,
      }));
      assert.deepEqual(resubmittedVersions.map((entry: any) => entry.version), [1, 2]);
      assert.equal(resubmittedVersions[0].request.action, 'issue');
      assert.equal(resubmittedVersions[0].request.reason, 'Initial request');
      assert.equal(resubmittedVersions[1].request.action, 'loan');
      assert.equal(resubmittedVersions[1].request.reason, 'Revised request');
      database.prepare("UPDATE mt_tooling_assets SET name='Injection Mold Revised', specification='A4' WHERE id=?").run(assetId);
      database.prepare("UPDATE users SET name='Member' WHERE id='member'").run();

      database.prepare(\`INSERT INTO mt_attachments
        (id, document_id, tooling_asset_id, category, original_name, stored_name, mime_type,
         size_bytes, is_sensitive, uploaded_by, uploaded_at, notes)
        VALUES
          ('public-photo', NULL, ?, 'tooling_photo', 'photo.png', 'public.bin', 'image/png', 10, 0, 'clerk', 'x', 'Front'),
          ('acceptance', NULL, ?, 'acceptance_record', 'acceptance.pdf', 'acceptance.bin', 'application/pdf', 15, 0, 'clerk', 'x', 'Acceptance'),
          ('secret-contract', NULL, ?, 'contract', 'contract.pdf', 'secret.bin', 'application/pdf', 20, 1, 'clerk', 'x', 'Private')\`).run(assetId, assetId, assetId);

      assert.equal((await call('/tooling/' + assetId, 'clerk', 'PUT', { name: 'History rewrite' })).status, 409);
      assert.equal((await call('/tooling/' + assetId, 'clerk', 'PUT', { category: 'Other' })).status, 409);
      assert.equal((await call('/tooling/' + assetId, 'clerk', 'PUT', { specification: 'B4' })).status, 409);
      assert.equal((await call('/tooling/' + assetId, 'clerk', 'PUT', { notes: 'Maintenance note' })).status, 200);
      const memberDetail = await call('/tooling/' + assetId, 'member');
      assert.equal(memberDetail.status, 200);
      assert.equal(memberDetail.body.tooling.movements[0].movement_type, 'loan');
      assert.equal(memberDetail.body.tooling.movements[0].to_custodian_name, 'Member');
      assert.deepEqual(memberDetail.body.tooling.evidence.map((entry: any) => entry.id), ['public-photo']);
      assert(!JSON.stringify(memberDetail.body).includes('secret-contract'));
      const clerkDetail = await call('/tooling/' + assetId, 'clerk');
      assert.deepEqual(clerkDetail.body.tooling.evidence.map((entry: any) => entry.id), ['secret-contract', 'public-photo', 'acceptance']);

      async function approveMovement(targetAssetId: string, action: string, fields: Record<string, unknown>) {
        const createdMovement = await call('/documents', 'clerk', 'POST', {
          document_type: 'tooling_movement', request_date: '2026-07-15', lines: [],
          tooling_request: { asset_id: targetAssetId, action, ...fields },
        });
        assert.equal(createdMovement.status, 201, JSON.stringify(createdMovement.body));
        const documentId = createdMovement.body.document.id;
        assert.equal((await call('/documents/' + documentId + '/submit', 'clerk', 'POST', {})).status, 200);
        assert.equal((await call('/documents/' + documentId + '/approve', 'manager', 'POST', {})).status, 200);
        return documentId;
      }

      const invalidIssueId = await approveMovement(assetId, 'issue', {
        to_custodian_user_id: 'member', to_location: 'Workshop', reason: 'Invalid while loaned',
      });
      const movementCountBeforeInvalid = database.prepare('SELECT COUNT(*) count FROM mt_tooling_movements WHERE asset_id=?').get(assetId).count;
      assert.equal((await call('/documents/' + invalidIssueId + '/execute', 'clerk', 'POST', {})).status, 409);
      assert.equal(database.prepare('SELECT status FROM mt_documents WHERE id=?').get(invalidIssueId).status, 'pending_execution');
      assert.equal(database.prepare('SELECT COUNT(*) count FROM mt_tooling_movements WHERE asset_id=?').get(assetId).count, movementCountBeforeInvalid);

      const returnId = await approveMovement(assetId, 'return', {
        to_location: 'Tool crib', reason: 'Trial complete',
      });
      assert.equal((await call('/documents/' + returnId + '/execute', 'clerk', 'POST', {})).status, 200);
      assert.deepEqual(database.prepare('SELECT status,custodian_user_id,location FROM mt_tooling_assets WHERE id=?').get(assetId), {
        status: 'in_stock', custodian_user_id: null, location: 'Tool crib',
      });
      const issueId = await approveMovement(assetId, 'issue', {
        to_custodian_user_id: 'member', to_location: 'Workshop', reason: 'Production use',
      });
      assert.equal((await call('/tooling/' + assetId + '/movements', 'clerk', 'POST', { document_id: issueId })).status, 200);
      const transferId = await approveMovement(assetId, 'transfer', {
        to_custodian_user_id: 'manager', to_location: 'Workshop B', reason: 'Shift handover',
      });
      assert.equal((await call('/documents/' + transferId + '/execute', 'manager', 'POST', {})).status, 200);
      assert.deepEqual(database.prepare('SELECT status,custodian_user_id,location FROM mt_tooling_assets WHERE id=?').get(assetId), {
        status: 'in_use', custodian_user_id: 'manager', location: 'Workshop B',
      });
      const repairId = await approveMovement(assetId, 'repair', {
        to_location: 'Repair vendor', reason: 'Scheduled repair',
      });
      assert.equal((await call('/documents/' + repairId + '/execute', 'clerk', 'POST', {})).status, 200);
      assert.deepEqual(database.prepare('SELECT status,custodian_user_id,location FROM mt_tooling_assets WHERE id=?').get(assetId), {
        status: 'under_repair', custodian_user_id: null, location: 'Repair vendor',
      });
      const repairCompletionId = await approveMovement(assetId, 'repair_completion', {
        to_location: 'Tool crib', reason: 'Repair accepted',
      });
      assert.equal((await call('/documents/' + repairCompletionId + '/execute', 'clerk', 'POST', {})).status, 200);

      const disposable = await call('/tooling', 'clerk', 'POST', {
        tooling_code: 'TOOL-DISPOSE', name: 'Disposable fixture', category: 'Fixture',
      });
      const disposalId = await approveMovement(disposable.body.tooling.id, 'disposal', {
        reason: 'End of service life', to_location: 'Scrap holding',
      });
      assert.equal((await call('/documents/' + disposalId + '/execute', 'clerk', 'POST', {})).status, 200);
      assert.equal(database.prepare('SELECT status FROM mt_tooling_assets WHERE id=?').get(disposable.body.tooling.id).status, 'disposed');

      const noEvidence = await call('/tooling', 'clerk', 'POST', {
        tooling_code: 'TOOL-NO-PHOTO', name: 'Unverified loss', category: 'Fixture',
      });
      const noEvidenceLossId = await approveMovement(noEvidence.body.tooling.id, 'loss_report', {
        reason: 'Cannot locate',
      });
      assert.equal((await call('/documents/' + noEvidenceLossId + '/execute', 'clerk', 'POST', {})).status, 409);
      assert.equal(database.prepare('SELECT status FROM mt_tooling_assets WHERE id=?').get(noEvidence.body.tooling.id).status, 'in_stock');
      database.prepare(\`INSERT INTO mt_attachments
        (id, document_id, tooling_asset_id, category, original_name, stored_name, mime_type,
         size_bytes, is_sensitive, uploaded_by, uploaded_at)
        VALUES ('late-loss-photo', ?, NULL, 'tooling_photo', 'loss.png', 'late-loss.bin',
          'image/png', 10, 0, 'clerk', 'x')\`).run(noEvidenceLossId);
      database.exec("CREATE TRIGGER fail_tooling_execution_audit BEFORE INSERT ON audit_log WHEN NEW.entity_type='mt_tooling_asset' AND NEW.action='execute' BEGIN SELECT RAISE(ABORT, 'execution audit failed'); END");
      assert.equal((await call('/documents/' + noEvidenceLossId + '/execute', 'clerk', 'POST', {})).status, 500);
      assert.equal(database.prepare('SELECT status FROM mt_tooling_assets WHERE id=?').get(noEvidence.body.tooling.id).status, 'in_stock');
      assert.equal(database.prepare('SELECT status FROM mt_documents WHERE id=?').get(noEvidenceLossId).status, 'pending_execution');
      assert.equal(database.prepare('SELECT COUNT(*) count FROM mt_tooling_movements WHERE document_id=?').get(noEvidenceLossId).count, 0);
      database.exec('DROP TRIGGER fail_tooling_execution_audit');
      assert.equal((await call('/documents/' + noEvidenceLossId + '/execute', 'clerk', 'POST', {})).status, 200);

      const lossId = await approveMovement(assetId, 'loss_report', { reason: 'Missing after count' });
      assert.equal((await call('/documents/' + lossId + '/execute', 'clerk', 'POST', {})).status, 200);
      assert.equal(database.prepare('SELECT status FROM mt_tooling_assets WHERE id=?').get(assetId).status, 'lost');
      assert.equal((await call('/tooling/' + assetId, 'clerk', 'PUT', { next_maintenance_date: '2027-01-01' })).status, 409);
      assert.equal((await call('/tooling/' + assetId, 'clerk', 'PUT', { notes: 'Loss follow-up' })).status, 200);

      const updateAudits = database.prepare("SELECT changes FROM audit_log WHERE entity_type='mt_tooling_asset' AND action='update'").all()
        .map((row: any) => JSON.parse(row.changes));
      const nameAudit = updateAudits.find((entry: any) => entry.changes?.name);
      assert.deepEqual(nameAudit.changes.name, { old: 'Injection Mold', new: 'Injection Mold Revised' });
      const priceAudit = updateAudits.find((entry: any) => entry.sensitive_fields_changed?.includes('purchase_price'));
      assert(priceAudit);
      assert(!JSON.stringify(priceAudit).includes('12500'));
      assert(!JSON.stringify(priceAudit).includes('13000'));

      database.exec("CREATE TRIGGER fail_tooling_audit BEFORE INSERT ON audit_log WHEN NEW.entity_type='mt_tooling_asset' BEGIN SELECT RAISE(ABORT, 'audit failed'); END");
      const assetCountBeforeFailure = database.prepare('SELECT COUNT(*) count FROM mt_tooling_assets').get().count;
      assert.equal((await call('/tooling', 'clerk', 'POST', {
        tooling_code: 'ROLLBACK', name: 'Must rollback', category: 'Mold',
      })).status, 500);
      assert.equal(database.prepare('SELECT COUNT(*) count FROM mt_tooling_assets').get().count, assetCountBeforeFailure);
      const notesBeforeFailure = database.prepare('SELECT notes FROM mt_tooling_assets WHERE id=?').get(assetId).notes;
      assert.equal((await call('/tooling/' + assetId, 'clerk', 'PUT', { notes: 'Must rollback' })).status, 500);
      assert.equal(database.prepare('SELECT notes FROM mt_tooling_assets WHERE id=?').get(assetId).notes, notesBeforeFailure);
      database.exec('DROP TRIGGER fail_tooling_audit');
      assert.equal((await call('/tooling/missing', 'member')).status, 404);
      assert.equal((await call('/tooling/' + assetId + '/movements', 'clerk', 'POST', {})).status, 400);
      assert.equal(database.prepare('SELECT COUNT(*) count FROM mt_movements').get().count, 0);
      assert.equal(database.prepare("SELECT COUNT(*) count FROM audit_log WHERE entity_type='mt_tooling_asset' AND entity_id=?").get(assetId).count, 12);
      assert(!database.prepare("SELECT changes FROM audit_log WHERE entity_type='mt_tooling_asset' AND entity_id=? AND action='create'").get(assetId).changes.includes('12500'));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      database.close();
    }
  `);
  try {
    assert.equal(execFileSync(tsx, [runner], { cwd: root, encoding: 'utf8', stdio: 'pipe' }), '');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('tooling void reversal restores asset state and creates replacement document', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'mt-tooling-void-'));
  const runner = path.join(directory, 'tooling-void.mts');
  writeFileSync(runner, `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(${JSON.stringify(packageUrl)});
    const Database = require('better-sqlite3');
    const { ensureMaterialsToolingSchema } = await import(${JSON.stringify(schemaUrl)});
    const { createMaterialsToolingService } = await import(${JSON.stringify(toolingServiceUrl)});

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
      INSERT INTO mt_suppliers (id, code, name, is_active, created_by, updated_by, created_at, updated_at)
      VALUES ('supp1', 'SUP-1', 'Supplier', 1, 'admin', 'admin', 'x', 'x');
      INSERT INTO mt_tooling_assets (id, tooling_code, name, category, specification, status, custodian_user_id, location, created_by, updated_by, created_at, updated_at)
      VALUES ('asset-1', 'MOLD-A', 'Test Mold', 'Mold', 'A4', 'in_use', 'member', 'Workshop', 'admin', 'admin', 'x', 'x');
    \`);

    const permissions = { getMaterialsPermission: () => ({ manageMaterials: true, viewPrices: true, approve: true, managePeriods: true }) };
    const service = createMaterialsToolingService(db, permissions);

    // Create executed tooling movement document
    db.prepare(\`INSERT INTO mt_documents (id,document_number,document_type,version,status,applicant_user_id,department,request_date,purpose,created_by,updated_by,created_at,updated_at)
      VALUES ('doc-exec','TM-2026-0001','tooling_movement',1,'executed','member','Dept','2026-07-15','Issue mold','admin','admin','x','x')\`).run();
    db.prepare(\`INSERT INTO mt_tooling_movements (id,asset_id,document_id,movement_type,from_status,to_status,from_custodian_user_id,to_custodian_user_id,from_location,to_location,created_by,created_at)
      VALUES ('mov-1','asset-1','doc-exec','issue','in_stock','in_use',NULL,'member','Storage','Workshop','admin','2026-07-15T01:00:00Z')\`).run();

    // Test void reversal
    const result = service.voidAndReplace(
      { id: 'admin', name: 'Admin', role: 'admin' },
      'doc-exec', { reason: 'Wrong issue - need different mold' },
    );

    // Original document was voided
    const voided = db.prepare("SELECT status,void_reason,replaced_by_document_id FROM mt_documents WHERE id='doc-exec'").get() as any;
    assert.equal(voided.status, 'voided');
    assert.equal(voided.void_reason, 'Wrong issue - need different mold');
    assert.ok(voided.replaced_by_document_id);

    // Replacement document was created
    const replacement = db.prepare("SELECT id,status,replaces_document_id,document_number FROM mt_documents WHERE replaces_document_id='doc-exec'").get() as any;
    assert.ok(replacement);
    assert.equal(replacement.status, 'draft');
    assert.equal(replacement.replaces_document_id, 'doc-exec');
    assert.match(replacement.document_number, /^TM-2026-/);

    // Reversal movement was created
    const reversal = db.prepare("SELECT * FROM mt_tooling_movements WHERE movement_type='void_reversal'").get() as any;
    assert.ok(reversal);
    assert.equal(reversal.asset_id, 'asset-1');
    assert.equal(reversal.to_status, 'in_stock');
    assert.equal(reversal.document_id, 'doc-exec');
    assert.equal(reversal.reason, 'Wrong issue - need different mold');

    // Asset status restored to from_status
    const asset = db.prepare("SELECT status,custodian_user_id,location FROM mt_tooling_assets WHERE id='asset-1'").get() as any;
    assert.equal(asset.status, 'in_stock');
    assert.equal(asset.custodian_user_id, null);
    assert.equal(asset.location, 'Storage');

    // Audit records created
    const audits = db.prepare("SELECT action FROM audit_log WHERE entity_type='mt_tooling_asset' OR (entity_type='mt_document' AND action IN ('void','create_replacement'))").all() as any[];
    assert.ok(audits.some((a: any) => a.action === 'void_reversal'));
    assert.ok(audits.some((a: any) => a.action === 'void'));
    assert.ok(audits.some((a: any) => a.action === 'create_replacement'));

    // Test: subsequent movement blocks void (fresh scenario to avoid voided-doc conflict)
    db.prepare(\`INSERT INTO mt_tooling_assets (id,tooling_code,name,category,specification,status,custodian_user_id,location,created_by,updated_by,created_at,updated_at)
      VALUES ('asset-2','MOLD-B','Second Mold','Mold','B4','in_use','member','Workshop B','admin','admin','x','x')\`).run();
    db.prepare(\`INSERT INTO mt_documents (id,document_number,document_type,version,status,applicant_user_id,department,request_date,purpose,created_by,updated_by,created_at,updated_at)
      VALUES ('doc-sub','TM-2026-0010','tooling_movement',1,'executed','member','Dept','2026-07-16','Issue mold B','admin','admin','x','x')\`).run();
    db.prepare(\`INSERT INTO mt_tooling_movements (id,asset_id,document_id,movement_type,from_status,to_status,from_custodian_user_id,to_custodian_user_id,from_location,to_location,created_by,created_at)
      VALUES ('mov-sub1','asset-2','doc-sub','issue','in_stock','in_use',NULL,'member','Storage B','Workshop B','admin','2026-07-16T01:00:00Z')\`).run();
    // Subsequent movement on same asset
    db.prepare(\`INSERT INTO mt_documents (id,document_number,document_type,version,status,applicant_user_id,department,request_date,purpose,created_by,updated_by,created_at,updated_at)
      VALUES ('doc-sub2','TM-2026-0011','tooling_movement',1,'executed','member','Dept','2026-07-17','Return mold B','admin','admin','x','x')\`).run();
    db.prepare(\`INSERT INTO mt_tooling_movements (id,asset_id,document_id,movement_type,from_status,to_status,from_custodian_user_id,to_custodian_user_id,from_location,to_location,created_by,created_at)
      VALUES ('mov-sub2','asset-2','doc-sub2','return','in_use','in_stock','member',NULL,'Workshop B','Storage B','admin','2026-07-17T01:00:00Z')\`).run();
    assert.throws(() => service.voidAndReplace(
      { id: 'admin', name: 'Admin', role: 'admin' },
      'doc-sub', { reason: 'retry' },
    ), /subsequent/);

    // Test: non-admin is rejected
    assert.throws(() => service.voidAndReplace(
      { id: 'member', name: 'Member', role: 'member' },
      'doc-sub', { reason: 'test' },
    ), /Administrator/);

    // Test: missing reason is rejected
    assert.throws(() => service.voidAndReplace(
      { id: 'admin', name: 'Admin', role: 'admin' },
      'doc-sub', {},
    ), /reason/);

    // Test: void_reversal in movement_type CHECK constraint
    assert.doesNotThrow(() => db.prepare(\`INSERT INTO mt_tooling_movements
      (id,asset_id,document_id,movement_type,from_status,to_status,created_by,created_at)
      VALUES (?,?,'doc-sub','void_reversal','in_use','in_stock',?,?)\`).run('vr-test','asset-2','admin','x'));

    db.close();
  `);
  try {
    assert.equal(execFileSync(tsx, [runner], { cwd: root, encoding: 'utf8', stdio: 'pipe' }), '');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('legacy tooling movements migrate safely and accept loan records', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'mt-tooling-migration-'));
  const runner = path.join(directory, 'tooling-migration.mts');
  writeFileSync(runner, `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(${JSON.stringify(packageUrl)});
    const Database = require('better-sqlite3');
    const { ensureMaterialsToolingSchema } = await import(${JSON.stringify(schemaUrl)});
    const database = new Database(':memory:');
    database.exec(\`
      CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE audit_log (id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, user_id TEXT, user_name TEXT NOT NULL, action TEXT NOT NULL, changes TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL);
      INSERT INTO users (id, name, role) VALUES ('user', 'User', 'member');
    \`);
    ensureMaterialsToolingSchema(database);
    database.exec(\`
      INSERT INTO mt_tooling_assets
        (id, tooling_code, name, category, created_by, updated_by, created_at, updated_at)
      VALUES ('asset', 'LEGACY-1', 'Legacy Tool', 'Mold', 'user', 'user', 'x', 'x');
      INSERT INTO mt_documents
        (id, document_number, document_type, status, applicant_user_id, request_date,
         created_by, updated_by, created_at, updated_at)
      VALUES
        ('issue-doc', 'TM-2026-0001', 'tooling_movement', 'executed', 'user', '2026-07-15', 'user', 'user', 'x', 'x'),
        ('loan-doc', 'TM-2026-0002', 'tooling_movement', 'executed', 'user', '2026-07-15', 'user', 'user', 'x', 'x');
      INSERT INTO mt_tooling_movements
        (id, asset_id, document_id, movement_type, to_status, created_by, created_at)
      VALUES ('legacy-issue', 'asset', 'issue-doc', 'issue', 'in_use', 'user', 'x');
    \`);
    database.pragma('foreign_keys = OFF');
    database.exec(\`
      CREATE TABLE mt_tooling_movements_legacy (
        id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL REFERENCES mt_tooling_assets(id),
        document_id TEXT NOT NULL REFERENCES mt_documents(id),
        movement_type TEXT NOT NULL CHECK (movement_type IN (
          'issue', 'return', 'transfer', 'repair', 'repair_completion', 'disposal', 'loss_report'
        )),
        from_status TEXT CHECK (from_status IS NULL OR from_status IN ('in_stock','in_use','loaned','under_repair','disposed','lost')),
        to_status TEXT NOT NULL CHECK (to_status IN ('in_stock','in_use','loaned','under_repair','disposed','lost')),
        from_custodian_user_id TEXT REFERENCES users(id),
        to_custodian_user_id TEXT REFERENCES users(id),
        from_location TEXT, to_location TEXT, reason TEXT,
        created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
      );
      INSERT INTO mt_tooling_movements_legacy SELECT * FROM mt_tooling_movements;
      DROP TABLE mt_tooling_movements;
      ALTER TABLE mt_tooling_movements_legacy RENAME TO mt_tooling_movements;
      CREATE INDEX legacy_tooling_movement_created_at ON mt_tooling_movements(created_at);
    \`);
    database.pragma('foreign_keys = ON');
    ensureMaterialsToolingSchema(database);
    assert.deepEqual(database.prepare('SELECT id,movement_type FROM mt_tooling_movements').all(), [
      { id: 'legacy-issue', movement_type: 'issue' },
    ]);
    database.prepare(\`INSERT INTO mt_tooling_movements
      (id,asset_id,document_id,movement_type,to_status,to_custodian_user_id,to_location,created_by,created_at)
      VALUES ('new-loan','asset','loan-doc','loan','loaned','user','Customer site','user','x')\`).run();
    assert.equal(database.prepare("SELECT movement_type FROM mt_tooling_movements WHERE id='new-loan'").get().movement_type, 'loan');
    assert.deepEqual(database.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='mt_tooling_movements' AND sql IS NOT NULL ORDER BY name",
    ).all().map((row: any) => row.name), [
      'idx_mt_tooling_movements_asset', 'idx_mt_tooling_movements_document',
      'legacy_tooling_movement_created_at',
    ]);
    assert.deepEqual(database.pragma('foreign_key_check'), []);
    database.close();
  `);
  try {
    assert.equal(execFileSync(tsx, [runner], { cwd: root, encoding: 'utf8', stdio: 'pipe' }), '');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
