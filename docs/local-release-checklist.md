# CRM Local Release Checklist

## Goal

Prepare the CRM for reliable personal daily use first, then move to a controlled internal company setup.

## Stage 1: Local Formal Version

### Scope

- Single user on Nathan's Mac.
- Local SQLite database.
- One-click launch stays the main startup method.
- No public internet exposure.
- No new production dependencies unless explicitly approved.

### Must Finish Before Daily Use

- [ ] Freeze the current feature set and avoid new large features during stabilization.
- [x] Review all current uncommitted changes and split them into clear commits.
- [x] Run the full verification set:
  - `npm run test`
  - `npm run smoke:api`
  - `npm run build`
- [ ] Create a manual end-to-end checklist for daily workflows:
  - companies
  - contacts
  - inquiries
  - quotations
  - orders
  - payments
  - shipments
  - inventory products
  - stock in
  - stock out
  - adjustment
  - profile and language settings
- [x] Add a simple local backup script for the local SQLite CRM database.
- [x] Add a short restore note so backups are actually usable.
- [x] Confirm the desktop app or shortcut starts the current project path only.
- [x] Keep `.api-key`, `.env*`, `crm.db`, and backup files out of git.
- [ ] Create a local version tag or release note after stabilization.

### Local Acceptance Criteria

- The CRM can be opened from the desktop shortcut.
- The API health check returns OK.
- A full write smoke test passes.
- A real daily workflow can be completed without command-line intervention.
- A database backup can be created and restored manually.

## Stage 2: Internal Company Version

### Scope

- Small internal usage by trusted colleagues.
- Access from company LAN or controlled private network first.
- Public internet access is out of scope until login, HTTPS, and permissions are ready.

### Must Finish Before Internal Use

- [ ] Decide where the CRM runs:
  - Nathan's Mac as host
  - office Mac mini / local server
  - private cloud server
- [ ] Decide access method:
  - LAN IP
  - VPN / Tailscale-style private network
  - domain with HTTPS later
- [ ] Add real login or session-based auth before broad internal use.
- [ ] Add user identity to important records:
  - activities
  - payments
  - inventory transactions
  - orders
- [ ] Define user roles:
  - owner/admin
  - sales
  - inventory
  - read-only
- [ ] Add database backup schedule.
- [ ] Add internal operating rules:
  - who can edit contacts
  - who can edit inventory
  - who can record payments
  - who can delete records
- [ ] Run a 3-5 day internal pilot with non-critical data first.

### Internal Acceptance Criteria

- Users can access the same CRM instance without copying database files.
- Data changes are visible across users.
- Backups run before and after pilot testing.
- Permissions and ownership are clear enough to avoid accidental edits.
- No API is exposed publicly without authentication.

## Current Recommendation

Do Stage 1 first. Treat Stage 2 as a separate hardening phase after the local formal version is stable for daily use.
