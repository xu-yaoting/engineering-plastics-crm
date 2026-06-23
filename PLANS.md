# CRM Local Stabilization Plan

**Goal:** Make the local CRM safer and more reliable without adding production dependencies or changing the database.

**Assumptions:**
- This is currently a local deployment for personal use.
- Public production hardening can be handled later with a real login/session flow.
- No database migration command will be run.

**Affected files:**
- `server/auth.ts`
- `server/index.ts`
- `src/main.tsx`
- `src/lib/api.ts`
- `server/routes/companies.ts`
- `server/routes/contacts.ts`
- `server/routes/inquiries.ts`
- `server/routes/inventory.ts`
- `server/routes/orders.ts`
- `server/routes/quotations.ts`
- `server/routes/shipments.ts`
- `server/routes/tasks.ts`
- `server/**/*.ts` relative imports
- `tsconfig.server.json`
- `package.json`
- `README.md`
- `start-crm.sh`
- `tests/*.test.mjs`
- `tests/api-write-smoke.mjs`

## Milestones

- [x] Add lightweight tests that capture the current auth and update-field risks.
- [x] Change local auth so no API key is exposed by `/api/config` and no key is printed to logs.
- [x] Make backend TypeScript compile to Node-runnable ESM.
- [x] Add field whitelists for dynamic update routes touched in this pass.
- [x] Add field whitelists for all remaining dynamic update routes.
- [x] Add local README and align one-click local start script.
- [x] Add local API write smoke coverage for companies, contacts, and tasks.
- [x] Add local API write smoke coverage for inquiries, quotations, and orders.
- [x] Add local API write smoke coverage for shipments and inventory.
- [x] Add local API write smoke coverage for invoices and payments.
- [x] Run build and targeted Node tests.

## Verification

- `npm run test`
- `npm run build`
- `node dist-server/index.js`
- `./start-crm.sh`
- `npm run smoke:api`

## Out of Scope For This Pass

- Real multi-user login.
- Adding ESLint/Jest/Supertest dependencies.
- Broad frontend type cleanup.
