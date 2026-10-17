import { useTranslation } from 'react-i18next';

const SUCCESS_STATUSES = new Set([
  'active', 'approved', 'accepted', 'closed_won', 'ready_to_ship',
  'shipped', 'delivered', 'paid', 'completed',
]);
const WAITING_STATUSES = new Set([
  'on_hold', 'under_review', 'pending_approval', 'negotiating',
  'quality_check', 'partial', 'pending', 'high',
]);
const RISK_STATUSES = new Set([
  'blacklisted', 'closed_lost', 'rejected', 'expired', 'cancelled',
  'overdue', 'urgent',
]);
const ACTIVE_STATUSES = new Set([
  'open', 'quoted', 'sent', 'confirmed', 'in_production',
  'partially_shipped', 'in_progress',
]);

const statusStyles = {
  success: 'bg-success-soft text-success',
  waiting: 'bg-warning-soft text-warning',
  risk: 'bg-danger-soft text-danger',
  active: 'bg-brand-soft text-brand',
  neutral: 'bg-surface-hover text-ink-muted',
};

function getStatusStyle(status: string): string {
  if (SUCCESS_STATUSES.has(status)) return statusStyles.success;
  if (WAITING_STATUSES.has(status)) return statusStyles.waiting;
  if (RISK_STATUSES.has(status)) return statusStyles.risk;
  if (ACTIVE_STATUSES.has(status)) return statusStyles.active;
  return statusStyles.neutral;
}

const statusTranslationKeys: Record<string, string> = {
  active: 'active',
  on_hold: 'onHold',
  dormant: 'dormant',
  blacklisted: 'blacklisted',
  open: 'open',
  under_review: 'underReview',
  quoted: 'quoted',
  closed_won: 'won',
  closed_lost: 'lost',
  draft: 'draft',
  pending_approval: 'pendingApproval',
  approved: 'approved',
  sent: 'sent',
  negotiating: 'negotiating',
  accepted: 'accepted',
  rejected: 'rejected',
  expired: 'expired',
  cancelled: 'cancelled',
  confirmed: 'confirmed',
  in_production: 'inProduction',
  quality_check: 'qualityCheck',
  ready_to_ship: 'readyToShip',
  partially_shipped: 'partiallyShipped',
  shipped: 'shipped',
  delivered: 'delivered',
  unpaid: 'unpaid',
  partial: 'partial',
  paid: 'paid',
  overdue: 'overdue',
  urgent: 'urgent',
  high: 'high',
  medium: 'medium',
  low: 'low',
  completed: 'completed',
  pending: 'pending',
  in_progress: 'inProgress',
};

const formatFallbackStatus = (status: string) => status.split('_').join(' ');

export default function StatusBadge({
  status,
  className = '',
}: {
  status: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const style = getStatusStyle(status);
  const labelKey = statusTranslationKeys[status];
  const label = labelKey
    ? t(`status.${labelKey}`, { defaultValue: formatFallbackStatus(status) })
    : formatFallbackStatus(status);
  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-2xs font-450 ${style} ${className}`}>
      {label}
    </span>
  );
}
