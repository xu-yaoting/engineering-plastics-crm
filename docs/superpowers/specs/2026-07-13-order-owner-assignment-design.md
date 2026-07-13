# Order Owner Assignment Design

## Goal

Allow administrators to assign or transfer an order owner while keeping Payments ownership derived from the linked order.

## Behavior

- The order edit dialog shows an Owner selector to administrators.
- Active team members and an Unassigned option are available.
- Members can view the owner but cannot transfer ownership.
- The API rejects member attempts to change `owner_user_id`, even if sent outside the UI.
- Payments remain read-only for ownership and immediately reflect the linked order owner.
- Existing unassigned orders are backfilled from their current company owner after a database backup.
- Creator and updater history is not fabricated during the backfill.

## Verification

- Automated checks cover administrator controls and server-side member restrictions.
- Frontend and server type checks pass.
- Existing orders and Payments show the inherited owner after the backfill.
