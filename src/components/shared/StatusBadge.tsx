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
  success: 'bg-green-50 text-green-700',
  waiting: 'bg-yellow-50 text-yellow-700',
  risk: 'bg-red-50 text-red-700',
  active: 'bg-blue-50 text-blue-700',
  neutral: 'bg-gray-100 text-gray-500',
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
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-450 ${style} ${className}`}>
      {label}
    </span>
  );
}
