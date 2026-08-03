import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const activitySource = readFileSync(new URL('../src/components/shared/ActivityTimeline.tsx', import.meta.url), 'utf8');
const taskSource = readFileSync(new URL('../src/components/shared/TaskSection.tsx', import.meta.url), 'utf8');

test('activity timeline capture controls wrap into phone-friendly rows', () => {
  assert.match(activitySource, /className="flex flex-wrap items-center gap-1\.5 mb-3"/);
  assert.match(activitySource, /className="flex flex-col gap-2 mb-4 sm:flex-row"/);
  assert.match(activitySource, /className="[^\"]*flex flex-col[^\"]*sm:flex-row[^\"]*"/);
  assert.match(activitySource, /w-full sm:w-auto/);
  assert.match(activitySource, /break-words/);
});

test('task quick add keeps fields and actions usable on narrow screens', () => {
  assert.match(taskSource, /className="flex flex-col gap-2 sm:flex-row"/);
  assert.match(taskSource, /className="input w-full flex-1 text-sm"/);
  assert.match(taskSource, /className="btn-primary btn-sm flex-1 sm:flex-none"/);
  assert.match(taskSource, /className="input w-full text-xs"/);
  assert.match(taskSource, /break-words/);
});
