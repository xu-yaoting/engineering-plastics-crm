# JEKIN CRM Design Language

## Design Read

JEKIN CRM is a compact B2B operations product for a small engineering-plastics trading team. It should feel precise, calm, dependable, and fast to scan. The visual reference is the Venture CRM UI kit: a monochrome black-and-white shell, pastel status tints, hairline borders, and generous corner radii — adapted to industrial-sales density rather than copied as a skin.

Design dials:

- Visual variance: 4/10
- Motion intensity: 3/10
- Information density: 7/10

## Foundations

### Color

- Primary command color: pure black. Used for primary buttons, active navigation, focus, and record links.
- Neutrals: true gray only, no blue cast. Do not mix warm cream or slate-blue page backgrounds.
- Status fills are always pastel tints with a saturated text or icon color, never a saturated block.
- Red: overdue, destructive, or failed states only.
- Green: completed, paid, delivered, or healthy states only.
- Amber: waiting, partial, or approaching-risk states only.
- Stage identity colors (quotation blue, order purple, shipment cyan, payment green) may mark pipeline stages and small pastel icon chips, but must not become page accents.
- Do not use decorative gradients, glowing backgrounds, or colored blobs.

Semantic tokens:

| Role | Value | Use |
| --- | --- | --- |
| Brand | `#000000` | Primary command, active navigation, selected state, record links |
| Brand foreground | `#FFFFFF` (`#0A0A0A` in dark) | Text on primary buttons |
| Text | `#141414` | Headings, key values, primary content |
| Muted text | `#6F6F6F` | Supporting labels and descriptions |
| Subtle text | `#A3A3A3` | Metadata, placeholders, disabled context |
| Canvas | `#F5F5F5` | Application background |
| Subtle surface | `#FAFAFA` | Quiet grouped content |
| Hover surface | `#F1F1F1` | Hover and selected row support |
| Border | `#ECECEC` / strong `#D9D9D9` | Default dividers and surface edges |
| Success | `#168A5B` (soft `#E7EFE8`) | Completed, paid, delivered, healthy |
| Warning | `#B7791F` (soft `#F5EFE1`) | Waiting, partial, approaching risk |
| Danger | `#D64545` (soft `#F7E8E8`) | Overdue, failed, insufficient, destructive |

Black is not a generic emphasis color. Normal totals and identifiers use primary text; keep black fills for primary commands, active states, and actionable record links.

### Surfaces

1. App canvas: neutral off-white background.
2. Primary work surface: white, usually unframed or separated by a single border.
3. Repeated record: row with dividers, not a floating card.
4. Elevated surface: menus, dialogs, and side panels only.
5. Risk surface: pale status tint plus a narrow status edge; never a large saturated block.

### Shape

- Inputs, buttons, and small icon chips: 10px radius.
- Cards, data surfaces, and dialogs: 12px radius.
- Pills are reserved for statuses, filters, and binary choices.
- Circular shapes are reserved for avatars and icon-only circular controls.

### Typography

Keep the existing Inter/PingFang SC stack and compact scale. Do not enlarge dashboard or list headings. Use 400 for content, 450/500 for labels and controls, and 600 for page titles and critical values. Use tabular figures for money, quantities, dates, IDs, SKU, and percentages.

Row-primary text in tables — record names and document numbers — uses 500. Card and panel titles sit at two levels: 14px/600 for workspace-level cards, 13px/600 in panels and dialogs.

## Page Architecture

Every operational page follows this order:

1. Page header: title, short live summary, primary command.
2. Toolbar: search, filters, view/sort controls, secondary commands.
3. Data surface: table, board, timeline, or form.
4. Contextual state: loading skeleton, empty action, inline error, or selection actions.

Page content uses a shared maximum width. Full-width tables may extend to the page shell but should not float inside decorative cards.

Detail pages follow the same logic: single-column documents cap at `max-w-5xl` (narrow documents at `max-w-3xl`) with `p-6`; two-column detail workspaces with an aside may extend to `max-w-7xl` with `p-4`.

## Workspace

- KPIs form one continuous metric strip, not four unrelated cards.
- Accounts Receivable Alert is the primary operational block.
- Pipeline stages keep their identity colors in small pastel chips and bars; red is reserved for payment risk.
- Secondary summaries use dividers and quiet bands instead of nested cards.
- Every metric links to the records that define it.

## Lists And Tables

- Toolbar and table read as one work surface.
- Table headers use sentence case. Avoid forced uppercase on Chinese labels.
- Sticky headers are preferred for long lists.
- Row hover must clarify clickability without moving layout.
- Selected rows use a dark edge and pale neutral fill.
- Record names use a hairline underline that darkens on hover; never a full colored underline.
- Monetary and quantity columns align right with tabular figures.
- Row commands use icon buttons with tooltips; destructive actions remain in an overflow menu.
- Compact table variant: tables embedded inside alert or summary cards may use 12px cells with tighter rows (~32px) while keeping the shared header class.
- Empty states: page- and list-level empties use the shared empty-state block; a single muted line is acceptable inside tab panels that already provide their own frame.

## Panels And Dialogs

- Right side panel: create, quick edit, and contextual detail.
- Center dialog: destructive confirmation or a short decision.
- Full page or wide panel: complex quotation, order, and inventory editing.
- All forms keep labels above controls, inline errors below controls, and stable footer actions.

## Icons

Use the existing Lucide family only. Default sizes are 16px for controls and 18px for navigation or section identity, with `strokeWidth={1.75}`. Do not use text arrows when a library icon exists. Icon-only controls require an accessible label and a visible tooltip when meaning is not universal.

## Motion And Feedback

- Hover/focus transitions: 120-180ms.
- Pressed controls: subtle 1px downward movement or 0.98 scale.
- Side panels: 180-220ms transform.
- No continuous, decorative, or scroll-driven motion.
- Focus rings must remain visible.
- Loading states should resemble final content; avoid generic centered spinners.

## Customer And Contact Surfaces

- Company classes render through the shared `ClassBadge`: A/B/C map to `badge-blue`/`badge-yellow`/`badge-gray`; an empty classification renders nothing, never a placeholder chip.
- Contact flags are chips on the identity line: primary is blue, decision maker is yellow, and both may wrap together under the name. Table, mobile card, and detail rail share one anatomy: initials avatar, name, muted role line, flag chips, then mail/phone affordances.
- Read-only entity filters (for example `?company=` on quotations and tasks) render as a brand-soft chip with the entity icon, the name, and a clear button, placed in the toolbar next to the other controls — never as a form field.
- The company detail rail closes in this order: metrics row, contacts roll-up, tasks roll-up (each with a "view all" link into the filtered list), owner line, then the profile mini card with the company's business facts.

## Review Checklist

- Is there one obvious primary action?
- Can risk, money, and next action be scanned in five seconds?
- Are repeated records rows rather than unnecessary cards?
- Are status colors semantic and restrained?
- Do Chinese and English labels fit without changing component dimensions?
- Are loading, empty, error, hover, focus, and pressed states present?
- Are icon size, stroke, and meaning consistent?
