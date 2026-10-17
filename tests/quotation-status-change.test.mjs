import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/pages/QuotationDetail.tsx', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('QuotationDetail.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'changeStatus') handler = node.initializer;
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.ok(handler, 'Quotation status handler is missing');
const compiled = ts.transpileModule(`module.exports = ${handler.getText(parsed)};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
}).outputText;

function statusFixture({ updateFails = false, activityFails = false, busy = false } = {}) {
  const calls = { updates: [], activities: [], loads: 0, menus: [], busy: [], errors: [] };
  const module = { exports: {} };
  runInNewContext(compiled, {
    module, id: 'fixture-quotation', changingStatus: busy, savingApproval: false,
    statusOptions: [{ value: 'sent', label: 'Sent' }],
    t: key => key,
    setChangingStatus: value => calls.busy.push(value),
    setShowStatusMenu: value => calls.menus.push(value),
    load: () => { calls.loads += 1; },
    toast: { error: message => calls.errors.push(message) },
    quotations: { update: async (id, payload) => { calls.updates.push({ id, payload }); if (updateFails) throw new Error('Quotation update failed'); } },
    activities: { create: async payload => { calls.activities.push(payload); if (activityFails) throw new Error('Activity logging failed'); } },
  });
  return { action: module.exports, calls };
}

test('successful quotation status changes reload the page and record the activity', async () => {
  const fixture = statusFixture();
  await fixture.action('sent');
  assert.equal(fixture.calls.updates.length, 1);
  assert.equal(fixture.calls.updates[0].id, 'fixture-quotation');
  assert.equal(fixture.calls.updates[0].payload.status, 'sent');
  assert.equal(fixture.calls.activities.length, 1);
  assert.equal(fixture.calls.activities[0].subject, 'page.quotationDetail.statusChanged');
  assert.deepEqual(fixture.calls.menus, [false]);
  assert.equal(fixture.calls.loads, 1);
  assert.deepEqual(fixture.calls.errors, []);
  assert.deepEqual(fixture.calls.busy, [true, false]);
});

test('activity logging failure does not report a saved status as failed or leave stale page data', async () => {
  const fixture = statusFixture({ activityFails: true });
  await fixture.action('sent');
  assert.equal(fixture.calls.updates.length, 1);
  assert.equal(fixture.calls.activities.length, 1);
  assert.deepEqual(fixture.calls.menus, [false]);
  assert.equal(fixture.calls.loads, 1);
  assert.deepEqual(fixture.calls.errors, ['page.activityTimeline.activityLogFailed']);
  assert.deepEqual(fixture.calls.busy, [true, false]);
});

test('quotation update failure keeps the status menu open and does not write an activity', async () => {
  const fixture = statusFixture({ updateFails: true });
  await fixture.action('sent');
  assert.equal(fixture.calls.updates.length, 1);
  assert.equal(fixture.calls.activities.length, 0);
  assert.deepEqual(fixture.calls.menus, []);
  assert.equal(fixture.calls.loads, 0);
  assert.deepEqual(fixture.calls.errors, ['page.quotationDetail.statusChangeFailed']);
  assert.deepEqual(fixture.calls.busy, [true, false]);
});

test('a pending status change ignores duplicate calls', async () => {
  const fixture = statusFixture({ busy: true });
  await fixture.action('sent');
  assert.deepEqual(fixture.calls.updates, []);
  assert.deepEqual(fixture.calls.activities, []);
  assert.deepEqual(fixture.calls.busy, []);
});
