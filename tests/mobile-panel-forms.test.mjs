import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const emailSource = readFileSync(new URL('../src/components/shared/EmailDraftPanel.tsx', import.meta.url), 'utf8');
const meetingSource = readFileSync(new URL('../src/components/shared/MeetingNotes.tsx', import.meta.url), 'utf8');

test('email draft variables and actions reflow inside a phone-width side panel', () => {
  assert.match(emailSource, /className="grid grid-cols-1 gap-2 sm:grid-cols-2"/);
  assert.match(emailSource, /sm:col-span-2/);
  assert.match(emailSource, /className="input w-full text-xs mt-0\.5"/);
  assert.match(emailSource, /className="flex flex-col gap-2 pt-2 border-t border-gray-100 sm:flex-row"/);
  assert.match(emailSource, /className="btn-primary w-full sm:flex-1 text-sm"/);
  assert.match(emailSource, /className="btn-secondary w-full sm:w-auto text-sm"/);
});

test('meeting note sticky actions stack without hiding the cancel action', () => {
  assert.match(meetingSource, /className="sticky bottom-0 z-10 -mx-5 flex flex-col gap-2 border-t border-gray-200 bg-white px-5 py-4 sm:flex-row"/);
  assert.match(meetingSource, /className="btn-primary w-full sm:flex-1"/);
  assert.match(meetingSource, /className="btn-secondary w-full sm:w-auto"/);
});
