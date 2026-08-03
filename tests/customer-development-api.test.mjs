import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';

const root = fileURLToPath(new URL('..', import.meta.url));
const tsx = path.join(root, 'node_modules', '.bin', 'tsx');
const databaseModuleUrl = pathToFileURL(path.join(root, 'server', 'db.ts')).href;

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
    server.on('error', reject);
  });
}

async function waitForHealth(baseUrl, child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Test API exited early with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error('Test API did not become healthy');
}

async function createFixture() {
  const directory = mkdtempSync(path.join(tmpdir(), 'customer-development-api-'));
  const databasePath = path.join(directory, 'crm.db');
  execFileSync(tsx, ['-e', `import database from ${JSON.stringify(databaseModuleUrl)}; database.close();`], {
    cwd: root,
    env: { ...process.env, CRM_DB_PATH: databasePath },
    stdio: 'pipe',
  });

  const token = randomUUID();
  const userId = randomUUID();
  const companyId = randomUUID();
  const otherCompanyId = randomUUID();
  const contactId = randomUUID();
  const otherContactId = randomUUID();
  const currentTaskId = randomUUID();
  const database = new Database(databasePath);
  database.prepare(`
    INSERT INTO users (id, name, token, role, is_active)
    VALUES (?, 'Development API Tester', ?, 'admin', 1)
  `).run(userId, token);
  database.prepare(`
    INSERT INTO companies (
      id, name, country, development_stage, owner_user_id, created_by, updated_by
    ) VALUES (?, ?, 'US', 'uncontacted', ?, ?, ?)
  `).run(companyId, 'Acme Development Fixture', userId, userId, userId);
  database.prepare(`
    INSERT INTO companies (
      id, name, country, development_stage, owner_user_id, created_by, updated_by
    ) VALUES (?, ?, 'US', 'uncontacted', ?, ?, ?)
  `).run(otherCompanyId, 'Other Development Fixture', userId, userId, userId);
  database.prepare(`
    INSERT INTO contacts (
      id, company_id, first_name, last_name, email, is_primary_contact
    ) VALUES (?, ?, 'Alex', 'Buyer', 'alex@example.test', 1)
  `).run(contactId, companyId);
  database.prepare(`
    INSERT INTO contacts (
      id, company_id, first_name, last_name, email
    ) VALUES (?, ?, 'Other', 'Buyer', 'other@example.test')
  `).run(otherContactId, otherCompanyId);
  database.prepare(`
    INSERT INTO tasks (
      id, subject, task_type, priority, status, due_date, entity_type, entity_id,
      contact_id, assigned_to_user_id, created_by, updated_by
    ) VALUES (?, 'Send first development email', 'follow_up', 'medium', 'pending',
      '2026-07-29', 'company', ?, ?, ?, ?, ?)
  `).run(currentTaskId, companyId, contactId, userId, userId, userId);
  database.close();

  const port = await reservePort();
  const child = spawn(tsx, ['server/index.ts'], {
    cwd: root,
    env: {
      ...process.env,
      CRM_DB_PATH: databasePath,
      HOST: '127.0.0.1',
      PORT: String(port),
    },
    stdio: 'pipe',
  });
  const baseUrl = `http://127.0.0.1:${port}/api`;
  await waitForHealth(baseUrl, child);

  async function request(pathname, options = {}) {
    const response = await fetch(`${baseUrl}${pathname}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    const body = response.status === 204 ? null : await response.json();
    return { status: response.status, body };
  }

  return {
    companyId,
    contactId,
    currentTaskId,
    otherContactId,
    request,
    close: async () => {
      child.kill('SIGTERM');
      await new Promise((resolve) => {
        if (child.exitCode !== null) resolve();
        else child.once('exit', resolve);
      });
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

test('follow-up API records the activity and next action as one company workflow', async () => {
  const fixture = await createFixture();
  try {
    const nextFollowUpDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const response = await fixture.request('/activities/follow-ups', {
      method: 'POST',
      body: JSON.stringify({
        company_id: fixture.companyId,
        contact_id: fixture.contactId,
        activity_type: 'email',
        subject: 'Development email sent',
        description: 'Shared the material capability overview.',
        direction: 'outbound',
        outcome: 'no_response',
        development_stage: 'contacted',
        current_task_id: fixture.currentTaskId,
        next_task: {
          subject: 'Follow up after development email',
          due_date: nextFollowUpDate,
          priority: 'high',
        },
      }),
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.activity.entity_id, fixture.companyId);
    assert.equal(response.body.activity.outcome, 'no_response');
    assert.equal(response.body.completed_task.status, 'completed');
    assert.equal(response.body.next_task.entity_id, fixture.companyId);
    assert.equal(response.body.next_task.contact_id, fixture.contactId);
    assert.equal(response.body.company.development_stage, 'contacted');

    const workbench = await fixture.request('/activities/follow-ups?bucket=upcoming');
    assert.equal(workbench.status, 200);
    assert.equal(workbench.body.length, 1);
    assert.equal(workbench.body[0].company_id, fixture.companyId);
    assert.equal(workbench.body[0].next_follow_up_due_date, nextFollowUpDate);
    assert.equal(workbench.body[0].last_outcome, 'no_response');
  } finally {
    await fixture.close();
  }
});

test('follow-up API rejects a contact from another company without partial writes', async () => {
  const fixture = await createFixture();
  try {
    const rejected = await fixture.request('/activities/follow-ups', {
      method: 'POST',
      body: JSON.stringify({
        company_id: fixture.companyId,
        contact_id: fixture.otherContactId,
        activity_type: 'call',
        subject: 'Invalid cross-company follow-up',
        development_stage: 'contacted',
        current_task_id: fixture.currentTaskId,
        next_task: {
          subject: 'Must not be created',
          due_date: '2026-08-07',
        },
      }),
    });
    assert.equal(rejected.status, 400);

    const activities = await fixture.request(
      `/activities?entity_type=company&entity_id=${fixture.companyId}`,
    );
    assert.equal(activities.body.length, 0);
    const tasks = await fixture.request(
      `/tasks?entity_type=company&entity_id=${fixture.companyId}`,
    );
    assert.equal(tasks.body.length, 1);
    assert.equal(tasks.body[0].id, fixture.currentTaskId);
    assert.equal(tasks.body[0].status, 'pending');
  } finally {
    await fixture.close();
  }
});

test('creating an inquiry converts the company development stage', async () => {
  const fixture = await createFixture();
  try {
    const inquiry = await fixture.request('/inquiries', {
      method: 'POST',
      body: JSON.stringify({
        company_id: fixture.companyId,
        contact_id: fixture.contactId,
        source: 'email',
        application_description: 'Evaluate PPSU for a sterilizable component.',
      }),
    });
    assert.equal(inquiry.status, 201);

    const company = await fixture.request(`/companies/${fixture.companyId}`);
    assert.equal(company.status, 200);
    assert.equal(company.body.development_stage, 'converted');
  } finally {
    await fixture.close();
  }
});
