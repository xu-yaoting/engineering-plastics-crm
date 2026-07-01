# Engineering Plastics CRM

Local CRM for engineering plastics sales work: companies, contacts, inquiries, quotations, orders, shipments, payments, pipeline, tasks, and inventory.

## Local Setup

```bash
cd /Users/myairbook/AIProjects/engineering-plastics-crm
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

API health check:

```bash
curl http://127.0.0.1:3001/api/health
```

## Common Commands

```bash
npm run dev          # start API and frontend
npm run dev:server   # start API only
npm run dev:client   # start frontend only
npm run test         # run lightweight safety checks
npm run smoke:api    # build and run local write smoke checks
npm run build        # build frontend and server
npm run db:seed      # seed local demo data
npm run backup       # create a local database backup
```

## One-Click Local Start

```bash
./start-crm.sh
```

The script stops old local CRM processes on ports `3001` and `5173`, starts the API and frontend, checks `/api/health`, then opens the app.

## Local Auth Notes

By default, local API-key auth is disabled so the frontend can call the API directly.

If `API_KEY` is set in the environment, the API requires an `x-api-key` header. The browser frontend does not automatically send this header, so leave `API_KEY` unset for normal local use.

## Data And Secrets

- Local data lives in `crm.db`.
- Local backups are written to `backups/`.
- `.api-key`, `.env*`, `crm.db`, WAL files, backups, build output, and `node_modules` are ignored by git.
- Do not commit real customer data, API keys, passwords, or database files.

## Local Backup And Restore

Create a backup before major edits, before system updates, and at the end of each workday once real data is in the CRM:

```bash
npm run backup
```

Restore is intentionally protected. Close the CRM first, then run:

```bash
npm run restore -- --confirm /Users/myairbook/AIProjects/engineering-plastics-crm/backups/crm-YYYYMMDD-HHMMSS.db.gz
```

The restore script creates one more backup of the current database before replacing it.

## Verification Before Handoff

Run:

```bash
npm run test
npm run smoke:api
npm run build
```

For server runtime verification:

```bash
npm run build
node dist-server/index.js
```

Then in another terminal:

```bash
curl http://127.0.0.1:3001/api/health
```
