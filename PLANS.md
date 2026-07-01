# CRM Chinese Localization Plan

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
- [ ] Freeze current feature work and review the uncommitted changes before creating a stable local release.
- [x] Add local database backup and restore instructions.
- [ ] Run a final local formal release verification pass.

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
15. Internal company preparation:
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
