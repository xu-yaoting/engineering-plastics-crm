# CRM Data Entry Standards

## Purpose

These rules keep CRM data searchable, consistent, and safe during the internal trial period.

The goal is not perfection. The goal is that 2-3 users enter data in the same way.

## General Rules

- Enter real business data only when the current workflow is clear.
- Do not enter test records into the main working database unless the name starts with `TEST -`.
- Do not delete real records just to hide mistakes. Prefer notes, status changes, or correction records.
- Before large cleanup or import work, run `npm run backup`.
- If unsure, record the issue instead of guessing.

## Company Records

### Company Name

Use the customer's normal business name.

Recommended:
- `ABC Plastics Co., Ltd.`
- `Example Engineering LLC`

Avoid:
- Short nicknames only.
- Mixing contact person's name into company name.
- Adding temporary notes in the company name field.

### Customer Code

Use customer code only when it is stable enough for order numbering.

Rules:
- Keep it short.
- Use uppercase letters and numbers.
- Do not reuse one code for two companies.

### Country And Region

Use the same country naming style for similar customers.

Examples:
- `United States`
- `Vietnam`
- `UAE`

## Contact Records

Minimum recommended fields:
- First name.
- Last name or family name when known.
- Email when known.
- Job title.
- Department.
- Role in process.

If email is unknown:
- Leave it blank only if the system allows it.
- Do not use placeholder symbols such as `#` for real records unless there is no current alternative.

Use notes for:
- Preferred language.
- Communication habits.
- Decision influence.
- Temporary uncertainty.

## Inquiry Records

Record the customer's actual need as clearly as possible.

Minimum recommended fields:
- Customer.
- Contact when known.
- Material or target material.
- Quantity estimate.
- Application description.
- Urgency.
- Source.

Do not invent:
- Technical parameters.
- Certifications.
- Budget.
- Operating conditions.

If unknown, leave blank or write `待确认` in notes.

## Quotation Records

Before sending or using a quotation:
- Check customer and contact.
- Check material, product name, quantity, and unit.
- Check currency.
- Check unit price and total.
- Check payment term and delivery term.
- Preview PDF.

Do not treat draft quotations as final offers until Nathan reviews them.

## Order Records

Before confirming an order:
- Confirm the linked quotation or inquiry.
- Confirm customer name.
- Confirm products and quantities.
- Confirm total amount and currency.
- Confirm delivery requirement.

Order status should reflect actual progress, not expectation.

## Inventory Products

### SKU

SKU must be unique.

Recommended format:

```text
MATERIAL-FORM-SPEC
```

Examples:
- `PEEK-SHEET-10MM`
- `POM-ROD-30MM`
- `PTFE-TUBE-50X30MM`

Rules:
- Use uppercase material names.
- Keep units clear.
- Do not reuse SKU for different dimensions.
- If SKU is wrong, edit it before stock transactions build up.

### Product Name

Use readable names:
- `PEEK Sheet 10mm`
- `POM Rod 30mm`
- `PTFE Tube 50x30mm`

Avoid:
- Only material name.
- Only internal shorthand.

## Stock In

Use stock in when inventory increases because goods are received or opening balance is entered.

Required:
- Product.
- Quantity.
- Date.
- Operator.
- Notes when source is unclear.

Recommended notes:
- Supplier.
- Purchase order.
- Opening balance.
- Correction reason.

## Stock Out

Use stock out when inventory decreases because goods are shipped, sampled, consumed, or corrected.

Required:
- Product.
- Quantity.
- Date.
- Operator.
- Notes or reference when possible.

Do not stock out more than available quantity unless the system explicitly supports a correction workflow.

## Stock Adjustment

Use adjustment only for count corrections.

Examples:
- Annual count found actual stock is lower.
- Unit conversion correction.
- Old opening balance was wrong.

Required notes:
- Why the adjustment was made.
- Who confirmed it.

## Payments

Before recording payment:
- Confirm invoice or order.
- Confirm payer/customer.
- Confirm amount.
- Confirm currency.
- Confirm payment date.

Do not enter payment above remaining invoice balance unless the workflow explicitly supports prepayment or overpayment handling.

## Shipments

Before creating shipment:
- Confirm order.
- Confirm customer.
- Confirm shipment address.
- Confirm carrier or shipping method.
- Confirm tracking information when available.

Status should match real shipment status.

## Corrections

If a user entered wrong data:
- Fix simple text fields directly.
- For inventory and payment mistakes, prefer explicit correction records where possible.
- Add notes explaining why the correction was made.
- For serious mistakes, create an issue log entry.

## End Of Day

Before closing the day:
- Save all open work.
- Check any failed saves or uncertain records.
- Run `npm run backup` on the host machine.
- Record any P0/P1 issues in the issue log.
