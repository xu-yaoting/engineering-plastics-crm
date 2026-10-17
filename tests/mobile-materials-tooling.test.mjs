import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ledgerSource = readFileSync(new URL('../src/components/materials-tooling/LedgerTab.tsx', import.meta.url), 'utf8');
const approvalsSource = readFileSync(new URL('../src/components/materials-tooling/ApprovalsTab.tsx', import.meta.url), 'utf8');

test('ledger provides readable mobile cards alongside the desktop ledger table', () => {
  assert.match(ledgerSource, /className="space-y-2 md:hidden"/);
  assert.match(ledgerSource, /className="hidden data-surface overflow-x-auto border-t-0 rounded-t-none md:block"/);
  assert.match(ledgerSource, /openingQty/);
  assert.match(ledgerSource, /closingQty/);
});

test('approvals provides mobile queue cards with the same review actions', () => {
  assert.match(approvalsSource, /className="space-y-2 md:hidden"/);
  assert.match(approvalsSource, /className="hidden data-surface overflow-x-auto md:block"/);
  assert.match(approvalsSource, /reviewDetails/);
  assert.match(approvalsSource, /approveAction/);
  assert.match(approvalsSource, /rejectAction/);
});
