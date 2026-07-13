# CRM Soft Ownership Permissions Design

**Date:** 2026-07-13
**Status:** Approved for planning
**Scope:** Internal CRM used by Nathan and a small team

## Objective

Keep all business data visible to the internal team while preventing ordinary members from changing records owned by another member. Preserve accurate ownership and audit history without introducing complex departmental permissions.

## Account Model

- Every person, including Nathan, must use an individual CRM account.
- Nathan's account has the `admin` role.
- Colleague accounts have the `member` role.
- Local access does not bypass authentication. Every write must have an authenticated actor.
- Administrators manage accounts. Account roles are not business owners by themselves.

## Ownership Model

- `owner_user_id` identifies the person responsible for a business record.
- `created_by` identifies the account that created a record.
- `updated_by` identifies the account that most recently changed a record.
- These fields must never be substituted for one another.
- New customers default to the current user.
- Inquiries inherit the customer owner.
- Quotations inherit the inquiry owner, then the customer owner.
- Orders inherit the quotation owner, then the customer owner.
- Shipments and invoices derive edit permission and displayed owner from their linked order.
- Historical records with no actor metadata remain marked as historical or unrecorded. The system must not invent an operator from the business owner.

## Visibility Rules

- Administrators and members can view all customers, inquiries, quotations, orders, shipments, invoices, payments, and inventory.
- Member list pages default to the `My` owner filter.
- Administrator list pages default to `All`.
- Users can switch to `All`, `Unassigned`, or a named owner for visibility only.
- Changing a filter never grants edit permission.

## Edit Rules

### Administrator

- Can create, view, edit, reassign, and delete all business records.
- Can manage team accounts.

### Member

- Can create customers, which default to that member as owner.
- Can edit customers, contacts, inquiries, quotations, and orders only when the record belongs to that member.
- Can edit shipments only when the linked order belongs to that member.
- Can create invoices, update invoice terms and due dates, and record payments only for orders belonging to that member.
- Cannot reassign `owner_user_id`.
- Cannot delete invoices or business records.
- Cannot modify or delete recorded payment amounts. Corrections require an administrator.
- Can add tasks and activities to owned business records. Tasks explicitly assigned to the member remain editable by that member.

## Inventory Rules

- Inventory is visible to all authenticated users.
- All authenticated users can record stock-in, stock-out, and adjustments.
- The server always records the authenticated account as operator; operator names cannot be entered manually.
- All authenticated users may create and edit product master data.
- Only administrators may delete a product.

## Payments Presentation

- Replace the Payments list column `Last updated by` with `Owner`.
- The owner is resolved from the linked order and displayed as business responsibility, not audit identity.
- The invoice edit surface shows read-only metadata for owner, creator, and last updater.
- Old invoices without actor metadata display `Historical data - not recorded` for creator or updater.
- New invoice and payment writes continue to record the real authenticated actor automatically.
- Payment history remains auditable independently from ownership.

## User Interface Behavior

- Editable owned records show normal edit actions.
- Records owned by another member remain readable.
- Their edit actions are disabled with the explanation: `Only the owner or an administrator can edit this record.`
- Owner reassignment controls are visible only to administrators.
- Shipment and Payments pages use the linked order owner when determining read-only state.
- Permission failures returned by the API remain visible in the current form instead of closing it.

## Server Enforcement

- Permissions must be enforced in protected server routes. Hiding or disabling a frontend control is not sufficient.
- Authentication middleware must expose both user ID and role to protected routes.
- Shared authorization helpers resolve administrator status, direct ownership, and ownership inherited through a linked order.
- Unauthorized writes return HTTP `403` with a stable, user-readable error.
- Assignment attempts by members return HTTP `403`, even when the member owns the record.
- Existing field whitelists and audit transactions remain in place.

## Error Handling

- `401` means the session is missing or invalid.
- `403` means the user is authenticated but does not own the record or lacks administrator authority.
- `404` remains reserved for missing or deleted records.
- Failed authorization must not partially update the database or write a misleading audit entry.

## Verification

- Unit/static tests cover admin access, member-owned writes, cross-owner write rejection, assignment rejection, and inventory access.
- API smoke covers owned customer-to-payment workflow under a temporary member account.
- API smoke verifies a second member cannot edit those records.
- Tests verify administrator override access.
- Frontend tests verify role-sensitive default filters, disabled edit actions, Payments owner display, and historical actor fallback.
- Before runtime verification, create a database backup.
- Run the full test suite, frontend and server type checks, production build, and isolated API write smoke.

## Explicit Non-Goals

- No department, territory, record-sharing, or field-level permission system.
- No hidden customer or order records.
- No anonymous or local-login bypass.
- No retroactive fabrication of creator or updater identities.
- No changes to the existing visual typography system.
