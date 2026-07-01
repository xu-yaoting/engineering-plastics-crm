import { useTranslation } from 'react-i18next';
import Icon from './Icon';

const ABOUT = {
  version: 'Pilot 0.9',
  build: '2026.06.12',
  database: 'SQLite',
  ui: 'Attio Inspired',
};

export default function AboutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-[320px] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-5 py-6 text-center">
          <Icon name="target" size={28} className="text-white/90 inline-block mb-2" />
          <h2 className="text-lg font-semibold text-white">Basepoint</h2>
          <p className="text-xs text-blue-200 mt-0.5">{t('about.subtitle')}</p>
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
              <span className="text-xs text-gray-500">{item.label}</span>
              <span className="text-sm font-medium text-gray-900">{item.value}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-3">
          <button
            onClick={onClose}
            className="w-full py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
