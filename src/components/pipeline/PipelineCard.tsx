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
    const path = card.entityType === 'inquiry' ? '/inquiries' :
                 card.entityType === 'quotation' ? '/quotations' :
                 card.entityType === 'sample' ? '/samples' :
                 card.entityType === 'order' ? '/orders' : '/companies';
    navigate(`${path}/${card.entityId}`);
  };

  const urgencyColor = (u?: string) => {
    if (u === 'immediate') return 'bg-red-500';
    if (u === 'within_2_weeks') return 'bg-yellow-500';
    return 'bg-gray-300';
  };

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, card)}
      className={`group cursor-grab rounded border border-gray-200 bg-white p-3 transition-colors hover:border-gray-300 hover:bg-gray-50 active:cursor-grabbing ${
        isDragOver ? 'opacity-50' : ''
      }`}
      onClick={handleClick}
    >
      {/* Material + Days */}
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="max-w-[65%] truncate text-2xs font-450 text-gray-500">
          {card.material}
        </span>
        <span className="flex-shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-2xs text-gray-400">
          {card.daysInStage}d
        </span>
      </div>

      {/* Company Name */}
      <div className="mb-1 truncate text-sm font-semibold text-gray-900">
        {card.companyName}
      </div>

      {/* Value + Urgency */}
      <div className="mb-2 flex items-center justify-between gap-2">
        {card.value > 0 ? (
          <span className="text-xs tabular-nums font-medium text-gray-700">
            {card.currency === 'CNY' ? '¥' : '$'}{card.value.toLocaleString()}
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
        {card.urgency && (
          <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${urgencyColor(card.urgency)}`} />
        )}
      </div>

      {/* Status + Owner */}
      <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-2">
        <StatusBadge status={card.status} />
        <span className="ml-1 max-w-[50%] truncate text-2xs text-gray-400">
          {card.owner}
        </span>
      </div>

      {/* Next Action — shown on hover */}
      <div className="mt-1.5 truncate text-2xs text-gray-400 opacity-0 transition-all group-hover:text-gray-600 group-hover:opacity-100">
        {card.nextAction}
      </div>
    </div>
  );
}
