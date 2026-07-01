import { useState, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreakpoint } from '../../lib/useMediaQuery';

/**
 * Attio-style responsive workspace layout.
 *
 * >1200px: 3-column (Left | Center | Right)
 * 768-1200px: 2-column (Left | Center), Right panel slides in as overlay
 * <768px: Accordion sections stacked vertically
 */
export default function ResponsiveWorkspace({
  leftPanel,
  centerPanel,
  rightPanel,
  rightPanelLabel,
  rightPanelIcon = '',
}: {
  leftPanel: ReactNode;
  centerPanel: ReactNode;
  rightPanel: ReactNode;
  rightPanelLabel?: string;
  rightPanelIcon?: string;
}) {
  const { t } = useTranslation();
  const { isWide, isMedium, isNarrow } = useBreakpoint();
  const [rightOpen, setRightOpen] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState<string | null>('center');
  const resolvedRightPanelLabel = rightPanelLabel || t('workspace.details');

  if (isWide) {
    // ── 3-column layout ──
    return (
      <div className="flex h-full">
        <div className="w-[280px] flex-shrink-0 border-r border-gray-200 overflow-y-auto bg-white">
          {leftPanel}
        </div>
        <div className="flex-1 overflow-y-auto bg-white min-w-0">
          {centerPanel}
        </div>
        <div className="w-[300px] flex-shrink-0 border-l border-gray-200 overflow-y-auto bg-white">
          {rightPanel}
        </div>
      </div>
    );
  }

  if (isMedium) {
    // ── 2-column + slide-over right panel ──
    return (
      <div className="flex h-full relative">
        {/* Left panel */}
        <div className="w-[280px] flex-shrink-0 border-r border-gray-200 overflow-y-auto bg-white">
          {leftPanel}
        </div>
        {/* Center panel */}
        <div className="flex-1 overflow-y-auto bg-white min-w-0">
          {centerPanel}
        </div>

        {/* Floating button to open right panel */}
        <button
          onClick={() => setRightOpen(true)}
          className="fixed right-4 bottom-4 z-20 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors"
          title={resolvedRightPanelLabel}
        >
          {rightPanelIcon}
        </button>

        {/* Right panel overlay */}
        {rightOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/20 z-30"
              onClick={() => setRightOpen(false)}
            />
            <aside className="fixed right-0 top-0 h-full w-[380px] bg-white shadow-[-4px_0_12px_rgba(0,0,0,0.1)] z-40 flex flex-col animate-[slideIn_200ms_ease-out]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h3 className="text-xs font-450 text-gray-500 uppercase tracking-[0.08em]">{resolvedRightPanelLabel}</h3>
                <button
                  onClick={() => setRightOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400"
                >
                  ✕
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
              >
                <span>{section.label}</span>
                <span className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                  ▼
                </span>
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
