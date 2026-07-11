import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import PipelineCard from './PipelineCard';
import { formatCurrency } from '../../lib/currency';
import type { CardData } from '../../types/pipeline';

export default function PipelineColumn({
  title,
  stage,
  cards,
  usdTotal = 0,
  cnyTotal = 0,
  onDrop,
  onDragStart,
}: {
  title: string;
  stage: string;
  cards: CardData[];
  usdTotal?: number;
  cnyTotal?: number;
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
      className={`flex min-w-[232px] flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-colors ${
        isOver ? 'border-blue-300 bg-blue-50/40 ring-2 ring-blue-100 ring-inset' : ''
      }`}
    >
      {/* Column Header */}
      <div className="border-b border-gray-100 bg-gray-50/70 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-xs font-semibold text-gray-700">{title}</h3>
          <span className="rounded bg-white px-1.5 py-0.5 text-2xs font-450 text-gray-500 ring-1 ring-gray-200">
            {cards.length}
          </span>
        </div>
        {(usdTotal > 0 || cnyTotal > 0) && (
          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-2xs font-mono text-gray-400">
            {usdTotal > 0 && <span>{formatCurrency(usdTotal, 'USD')}</span>}
            {cnyTotal > 0 && <span>{formatCurrency(cnyTotal, 'CNY')}</span>}
          </div>
        )}
      </div>

      {/* Cards area — whole area accepts drops */}
      <div className={`flex-1 overflow-y-auto p-2.5 space-y-2 min-h-[120px] transition-colors ${
        isOver ? 'bg-blue-50/40' : 'bg-gray-50/50'
      }`}>
        {cards.length === 0 ? (
          <div className={`rounded-lg border border-dashed px-3 py-8 text-center text-2xs transition-colors ${
            isOver ? 'border-blue-300 bg-blue-50 text-blue-500' : 'border-gray-200 bg-white/70 text-gray-300'
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
