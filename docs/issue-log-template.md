# CRM Issue Log Template

Use this template to record problems found during internal trial usage.

Keep the issue description factual. Include steps, expected result, actual result, and whether data may be affected.

## Priority Guide

- P0: Data loss, save failure, wrong amount, wrong stock, cannot start.
- P1: Workflow blocked or important field/report missing, but data is safe.
- P2: UI polish, wording, convenience improvements.

## Issue Table

| ID | Date | Reporter | Priority | Module | Status | Summary | Data Risk | Owner | Notes |
|---|---|---|---|---|---|---|---|---|---|
| CRM-001 | YYYY-MM-DD | Name | P0/P1/P2 | Module | New | Short description | Yes/No | Name | Link or details |

## Issue Detail Template

```markdown
## CRM-XXX: Short Title

Date:
Reporter:
Priority: P0 / P1 / P2
Module:
Status: New / Investigating / Fixed / Deferred

### What Happened

Describe the problem in plain language.

### Steps To Reproduce

1. Open ...
2. Click ...
3. Enter ...
4. Save ...

### Expected Result

What should have happened?

### Actual Result

What actually happened?

### Data Risk

- Is any customer, order, payment, shipment, or inventory data wrong?
- If yes, which record is affected?

### Screenshot Or Record

Attach screenshot name or record ID if available.

### Workaround

Is there a temporary safe workaround?

### Resolution Notes

Fill after fixing.
```

## Recommended Status Values

- New
- Confirmed
- Investigating
- Fixed
- Verified
- Deferred
- Won't fix

## Weekly Review Checklist

- [ ] All P0 issues are either fixed or usage is stopped for the affected module.
- [ ] All P1 issues have an owner or planned fix week.
- [ ] P2 items are not interrupting critical work.
- [ ] Data-risk issues have record IDs and backup timestamps.
- [ ] Fixed issues were verified by the original reporter when possible.
