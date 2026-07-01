# Prospecting Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Prospecting module that helps discover, score, review, and convert Middle East and Southeast Asia distributor/stockist and CNC plastic machining leads.

**Architecture:** Add a small prospect domain to the existing Express + SQLite CRM. Keep scoring and search-seed generation in pure server helpers so they are easy to test, expose prospects through a dedicated `/api/prospects` router, then add a React workspace page using the existing local API wrapper and sidebar routing patterns.

**Tech Stack:** TypeScript, Express, better-sqlite3, React 18, Vite, react-router-dom, lucide-react, Node built-in test runner.

## Global Constraints

- No new production dependencies.
- First version targets UAE, Saudi Arabia, Turkey, Qatar, Oman, Vietnam, Thailand, Malaysia, Indonesia, and Singapore.
- First version only targets `distributor_stockist` and `machining_fabrication`.
- Core materials are PEEK, PPSU, and PAI; secondary materials are PPS, PEI, PTFE, and PVDF.
- Do not send outreach automatically.
- Do not automate LinkedIn.
- Do not scrape private personal email addresses as a primary objective.
- Do not write unreviewed leads directly into CRM companies or contacts.
- Tests must use anonymous fixture data only.
- Use existing CRM patterns in `server/db.ts`, `server/routes/*.ts`, `src/lib/api.ts`, `src/App.tsx`, and `src/components/layout/Sidebar.tsx`.
- Because this repository currently has many unrelated uncommitted files, each task must stage only the files listed in that task before committing.

---

## File Structure

- Create `server/prospecting.ts`: pure prospect constants, search seed generation, evidence scoring, normalization, and deduplication helpers.
- Modify `server/db.ts`: create `prospects` table and indexes during local database initialization.
- Create `server/routes/prospects.ts`: CRUD-like prospect endpoints, review status updates, and conversion to CRM companies.
- Modify `server/index.ts`: mount `prospectsRouter` at `/api/prospects`.
- Modify `src/lib/api.ts`: add `prospects` client methods.
- Create `src/types/prospecting.ts`: shared frontend types for prospect rows, filters, forms, and scoring details.
- Create `src/pages/Prospecting.tsx`: local prospecting workspace with filters, table, detail panel, manual import form, seed generator, status actions, and CRM conversion action.
- Modify `src/App.tsx`: add `/prospecting` route.
- Modify `src/components/layout/Sidebar.tsx`: add Prospecting navigation item and icon.
- Modify `src/lib/i18n.tsx`: add concise Chinese and English UI strings for the new module.
- Create `tests/prospecting-logic.test.mjs`: source-level tests for helper exports and scoring rules.
- Create `tests/prospecting-api.test.mjs`: source-level tests for route safety, whitelisting, and conversion behavior.
- Create `tests/prospecting-ui.test.mjs`: source-level tests for route, API client, sidebar, and UI labels.

---

### Task 1: Prospecting Core Logic

**Files:**
- Create: `server/prospecting.ts`
- Test: `tests/prospecting-logic.test.mjs`

**Interfaces:**
- Produces: `TARGET_COUNTRIES: readonly string[]`
- Produces: `CORE_MATERIALS: readonly string[]`
- Produces: `SECONDARY_MATERIALS: readonly string[]`
- Produces: `CUSTOMER_TYPES: readonly string[]`
- Produces: `normalizeWebsite(value: string | null | undefined): string`
- Produces: `generateSearchSeeds(input: ProspectSeedInput): string[]`
- Produces: `scoreProspectEvidence(input: ProspectEvidenceInput): ProspectScoreResult`
- Produces: `dedupeProspects<T extends { website?: string | null; company_name: string; source_url?: string | null }>(rows: T[]): T[]`

- [ ] **Step 1: Write the failing logic tests**

Create `tests/prospecting-logic.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../server/prospecting.ts', import.meta.url), 'utf8');

test('prospecting constants include target countries and customer types', () => {
  assert.match(source, /TARGET_COUNTRIES/);
  assert.match(source, /UAE/);
  assert.match(source, /Saudi Arabia/);
  assert.match(source, /Vietnam/);
  assert.match(source, /Singapore/);
  assert.match(source, /CUSTOMER_TYPES/);
  assert.match(source, /distributor_stockist/);
  assert.match(source, /machining_fabrication/);
});

test('search seed generation covers materials, forms, country, and customer type terms', () => {
  assert.match(source, /function generateSearchSeeds/);
  assert.match(source, /PEEK rod supplier/);
  assert.match(source, /engineering plastic stockist/);
  assert.match(source, /plastic CNC machining/);
  assert.match(source, /high performance plastic stock shapes/);
});

test('scoring rewards core material, engineering plastics, stock shapes, and machining evidence', () => {
  assert.match(source, /function scoreProspectEvidence/);
  assert.match(source, /core material match/);
  assert.match(source, /engineering or high-performance plastics match/);
  assert.match(source, /stock shape match/);
  assert.match(source, /machining or fabrication match/);
});

test('scoring penalizes commodity-only and unreachable websites', () => {
  assert.match(source, /commodity-only signal/);
  assert.match(source, /missing or unreachable website/);
  assert.match(source, /thin source without proof/);
});

test('dedupe helper normalizes websites before merging candidates', () => {
  assert.match(source, /function normalizeWebsite/);
  assert.match(source, /function dedupeProspects/);
  assert.match(source, /replace\\(\/\\^https\\?\\:\\\\/\\\\//);
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
node --test tests/prospecting-logic.test.mjs
```

Expected: FAIL because `server/prospecting.ts` does not exist.

- [ ] **Step 3: Add prospecting helper implementation**

Create `server/prospecting.ts`:

```ts
export const TARGET_COUNTRIES = [
  'UAE',
  'Saudi Arabia',
  'Turkey',
  'Qatar',
  'Oman',
  'Vietnam',
  'Thailand',
  'Malaysia',
  'Indonesia',
  'Singapore',
] as const;

export const CORE_MATERIALS = ['PEEK', 'PPSU', 'PAI'] as const;
export const SECONDARY_MATERIALS = ['PPS', 'PEI', 'PTFE', 'PVDF'] as const;
export const CUSTOMER_TYPES = ['distributor_stockist', 'machining_fabrication'] as const;

export type CustomerType = typeof CUSTOMER_TYPES[number];

export type ProspectSeedInput = {
  countries: string[];
  materials: string[];
  customerTypes: CustomerType[];
};

export type ProspectEvidenceInput = {
  website?: string | null;
  evidenceText?: string | null;
  sourceText?: string | null;
};

export type ProspectScoreResult = {
  confidenceScore: number;
  matchedMaterials: string[];
  matchedForms: string[];
  matchedCapabilities: string[];
  matchedSignals: string[];
  penalties: string[];
};

const FORM_KEYWORDS = [
  { value: 'rod', pattern: /\brods?\b/i },
  { value: 'sheet', pattern: /\bsheets?\b|\bplates?\b/i },
  { value: 'tube', pattern: /\btubes?\b|\bpipes?\b/i },
  { value: 'stock_shapes', pattern: /stock shapes?|semi[- ]finished/i },
  { value: 'parts', pattern: /machined parts?|custom components?|plastic components?/i },
];

const CAPABILITY_KEYWORDS = [
  { value: 'stockist', pattern: /\bstockist\b|in stock|stock shapes?/i },
  { value: 'distributor', pattern: /\bdistributors?\b|\bsuppliers?\b/i },
  { value: 'cnc_machining', pattern: /cnc machining|plastic machining|machining service/i },
  { value: 'fabrication', pattern: /fabrication|fabricated/i },
  { value: 'custom_components', pattern: /custom components?|custom parts?|made to order/i },
];

const RELEVANT_INDUSTRY_PATTERN = /oil and gas|medical|semiconductor|aerospace|food equipment|industrial machinery/i;
const ENGINEERING_PLASTIC_PATTERN = /engineering plastics?|high[- ]performance plastics?|advanced polymers?/i;
const COMMODITY_ONLY_PATTERN = /packaging|household|commodity plastics?|polyethylene|polypropylene|\bPVC\b|acrylic/i;
const THIN_SOURCE_PATTERN = /directory listing|yellow pages|business listing/i;

export function normalizeWebsite(value: string | null | undefined): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

export function generateSearchSeeds(input: ProspectSeedInput): string[] {
  const seeds = new Set<string>();
  for (const country of input.countries) {
    for (const material of input.materials) {
      if (input.customerTypes.includes('distributor_stockist')) {
        seeds.add(`${material} rod supplier ${country}`);
        seeds.add(`${material} sheet distributor ${country}`);
        seeds.add(`engineering plastic stockist ${country}`);
        seeds.add(`high performance plastic stock shapes ${country}`);
      }
      if (input.customerTypes.includes('machining_fabrication')) {
        seeds.add(`plastic CNC machining ${material} ${country}`);
        seeds.add(`${material} machined parts ${country}`);
        seeds.add(`custom engineering plastic components ${country}`);
      }
    }
  }
  return Array.from(seeds);
}

export function scoreProspectEvidence(input: ProspectEvidenceInput): ProspectScoreResult {
  const text = `${input.evidenceText || ''} ${input.sourceText || ''}`;
  const matchedMaterials = [...CORE_MATERIALS, ...SECONDARY_MATERIALS].filter((material) =>
    new RegExp(`\\b${material}\\b`, 'i').test(text),
  );
  const matchedForms = FORM_KEYWORDS.filter((entry) => entry.pattern.test(text)).map((entry) => entry.value);
  const matchedCapabilities = CAPABILITY_KEYWORDS.filter((entry) => entry.pattern.test(text)).map((entry) => entry.value);
  const matchedSignals: string[] = [];
  const penalties: string[] = [];
  let score = 0;

  if (matchedMaterials.some((material) => CORE_MATERIALS.includes(material as typeof CORE_MATERIALS[number]))) {
    score += 35;
    matchedSignals.push('core material match');
  }
  if (ENGINEERING_PLASTIC_PATTERN.test(text)) {
    score += 25;
    matchedSignals.push('engineering or high-performance plastics match');
  }
  if (matchedForms.length > 0) {
    score += 20;
    matchedSignals.push('stock shape match');
  }
  if (matchedCapabilities.some((value) => ['cnc_machining', 'fabrication', 'custom_components'].includes(value))) {
    score += 15;
    matchedSignals.push('machining or fabrication match');
  }
  if (RELEVANT_INDUSTRY_PATTERN.test(text)) {
    score += 15;
    matchedSignals.push('relevant industry application match');
  }
  if (COMMODITY_ONLY_PATTERN.test(text) && matchedMaterials.length === 0 && !ENGINEERING_PLASTIC_PATTERN.test(text)) {
    score -= 25;
    penalties.push('commodity-only signal');
  }
  if (!normalizeWebsite(input.website)) {
    score -= 30;
    penalties.push('missing or unreachable website');
  }
  if (THIN_SOURCE_PATTERN.test(text) && matchedMaterials.length === 0) {
    score -= 15;
    penalties.push('thin source without proof');
  }

  return {
    confidenceScore: Math.max(0, Math.min(100, score)),
    matchedMaterials,
    matchedForms,
    matchedCapabilities,
    matchedSignals,
    penalties,
  };
}

export function dedupeProspects<T extends { website?: string | null; company_name: string; source_url?: string | null }>(rows: T[]): T[] {
  const seen = new Map<string, T>();
  for (const row of rows) {
    const websiteKey = normalizeWebsite(row.website);
    const fallbackKey = row.company_name.trim().toLowerCase();
    const key = websiteKey || fallbackKey;
    if (!seen.has(key)) {
      seen.set(key, row);
      continue;
    }
    const existing = seen.get(key)!;
    if (!existing.source_url && row.source_url) {
      seen.set(key, { ...existing, source_url: row.source_url });
    }
  }
  return Array.from(seen.values());
}
```

- [ ] **Step 4: Run the logic test**

Run:

```bash
node --test tests/prospecting-logic.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add server/prospecting.ts tests/prospecting-logic.test.mjs
git commit -m "feat: add prospecting scoring helpers"
```

---

### Task 2: Prospect Storage And API

**Files:**
- Modify: `server/db.ts`
- Create: `server/routes/prospects.ts`
- Modify: `server/index.ts`
- Test: `tests/prospecting-api.test.mjs`

**Interfaces:**
- Consumes: `scoreProspectEvidence(input: ProspectEvidenceInput): ProspectScoreResult`
- Produces: `GET /api/prospects`
- Produces: `POST /api/prospects`
- Produces: `PUT /api/prospects/:id/review`
- Produces: `POST /api/prospects/:id/convert`

- [ ] **Step 1: Write the failing API source tests**

Create `tests/prospecting-api.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dbSource = readFileSync(new URL('../server/db.ts', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../server/routes/prospects.ts', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../server/index.ts', import.meta.url), 'utf8');

test('database initializes prospects table with review and scoring fields', () => {
  assert.match(dbSource, /CREATE TABLE IF NOT EXISTS prospects/);
  assert.match(dbSource, /customer_type TEXT NOT NULL/);
  assert.match(dbSource, /source_type TEXT NOT NULL/);
  assert.match(dbSource, /confidence_score INTEGER NOT NULL DEFAULT 0/);
  assert.match(dbSource, /review_status TEXT NOT NULL DEFAULT 'new'/);
  assert.match(dbSource, /converted_company_id TEXT REFERENCES companies/);
});

test('prospects route uses explicit update whitelist and no broad object entry update', () => {
  assert.match(routeSource, /PROSPECT_UPDATE_FIELDS/);
  assert.doesNotMatch(routeSource, /Object\.entries\(req\.body\)/);
  assert.match(routeSource, /scoreProspectEvidence/);
});

test('prospects route exposes list, create, review, and convert endpoints', () => {
  assert.match(routeSource, /router\.get\('\\/'/);
  assert.match(routeSource, /router\.post\('\\/'/);
  assert.match(routeSource, /router\.put\('\\/:id\\/review'/);
  assert.match(routeSource, /router\.post\('\\/:id\\/convert'/);
});

test('conversion creates CRM company only from approved prospects', () => {
  assert.match(routeSource, /review_status !== 'approved'/);
  assert.match(routeSource, /INSERT INTO companies/);
  assert.match(routeSource, /lead_source/);
  assert.match(routeSource, /prospecting/);
});

test('server mounts prospects API route', () => {
  assert.match(indexSource, /prospectsRouter/);
  assert.match(indexSource, /app\.use\('\\/api\\/prospects', prospectsRouter\)/);
});
```

- [ ] **Step 2: Run the failing API test**

Run:

```bash
node --test tests/prospecting-api.test.mjs
```

Expected: FAIL because the route file and table do not exist yet.

- [ ] **Step 3: Add the prospects table**

In `server/db.ts`, add this SQL block inside the existing `db.exec` template after the `companies` table and before dependent workflow tables:

```sql
  CREATE TABLE IF NOT EXISTS prospects (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    country TEXT NOT NULL,
    website TEXT,
    customer_type TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_url TEXT,
    matched_materials TEXT DEFAULT '[]',
    matched_forms TEXT DEFAULT '[]',
    matched_capabilities TEXT DEFAULT '[]',
    matched_signals TEXT DEFAULT '[]',
    penalties TEXT DEFAULT '[]',
    evidence_text TEXT,
    confidence_score INTEGER NOT NULL DEFAULT 0,
    review_status TEXT NOT NULL DEFAULT 'new',
    notes TEXT,
    converted_company_id TEXT REFERENCES companies(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_prospects_review_status ON prospects(review_status);
  CREATE INDEX IF NOT EXISTS idx_prospects_country ON prospects(country);
  CREATE INDEX IF NOT EXISTS idx_prospects_website ON prospects(website);
```

- [ ] **Step 4: Add prospects router**

Create `server/routes/prospects.ts`:

```ts
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import {
  CUSTOMER_TYPES,
  TARGET_COUNTRIES,
  generateSearchSeeds,
  normalizeWebsite,
  scoreProspectEvidence,
} from '../prospecting.js';
import { validate } from '../validate.js';

const router = Router();

const SOURCE_TYPES = ['search', 'directory', 'exhibition'] as const;
const REVIEW_STATUSES = ['new', 'approved', 'rejected', 'deferred'] as const;
const PROSPECT_UPDATE_FIELDS = ['review_status', 'notes'] as const;

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function serializeJsonArray(value: string[]): string {
  return JSON.stringify(Array.from(new Set(value)));
}

function mapProspect(row: any) {
  if (!row) return row;
  return {
    ...row,
    matched_materials: parseJsonArray(row.matched_materials),
    matched_forms: parseJsonArray(row.matched_forms),
    matched_capabilities: parseJsonArray(row.matched_capabilities),
    matched_signals: parseJsonArray(row.matched_signals),
    penalties: parseJsonArray(row.penalties),
  };
}

router.get('/', (req: Request, res: Response) => {
  let sql = 'SELECT * FROM prospects WHERE deleted_at IS NULL';
  const params: string[] = [];

  if (req.query.country) {
    sql += ' AND country = ?';
    params.push(String(req.query.country));
  }
  if (req.query.review_status) {
    sql += ' AND review_status = ?';
    params.push(String(req.query.review_status));
  }
  if (req.query.customer_type) {
    sql += ' AND customer_type = ?';
    params.push(String(req.query.customer_type));
  }

  sql += ' ORDER BY confidence_score DESC, updated_at DESC';
  res.json(db.prepare(sql).all(...params).map(mapProspect));
});

router.post('/search-seeds', (req: Request, res: Response) => {
  const countries = Array.isArray(req.body.countries) ? req.body.countries.map(String) : [];
  const materials = Array.isArray(req.body.materials) ? req.body.materials.map(String) : [];
  const customerTypes = Array.isArray(req.body.customerTypes) ? req.body.customerTypes.map(String) : [];
  res.json({
    seeds: generateSearchSeeds({
      countries: countries.filter((country) => TARGET_COUNTRIES.includes(country as any)),
      materials,
      customerTypes: customerTypes.filter((type) => CUSTOMER_TYPES.includes(type as any)) as any,
    }),
  });
});

router.post('/', (req: Request, res: Response) => {
  const err = validate(req.body, ['company_name', 'country', 'customer_type', 'source_type']);
  if (err) return res.status(400).json({ success: false, message: err });

  if (!CUSTOMER_TYPES.includes(req.body.customer_type)) {
    return res.status(400).json({ success: false, message: 'Invalid customer_type' });
  }
  if (!SOURCE_TYPES.includes(req.body.source_type)) {
    return res.status(400).json({ success: false, message: 'Invalid source_type' });
  }

  const websiteKey = normalizeWebsite(req.body.website);
  if (websiteKey) {
    const duplicate = db.prepare(
      "SELECT id FROM prospects WHERE lower(replace(replace(replace(website, 'https://', ''), 'http://', ''), 'www.', '')) = ? AND deleted_at IS NULL",
    ).get(websiteKey);
    if (duplicate) return res.status(409).json({ success: false, message: 'Prospect website already exists' });
  }

  const score = scoreProspectEvidence({
    website: req.body.website,
    evidenceText: req.body.evidence_text,
    sourceText: req.body.source_text,
  });
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO prospects (
      id, company_name, country, website, customer_type, source_type, source_url,
      matched_materials, matched_forms, matched_capabilities, matched_signals, penalties,
      evidence_text, confidence_score, review_status, notes, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.body.company_name,
    req.body.country,
    req.body.website || null,
    req.body.customer_type,
    req.body.source_type,
    req.body.source_url || null,
    serializeJsonArray(score.matchedMaterials),
    serializeJsonArray(score.matchedForms),
    serializeJsonArray(score.matchedCapabilities),
    serializeJsonArray(score.matchedSignals),
    serializeJsonArray(score.penalties),
    req.body.evidence_text || null,
    score.confidenceScore,
    'new',
    req.body.notes || null,
    now,
    now,
  );

  res.status(201).json(mapProspect(db.prepare('SELECT * FROM prospects WHERE id = ?').get(id)));
});

router.put('/:id/review', (req: Request, res: Response) => {
  const updateFields = PROSPECT_UPDATE_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(req.body, field),
  );
  if (updateFields.length === 0) {
    return res.status(400).json({ success: false, message: 'No valid fields to update' });
  }
  if (req.body.review_status && !REVIEW_STATUSES.includes(req.body.review_status)) {
    return res.status(400).json({ success: false, message: 'Invalid review_status' });
  }

  const now = new Date().toISOString();
  const fields = updateFields.map((field) => `${field} = ?`).join(', ');
  const values = updateFields.map((field) => req.body[field]);
  const result = db.prepare(`UPDATE prospects SET ${fields}, updated_at = ? WHERE id = ? AND deleted_at IS NULL`)
    .run(...values, now, req.params.id);
  if (result.changes === 0) return res.status(404).json({ success: false, message: 'Record not found' });

  res.json(mapProspect(db.prepare('SELECT * FROM prospects WHERE id = ?').get(req.params.id)));
});

router.post('/:id/convert', (req: Request, res: Response) => {
  const prospect: any = db.prepare('SELECT * FROM prospects WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!prospect) return res.status(404).json({ success: false, message: 'Record not found' });
  if (prospect.review_status !== 'approved') {
    return res.status(400).json({ success: false, message: 'Only approved prospects can be converted' });
  }
  if (prospect.converted_company_id) {
    return res.json(db.prepare('SELECT * FROM companies WHERE id = ?').get(prospect.converted_company_id));
  }

  const existingCompany: any = prospect.website
    ? db.prepare('SELECT * FROM companies WHERE website = ? AND deleted_at IS NULL').get(prospect.website)
    : null;
  if (existingCompany) {
    db.prepare('UPDATE prospects SET converted_company_id = ?, updated_at = ? WHERE id = ?')
      .run(existingCompany.id, new Date().toISOString(), prospect.id);
    return res.json(existingCompany);
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const companyType = prospect.customer_type === 'distributor_stockist' ? 'distributor' : 'end_user';
  const notes = [
    prospect.notes,
    prospect.evidence_text ? `Prospecting evidence: ${prospect.evidence_text}` : null,
  ].filter(Boolean).join('\n\n');

  db.prepare(`
    INSERT INTO companies (
      id, name, company_type, industry, website, country, status,
      classification, lead_source, first_contact_date, notes, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    prospect.company_name,
    companyType,
    prospect.customer_type === 'machining_fabrication' ? 'Plastic machining' : 'Engineering plastics distribution',
    prospect.website || null,
    prospect.country,
    'active',
    'C',
    'prospecting',
    now,
    notes || null,
    now,
    now,
  );

  db.prepare('UPDATE prospects SET converted_company_id = ?, updated_at = ? WHERE id = ?').run(id, now, prospect.id);
  res.status(201).json(db.prepare('SELECT * FROM companies WHERE id = ?').get(id));
});

export default router;
```

- [ ] **Step 5: Mount the router**

In `server/index.ts`, add:

```ts
import prospectsRouter from './routes/prospects.js';
```

Then add below the other protected routes:

```ts
app.use('/api/prospects', prospectsRouter);
```

- [ ] **Step 6: Run the API source test**

Run:

```bash
node --test tests/prospecting-api.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Run server build check**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit Task 2**

Run:

```bash
git add server/db.ts server/routes/prospects.ts server/index.ts tests/prospecting-api.test.mjs
git commit -m "feat: add prospecting API"
```

---

### Task 3: Frontend API Client And Routing

**Files:**
- Modify: `src/lib/api.ts`
- Create: `src/types/prospecting.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/lib/i18n.tsx`
- Test: `tests/prospecting-ui.test.mjs`

**Interfaces:**
- Consumes: `GET /api/prospects`, `POST /api/prospects`, `POST /api/prospects/search-seeds`, `PUT /api/prospects/:id/review`, `POST /api/prospects/:id/convert`
- Produces: `prospects.list(params)`, `prospects.create(data)`, `prospects.searchSeeds(data)`, `prospects.review(id, data)`, `prospects.convert(id)`
- Produces: `/prospecting` frontend route

- [ ] **Step 1: Write the failing frontend source test**

Create `tests/prospecting-ui.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiSource = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const sidebarSource = readFileSync(new URL('../src/components/layout/Sidebar.tsx', import.meta.url), 'utf8');
const i18nSource = readFileSync(new URL('../src/lib/i18n.tsx', import.meta.url), 'utf8');

test('frontend API exposes prospect methods', () => {
  assert.match(apiSource, /export const prospects/);
  assert.match(apiSource, /\\/prospects\\?/);
  assert.match(apiSource, /\\/prospects\\/search-seeds/);
  assert.match(apiSource, /\\/prospects\\/\\$\\{id\\}\\/review/);
  assert.match(apiSource, /\\/prospects\\/\\$\\{id\\}\\/convert/);
});

test('app routes prospecting page', () => {
  assert.match(appSource, /import Prospecting from '.\\/pages\\/Prospecting'/);
  assert.match(appSource, /path="\\/prospecting"/);
});

test('sidebar includes prospecting navigation item', () => {
  assert.match(sidebarSource, /Target/);
  assert.match(sidebarSource, /nav\.prospecting/);
  assert.match(sidebarSource, /path: '\\/prospecting'/);
});

test('i18n includes prospecting strings in Chinese and English', () => {
  assert.match(i18nSource, /prospecting/);
  assert.match(i18nSource, /市场开发/);
  assert.match(i18nSource, /Prospecting/);
  assert.match(i18nSource, /工程塑料分销商/);
  assert.match(i18nSource, /CNC 塑料加工/);
});
```

- [ ] **Step 2: Run the failing frontend source test**

Run:

```bash
node --test tests/prospecting-ui.test.mjs
```

Expected: FAIL because the API methods, route, sidebar item, and strings are missing.

- [ ] **Step 3: Add frontend prospect types**

Create `src/types/prospecting.ts`:

```ts
export type ProspectCustomerType = 'distributor_stockist' | 'machining_fabrication';
export type ProspectSourceType = 'search' | 'directory' | 'exhibition';
export type ProspectReviewStatus = 'new' | 'approved' | 'rejected' | 'deferred';

export type Prospect = {
  id: string;
  company_name: string;
  country: string;
  website?: string | null;
  customer_type: ProspectCustomerType;
  source_type: ProspectSourceType;
  source_url?: string | null;
  matched_materials: string[];
  matched_forms: string[];
  matched_capabilities: string[];
  matched_signals: string[];
  penalties: string[];
  evidence_text?: string | null;
  confidence_score: number;
  review_status: ProspectReviewStatus;
  notes?: string | null;
  converted_company_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type ProspectListParams = {
  country?: string;
  review_status?: ProspectReviewStatus | '';
  customer_type?: ProspectCustomerType | '';
};

export type ProspectCreateInput = {
  company_name: string;
  country: string;
  website: string;
  customer_type: ProspectCustomerType;
  source_type: ProspectSourceType;
  source_url: string;
  evidence_text: string;
  notes: string;
};

export type ProspectSeedInput = {
  countries: string[];
  materials: string[];
  customerTypes: ProspectCustomerType[];
};
```

- [ ] **Step 4: Add frontend API methods**

In `src/lib/api.ts`, add after the companies API block:

```ts
// Prospects
export const prospects = {
  list: (params?: { country?: string; review_status?: string; customer_type?: string }) => {
    const q = new URLSearchParams();
    if (params?.country) q.set('country', params.country);
    if (params?.review_status) q.set('review_status', params.review_status);
    if (params?.customer_type) q.set('customer_type', params.customer_type);
    return request<any[]>(`/prospects${q.toString() ? '?' + q : ''}`);
  },
  create: (data: any) => request<any>('/prospects', { method: 'POST', body: JSON.stringify(data) }),
  searchSeeds: (data: any) => request<{ seeds: string[] }>('/prospects/search-seeds', { method: 'POST', body: JSON.stringify(data) }),
  review: (id: string, data: any) => request<any>(`/prospects/${id}/review`, { method: 'PUT', body: JSON.stringify(data) }),
  convert: (id: string) => request<any>(`/prospects/${id}/convert`, { method: 'POST' }),
};
```

- [ ] **Step 5: Add route and sidebar item**

In `src/App.tsx`, add:

```ts
import Prospecting from './pages/Prospecting';
```

Then add a route near the sales/workspace routes:

```tsx
<Route path="/prospecting" element={<Prospecting />} />
```

In `src/components/layout/Sidebar.tsx`, update the lucide import:

```ts
import { CircleDot, LayoutDashboard, Workflow, Building2, Users, Inbox, FileText, Package, Truck, Warehouse, Wallet, History, CheckSquare, Target } from 'lucide-react';
```

Add to `iconMap`:

```ts
'target': Target,
```

Add to the sales section before companies:

```ts
{ label: 'nav.prospecting', path: '/prospecting', icon: 'target' },
```

- [ ] **Step 6: Add i18n strings**

In `src/lib/i18n.tsx`, add `nav.prospecting` and `page.prospecting` strings to both existing language dictionaries:

```ts
prospecting: '市场开发'
```

Add Chinese page strings:

```ts
prospecting: {
  title: '市场开发',
  subtitle: '发现并审核中东、东南亚的工程塑料分销商和 CNC 塑料加工厂。',
  newProspect: '新增候选客户',
  generateSeeds: '生成搜索词',
  convertToCompany: '转入 CRM',
  distributorStockist: '工程塑料分销商',
  machiningFabrication: 'CNC 塑料加工',
  evidence: '证据',
  confidence: '匹配分',
  reviewStatus: '审核状态',
}
```

Add English page strings:

```ts
prospecting: {
  title: 'Prospecting',
  subtitle: 'Find and review engineering plastic distributors and CNC plastic machining suppliers in the Middle East and Southeast Asia.',
  newProspect: 'New prospect',
  generateSeeds: 'Generate search seeds',
  convertToCompany: 'Convert to CRM',
  distributorStockist: 'Engineering plastic distributor',
  machiningFabrication: 'CNC plastic machining',
  evidence: 'Evidence',
  confidence: 'Score',
  reviewStatus: 'Review status',
}
```

- [ ] **Step 7: Run frontend source test**

Run:

```bash
node --test tests/prospecting-ui.test.mjs
```

Expected: PASS. The build will not pass until Task 4 creates `src/pages/Prospecting.tsx`, but this source-level test should pass after the API methods, route, sidebar item, and i18n strings are added.

- [ ] **Step 8: Commit Task 3**

Run:

```bash
git add src/types/prospecting.ts src/lib/api.ts src/App.tsx src/components/layout/Sidebar.tsx src/lib/i18n.tsx tests/prospecting-ui.test.mjs
git commit -m "feat: wire prospecting frontend route"
```

---

### Task 4: Prospecting Workspace Page

**Files:**
- Create: `src/pages/Prospecting.tsx`
- Modify: `tests/prospecting-ui.test.mjs`

**Interfaces:**
- Consumes: `prospects.list`, `prospects.create`, `prospects.searchSeeds`, `prospects.review`, `prospects.convert`
- Produces: working `/prospecting` page

- [ ] **Step 1: Extend UI test for page behavior markers**

Append to `tests/prospecting-ui.test.mjs`:

```js
const pageSource = readFileSync(new URL('../src/pages/Prospecting.tsx', import.meta.url), 'utf8');

test('prospecting page contains filters, manual import, seeds, review, and conversion actions', () => {
  assert.match(pageSource, /prospects\.list/);
  assert.match(pageSource, /prospects\.create/);
  assert.match(pageSource, /prospects\.searchSeeds/);
  assert.match(pageSource, /prospects\.review/);
  assert.match(pageSource, /prospects\.convert/);
  assert.match(pageSource, /setSelectedProspect/);
  assert.match(pageSource, /review_status/);
  assert.match(pageSource, /confidence_score/);
});
```

- [ ] **Step 2: Run the failing page test**

Run:

```bash
node --test tests/prospecting-ui.test.mjs
```

Expected: FAIL because `src/pages/Prospecting.tsx` does not exist or does not contain the required markers.

- [ ] **Step 3: Add the Prospecting page**

Create `src/pages/Prospecting.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, CircleSlash, Clock3, Plus, RefreshCw, Search, Target } from 'lucide-react';
import toast from 'react-hot-toast';
import { prospects } from '../lib/api';
import type { Prospect, ProspectCreateInput, ProspectCustomerType, ProspectReviewStatus, ProspectSourceType } from '../types/prospecting';

const COUNTRIES = ['UAE', 'Saudi Arabia', 'Turkey', 'Qatar', 'Oman', 'Vietnam', 'Thailand', 'Malaysia', 'Indonesia', 'Singapore'];
const MATERIALS = ['PEEK', 'PPSU', 'PAI'];

const emptyForm: ProspectCreateInput = {
  company_name: '',
  country: 'UAE',
  website: '',
  customer_type: 'distributor_stockist',
  source_type: 'search',
  source_url: '',
  evidence_text: '',
  notes: '',
};

export default function Prospecting() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [list, setList] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{ country: string; review_status: ProspectReviewStatus | ''; customer_type: ProspectCustomerType | '' }>({
    country: '',
    review_status: '',
    customer_type: '',
  });
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [form, setForm] = useState<ProspectCreateInput>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [seeds, setSeeds] = useState<string[]>([]);
  const [seedCountry, setSeedCountry] = useState('UAE');
  const [seedCustomerType, setSeedCustomerType] = useState<ProspectCustomerType>('distributor_stockist');

  const load = async () => {
    setLoading(true);
    try {
      const rows = await prospects.list(filters);
      setList(rows);
      setSelectedProspect((current) => current ? rows.find((row) => row.id === current.id) || rows[0] || null : rows[0] || null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load prospects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters.country, filters.review_status, filters.customer_type]);

  const summary = useMemo(() => ({
    total: list.length,
    approved: list.filter((item) => item.review_status === 'approved').length,
    newItems: list.filter((item) => item.review_status === 'new').length,
  }), [list]);

  const createProspect = async () => {
    if (!form.company_name.trim()) {
      toast.error('Company name is required');
      return;
    }
    try {
      const created = await prospects.create(form);
      toast.success('Prospect added');
      setForm(emptyForm);
      setShowForm(false);
      await load();
      setSelectedProspect(created);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add prospect');
    }
  };

  const generateSeeds = async () => {
    const result = await prospects.searchSeeds({
      countries: [seedCountry],
      materials: MATERIALS,
      customerTypes: [seedCustomerType],
    });
    setSeeds(result.seeds);
  };

  const updateReview = async (review_status: ProspectReviewStatus) => {
    if (!selectedProspect) return;
    const updated = await prospects.review(selectedProspect.id, { review_status });
    setSelectedProspect(updated);
    await load();
  };

  const convert = async () => {
    if (!selectedProspect) return;
    const company = await prospects.convert(selectedProspect.id);
    toast.success('Converted to CRM company');
    navigate(`/companies/${company.id}`);
  };

  return (
    <div className="h-full flex bg-gray-50">
      <aside className="w-72 bg-white border-r border-gray-200 p-4 space-y-4 overflow-y-auto">
        <div>
          <h1 className="text-base font-semibold text-gray-900">{t('page.prospecting.title')}</h1>
          <p className="text-xs text-gray-500 mt-1">{t('page.prospecting.subtitle')}</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Metric label="Total" value={summary.total} />
          <Metric label="New" value={summary.newItems} />
          <Metric label="Approved" value={summary.approved} />
        </div>

        <div className="space-y-3">
          <label className="label">Country</label>
          <select className="input" value={filters.country} onChange={(event) => setFilters({ ...filters, country: event.target.value })}>
            <option value="">All countries</option>
            {COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
          </select>

          <label className="label">{t('page.prospecting.reviewStatus')}</label>
          <select className="input" value={filters.review_status} onChange={(event) => setFilters({ ...filters, review_status: event.target.value as ProspectReviewStatus | '' })}>
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="approved">Approved</option>
            <option value="deferred">Deferred</option>
            <option value="rejected">Rejected</option>
          </select>

          <label className="label">Customer type</label>
          <select className="input" value={filters.customer_type} onChange={(event) => setFilters({ ...filters, customer_type: event.target.value as ProspectCustomerType | '' })}>
            <option value="">All types</option>
            <option value="distributor_stockist">{t('page.prospecting.distributorStockist')}</option>
            <option value="machining_fabrication">{t('page.prospecting.machiningFabrication')}</option>
          </select>
        </div>

        <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={() => setShowForm(true)}>
          <Plus size={16} /> {t('page.prospecting.newProspect')}
        </button>

        <div className="border-t border-gray-100 pt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
            <Search size={16} /> {t('page.prospecting.generateSeeds')}
          </div>
          <select className="input" value={seedCountry} onChange={(event) => setSeedCountry(event.target.value)}>
            {COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
          </select>
          <select className="input" value={seedCustomerType} onChange={(event) => setSeedCustomerType(event.target.value as ProspectCustomerType)}>
            <option value="distributor_stockist">{t('page.prospecting.distributorStockist')}</option>
            <option value="machining_fabrication">{t('page.prospecting.machiningFabrication')}</option>
          </select>
          <button className="btn-secondary w-full flex items-center justify-center gap-2" onClick={generateSeeds}>
            <RefreshCw size={15} /> Generate
          </button>
          <div className="space-y-2">
            {seeds.map((seed) => <div key={seed} className="text-xs bg-gray-50 border border-gray-200 rounded-md p-2">{seed}</div>)}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-5">
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">Company</th>
                <th className="text-left px-4 py-3">Country</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">{t('page.prospecting.confidence')}</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-4 py-8 text-gray-500" colSpan={5}>Loading...</td></tr>
              ) : list.map((prospect) => (
                <tr key={prospect.id} onClick={() => setSelectedProspect(prospect)} className={`border-t border-gray-100 cursor-pointer hover:bg-blue-50/50 ${selectedProspect?.id === prospect.id ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{prospect.company_name}</td>
                  <td className="px-4 py-3 text-gray-600">{prospect.country}</td>
                  <td className="px-4 py-3 text-gray-600">{prospect.customer_type === 'distributor_stockist' ? t('page.prospecting.distributorStockist') : t('page.prospecting.machiningFabrication')}</td>
                  <td className="px-4 py-3"><Score value={prospect.confidence_score} /></td>
                  <td className="px-4 py-3 text-gray-600">{prospect.review_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <aside className="w-96 bg-white border-l border-gray-200 p-5 overflow-y-auto">
        {selectedProspect ? (
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <Target size={18} className="text-blue-600" />
                <h2 className="text-base font-semibold text-gray-900">{selectedProspect.company_name}</h2>
              </div>
              <a href={selectedProspect.website || selectedProspect.source_url || '#'} target="_blank" rel="noreferrer" className="text-xs text-blue-600 break-all">
                {selectedProspect.website || selectedProspect.source_url}
              </a>
            </div>

            <Detail label={t('page.prospecting.evidence')} value={selectedProspect.evidence_text || 'No evidence text saved'} />
            <TagGroup label="Materials" values={selectedProspect.matched_materials} />
            <TagGroup label="Forms" values={selectedProspect.matched_forms} />
            <TagGroup label="Capabilities" values={selectedProspect.matched_capabilities} />
            <TagGroup label="Signals" values={selectedProspect.matched_signals} />
            <TagGroup label="Penalties" values={selectedProspect.penalties} muted />

            <div className="grid grid-cols-3 gap-2">
              <button className="btn-secondary flex items-center justify-center gap-1" onClick={() => updateReview('approved')}><Check size={15} /> Approve</button>
              <button className="btn-secondary flex items-center justify-center gap-1" onClick={() => updateReview('deferred')}><Clock3 size={15} /> Defer</button>
              <button className="btn-secondary flex items-center justify-center gap-1" onClick={() => updateReview('rejected')}><CircleSlash size={15} /> Reject</button>
            </div>
            <button disabled={selectedProspect.review_status !== 'approved'} className="btn-primary w-full disabled:opacity-40" onClick={convert}>
              {t('page.prospecting.convertToCompany')}
            </button>
          </div>
        ) : (
          <div className="text-sm text-gray-500">Select a prospect</div>
        )}
      </aside>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/20 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg w-[560px] p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">{t('page.prospecting.newProspect')}</h3>
            <input className="input" placeholder="Company name" value={form.company_name} onChange={(event) => setForm({ ...form, company_name: event.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <select className="input" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })}>
                {COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
              </select>
              <select className="input" value={form.customer_type} onChange={(event) => setForm({ ...form, customer_type: event.target.value as ProspectCustomerType })}>
                <option value="distributor_stockist">{t('page.prospecting.distributorStockist')}</option>
                <option value="machining_fabrication">{t('page.prospecting.machiningFabrication')}</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select className="input" value={form.source_type} onChange={(event) => setForm({ ...form, source_type: event.target.value as ProspectSourceType })}>
                <option value="search">Search</option>
                <option value="directory">Directory</option>
                <option value="exhibition">Exhibition</option>
              </select>
              <input className="input" placeholder="Website" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} />
            </div>
            <input className="input" placeholder="Source URL" value={form.source_url} onChange={(event) => setForm({ ...form, source_url: event.target.value })} />
            <textarea className="input min-h-28" placeholder="Evidence text" value={form.evidence_text} onChange={(event) => setForm({ ...form, evidence_text: event.target.value })} />
            <textarea className="input min-h-20" placeholder="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={createProspect}>Create</button>
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-gray-200 p-2">
      <div className="text-2xs text-gray-500">{label}</div>
      <div className="text-base font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function Score({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full bg-blue-500" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-700">{value}</span>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function TagGroup({ label, values, muted = false }: { label: string; values: string[]; muted?: boolean }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {values.length === 0 ? <span className="text-xs text-gray-400">None</span> : values.map((value) => (
          <span key={value} className={`px-2 py-1 rounded-md text-xs ${muted ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{value}</span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run page source test**

Run:

```bash
node --test tests/prospecting-ui.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: PASS. If TypeScript reports missing i18n keys, fix `src/lib/i18n.tsx` in this task and rerun.

- [ ] **Step 6: Commit Task 4**

Run:

```bash
git add src/pages/Prospecting.tsx tests/prospecting-ui.test.mjs src/lib/i18n.tsx
git commit -m "feat: add prospecting workspace"
```

---

### Task 5: Local Write Smoke Coverage

**Files:**
- Modify: `tests/api-write-smoke.mjs`

**Interfaces:**
- Consumes: `/api/prospects`, `/api/prospects/:id/review`, `/api/prospects/:id/convert`
- Produces: smoke coverage that proves the write path creates, approves, and converts an anonymous prospect

- [ ] **Step 1: Add smoke test steps**

In `tests/api-write-smoke.mjs`, add a prospect section after the health check and before teardown:

```js
const prospectRes = await fetch(`${baseUrl}/api/prospects`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    company_name: `Sample Prospect ${Date.now()}`,
    country: 'UAE',
    website: `https://sample-prospect-${Date.now()}.example.com`,
    customer_type: 'distributor_stockist',
    source_type: 'search',
    source_url: 'https://example.com/source',
    evidence_text: 'PEEK rod supplier and engineering plastics stock shapes for industrial customers.',
    notes: 'Anonymous smoke test prospect.',
  }),
});
assert.equal(prospectRes.status, 201);
const prospect = await prospectRes.json();
assert.equal(prospect.review_status, 'new');
assert.ok(prospect.confidence_score > 0);

const reviewRes = await fetch(`${baseUrl}/api/prospects/${prospect.id}/review`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ review_status: 'approved' }),
});
assert.equal(reviewRes.status, 200);

const convertRes = await fetch(`${baseUrl}/api/prospects/${prospect.id}/convert`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
});
assert.equal(convertRes.status, 201);
const company = await convertRes.json();
assert.equal(company.lead_source, 'prospecting');
```

- [ ] **Step 2: Run smoke test**

Run:

```bash
npm run smoke:api
```

Expected: PASS. This writes anonymous test data into the local CRM database.

- [ ] **Step 3: Commit Task 5**

Run:

```bash
git add tests/api-write-smoke.mjs
git commit -m "test: cover prospect conversion smoke path"
```

---

### Task 6: Final Verification And Documentation Sync

**Files:**
- Modify: `PLANS.md`
- Optional Modify: `README.md`

**Interfaces:**
- Consumes: completed Tasks 1-5
- Produces: updated project plan notes and final verification record

- [ ] **Step 1: Update PLANS.md current batch**

In `PLANS.md`, add a new current batch section near the top:

```md
# Prospecting Module Plan

**Goal:** Add a local market development workspace for discovering and reviewing Middle East and Southeast Asia engineering plastics prospects.

**Current batch:** Prospecting MVP.

**Affected files for prospecting MVP:**
- `server/prospecting.ts`
- `server/db.ts`
- `server/routes/prospects.ts`
- `server/index.ts`
- `src/lib/api.ts`
- `src/types/prospecting.ts`
- `src/pages/Prospecting.tsx`
- `src/App.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/lib/i18n.tsx`
- `tests/prospecting-logic.test.mjs`
- `tests/prospecting-api.test.mjs`
- `tests/prospecting-ui.test.mjs`
- `tests/api-write-smoke.mjs`

**Verification:**
- `node --test tests/prospecting-logic.test.mjs`
- `node --test tests/prospecting-api.test.mjs`
- `node --test tests/prospecting-ui.test.mjs`
- `npm run test`
- `npm run build`
- `npm run smoke:api`
```

- [ ] **Step 2: Run targeted tests**

Run:

```bash
node --test tests/prospecting-logic.test.mjs
node --test tests/prospecting-api.test.mjs
node --test tests/prospecting-ui.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Run full checks**

Run:

```bash
npm run test
npm run build
```

Expected: PASS.

- [ ] **Step 4: Run local write smoke test**

Run only after explaining that it writes anonymous local test rows:

```bash
npm run smoke:api
```

Expected: PASS.

- [ ] **Step 5: Review only task-owned diff**

Run:

```bash
git diff -- server/prospecting.ts server/db.ts server/routes/prospects.ts server/index.ts src/lib/api.ts src/types/prospecting.ts src/pages/Prospecting.tsx src/App.tsx src/components/layout/Sidebar.tsx src/lib/i18n.tsx tests/prospecting-logic.test.mjs tests/prospecting-api.test.mjs tests/prospecting-ui.test.mjs tests/api-write-smoke.mjs PLANS.md
```

Expected: diff only contains prospecting-related changes.

- [ ] **Step 6: Commit Task 6**

Run:

```bash
git add PLANS.md README.md
git commit -m "docs: update prospecting implementation notes"
```

If `README.md` was not changed, run:

```bash
git add PLANS.md
git commit -m "docs: update prospecting implementation notes"
```

---

## Self-Review Notes

- Spec coverage: target countries, customer types, materials, source lanes, data model, scoring, review statuses, explicit CRM conversion, error states, and tests are each represented in Tasks 1-6.
- Scope control: automated live web discovery remains outside this implementation. Task 4 only generates search seeds and supports manual candidate import.
- Dependency control: no new dependencies are introduced.
- Safety: private email scraping, automated outreach, and unreviewed CRM writes are excluded.
- Test strategy: source-level tests protect structure and safety rules; smoke coverage validates the local write path after implementation.
