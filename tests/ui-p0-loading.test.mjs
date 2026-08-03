import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const pipelineSource = readFileSync(new URL('../src/pages/Pipeline.tsx', import.meta.url), 'utf8');
const shipmentDetailSource = readFileSync(new URL('../src/pages/ShipmentDetail.tsx', import.meta.url), 'utf8');

test('application auth loading uses a layout-shaped accessible skeleton', () => {
  assert.match(appSource, /useTranslation\(\)/);
  assert.match(appSource, /role="status"/);
  assert.match(appSource, /aria-label=\{t\('common\.loading'\)\}/);
  assert.match(appSource, /motion-reduce:animate-none/);
  assert.match(appSource, /<aside/);
  assert.match(appSource, /<header/);
  assert.match(appSource, /<main/);
  assert.doesNotMatch(appSource, /\{'加载中\.\.\.'\}/);
});

test('pipeline loading mirrors the board and hides premature summary metrics', () => {
  assert.match(pipelineSource, /function PipelineSkeleton/);
  assert.match(pipelineSource, /aria-label=\{t\('page\.pipeline\.loading'\)\}/);
  assert.match(pipelineSource, /motion-reduce:animate-none/);
  assert.match(pipelineSource, /loading \? \([\s\S]*h-3 w-40/);
  assert.match(pipelineSource, /Array\.from\(\{ length: 4 \}/);
  assert.match(pipelineSource, /Array\.from\(\{ length: 3 \}/);
  assert.doesNotMatch(pipelineSource, /justify-center h-full text-sm text-gray-400/);
});

test('shipment detail loading mirrors the fulfillment record hierarchy', () => {
  assert.match(shipmentDetailSource, /function ShipmentDetailSkeleton/);
  assert.match(shipmentDetailSource, /if \(!shipment\) return <ShipmentDetailSkeleton label=\{t\('common\.loading'\)\} \/>/);
  assert.match(shipmentDetailSource, /role="status"/);
  assert.match(shipmentDetailSource, /aria-hidden="true"/);
  assert.match(shipmentDetailSource, /motion-reduce:animate-none/);
  assert.match(shipmentDetailSource, /commercial-summary/);
  assert.match(shipmentDetailSource, /max-w-3xl/);
  assert.doesNotMatch(shipmentDetailSource, /<div className="page-shell max-w-3xl" aria-label=\{t\('common\.loading'\)\}>/);
});
