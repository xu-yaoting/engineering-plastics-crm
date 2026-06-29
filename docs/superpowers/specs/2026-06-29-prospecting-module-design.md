# Prospecting Module Design

## Goal

Build a local prospecting module inside the Engineering Plastics CRM to discover new customer candidates in the Middle East and Southeast Asia for high-performance polymer stock shapes and machined parts.

The first version focuses on finding and reviewing company leads, not sending outreach automatically. A lead only enters the main CRM company list after manual approval.

## Scope

### Target Regions

Middle East:
- UAE
- Saudi Arabia
- Turkey
- Qatar
- Oman

Southeast Asia:
- Vietnam
- Thailand
- Malaysia
- Indonesia
- Singapore

### Target Customer Types

The first version targets two customer categories:

- `distributor_stockist`: engineering plastic distributors, stockists, material suppliers, and stock shape suppliers.
- `machining_fabrication`: CNC machining shops, plastic machining suppliers, custom engineering plastic component manufacturers, and fabrication shops.

Terminal industry buyers such as medical device companies, oil and gas operators, semiconductor equipment makers, and food equipment OEMs are out of scope for the first version. They may be added after the lead discovery workflow proves reliable.

### Target Materials And Forms

Core materials:
- PEEK
- PPSU
- PAI

Secondary match materials:
- PPS
- PEI
- PTFE
- PVDF

Target forms and offerings:
- Rod
- Sheet
- Tube
- Stock shapes
- Machined plastic parts
- Custom components

## Non-Goals

The first version will not:

- Send emails automatically.
- Perform LinkedIn automation.
- Scrape private personal email addresses as a primary objective.
- Write unreviewed leads directly into CRM companies or contacts.
- Claim product parameters, certifications, or customer fit without source evidence.
- Use real customer data in tests or seed fixtures.

## Source Strategy

The module uses three source lanes. Each lead keeps its source type and evidence URL so that quality can be reviewed later.

### Search Sources

Search-driven discovery uses generated query phrases such as:

- `PEEK rod supplier UAE`
- `PPSU sheet distributor Thailand`
- `PAI engineering plastic machining Turkey`
- `high performance plastic stock shapes Malaysia`
- `plastic CNC machining PEEK Saudi Arabia`

This lane is best for precision because it can find company websites and product pages directly.

### Directory Sources

Directory-driven discovery uses B2B sites, industrial directories, yellow pages, local supplier directories, and similar public listings.

This lane is best for volume, but leads from this lane require stricter scoring because duplicate, generic, and low-fit suppliers are common.

### Exhibition And Association Sources

Exhibition and association discovery uses public exhibitor lists, trade fair pages, and industry association directories where available.

Relevant event families include plastics, manufacturing, oil and gas, medical manufacturing, and industrial automation events in the target regions. This lane is useful for vertical relevance, but source coverage may vary by country.

## Lead Data Model

Each prospect candidate should store:

```text
id
company_name
country
website
customer_type
source_type
source_url
matched_materials
matched_forms
matched_capabilities
evidence_text
confidence_score
review_status
notes
created_at
updated_at
```

Allowed values:

```text
customer_type:
  distributor_stockist
  machining_fabrication

source_type:
  search
  directory
  exhibition

matched_forms:
  rod
  sheet
  tube
  stock_shapes
  parts

matched_capabilities:
  stockist
  distributor
  cnc_machining
  fabrication
  custom_components

review_status:
  new
  approved
  rejected
  deferred
```

## Scoring Rules

The first version uses transparent rule-based scoring. AI may summarize and explain the match, but the score should be auditable from evidence fields.

Positive signals:
- Website or source explicitly mentions PEEK, PPSU, or PAI.
- Website mentions high-performance plastics or engineering plastics.
- Website mentions rod, sheet, tube, stock shapes, or semi-finished products.
- Website mentions CNC machining, plastic machining, fabrication, or custom components.
- Website shows a relevant market fit such as oil and gas, medical, semiconductor, aerospace, food equipment, or industrial machinery.

Negative signals:
- Website only mentions commodity plastics such as PE, PP, PVC, acrylic, packaging materials, or household plastic goods.
- No website is available.
- Website cannot be opened or evidence cannot be verified.
- Source page is a thin directory listing with no product or capability proof.
- Company appears duplicated under a different source.

Suggested first-version weighting:

```text
core material match: +35
engineering or high-performance plastics match: +25
stock shape match: +20
machining or fabrication match: +15
relevant industry application match: +15
commodity-only signal: -25
missing or unreachable website: -30
thin source without proof: -15
duplicate candidate: merge, do not score separately
```

Scores should be clamped to a 0-100 range.

## User Workflow

1. User opens the Prospecting module.
2. User selects countries, materials, customer types, and source lanes.
3. The system generates search seeds and discovery tasks.
4. User imports candidate companies from source results, directories, or exhibitor lists.
5. The system stores source URLs and extracts available evidence from imported source text or website snippets.
6. The system scores, classifies, and deduplicates candidates.
7. User reviews each candidate and sets `approved`, `rejected`, or `deferred`.
8. Approved candidates can be converted into CRM companies.

Conversion to CRM should be explicit and review-driven. The first version may create companies without contacts if no verified contact person is available.

## Interface Design

The module should fit the existing CRM style and behave like an operations workspace, not a marketing landing page.

Recommended layout:

- Left filter panel: region, country, material, customer type, source type, score range, review status.
- Center table: company name, country, customer type, matched materials, source type, confidence score, review status.
- Right detail panel: website, source URL, evidence text, matched signals, AI match explanation, notes, and review actions.

Primary actions:

- Generate search seeds
- Import candidate
- Mark approved
- Mark rejected
- Mark deferred
- Convert to CRM company

## Data Flow

```text
User filters
  -> discovery seed generation
  -> manual candidate import
  -> evidence extraction
  -> scoring and deduplication
  -> review queue
  -> optional CRM conversion
```

The discovery and evidence steps should be separated so that manually imported leads can use the same scoring and review path as future automatically discovered leads.

## Error Handling

The module should keep partial progress visible when a source fails.

Expected failure states:

- Search or source fetch fails.
- Website is unreachable.
- Website text cannot be extracted.
- Candidate is missing a company name or website.
- Candidate duplicates an existing prospect or CRM company.
- AI explanation fails while rule-based scoring succeeds.

Handling rules:

- Failed evidence extraction should not delete the candidate.
- Unreachable websites should lower confidence and show the failure reason.
- Duplicate candidates should merge source evidence where possible.
- AI failures should show a retry option and preserve rule-based scoring.

## Testing Strategy

Use local tests with anonymous fixture data.

Minimum tests:

- Search seed generation includes expected country, material, and customer type terms.
- Scoring produces higher scores for core material and stock-shape evidence.
- Commodity-only suppliers are downgraded.
- Duplicate websites merge into one candidate.
- Review status changes are persisted.
- Approved prospects convert to CRM company records only after explicit action.

No tests should include real customer data, private emails, contract values, or sensitive business records.

## First Implementation Milestones

1. Add prospect data model and local storage.
2. Add scoring and deduplication helpers with tests.
3. Add Prospecting navigation and list/detail workspace.
4. Add manual candidate import path.
5. Add search seed generation.
6. Add review status actions.
7. Add explicit conversion from approved prospect to CRM company.
8. Add source/evidence display and failure states.

Automated live web discovery can be added after the local review workflow is stable. That avoids coupling the first UI and data model to a specific search provider too early.
