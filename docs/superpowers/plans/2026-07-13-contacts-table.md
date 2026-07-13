# Contacts Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Contacts card grid with a compact searchable table and support WeChat-first domestic contacts without requiring email.

**Architecture:** Add `wechat_id` through the existing additive SQLite migration pattern, enforce one-of-four contact method validation in the contacts route, and expose company country in contact reads. Extend the existing side panel and rebuild only the Contacts list presentation around existing shared table primitives.

**Tech Stack:** React 18, TypeScript, Express, better-sqlite3, Tailwind CSS, react-i18next, Node test runner.

## Global Constraints

- Keep the existing contact create/edit side panel and current routes.
- Add no production dependency and perform no destructive migration.
- Preserve all existing contact records.
- Email, direct phone, mobile phone, and WeChat are alternative contact methods; at least one is required.
- Country/region is resolved from the associated company.
- Modify no more than three files per implementation batch.

---

### Task 1: Contact Data Model And Validation

**Files:**
- Modify: `server/db.ts`
- Modify: `server/routes/contacts.ts`
- Test: `tests/contact-directory.test.mjs`

**Interfaces:**
- Produces: nullable `contacts.wechat_id`; contact API fields `wechat_id` and `company_country`.
- Produces: HTTP 400 `{ success: false, message: 'At least one contact method is required' }` when all four contact methods are empty.

- [ ] **Step 1: Write failing migration and route source tests**

Assert that `server/db.ts` adds `wechat_id`, the route selects `co.country as company_country`, searches `wechat_id`, and validates at least one contact method on create and merged updates.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/contact-directory.test.mjs`

- [ ] **Step 3: Add the schema and route behavior**

Add `wechat_id TEXT` to new schemas and the additive migration list. Add a `hasContactMethod` helper, include the field in create/update, return company country, and validate partial updates against the stored record merged with the request.

- [ ] **Step 4: Run focused tests and server type checking**

Run: `node --test tests/contact-directory.test.mjs`

Run: `npx tsc -p tsconfig.server.json --noEmit`

---

### Task 2: Contact Side Panel

**Files:**
- Modify: `src/components/contacts/ContactPanel.tsx`
- Modify: `src/lib/i18n.tsx`
- Test: `tests/contact-directory.test.mjs`

**Interfaces:**
- Consumes: contact API `wechat_id` and one-of-four validation contract.
- Produces: optional email input, WeChat input, and localized contact-method validation feedback.

- [ ] **Step 1: Add failing UI source assertions**

Assert that the form contains `wechat_id`, does not reject empty email alone, and checks the four contact methods before save.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/contact-directory.test.mjs`

- [ ] **Step 3: Extend the panel form**

Add `wechat_id` to form state and payloads, remove the email-required marker, add the localized WeChat field, and show a localized error when every contact method is blank.

- [ ] **Step 4: Run focused tests and frontend type checking**

Run: `node --test tests/contact-directory.test.mjs`

Run: `npx tsc --noEmit`

---

### Task 3: Contacts Operational Table

**Files:**
- Modify: `src/pages/Contacts.tsx`
- Modify: `src/lib/i18n.tsx`
- Test: `tests/contact-directory.test.mjs`

**Interfaces:**
- Consumes: contact fields `wechat_id`, `company_country`, `is_active`, and existing edit panel callbacks.
- Produces: sortable and filterable table with Contact, Company, Phone/WeChat, Email, Country/Region, Status, and Actions columns.

- [ ] **Step 1: Add failing table assertions**

Assert removal of the card grid, presence of the shared data table, status filter, sort control, responsive country/email/status columns, row edit behavior, and retained actions menu.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test tests/contact-directory.test.mjs`

- [ ] **Step 3: Replace cards with the table**

Keep search, company filter, CSV, and side panel. Add client-side status filtering and sorting, table-row skeletons, stable responsive columns, row-click editing, linked companies, compact contact indicators, phone/WeChat lines, status badges, and existing actions.

- [ ] **Step 4: Run focused tests and frontend type checking**

Run: `node --test tests/contact-directory.test.mjs`

Run: `npx tsc --noEmit`

---

### Task 4: Full Verification

**Files:**
- Modify only if a verification failure is directly caused by this feature.

- [ ] **Step 1: Run all automated tests**

Run: `npm run test`

- [ ] **Step 2: Run frontend and server type checks**

Run: `npx tsc --noEmit`

Run: `npx tsc -p tsconfig.server.json --noEmit`

- [ ] **Step 3: Build the formal bundle**

Run: `npm run build`

- [ ] **Step 4: Verify the live Contacts page**

Confirm table layout, responsive visibility, filters, sort order, row editing, menu placement, WeChat-only contact creation, and absence of console errors without using real customer data.

