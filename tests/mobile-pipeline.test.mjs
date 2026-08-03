import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pipelineSource = readFileSync(new URL('../src/pages/Pipeline.tsx', import.meta.url), 'utf8');

test('pipeline provides a single-column mobile stage view alongside the desktop board', () => {
  assert.match(pipelineSource, /className="space-y-3 md:hidden"/);
  assert.match(pipelineSource, /className="hidden md:block/);
  assert.match(pipelineSource, /renderMobileColumn/);
  assert.match(pipelineSource, /<PipelineCard/);
  assert.match(pipelineSource, /<PipelineColumn/);
});

test('pipeline mobile stages preserve empty states, totals, and card navigation', () => {
  assert.match(pipelineSource, /page\.pipeline\.dropItemsHere/);
  assert.match(pipelineSource, /formatCurrency\(col\.usdTotal, 'USD'\)/);
  assert.match(pipelineSource, /onDragStart={handleDragStart}/);
  assert.match(pipelineSource, /onDrop={handleDrop}/);
});
