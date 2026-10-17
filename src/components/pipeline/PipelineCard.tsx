import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../shared/StatusBadge';
import type { CardData } from '../../types/pipeline';

export default function PipelineCard({
  card,
  onDragStart,
}: {
  card: CardData;
  onDragStart: (e: React.DragEvent, card: CardData) => void;
}) {
  const navigate = useNavigate();
  const [isDragOver, setIsDragOver] = useState(false);

  const handleClick = () => {
    if (card.entityType === 'quotation') navigate(`/quotations/${card.entityId}`);
    else if (card.entityType === 'order') navigate(`/orders/${card.entityId}`);
    else if (card.entityType === 'sample') navigate(`/companies/${card.companyId}`);
    else navigate(`/companies/${card.companyId}`);
  };

  const urgencyColor = (u?: string) => {
    if (u === 'immediate') return 'bg-danger';
    if (u === 'within_2_weeks') return 'bg-warning';
    return 'bg-border-strong';
  };

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, card)}
      className={`group cursor-grab rounded border border-border bg-surface p-3 transition-colors hover:border-border-strong hover:bg-surface-hover active:cursor-grabbing ${
        isDragOver ? 'opacity-50' : ''
      }`}
      onClick={handleClick}
    >
      {/* Material + Days */}
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="max-w-[65%] truncate text-2xs font-450 text-ink-muted">
          {card.material}
        </span>
        <span className="flex-shrink-0 rounded bg-surface-hover px-1.5 py-0.5 text-2xs text-ink-subtle">
          {card.daysInStage}d
        </span>
      </div>

      {/* Company Name */}
      <div className="mb-1 truncate text-sm font-semibold text-ink">
        {card.companyName}
      </div>

      {/* Value + Urgency */}
      <div className="mb-2 flex items-center justify-between gap-2">
        {card.value > 0 ? (
          <span className="text-xs tabular-nums font-medium text-ink">
            {card.currency === 'CNY' ? '¥' : '$'}{card.value.toLocaleString()}
          </span>
        ) : (
          <span className="text-xs text-ink-subtle">—</span>
        )}
        {card.urgency && (
          <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${urgencyColor(card.urgency)}`} />
        )}
      </div>

      {/* Status + Owner */}
      <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
        <StatusBadge status={card.status} />
        <span className="ml-1 max-w-[50%] truncate text-2xs text-ink-subtle">
          {card.owner}
        </span>
      </div>

      {/* Next Action — shown on hover */}
      <div className="mt-1.5 truncate text-2xs text-ink-subtle opacity-0 transition-all group-hover:text-ink-muted group-hover:opacity-100">
        {card.nextAction}
      </div>
    </div>
  );
}
