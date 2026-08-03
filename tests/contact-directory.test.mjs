import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';

const root = fileURLToPath(new URL('..', import.meta.url));
const tsx = path.join(root, 'node_modules', '.bin', 'tsx');
const databaseModuleUrl = pathToFileURL(path.join(root, 'server', 'db.ts')).href;
const dbSource = readFileSync(new URL('../server/db.ts', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../server/routes/contacts.ts', import.meta.url), 'utf8');
const panelSource = readFileSync(new URL('../src/components/contacts/ContactPanel.tsx', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../src/pages/Contacts.tsx', import.meta.url), 'utf8');
const i18nSource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');
const sidebarSource = readFileSync(new URL('../src/components/layout/Sidebar.tsx', import.meta.url), 'utf8');

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(error => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
    server.on('error', reject);
  });
}

async function createContactFixture() {
  const directory = mkdtempSync(path.join(tmpdir(), 'contact-directory-api-'));
  const databasePath = path.join(directory, 'crm.db');
  execFileSync(tsx, ['-e', `import database from ${JSON.stringify(databaseModuleUrl)}; database.close();`], {
    cwd: root,
    env: { ...process.env, CRM_DB_PATH: databasePath },
    stdio: 'pipe',
  });

  const token = randomUUID();
  const userId = randomUUID();
  const companyId = randomUUID();
  const database = new Database(databasePath);
  database.prepare(`
    INSERT INTO users (id, name, token, role, is_active)
    VALUES (?, 'Contact API Tester', ?, 'admin', 1)
  `).run(userId, token);
  database.prepare(`
    INSERT INTO companies (id, name, phone, email, created_by, updated_by)
    VALUES (?, 'Company Contact Fixture', '+1 555 0100', 'office@example.test', ?, ?)
  `).run(companyId, userId, userId);
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
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Test API exited with code ${child.exitCode}`);
    try {
      const health = await fetch(`${baseUrl}/health`);
      if (health.ok) break;
    } catch {
      if (attempt === 59) throw new Error('Test API did not become healthy');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return {
    companyId,
    request: async (pathname, options = {}) => {
      const response = await fetch(`${baseUrl}${pathname}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      return {
        status: response.status,
        body: response.status === 204 ? null : await response.json(),
      };
    },
    close: async () => {
      child.kill('SIGTERM');
      await new Promise(resolve => {
        if (child.exitCode !== null) resolve();
        else child.once('exit', resolve);
      });
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

test('contacts add WeChat through an additive migration', () => {
  assert.match(dbSource, /wechat_id TEXT/);
  assert.match(dbSource, /migrate\("ALTER TABLE contacts ADD COLUMN wechat_id TEXT"\)/);
  assert.match(routeSource, /'wechat_id'/);
});

test('contact reads expose company country and search all practical contact methods', () => {
  assert.match(routeSource, /co\.country as company_country/);
  for (const field of ['c.phone_direct', 'c.phone_mobile', 'c.wechat_id']) {
    assert.match(routeSource, new RegExp(field.replace('.', '\\.')));
  }
});

test('contact API allows a company role without direct contact details', async () => {
  const fixture = await createContactFixture();
  try {
    const created = await fixture.request('/contacts', {
      method: 'POST',
      body: JSON.stringify({
        company_id: fixture.companyId,
        first_name: 'Taylor',
        last_name: 'Buyer',
        role_in_process: 'procurement',
      }),
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.company_id, fixture.companyId);
    assert.equal(created.body.email || '', '');

    const listed = await fixture.request('/contacts');
    assert.equal(listed.status, 200);
    const listedContact = listed.body.find(contact => contact.id === created.body.id);
    assert.equal(listedContact.company_phone, '+1 555 0100');
    assert.equal(listedContact.company_email, 'office@example.test');

    const updated = await fixture.request(`/contacts/${created.body.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        email: '',
        phone_direct: '',
        phone_mobile: '',
        wechat_id: '',
      }),
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.id, created.body.id);
  } finally {
    await fixture.close();
  }
});

test('contact panel treats all direct contact details as optional', () => {
  assert.match(panelSource, /wechat_id/);
  assert.doesNotMatch(panelSource, /if \(!form\.email\)/);
  assert.doesNotMatch(panelSource, /hasContactMethod/);
  assert.doesNotMatch(panelSource, /contactMethodRequired/);
  assert.match(i18nSource, /wechat:/);
});

test('contact directory emphasizes people, roles, and contact channels', () => {
  assert.match(pageSource, /<table/);
  assert.match(pageSource, /contacts-search/);
  assert.match(pageSource, /contacts-company-filter/);
  assert.match(pageSource, /job_title/);
  assert.match(pageSource, /role_in_process/);
  assert.match(pageSource, /wechat_id/);
  assert.match(pageSource, /hidden[^"]*md:table-cell/);
  assert.doesNotMatch(pageSource, /statusFilter/);
  assert.doesNotMatch(pageSource, /sortBy/);
  assert.doesNotMatch(pageSource, /contacts-status-filter/);
  assert.doesNotMatch(pageSource, /contacts-sort/);
  assert.doesNotMatch(pageSource, /StatusBadge/);
  assert.doesNotMatch(pageSource, /company_country/);
  assert.doesNotMatch(pageSource, /duplicate\(c\)/);
  assert.doesNotMatch(pageSource, /grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4/);
});

test('contact directory visibly falls back to company public contact details', () => {
  assert.match(pageSource, /c\.phone_mobile \|\| c\.phone_direct \|\| c\.company_phone/);
  assert.match(pageSource, /c\.email \|\| c\.company_email/);
  assert.match(pageSource, /phoneFromCompany/);
  assert.match(pageSource, /emailFromCompany/);
  assert.match(pageSource, /t\('page\.contacts\.company'\)/);
});

test('contact directory does not render numeric zero for absent role flags', () => {
  assert.match(pageSource, /Boolean\(c\.is_primary_contact\)/);
  assert.match(pageSource, /Boolean\(c\.is_decision_maker\)/);
  assert.doesNotMatch(pageSource, /\{\(c\.is_primary_contact \|\| c\.is_decision_maker\) &&/);
});

test('contacts live under the Company module instead of primary navigation', () => {
  assert.doesNotMatch(sidebarSource, /path: '\/contacts'/);
  assert.doesNotMatch(sidebarSource, /label: 'nav\.contacts'/);
  assert.doesNotMatch(sidebarSource, /'users': Users/);
});
