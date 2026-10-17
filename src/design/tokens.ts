/**
 * Design Tokens — JEKIN CRM
 *
 * Single source of truth for all colors, spacing, and visual treatments.
 * No component file should reference raw Tailwind color classes. Use these
 * semantic tokens instead.
 */

export const colors = {
  // ── Entity accent colors ──
  // Used for left borders, hover accents, and card accents
  inquiry: {
    border: 'border-l-brand',
    hover: 'hover:border-brand',
    bg: 'bg-brand-soft',
    text: 'text-brand',
    pill: 'bg-brand-soft text-brand',
  },
  quotation: {
    border: 'border-l-stage-quotation',
    hover: 'hover:border-stage-quotation',
    bg: 'bg-stage-quotation-soft',
    text: 'text-stage-quotation',
    pill: 'bg-stage-quotation-soft text-stage-quotation',
  },
  order: {
    border: 'border-l-stage-order',
    hover: 'hover:border-stage-order',
    bg: 'bg-stage-order-soft',
    text: 'text-stage-order',
    pill: 'bg-stage-order-soft text-stage-order',
  },
  task: {
    border: 'border-l-warning',
    bg: 'bg-warning-soft',
    text: 'text-warning',
  },
  contact: {
    primary: {
      border: 'border-l-brand',
      bg: 'bg-brand-soft/30',
    },
    default: {
      border: 'border-l-border',
    },
  },

  // ── Semantic states ──
  success: {
    text: 'text-success',
    bg: 'bg-success-soft',
    pill: 'bg-success-soft text-success',
    border: 'border-success',
  },
  warning: {
    text: 'text-warning',
    bg: 'bg-warning-soft',
    pill: 'bg-warning-soft text-warning',
    border: 'border-warning',
    badge: {
      bg: 'bg-warning-soft',
      border: 'border-warning',
      text: 'text-warning',
      label: 'text-warning',
      labelBold: 'text-warning font-medium',
    },
  },
  danger: {
    text: 'text-danger',
    bg: 'bg-danger-soft',
    pill: 'bg-danger-soft text-danger',
    border: 'border-danger',
    badge: {
      bg: 'bg-danger-soft',
      border: 'border-danger',
      text: 'text-danger',
    },
  },
  neutral: {
    text: 'text-ink-muted',
    bg: 'bg-surface-hover',
    pill: 'bg-surface-hover text-ink-muted',
  },

  // ── Highlight surfaces (for AI / emphasis cards) ──
  gradient: {
    briefing: 'bg-brand-soft',
    assistant: 'bg-brand-soft',
  },

  // ── Chart / data viz ──
  chart: {
    primary: 'text-brand',
    secondary: 'text-stage-order',
    positive: 'text-success',
    negative: 'text-danger',
  },
} as const;

export const spacing = {
  panel: {
    left: 'w-[280px]',
    right: 'w-[300px]',
    sidePanel: 'w-[380px]',
    sidePanelWide: 'w-[560px]',
  },
  card: {
    padding: 'p-3',
    paddingLg: 'p-4',
  },
} as const;

export const typography = {
  sectionTitle: 'text-2xs font-450 text-ink-muted',
  heading: 'text-xs font-semibold text-ink',
  body: 'text-sm text-ink',
  meta: 'text-xs text-ink-muted',
  small: 'text-2xs text-ink-subtle',
  mono: 'font-mono',
  truncate: 'truncate',
  link: 'text-brand hover:underline',
} as const;

export const effects = {
  card: 'bg-surface border border-border rounded-md',
  cardHover: 'hover:border-border-strong hover:bg-surface-hover transition-colors',
  cardAccent: {
    inquiry: 'border-l-4 border-l-brand',
    quotation: 'border-l-4 border-l-stage-quotation',
    order: 'border-l-4 border-l-stage-order',
  },
  divider: 'border-t border-border',
  emptyState: 'border border-dashed border-border rounded-md',
} as const;
