import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const files = [
  '../src/components/shared/ActivityTimeline.tsx',
  '../src/components/shared/MeetingNotes.tsx',
  '../src/components/shared/TaskSection.tsx',
];

const combinedSource = files
  .map(path => readFileSync(new URL(path, import.meta.url), 'utf8'))
  .join('\n')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\/[^\n]*/g, '');

const dictionarySource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');
const meetingNotesSource = readFileSync(new URL('../src/components/shared/MeetingNotes.tsx', import.meta.url), 'utf8');
const quotationEditSource = readFileSync(new URL('../src/components/quotations/QuotationEditPanel.tsx', import.meta.url), 'utf8');
const taskSectionSource = readFileSync(new URL('../src/components/shared/TaskSection.tsx', import.meta.url), 'utf8');
const inquiryDetailSource = readFileSync(new URL('../src/pages/InquiryDetail.tsx', import.meta.url), 'utf8');
const shipmentDetailSource = readFileSync(new URL('../src/pages/ShipmentDetail.tsx', import.meta.url), 'utf8');
const companyDetailSource = readFileSync(new URL('../src/pages/CompanyDetail.tsx', import.meta.url), 'utf8');

test('inquiry detail and shared tasks use consistent icon interactions', () => {
  assert.match(inquiryDetailSource, /className="page-header mb-0/);
  assert.match(inquiryDetailSource, /className="page-heading/);
  assert.match(inquiryDetailSource, /className="page-actions/);
  assert.match(inquiryDetailSource, /<Icon name="back"/);
  assert.match(inquiryDetailSource, /<Icon name="chevron-down"/);
  assert.match(inquiryDetailSource, /<Icon name="more"/);
  assert.doesNotMatch(inquiryDetailSource, />⋮</);
  assert.doesNotMatch(inquiryDetailSource, />\s*▼\s*</);

  assert.match(taskSectionSource, /<Icon name="check"/);
  assert.match(taskSectionSource, /<Icon name="close"/);
  assert.match(taskSectionSource, /<Icon name="plus"/);
  assert.match(taskSectionSource, /className=\{`size-4/);
  assert.match(taskSectionSource, /aria-label=/);
  assert.doesNotMatch(taskSectionSource, />✓</);
  assert.doesNotMatch(taskSectionSource, />✕</);
});

test('inquiry and shipment detail overlays use the shared restrained surfaces', () => {
  for (const detailSource of [inquiryDetailSource, shipmentDetailSource]) {
    assert.match(detailSource, /menu-surface/);
    assert.match(detailSource, /<SidePanel/);
    assert.doesNotMatch(detailSource, /rounded-xl|shadow-lg|shadow-md/);
  }
});

test('company and inquiry details use layout-shaped accessible loading states', () => {
  assert.match(companyDetailSource, /function CompanyDetailSkeleton/);
  assert.match(companyDetailSource, /if \(!company\) return <CompanyDetailSkeleton label=\{t\('common\.loading'\)\} \/>/);
  assert.match(companyDetailSource, /role="status"/);
  assert.match(companyDetailSource, /motion-reduce:animate-none/);
  assert.match(companyDetailSource, /lg:grid-cols-\[minmax\(/);

  assert.match(inquiryDetailSource, /function InquiryDetailSkeleton/);
  assert.match(inquiryDetailSource, /if \(!inquiry\) return <InquiryDetailSkeleton label=\{t\('common\.loading'\)\} \/>/);
  assert.match(inquiryDetailSource, /role="status"/);
  assert.match(inquiryDetailSource, /motion-reduce:animate-none/);
  assert.match(inquiryDetailSource, /lg:grid-cols-3/);

  for (const detailSource of [companyDetailSource, inquiryDetailSource]) {
    assert.doesNotMatch(detailSource, /return <div className="p-6 text-gray-400">\{t\('common\.loading'\)\}<\/div>/);
  }
});

test('company detail uses a responsive two-column single-scroll workspace', () => {
  assert.doesNotMatch(companyDetailSource, /import ResponsiveWorkspace/);
  assert.doesNotMatch(companyDetailSource, /<ResponsiveWorkspace/);
  assert.match(companyDetailSource, /className="flex-1 overflow-y-auto bg-gray-50"/);
  assert.match(companyDetailSource, /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(18rem,22rem\)\]/);
  assert.match(companyDetailSource, /className="order-1 min-w-0 space-y-6"/);
  assert.doesNotMatch(companyDetailSource, /max-w-3xl/);
});

test('quotation and meeting editors use grouped responsive panel forms', () => {
  for (const editorSource of [quotationEditSource, meetingNotesSource]) {
    assert.match(editorSource, /<fieldset/);
    assert.match(editorSource, /<legend/);
    assert.match(editorSource, /sm:grid-cols-2/);
    assert.match(editorSource, /sticky bottom-0/);
  }

  assert.match(quotationEditSource, /w-\[min\(560px,calc\(100vw-1rem\)\)\]/);
  assert.match(quotationEditSource, /<Icon name="delete"/);
  assert.doesNotMatch(quotationEditSource, />✕</);
  assert.match(meetingNotesSource, /disabled=\{saving\}/);
  assert.match(meetingNotesSource, /className="data-surface/);
});

test('shared activity, meeting, and task components no longer render obvious hard-coded English UI labels', () => {
  const forbidden = [
    /Failed to log activity/,
    /Failed to add task/,
    /Failed to update task/,
    /Failed to save meeting notes/,
    />Note</,
    />Call</,
    />Email</,
    />Meeting</,
    /Type a note/,
    /Schedule a follow-up/,
    /Remind yourself/,
    />Schedule</,
    /No activity yet/,
    /Log your first interaction/,
    /Overdue:/,
    /Due:/,
    /Add a task/,
    />Add</,
    /Add Task/,
    /Meeting Notes/,
    /View past meetings/,
    /Meeting Purpose/,
    /Discussion Points/,
    /Decisions Made/,
    /Action Items/,
    /Schedule Follow-up/,
    /Save Meeting Notes/,
    /Past Meetings/,
    /New Meeting Notes/,
    /No past meetings recorded/,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(combinedSource, pattern);
  }
});

test('shared localization batch has dictionary entries for activities, meetings, and tasks', () => {
  const requiredKeys = [
    'activityLogFailed', 'note', 'call', 'meeting', 'typeNote',
    'scheduleFollowUp', 'followUpHelp', 'noActivityYet', 'logFirstInteraction',
    'taskAddFailed', 'taskUpdateFailed', 'dueSoon', 'addTask',
    'meetingNotes', 'viewPastMeetings', 'meetingPurpose', 'discussionPoints',
    'decisionsMade', 'actionItems', 'saveMeetingNotes', 'pastMeetings',
    'newMeetingNotes', 'noPastMeetings', 'meetingSaveFailed',
  ];

  for (const key of requiredKeys) {
    assert.match(dictionarySource, new RegExp(`${key}:`));
  }
});
