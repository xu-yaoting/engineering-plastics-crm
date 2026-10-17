import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const meetingSource = readFileSync(new URL('../src/components/shared/MeetingNotes.tsx', import.meta.url), 'utf8');

test('meeting note sticky actions stack without hiding the cancel action', () => {
  assert.match(meetingSource, /className="sticky bottom-0 z-10 -mx-5 flex flex-col gap-2 border-t border-border bg-surface px-5 py-4 sm:flex-row"/);
  assert.match(meetingSource, /className="btn-primary w-full sm:flex-1"/);
  assert.match(meetingSource, /className="btn-secondary w-full sm:w-auto"/);
});
