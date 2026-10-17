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
    otherCompanyId,
    databasePath,
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

test('creating a quotation converts the company development stage', async () => {
  const fixture = await createFixture();
  try {
    const quotation = await fixture.request('/quotations', {
      method: 'POST',
      body: JSON.stringify({
        company_id: fixture.companyId,
        contact_id: fixture.contactId,
        source: 'email',
        application_description: 'Evaluate PPSU for a sterilizable component.',
        currency: 'USD',
        line_items: [{ product_grade_snapshot: 'PPSU Radel R-5000', unit_of_measure: 'kg', quantity: 1, unit_price: 100, line_total: 100 }],
      }),
    });
    assert.equal(quotation.status, 201);

    const company = await fixture.request(`/companies/${fixture.companyId}`);
    assert.equal(company.status, 200);
    assert.equal(company.body.development_stage, 'converted');
  } finally {
    await fixture.close();
  }
});

test('quotation creation persists notes and commercial fields through reload and audit', async () => {
  const fixture = await createFixture();
  try {
    const fields = {
      internal_notes: 'Anonymous customer requirement.\nKeep the agreed packaging.',
      incoterm: 'EXW',
      payment_term: 'Fixture payment condition',
      delivery_term: 'Fixture delivery condition',
      tax_type: 'domestic_vat',
      domestic_vat_rate: 13,
      export_tax_rebate_rate: 0,
      tax_amount: 13,
      shipping_handling: 8,
    };
    const created = await fixture.request('/quotations', {
      method: 'POST',
      body: JSON.stringify({
        company_id: fixture.companyId,
        contact_id: fixture.contactId,
        currency: 'CNY',
        subtotal: 100,
        total: 121,
        ...fields,
        line_items: [{ product_grade_snapshot: 'Fixture material', unit_of_measure: 'pc', quantity: 2, unit_price: 50, line_total: 100 }],
      }),
    });
    assert.equal(created.status, 201);
    const reloaded = await fixture.request(`/quotations/${created.body.id}`);
    assert.equal(reloaded.status, 200);
    const audit = await fixture.request(`/audit?entity_type=quotation&entity_id=${created.body.id}`);
    assert.equal(audit.status, 200);
    const creation = audit.body.find(event => event.action === 'create');
    assert.ok(creation);
    for (const [field, expected] of Object.entries(fields)) {
      assert.equal(created.body[field], expected, `Create response lost ${field}`);
      assert.equal(reloaded.body[field], expected, `Reload lost ${field}`);
      assert.equal(creation.changes[field].new, expected, `Create audit lost ${field}`);
    }
    assert.equal(reloaded.body.total, 121);
    assert.equal(reloaded.body.status, 'draft');
    assert.equal(reloaded.body.contact_id, fixture.contactId);
    assert.equal(reloaded.body.line_items.length, 1);

    const edited = await fixture.request(`/quotations/${created.body.id}`, {
      method: 'PUT', body: JSON.stringify({ internal_notes: '' }),
    });
    assert.equal(edited.status, 200);
    const editedReload = await fixture.request(`/quotations/${created.body.id}`);
    assert.equal(editedReload.body.internal_notes, '');
    for (const [field, expected] of Object.entries(fields)) {
      if (field !== 'internal_notes') assert.equal(editedReload.body[field], expected, `Note edit changed ${field}`);
    }
  } finally {
    await fixture.close();
  }
});

test('quotation notes and commercial fields remain optional and preserve empty or zero values', async () => {
  const fixture = await createFixture();
  try {
    const cases = [
      { submitted: {}, expected: { internal_notes: null, incoterm: null, payment_term: null, delivery_term: null, tax_type: null, domestic_vat_rate: 0, export_tax_rebate_rate: 0, tax_amount: 0, shipping_handling: 0 } },
      { submitted: { internal_notes: '', incoterm: '', payment_term: '', delivery_term: '', tax_type: 'none', domestic_vat_rate: 0, export_tax_rebate_rate: 0, tax_amount: 0, shipping_handling: 0 } },
      { submitted: { tax_type: 'export', domestic_vat_rate: 0, export_tax_rebate_rate: 7, tax_amount: 0, shipping_handling: 12 } },
    ];
    for (const { submitted, expected = submitted } of cases) {
      const created = await fixture.request('/quotations', {
        method: 'POST',
        body: JSON.stringify({
          company_id: fixture.companyId,
          currency: 'USD',
          subtotal: 20,
          total: 20 + (submitted.shipping_handling ?? 0),
          ...submitted,
          line_items: [{ product_grade_snapshot: 'Fixture material', unit_of_measure: 'pc', quantity: 1, unit_price: 20, line_total: 20 }],
        }),
      });
      assert.equal(created.status, 201);
      const reloaded = await fixture.request(`/quotations/${created.body.id}`);
      assert.equal(reloaded.status, 200);
      for (const [field, value] of Object.entries(expected)) {
        assert.equal(reloaded.body[field], value, `Optional ${field} did not round-trip`);
      }
    }
  } finally {
    await fixture.close();
  }
});

test('quotation creation persists submitted header discounts and records them in audit', async () => {
  const fixture = await createFixture();
  try {
    const created = await fixture.request('/quotations', {
      method: 'POST', body: JSON.stringify({
        company_id: fixture.companyId, currency: 'USD', subtotal: 300, total: 276,
        discount_percent: 8, discount_amount: 24,
        line_items: [{ product_grade_snapshot: 'Fixture material', unit_of_measure: 'pc', quantity: 3, unit_price: 100, line_total: 300 }],
      }),
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.discount_percent, 8);
    assert.equal(created.body.discount_amount, 24);
    const reloaded = await fixture.request(`/quotations/${created.body.id}`);
    assert.equal(reloaded.body.subtotal, 300);
    assert.equal(reloaded.body.total, 276);
    assert.equal(reloaded.body.discount_percent, 8);
    assert.equal(reloaded.body.discount_amount, 24);
    const database = new Database(fixture.databasePath, { readonly: true });
    try {
      const event = database.prepare("SELECT changes FROM audit_log WHERE entity_type = 'quotation' AND entity_id = ? AND action = 'create'").get(created.body.id);
      const changes = JSON.parse(event.changes);
      assert.equal(changes.discount_percent.new, 8);
      assert.equal(changes.discount_amount.new, 24);
    } finally {
      database.close();
    }
  } finally {
    await fixture.close();
  }
});

test('quotation creation preserves product-line discount percentages without recalculating amounts', async () => {
  const fixture = await createFixture();
  try {
    const created = await fixture.request('/quotations', {
      method: 'POST', body: JSON.stringify({
        company_id: fixture.companyId, currency: 'USD', subtotal: 180, total: 180,
        line_items: [{ product_grade_snapshot: 'Fixture material', unit_of_measure: 'pc', quantity: 2, unit_price: 100, discount_percent: 10, line_total: 180 }],
      }),
    });
    assert.equal(created.status, 201);
    const reloaded = await fixture.request(`/quotations/${created.body.id}`);
    const line = reloaded.body.line_items[0];
    assert.equal(line.discount_percent, 10);
    assert.equal(line.quantity, 2);
    assert.equal(line.unit_price, 100);
    assert.equal(line.line_total, 180);
    assert.equal(reloaded.body.subtotal, 180);
    assert.equal(reloaded.body.total, 180);
  } finally {
    await fixture.close();
  }
});

test('quotation-to-order conversion retains persisted header and product-line discounts', async () => {
  const fixture = await createFixture();
  try {
    assert.equal((await fixture.request(`/companies/${fixture.companyId}`, {
      method: 'PUT', body: JSON.stringify({ customer_code: 'FIXTURE-DISCOUNT' }),
    })).status, 200);
    const created = await fixture.request('/quotations', {
      method: 'POST', body: JSON.stringify({
        company_id: fixture.companyId, currency: 'CNY', subtotal: 180, total: 171,
        discount_percent: 5, discount_amount: 9,
        line_items: [{ product_grade_snapshot: 'Fixture material', unit_of_measure: 'pc', quantity: 2, unit_price: 100, discount_percent: 10, line_total: 180 }],
      }),
    });
    assert.equal(created.status, 201);
    const source = (await fixture.request(`/quotations/${created.body.id}`)).body;
    const order = await fixture.request('/orders', {
      method: 'POST', body: JSON.stringify({
        company_id: source.company_id, quotation_id: source.id, currency: source.currency,
        subtotal: source.subtotal, total: source.total,
        discount_percent: source.discount_percent, discount_amount: source.discount_amount,
        line_items: source.line_items,
      }),
    });
    assert.equal(order.status, 201);
    assert.equal(order.body.discount_percent, 5);
    assert.equal(order.body.discount_amount, 9);
    assert.equal(order.body.subtotal, 180);
    assert.equal(order.body.total, 171);
    assert.equal(order.body.currency, 'CNY');
    assert.equal(order.body.line_items[0].discount_percent, 10);
    assert.equal(order.body.line_items[0].quantity_ordered, 2);
    assert.equal(order.body.line_items[0].line_total, 180);
    const reloaded = await fixture.request(`/orders/${order.body.id}`);
    assert.equal(reloaded.body.discount_percent, 5);
    assert.equal(reloaded.body.line_items[0].discount_percent, 10);
    const sourceAfter = (await fixture.request(`/quotations/${source.id}`)).body;
    assert.equal(sourceAfter.order_id, order.body.id);
    assert.deepEqual({ ...sourceAfter, order_id: null }, source);
  } finally {
    await fixture.close();
  }
});

test('quotation discount defaults remain zero for omitted, null and explicit-zero values', async () => {
  const fixture = await createFixture();
  try {
    for (const discount of [undefined, null, 0]) {
      const created = await fixture.request('/quotations', {
        method: 'POST', body: JSON.stringify({
          company_id: fixture.companyId, currency: 'USD', subtotal: 20, total: 20,
          discount_percent: discount, discount_amount: discount,
          line_items: [{ product_grade_snapshot: 'Fixture material', unit_of_measure: 'pc', quantity: 2, unit_price: 10, discount_percent: discount, line_total: 20 }],
        }),
      });
      assert.equal(created.status, 201);
      const quotation = (await fixture.request(`/quotations/${created.body.id}`)).body;
      assert.equal(quotation.discount_percent, 0);
      assert.equal(quotation.discount_amount, 0);
      assert.equal(quotation.line_items[0].discount_percent, 0);
      assert.equal(quotation.total, 20);
    }
  } finally {
    await fixture.close();
  }
});

async function prepareOrderReferences(fixture) {
  for (const [id, customerCode] of [[fixture.companyId, 'FIXTURE-A'], [fixture.otherCompanyId, 'FIXTURE-B']]) {
    const updated = await fixture.request(`/companies/${id}`, {
      method: 'PUT', body: JSON.stringify({ customer_code: customerCode }),
    });
    assert.equal(updated.status, 200);
  }
  const lines = [{ line_number: 1, product_grade_snapshot: 'Fixture material', unit_of_measure: 'pc', quantity: 2, unit_price: 10, line_total: 20 }];
  async function quotation(companyId, contactId) {
    const created = await fixture.request('/quotations', {
      method: 'POST', body: JSON.stringify({ company_id: companyId, contact_id: contactId, currency: 'USD', subtotal: 20, total: 20, line_items: lines }),
    });
    assert.equal(created.status, 201);
    return created.body;
  }
  return {
    first: await quotation(fixture.companyId, fixture.contactId),
    second: await quotation(fixture.otherCompanyId, fixture.otherContactId),
    lines,
  };
}

function orderWriteSnapshot(fixture) {
  const database = new Database(fixture.databasePath, { readonly: true });
  try {
    return {
      orders: database.prepare('SELECT * FROM orders ORDER BY id').all(),
      lines: database.prepare('SELECT * FROM order_line_items ORDER BY id').all(),
      audit: database.prepare('SELECT * FROM audit_log ORDER BY id').all(),
    };
  } finally {
    database.close();
  }
}

function contactWriteSnapshot(fixture) {
  const database = new Database(fixture.databasePath, { readonly: true });
  try {
    return { contacts: database.prepare('SELECT * FROM contacts ORDER BY id').all(), audit: database.prepare('SELECT * FROM audit_log ORDER BY id').all() };
  } finally { database.close(); }
}

test('moving a primary contact clears the destination primary atomically and records the displaced actor history', async () => {
  const fixture = await createFixture();
  try {
    const destination = await fixture.request(`/contacts/${fixture.otherContactId}`, { method: 'PUT', body: JSON.stringify({ is_primary_contact: true }) });
    assert.equal(destination.status, 200);
    const moved = await fixture.request(`/contacts/${fixture.contactId}`, { method: 'PUT', body: JSON.stringify({ company_id: fixture.otherCompanyId }) });
    assert.equal(moved.status, 200);
    const contacts = (await fixture.request(`/contacts?company_id=${fixture.otherCompanyId}`)).body;
    assert.deepEqual(contacts.filter(contact => contact.is_primary_contact).map(contact => contact.id), [fixture.contactId]);
    const database = new Database(fixture.databasePath, { readonly: true });
    try {
      const events = database.prepare("SELECT changes FROM audit_log WHERE entity_type = 'contact' AND entity_id = ? AND action = 'update'").all(fixture.otherContactId);
      assert.ok(events.some(event => JSON.parse(event.changes).is_primary_contact?.new === 0));
    } finally { database.close(); }
  } finally { await fixture.close(); }
});

test('contact company changes reject missing or deleted companies without partial writes', async () => {
  const fixture = await createFixture();
  try {
    assert.equal((await fixture.request(`/companies/${fixture.otherCompanyId}`, { method: 'DELETE' })).status, 204);
    const before = contactWriteSnapshot(fixture);
    for (const companyId of [randomUUID(), fixture.otherCompanyId]) {
      const response = await fixture.request(`/contacts/${fixture.contactId}`, { method: 'PUT', body: JSON.stringify({ company_id: companyId, is_primary_contact: true }) });
      assert.equal(response.status, 400);
      assert.deepEqual(contactWriteSnapshot(fixture), before);
    }
    const note = await fixture.request(`/contacts/${fixture.otherContactId}`, { method: 'PUT', body: JSON.stringify({ notes: 'Historical contact note' }) });
    assert.equal(note.status, 200, 'Unchanged historical references must not prevent note edits');
  } finally { await fixture.close(); }
});

test('primary contact reassignment rolls back completely when its create or update audit fails', async () => {
  const fixture = await createFixture();
  try {
    assert.equal((await fixture.request(`/contacts/${fixture.otherContactId}`, { method: 'PUT', body: JSON.stringify({ is_primary_contact: true }) })).status, 200);
    const database = new Database(fixture.databasePath);
    try {
      database.exec("CREATE TRIGGER qa_contact_audit_failure BEFORE INSERT ON audit_log WHEN NEW.entity_type = 'contact' BEGIN SELECT RAISE(ABORT, 'Anonymous audit fault'); END");
    } finally { database.close(); }
    const before = contactWriteSnapshot(fixture);
    for (const [endpoint, method, body] of [
      ['/contacts', 'POST', { company_id: fixture.companyId, first_name: 'Anonymous', last_name: 'Fixture', is_primary_contact: true }],
      [`/contacts/${fixture.contactId}`, 'PUT', { company_id: fixture.otherCompanyId, is_primary_contact: true }],
    ]) {
      const response = await fixture.request(endpoint, { method, body: JSON.stringify(body) });
      assert.equal(response.status, 500);
      assert.deepEqual(contactWriteSnapshot(fixture), before, 'Failed audit changed primary contacts outside the transaction');
    }
  } finally { await fixture.close(); }
});

async function createOrderWithLine(fixture) {
  const { first, lines } = await prepareOrderReferences(fixture);
  const created = await fixture.request('/orders', {
    method: 'POST',
    body: JSON.stringify({ company_id: fixture.companyId, quotation_id: first.id, total: 20, line_items: lines }),
  });
  assert.equal(created.status, 201);
  return created.body;
}

function shipmentWriteSnapshot(fixture) {
  const database = new Database(fixture.databasePath, { readonly: true });
  try { return { shipments: database.prepare('SELECT * FROM shipments ORDER BY id').all(), audit: database.prepare('SELECT * FROM audit_log ORDER BY id').all() }; }
  finally { database.close(); }
}

test('sample requests reject inconsistent company, quotation or contact references without writes', async () => {
  const fixture = await createFixture();
  try {
    const { first, second } = await prepareOrderReferences(fixture);
    const database = new Database(fixture.databasePath, { readonly: true });
    const snapshot = () => ({ samples: database.prepare('SELECT * FROM sample_requests ORDER BY id').all(), audit: database.prepare('SELECT * FROM audit_log ORDER BY id').all() });
    try {
      const before = snapshot();
      for (const patch of [{ quotation_id: second.id }, { quotation_id: randomUUID() }, { contact_id: fixture.otherContactId }, { company_id: randomUUID() }]) {
        const response = await fixture.request('/sample-requests', { method: 'POST', body: JSON.stringify({ company_id: fixture.companyId, quotation_id: first.id, contact_id: fixture.contactId, purpose: 'Anonymous qualification', ...patch }) });
        assert.equal(response.status, 400);
        assert.deepEqual(snapshot(), before);
      }
    } finally { database.close(); }
    const valid = await fixture.request('/sample-requests', { method: 'POST', body: JSON.stringify({ company_id: fixture.companyId, quotation_id: first.id, contact_id: '', purpose: 'Anonymous qualification' }) });
    assert.equal(valid.status, 201);
    assert.equal(valid.body.contact_id, null);
    assert.equal(valid.body.company_id, fixture.companyId);
  } finally { await fixture.close(); }
});

test('reopening completed tasks clears their completion timestamp while ordinary edits preserve it', async () => {
  const fixture = await createFixture();
  try {
    const endpoint = `/tasks/${fixture.currentTaskId}`;
    const completed = await fixture.request(endpoint, { method: 'PUT', body: JSON.stringify({ status: 'completed' }) });
    assert.equal(completed.status, 200);
    assert.ok(completed.body.completed_at);
    const note = await fixture.request(endpoint, { method: 'PUT', body: JSON.stringify({ description: 'Anonymous revised detail' }) });
    assert.equal(note.body.completed_at, completed.body.completed_at);
    const reopened = await fixture.request(endpoint, { method: 'PUT', body: JSON.stringify({ status: 'pending' }) });
    assert.equal(reopened.status, 200);
    assert.equal(reopened.body.completed_at, null);
  } finally { await fixture.close(); }
});

test('quotation edits cannot erase all product lines or accept malformed replacement lists', async () => {
  const fixture = await createFixture();
  try {
    const { first } = await prepareOrderReferences(fixture);
    const before = quotationWriteSnapshot(fixture);
    for (const lines of [[], null, {}]) {
      const response = await fixture.request(`/quotations/${first.id}`, { method: 'PUT', body: JSON.stringify({ line_items: lines, internal_notes: 'Must not persist' }) });
      assert.equal(response.status, 400);
      assert.deepEqual(quotationWriteSnapshot(fixture), before);
    }
  } finally { await fixture.close(); }
});

function paymentWriteSnapshot(fixture) {
  const database = new Database(fixture.databasePath, { readonly: true });
  try { return Object.fromEntries(['invoices', 'payment_records', 'audit_log'].map(table => [table, database.prepare(`SELECT * FROM ${table} ORDER BY id`).all()])); }
  finally { database.close(); }
}

test('decimal installment payments settle exactly without false overpayment rejections', async () => {
  const fixture = await createFixture();
  try {
    const order = await createOrderWithLine(fixture);
    for (const [total, first, final] of [[0.3, 0.1, 0.2], [100.1, 100, 0.1]]) {
      const invoice = await fixture.request('/payments', { method: 'POST', body: JSON.stringify({ order_id: order.id, total }) });
      assert.equal(invoice.status, 201);
      assert.equal((await fixture.request(`/payments/${invoice.body.id}/pay`, { method: 'POST', body: JSON.stringify({ amount: first }) })).status, 200);
      const paid = await fixture.request(`/payments/${invoice.body.id}/pay`, { method: 'POST', body: JSON.stringify({ amount: final }) });
      assert.equal(paid.status, 200, 'Floating point residue rejected an exact final installment');
      assert.equal(paid.body.status, 'paid');
      assert.equal(paid.body.amount_due, 0);
      assert.equal(paid.body.amount_paid, total);
      const before = paymentWriteSnapshot(fixture);
      assert.equal((await fixture.request(`/payments/${invoice.body.id}/pay`, { method: 'POST', body: JSON.stringify({ amount: 0.01 }) })).status, 400);
      assert.deepEqual(paymentWriteSnapshot(fixture), before);
    }
  } finally { await fixture.close(); }
});

test('real overpayments remain rejected and old floating-point paid totals can be edited safely', async () => {
  const fixture = await createFixture();
  try {
    const order = await createOrderWithLine(fixture);
    const invoice = await fixture.request('/payments', { method: 'POST', body: JSON.stringify({ order_id: order.id, total: 0.3 }) });
    assert.equal((await fixture.request(`/payments/${invoice.body.id}/pay`, { method: 'POST', body: JSON.stringify({ amount: 0.1 }) })).status, 200);
    const before = paymentWriteSnapshot(fixture);
    assert.equal((await fixture.request(`/payments/${invoice.body.id}/pay`, { method: 'POST', body: JSON.stringify({ amount: 0.2001 }) })).status, 400);
    assert.deepEqual(paymentWriteSnapshot(fixture), before);
    const database = new Database(fixture.databasePath);
    try { database.prepare("UPDATE invoices SET amount_paid = ?, amount_due = 0, status = 'paid' WHERE id = ?").run(0.1 + 0.2, invoice.body.id); }
    finally { database.close(); }
    const updated = await fixture.request(`/payments/${invoice.body.id}`, { method: 'PUT', body: JSON.stringify({ total: 0.3, notes: 'Anonymous note' }) });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.status, 'paid');
    assert.equal(updated.body.amount_due, 0);
  } finally { await fixture.close(); }
});

test('shipment order changes reject missing or deleted orders before writing any fields', async () => {
  const fixture = await createFixture();
  try {
    const order = await createOrderWithLine(fixture);
    const other = await createOrderWithLine(fixture);
    const shipment = await fixture.request('/shipments', { method: 'POST', body: JSON.stringify({ order_id: order.id, carrier: 'Anonymous Carrier' }) });
    assert.equal(shipment.status, 201);
    assert.equal((await fixture.request(`/orders/${other.id}`, { method: 'DELETE' })).status, 204);
    const before = shipmentWriteSnapshot(fixture);
    for (const orderId of [randomUUID(), other.id, null, '']) {
      const rejected = await fixture.request(`/shipments/${shipment.body.id}`, { method: 'PUT', body: JSON.stringify({ order_id: orderId, notes: 'Must not be saved' }) });
      assert.equal(rejected.status, 400);
      assert.deepEqual(shipmentWriteSnapshot(fixture), before);
    }
    assert.equal((await fixture.request(`/orders/${order.id}`, { method: 'DELETE' })).status, 204);
    const historical = await fixture.request(`/shipments/${shipment.body.id}`, { method: 'PUT', body: JSON.stringify({ order_id: order.id, tracking_number: 'QA-TRACK' }) });
    assert.equal(historical.status, 200);
    assert.equal(historical.body.tracking_number, 'QA-TRACK');
  } finally { await fixture.close(); }
});

test('shipment reassignment to an active order succeeds and its read data follows that order', async () => {
  const fixture = await createFixture();
  try {
    const order = await createOrderWithLine(fixture);
    const other = await createOrderWithLine(fixture);
    const shipment = await fixture.request('/shipments', { method: 'POST', body: JSON.stringify({ order_id: order.id }) });
    const updated = await fixture.request(`/shipments/${shipment.body.id}`, { method: 'PUT', body: JSON.stringify({ order_id: other.id, carrier: 'Revised anonymous carrier' }) });
    assert.equal(updated.status, 200);
    const reloaded = await fixture.request(`/shipments/${shipment.body.id}`);
    assert.equal(reloaded.body.order_id, other.id);
    assert.equal(reloaded.body.order_number, other.order_number);
    assert.equal(reloaded.body.carrier, 'Revised anonymous carrier');
  } finally { await fixture.close(); }
});

function addOrderLineCollaborator(fixture) {
  const userId = randomUUID();
  const token = randomUUID();
  const database = new Database(fixture.databasePath);
  try {
    database.prepare('INSERT INTO users (id, name, token, role, is_active) VALUES (?, ?, ?, ?, 1)')
      .run(userId, 'Anonymous Order Collaborator', token, 'member');
  } finally {
    database.close();
  }
  return { userId, token };
}

test('deleted-order product lines reject administrator and member writes without changing data or audit', async () => {
  const fixture = await createFixture();
  try {
    const order = await createOrderWithLine(fixture);
    const collaborator = addOrderLineCollaborator(fixture);
    const deleted = await fixture.request(`/orders/${order.id}`, { method: 'DELETE' });
    assert.equal(deleted.status, 204);
    const before = orderWriteSnapshot(fixture);
    for (const headers of [{}, { Authorization: `Bearer ${collaborator.token}` }]) {
      for (const patch of [{ quantity_shipped: 1 }, { unit_of_measure: 'kg', notes: 'Must not be saved' }]) {
        const rejected = await fixture.request(`/orders/line-items/${order.line_items[0].id}`, {
          method: 'PUT', headers, body: JSON.stringify(patch),
        });
        assert.equal(rejected.status, 404, 'A deleted order must not accept product-line edits');
        assert.deepEqual(orderWriteSnapshot(fixture), before, 'Rejected line update changed data or audit');
      }
    }
  } finally {
    await fixture.close();
  }
});

test('active-order product lines remain editable by authenticated collaborators and audit the actual actor', async () => {
  const fixture = await createFixture();
  try {
    const order = await createOrderWithLine(fixture);
    const collaborator = addOrderLineCollaborator(fixture);
    assert.notEqual(order.owner_user_id, collaborator.userId);
    const lineId = order.line_items[0].id;
    const edited = await fixture.request(`/orders/line-items/${lineId}`, {
      method: 'PUT', headers: { Authorization: `Bearer ${collaborator.token}` },
      body: JSON.stringify({ quantity_shipped: 1, unit_of_measure: 'kg' }),
    });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.quantity_shipped, 1);
    assert.equal(edited.body.unit_of_measure, 'kg');
    const reloaded = await fixture.request(`/orders/${order.id}`);
    assert.equal(reloaded.body.line_items[0].quantity_shipped, 1);
    const database = new Database(fixture.databasePath, { readonly: true });
    try {
      const event = database.prepare("SELECT user_id, changes FROM audit_log WHERE entity_type = 'order_line_item' AND entity_id = ? AND action = 'update'").get(lineId);
      assert.equal(event.user_id, collaborator.userId);
      const changes = JSON.parse(event.changes);
      assert.equal(changes.order_id, order.id);
      assert.equal(changes.before.quantity_shipped, 0);
      assert.equal(changes.after.quantity_shipped, 1);
    } finally {
      database.close();
    }
  } finally {
    await fixture.close();
  }
});

test('missing product lines return not found without writing data or audit', async () => {
  const fixture = await createFixture();
  try {
    const before = orderWriteSnapshot(fixture);
    const rejected = await fixture.request(`/orders/line-items/${randomUUID()}`, {
      method: 'PUT', body: JSON.stringify({ quantity_shipped: 1 }),
    });
    assert.equal(rejected.status, 404);
    assert.deepEqual(orderWriteSnapshot(fixture), before);
  } finally {
    await fixture.close();
  }
});

test('orphaned product lines cannot be edited when their parent order is unavailable', async () => {
  const fixture = await createFixture();
  try {
    const order = await createOrderWithLine(fixture);
    const database = new Database(fixture.databasePath);
    try {
      database.pragma('foreign_keys = OFF');
      database.prepare('DELETE FROM orders WHERE id = ?').run(order.id);
    } finally {
      database.close();
    }
    const before = orderWriteSnapshot(fixture);
    const rejected = await fixture.request(`/orders/line-items/${order.line_items[0].id}`, {
      method: 'PUT', body: JSON.stringify({ quantity_shipped: 1 }),
    });
    assert.equal(rejected.status, 404);
    assert.deepEqual(orderWriteSnapshot(fixture), before);
  } finally {
    await fixture.close();
  }
});

test('order creation rejects mismatched company, quotation and contact without writing records', async () => {
  const fixture = await createFixture();
  try {
    const { first, lines } = await prepareOrderReferences(fixture);
    const payload = { company_id: fixture.companyId, quotation_id: first.id, contact_id: fixture.contactId, currency: 'USD', subtotal: 20, total: 20, line_items: lines };
    const before = orderWriteSnapshot(fixture);
    for (const patch of [
      { company_id: fixture.otherCompanyId, contact_id: fixture.otherContactId },
      { contact_id: fixture.otherContactId },
      { contact_id: 'missing-fixture-contact' },
    ]) {
      const rejected = await fixture.request('/orders', { method: 'POST', body: JSON.stringify({ ...payload, ...patch }) });
      assert.equal(rejected.status, 400, `Invalid order references were accepted: ${JSON.stringify(patch)}`);
      assert.deepEqual(orderWriteSnapshot(fixture), before, 'Rejected order creation left partial writes');
    }
    for (const contactId of [fixture.contactId, null, undefined]) {
      const valid = await fixture.request('/orders', { method: 'POST', body: JSON.stringify({ ...payload, contact_id: contactId }) });
      assert.equal(valid.status, 201);
      assert.equal(valid.body.company_id, fixture.companyId);
      assert.equal(valid.body.quotation_id, first.id);
      assert.equal(valid.body.contact_id, contactId ?? null);
      assert.equal(valid.body.total, 20);
      assert.equal(valid.body.line_items.length, 1);
    }
  } finally {
    await fixture.close();
  }
});

test('order edits validate effective references atomically while retaining historical-source compatibility', async () => {
  const fixture = await createFixture();
  try {
    const { first, second, lines } = await prepareOrderReferences(fixture);
    const created = await fixture.request('/orders', {
      method: 'POST', body: JSON.stringify({ company_id: fixture.companyId, quotation_id: first.id, contact_id: fixture.contactId, currency: 'USD', total: 20, line_items: lines }),
    });
    assert.equal(created.status, 201);
    const endpoint = `/orders/${created.body.id}`;
    const before = orderWriteSnapshot(fixture);
    for (const patch of [
      { company_id: fixture.otherCompanyId },
      { quotation_id: second.id },
      { contact_id: fixture.otherContactId },
      { contact_id: 'missing-fixture-contact' },
      { company_id: 'missing-fixture-company' },
      { quotation_id: 'missing-fixture-quotation' },
    ]) {
      const rejected = await fixture.request(endpoint, {
        method: 'PUT', body: JSON.stringify({ ...patch, internal_notes: 'Must not be saved', line_items: [{ ...lines[0], quantity: 9, line_total: 90 }] }),
      });
      assert.equal(rejected.status, 400, `Invalid order edit was accepted: ${JSON.stringify(patch)}`);
      assert.deepEqual(orderWriteSnapshot(fixture), before, 'Rejected order edit changed data or audit');
    }
    const reassigned = await fixture.request(endpoint, {
      method: 'PUT', body: JSON.stringify({ company_id: fixture.otherCompanyId, quotation_id: second.id, contact_id: fixture.otherContactId }),
    });
    assert.equal(reassigned.status, 200);
    assert.equal(reassigned.body.company_id, fixture.otherCompanyId);
    assert.equal(reassigned.body.quotation_id, second.id);
    assert.equal(reassigned.body.contact_id, fixture.otherContactId);
    const cleared = await fixture.request(endpoint, { method: 'PUT', body: JSON.stringify({ contact_id: null }) });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body.contact_id, null);
    const deletedSource = await fixture.request(`/quotations/${second.id}`, { method: 'DELETE' });
    assert.equal(deletedSource.status, 204);
    const historicalEdit = await fixture.request(endpoint, {
      method: 'PUT', body: JSON.stringify({ quotation_id: second.id, internal_notes: 'Historical order note' }),
    });
    assert.equal(historicalEdit.status, 200);
    assert.equal(historicalEdit.body.internal_notes, 'Historical order note');
    const reloaded = await fixture.request(endpoint);
    assert.equal(reloaded.status, 200);
    assert.equal(reloaded.body.line_items.length, 1);
    assert.equal(reloaded.body.line_items[0].quantity_ordered, 2);
  } finally {
    await fixture.close();
  }
});

function quotationWriteSnapshot(fixture) {
  const database = new Database(fixture.databasePath, { readonly: true });
  try {
    return Object.fromEntries(['quotations', 'quotation_line_items', 'companies', 'orders', 'audit_log']
      .map(table => [table, database.prepare(`SELECT * FROM ${table} ORDER BY id`).all()]));
  } finally {
    database.close();
  }
}

test('quotation creation rejects foreign contacts without changing quotes, company stages or audit', async () => {
  const fixture = await createFixture();
  try {
    const payload = {
      company_id: fixture.companyId, currency: 'USD', subtotal: 20, total: 20,
      line_items: [{ product_grade_snapshot: 'Fixture material', unit_of_measure: 'pc', quantity: 2, unit_price: 10, line_total: 20 }],
    };
    const before = quotationWriteSnapshot(fixture);
    for (const contactId of [fixture.otherContactId, 'missing-fixture-contact', {}]) {
      const rejected = await fixture.request('/quotations', {
        method: 'POST', body: JSON.stringify({ ...payload, contact_id: contactId }),
      });
      assert.equal(rejected.status, 400, 'Invalid quotation contact was accepted');
      assert.deepEqual(quotationWriteSnapshot(fixture), before, 'Rejected quotation creation left partial writes');
    }
    for (const contactId of [fixture.contactId, undefined, null, '']) {
      const created = await fixture.request('/quotations', {
        method: 'POST', body: JSON.stringify({ ...payload, contact_id: contactId }),
      });
      assert.equal(created.status, 201);
      assert.equal(created.body.contact_id, contactId || null);
    }
    const deletedContact = await fixture.request(`/contacts/${fixture.contactId}`, { method: 'DELETE' });
    assert.equal(deletedContact.status, 204);
    const afterDeletion = quotationWriteSnapshot(fixture);
    const rejectedDeleted = await fixture.request('/quotations', {
      method: 'POST', body: JSON.stringify({ ...payload, contact_id: fixture.contactId }),
    });
    assert.equal(rejectedDeleted.status, 400);
    assert.deepEqual(quotationWriteSnapshot(fixture), afterDeletion);
  } finally {
    await fixture.close();
  }
});

test('quotation edits validate effective contacts and allow empty or historical contact selections', async () => {
  const fixture = await createFixture();
  try {
    const { first, lines } = await prepareOrderReferences(fixture);
    const endpoint = `/quotations/${first.id}`;
    const before = quotationWriteSnapshot(fixture);
    for (const patch of [
      { company_id: fixture.otherCompanyId }, { contact_id: fixture.otherContactId },
      { contact_id: 'missing-fixture-contact' }, { company_id: 'missing-fixture-company' },
    ]) {
      const rejected = await fixture.request(endpoint, {
        method: 'PUT', body: JSON.stringify({ ...patch, currency: 'CNY', internal_notes: 'Must not be saved', line_items: [{ ...lines[0], quantity: 9, line_total: 90 }] }),
      });
      assert.equal(rejected.status, 400, `Invalid quotation edit was accepted: ${JSON.stringify(patch)}`);
      assert.deepEqual(quotationWriteSnapshot(fixture), before, 'Rejected quotation edit left partial writes');
    }
    const reassigned = await fixture.request(endpoint, {
      method: 'PUT', body: JSON.stringify({ company_id: fixture.otherCompanyId, contact_id: fixture.otherContactId }),
    });
    assert.equal(reassigned.status, 200);
    assert.equal(reassigned.body.company_id, fixture.otherCompanyId);
    for (const contactId of [null, '', fixture.otherContactId]) {
      const updated = await fixture.request(endpoint, {
        method: 'PUT', body: JSON.stringify({ contact_id: contactId, internal_notes: 'Optional contact edit' }),
      });
      assert.equal(updated.status, 200);
      assert.equal(updated.body.contact_id, contactId || null);
    }
    const deleted = await fixture.request(`/contacts/${fixture.otherContactId}`, { method: 'DELETE' });
    assert.equal(deleted.status, 204);
    const historical = await fixture.request(endpoint, {
      method: 'PUT', body: JSON.stringify({ company_id: fixture.otherCompanyId, contact_id: fixture.otherContactId, internal_notes: 'Historical contact retained' }),
    });
    assert.equal(historical.status, 200);
    assert.equal(historical.body.contact_id, fixture.otherContactId);
    assert.equal(historical.body.internal_notes, 'Historical contact retained');
  } finally {
    await fixture.close();
  }
});

test('a quotation with an active order cannot move to a different company', async () => {
  const fixture = await createFixture();
  try {
    const { first, lines } = await prepareOrderReferences(fixture);
    const order = await fixture.request('/orders', {
      method: 'POST', body: JSON.stringify({ company_id: fixture.companyId, quotation_id: first.id, contact_id: fixture.contactId, currency: 'USD', total: 20, line_items: lines }),
    });
    assert.equal(order.status, 201);
    const before = quotationWriteSnapshot(fixture);
    const rejected = await fixture.request(`/quotations/${first.id}`, {
      method: 'PUT', body: JSON.stringify({ company_id: fixture.otherCompanyId, contact_id: fixture.otherContactId, currency: 'CNY', internal_notes: 'Must not be saved', line_items: lines }),
    });
    assert.equal(rejected.status, 400);
    assert.deepEqual(quotationWriteSnapshot(fixture), before, 'Company change corrupted the source quotation or linked order');
    const ordinaryEdit = await fixture.request(`/quotations/${first.id}`, {
      method: 'PUT', body: JSON.stringify({ internal_notes: 'Linked-order quotation note' }),
    });
    assert.equal(ordinaryEdit.status, 200);
    assert.equal(ordinaryEdit.body.internal_notes, 'Linked-order quotation note');
  } finally {
    await fixture.close();
  }
});
