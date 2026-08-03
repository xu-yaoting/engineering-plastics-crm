# Order Owner Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let administrators assign order owners, prevent members from transferring ownership, and backfill old orders from company ownership.

**Architecture:** Keep the order as the source of truth for Payments ownership. Add an administrator-only selector to the existing order edit dialog and enforce the same rule in the order update route. Backfill only currently unassigned orders after taking a database backup.

**Tech Stack:** React, TypeScript, Express, SQLite, Node test runner

## Global Constraints

- Add no dependency.
- Payments ownership remains derived from `orders.owner_user_id`.
- Members cannot change `owner_user_id`.
- Existing creator/updater history is not fabricated.
- Modify no more than three source/test files in the code batch.

---

### Task 1: Protect and expose order ownership

**Files:**
- Modify: `tests/team-accountability.test.mjs`
- Modify: `server/routes/orders.ts`
- Modify: `src/pages/OrderDetail.tsx`

**Interfaces:**
- Consumes: `req.user.role`, `team.list()`, `useAuth()`
- Produces: administrator-only `owner_user_id` updates through `PUT /api/orders/:id`

- [x] **Step 1: Write failing static checks**

Add assertions that the order route rejects a member-supplied owner transfer and that the order edit dialog loads active team members and only renders its owner selector for administrators.

- [x] **Step 2: Run the targeted test and verify failure**

Run: `node --test tests/team-accountability.test.mjs`
Expected: FAIL because the order route and edit dialog do not yet enforce or expose owner transfer.

- [x] **Step 3: Implement server authorization**

Before updating an order, return HTTP 403 when `owner_user_id` is present and differs from the stored value unless `req.user.role === 'admin'`.

- [x] **Step 4: Implement the administrator selector**

Load `team.list()` for administrators, include `owner_user_id` in the edit form, and render an Owner select with Unassigned plus active team members. Members keep the read-only accountability display.

- [x] **Step 5: Verify the code batch**

Run the targeted test, full tests, frontend typecheck, and server typecheck. All must pass.

### Task 2: Backfill historical order owners

**Files:**
- Modify data only: `crm.db`

**Interfaces:**
- Consumes: `companies.owner_user_id`
- Produces: `orders.owner_user_id` for currently unassigned active orders

- [x] **Step 1: Back up the database**

Run: `npm run backup`
Expected: a timestamped compressed backup under `backups/`.

- [x] **Step 2: Preview the exact assignments**

Query unassigned active orders joined to their company and owner. Expected: 13 assignments, two to Nathan and eleven to Moana.

- [x] **Step 3: Perform one guarded update**

Set each active order's `owner_user_id` from its active company's owner only when the order is currently unassigned and the company owner is non-null.

- [x] **Step 4: Verify ownership propagation**

Confirm zero active orders remain unassigned and Payments resolve the same owner names through their linked orders.

- [x] **Step 5: Run API smoke verification**

Run: `npm run smoke:api`
Expected: all write modules pass and smoke data is cleaned up.
