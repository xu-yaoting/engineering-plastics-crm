# Claude Code Handoff — Company Workspace UI

You are taking over the final verification stage of the approved Company workspace simplification.

## Start here

1. Work in `/Users/myairbook/AIProjects/engineering-plastics-crm`.
2. Read `/Users/myairbook/AIProjects/AGENTS.md`, `README.md`, `PLANS.md`, and `CONTEXT.md` before acting.
3. Read the complete target files and their related imports/tests before changing anything.
4. Preserve the current dirty worktree. It contains substantial user and prior-agent work. Do not reset, restore, delete, reformat, or clean unrelated changes.
5. Current branch: `fix/order-owner-assignment`. Do not commit or push unless Nathan explicitly asks.

## Product decisions already approved

- Company Detail uses a non-sticky top action summary, a primary Opportunities/Activity column, and one short supporting rail.
- The top summary shows active quotation value, open inquiry/quotation counts, next follow-up, pending tasks, and one recommended action.
- Customer Briefing, Recent Activity summary, Pipeline Summary, and Quick Stats were removed as duplicates.
- The right rail permanently shows only:
  - Primary Contact, with Company email/phone fallback when the Contact has no direct channel.
  - Up to three pending tasks.
  - Owner.
  - Entry points for Company Profile and Operation History.
- Full Company Profile and Operation History open in accessible side panels (progressive disclosure).
- Follow-ups is a standalone Sales sidebar item directly below Companies.
- The old Company module tab bar was removed.
- Contact Directory remains company-scoped and existing routes remain compatible.
- Desktop comes first. Do not start mobile redesign in this task.

The authoritative checklist is the first section of `PLANS.md`. Items 1–5 are complete; item 6 remains.

## What has been implemented

### Batch 1

- Added Follow-ups under Companies in the Sales sidebar.
- Added active-route regression coverage.

Relevant files:

- `src/components/layout/Sidebar.tsx`
- `tests/follow-up-workbench.test.mjs`

### Batch 2

- Removed `CompanyModuleNav` wrappers from Company routes.
- Normalized Follow-up Workbench page-title typography.

Relevant files:

- `src/App.tsx`
- `src/pages/FollowUpWorkbench.tsx`
- `tests/follow-up-workbench.test.mjs`

### Batch 3

- Added the top actionable Company summary.
- Removed duplicate `CustomerSummary` and Quick Stats rendering from Company Detail.
- Added bilingual summary strings and regression coverage.

Relevant files:

- `src/pages/CompanyDetail.tsx`
- `src/lib/i18n.tsx`
- `tests/i18n-profile-activity-detail.test.mjs`

### Batch 4

- Replaced the two stacked supporting columns with one short right rail.
- Added Primary Contact fallback channels.
- Limited visible pending tasks to three.
- Moved Company Profile and Operation History into `SidePanel`.
- Updated `PLANS.md` items 2–5 to complete.

Relevant files:

- `src/pages/CompanyDetail.tsx`
- `tests/i18n-profile-activity-detail.test.mjs`
- `PLANS.md`

Latest completed checks:

```text
node --test tests/i18n-profile-activity-detail.test.mjs  # 8/8 passed
npx tsc --noEmit                                        # passed
git diff --check                                        # passed
npm run build                                           # passed
```

The latest Company Detail production chunk was approximately 33.86 kB / 7.85 kB gzip.

## Your next task: checklist item 6

Perform desktop QA and final verification. Begin with read-only checks; do not make speculative cleanup changes.

### Browser QA

Use the existing local app if it is running. Otherwise start the documented development server. Do not alter credentials or seed data.

Verify at representative desktop widths such as 1440×900 and 1024×768:

1. Sidebar:
   - Follow-ups is directly below Companies.
   - `/companies`, `/companies/follow-ups`, and `/companies/contacts` have the correct active state.
   - No old Company tab bar appears at the top of these pages.
2. Follow-up Workbench:
   - Page title and subtitle have the same hierarchy as other list pages.
   - Filters and list content are not displaced by the removed tab bar.
3. Company Detail:
   - First screen shows the header and compact action summary.
   - Opportunities and Activity occupy the main column.
   - The right rail is visibly shorter and contains only Primary Contact, up to three pending tasks, Owner, Company Profile, and Operation History.
   - There is no horizontal overflow or large empty left area caused by the former three-column layout.
   - Contact email/phone fall back to Company values only when direct Contact values are absent, and the fallback is visibly marked.
   - Company Profile opens the details side panel.
   - Operation History opens the audit side panel.
   - Side panels close by close button, backdrop, and Escape; focus returns to the triggering control.
   - Do not create or complete real tasks during QA.
4. Bilingual and accessibility:
   - Check the existing English and Chinese UI paths without changing global configuration unnecessarily.
   - Confirm visible keyboard focus, meaningful accessible names, logical tab order, and no obvious low-contrast or clipped text.
   - Scope this pass to the changed Company workspace; mobile refinement is explicitly deferred.

If browser login is blocked by unavailable credentials, do not invent or reset credentials. Report the blocker, complete source/test verification, and state exactly what remains unverified.

### Automated verification

Run:

```bash
npm run test
npx tsc --noEmit
npm run build
git diff --check
```

Also rerun the focused suites:

```bash
node --test tests/follow-up-workbench.test.mjs
node --test tests/i18n-profile-activity-detail.test.mjs
node --test tests/contact-directory.test.mjs
node --test tests/form-accessibility-sweep.test.mjs
```

Distinguish failures caused by this Company UI work from pre-existing failures in the dirty worktree. Do not “fix everything” outside scope.

## Change discipline

- If QA finds a real defect, reproduce it first and add or update a focused regression before the fix.
- Change at most three files in one batch, then stop and report to Nathan.
- Keep the diff minimal. No new dependency, database migration, API contract change, route removal, broad refactor, or mobile redesign.
- Do not modify real customer data or run `npm run smoke:api` without first explaining its local database writes and obtaining confirmation.
- If all verification passes, mark item 6 complete in `PLANS.md`. Do not rewrite the plan.

## Completion report

Report in Chinese:

- What was verified and any files changed.
- Exact commands and pass/fail results.
- Browser sizes and interaction paths checked.
- Anything not verified and why.
- Remaining risks or mobile follow-up, if any.

