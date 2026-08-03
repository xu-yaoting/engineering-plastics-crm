import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const panelSource = readFileSync(
  new URL('../src/components/companies/FollowUpPanel.tsx', import.meta.url),
  'utf8',
);
const planSource = readFileSync(new URL('../PLANS.md', import.meta.url), 'utf8');

test('follow-up panel submits one typed company workflow instead of separate activity and task writes', () => {
  assert.match(panelSource, /import SidePanel from '\.\.\/shared\/SidePanel'/);
  assert.match(panelSource, /followUps\.record\(\{/);
  assert.match(panelSource, /company_id: company\.id/);
  assert.match(panelSource, /current_task_id: completeCurrentTask \? currentTask\?\.id : undefined/);
  assert.match(panelSource, /next_task: scheduleNext/);
  assert.match(panelSource, /onSaved\(result\)/);
  assert.doesNotMatch(panelSource, /activitiesApi\.create|tasksApi\.create/);
});

test('follow-up panel exposes labeled fields and native required validation', () => {
  for (const fieldId of [
    'follow-up-contact',
    'follow-up-activity-type',
    'follow-up-direction',
    'follow-up-outcome',
    'follow-up-stage',
    'follow-up-subject',
    'follow-up-notes',
    'follow-up-complete-current',
    'follow-up-schedule-next',
    'follow-up-next-subject',
    'follow-up-due-date',
    'follow-up-due-time',
    'follow-up-priority',
    'follow-up-assignee',
  ]) {
    assert.match(panelSource, new RegExp(`htmlFor="${fieldId}"`));
    assert.match(panelSource, new RegExp(`id="${fieldId}"`));
  }
  assert.match(panelSource, /<form onSubmit=\{submit\}/);
  assert.match(panelSource, /id="follow-up-subject"[\s\S]*required/);
  assert.match(panelSource, /id="follow-up-next-subject"[\s\S]*required/);
  assert.match(panelSource, /id="follow-up-due-date"[\s\S]*required/);
});

test('follow-up panel protects in-flight submission and surfaces API errors', () => {
  assert.match(panelSource, /if \(saving\) return/);
  assert.match(panelSource, /disabled=\{saving\}/);
  assert.match(panelSource, /e instanceof Error \? e\.message/);
  assert.match(panelSource, /saving\s*\?\s*t\('page\.customerDevelopment\.saving'\)/);
});

test('customer development plan records completed backend, contract, and shared-panel batches', () => {
  for (const item of [
    'Add transactional follow-up read/write contracts and Inquiry-driven conversion.',
    'Add typed frontend contracts and bilingual customer-development copy.',
    'Build one reusable follow-up recording panel.',
  ]) {
    assert.match(planSource, new RegExp(`\\[x\\] ${item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  }
});
