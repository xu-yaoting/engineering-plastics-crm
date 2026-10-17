import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/pages/QuotationDetail.tsx', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('QuotationDetail.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const handlers = new Map();
function visit(node) {
  if (ts.isVariableDeclaration(node) && ['downloadPdf', 'readError'].includes(node.name.getText(parsed))) {
    handlers.set(node.name.getText(parsed), node.initializer.getText(parsed));
  }
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.equal(handlers.size, 2);
const compiled = ts.transpileModule(`const readError=${handlers.get('readError')}; module.exports=${handlers.get('downloadPdf')};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
}).outputText;

function downloadFixture({ response } = {}) {
  const calls = { requests: [], blobs: [], anchors: [], clicked: [], removed: [], revoked: [], errors: [], busy: [], closed: [] };
  const downloadingPdfInFlight = { current: false };
  let currentResponse = response ?? { ok: true, blob: async () => ({ type: 'application/pdf' }) };
  let releaseTimer;
  const anchor = {
    href: '', download: '',
    click: () => calls.clicked.push({ href: anchor.href, download: anchor.download }),
    remove: () => calls.removed.push(true),
  };
  const module = { exports: {} };
  runInNewContext(compiled, {
    module, Error, id: 'fixture-quotation', quotation: { quotation_number: 'QT-FIXTURE-1' },
    downloadingPdfInFlight,
    setDownloadingPdf: value => calls.busy.push(value),
    setShowActionsMenu: value => calls.closed.push(value),
    t: key => key,
    toast: { error: message => calls.errors.push(message) },
    fetch: async url => {
      calls.requests.push(url);
      return typeof currentResponse === 'function' ? currentResponse() : currentResponse;
    },
    URL: { createObjectURL: blob => { calls.blobs.push(blob); return 'blob:fixture-pdf'; }, revokeObjectURL: url => calls.revoked.push(url) },
    window: { setTimeout: callback => { releaseTimer = callback; } },
    document: {
      body: { appendChild: element => calls.anchors.push(element) },
      createElement: tag => {
        assert.equal(tag, 'a');
        return anchor;
      },
    },
  });
  return { action: module.exports, calls, downloadingPdfInFlight, runReleaseTimer: () => releaseTimer?.(), setResponse: value => { currentResponse = value; } };
}

test('PDF download fetches the protected endpoint and saves its blob with the quotation number', async () => {
  const fixture = downloadFixture();
  await fixture.action();
  assert.deepEqual(fixture.calls.requests, ['/api/quotations/fixture-quotation/pdf']);
  assert.equal(fixture.calls.blobs[0]?.type, 'application/pdf');
  assert.equal(fixture.calls.anchors.length, 1);
  assert.deepEqual(fixture.calls.clicked, [{ href: 'blob:fixture-pdf', download: 'QT-FIXTURE-1.pdf' }]);
  assert.deepEqual(fixture.calls.busy, [true, false]);
  assert.deepEqual(fixture.calls.closed, [false]);
  assert.deepEqual(fixture.calls.errors, []);
  fixture.runReleaseTimer();
  assert.deepEqual(fixture.calls.revoked, ['blob:fixture-pdf']);
});

test('PDF download prevents duplicate requests while pending', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const fixture = downloadFixture({ response: () => pending });
  const first = fixture.action();
  const second = fixture.action();
  assert.equal(fixture.calls.requests.length, 1);
  assert.equal(fixture.downloadingPdfInFlight.current, true);
  finish({ ok: true, blob: async () => ({ type: 'application/pdf' }) });
  await Promise.all([first, second]);
  assert.deepEqual(fixture.calls.busy, [true, false]);
});

test('PDF download reports API errors and lets the user retry', async () => {
  const fixture = downloadFixture({ response: { ok: false, json: async () => ({ error: 'Quotation is unavailable' }) } });
  await fixture.action();
  assert.deepEqual(fixture.calls.errors, ['Quotation is unavailable']);
  assert.deepEqual(fixture.calls.clicked, []);
  assert.equal(fixture.downloadingPdfInFlight.current, false);
  fixture.setResponse({ ok: true, blob: async () => ({ type: 'application/pdf' }) });
  await fixture.action();
  assert.equal(fixture.calls.requests.length, 2);
  assert.equal(fixture.calls.clicked.length, 1);
});

test('PDF download reports non-JSON and network errors with the translated fallback', async () => {
  for (const { response, expected } of [
    { response: { ok: false, json: async () => { throw new Error('Not JSON'); } }, expected: 'page.error.loadFailed' },
    { response: () => { throw new Error('Network error'); }, expected: 'Network error' },
  ]) {
    const fixture = downloadFixture({ response });
    await fixture.action();
    assert.deepEqual(fixture.calls.errors, [expected]);
    assert.equal(fixture.downloadingPdfInFlight.current, false);
  }
});
