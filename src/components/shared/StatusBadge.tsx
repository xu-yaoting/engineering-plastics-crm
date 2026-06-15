const statusStyles: Record<string, string> = {
  // Company statuses
  active: 'bg-green-50 text-green-600',
  on_hold: 'bg-yellow-50 text-yellow-600',
  dormant: 'bg-gray-100 text-gray-500',
  blacklisted: 'bg-red-50 text-red-600',
  // Inquiry statuses
  open: 'bg-blue-50 text-blue-600',
  under_review: 'bg-yellow-50 text-yellow-600',
  quoted: 'bg-green-50 text-green-600',
  closed_won: 'bg-green-50 text-green-600',
  closed_lost: 'bg-red-50 text-red-600',
  // Quotation statuses
  draft: 'bg-gray-100 text-gray-500',
  pending_approval: 'bg-yellow-50 text-yellow-600',
  approved: 'bg-blue-50 text-blue-600',
  sent: 'bg-blue-50 text-blue-600',
  negotiating: 'bg-yellow-50 text-yellow-600',
  accepted: 'bg-green-50 text-green-600',
  rejected: 'bg-red-50 text-red-600',
  expired: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-gray-100 text-gray-500',
  // Order statuses
  confirmed: 'bg-blue-50 text-blue-600',
  in_production: 'bg-blue-50 text-blue-600',
  quality_check: 'bg-yellow-50 text-yellow-600',
  ready_to_ship: 'bg-green-50 text-green-600',
  partially_shipped: 'bg-blue-50 text-blue-600',
  shipped: 'bg-green-50 text-green-600',
  delivered: 'bg-green-50 text-green-600',
  // Payment statuses
  unpaid: 'bg-gray-100 text-gray-500',
  partial: 'bg-yellow-50 text-yellow-600',
  paid: 'bg-green-50 text-green-600',
  overdue: 'bg-red-50 text-red-600',
  // Task priorities
  urgent: 'bg-red-50 text-red-600',
  high: 'bg-yellow-50 text-yellow-600',
  medium: 'bg-gray-100 text-gray-500',
  low: 'bg-gray-100 text-gray-400',
  // Generic
  completed: 'bg-green-50 text-green-600',
  pending: 'bg-gray-100 text-gray-500',
  in_progress: 'bg-blue-50 text-blue-600',
};

export default function StatusBadge({
  status,
  className = '',
}: {
  status: string;
  className?: string;
}) {
  const style = statusStyles[status] || 'bg-gray-100 text-gray-500';
  const label = status.replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-medium ${style} ${className}`}>
      {label}
    </span>
  );
}
