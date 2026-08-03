import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const shipmentsSource = readFileSync(new URL('../src/pages/Shipments.tsx', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('../src/pages/ShipmentDetail.tsx', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../server/routes/shipments.ts', import.meta.url), 'utf8');

test('shipment creation defaults to express and domestic modes capture a waybill and delivery date', () => {
  assert.match(shipmentsSource, /shipping_type: 'express'/);
  assert.match(shipmentsSource, /st === 'express'[\s\S]*tracking_number[\s\S]*estimated_delivery_date/);
  assert.match(shipmentsSource, /st === 'truck'[\s\S]*tracking_number[\s\S]*estimated_delivery_date/);
});

test('shipment list prioritizes carrier reference and ship date over sea schedule columns', () => {
  const listTable = shipmentsSource.slice(shipmentsSource.indexOf('<table className="w-full">'));
  assert.match(shipmentsSource, /shipmentCarrier/);
  assert.match(shipmentsSource, /shipmentReference/);
  assert.match(listTable, /page\.shipments\.shipDate/);
  assert.doesNotMatch(listTable, /<th[^>]*>\{t\('page\.shipments\.(?:etd|eta)'\)\}/);
});

test('shipment creation persists the ship date and defaults to express on the server', () => {
  const createRoute = routeSource.slice(routeSource.indexOf("router.post('/'"), routeSource.indexOf("router.put('/:id'"));
  assert.match(createRoute, /shipped_at/);
  assert.match(createRoute, /shipping_type \|\| 'express'/);
});

test('shipment detail and editor expose type-aware domestic and international fields', () => {
  assert.match(detailSource, /shipmentCarrier/);
  assert.match(detailSource, /shipmentReference/);
  assert.match(detailSource, /shipping_type === 'sea_freight'[\s\S]*container_no[\s\S]*vessel[\s\S]*etd[\s\S]*eta/);
  assert.match(detailSource, /shipping_type === 'air_freight'[\s\S]*tracking_number[\s\S]*etd[\s\S]*eta/);
  assert.match(detailSource, /shipping_type === 'express'[\s\S]*express_provider[\s\S]*estimated_delivery_date/);
  assert.match(detailSource, /shipping_type === 'truck'[\s\S]*carrier[\s\S]*tracking_number[\s\S]*estimated_delivery_date/);
});
