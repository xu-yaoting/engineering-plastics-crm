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
