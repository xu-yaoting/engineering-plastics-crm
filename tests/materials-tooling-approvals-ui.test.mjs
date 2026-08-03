import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const approvalsFile = new URL('../src/components/materials-tooling/ApprovalsTab.tsx', import.meta.url);
const settingsFile = new URL('../src/components/materials-tooling/MaterialsSettings.tsx', import.meta.url);

const approvalsSource = readFileSync(approvalsFile, 'utf8');
const settingsSource = readFileSync(settingsFile, 'utf8');

const renderedApprovals = approvalsSource.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/[^\n]*/g, '');
const renderedSettings = settingsSource.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/[^\n]*/g, '');

test('ApprovalsTab uses data-surface with sticky headers', () => {
  assert.match(approvalsSource, /data-surface/);
  assert.match(approvalsSource, /sticky top-0 z-10/);
  assert.match(approvalsSource, /table-header/);
});

test('ApprovalsTab shows assigned queue (pending_approval documents)', () => {
  assert.match(approvalsSource, /pending_approval|pendingApproval/);
  assert.match(approvalsSource, /approve/);
  assert.match(approvalsSource, /reject/);
  assert.match(approvalsSource, /auth\.me/);
  assert.match(approvalsSource, /assigned_approver_user_id === currentUserId/);
});

test('ApprovalsTab has approve and reject with reason', () => {
  assert.match(approvalsSource, /approve|Approve|approved/);
  assert.match(approvalsSource, /reject|Reject|rejected/);
  assert.match(approvalsSource, /rejectReason/);
});

test('ApprovalsTab uses queue-specific labels instead of unrelated overview copy', () => {
  assert.match(approvalsSource, /assignedApprovalQueue/);
  assert.match(approvalsSource, /documentNumber/);
  assert.match(approvalsSource, /statusLabel/);
  assert.match(approvalsSource, /department/);
  assert.match(approvalsSource, /requestDate/);
  assert.doesNotMatch(approvalsSource, /materialsTooling\.overviewTab/);
  assert.doesNotMatch(approvalsSource, /materialsTooling\.sensitive\.restricted/);
});

test('ApprovalsTab lets the assigned approver inspect frozen details and PDF first', () => {
  assert.match(approvalsSource, /getDocument/);
  assert.match(approvalsSource, /downloadApplicationPdf/);
  assert.match(approvalsSource, /selected/);
  assert.match(approvalsSource, /tax_inclusive_unit_price/);
  assert.match(approvalsSource, /tooling_request/);
});

test('ApprovalsTab uses typed API client', () => {
  assert.match(approvalsSource, /materialsToolingApi/);
});

test('ApprovalsTab no hard-coded English copy', () => {
  const forbidden = [
    />Approve</, />Reject</, />Pending Approval</,
    />Approve Document</, />Reject Document</,
    />Reason</,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(renderedApprovals, pattern,
      `Hard-coded English in ApprovalsTab: ${pattern}`);
  }
});

test('MaterialsSettings uses data-surface layout', () => {
  assert.match(settingsSource, /data-surface/);
  assert.match(settingsSource, /table-header/);
});

test('MaterialsSettings has permission management section', () => {
  assert.match(settingsSource, /manage|permission/i);
  assert.match(settingsSource, /manageMaterials/);
  assert.match(settingsSource, /approve/);
  assert.match(settingsSource, /viewPrices/);
  assert.match(settingsSource, /managePeriods/);
});

test('MaterialsSettings uses exact permission and approval labels', () => {
  assert.match(settingsSource, /permissionsTitle/);
  assert.match(settingsSource, /manageMaterialsPermission/);
  assert.match(settingsSource, /approvePermission/);
  assert.match(settingsSource, /viewPricesPermission/);
  assert.match(settingsSource, /managePeriodsPermission/);
  assert.match(settingsSource, /approvalConfiguration/);
  assert.match(settingsSource, /selectApprover/);
  assert.doesNotMatch(settingsSource, /materialsTooling\.overviewTab/);
});

test('MaterialsSettings has approval config section', () => {
  assert.match(settingsSource, /approval|approver/i);
  assert.match(settingsSource, /document_type|documentType/);
});

test('MaterialsSettings uses typed API client', () => {
  assert.match(settingsSource, /materialsToolingApi/);
});

test('MaterialsSettings admin-only access (checks permissions)', () => {
  assert.match(settingsSource, /auth\.me/);
  assert.match(settingsSource, /role === 'admin'/);
  assert.doesNotMatch(settingsSource, /const isAdmin = permissions\?\.manageMaterials/);
});

test('MaterialsSettings reads the canonical approval configuration shape', () => {
  assert.match(settingsSource, /documentType === docType/);
  assert.match(settingsSource, /config\?\.approver\?\.id/);
  assert.doesNotMatch(settingsSource, /c\.document_type === docType/);
});

test('MaterialsSettings no hard-coded English copy', () => {
  const forbidden = [
    />Permissions</, />Approval Configuration</,
    />Manage Materials</, />View Prices</,
    />Manage Periods</, />Approve Documents</,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(renderedSettings, pattern,
      `Hard-coded English in MaterialsSettings: ${pattern}`);
  }
});
