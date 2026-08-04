import { useState, useEffect, useRef } from 'react';
import { Filter, RefreshCw } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import PipelineColumn from '../components/pipeline/PipelineColumn';
import PipelineCard from '../components/pipeline/PipelineCard';
import { formatCurrency } from '../lib/currency';
import { useTranslation } from 'react-i18next';
import type { CardData } from '../types/pipeline';

function PipelineSkeleton() {
  return (
    <div aria-hidden="true" className="grid h-full min-w-[1040px] grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, columnIndex) => (
        <div key={columnIndex} className="rounded-md border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="h-3 w-24 rounded bg-gray-200" />
            <div className="h-5 w-8 rounded bg-gray-100" />
          </div>
          <div className="mt-3 space-y-3">
            {Array.from({ length: 3 }).map((_, cardIndex) => (
              <div key={cardIndex} className="rounded-md border border-gray-100 p-3">
                <div className="h-3 w-3/4 rounded bg-gray-200" />
                <div className="mt-3 h-3 w-1/2 rounded bg-gray-100" />
                <div className="mt-5 flex justify-between">
                  <div className="h-3 w-16 rounded bg-gray-100" />
                  <div className="h-3 w-12 rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PipelineMobileSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-3">
      {Array.from({ length: 4 }).map((_, columnIndex) => (
        <div key={columnIndex} className="rounded-md border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="h-3 w-24 rounded bg-gray-200" />
            <div className="h-5 w-8 rounded bg-gray-100" />
          </div>
          <div className="mt-3 h-16 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

export default function Pipeline() {
  const { t } = useTranslation();
  const location = useLocation();
  const [cards, setCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOwner, setFilterOwner] = useState('all');
  const dragCard = useRef<CardData | null>(null);

  const COLUMNS = [
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

  const grouped = COLUMNS.map(col => {
    const columnCards = filteredCards.filter(c => c.stage === col.key);
    return {
      ...col,
      cards: columnCards,
      usdTotal: columnCards.filter(c => c.currency !== 'CNY').reduce((sum, card) => sum + card.value, 0),
      cnyTotal: columnCards.filter(c => c.currency === 'CNY').reduce((sum, card) => sum + card.value, 0),
    };
  });

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

  const usdTotal = filteredCards.filter(c => c.currency !== 'CNY').reduce((s, c) => s + c.value, 0);
  const cnyTotal = filteredCards.filter(c => c.currency === 'CNY').reduce((s, c) => s + c.value, 0);

  const renderMobileColumn = (col: (typeof grouped)[number]) => (
    <section key={col.key} className="overflow-hidden rounded-md border border-gray-200 bg-white">
      <div className="border-b border-gray-100 bg-gray-50/70 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-xs font-semibold text-gray-700">{col.title}</h2>
          <span className="rounded bg-white px-1.5 py-0.5 text-2xs font-450 text-gray-500 ring-1 ring-gray-200">{col.cards.length}</span>
        </div>
        {(col.usdTotal > 0 || col.cnyTotal > 0) && (
          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-2xs tabular-nums text-gray-400">
            {col.usdTotal > 0 && <span>{formatCurrency(col.usdTotal, 'USD')}</span>}
            {col.cnyTotal > 0 && <span>{formatCurrency(col.cnyTotal, 'CNY')}</span>}
          </div>
        )}
      </div>
      {col.cards.length === 0 ? (
        <div className="m-2 rounded border border-dashed border-gray-200 px-3 py-6 text-center text-2xs text-gray-300">
          {t('page.pipeline.dropItemsHere')}
        </div>
      ) : (
        <div className="space-y-2 bg-gray-50/50 p-2">
          {col.cards.map(card => <PipelineCard key={card.id} card={card} onDragStart={handleDragStart} />)}
        </div>
      )}
    </section>
  );

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white px-3 py-3 md:px-6 md:py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">{t('page.title.pipeline')}</h1>
            {loading ? (
              <div aria-hidden="true" className="mt-2 h-3 w-40 animate-pulse rounded bg-gray-200 motion-reduce:animate-none" />
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                {filteredCards.length} {t('page.pipeline.deals')}{usdTotal > 0 ? ` · ${formatCurrency(usdTotal, 'USD')}` : ''}{cnyTotal > 0 ? ` · ${formatCurrency(cnyTotal, 'CNY')}` : ''}
              </p>
            )}
            <nav className="mt-3 flex flex-wrap items-center gap-1" aria-label={t('page.pipeline.relatedViews')}>
              <Link to="/quotations" className="rounded px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700">
                {t('nav.quotations')}
              </Link>
              <Link to="/orders" className="rounded px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700">
                {t('nav.orders')}
              </Link>
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2 py-1">
              <Filter size={14} strokeWidth={1.75} className="text-gray-400" />
              <label className="sr-only" htmlFor="pipeline-owner-filter">{t('page.pipeline.allOwners')}</label>
              <select
                id="pipeline-owner-filter"
                value={filterOwner}
                onChange={e => setFilterOwner(e.target.value)}
                disabled={loading}
                    className="h-7 border-0 bg-transparent px-1 text-xs font-450 text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <option value="all">{t('page.pipeline.allOwners')}</option>
                {owners.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <button onClick={load} disabled={loading} className="btn-ghost btn-sm text-xs">
              <RefreshCw size={14} strokeWidth={1.75} className={loading ? 'animate-spin motion-reduce:animate-none' : ''} />
              {t('page.pipeline.refresh')}
            </button>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-y-auto p-3 md:overflow-x-auto md:overflow-y-hidden md:p-4">
        {loading ? (
          <div
            role="status"
            aria-label={t('page.pipeline.loading')}
            className="h-full animate-pulse motion-reduce:animate-none"
          >
            <div className="md:hidden">
              <PipelineMobileSkeleton />
            </div>
            <div className="hidden md:block h-full">
              <PipelineSkeleton />
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {grouped.map(renderMobileColumn)}
            </div>
            <div className="hidden md:block h-full">
              <div className="grid h-full min-w-[1040px] grid-cols-4 gap-4">
                {grouped.map(col => (
                  <PipelineColumn
                    key={col.key}
                    title={col.title}
                    stage={col.key}
                    cards={col.cards}
                    usdTotal={col.usdTotal}
                    cnyTotal={col.cnyTotal}
                    onDrop={handleDrop}
                    onDragStart={handleDragStart}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
