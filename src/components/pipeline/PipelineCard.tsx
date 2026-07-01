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
    if (u === 'immediate') return 'text-red-500';
    if (u === 'within_2_weeks') return 'text-yellow-600';
    return 'text-gray-400';
  };

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, card)}
      className={`kanban-card group ${isDragOver ? 'opacity-50' : ''}`}
      onClick={handleClick}
    >
      {/* Material + Days */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-2xs font-450 text-blue-600 truncate max-w-[60%]">
          {card.material}
        </span>
        <span className="text-2xs text-gray-400 flex-shrink-0">
          {card.daysInStage}d
        </span>
      </div>

      {/* Company Name */}
      <div className="text-sm font-semibold text-gray-900 truncate mb-1">
        {card.companyName}
      </div>

      {/* Value + Urgency */}
      <div className="flex items-center justify-between mb-2">
        {card.value > 0 ? (
          <span className="text-xs font-mono font-medium text-gray-700">
            {card.currency === 'CNY' ? '¥' : '$'}{card.value.toLocaleString()}
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
        {card.urgency && (
          <span className={`text-2xs ${urgencyColor(card.urgency)}`}>
            {card.urgency === 'immediate' ? '' : card.urgency === 'within_2_weeks' ? '🟡' : ''}
          </span>
        )}
      </div>

      {/* Status + Owner */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <StatusBadge status={card.status} />
        <span className="text-2xs text-gray-400 truncate ml-1 max-w-[50%]">
          {card.owner}
        </span>
      </div>

      {/* Next Action — shown on hover */}
      <div className="mt-1.5 text-2xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity truncate">
        {card.nextAction}
      </div>
    </div>
  );
}
