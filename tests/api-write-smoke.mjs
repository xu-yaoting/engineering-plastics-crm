import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import Database from 'better-sqlite3';

const PORT = 3101;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const created = {
  companyId: null,
  contactId: null,
  inquiryId: null,
  quotationId: null,
  orderId: null,
  invoiceId: null,
  shipmentId: null,
  materialId: null,
  productId: null,
  taskId: null,
};
const cleanupIssues = [];
let cleanedUp = false;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed: ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function expectRequestFailure(path, options = {}, expectedStatus) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  assert.equal(res.status, expectedStatus, `${options.method || 'GET'} ${path} should fail with ${expectedStatus}`);
  return data;
}

async function waitForHealth() {
  for (let i = 0; i < 30; i += 1) {
    try {
      const health = await request('/health');
      if (health?.status === 'ok') return;
    } catch {
      await delay(250);
    }
  }
  throw new Error('API did not become healthy');
}

async function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;

  const db = new Database(new URL('../crm.db', import.meta.url).pathname);
  if (created.productId) {
    db.prepare("DELETE FROM inventory_transactions WHERE product_id = ?").run(created.productId);
  }
  db.close();

  if (created.productId) {
    const deleted = await request(`/inventory/products/${created.productId}`, { method: 'DELETE' })
      .then(() => true)
      .catch(() => false);
    if (!deleted) cleanupIssues.push('DELETE /api/inventory/products/:id is missing or failed');
  }
  if (created.materialId) {
    const deleted = await request(`/inventory/materials/${created.materialId}`, { method: 'DELETE' })
      .then(() => true)
      .catch(() => false);
    if (!deleted) cleanupIssues.push('DELETE /api/inventory/materials/:id is missing or failed');
  }
  if (created.shipmentId) {
    await request(`/shipments/${created.shipmentId}`, { method: 'DELETE' }).catch(() => {});
  }
  if (created.invoiceId) {
    await request(`/payments/${created.invoiceId}`, { method: 'DELETE' }).catch(() => {});
  }
  if (created.orderId) {
    await request(`/orders/${created.orderId}`, { method: 'DELETE' }).catch(() => {});
  }
  if (created.quotationId) {
    const deleted = await request(`/quotations/${created.quotationId}`, { method: 'DELETE' })
      .then(() => true)
      .catch(() => false);
    if (!deleted) {
      const db = new Database(new URL('../crm.db', import.meta.url).pathname);
      db.prepare("UPDATE quotations SET deleted_at = datetime('now') WHERE id = ?").run(created.quotationId);
      db.close();
      cleanupIssues.push('DELETE /api/quotations/:id is missing or failed');
    }
  }
  if (created.inquiryId) {
    await request(`/inquiries/${created.inquiryId}`, { method: 'DELETE' }).catch(() => {});
  }
  if (created.taskId) {
    await request(`/tasks/${created.taskId}`, { method: 'DELETE' }).catch(() => {});
  }
  if (created.contactId) {
    await request(`/contacts/${created.contactId}`, { method: 'DELETE' }).catch(() => {});
  }
  if (created.companyId) {
    await request(`/companies/${created.companyId}`, { method: 'DELETE' }).catch(() => {});
  }
}

async function runSmoke() {
  const company = await request('/companies', {
    method: 'POST',
    body: JSON.stringify({
      name: `Smoke Test Company ${runId}`,
      company_type: 'end_user',
      email: `smoke-${runId}@example.test`,
      country: 'US',
      customer_code: `SMK${runId.slice(-8).replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`,
    }),
  });
  created.companyId = company.id;
  assert.equal(company.name, `Smoke Test Company ${runId}`);

  const updatedCompany = await request(`/companies/${created.companyId}`, {
    method: 'PUT',
    body: JSON.stringify({
      classification: 'B',
      notes: 'Updated by local API smoke test',
      ignored_field_should_not_break_update: 'ignored',
    }),
  });
  assert.equal(updatedCompany.classification, 'B');

  const contact = await request('/contacts', {
    method: 'POST',
    body: JSON.stringify({
      company_id: created.companyId,
      first_name: 'Smoke',
      last_name: 'Contact',
      email: `smoke-contact-${runId}@example.test`,
      job_title: 'QA',
      is_primary_contact: 1,
    }),
  });
  created.contactId = contact.id;
  assert.equal(contact.first_name, 'Smoke');

  const updatedContact = await request(`/contacts/${created.contactId}`, {
    method: 'PUT',
    body: JSON.stringify({
      job_title: 'QA Updated',
      is_decision_maker: 1,
      ignored_field_should_not_break_update: 'ignored',
    }),
  });
  assert.equal(updatedContact.job_title, 'QA Updated');

  const task = await request('/tasks', {
    method: 'POST',
    body: JSON.stringify({
      subject: `Smoke Task ${runId}`,
      task_type: 'follow_up',
      priority: 'medium',
      entity_type: 'company',
      entity_id: created.companyId,
      tags: ['smoke-test'],
    }),
  });
  created.taskId = task.id;
  assert.equal(task.subject, `Smoke Task ${runId}`);

  const updatedTask = await request(`/tasks/${created.taskId}`, {
    method: 'PUT',
    body: JSON.stringify({
      status: 'completed',
      ignored_field_should_not_break_update: 'ignored',
    }),
  });
  assert.equal(updatedTask.status, 'completed');
  assert.ok(updatedTask.completed_at);

  const inquiry = await request('/inquiries', {
    method: 'POST',
    body: JSON.stringify({
      company_id: created.companyId,
      contact_id: created.contactId,
      source: 'email',
      application_description: `Smoke inquiry ${runId}`,
      target_material_requested: 'PEEK',
      quantity_estimate: '10 pcs',
      urgency: 'within_1_month',
      currency: 'USD',
    }),
  });
  created.inquiryId = inquiry.id;
  assert.equal(inquiry.company_id, created.companyId);

  const updatedInquiry = await request(`/inquiries/${created.inquiryId}`, {
    method: 'PUT',
    body: JSON.stringify({
      status: 'under_review',
      technical_notes: 'Updated by local API smoke test',
      ignored_field_should_not_break_update: 'ignored',
    }),
  });
  assert.equal(updatedInquiry.status, 'under_review');

  const quotation = await request('/quotations', {
    method: 'POST',
    body: JSON.stringify({
      company_id: created.companyId,
      contact_id: created.contactId,
      inquiry_id: created.inquiryId,
      currency: 'USD',
      subtotal: 100,
      total: 100,
      line_items: [
        {
          line_number: 1,
          product_grade_snapshot: 'Smoke PEEK Test Rod',
          unit_of_measure: 'pc',
          quantity: 2,
          unit_price: 50,
          line_total: 100,
          description: 'Local smoke test line item',
        },
      ],
    }),
  });
  created.quotationId = quotation.id;
  assert.equal(quotation.company_id, created.companyId);

  const updatedQuotation = await request(`/quotations/${created.quotationId}`, {
    method: 'PUT',
    body: JSON.stringify({
      status: 'sent',
      internal_notes: 'Updated by local API smoke test',
      ignored_field_should_not_break_update: 'ignored',
    }),
  });
  assert.equal(updatedQuotation.status, 'sent');

  const order = await request('/orders', {
    method: 'POST',
    body: JSON.stringify({
      company_id: created.companyId,
      contact_id: created.contactId,
      quotation_id: created.quotationId,
      currency: 'USD',
      subtotal: 100,
      total: 100,
      line_items: [
        {
          line_number: 1,
          product_grade_snapshot: 'Smoke PEEK Test Rod',
          unit_of_measure: 'pc',
          quantity: 2,
          unit_price: 50,
          discount_percent: 0,
          line_total: 100,
          description: 'Local smoke test order line',
        },
      ],
    }),
  });
  created.orderId = order.id;
  assert.equal(order.company_id, created.companyId);

  const updatedOrder = await request(`/orders/${created.orderId}`, {
    method: 'PUT',
    body: JSON.stringify({
      status: 'confirmed',
      internal_notes: 'Updated by local API smoke test',
      ignored_field_should_not_break_update: 'ignored',
    }),
  });
  assert.equal(updatedOrder.status, 'confirmed');

  await expectRequestFailure('/payments', {
    method: 'POST',
    body: JSON.stringify({
      order_id: created.orderId,
      total: 0,
      due_date: '2026-07-15',
    }),
  }, 400);

  const invoice = await request('/payments', {
    method: 'POST',
    body: JSON.stringify({
      order_id: created.orderId,
      total: 100,
      due_date: '2026-07-15',
      notes: 'Local API smoke invoice',
    }),
  });
  created.invoiceId = invoice.id;
  assert.equal(invoice.order_id, created.orderId);
  assert.equal(invoice.amount_due, 100);

  await expectRequestFailure(`/payments/${created.invoiceId}/pay`, {
    method: 'POST',
    body: JSON.stringify({
      amount: -10,
      payment_method: 'wire',
      reference_number: `NEG-${runId}`,
    }),
  }, 400);

  const partiallyPaidInvoice = await request(`/payments/${created.invoiceId}/pay`, {
    method: 'POST',
    body: JSON.stringify({
      amount: 40,
      payment_method: 'wire',
      reference_number: `PAY-${runId}`,
    }),
  });
  assert.equal(partiallyPaidInvoice.status, 'partial_paid');
  assert.equal(partiallyPaidInvoice.amount_paid, 40);
  assert.equal(partiallyPaidInvoice.amount_due, 60);

  await expectRequestFailure(`/payments/${created.invoiceId}/pay`, {
    method: 'POST',
    body: JSON.stringify({
      amount: 61,
      payment_method: 'wire',
      reference_number: `OVER-${runId}`,
    }),
  }, 400);

  const paidInvoice = await request(`/payments/${created.invoiceId}/pay`, {
    method: 'POST',
    body: JSON.stringify({
      amount: 60,
      payment_method: 'wire',
      reference_number: `BAL-${runId}`,
    }),
  });
  assert.equal(paidInvoice.status, 'paid');
  assert.equal(paidInvoice.amount_paid, 100);
  assert.equal(paidInvoice.amount_due, 0);

  await expectRequestFailure(`/payments/${created.invoiceId}/pay`, {
    method: 'POST',
    body: JSON.stringify({
      amount: 1,
      payment_method: 'wire',
      reference_number: `AFTER-PAID-${runId}`,
    }),
  }, 400);

  const shipment = await request('/shipments', {
    method: 'POST',
    body: JSON.stringify({
      order_id: created.orderId,
      shipping_type: 'express',
      carrier: 'Smoke Carrier',
      tracking_number: `SMOKE-${runId}`,
      shipping_address: 'Smoke test address',
      status: 'pending_pickup',
      estimated_delivery_date: '2026-07-01',
    }),
  });
  created.shipmentId = shipment.id;
  assert.equal(shipment.order_id, created.orderId);

  const updatedShipment = await request(`/shipments/${created.shipmentId}`, {
    method: 'PUT',
    body: JSON.stringify({
      status: 'shipped',
      tracking_number: `SMOKE-${runId}-UPDATED`,
      ignored_field_should_not_break_update: 'ignored',
    }),
  });
  assert.equal(updatedShipment.status, 'shipped');

  const material = await request('/inventory/materials', {
    method: 'POST',
    body: JSON.stringify({
      name: `Smoke Material ${runId}`,
      density_kg_m3: 1320,
      category: 'Smoke',
    }),
  });
  created.materialId = material.id;
  assert.equal(material.name, `Smoke Material ${runId}`);

  const updatedMaterial = await request(`/inventory/materials/${created.materialId}`, {
    method: 'PUT',
    body: JSON.stringify({
      category: 'Smoke Updated',
      ignored_field_should_not_break_update: 'ignored',
    }),
  });
  assert.equal(updatedMaterial.category, 'Smoke Updated');

  const product = await request('/inventory/products', {
    method: 'POST',
    body: JSON.stringify({
      sku: `SMOKE-${runId}`,
      name: `Smoke Product ${runId}`,
      category: 'Smoke',
      product_type: 'part',
      stock_tracking_mode: 'piece',
      material_id: created.materialId,
      unit_weight_kg: 1.5,
      unit: 'pc',
      safety_stock_qty: 1,
    }),
  });
  created.productId = product.id;
  assert.equal(product.sku, `SMOKE-${runId}`);

  const updatedProduct = await request(`/inventory/products/${created.productId}`, {
    method: 'PUT',
    body: JSON.stringify({
      safety_stock_qty: 2,
      ignored_field_should_not_break_update: 'ignored',
    }),
  });
  assert.equal(updatedProduct.safety_stock_qty, 2);

  const stockIn = await request('/inventory/stock-in', {
    method: 'POST',
    body: JSON.stringify({
      product_id: created.productId,
      quantity: 10,
      unit: 'pc',
      notes: 'Local API smoke stock in',
      operator: 'Smoke Test',
    }),
  });
  assert.equal(stockIn.transaction_type, 'stock_in');

  const stockOut = await request('/inventory/stock-out', {
    method: 'POST',
    body: JSON.stringify({
      product_id: created.productId,
      quantity: 3,
      unit: 'pc',
      notes: 'Local API smoke stock out',
      operator: 'Smoke Test',
    }),
  });
  assert.equal(stockOut.transaction_type, 'stock_out');

  const adjustment = await request('/inventory/adjustment', {
    method: 'POST',
    body: JSON.stringify({
      product_id: created.productId,
      quantity: -2,
      unit: 'pc',
      notes: 'Local API smoke adjustment',
      operator: 'Smoke Test',
    }),
  });
  assert.equal(adjustment.transaction_type, 'adjustment');

  const stock = await request('/inventory/stock');
  const smokeStock = stock.find((item) => item.id === created.productId);
  assert.equal(smokeStock.current_stock, 5);
}

const server = spawn(process.execPath, ['dist-server/index.js'], {
  cwd: new URL('..', import.meta.url).pathname,
  env: {
    ...process.env,
    PORT: String(PORT),
    HOST: '127.0.0.1',
    API_KEY: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverOutput = '';
server.stdout.on('data', (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on('data', (chunk) => {
  serverOutput += chunk.toString();
});

try {
  await waitForHealth();
  await runSmoke();
  await cleanup();
  assert.deepEqual(cleanupIssues, []);
  console.log('API write smoke passed: companies, contacts, tasks, inquiries, quotations, orders, payments, shipments, inventory');
} catch (error) {
  await cleanup();
  console.error(serverOutput);
  throw error;
} finally {
  server.kill('SIGTERM');
}
