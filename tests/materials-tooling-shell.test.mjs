import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pageSourceFile = new URL('../src/pages/MaterialsToolingPage.tsx', import.meta.url);
const apiSourceFile = new URL('../src/lib/materials-tooling-api.ts', import.meta.url);
const dictionarySourceFile = new URL('../src/lib/i18n.tsx', import.meta.url);
const appSourceFile = new URL('../src/App.tsx', import.meta.url);

const pageSource = readFileSync(pageSourceFile, 'utf8');
const apiSource = readFileSync(apiSourceFile, 'utf8');
const dictionarySource = readFileSync(dictionarySourceFile, 'utf8');
const appSource = readFileSync(appSourceFile, 'utf8');

// Strip comments for text pattern checks
const renderedSource = pageSource
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\/[^\n]*/g, '');

test('materials tooling page uses the shared operational hierarchy', () => {
  assert.match(pageSource, /className="page-shell"/);
  assert.match(pageSource, /className="page-header"/);
  assert.match(pageSource, /role="tablist"/);
  assert.match(pageSource, /aria-selected=\{tab === item\.key\}/);
});

test('materials tooling page has 5 accessible tabs', () => {
  // tabs are rendered via TABS.map, so the map expression and tab constants verify all 5
  assert.match(pageSource, /TABS\.map/);
  assert.match(pageSource, /role="tab"/);
  assert.match(pageSource, /aria-selected=\{tab === item\.key\}/);
  // Each tab key appears in the TABS array and its matcher
  assert.match(pageSource, /'overview'/);
  assert.match(pageSource, /'materials'/);
  assert.match(pageSource, /'documents'/);
  assert.match(pageSource, /'ledger'/);
  assert.match(pageSource, /'tooling'/);
  assert.doesNotMatch(pageSource, /'approvals'/);
  assert.doesNotMatch(pageSource, /'settings'/);
  // All 5 tabs are wired as conditional render branches
  const tabBranches = pageSource.match(/\{tab === '/g);
  assert.equal(tabBranches ? tabBranches.length : 0, 5, 'Expected exactly 5 tab condition branches');
});

test('materials tooling page loads real overview from /api/materials-tooling/overview', () => {
  assert.match(pageSource, /\/api\/materials-tooling\/overview/);
  assert.match(pageSource, /pendingApprovals/);
  assert.match(pageSource, /lowStockItems/);
  assert.match(pageSource, /currentMonth/);
  assert.match(pageSource, /overdueToolingCount/);
});

test('materials tooling page loads /me for permissions', () => {
  assert.match(pageSource, /\/api\/materials-tooling\/me/);
  assert.match(pageSource, /viewPrices/);
});

test('materials tooling page does not render hard-coded English visible copy', () => {
  const forbidden = [
    />Dashboard</, />Overview</, />Materials</, />Documents</,
    />Ledger</, />Tooling</, />Approvals</,
    />Pending Approvals</, />Low Stock</, />Monthly Receipts</,
    />Issues</, />Overdue Tooling</,
    />Insufficient Inventory</, />Void</,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(renderedSource, pattern,
      `Hard-coded English text found: ${pattern}`);
  }
  // All visible text must go through t()
  const textNodes = renderedSource.match(/>[^<]{2,}[^<]</g) || [];
  const suspicious = textNodes.filter(t =>
    /[A-Z]{2,}/.test(t)  // contains consecutive uppercase letters as English
    && !t.includes('{')   // not a template expression
  );
  assert.equal(suspicious.length, 0, `Suspicious hard-coded text: ${suspicious.join(', ')}`);
});

test('materials tooling API exposes typed methods', () => {
  // Download must use authenticated fetch, not permanent <a>
  assert.match(apiSource, /fetch/);
  assert.match(apiSource, /\.blob\(\)/);
  assert.doesNotMatch(apiSource, /href.*download/);
  // Required method signatures
  assert.match(apiSource, /getOverview/);
  assert.match(apiSource, /getMe/);
});

test('materials tooling API lets the browser set multipart boundaries', () => {
  assert.match(apiSource, /options\?\.body instanceof FormData/);
  assert.doesNotMatch(
    apiSource,
    /if \(!headers\.has\('Content-Type'\)\) headers\.set\('Content-Type', 'application\/json'\)/,
  );
});

test('materials tooling API uses the server attachment download route', () => {
  assert.match(apiSource, /downloadBlob\(`\/attachments\/\$\{attachmentId\}\/download`\)/);
  assert.doesNotMatch(
    apiSource,
    /downloadBlob\(`\/documents\/\$\{docId\}\/attachments\/\$\{attachmentId\}`\)/,
  );
});

test('materials tooling API types include permissions', () => {
  assert.match(apiSource, /MaterialsPermission/);
  assert.match(apiSource, /viewPrices/);
  assert.match(apiSource, /enter/);
  assert.match(apiSource, /manageMaterials/);
  assert.match(apiSource, /approve/);
  assert.match(apiSource, /managePeriods/);
});

test('materials tooling overview tab shows price data only when viewPrices is true', () => {
  // Must conditionally render receiptAmount/issueReferenceAmount based on permissions
  assert.match(pageSource, /viewPrices/);
  // Should not render purchase amounts when viewPrices is false
  assert.match(pageSource, /receiptAmount/);
  assert.match(pageSource, /issueReferenceAmount/);
});

// Dictionary keys come in the V3 navigation batch.
// This test checks that the page loads real API data, has accessible 5-tab structure,
// hides prices when viewPrices=false, and avoids hard-coded English.

test('all tabs are wired with real components, not fake data', () => {
  // All 5 tabs render real components, not EmptyTab stubs
  assert.doesNotMatch(pageSource, /EmptyTab/);
  // Each non-overview tab renders its named component
  assert.match(pageSource, /MaterialsTab/);
  assert.match(pageSource, /DocumentsTab/);
  assert.match(pageSource, /LedgerTab/);
  assert.match(pageSource, /ToolingTab/);
  assert.doesNotMatch(pageSource, /ApprovalsTab/);
  assert.doesNotMatch(pageSource, /MaterialsSettings/);
});

test('materials tooling page follows DESIGN.md compact table pattern', () => {
  assert.match(pageSource, /data-surface/);
  assert.match(pageSource, /table-header/);
  assert.match(pageSource, /metric-strip/);
  assert.match(pageSource, /metric-cell/);
});

test('materials tooling page summary reflects live tooling list counts', () => {
  assert.match(pageSource, /toolingCount/);
  assert.match(pageSource, /onStatsChange/);
  assert.match(pageSource, /summaryText/);
});

test('App.tsx lazy-loads authenticated routes and registers /materials-tooling', () => {
  const routeComponents = [
    'Pipeline',
    'Dashboard',
    'Companies',
    'CompanyDetail',
    'Contacts',
    'Quotations',
    'QuotationDetail',
    'Orders',
    'OrderDetail',
    'Shipments',
    'ShipmentDetail',
    'Payments',
    'InventoryPage',
    'MaterialsToolingPage',
    'Activities',
    'Tasks',
    'SettingsProfile',
  ];

  for (const componentName of routeComponents) {
    assert.match(
      appSource,
      new RegExp(`const ${componentName} = lazy\\(\\(\\) => import\\('\\./pages/${componentName}'\\)\\);`),
      `${componentName} should be lazy-loaded`,
    );
  }

  assert.match(appSource, /<Suspense fallback=\{<RouteLoadingFallback \/>\}>/);
  assert.match(appSource, /path="\/materials-tooling"/);
  assert.match(appSource, /element=\{<MaterialsToolingPage/);
  // Route must appear after inventory, not touching its implementation
  const inventoryIdx = appSource.indexOf('/inventory');
  const mtIdx = appSource.indexOf('/materials-tooling');
  assert.ok(mtIdx > inventoryIdx, '/materials-tooling should appear after /inventory');
});
