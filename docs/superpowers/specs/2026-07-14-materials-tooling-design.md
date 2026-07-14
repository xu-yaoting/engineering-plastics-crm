# Materials & Tooling Design

**Date:** 2026-07-14
**Status:** Conversation-approved; awaiting written review
**Product name:** 工厂物资与工装管理系统
**Navigation label:** Materials & Tooling / 物资与工装

## 1. Goal

Add a document-driven materials and tooling module to the existing CRM. The module replaces paper and spreadsheet-based consumables records while preserving printable offline signatures and creating an online audit trail.

The module must:

- record consumable purchases, receipts, issues, returns, scrap, and stock counts;
- manage tooling custody, location, repair, return, and disposal;
- retain real purchase prices for future supplier negotiation;
- attach quotations, contracts, invoices, delivery notes, acceptance records, and signed paper copies;
- generate the warehouse's familiar monthly receipt/issue/balance ledger;
- support online approval and offline signatures;
- keep all materials data independent from CRM customers, inquiries, quotations, orders, shipments, payments, and existing Inventory data.

This is a lightweight operational record system, not an ERP or accounting system.

## 2. Chosen approach

Use source documents as the system of record and calculate ledgers from executed documents.

```text
Purchase request -> approval -> receipt
Issue request -> approval -> issue
Return / scrap / stock count adjustment
Tooling issue / return / repair / disposal
                         |
                         v
                 immutable movements
                         |
                         v
             monthly receipt/issue/balance ledger
```

The monthly table is a generated report, not an editable spreadsheet. Users correct errors through the original document or through a void-and-replacement workflow.

## 3. CRM integration boundary

### 3.1 Placement

Add `Materials & Tooling` immediately below `Inventory` in the CRM sidebar. It is a sibling route, not an Inventory submenu.

```text
/inventory
/materials-tooling
```

The module uses its own secondary navigation:

1. Overview
2. Materials
3. Documents
4. Monthly Ledger
5. Tooling
6. Approvals

### 3.2 Shared infrastructure

The module may share:

- authenticated CRM users and display names;
- layout and common UI primitives;
- audit-writing infrastructure;
- local file storage and backup procedures;
- common export infrastructure.

### 3.3 Isolated business data

The module must not reuse or reference:

- `products`;
- `inventory_transactions`;
- customers or contacts;
- inquiries or quotations;
- sales orders;
- shipments or payments.

Only authenticated CRM users may be referenced as applicants, custodians, approvers, operators, uploaders, and administrators. Materials tables and APIs use their own namespace and validation.

## 4. Access control

Every authenticated CRM user can enter the module. Module permissions are independent from sales ownership and CRM roles.

| Capability | Member | Materials clerk (Moana) | Approver | Administrator |
|---|---:|---:|---:|---:|
| Enter module | Yes | Yes | Yes | Yes |
| View quantities and non-sensitive records | Yes | Yes | Yes | Yes |
| Create an issue request | Yes | Yes | Yes | Yes |
| Create a purchase request | No | Yes | No | Yes |
| View purchase prices | No | Yes | Yes | Yes |
| View quotations, contracts, and invoices | No | Yes | Yes | Yes |
| Maintain material masters | No | Yes | No | Yes |
| Receive, issue, and count materials | No | Yes | No | Yes |
| Approve assigned documents | No | No | Yes | Yes |
| Void executed documents or reopen periods | No | No | No | Yes |

An applicant cannot approve their own document. Access control must be enforced by the server for pages, API responses, exports, and attachment downloads. Hiding a UI control is not sufficient.

## 5. Material master

Each material record contains:

- internal material code;
- name;
- category;
- specification or model;
- unit of measure;
- warehouse and bin location;
- safety quantity;
- active/inactive status;
- notes;
- created and updated actor metadata.

Current quantity is calculated from executed material movements. It is never edited directly.

The material detail shows current quantity, movement history, monthly history, and—only for authorized users—purchase price history and sensitive attachments.

## 6. Business documents

All documents share a number, version, applicant, department, dates, status, notes, attachments, creation/update actors, approval history, and immutable snapshots.

### 6.1 Purchase request

Number format: `PR-YYYY-NNNN`.

Fields include request date, applicant, department, required date, reason, material lines, requested quantities, last purchase price reference, estimated unit price and amount, suggested supplier, notes, and quotation attachments.

### 6.2 Purchase receipt

Number format: `GR-YYYY-NNNN`.

Fields include receipt date, supplier, optional related purchase request, material lines, received quantities, actual tax-inclusive unit prices and amounts, warehouse/bin, inspection result, invoice number, contract number, operator, notes, and supporting attachments.

Executing a receipt creates positive material movements and purchase price history. A receipt does not create accounting entries or payables.

### 6.3 Material issue

Number format: `MI-YYYY-NNNN`.

Fields include applicant, recipient, department, request/required dates, purpose, requested quantities, actual issued quantities, issuer, issue date, and notes.

Approval is required before issue. Execution creates negative material movements. The print layout includes applicant/recipient, approver, and issuer signature areas.

### 6.4 Material return

A return normally references the original issue. It records returned quantities, reason, condition, receiver, and date. Execution creates positive movements. When possible, its reference price follows the original issue.

### 6.5 Scrap

A scrap document records material, quantity, reason, evidence photos, applicant, and approval. Approval and execution are required before it creates negative movements.

### 6.6 Stock count adjustment

The document stores system quantity, counted quantity, difference, reason, counter, date, and approver. Only approved and executed adjustments affect quantity. Direct quantity editing is forbidden.

### 6.7 Tooling movement

Tooling issue, return, transfer, repair, repair completion, and disposal use a tooling movement document. Tooling movements change lifecycle state and custody rather than consumable stock quantity.

## 7. Approval and document lifecycle

First phase uses one online approval step. Multi-person paper signatures may remain in the printed form without becoming a multi-step online workflow.

```text
Draft
  -> Pending approval
       |-> Rejected
       `-> Approved
             -> Pending execution
             -> Executed
             -> Awaiting signed copy
             -> Completed
```

Additional terminal or corrective statuses are Withdrawn, Voided, and Rejected.

Rules:

- submission freezes a versioned snapshot and generates an application PDF;
- rejection requires a reason;
- resubmission creates a new version while preserving previous versions;
- approval creates an approved PDF containing the online approval record;
- execution posts movements and cannot occur before approval;
- uploading the signed paper copy completes the online/offline evidence chain;
- executed records cannot be edited or deleted;
- administrators correct an executed error by voiding it with a reason and creating a replacement document;
- every status transition records actor, time, comment, before state, and after state.

## 8. PDF and offline signatures

Individual documents export as A4 PDFs. Each PDF contains:

- company and document names;
- document number and version;
- applicant, department, and dates;
- line-item table;
- quantities and, for authorized purchase forms, prices and amounts;
- reason and notes;
- online approval record;
- offline signature areas;
- generation time.

Application and approved PDF snapshots are immutable. Signed scans or photos are uploaded as separate attachments to the same document.

## 9. Monthly receipt/issue/balance ledger

The monthly ledger follows the warehouse's current spreadsheet structure:

- material name and unit;
- opening quantity, reference unit price, and reference amount;
- period receipts quantity, unit price, and amount;
- period issues quantity, reference unit price, and reference amount;
- closing quantity, reference unit price, and reference amount;
- notes.

Quantity calculation:

```text
closing quantity
= opening quantity
+ purchase receipts
+ material returns
- material issues
- scrap
+/- approved count adjustments
```

Users can select a month, search by name, filter by category, show or hide amount columns, and drill from a summary value to its source documents. Members see quantities only; authorized roles see prices and amounts.

The ledger exports to Excel and A3 landscape PDF. The Excel grouping and column order should closely match the current warehouse workbook.

## 10. Price history and reference amounts

The purpose of price storage is procurement negotiation, not accounting valuation.

Every purchase receipt preserves the actual supplier, date, quantity, tax-inclusive unit price, amount, invoice/contract identifiers, and supporting documents. Authorized users can view:

- latest purchase price;
- historical minimum and maximum;
- three most recent purchases;
- change from the previous purchase;
- per-supplier price history and comparison;
- linked quotation, contract, invoice, and delivery evidence.

The monthly ledger may display a reference weighted-average unit price:

```text
(opening reference amount + period purchase receipt amount)
/
(opening quantity + period purchase receipt quantity)
```

When the denominator is zero, the reference unit price and amount are zero. Returns linked to an issue retain that issue's reference price; unlinked returns use the current reference price on the return date.

Issue and closing amounts are reference values and must be labelled "not an accounting record." Negotiation views always use actual purchase batches rather than averages.

## 11. Period close

Months are Open or Closed.

Before closing, the system checks for pending approvals, pending execution, missing signed copies, and negative quantities. The materials clerk closes the period, which:

1. stores an immutable monthly snapshot;
2. carries closing quantity and reference amount into the next opening balance;
3. records the closer and close time;
4. prevents new or modified transactions dated in the closed month.

Only an administrator can reopen a period, and a reason is mandatory. The system preserves old and replacement snapshots and all reopen/close events.

## 12. Tooling lifecycle

Each individually tracked tool, mold, fixture, or gauge has:

- tooling code, name, category, and specification;
- serial number or tracked quantity;
- current state, custodian, and location;
- acquisition/manufacture date and supplier;
- purchase price, contract number, and invoice number;
- expected life and next maintenance date;
- photos, drawings, acceptance records, contracts, and notes.

States are In stock, In use, Loaned, Under repair, Disposed, and Lost.

Valid transitions include:

- issue: In stock -> In use;
- return: In use -> In stock;
- repair: In stock/In use -> Under repair;
- repair completion: Under repair -> In stock;
- disposal: any active state -> Disposed.

State, custody, and location can change only through a movement document. The tooling record exposes the complete handover and maintenance history.

## 13. Attachments

Attachments remain in local CRM-managed storage and must be included in backup and restore procedures.

Supported first-phase formats are PDF, JPG, PNG, Excel, and Word. Attachment categories are Quotation, Contract, Invoice, Delivery note, Acceptance record, Signed copy, Tooling photo, Drawing, and Other.

Metadata includes original filename, type, size, category, owning document, uploader, upload time, and notes.

Rules:

- new uploads never silently overwrite old files;
- document snapshots cannot be replaced or deleted;
- attachment removal is administrator-only and audited;
- sensitive purchase attachments use the same server-enforced permissions as price data;
- a failed upload cannot incorrectly complete a document.

## 14. Historical import

Do not attempt to reconstruct years of source documents from monthly spreadsheets.

At launch:

1. choose a formal cutover date;
2. import the prior month closing quantities as opening balances;
3. optionally import trustworthy historical purchase batches as reference-only price history;
4. require all post-cutover changes to originate from module documents.

Imported opening entries identify the source workbook, import actor, import time, and cutover period.

## 15. Error handling and consistency

The system must reject:

- invalid or non-positive requested/executed quantities;
- issue quantities greater than available quantity;
- execution without approval;
- self-approval;
- duplicate execution caused by repeated submission;
- back-dated changes to closed periods;
- issue of disposed or already-issued tooling;
- unauthorized price or sensitive attachment access.

Document execution, movement creation, state changes, and audit records occur atomically. A failure must not leave a partially executed document or partial quantity change. Negative stock is forbidden; physical discrepancies use an approved count adjustment.

## 16. Audit requirements

The system audits creation, editing, submission, withdrawal, resubmission, approval, rejection, execution, attachment upload/removal, formal PDF download, void/replacement, period close/reopen, and every tooling transition.

Each audit entry records actor, time, action, entity, before values, after values, and reason/comment where required.

## 17. Acceptance criteria

The first release is acceptable when all of the following are verified:

1. A member creates an issue request and an approver approves it online.
2. The system generates a printable issue PDF and accepts a later signed scan.
3. The materials clerk executes the issue once, quantity decreases correctly, and the monthly ledger updates.
4. A purchase receipt increases quantity and creates actual supplier price history.
5. Members cannot access purchase prices, contracts, invoices, sensitive exports, or attachment URLs.
6. The materials clerk exports a monthly Excel ledger matching the current workbook's structure.
7. Closed periods reject new or changed dated transactions.
8. Reopening a period requires an administrator reason and is audited.
9. Tooling issue, return, repair, repair completion, and disposal produce valid states and history.
10. Duplicate submissions, insufficient quantity, or failed attachments do not create partial data.
11. Database and business attachments can be backed up and restored together.
12. Existing Inventory, customer, sales, fulfillment, and payment workflows remain unchanged.

## 18. Explicit non-goals

The first release does not include:

- general ledger or accounting valuation;
- accounts payable or payment reconciliation;
- tax or invoice certification workflows;
- automated bidding or supplier tendering;
- production planning, BOMs, work orders, or MRP;
- links to CRM customers, sales orders, or existing Inventory records;
- third-party legally binding electronic signatures;
- multi-step online approval chains.

## 19. Implementation sequencing constraint

Implementation should proceed in small, independently verified milestones: domain schema and permissions; material masters and movements; approval documents; monthly ledger and exports; attachments and snapshots; tooling lifecycle; historical import and hardening. The detailed file-by-file plan is created only after this design receives final document review approval.
