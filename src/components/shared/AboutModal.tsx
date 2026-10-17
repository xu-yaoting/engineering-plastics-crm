import { useEffect, useId, useRef, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';

const ABOUT = {
  version: 'Pilot 0.9',
  build: '2026.06.12',
  database: 'SQLite',
  ui: 'Attio Inspired',
};

export default function AboutModal({
  open,
  onClose,
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
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
      if (previouslyFocused?.isConnected && previouslyFocused !== document.body) previouslyFocused.focus();
      else returnFocusRef?.current?.focus();
    };
  }, [open, returnFocusRef]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="modal-surface w-[320px] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-brand px-5 py-6 text-center">
          <img src="/jekin-logo-white.svg" alt="" className="w-10 h-10 mx-auto mb-2" />
          <h2 id={titleId} className="text-lg font-semibold text-white">JEKIN CRM</h2>
          <p className="text-xs text-brand-100 mt-0.5">{t('about.subtitle')}</p>
        </div>

        {/* Details */}
        <div className="px-5 py-4 space-y-3">
          {[
            { label: t('about.version'), value: ABOUT.version },
            { label: t('about.build'), value: ABOUT.build },
            { label: t('about.database'), value: ABOUT.database },
            { label: t('about.ui'), value: ABOUT.ui },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-xs text-ink-muted">{item.label}</span>
              <span className="text-sm font-medium text-ink">{item.value}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="btn-secondary w-full"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
