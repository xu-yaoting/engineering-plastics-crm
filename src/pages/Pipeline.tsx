import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import PipelineColumn from '../components/pipeline/PipelineColumn';
import { formatCurrency } from '../lib/currency';
import { useTranslation } from 'react-i18next';
import type { CardData } from '../types/pipeline';

export default function Pipeline() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [cards, setCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOwner, setFilterOwner] = useState('all');
  const dragCard = useRef<CardData | null>(null);

  const COLUMNS = [
    { key: 'inquiry', title: t('nav.inquiries') },
    { key: 'quotation', title: t('nav.quotations') },
    { key: 'sample', title: t('page.pipeline.sample') },
    { key: 'testing', title: t('page.pipeline.testing') },
    { key: 'order', title: t('page.pipeline.order') },
  ];

  const load = () => {
    setLoading(true);
    fetch('/api/pipeline')
      .then(r => r.json())
      .then(setCards)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Filter cards
  const filteredCards = filterOwner === 'all'
    ? cards
    : cards.filter(c => c.owner === filterOwner);

  const grouped = COLUMNS.map(col => ({
    ...col,
    cards: filteredCards.filter(c => c.stage === col.key),
  }));

  // Unique owners for filter
  const owners = [...new Set(cards.map(c => c.owner).filter(Boolean))];

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, card: CardData) => {
    dragCard.current = card;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.id);
    e.dataTransfer.setData('application/json', JSON.stringify(card));
  };

  const handleDrop = async (e: React.DragEvent, toStage: string) => {
    e.preventDefault();

    // Try reading card from dataTransfer first, fall back to ref
    let card = dragCard.current;
    if (!card) {
      try {
        const raw = e.dataTransfer.getData('application/json');
        if (raw) card = JSON.parse(raw);
      } catch { /* ignore */ }
    }
    if (!card || card.stage === toStage) return;

    const fromStage = card.stage;
    dragCard.current = null;

    // Optimistic update
    setCards(prev =>
      prev.map(c => c.id === card!.id ? { ...c, stage: toStage } : c)
    );

    try {
      const res = await fetch('/api/pipeline/move', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: card.entityType,
          entityId: card.entityId,
          fromStage,
          toStage,
        }),
      });

      if (!res.ok) {
        // Rollback on failure
        setCards(prev =>
          prev.map(c => c.id === card!.id ? { ...c, stage: fromStage } : c)
        );
      }
    } catch {
      // Rollback on error
      setCards(prev =>
        prev.map(c => c.id === card!.id ? { ...c, stage: fromStage } : c)
      );
    }
  };

  const usdTotal = cards.filter(c => c.currency !== 'CNY').reduce((s, c) => s + c.value, 0);
  const cnyTotal = cards.filter(c => c.currency === 'CNY').reduce((s, c) => s + c.value, 0);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{t('page.title.pipeline')}</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {cards.length} {t('page.pipeline.deals')}{usdTotal > 0 ? ` · ${formatCurrency(usdTotal, 'USD')}` : ''}{cnyTotal > 0 ? ` · ${formatCurrency(cnyTotal, 'CNY')}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={filterOwner}
              onChange={e => setFilterOwner(e.target.value)}
              className="input max-w-[160px] text-xs"
            >
              <option value="all">{t('page.pipeline.allOwners')}</option>
              {owners.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <button onClick={load} className="btn-ghost btn-sm text-xs">↻ {t('page.pipeline.refresh')}</button>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">{t('page.pipeline.loading')}</div>
        ) : (
          <div className="flex gap-3 h-full min-w-[1200px]">
            {grouped.map(col => (
              <PipelineColumn
                key={col.key}
                title={col.title}
                stage={col.key}
                cards={col.cards}
                onDrop={handleDrop}
                onDragStart={handleDragStart}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
