import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import PipelineCard from './PipelineCard';
import type { CardData } from '../../types/pipeline';

export default function PipelineColumn({
  title,
  stage,
  cards,
  onDrop,
  onDragStart,
}: {
  title: string;
  stage: string;
  cards: CardData[];
  onDrop: (e: React.DragEvent, stage: string) => void;
  onDragStart: (e: React.DragEvent, card: CardData) => void;
}) {
  const { t } = useTranslation();
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = () => setIsOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    onDrop(e, stage);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`kanban-column flex flex-col min-w-[200px] flex-1 ${
        isOver ? 'bg-blue-50 ring-2 ring-blue-200 ring-inset' : ''
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200">
        <h3 className="text-xs font-semibold text-gray-700">{title}</h3>
        <span className="text-2xs font-450 text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">
          {cards.length}
        </span>
      </div>

      {/* Cards area — whole area accepts drops */}
      <div className={`flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px] transition-colors ${
        isOver ? 'bg-blue-50' : ''
      }`}>
        {cards.length === 0 ? (
          <div className={`text-center py-6 text-2xs border-2 border-dashed rounded-lg transition-colors ${
            isOver ? 'border-blue-400 text-blue-500 bg-blue-50' : 'border-gray-200 text-gray-300'
          }`}>
            {isOver ? t('page.pipeline.releaseToDrop') : t('page.pipeline.dropItemsHere')}
          </div>
        ) : (
          cards.map(card => (
            <PipelineCard
              key={card.id}
              card={card}
              onDragStart={onDragStart}
            />
          ))
        )}
      </div>
    </div>
  );
}
