# Materials & Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a document-driven Materials & Tooling module to the CRM with isolated material data, online approval, printable/signable records, purchase-price history, monthly ledgers, attachments, and tooling custody.

**Architecture:** Keep the feature in the existing Express/React application but isolate it behind `/api/materials-tooling` and `/materials-tooling`. A focused domain layer owns permissions, lifecycle transitions, atomic movements, reporting, files, and tooling; existing CRM users and audit infrastructure are the only shared business references.

**Tech Stack:** TypeScript 5.5, Express 4, better-sqlite3 11, React 18, react-i18next, multer 2, PDFKit 0.19, SheetJS/xlsx 0.18, Node built-in test runner.

**Delivery status (2026-07-16):** Implementation and verification steps are complete. Git staging/commit steps remain intentionally unchecked because Nathan did not authorize staging or committing the existing dirty worktree.

## Global Constraints

- Do not reuse or reference `products`, `inventory_transactions`, CRM customers, inquiries, quotations, orders, shipments, or payments.
- Share only authenticated `users`, audit infrastructure, layout, local backup, and export libraries.
- Add no production dependency; `multer`, `pdfkit`, and `xlsx` already exist.
- Every authenticated user may enter; price/contracts/invoices require clerk, approver, or administrator permission.
- Moana receives the materials-clerk permission; approvers are configured statically per document type.
- A user cannot approve their own document.
- One fixed stock UOM and one single-level category per material; no UOM conversion.
- No partial execution of a stock-affecting document; purchase requests alone may be fulfilled by multiple full receipts.
- Submission does not reserve stock; issue execution performs the final non-negative check atomically.
- A zero-difference count adjustment completes normally but creates no `mt_movements` row.
- Executed documents are immutable; correction uses void plus a newly numbered linked replacement.
- Attachment files never use public static paths; authenticated download is mandatory, with <=60-second signed tokens only for sessionless links.
- Individual documents export as A4 PDF; monthly ledgers export as Excel and A3 landscape PDF.
- Prices and ledger amounts are procurement references, not accounting records.
- Each implementation batch touches at most three files, then stops for user `继续` before the next task.
- Before implementation starts, preserve the existing dirty worktree and update `PLANS.md` only after reviewing its current user changes.

## Locked File Structure

Server domain files:

- `server/materials-tooling/schema.ts` — additive tables and indexes only.
- `server/materials-tooling/permissions.ts` — module permissions and static approver resolution.
- `server/materials-tooling/documents.ts` — numbering, validation, versioning, approval, void/replacement.
- `server/materials-tooling/movements.ts` — atomic material execution and quantity calculation.
- `server/materials-tooling/attachments.ts` — upload validation, private paths, authorized streaming, signed tokens.
- `server/materials-tooling/pdf.ts` — immutable application/approved document PDFs.
- `server/materials-tooling/reporting.ts` — price history, monthly ledger, close/reopen, Excel/A3 exports.
- `server/materials-tooling/tooling.ts` — tooling state machine and custody history.
- `server/materials-tooling/import.ts` — cutover opening balances and reference-only price imports.
- `server/routes/materials-tooling.ts` — HTTP validation and response mapping only.

Frontend files:

- `src/lib/materials-tooling-api.ts` — typed client and permission-safe download helpers.
- `src/pages/MaterialsToolingPage.tsx` — page shell and internal navigation.
- `src/components/materials-tooling/MaterialsTab.tsx`
- `src/components/materials-tooling/DocumentsTab.tsx`
- `src/components/materials-tooling/LedgerTab.tsx`
- `src/components/materials-tooling/ToolingTab.tsx`
- `src/components/materials-tooling/ApprovalsTab.tsx`
- `src/components/materials-tooling/MaterialsSettings.tsx`

## Stable Domain Interfaces

```ts
export type MaterialsPermission = {
  enter: boolean;
  manageMaterials: boolean;
  approve: boolean;
  viewPrices: boolean;
  managePeriods: boolean;
};

export type MaterialDocumentType =
  | 'purchase_request' | 'purchase_receipt' | 'material_issue'
  | 'material_return' | 'scrap' | 'count_adjustment' | 'tooling_movement';

export type MaterialDocumentStatus =
  | 'draft' | 'pending_approval' | 'approved' | 'rejected'
  | 'pending_execution' | 'executed' | 'awaiting_signed_copy'
  | 'completed' | 'withdrawn' | 'voided';

export type ToolingStatus =
  'in_stock' | 'in_use' | 'loaned' | 'under_repair' | 'disposed' | 'lost';

export type MaterialDocumentLineInput = {
  materialItemId: string;
  requestedQuantity: number;
  executionQuantity: number;
  unit: string;
  taxInclusiveUnitPrice?: number;
  relatedRequestLineId?: string;
};
```

---

### Task 1: Add the isolated schema

**Files:**
- Create: `tests/materials-tooling-schema.test.mjs`
- Create: `server/materials-tooling/schema.ts`
- Modify: `server/db.ts:565`

**Interfaces:**
- Produces `ensureMaterialsToolingSchema(database: Database.Database): void`.
- Produces tables prefixed `mt_`; no foreign key targets any CRM sales or Inventory table.

- [x] **Step 1: Write the failing schema contract test**

```js
test('materials tooling schema stays isolated and complete', () => {
  for (const table of ['mt_permissions','mt_approval_config','mt_suppliers','mt_items','mt_documents','mt_document_lines','mt_document_versions','mt_approvals','mt_movements','mt_snapshots','mt_attachments','mt_periods','mt_period_snapshots','mt_tooling_assets','mt_tooling_movements']) {
    assert.match(schemaSource, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.doesNotMatch(schemaSource, /REFERENCES (products|inventory_transactions|companies|orders|shipments)/);
  assert.match(dbSource, /ensureMaterialsToolingSchema\(db\)/);
});
```

- [x] **Step 2: Run the test and confirm failure**

Run: `node --test tests/materials-tooling-schema.test.mjs`
Expected: FAIL because `schema.ts` and its invocation do not exist.

- [x] **Step 3: Implement the complete additive schema**

Use UUID text primary keys, ISO text timestamps, `REAL CHECK(quantity > 0)` for line quantities, status/type `CHECK` constraints matching the stable interfaces, `created_by/updated_by` actor IDs, and indexes on document number/status/date, movement item/date, attachment owner, tooling status/custodian, and period key. Call `ensureMaterialsToolingSchema(db)` after `users` and `audit_log` exist.

```ts
export function ensureMaterialsToolingSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS mt_permissions (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      manage_materials INTEGER NOT NULL DEFAULT 0,
      approve INTEGER NOT NULL DEFAULT 0,
      view_prices INTEGER NOT NULL DEFAULT 0,
      manage_periods INTEGER NOT NULL DEFAULT 0,
      updated_by TEXT REFERENCES users(id),
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mt_items (
      id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      category TEXT NOT NULL, specification TEXT, unit TEXT NOT NULL,
      warehouse TEXT, bin_location TEXT, safety_quantity REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1, notes TEXT,
      created_by TEXT NOT NULL REFERENCES users(id), updated_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
  `);
}
```

The same `database.exec` call defines this implemented exact contract. The structured execution,
return, count, tooling-owner, and import-history fields are intentional and must not be collapsed
into JSON or notes:

```text
mt_approval_config(document_type PK, approver_user_id FK users, updated_by FK users, updated_at)
mt_suppliers(id PK, code UNIQUE, name, contact_name, phone, notes, is_active, created_by, updated_by, created_at, updated_at)
mt_documents(id PK, document_number UNIQUE, document_type, version, status, applicant_user_id, department, request_date, required_date, execution_date, purpose, supplier_id, invoice_number, contract_number, replaces_document_id, replaced_by_document_id, assigned_approver_user_id, rejection_reason, void_reason, created_by, updated_by, created_at, updated_at, notes, executed_by_user_id, recipient_user_id, recipient_name, inspection_result)
mt_document_lines(id PK, document_id FK, line_number, material_item_id FK, requested_quantity, execution_quantity, unit, tax_inclusive_unit_price, related_request_line_id, related_issue_line_id, return_condition, system_quantity, counted_quantity, adjustment_delta, notes)
mt_document_versions(document_id + version composite PK/FK document, snapshot_json, snapshot_sha256, submitted_by FK users, submitted_at)
mt_approvals(id PK, document_id + version composite FK mt_document_versions, approver_user_id FK users, decision, comment, decided_at)
mt_movements(id PK, item_id FK, nullable document_id FK, nullable document_line_id FK, movement_type, quantity_delta, reference_unit_price, movement_date, created_by, created_at, supplier_id, reference_quantity, source_workbook, cutover_period)
mt_snapshots(id PK, document_id FK, version, variant, relative_path UNIQUE, sha256, created_by, created_at)
mt_attachments(id PK, nullable document_id FK, category, original_name, stored_name UNIQUE, mime_type, size_bytes, is_sensitive, uploaded_by, uploaded_at, deleted_by, deleted_at, nullable tooling_asset_id FK, notes; exactly one owner: document XOR tooling asset)
mt_periods(period_key PK, status, closed_by, closed_at, reopened_by, reopened_at, reopen_reason)
mt_period_snapshots(id PK, period_key, version, snapshot_json, created_by, created_at)
mt_tooling_assets(id PK, tooling_code UNIQUE, name, category, specification, serial_number, tracked_quantity, status, custodian_user_id, location, supplier_id, purchase_price, contract_number, invoice_number, acquired_at, expected_life_months, next_maintenance_date, notes, created_by, updated_by, created_at, updated_at)
mt_tooling_movements(id PK, asset_id FK, document_id FK, movement_type, from_status, to_status, from_custodian_user_id, to_custodian_user_id, from_location, to_location, reason, created_by, created_at)
```

`mt_movements` also enforces the document/movement type match for stock document types and is
append-only through update/delete rejection triggers. `opening_balance` and `reference_purchase`
are history-import types without document ownership; their workbook/cutover metadata is required,
and `reference_purchase` records quantity and supplier context without changing stock.
`mt_document_versions` accepts only a JSON object with an object `header` and array `lines`; both
versions and approvals are append-only. An approval cannot exist unless its exact document/version
snapshot exists.

- [x] **Step 4: Verify schema safety**

Run: `node --test tests/materials-tooling-schema.test.mjs && npm run build`
Expected: PASS; server TypeScript build succeeds.

- [ ] **Step 5: Commit and stop**

```bash
git add tests/materials-tooling-schema.test.mjs server/materials-tooling/schema.ts server/db.ts
git commit -m "feat: add materials tooling schema"
```

### Task 2A: Add the module permission core and static approval resolver

**Files:**
- Modify: `docs/superpowers/plans/2026-07-14-materials-tooling-implementation.md`
- Create: `tests/materials-tooling-permissions.test.mjs`
- Create: `server/materials-tooling/permissions.ts`

**Interfaces:**
- Produces `getMaterialsPermission(user): MaterialsPermission`.
- Produces `requireMaterialsPermission(capability)` middleware.
- Produces `resolveApprover(documentType, applicantUserId?): string` plus database-injectable,
  admin-only permission and approval-configuration upsert functions.
- Produces `configureMaterialsPermissionService(database)`; startup or the Task 2B route factory
  configures the public wrappers explicitly. There is no `NODE_ENV` branch or import-time database
  initialization, and middleware may be declared before configuration because it resolves the
  configured service only when a request arrives.

- [x] **Step 1: Write failing permission tests** covering member entry, clerk price access, global-admin full access, server-side 403, self-approval rejection, and applicant inability to override approver.
- [x] **Step 2: Run** `node --test tests/materials-tooling-permissions.test.mjs`; expect missing module failures.
- [x] **Step 3: Implement exact permission merging**:

```ts
export function getMaterialsPermission(user: { id: string; role: string }): MaterialsPermission {
  if (user.role === 'admin') return { enter: true, manageMaterials: true, approve: true, viewPrices: true, managePeriods: true };
  const row = db.prepare('SELECT * FROM mt_permissions WHERE user_id = ?').get(user.id) as any;
  return { enter: true, manageMaterials: !!row?.manage_materials, approve: !!row?.approve, viewPrices: !!row?.view_prices, managePeriods: !!row?.manage_periods };
}
```

Admin configuration accepts only active user IDs and records `updated_by/updated_at`.
Permission writes accept a plain object containing exactly `manageMaterials`, `approve`,
`viewPrices`, and `managePeriods`, with four actual boolean values; missing/extra/coerced values
return a typed 400 without changing the database. A configured non-admin approver must also hold
the module `approve` permission; global administrators satisfy that requirement automatically.
`resolveApprover` reads `mt_approval_config`, rejects inactive/missing approvers and self-approval
with an identifiable 409 configuration error, and has no client approver-override parameter.
- [x] **Step 4: Run targeted test and `npm run build`; expect PASS.**
- [ ] **Step 5: Stop after the three-file batch; commit with Task 2B when the route is integrated.**

### Task 2B: Expose administrator permission and approval configuration routes

**Files:**
- Create: `tests/materials-tooling-permission-routes.test.mjs`
- Create: `server/routes/materials-tooling.ts`

**Interfaces:**
- Admin endpoints list/update `/permissions` and `/approval-config` using the Task 2A core only.
- The router is created/configured with the application database explicitly; it must not depend on
  environment-based database selection or module-import side effects.
- Permission updates enforce the exact four-key boolean payload again at the HTTP boundary, and an
  approval configuration may target only an active user who currently has `approve` permission
  (or a global administrator).
- Requests cannot supply an approver when submitting a document; document workflow resolves the
  configured approver on the server.

- [x] **Step 1:** Write failing HTTP behavior tests for authentication, admin-only writes, active-user validation, explicit field allowlists, and typed 403/409 response mapping.
- [x] **Step 2:** Run the targeted test and confirm the route is missing.
- [x] **Step 3:** Add the router and keep SQL/business rules inside `permissions.ts`.
- [x] **Step 4:** Run the targeted test, full tests, and `npm run build`; expect PASS.
- [ ] **Step 5:** Commit `feat: add materials tooling permissions`, then stop.

### Task 3: Mount the API and implement material/supplier masters

**Files:**
- Create: `tests/materials-tooling-master.test.mjs`
- Modify: `server/routes/materials-tooling.ts`
- Modify: `server/index.ts:18,75`

**Interfaces:**
- Routes: `GET/POST/PUT /api/materials-tooling/items`, `GET/POST/PUT /suppliers`, `GET /me`.
- Item responses omit purchase summaries unless `viewPrices` is true.

- [x] **Step 1:** Write failing route-contract tests for route mounting, unique item code, fixed UOM, single string category, soft deactivation, audit calls, and price redaction.
- [x] **Step 2:** Run targeted test; expect route failures.
- [x] **Step 3:** Implement explicit field allowlists and transaction-wrapped writes.

```ts
router.get('/me', (req, res) => res.json(getMaterialsPermission(req.user!)));
router.post('/items', requireMaterialsPermission('manageMaterials'), (req, res) => {
  const { code, name, category, specification = null, unit, warehouse = null, bin_location = null, safety_quantity = 0, notes = null } = req.body ?? {};
  if (![code, name, category, unit].every(value => typeof value === 'string' && value.trim())) return res.status(400).json({ error: 'code, name, category, and unit are required' });
  if (!Number.isFinite(Number(safety_quantity)) || Number(safety_quantity) < 0) return res.status(400).json({ error: 'safety_quantity must be zero or greater' });
  return res.status(201).json(insertMaterialItem(req, { code, name, category, specification, unit, warehouse, bin_location, safety_quantity: Number(safety_quantity), notes }));
});
```

- [x] **Step 4:** Run `node --test tests/materials-tooling-master.test.mjs && npm run build`; expect PASS.
- [ ] **Step 5:** Commit `feat: add materials tooling masters`, then stop.

### Task 4A: Implement document numbering, workflow hardening, approval, and replacement

**Files:**
- Create: `tests/materials-tooling-documents.test.mjs`
- Create: `server/materials-tooling/documents.ts`
- Modify: `server/routes/materials-tooling.ts`

**Interfaces:**
- Produces `createDocument`, `submitDocument`, `approveDocument`, `rejectDocument`, `withdrawDocument`, `voidAndReplaceDocument`.
- Routes expose list/detail plus `/submit`, `/approve`, `/reject`, `/withdraw`, `/void-and-replace`.

- [x] **Step 1:** Write state-transition tests for prefixes `PR/GR/MI/MR/MS/CA/TM`, static approver assignment, rejection reason, self-approval 403, and new-number replacement with bidirectional IDs.
- [x] **Step 2:** Run targeted test; expect missing service.
- [x] **Step 3:** Implement transitions through a single guard:

```ts
const ALLOWED: Record<string, string[]> = {
  draft: ['pending_approval', 'withdrawn'],
  pending_approval: ['approved', 'rejected', 'withdrawn'],
  rejected: ['pending_approval', 'withdrawn'],
  approved: ['pending_execution'],
  pending_execution: ['executed'],
  executed: ['awaiting_signed_copy', 'voided'],
  awaiting_signed_copy: ['completed', 'voided'],
};
```

All state updates, approvals, and audit writes share one SQLite `IMMEDIATE` transaction. Workflow
and audit details use explicit field allowlists; purchase price, contract, invoice, and sensitive
free-text details are redacted for users without `viewPrices`. Until Task 5 can atomically reverse
stock, documents with existing `mt_movements` remain ineligible for void-and-replace.
- [x] **Step 4:** Run targeted test and build; expect PASS.
- [ ] **Step 5:** Commit `feat: add materials document workflow`, then stop.

### Task 4B: Freeze immutable document versions and version-link approvals

**Files:**
- Modify: `tests/materials-tooling-schema.test.mjs`
- Modify: `tests/materials-tooling-documents.test.mjs`
- Modify: `server/materials-tooling/schema.ts`
- Modify: `server/materials-tooling/documents.ts`
- Modify: `docs/superpowers/plans/2026-07-14-materials-tooling-implementation.md`

**Interfaces:**
- `mt_document_versions` stores one immutable `{header, lines}` snapshot for each submission and
  its lowercase SHA-256 digest, submitter, and submission timestamp.
- `mt_approvals(document_id, version)` references the exact frozen version and is append-only.
- Rejected documents may be edited back to `draft`; the next submission freezes the next version
  without overwriting prior versions or approvals.
- Service initialization fails closed if a non-draft legacy document or approval lacks its frozen
  version. Detail reads verify snapshot JSON shape and SHA before returning version history.
- Version history, approval comments, prices, contracts, invoices, and purchase free text follow
  the same `viewPrices` redaction boundary as the current document.

- [x] **Step 1:** Extend schema/document tests for the exact version contract, immutable triggers,
  version-linked approvals, rejected edit to draft/version increment, snapshot SHA integrity,
  legacy fail-closed behavior, and detail redaction.
- [x] **Step 2:** Run schema/document tests and confirm the version contract is RED.
- [x] **Step 3:** Add the version table, composite approval foreign key, append-only triggers, and
  transactional freeze/read behavior. Keep movement-bearing void-and-replace blocked; Task 5 owns
  the future atomic reversal path.
- [x] **Step 4:** Run schema/document tests, the combined Materials tests, full tests, build, and
  diff checks; expect PASS.
- [x] **Step 5:** Stop without staging or committing until the existing dirty integration set is
  ready for a buildable commit.

### Task 5A: Execute material movements atomically

**Files:**
- Create: `tests/materials-tooling-movements.test.mjs`
- Create: `server/materials-tooling/movements.ts`
- Modify: `server/routes/materials-tooling.ts`

**Interfaces:**
- Produces `getCurrentQuantity(itemId, asOf?)` and `executeMaterialDocument(req, documentId)`.
- Route: `POST /documents/:id/execute`.

- [x] **Step 1:** Write tests for full-only execution, final stock check, duplicate execution, fixed UOM, receipt/request fulfillment, return pricing, scrap, and adjustment deltas.
- [x] **Step 2:** Run targeted test; expect missing execution service.
- [x] **Step 3:** Implement one transaction that reloads the approved snapshot, validates every line, checks `current - issue >= 0`, inserts movements, updates linked request progress, changes status, and audits. Pending documents do not reserve quantity.

```ts
export const executeMaterialDocument = db.transaction((req: Request, id: string) => {
  const document = loadExecutableDocument(id);
  for (const line of document.lines) validateAndInsertMovement(document, line);
  markExecuted(document.id, req.user!.id);
  writeAudit(req, 'mt_document', id, 'execute', { status: { old: 'pending_execution', new: 'executed' } });
  return loadDocument(id);
});
```

- After Task 5A, `documents.ts` continues to reject void-and-replace when the original document has
  `mt_movements`. The stopgap guard is removed from the public path only after Task 5B provides an
  atomic reversal.
- [x] **Step 4:** Run targeted test and build; expect PASS.
- [ ] **Step 5:** Commit `feat: execute materials movements`, then stop.

### Task 5B: Reverse executed movements during void-and-replace

**Files:**
- Create: `tests/materials-tooling-void-reversal.test.mjs`
- Modify: `server/materials-tooling/movements.ts`
- Modify: `server/routes/materials-tooling.ts`

**Interfaces:**
- Produces `voidAndReplaceMaterialDocument(actor, documentId, { reason })` in the movement service.
- The public `POST /documents/:id/void-and-replace` route switches to the movement service; the
  movement-bearing stopgap in `documents.ts` is no longer reachable through the route.
- Only administrators may perform the operation. The original must be `executed`,
  `awaiting_signed_copy`, or `completed`, must not already have a replacement, and requires a
  non-empty reason.

- [x] **Step 1:** Write failing tests for administrator-only access, valid source statuses, required
  reason, one-for-one reversal, copied value/date references, duplicate prevention, new document
  numbering and bidirectional links, copied lines, audit records, and rollback on every injected
  failure.
- [x] **Step 2:** Run the targeted test; expect the route to remain blocked for movement-bearing
  documents.
- [x] **Step 3:** In one SQLite `IMMEDIATE` transaction, reload and lock the source state, read every
  original `mt_movements` row, and insert a `void_reversal` row with the opposite
  `quantity_delta`. Each reversal keeps the original item/document/line association,
  `reference_unit_price`, and `movement_date` so quantity and procurement-value history reconcile;
  its actor and `created_at` identify the correction event. Then mark the source voided, allocate a
  fresh yearly sequence number, create the draft replacement, copy its lines, write both
  `replaced_by_document_id` and `replaces_document_id`, and append redacted audit events. Any
  reversal, replacement, link, or audit failure rolls back the complete operation.
- [x] **Step 4:** Reject a second reversal through the source status/replacement guard and transaction
  recheck. A source with zero material movements follows the existing `documents.ts` behavior or
  the same unified service without synthetic reversal rows. Tooling movement reversal is explicitly
  deferred to Task 9 and must not use `mt_movements`.
- [x] **Step 5:** Run the targeted test, Materials combination, full tests, build, and diff checks;
  expect PASS, then stop after the three-file batch.

### Task 6: Add private attachments and signed-copy completion

**Files:**
- Create: `tests/materials-tooling-attachments.test.mjs`
- Create: `server/materials-tooling/attachments.ts`
- Modify: `server/routes/materials-tooling.ts`

**Interfaces:**
- Upload endpoint accepts PDF/JPG/PNG/XLS/XLSX/DOC/DOCX with a defined size limit.
- Download endpoint streams only after auth and sensitivity checks; optional signed token expires in <=60 seconds.

- [x] **Step 1:** Write failing tests for MIME/extension allowlist, private randomized stored names, price permission, path traversal rejection, expiry, immutable snapshots, and failed-upload status preservation.
- [x] **Step 2:** Run targeted test; expect missing attachment service.
- [x] **Step 3:** Implement storage under `data/materials-tooling/attachments`, never under `public` or `dist`; use `timingSafeEqual` for token signatures and `createHmac('sha256', tokenSecret)`.
- [x] **Step 4:** Run targeted test and build; expect PASS.
- [ ] **Step 5:** Commit `feat: secure materials attachments`, then stop.

### Task 7: Generate immutable document PDFs

**Files:**
- Create: `tests/materials-tooling-pdf.test.mjs`
- Create: `server/materials-tooling/pdf.ts`
- Modify: `server/routes/materials-tooling.ts`

**Interfaces:**
- Produces `generateMaterialDocumentPdf(document, variant): PDFKit.PDFDocument`.
- Routes: `/documents/:id/application.pdf`, `/documents/:id/approved.pdf`.

- [x] **Step 1:** Test A4 size, Chinese fonts, document/version number, lines, online approval, signature blocks, generation time, price redaction, and immutable snapshot metadata.
- [x] **Step 2:** Run targeted test; expect missing generator.
- [x] **Step 3:** Reuse `server/fonts/NotoSansSC-*.ttf` and PDFKit; store snapshot bytes privately and stream through authenticated endpoints.
- [x] **Step 4:** Run targeted test and build; manually open one generated PDF from anonymous fixture data.
- [ ] **Step 5:** Commit `feat: generate materials approval PDFs`, then stop.

### Task 8: Add monthly ledger, price history, close/reopen, and exports

**Files:**
- Create: `tests/materials-tooling-reporting.test.mjs`
- Create: `server/materials-tooling/reporting.ts`
- Modify: `server/routes/materials-tooling.ts`

**Interfaces:**
- Routes: `/overview`, `/ledger?month=YYYY-MM`, `/price-history/:itemId`, `/periods/:month/close`, `/reopen`, `/ledger.xlsx`, `/ledger.pdf`.

- [x] **Step 1:** Test opening/in/return/out/scrap/adjustment formula, last-purchase unlinked-return price, zero denominator, price redaction, A3 PDF, Excel grouped headings, close blockers, snapshot preservation, and back-date rejection.
- [x] **Step 2:** Run targeted test; expect missing reporting service.
- [x] **Step 3:** Implement parameterized queries and exact reference-price labels. `/overview` returns pending approvals, low-stock items, current-month receipt/issue totals, and overdue tooling counts with price totals omitted when permission disallows them. Use `XLSX.utils.aoa_to_sheet` for the warehouse column groups and PDFKit `{ size: 'A3', layout: 'landscape' }` for PDF.
- [x] **Step 4:** Run targeted test and build; inspect generated workbook headings against the supplied warehouse screenshot.
- [ ] **Step 5:** Commit `feat: add materials monthly reporting`, then stop.

### Task 9: Implement tooling lifecycle

**Files:**
- Create: `tests/materials-tooling-assets.test.mjs`
- Create: `server/materials-tooling/tooling.ts`
- Modify: `server/routes/materials-tooling.ts`

**Interfaces:**
- Routes: `GET/POST/PUT /tooling`, `POST /tooling/:id/movements`.
- Transitions: issue, return, loan, transfer, repair, repair completion, disposal, loss report.

- [x] **Step 1:** Test valid/invalid transitions, custody/location history, approval before disposal/loss, loss reason/evidence, and no reuse of material movements.
- [x] **Step 2:** Run targeted test; expect missing tooling service.
- [x] **Step 3:** Implement a state map and transactionally update asset plus append-only movement plus audit.
- [x] **Step 4:** Run targeted test and build; expect PASS.
- [ ] **Step 5:** Commit `feat: add tooling custody lifecycle`, then stop.

### Task 10: Add safe cutover import

**Files:**
- Create: `tests/materials-tooling-import.test.mjs`
- Create: `server/materials-tooling/import.ts`
- Modify: `server/routes/materials-tooling.ts`

**Interfaces:**
- Route `POST /imports/cutover` accepts `.xlsx` up to 5 MB and imports opening balances plus optional reference-only purchase history.

- [x] **Step 1:** Test preview-before-commit, required columns, duplicate codes, UOM validation, source workbook metadata, closed-period rejection, and all-or-nothing import.
- [x] **Step 2:** Run targeted test; expect missing importer.
- [x] **Step 3:** Parse with existing `xlsx`; require explicit `confirm: true` for writes; create `opening_balance` movements only, never synthetic business documents.
- [x] **Step 4:** Run targeted test and build with an anonymous fixture workbook.
- [ ] **Step 5:** Commit `feat: import materials cutover balances`, then stop.

### Task 11: Back up and restore attachments with the database

**Files:**
- Create: `tests/materials-tooling-backup.test.mjs`
- Modify: `scripts/backup-crm.sh`
- Modify: `scripts/restore-crm.sh`

**Interfaces:**
- New backups are `.tar.gz` archives containing a consistent `crm.db` plus `data/materials-tooling`.
- Restore continues accepting legacy `.db.gz` backups.

- [x] **Step 1:** Write a temp-directory test proving archive contents, checksum, restore, legacy compatibility, and refusal without `--confirm`.
- [x] **Step 2:** Run targeted test; expect attachments absent.
- [x] **Step 3:** Add `CRM_ROOT_DIR` test override, archive through a staging directory, restore database and attachment tree together, and retain the pre-restore backup behavior.
- [x] **Step 4:** Run the targeted test; do not run restore against the real CRM directory.
- [ ] **Step 5:** Commit `fix: back up materials attachments`, then stop.

### Task 12: Add an isolated full API smoke test

**Files:**
- Create: `tests/materials-tooling-api-smoke.mjs`
- Modify: `server/db.ts:6-8`
- Modify: `package.json:10-18`

**Interfaces:**
- `CRM_DB_PATH` selects a temporary database only when explicitly set.
- Script `smoke:materials` builds, runs a temporary server/database/upload directory, verifies all acceptance flows, and removes them.

- [x] **Step 1:** Write smoke setup with anonymous admin/member/clerk/approver users and assertions for permission, approval, execution, price redaction, close/reopen, tooling loss, replacement links, and duplicate-execution safety.
- [x] **Step 2:** Run `npm run smoke:materials`; expect failure because env DB selection is absent.
- [x] **Step 3:** Change DB resolution to `process.env.CRM_DB_PATH || path.join(__dirname, '..', 'crm.db')` and add the script.
- [x] **Step 4:** Run `npm run smoke:materials`; expect PASS and no changes to real `crm.db`.
- [ ] **Step 5:** Commit `test: add isolated materials workflow smoke`, then stop.

### Task 13: Add localization and sidebar entry

**Files:**
- Create: `tests/materials-tooling-navigation.test.mjs`
- Modify: `src/lib/i18n.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

**Interfaces:**
- Adds `nav.materialsTooling` and complete `page.materialsTooling.*` English/Chinese keys.
- Sidebar places `/materials-tooling` immediately after `/inventory`.

- [x] **Step 1:** Test menu order, icon, and required dictionary keys with no hard-coded English visible copy.
- [x] **Step 2:** Run targeted test; expect missing menu/key failures.
- [x] **Step 3:** Add concise Chinese labels for overview, materials, documents, ledger, tooling, approvals, settings, statuses, errors, exports, and sensitive-data notices.
- [x] **Step 4:** Run targeted test and `npm run build`; expect PASS.
- [ ] **Step 5:** Commit `feat: add materials tooling navigation`, then stop.

### Task 14: Add typed client and page shell

**Files:**
- Create: `tests/materials-tooling-shell.test.mjs`
- Create: `src/lib/materials-tooling-api.ts`
- Create: `src/pages/MaterialsToolingPage.tsx`

**Interfaces:**
- Typed API methods mirror server routes; downloads use authenticated `fetch` to Blob rather than permanent anchors.
- Shell provides Overview, Materials, Documents, Monthly Ledger, Tooling, and Approvals tabs.

- [x] **Step 1:** Test typed permission shape, authenticated Blob download, tab ARIA semantics, loading/error/empty states, and price-aware rendering.
- [x] **Step 2:** Run targeted test; expect missing files.
- [x] **Step 3:** Implement the API wrapper and a working overview showing pending approvals, low stock, monthly receipts/issues, and overdue tooling from real endpoints.
- [x] **Step 4:** Run targeted test and build; expect PASS.
- [ ] **Step 5:** Commit `feat: add materials tooling workspace`, then stop.

### Task 15: Register the frontend route

**Files:**
- Modify: `tests/materials-tooling-navigation.test.mjs`
- Modify: `src/App.tsx:24,69`
- Modify: `src/pages/MaterialsToolingPage.tsx`

- [x] **Step 1:** Add a failing assertion for `<Route path="/materials-tooling" element={<MaterialsToolingPage />}>`.
- [x] **Step 2:** Run targeted test; expect route failure.
- [x] **Step 3:** Import/register the page and ensure the shell owns internal tab state without touching Inventory.
- [x] **Step 4:** Run targeted test and build; expect PASS.
- [ ] **Step 5:** Commit `feat: route materials tooling workspace`, then stop.

### Task 16: Build Materials and Documents UI

**Files:**
- Create: `tests/materials-tooling-records-ui.test.mjs`
- Create: `src/components/materials-tooling/MaterialsTab.tsx`
- Create: `src/components/materials-tooling/DocumentsTab.tsx`

- [x] **Step 1:** Test searchable tables, fixed-UOM form, price-column permission, document filters, line editing, submit/withdraw/execute actions, disabled duplicate submits, and explicit API errors.
- [x] **Step 2:** Run targeted test; expect missing components.
- [x] **Step 3:** Implement both components using `data-surface`, sticky table headers, grouped fieldsets, responsive side panels, and typed APIs. Export named components consumed by the page in the next task.
- [x] **Step 4:** Run `node --test tests/materials-tooling-records-ui.test.mjs && npx tsc --noEmit`; expect PASS.
- [ ] **Step 5:** Commit `feat: build materials record forms`, then stop.

### Task 17: Build Ledger and Tooling UI

**Files:**
- Create: `tests/materials-tooling-ledger-tooling-ui.test.mjs`
- Create: `src/components/materials-tooling/LedgerTab.tsx`
- Create: `src/components/materials-tooling/ToolingTab.tsx`

- [x] **Step 1:** Test month selection, grouped columns, quantity-only member view, drill-down, Excel/PDF downloads, close/reopen controls, tooling status filters, and legal transition actions.
- [x] **Step 2:** Run targeted test; expect missing components.
- [x] **Step 3:** Implement wide-table horizontal scrolling without compressing values; use authenticated Blob downloads; show Lost/Disposed as terminal states.
- [x] **Step 4:** Run targeted test and build; expect PASS.
- [ ] **Step 5:** Commit `feat: build ledger and tooling views`, then stop.

### Task 18: Build approvals and admin settings UI

**Files:**
- Create: `tests/materials-tooling-approvals-ui.test.mjs`
- Create: `src/components/materials-tooling/ApprovalsTab.tsx`
- Create: `src/components/materials-tooling/MaterialsSettings.tsx`

- [x] **Step 1:** Test assigned queues, self-approval absence, approve/reject reason, immutable versions/PDF links, clerk/approver toggles, static per-type approvers, and admin-only settings.
- [x] **Step 2:** Run targeted test; expect missing components.
- [x] **Step 3:** Implement queues and settings with server-returned permissions as the source of truth.
- [x] **Step 4:** Run targeted test and build; expect PASS.
- [ ] **Step 5:** Commit `feat: add materials approvals and settings`, then stop.

### Task 19: Wire all tabs into the page

**Files:**
- Modify: `tests/materials-tooling-shell.test.mjs`
- Modify: `src/pages/MaterialsToolingPage.tsx`
- Modify: `src/lib/materials-tooling-api.ts`

- [x] **Step 1:** Add failing assertions that every tab renders its component and settings appear only for admins.
- [x] **Step 2:** Run targeted test; expect missing wiring.
- [x] **Step 3:** Wire all five components and expose these exact client methods: `getOverview`, `listItems`, `createItem`, `updateItem`, `listDocuments`, `getDocument`, `createDocument`, `submitDocument`, `approveDocument`, `rejectDocument`, `withdrawDocument`, `executeDocument`, `voidAndReplaceDocument`, `uploadAttachment`, `downloadAttachment`, `downloadApplicationPdf`, `downloadApprovedPdf`, `listLedger`, `getPriceHistory`, `closePeriod`, `reopenPeriod`, `downloadLedgerXlsx`, `downloadLedgerPdf`, `listTooling`, `createTooling`, `moveTooling`, `previewCutoverImport`, `confirmCutoverImport`, `getPermissions`, `updatePermissions`, and `updateApprovalConfig`. Preserve the selected tab after mutations and refetch only that tab's query.
- [x] **Step 4:** Run all materials UI tests and build; expect PASS.
- [ ] **Step 5:** Commit `feat: complete materials tooling interface`, then stop.

### Task 20: Final verification and operator documentation

**Files:**
- Create: `docs/materials-tooling-operator-guide.md`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-07-14-materials-tooling-implementation.md`

- [x] **Step 1:** Run `npm run test`; expected all Node tests PASS.
- [x] **Step 2:** Run `npm run build`; expected Vite and server TypeScript builds PASS.
- [x] **Step 3:** Run `npm run smoke:materials`; expected isolated acceptance smoke PASS with no real database changes.
- [x] **Step 4:** Run `npm run smoke:api`; explain that it writes anonymous temporary records to the local CRM and cleans them; expected PASS.
- [x] **Step 5:** Manually verify member, Moana/clerk, approver, and admin views; A4 application/approved PDFs; signed-copy upload; Excel/A3 ledger; month close; tooling loss; backup archive contents.
- [x] **Step 6:** Document daily use, permissions, month close, correction, attachment security, cutover import, backup/restore, and unsupported workflows. Mark every completed plan checkbox truthfully.
- [ ] **Step 7:** Commit:

```bash
git add docs/materials-tooling-operator-guide.md README.md docs/superpowers/plans/2026-07-14-materials-tooling-implementation.md
git commit -m "docs: add materials tooling operations guide"
```

## Plan Self-Review Checklist

- Every design section maps to Tasks 1-20.
- No task touches more than three files.
- Every task starts with a failing check and ends with verification plus a commit.
- Existing dependencies cover uploads, PDF, and Excel.
- Sensitive price and attachment checks occur on the server and in smoke tests.
- Inventory is checked at execution, not submission.
- Replacement numbering, single UOM, partial receipt fulfillment, tooling loss, month close, and isolated backup are explicitly tested.
- Existing dirty worktree files are never staged unless named by the active task.
