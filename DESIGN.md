# Basepoint CRM Design Language

## Design Read

Basepoint is a compact B2B operations product for a small engineering-plastics trading team. It should feel precise, calm, dependable, and fast to scan. The visual reference is Attio's information discipline, adapted to industrial sales rather than copied as a skin.

Design dials:

- Visual variance: 4/10
- Motion intensity: 3/10
- Information density: 7/10

## Foundations

### Color

- Brand accent: one active blue, used for navigation, links, focus, and primary commands.
- Neutrals: cool gray only. Do not mix warm cream or slate-blue page backgrounds.
- Red: overdue, destructive, or failed states only.
- Green: completed, paid, delivered, or healthy states only.
- Amber: waiting, partial, or approaching-risk states only.
- Purple and material colors may identify product grades, but must not become page accents.
- Do not use decorative gradients, glowing backgrounds, or colored blobs.

Semantic tokens:

| Role | Value | Use |
| --- | --- | --- |
| Brand | `#2563EB` | Primary command, active navigation, selected state |
| Text | `#172033` | Headings, key values, primary content |
| Muted text | `#667085` | Supporting labels and descriptions |
| Subtle text | `#98A2B3` | Metadata, placeholders, disabled context |
| Canvas | `#F7F8FA` | Application background |
| Subtle surface | `#FAFBFC` | Quiet grouped content |
| Hover surface | `#F2F5F9` | Hover and selected row support |
| Border | `#E4E7EC` | Default dividers and surface edges |
| Success | `#168A5B` | Completed, paid, delivered, healthy |
| Warning | `#B7791F` | Waiting, partial, approaching risk |
| Danger | `#D64545` | Overdue, failed, insufficient, destructive |

Brand blue is not a generic emphasis color. Normal totals and identifiers use primary text; links use blue only when they are actionable.

### Surfaces

1. App canvas: cool off-white background.
2. Primary work surface: white, usually unframed or separated by a single border.
3. Repeated record: row with dividers, not a floating card.
4. Elevated surface: menus, dialogs, and side panels only.
5. Risk surface: pale status tint plus a narrow status edge; never a large saturated block.

### Shape

- Inputs and buttons: 6px radius.
- Data surfaces and compact panels: 6px radius.
- Menus and dialogs: 8px radius.
- Pills are reserved for statuses, filters, and binary choices.
- Circular shapes are reserved for avatars, logo marks, and icon-only circular controls.

### Typography

Keep the existing Inter/PingFang SC stack and compact scale. Do not enlarge dashboard or list headings. Use 400 for content, 450/500 for labels and controls, and 600 for page titles and critical values. Use tabular figures for money, quantities, dates, IDs, SKU, and percentages.

## Page Architecture

Every operational page follows this order:

1. Page header: title, short live summary, primary command.
2. Toolbar: search, filters, view/sort controls, secondary commands.
3. Data surface: table, board, timeline, or form.
4. Contextual state: loading skeleton, empty action, inline error, or selection actions.

Page content uses a shared maximum width. Full-width tables may extend to the page shell but should not float inside decorative cards.

## Workspace

- KPIs form one continuous metric strip, not four unrelated cards.
- Accounts Receivable Alert is the primary operational block.
- Pipeline uses blue intensity for normal stages; red is reserved for payment risk.
- Secondary summaries use dividers and quiet bands instead of nested cards.
- Every metric links to the records that define it.

## Lists And Tables

- Toolbar and table read as one work surface.
- Table headers use sentence case. Avoid forced uppercase on Chinese labels.
- Sticky headers are preferred for long lists.
- Row hover must clarify clickability without moving layout.
- Selected rows use a blue edge and pale fill.
- Monetary and quantity columns align right with tabular figures.
- Row commands use icon buttons with tooltips; destructive actions remain in an overflow menu.

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

## Review Checklist

- Is there one obvious primary action?
- Can risk, money, and next action be scanned in five seconds?
- Are repeated records rows rather than unnecessary cards?
- Are status colors semantic and restrained?
- Do Chinese and English labels fit without changing component dimensions?
- Are loading, empty, error, hover, focus, and pressed states present?
- Are icon size, stroke, and meaning consistent?
