# Payments Soft Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the linked order owner on Payments, preserve truthful actor metadata, and restrict invoice/payment writes to the order owner or an administrator.

**Architecture:** Extend authenticated request identity with `role`, then centralize owner-or-admin authorization in a focused server helper. Payments reads remain open to authenticated users; every write resolves ownership through the linked order before entering its transaction. The frontend consumes server-provided ownership and permission fields, displays owner separately from actor metadata, and keeps unauthorized records read-only.

**Tech Stack:** Express, TypeScript, SQLite/better-sqlite3, React, react-i18next, Node test runner.

## Global Constraints

- Add no production dependency.
- Do not fabricate historical creator or updater identities.
- Enforce write authorization on the server, not only in React.
- Preserve existing payment validation, audit transactions, typography, and table density.
- Process no more than three files per implementation batch.

---

### Task 1: Authenticated role and reusable authorization

**Files:**
- Create: `server/authorize.ts`
- Modify: `server/auth.ts`
- Test: `tests/payment-ownership.test.mjs`

**Interfaces:**
- Produces: `Request.user: { id: string; name: string; role: string }`
- Produces: `canManageOwnedRecord(user, ownerUserId): boolean`
- Produces: `requireOwnedRecord(req, res, ownerUserId): boolean`

- [x] Write a failing test requiring role-aware authentication and owner/admin authorization.
- [x] Run `node --test tests/payment-ownership.test.mjs` and verify failure.
- [x] Select `role` in `authMiddleware` and add the focused authorization helper.
- [x] Run the targeted test and `npx tsc -p tsconfig.server.json --noEmit`.

### Task 2: Payments ownership reads and write enforcement

**Files:**
- Modify: `server/routes/payments.ts`
- Modify: `tests/payment-ownership.test.mjs`
- Modify: `tests/api-write-smoke.mjs`

**Interfaces:**
- Consumes: `requireOwnedRecord(req, res, ownerUserId)` from Task 1.
- Produces: invoice list/detail fields `owner_user_id`, `owner_name`, `created_by_name`, `updated_by_name`, and `can_edit`.

- [x] Extend the failing test to require order-owner joins and authorization on create, update, payment, and delete.
- [x] Verify the test fails for missing behavior.
- [x] Join the order owner and actor names on reads.
- [x] Require owner/admin permission before invoice creation, update, and payment recording.
- [x] Require administrator role for invoice deletion.
- [x] Keep authenticated list/detail reads unrestricted.
- [x] Extend smoke coverage for member-owned writes, cross-owner `403`, and administrator override.
- [x] Run targeted tests and server type checking.

### Task 3: Payments owner and actor UI

**Files:**
- Modify: `src/pages/Payments.tsx`
- Modify: `src/lib/i18n.tsx`
- Modify: `tests/payment-ownership.test.mjs`

**Interfaces:**
- Consumes: Payments API fields from Task 2.
- Produces: owner list column, read-only metadata in edit modal, and permission-aware controls.

- [x] Add failing frontend assertions for `Owner`, truthful historical fallback, metadata labels, and disabled cross-owner actions.
- [x] Verify the assertions fail.
- [x] Replace `Last updated by` with the linked order owner.
- [x] Show owner, creator, and updater as read-only metadata in the edit modal.
- [x] Render `Historical data - not recorded` when actor metadata is null.
- [x] Disable edit and payment actions when `can_edit` is false, with a concise explanation.
- [x] Preserve server error messages if authorization changes after the page loads.
- [x] Run the targeted test and frontend type checking.

### Task 4: Final verification

**Files:**
- Modify: `PLANS.md`

- [x] Run `npm run backup` before write verification.
- [x] Run `npm run test` and require zero failures.
- [x] Run frontend and server TypeScript checks.
- [x] Run `npm run build` and record any non-blocking warning.
- [x] Run `npm run smoke:api` and verify isolated cleanup.
- [x] Update `PLANS.md` with completed Payments soft-ownership verification.
