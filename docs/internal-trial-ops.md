# CRM Internal Trial Operations

## Purpose

This document defines how the CRM should be used during the current internal trial period.

Current stage:
- 2-3 internal users.
- Company LAN access only.
- Real business data can be entered.
- Public internet deployment is out of scope for now.
- Formal external launch is expected later, after several months of real usage.

## Operating Principles

- Treat the CRM as the working source of truth for trial data.
- Do not keep parallel customer, inventory, payment, or shipment records unless required for backup or finance review.
- Fix data-loss, save-failure, stock, payment, and amount issues first.
- Avoid large new features during active trial usage.
- Batch non-urgent improvements into weekly review cycles.

## User Scope

Initial users:
- Owner/admin: Nathan.
- Sales or order follow-up user.
- Inventory, shipment, or operations user.

Do not add more users until:
- Daily backup is stable.
- Data entry rules are understood.
- The current users can complete normal workflows without developer help.

## Access Rules

Current recommended access:
- Use LAN access only.
- Do not expose the API or frontend to the public internet.
- Do not configure public DNS or HTTPS until authentication and roles are planned.

If the CRM host machine changes, document:
- Host machine name.
- Local IP address.
- Startup method.
- Backup location.
- Who is responsible for restarting it.

## Backup Rules

Minimum backup rhythm:
- Before large data import or cleanup: run `npm run backup`.
- End of every workday with real data changes: run `npm run backup`.
- Before code updates: run `npm run backup`.
- After a P0 fix involving database writes: run `npm run backup`.

Backup command:

```bash
npm run backup
```

Backup files are stored in:

```text
/Users/myairbook/AIProjects/engineering-plastics-crm/backups
```

Restore is only allowed after Nathan confirms the target backup file.

## Change Management

Use this rhythm during the trial:
- P0 issues: fix immediately.
- P1 issues: collect and fix in weekly batches.
- P2 issues: record, review later, and avoid interrupting daily work.

Do not deploy or restart the CRM during working hours unless:
- Users are informed.
- Current work is saved.
- A fresh backup exists.

## Priority Definitions

### P0: Stop Work Immediately

Examples:
- Data cannot be saved.
- Saved data disappears or is corrupted.
- Stock count or payment amount is wrong.
- Order, invoice, payment, or shipment record is linked to the wrong customer.
- CRM cannot start.

Action:
- Stop using the affected module.
- Create a backup if possible.
- Record exact steps in the issue log.
- Fix before continuing normal use.

### P1: Fix This Week

Examples:
- Required field is missing for real workflow.
- Report or list is confusing enough to slow daily work.
- Search/filter makes users miss records.
- PDF or email draft has business-facing wording problems.
- Manual workaround exists, but it is annoying.

Action:
- Record in the issue log.
- Batch into weekly fix list.

### P2: Polish Later

Examples:
- Layout spacing.
- Minor wording.
- Nice-to-have shortcuts.
- Non-blocking dashboard improvements.

Action:
- Record if useful.
- Do not interrupt active trial work.

## Weekly Review

Once per week, review:
- New P0/P1/P2 issues.
- Duplicate records created by users.
- Missing fields or unclear rules.
- Backup files exist for each workday.
- Whether new users can be added.

Suggested weekly outputs:
- Fixed issues.
- Deferred issues.
- New rules added to data entry standards.
- Backup verification result.

## Do Not Do Yet

During this internal trial stage, avoid:
- Public internet exposure.
- Broad user invitation.
- Complex role system before workflow stabilizes.
- Large UI redesign.
- Mass data import without a backup.
- Direct database edits unless there is no safer path.
