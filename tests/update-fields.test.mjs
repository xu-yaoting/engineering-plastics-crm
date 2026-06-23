import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const companiesSource = readFileSync(new URL('../server/routes/companies.ts', import.meta.url), 'utf8');
const inventorySource = readFileSync(new URL('../server/routes/inventory.ts', import.meta.url), 'utf8');
const contactsSource = readFileSync(new URL('../server/routes/contacts.ts', import.meta.url), 'utf8');
const inquiriesSource = readFileSync(new URL('../server/routes/inquiries.ts', import.meta.url), 'utf8');
const tasksSource = readFileSync(new URL('../server/routes/tasks.ts', import.meta.url), 'utf8');
const ordersSource = readFileSync(new URL('../server/routes/orders.ts', import.meta.url), 'utf8');
const quotationsSource = readFileSync(new URL('../server/routes/quotations.ts', import.meta.url), 'utf8');
const shipmentsSource = readFileSync(new URL('../server/routes/shipments.ts', import.meta.url), 'utf8');

test('company updates use an explicit field whitelist', () => {
  assert.match(companiesSource, /COMPANY_UPDATE_FIELDS/);
  assert.doesNotMatch(companiesSource, /Object\.entries\(req\.body\)[\s\S]*map\(\(\[k/);
});

test('inventory updates use explicit field whitelists', () => {
  assert.match(inventorySource, /MATERIAL_UPDATE_FIELDS/);
  assert.match(inventorySource, /PRODUCT_UPDATE_FIELDS/);
  assert.doesNotMatch(inventorySource, /Object\.entries\(req\.body\)[\s\S]*map\(\(\[k/);
});

test('contact updates use an explicit field whitelist', () => {
  assert.match(contactsSource, /CONTACT_UPDATE_FIELDS/);
  assert.doesNotMatch(contactsSource, /Object\.entries\(req\.body\)/);
});

test('inquiry updates use an explicit field whitelist', () => {
  assert.match(inquiriesSource, /INQUIRY_UPDATE_FIELDS/);
  assert.doesNotMatch(inquiriesSource, /Object\.entries\(req\.body\)/);
});

test('task updates use an explicit field whitelist', () => {
  assert.match(tasksSource, /TASK_UPDATE_FIELDS/);
  assert.doesNotMatch(tasksSource, /Object\.entries\(req\.body\)/);
});

test('order updates use explicit field whitelists', () => {
  assert.match(ordersSource, /ORDER_UPDATE_FIELDS/);
  assert.match(ordersSource, /ORDER_LINE_ITEM_UPDATE_FIELDS/);
  assert.doesNotMatch(ordersSource, /Object\.entries\(req\.body\)/);
  assert.doesNotMatch(ordersSource, /Object\.entries\(dataFields\)/);
});

test('quotation updates use an explicit field whitelist', () => {
  assert.match(quotationsSource, /QUOTATION_UPDATE_FIELDS/);
  assert.doesNotMatch(quotationsSource, /Object\.entries\(dataFields\)/);
  assert.doesNotMatch(quotationsSource, /updatedEntries\.map/);
});

test('shipment updates use an explicit field whitelist', () => {
  assert.match(shipmentsSource, /SHIPMENT_UPDATE_FIELDS/);
  assert.doesNotMatch(shipmentsSource, /Object\.entries\(dataFields\)/);
});
