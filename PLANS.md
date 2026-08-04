# CRM Company Workspace Simplification Plan

# CRM Release Defect Repair Plan (2026-08-04)

**Current goal:** Resolve the defects found in the full CRM acceptance pass while keeping the confirmed quotation-primary workflow, preserving legacy Inquiry URLs as redirects, and avoiding production data or schema changes.

**Repair order:**
1. [x] Restore the quotation-created Company development-stage transition and add a regression assertion.
2. [x] Make the isolated write smoke flow follow the quotation-primary API while preserving a clear legacy Inquiry compatibility response.
3. [x] Complete quotation editor labels and explicitly decide whether the removed discount controls remain out of scope; align static contracts with the current seven-column list.
4. [x] Normalize list toolbar/empty-state markup and commercial action-menu surfaces.
5. [x] Run targeted tests, full tests, typecheck, build, diff checks, and isolated API smoke.

**Constraints:**
- No database migration, production dependency, deployment, push, or real-customer data writes.
- Keep changes to no more than three files per batch.
- Preserve `/inquiries/*` redirects and existing stored legacy fields unless a compatibility issue requires a narrowly scoped response.
- Do not remove the existing test-generated PDF change from the worktree without user direction.

**Verification:** `npm run test`, `npm run smoke:api`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`.

**Current goal:** Rebalance the desktop Company workspace around actionable follow-up and sales work, remove duplicated summaries, and make Follow-ups a direct Sales navigation destination.

**Confirmed product decisions:**
- Company Detail uses a top action summary, a primary opportunities/activity column, and one short supporting rail.
- The top summary shows active quotation value, open inquiry/quotation counts, next follow-up, pending tasks, and one recommended action.
- Recent Activity, Pipeline Summary, Quick Stats, and the existing Customer Briefing are removed instead of hidden in accordions.
- The supporting rail keeps Primary Contact, up to three pending tasks, Owner, and entry points for Company Details and Operation History.
- Full company information and audit history use progressive disclosure through side panels.
- Follow-ups appears directly below Companies in the Sales sidebar.
- Contact Directory remains company-scoped and accessible from Company screens; its existing routes remain compatible.
- Desktop information hierarchy is completed and verified before further mobile refinement.

**Implementation order:**
1. [x] Add Follow-ups directly after Companies in the Sales sidebar.
2. [x] Remove the Company module tab bar and normalize the Follow-up Workbench page heading.
3. [x] Replace Company Detail summaries with the compact top action summary.
4. [x] Reduce the supporting rail to Primary Contact, pending tasks, Owner, and detail entry points.
5. [x] Move full Company Details and Operation History into side panels.
6. [x] Run desktop browser QA, accessibility checks, tests, typecheck, build, and diff verification.

**Constraints and verification:**
- No database migration, API contract change, new production dependency, or route removal.
- Preserve bilingual copy, ownership, permissions, audit data, follow-up behavior, and contact-detail fallbacks.
- Change no more than three files per batch and pause at every batch boundary.
- Add a user-facing static UI regression before or with each behavior slice.
- Final verification: `npx tsc --noEmit`, `npm run test`, `npm run build`, and `git diff --check`.

---

# CRM Mobile Optimization Plan

**Current goal:** Make the existing CRM usable on phone-sized viewports without changing routes, business workflows, APIs, stored data, or the desktop information hierarchy.

**Design direction:** Treat mobile as a focused single-column workflow: full-height navigation drawer, compact page headers, readable touch targets, and progressive disclosure for secondary company details.

**Implementation order:**
1. [x] Harden the mobile app shell, navigation drawer, viewport sizing, and background scroll behavior.
2. [x] Reflow Company List, Follow-up Workbench, and Contact Directory for narrow screens.
3. [x] Rework Company Detail header, action summary, opportunity cards, activity timeline, and support rail for phone widths.
4. [x] Reflow shared panels, forms, tables, and dense operational pages that still clip or force horizontal scrolling.
5. [x] Run 390×844 and 430×932 browser QA, keyboard/accessibility checks, tests, typecheck, build, and diff verification.

**Constraints:**
- Keep React, Tailwind, Lucide, existing bilingual copy, permissions, and route compatibility.
- Add no production dependency, database migration, API contract change, or public deployment.
- Change no more than three files per batch and stop at each batch boundary.
- Keep mobile changes additive and preserve the confirmed desktop layout.

---

# CRM Customer Development and Follow-up Plan

**Current goal:** Make Company the primary customer record, add a reliable cross-company follow-up workflow, simplify Company Detail, and demote Contacts to a company-scoped directory without mixing customer development with the existing sales pipeline.

**Confirmed product decisions:**
- Companies owns three related views: Company List, Follow-up Workbench, and Contact Directory.
- The Follow-up Workbench covers both prospect development and existing-customer maintenance.
- Customer development uses `Uncontacted → Contacted → Replied → Qualified → Converted`, with `Nurturing` and `Stopped` as side states.
- The existing sales pipeline remains `Inquiry → Quotation → Sample/Testing → Order`.
- Company is the customer subject; Contact is a person and role within one Company.
- Activities and follow-up tasks belong to Company and may identify a Contact.
- The earliest open follow-up task is the single source of truth for the next follow-up date.

**Data and migration assumptions:**
- Use additive SQLite migrations only; preserve all existing records.
- Back up the local database before applying migrations.
- Add a Company development stage, an optional task Contact reference, and an optional activity outcome.
- Initialize existing Company stages deterministically: records with inquiries or orders are Converted; records with inbound customer activity are Replied; records with outbound contact activity are Contacted; remaining records are Uncontacted.
- Do not infer Nurturing or Stopped from elapsed time.
- Creating an Inquiry moves its Company to Converted.
- A Contact may be saved without a direct channel; Company public contact details provide a visible fallback.

**Implementation order:**
1. [x] Back up the current local database and record the confirmed plan and domain language.
2. [x] Add migration-safe schema fields, indexes, and deterministic existing-data initialization.
3. [x] Add transactional follow-up read/write contracts and Inquiry-driven conversion.
4. [x] Add typed frontend contracts and bilingual customer-development copy.
5. [x] Build one reusable follow-up recording panel.
6. [x] Build the cross-company Follow-up Workbench.
7. [x] Add the Company module navigation without adding a new primary sidebar item.
8. [x] Allow Contacts without direct contact details and expose Company fallback details.
9. [x] Simplify the Contact Directory and remove it from primary navigation.
10. [x] Replace Company Detail's three-column information wall with a two-column, single-scroll workspace.
11. [x] Run migration, API, UI, accessibility, type, test, build, and diff verification.

**Batch constraints:**
- Change no more than three files per implementation batch.
- Add no production dependency.
- Write regression coverage before or with each behavioral change.
- Preserve bilingual UI, authentication, ownership, permissions, and audit behavior.
- Keep existing routes working unless the confirmed module navigation explicitly adds a route.
- Pause at each batch boundary for review.

**Verification:**
- Test migrations against temporary legacy-shaped databases and verify repeatability.
- Test follow-up recording as one transaction: activity creation, current-task completion, next-task creation, and Company stage update.
- Test Contact ownership and reject cross-company Contact references.
- Test stage initialization and automatic conversion when an Inquiry is created.
- Test Company contact-detail fallback without duplicating identical values.
- Run targeted Node tests after every batch.
- Final: `npx tsc --noEmit`, `npm run test`, `npm run build`, and `git diff --check`.
- Run the local write smoke test only after explaining its database impact.

**Out of scope for this rollout:**
- Automatic email sending or multi-step email sequences.
- Email-open tracking.
- External email, browser, or mobile notifications.
- AI summaries and customer-health scoring.
- Existing sales-pipeline redesign.
- Global search and Command-K redesign.

---

# CRM Form Accessibility Completion Sweep

**Current goal:** Eliminate the remaining unlabeled `input`, `select`, and `textarea` controls identified by the TypeScript JSX audit without changing workflows, routes, APIs, dependencies, or stored data.

**Scope and assumptions:**
- Associate existing visible labels through matching `htmlFor` and `id`.
- Add screen-reader-only labels for compact search and filter controls where a visible label would add noise.
- Preserve bilingual copy by reusing existing translation keys.
- Keep each implementation batch to two UI files plus one shared static regression test.

**Remaining implementation order:**
1. [x] Shared meeting notes and material settings.
2. [x] Contact and quotation lists.
3. [x] Material documents and ledger filters.
4. [x] Shared activity timeline and email draft controls.
5. [x] Inquiry list and order detail editor.
6. [x] Order list and top-bar search.
7. [x] Material approvals and task quick-add.
8. [x] Activity and payment controls.
9. [x] Pipeline and shipment controls.
10. [x] Full JSX rescan, tests, typecheck, build, and diff validation.

**Verification:**
- Targeted Node static UI test after every two-file slice.
- Final JSX AST scan must report zero unlabeled form controls.
- `npx tsc --noEmit`
- `npm run test`
- `npm run build`
- `git diff --check`

---

# CRM P0 UI Consistency Repair Plan

**Current goal:** Finish the eight P0 UI consistency repairs identified in the VibeHub-informed audit without changing CRM workflows, routes, dependencies, or stored data.

**Design direction:** Keep the existing Precision Industrial language, use one blue brand accent, reserve red for risk and destructive states, and make shared interaction patterns predictable across dense desktop workflows.

**Constraints:**
- Keep React, Tailwind 3, Lucide, the existing typography system, and current routes.
- Add no production dependency and make no database or API schema change.
- Preserve bilingual layout and existing permissions.
- Change no more than three files per batch and verify each batch before continuing.
- Reuse the existing Node static UI contract tests as the public test seam.

**P0 implementation order:**
1. [x] Complete dark mode with dark surface, text, border, interaction, and semantic-state tokens.
2. [x] Replace hard-coded brand blue with the shared brand token.
3. [x] Reserve danger red for overdue, failed, destructive, and genuinely abnormal states.
4. [x] Route create, quick-edit, and contextual detail flows through side panels; keep short decisions in centered dialogs.
5. [x] Replace native and ad-hoc delete confirmation with one accessible confirmation dialog.
6. [x] Add persistent form labels and field-level validation messages to the audited forms.
7. [x] Replace generic loading text and premature zero metrics with layout-shaped skeleton states.
8. [x] Remove nested fixed-width columns that break the responsive company workspace.

**Expected affected areas:**
- Theme and tokens: `src/index.css`, `src/lib/theme.tsx`, `src/components/layout/Sidebar.tsx`
- Semantic colors: `src/pages/Dashboard.tsx`, `src/pages/InventoryPage.tsx`
- Panels and confirmations: shared overlays plus companies, contacts, quotations, orders, shipments, payments, activities, tasks, inventory, and materials tooling
- Forms: `CompanyEditPanel.tsx`, `ContactPanel.tsx`, `QuotationEditPanel.tsx`, `InventoryPage.tsx`
- Loading: `App.tsx`, dashboard, pipeline, inventory, and record detail pages
- Responsive workspace: `ResponsiveWorkspace.tsx`, `CompanyDetail.tsx`

**Verification:**
- Targeted `node --test tests/ui-p0-*.test.mjs` after each slice
- `npx tsc --noEmit`
- `npm run test`
- `npm run build`
- `git diff --check`

---

# CRM Team Accountability Plan

**Current goal:** Make ownership and every important write operation attributable to a real CRM user for the current 2-3 person internal team.

**Rules:**
- Ownership and operation history are separate concepts.
- Store user IDs in records; resolve names from `users` when displaying them.
- New sales records default to the current user and inherit customer ownership where appropriate.
- Historical records remain unassigned until an administrator assigns them.
- Inventory changes must remain ledger-based and record before/change/after quantities.
- Keep permissions simple for the internal team: administrators manage accounts; authenticated members collaborate and every key write is audited.

**Implementation order:**
1. [x] Add ownership, creator, and updater fields with additive migrations.
2. [x] Add field-level audit diffing and a protected history API.
3. [x] Complete audit coverage for companies, contacts, tasks, and inventory.
4. [x] Default and inherit ownership through customers, inquiries, quotations, and orders.
5. [x] Add owner columns, filters, assignment, metadata, and history UI.
6. [x] Verify migrations, tests, build, and isolated API smoke writes.

**Completed verification (2026-07-13):** 167 automated tests, frontend and server type checks, production build, database backup, and isolated API write smoke across nine modules.

**Payments soft ownership (2026-07-13):** Payments display linked order owners, preserve truthful actor metadata, and enforce owner-or-admin invoice/payment writes. Verified with 170 automated tests and three-account API smoke coverage.

**Domestic-first shipments (2026-07-13):** Simplify the shipment list around domestic express/logistics, move sea/air schedule details to the detail page, and make shipment forms type-aware without a database migration.

---

# CRM Product UI Refinement Plan

**Current goal:** Give the local CRM a distinctive, professional Precision Industrial visual language without changing its typography system or business workflows.

**Design direction:** Attio-inspired information discipline, cool neutral surfaces, one blue brand accent, restrained status color, compact motion, and clear operational hierarchy.

**Constraints:**
- Keep React, Tailwind 3, Lucide, the existing font scale, and current routes.
- Add no production dependency.
- Preserve bilingual layout and dense desktop workflows.
- Use cards only where a framed surface communicates real hierarchy.
- Change no more than three files per batch and verify each batch.

**Implementation order:**
1. [x] Establish `DESIGN.md`, shared surface tokens, page shells, toolbars, and interaction primitives.
2. [x] Reshape Workspace hierarchy and reduce repetitive cards.
3. [x] Use Customers as the canonical list-page pattern.
4. [x] Apply the list pattern to quotations and orders.
5. [x] Apply the list pattern to shipments, payments, and inventory.
6. [x] Standardize side panels, modals, forms, loading, empty, and error states.
7. [x] Audit icon semantics, sizes, tooltips, focus, hover, and pressed states.
8. [x] Complete the Attio-style density pass: sentence-case headers, stable row heights, responsive action wrapping, and restrained segmented controls.
9. [x] Verify responsive layout constraints, tests, type checking, build, and static visual regressions.

---

# Previous CRM Chinese Localization Plan

**Goal:** Finish the Simplified Chinese UI for the local CRM in small, safe batches.

**Tone:** Use concise personal-workflow Chinese, not formal enterprise wording.

**Assumptions:**
- The existing `react-i18next` setup stays in place.
- Existing translated pages should be checked and polished, not rebuilt.
- Customer-entered data, product grades, material names, SKU, company names, currency codes, and file formats stay as-is.
- No production deployment, database migration, or dependency change is needed.

**Current batch:** Local formal release preparation.

**Affected files for batch 1:**
- `src/lib/i18n.tsx`
- `src/pages/Companies.tsx`
- `src/pages/Contacts.tsx`
- `src/components/contacts/ContactPanel.tsx`
- `tests/i18n-first-batch.test.mjs`

**Affected files for batch 2:**
- `src/lib/i18n.tsx`
- `src/pages/InquiryNew.tsx`
- `src/pages/InquiryDetail.tsx`
- `src/pages/Quotations.tsx`
- `tests/i18n-second-batch.test.mjs`

**Affected files for batch 3:**
- `src/lib/i18n.tsx`
- `src/pages/QuotationDetail.tsx`
- `src/components/quotations/QuotationEditPanel.tsx`
- `src/pages/OrderDetail.tsx`
- `tests/i18n-third-batch.test.mjs`

**Affected files for batch 4:**
- `src/lib/i18n.tsx`
- `src/pages/InventoryPage.tsx`
- `tests/inventory-ui.test.mjs`

**Affected files for batch 5a:**
- `src/lib/i18n.tsx`
- `src/components/shared/ActivityTimeline.tsx`
- `src/components/shared/MeetingNotes.tsx`
- `src/components/shared/TaskSection.tsx`
- `tests/i18n-shared-batch.test.mjs`

**Affected files for batch 5b:**
- `src/lib/i18n.tsx`
- `src/components/shared/QuoteAssistant.tsx`
- `tests/i18n-quote-assistant.test.mjs`

**Affected files for batch 6:**
- `src/lib/i18n.tsx`
- `src/pages/Dashboard.tsx`
- `tests/i18n-dashboard.test.mjs`

**Affected files for batch 7:**
- `src/lib/i18n.tsx`
- `src/pages/Payments.tsx`
- `src/pages/Shipments.tsx`
- `src/pages/ShipmentDetail.tsx`
- `tests/i18n-fulfillment-payments.test.mjs`

**Affected files for batch 8:**
- `src/lib/i18n.tsx`
- `src/pages/Inquiries.tsx`
- `src/pages/Orders.tsx`
- `src/pages/Tasks.tsx`
- `tests/i18n-list-pages.test.mjs`

**Affected files for batch 9:**
- `src/lib/i18n.tsx`
- `src/pages/CompanyDetail.tsx`
- `src/pages/Activities.tsx`
- `src/pages/SettingsProfile.tsx`
- `tests/i18n-profile-activity-detail.test.mjs`

**Affected files for batch 10:**
- `src/lib/i18n.tsx`
- `src/components/shared/ResponsiveWorkspace.tsx`
- `src/components/shared/StatusBadge.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/shared/AboutModal.tsx`
- `src/components/pipeline/PipelineColumn.tsx`
- `src/pages/Pipeline.tsx`
- `src/pages/InventoryPage.tsx`
- `tests/i18n-shared-components.test.mjs`

**Affected files for typography batch:**
- `tailwind.config.js`
- `src/index.css`
- `src/pages/**/*.tsx`
- `src/components/**/*.tsx`
- `tests/typography-system.test.mjs`

**Affected files for save workflow fixes:**
- `src/components/contacts/ContactPanel.tsx`
- `src/pages/InventoryPage.tsx`
- `src/pages/SettingsProfile.tsx`
- `src/components/shared/UserMenu.tsx`
- `tests/user-reported-workflow-fixes.test.mjs`

**Affected files for local release preparation:**
- `docs/local-release-checklist.md`
- `README.md`
- `start-crm.sh`
- backup and restore scripts, if added in a later batch

## Milestones

- [x] Add a lightweight test that catches obvious hard-coded English UI labels in the first batch.
- [x] Add concise Chinese dictionary entries for customer/contact labels, import UI, role labels, and toast messages.
- [x] Replace hard-coded English UI in `Contacts.tsx`.
- [x] Replace hard-coded English UI in `ContactPanel.tsx`.
- [x] Replace hard-coded English UI in `Companies.tsx`.
- [x] Run the targeted test, full lightweight test suite, typecheck, and build.
- [x] Pause after this batch for review before moving to the next 2-3 files.
- [x] Add a lightweight test for obvious hard-coded English UI labels in inquiry/quotation list files.
- [x] Add concise Chinese dictionary entries for inquiry detail, source/urgency labels, quotation statuses, and table headers.
- [x] Replace hard-coded English UI in `InquiryNew.tsx`.
- [x] Replace hard-coded English UI in `InquiryDetail.tsx`.
- [x] Replace hard-coded English UI in `Quotations.tsx`.
- [x] Run the targeted test, full lightweight test suite, typecheck, and build.
- [x] Pause after this batch for review before moving to quotation/order details.
- [x] Add a lightweight test for obvious hard-coded English UI labels in quotation/order detail files.
- [x] Add concise Chinese dictionary entries for quote actions, sample requests, order summary, shipment previews, and invoice summaries.
- [x] Replace hard-coded English UI in `QuotationDetail.tsx`.
- [x] Replace hard-coded English UI in `QuotationEditPanel.tsx`.
- [x] Replace hard-coded English UI in `OrderDetail.tsx`.
- [x] Run the targeted test, full lightweight test suite, typecheck, and build.
- [x] Pause after this batch for review before moving to inventory.
- [x] Add/update a lightweight test for obvious hard-coded English UI labels in inventory.
- [x] Add concise Chinese dictionary entries for inventory dashboard, product edit/delete, ledger, stock in/out, adjustment, and import UI.
- [x] Replace hard-coded English UI in `InventoryPage.tsx`.
- [x] Keep product data, SKU, file-template columns, and unit values untranslated.
- [x] Run the targeted test, full lightweight test suite, typecheck, and build.
- [x] Pause after this batch for review before moving to shared components.
- [x] Add a lightweight test for obvious hard-coded English UI labels in shared activity, meeting, and task components.
- [x] Add concise Chinese dictionary entries for activity logging, follow-ups, meeting notes, and task quick-add UI.
- [x] Replace hard-coded English UI in `ActivityTimeline.tsx`.
- [x] Replace hard-coded English UI in `MeetingNotes.tsx`.
- [x] Replace hard-coded English UI in `TaskSection.tsx`.
- [x] Run the targeted test, full lightweight test suite, typecheck, and build.
- [x] Pause after this three-file batch before moving to `QuoteAssistant.tsx`.
- [x] Add a lightweight test for obvious hard-coded English UI labels in `QuoteAssistant.tsx`.
- [x] Add concise Chinese dictionary entries for quote assistant pricing, margin, discount, and insight labels.
- [x] Replace hard-coded English UI in `QuoteAssistant.tsx`.
- [x] Run the targeted test, full lightweight test suite, typecheck, and build.
- [x] Pause after this batch before final sweep/code-splitting decision.
- [x] Add a lightweight test for final hard-coded English UI labels in email draft, customer summary, and company edit components.
- [x] Add concise Chinese dictionary entries for email draft actions, customer briefing metrics, next-action prompts, and company edit toasts/helper text.
- [x] Replace hard-coded English UI in `EmailDraftPanel.tsx`.
- [x] Replace hard-coded English UI in `CustomerSummary.tsx`.
- [x] Replace hard-coded English UI in `CompanyEditPanel.tsx`.
- [x] Run the targeted test, full lightweight test suite, typecheck, and build.
- [x] Pause after this three-file final sweep batch.
- [x] Add a lightweight test for obvious hard-coded English UI labels on the dashboard.
- [x] Add concise Chinese dictionary entries for dashboard KPIs, receivables, pipeline, monthly sales, and aging sections.
- [x] Replace hard-coded English UI in `Dashboard.tsx`.
- [x] Run the targeted test, full lightweight test suite, typecheck, and build.
- [x] Pause after this dashboard batch.
- [x] Add a lightweight test for obvious hard-coded English UI labels in payments, shipments, and shipment detail.
- [x] Add concise Chinese dictionary entries for payment KPI cards, invoice editing, shipment forms, shipment table, and shipment detail.
- [x] Replace hard-coded English UI in `Payments.tsx`.
- [x] Replace hard-coded English UI in `Shipments.tsx`.
- [x] Replace hard-coded English UI in `ShipmentDetail.tsx`.
- [x] Run the targeted test and typecheck for this batch.
- [x] Add a lightweight test for obvious hard-coded English UI labels in inquiry list, order list, and task list pages.
- [x] Add concise Chinese dictionary entries for inquiry urgency, order table headers, and task summary/form labels.
- [x] Replace hard-coded English UI in `Inquiries.tsx`.
- [x] Replace hard-coded English UI in `Orders.tsx`.
- [x] Replace hard-coded English UI in `Tasks.tsx`.
- [x] Run the targeted test and typecheck for this batch.
- [x] Add a lightweight test for obvious hard-coded English UI labels in company detail, activities, and profile pages.
- [x] Add concise Chinese dictionary entries for company detail cards, opportunity labels, activity list, and profile form placeholders.
- [x] Replace hard-coded English UI in `CompanyDetail.tsx`.
- [x] Replace hard-coded English UI in `Activities.tsx`.
- [x] Replace hard-coded English UI in `SettingsProfile.tsx`.
- [x] Run the targeted test and typecheck for this batch.
- [x] Add a lightweight test for shared layout, status badge, sidebar/about, and pipeline control labels.
- [x] Add concise Chinese dictionary entries for workspace labels, about modal, pipeline loading/drop hints, and missing status labels.
- [x] Replace shared workspace default labels in `ResponsiveWorkspace.tsx`.
- [x] Replace status badge labels in `StatusBadge.tsx`.
- [x] Replace sidebar section labels and about modal labels.
- [x] Replace pipeline loading/drop hints.
- [x] Replace remaining stock in/out/adjustment form labels in `InventoryPage.tsx`.
- [x] Run shared component, inventory, final sweep tests, and typecheck.
- [x] Add a lightweight test for the CRM typography system.
- [x] Tighten the Tailwind font scale to match a compact Attio-style CRM interface.
- [x] Remove negative heading letter spacing so Chinese and English titles render evenly.
- [x] Normalize buttons, inputs, labels, table headers, table cells, badges, and product tags to lighter 400/450/600 weights.
- [x] Replace heavy uppercase section labels with lighter 450-weight labels and consistent small letter spacing.
- [x] Replace remaining 700-weight text with 600-weight emphasis.
- [x] Add a lightweight regression test for the reported contact, inventory product, and profile save issues.
- [x] Make contact edit save show the actual API error instead of a generic failure.
- [x] Keep the contact save button clickable during validation so users get a visible reason when required data is missing.
- [x] Let inventory product SKU and name be edited directly instead of locking them behind auto generation.
- [x] Show backend validation details when inventory product save fails.
- [x] Notify the sidebar user menu immediately after profile changes are saved.
- [x] Run targeted tests, typecheck, full test suite, build, and write smoke test.
- [x] Fix the actual contact API 500 by converting boolean checkbox values to SQLite-safe 1/0 values during contact updates.
- [x] Fix inventory product duplicate SKU saves by returning a clear 400 error instead of a SQLite 500.
- [x] Extend the write smoke test to submit the same boolean contact payload shape used by the page.
- [x] Add a local-first release checklist for personal daily use and later internal company use.
- [x] Freeze current feature work before creating a stable local release.
- [x] Review the uncommitted changes and split them into clear local release commits.
- [x] Add local database backup and restore instructions.
- [x] Run a final local formal release verification pass.
- [x] Confirm the desktop CRM app starts the current main project path.

## Batch Order

1. Customers and contacts:
   - `Companies.tsx`
   - `Contacts.tsx`
   - `ContactPanel.tsx`
2. Inquiry list/detail and quotation list:
   - `InquiryNew.tsx`
   - `InquiryDetail.tsx`
   - `Quotations.tsx`
3. Quotation/order details:
   - `QuotationDetail.tsx`
   - `QuotationEditPanel.tsx`
   - `OrderDetail.tsx`
4. Inventory:
   - `InventoryPage.tsx`
5. Shared components and final sweep:
   - `ActivityTimeline.tsx`
   - `MeetingNotes.tsx`
   - `TaskSection.tsx`
   - `QuoteAssistant.tsx`
   - `EmailDraftPanel.tsx`
   - `CustomerSummary.tsx`
   - `CompanyEditPanel.tsx`
   - remaining toasts/placeholders/table labels
6. Dashboard:
   - `Dashboard.tsx`
7. Payments and shipments:
   - `Payments.tsx`
   - `Shipments.tsx`
   - `ShipmentDetail.tsx`
8. List pages:
   - `Inquiries.tsx`
   - `Orders.tsx`
   - `Tasks.tsx`
9. Detail/activity/profile pages:
   - `CompanyDetail.tsx`
   - `Activities.tsx`
   - `SettingsProfile.tsx`
10. Shared controls and final polish:
   - `ResponsiveWorkspace.tsx`
   - `StatusBadge.tsx`
   - `Sidebar.tsx`
   - `AboutModal.tsx`
   - `PipelineColumn.tsx`
   - `Pipeline.tsx`
   - remaining inventory form labels
11. Typography system alignment:
   - global font scale
   - component control typography
   - section label and badge weight
12. User-reported save workflow fixes:
   - contact edit save
   - inventory product create save
   - profile name refresh in sidebar
13. Save workflow root-cause follow-up:
   - SQLite-safe contact checkbox updates
   - clear inventory duplicate SKU validation
   - live local API restart and endpoint check
14. Local formal release preparation:
   - local release checklist
   - backup and restore workflow
   - final local verification pass
15. Local formal release:
   - release note v1.0.0
   - daily workflow checklist
   - git tag v1.0.0
16. Internal company preparation (Stage 2):
   - access model
   - authentication
   - user roles and audit trail

## Verification

Use `package.json` scripts as the source of truth for current verification commands.

- `node --test tests/i18n-first-batch.test.mjs`
- `node --test tests/i18n-second-batch.test.mjs`
- `node --test tests/i18n-third-batch.test.mjs`
- `node --test tests/inventory-ui.test.mjs`
- `node --test tests/i18n-shared-batch.test.mjs`
- `node --test tests/i18n-quote-assistant.test.mjs`
- `node --test tests/i18n-final-sweep.test.mjs`
- `node --test tests/i18n-dashboard.test.mjs`
- `node --test tests/i18n-fulfillment-payments.test.mjs`
- `node --test tests/i18n-list-pages.test.mjs`
- `node --test tests/i18n-profile-activity-detail.test.mjs`
- `node --test tests/i18n-shared-components.test.mjs`
- `node --test tests/typography-system.test.mjs`
- `node --test tests/user-reported-workflow-fixes.test.mjs`
- `npx tsc --noEmit`
- `npm run test`
- `npm run smoke:api`
- `git diff --check`
- `npm run build`

## Out of Scope For Batch 1

- Translating inventory.
- Translating generated PDFs.
- Translating database/customer-entered content.
- Adding new i18n dependencies.

---

# CRM Opportunity Unification Plan

**Current goal:** Make Inquiry and Quotation one sales workflow in the UI while preserving separate domain records for customer demand and commercial quote documents.

**Confirmed product decisions:**
- Sales users work from one Opportunity/销售机会 record, not two duplicated entry pages.
- Inquiry remains the customer requirement record; Quotation remains the price, terms, validity, approval, and revision document.
- One Inquiry may have multiple Quotation revisions or alternatives; an accepted Quotation creates the Order.
- Company, Contact, material, quantity, and application details are entered once and inherited read-only by the quotation flow.
- The existing quotation list remains as a secondary quote-status view, not a second creation workflow.
- The primary sidebar exposes Opportunities / 销售机会; Inquiry and Quotation list routes remain available as secondary views from that workspace.
- Existing routes, records, audit history, and bilingual copy remain compatible.

**Implementation order:**
1. [x] Add a unified Opportunities workspace and reduce duplicate top-level entry points.
2. [x] Add an Opportunity detail view that groups request, activity, latest quotation, quote revisions, and order progression.
3. [x] Make quotation creation/revision contextual and inherit request/customer data without re-entry.
4. [x] Protect against duplicate empty quotations and clarify quotation-to-inquiry relationships.
5. [x] Backfill or surface legacy unlinked quotations without deleting existing data.
6. [x] Run targeted tests, full tests, typecheck, build, and smoke verification.
7. [ ] Complete authenticated browser QA for the Inquiry/Quotation flow (the local browser currently has no signed-in session and requires the user's account PIN).

**Constraints:**
- No destructive table merge; preserve `inquiries` and `quotations` for audit, approvals, PDF output, and order links.
- No production dependency or external deployment.
- Additive database migration only after backup and explicit confirmation if schema changes are required.
- Keep each implementation batch to no more than three files.
