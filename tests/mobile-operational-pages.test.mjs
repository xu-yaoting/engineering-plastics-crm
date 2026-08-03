import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const activitiesSource = readFileSync(new URL('../src/pages/Activities.tsx', import.meta.url), 'utf8');
const tasksSource = readFileSync(new URL('../src/pages/Tasks.tsx', import.meta.url), 'utf8');

test('activities and tasks reflow to readable mobile cards before desktop lists', () => {
  for (const pageSource of [activitiesSource, tasksSource]) {
    assert.match(pageSource, /className="space-y-2 p-3 md:hidden"/);
    assert.match(pageSource, /className="hidden md:block/);
  }
  assert.match(activitiesSource, /renderMobileActivity/);
  assert.match(tasksSource, /renderMobileTask/);
});

test('mobile activity and task cards keep their primary actions and empty states', () => {
  assert.match(activitiesSource, /setDeleteTarget\(a\)/);
  assert.match(activitiesSource, /t\('common\.delete'\)/);
  assert.match(tasksSource, /toggleStatus\(task\)/);
  assert.match(tasksSource, /tasks\.delete\(task\.id\)/);
  assert.match(tasksSource, /t\('noData\.tasks'\)/);
});
