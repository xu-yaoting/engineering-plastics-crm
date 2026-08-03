import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = relativePath =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const meetingNotesSource = readSource('src/components/shared/MeetingNotes.tsx');
const materialsSettingsSource = readSource('src/components/materials-tooling/MaterialsSettings.tsx');
const contactsSource = readSource('src/pages/Contacts.tsx');
const quotationsSource = readSource('src/pages/Quotations.tsx');
const documentsTabSource = readSource('src/components/materials-tooling/DocumentsTab.tsx');
const ledgerTabSource = readSource('src/components/materials-tooling/LedgerTab.tsx');
const activityTimelineSource = readSource('src/components/shared/ActivityTimeline.tsx');
const emailDraftSource = readSource('src/components/shared/EmailDraftPanel.tsx');
const inquiriesSource = readSource('src/pages/Inquiries.tsx');
const orderDetailSource = readSource('src/pages/OrderDetail.tsx');
const ordersSource = readSource('src/pages/Orders.tsx');
const topBarSource = readSource('src/components/layout/TopBar.tsx');
const approvalsTabSource = readSource('src/components/materials-tooling/ApprovalsTab.tsx');
const taskSectionSource = readSource('src/components/shared/TaskSection.tsx');
const activitiesSource = readSource('src/pages/Activities.tsx');
const paymentsSource = readSource('src/pages/Payments.tsx');
const pipelineSource = readSource('src/pages/Pipeline.tsx');
const shipmentsSource = readSource('src/pages/Shipments.tsx');

function assertStaticLabelPairs(source, fieldIds) {
  for (const fieldId of fieldIds) {
    assert.match(source, new RegExp(`htmlFor="${fieldId}"`));
    assert.match(source, new RegExp(`id="${fieldId}"`));
  }
}

test('meeting note controls have persistent labels', () => {
  assertStaticLabelPairs(meetingNotesSource, [
    'meeting-notes-purpose',
    'meeting-notes-attendees',
    'meeting-notes-discussion',
    'meeting-notes-decisions',
    'meeting-notes-action-items',
    'meeting-notes-follow-up',
    'meeting-notes-follow-up-date',
  ]);
});

test('meeting note form leaves room above its sticky mobile actions', () => {
  assert.match(meetingNotesSource, /className="space-y-5 pb-20 sm:pb-0"/);
  assert.match(meetingNotesSource, /className="sticky bottom-0 z-10 -mx-5/);
});

test('materials settings table controls have row-specific labels', () => {
  for (const suffix of ['manage-materials', 'approve', 'view-prices', 'manage-periods']) {
    assert.match(materialsSettingsSource, new RegExp(
      `htmlFor=\\{\`materials-settings-\\$\\{user\\.id\\}-${suffix}\`\\}`,
    ));
    assert.match(materialsSettingsSource, new RegExp(
      `id=\\{\`materials-settings-\\$\\{user\\.id\\}-${suffix}\`\\}`,
    ));
  }
  assert.match(materialsSettingsSource, /htmlFor=\{`materials-settings-approver-\$\{docType\}`\}/);
  assert.match(materialsSettingsSource, /id=\{`materials-settings-approver-\$\{docType\}`\}/);
});

test('contact directory search and company filter have persistent labels', () => {
  assertStaticLabelPairs(contactsSource, [
    'contacts-search',
    'contacts-company-filter',
  ]);
});

test('quotation list search, status, and sorting have persistent labels', () => {
  assertStaticLabelPairs(quotationsSource, [
    'quotations-search',
    'quotations-status-filter',
    'quotations-sort',
  ]);
});

test('quotation list reflows to compact mobile cards before the wide table', () => {
  assert.match(quotationsSource, /className="space-y-2 md:hidden"/);
  assert.match(quotationsSource, /className="hidden data-surface overflow-x-auto md:block"/);
});

test('material document and ledger toolbar controls have persistent labels', () => {
  assertStaticLabelPairs(documentsTabSource, [
    'materials-documents-type-filter',
    'materials-documents-status-filter',
  ]);
  assertStaticLabelPairs(ledgerTabSource, [
    'materials-ledger-month',
    'materials-ledger-search',
  ]);
});

test('activity capture and follow-up controls have persistent labels', () => {
  assertStaticLabelPairs(activityTimelineSource, [
    'activity-timeline-note',
    'activity-timeline-follow-up-date',
  ]);
});

test('email draft variable and body controls have persistent labels', () => {
  assert.match(emailDraftSource, /htmlFor=\{`email-draft-variable-\$\{v\}`\}/);
  assert.match(emailDraftSource, /id=\{`email-draft-variable-\$\{v\}`\}/);
  assertStaticLabelPairs(emailDraftSource, ['email-draft-body']);
});

test('inquiry list search and status filter have persistent labels', () => {
  assertStaticLabelPairs(inquiriesSource, [
    'inquiries-search',
    'inquiries-status-filter',
  ]);
});

test('inquiry list reflows to compact mobile cards before the wide table', () => {
  assert.match(inquiriesSource, /className="space-y-2 md:hidden"/);
  assert.match(inquiriesSource, /className="hidden data-surface overflow-x-auto md:block"/);
});

test('order line shipped quantity and unit controls have row-specific labels', () => {
  for (const suffix of ['shipped-quantity', 'unit']) {
    assert.match(orderDetailSource, new RegExp(
      `htmlFor=\\{\`order-line-\\$\\{item\\.id\\}-${suffix}\`\\}`,
    ));
    assert.match(orderDetailSource, new RegExp(
      `id=\\{\`order-line-\\$\\{item\\.id\\}-${suffix}\`\\}`,
    ));
  }
});

test('order list search and sorting have persistent labels', () => {
  assertStaticLabelPairs(ordersSource, [
    'orders-search',
    'orders-sort',
  ]);
});

test('order list reflows to compact mobile cards before the wide table', () => {
  assert.match(ordersSource, /className="space-y-2 md:hidden"/);
  assert.match(ordersSource, /className="hidden data-surface overflow-x-auto md:block"/);
});

test('shipment list reflows to compact mobile cards before the wide table', () => {
  assert.match(shipmentsSource, /className="space-y-2 md:hidden"/);
  assert.match(shipmentsSource, /className="hidden data-surface overflow-x-auto md:block"/);
});

test('top bar global search has a persistent label', () => {
  assertStaticLabelPairs(topBarSource, ['top-bar-search']);
});

test('approval rejection reason has a record-specific label', () => {
  assert.match(approvalsTabSource, /htmlFor=\{`approval-reject-reason-\$\{doc\.id\}`\}/);
  assert.match(approvalsTabSource, /id=\{`approval-reject-reason-\$\{doc\.id\}`\}/);
});

test('task quick-add subject has a persistent label', () => {
  assertStaticLabelPairs(taskSectionSource, ['task-section-subject']);
});

test('activity and payment searches have persistent labels', () => {
  assertStaticLabelPairs(activitiesSource, ['activities-search']);
  assertStaticLabelPairs(paymentsSource, ['payments-search']);
});

test('pipeline owner filter and shipment search have persistent labels', () => {
  assertStaticLabelPairs(pipelineSource, ['pipeline-owner-filter']);
  assertStaticLabelPairs(shipmentsSource, ['shipments-search']);
});
