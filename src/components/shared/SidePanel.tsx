import { useEffect } from 'react';
import Icon from './Icon';

export default function SidePanel({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 'w-[380px]',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-30" onClick={onClose} />
      <aside
        className={`fixed right-0 top-0 h-full ${width} bg-white shadow-[_-4px_0_12px_rgba(0,0,0,0.1)] z-40 flex flex-col animate-[slideIn_200ms_ease-out]`}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200">
          <div className="min-w-0 flex-1 mr-4">
            {title && <h2 className="text-sm font-semibold text-gray-900 truncate">{title}</h2>}
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </aside>
    </>
  );
}
