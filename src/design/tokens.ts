/**
 * Design Tokens — Engineering Plastics CRM
 *
 * Single source of truth for all colors, spacing, and visual treatments.
 * No component file should reference raw Tailwind color classes like blue-600,
 * border-blue-500, or text-blue-700. Use these semantic tokens instead.
 */

export const colors = {
  // ── Entity accent colors ──
  // Used for left borders, hover accents, and card accents
  inquiry: {
    border: 'border-l-blue-600',
    hover: 'hover:border-blue-300',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    pill: 'bg-blue-50 text-blue-600',
  },
  quotation: {
    border: 'border-l-emerald-500',
    hover: 'hover:border-emerald-300',
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    pill: 'bg-emerald-50 text-emerald-600',
  },
  order: {
    border: 'border-l-amber-500',
    hover: 'hover:border-amber-300',
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    pill: 'bg-amber-50 text-amber-600',
  },
  task: {
    border: 'border-l-violet-500',
    bg: 'bg-violet-50',
    text: 'text-violet-600',
  },
  contact: {
    primary: {
      border: 'border-l-blue-600',
      bg: 'bg-blue-50/30',
    },
    default: {
      border: 'border-l-gray-200',
    },
  },

  // ── Semantic states ──
  success: {
    text: 'text-green-600',
    bg: 'bg-green-50',
    pill: 'bg-green-50 text-green-600',
    border: 'border-green-500',
  },
  warning: {
    text: 'text-yellow-600',
    bg: 'bg-yellow-50',
    pill: 'bg-yellow-50 text-yellow-600',
    border: 'border-yellow-500',
    badge: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-100',
      text: 'text-yellow-800',
      label: 'text-yellow-700',
      labelBold: 'text-yellow-800 font-medium',
    },
  },
  danger: {
    text: 'text-red-600',
    bg: 'bg-red-50',
    pill: 'bg-red-50 text-red-600',
    border: 'border-red-500',
    badge: {
      bg: 'bg-red-50',
      border: 'border-red-100',
      text: 'text-red-700',
    },
  },
  neutral: {
    text: 'text-gray-500',
    bg: 'bg-gray-100',
    pill: 'bg-gray-100 text-gray-500',
  },

  // ── Gradient backgrounds (for AI / highlight cards) ──
  gradient: {
    briefing: 'bg-gradient-to-br from-blue-50 to-white',
    assistant: 'bg-gradient-to-br from-blue-50 to-white',
  },

  // ── Chart / data viz ──
  chart: {
    primary: 'text-blue-600',
    secondary: 'text-violet-600',
    positive: 'text-green-600',
    negative: 'text-red-600',
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
  sectionTitle: 'text-2xs font-semibold text-gray-500 uppercase tracking-wider',
  heading: 'text-xs font-semibold text-gray-700',
  body: 'text-sm text-gray-700',
  meta: 'text-xs text-gray-500',
  small: 'text-2xs text-gray-400',
  mono: 'font-mono',
  truncate: 'truncate',
  link: 'text-blue-600 hover:underline',
} as const;

export const effects = {
  card: 'bg-white border border-gray-200 rounded-lg',
  cardHover: 'hover:border-gray-300 hover:shadow-sm transition-shadow',
  cardAccent: {
    inquiry: 'border-l-4 border-l-blue-600',
    quotation: 'border-l-4 border-l-emerald-500',
    order: 'border-l-4 border-l-amber-500',
  },
  divider: 'border-t border-gray-200',
  emptyState: 'border border-dashed border-gray-200 rounded-lg',
} as const;
