import { useEffect, useRef, useState, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreakpoint } from '../../lib/useMediaQuery';
import Icon from './Icon';

/**
 * Attio-style responsive workspace layout.
 *
 * >=1200px: 3-column (Left | Center | Right)
 * 960-1200px: 2-column (Left | Center), Right panel slides in as overlay
 * <960px: Accordion sections stacked vertically
 */
export default function ResponsiveWorkspace({
  leftPanel,
  centerPanel,
  rightPanel,
  rightPanelLabel,
}: {
  leftPanel: ReactNode;
  centerPanel: ReactNode;
  rightPanel: ReactNode;
  rightPanelLabel?: string;
}) {
  const { t } = useTranslation();
  const { isWide, isMedium, isNarrow } = useBreakpoint();
  const [rightOpen, setRightOpen] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState<string | null>('center');
  const resolvedRightPanelLabel = rightPanelLabel || t('workspace.details');
  const rightPanelRef = useRef<HTMLElement>(null);
  const rightPanelTriggerRef = useRef<HTMLButtonElement>(null);
  const rightPanelCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMedium || !rightOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    rightPanelCloseRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        setRightOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = rightPanelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
      else rightPanelTriggerRef.current?.focus();
    };
  }, [isMedium, rightOpen]);

  if (isWide) {
    // ── 3-column layout ──
    return (
      <div className="grid h-full min-h-0 grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)_minmax(16rem,19rem)]">
        <aside className="overflow-y-auto border-r border-gray-200 bg-white p-4">
          {leftPanel}
        </aside>
        <main className="min-w-0 overflow-y-auto bg-white p-4">
          {centerPanel}
        </main>
        <aside className="overflow-y-auto border-l border-gray-200 bg-white p-4">
          {rightPanel}
        </aside>
      </div>
    );
  }

  if (isMedium) {
    // ── 2-column + slide-over right panel ──
    return (
      <div className="relative grid h-full min-h-0 grid-cols-[minmax(15rem,17rem)_minmax(0,1fr)]">
        {/* Left panel */}
        <aside className="overflow-y-auto border-r border-gray-200 bg-white p-4">
          {leftPanel}
        </aside>
        {/* Center panel */}
        <main className="min-w-0 overflow-y-auto bg-white p-4">
          {centerPanel}
        </main>

        {/* Floating button to open right panel */}
        <button
          ref={rightPanelTriggerRef}
          type="button"
          onClick={() => setRightOpen(true)}
          className="fixed right-4 bottom-4 z-20 flex size-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-colors hover:bg-blue-700"
          style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          aria-label={resolvedRightPanelLabel}
          aria-expanded={rightOpen}
          aria-controls="workspace-right-panel"
          title={resolvedRightPanelLabel}
        >
          <Icon name="menu" size={18} />
        </button>

        {/* Right panel overlay */}
        {rightOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/20 z-30"
              onClick={() => setRightOpen(false)}
            />
            <aside ref={rightPanelRef} id="workspace-right-panel" role="dialog" aria-modal="true" aria-label={resolvedRightPanelLabel} className="modal-surface fixed right-0 top-0 z-40 flex h-dvh w-[min(380px,calc(100vw-1rem))] flex-col rounded-none border-y-0 border-r-0 animate-[slideIn_200ms_ease-out]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h3 className="section-label">{resolvedRightPanelLabel}</h3>
                <button
                  ref={rightPanelCloseRef}
                  type="button"
                  onClick={() => setRightOpen(false)}
                  className="icon-btn"
                  aria-label={t('common.close')}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {rightPanel}
              </div>
            </aside>
          </>
        )}
      </div>
    );
  }

  // ── Narrow: Accordion sections ──
  if (isNarrow) {
    const sections = [
      { key: 'left', label: t('workspace.customerProfile'), content: leftPanel },
      { key: 'center', label: t('workspace.opportunitiesActivity'), content: centerPanel },
      { key: 'right', label: resolvedRightPanelLabel || t('workspace.tasks'), content: rightPanel },
    ];

    return (
      <div className="overflow-y-auto h-full bg-gray-50">
        {sections.map(section => {
          const isOpen = activeAccordion === section.key;
          return (
            <div key={section.key} className="border-b border-gray-200 bg-white">
              <button
                onClick={() => setActiveAccordion(isOpen ? null : section.key)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors"
                aria-expanded={isOpen}
              >
                <span>{section.label}</span>
                <Icon name="chevron-down" size={16} className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="px-4 pb-4">
                  {section.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}
