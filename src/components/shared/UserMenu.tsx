import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import { useTheme } from '../../lib/theme';
import AboutModal from './AboutModal';

const USER = {
  firstName: 'Yaoting',
  lastName: 'Xu',
  role: 'Sales Engineer',
};

function getInitials(first: string, last: string) {
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

export default function UserMenu({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowLang(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const initials = getInitials(USER.firstName, USER.lastName);

  const currentLang = i18n.language;
  const { theme, setTheme } = useTheme();
  const [showAppearance, setShowAppearance] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const menuItem = (icon: string, label: string, onClick?: () => void, right?: React.ReactNode, danger?: boolean) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
        danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <Icon name={icon as any} size={15} className={danger ? 'text-red-400' : 'text-gray-400'} />
      <span className="flex-1 text-left">{label}</span>
      {right}
    </button>
  );

  return (
    <div className="border-t border-gray-200 relative" ref={ref}>
      {/* User button — always visible */}
      <button
        onClick={() => { setOpen(!open); setShowLang(false); setShowAppearance(false); }}
        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
      >
        <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-medium flex-shrink-0">
          {initials}
        </span>
        {!collapsed && (
          <div className="flex-1 text-left min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate leading-tight">
              {USER.firstName} {USER.lastName}
            </div>
            <div className="text-2xs text-gray-500 truncate leading-tight mt-0.5">{USER.role}</div>
          </div>
        )}
      </button>

      {/* Dropdown menu — pops up from bottom */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-visible">
          {/* User info header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium flex-shrink-0">
                {initials}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">
                  {USER.firstName} {USER.lastName}
                </div>
                <div className="text-xs text-gray-500 truncate">{USER.role}</div>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="py-1">
            {menuItem('users', t('userMenu.profile'), () => { setOpen(false); navigate('/settings/profile'); })}

            {/* Language */}
            <button
              onClick={() => setShowLang(!showLang)}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Icon name="globe" size={15} className="text-gray-400" />
              <span className="flex-1 text-left">{t('userMenu.language')}</span>
              <span className="text-xs text-gray-400 mr-1">{currentLang === 'en' ? 'EN' : '中文'}</span>
              <Icon name={showLang ? 'chevron-down' : 'chevron-right'} size={12} className="text-gray-400" />
            </button>
            {showLang && (
              <div className="bg-gray-50 mx-2 rounded-lg py-1 mb-1">
                <button onClick={() => { i18n.changeLanguage('en'); setShowLang(false); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm ${currentLang === 'en' ? 'text-blue-600 font-medium' : 'text-gray-600'} hover:bg-white rounded`}>
                  {currentLang === 'en' && <Icon name="check" size={12} className="text-blue-600 ml-1" />}
                  <span className={currentLang === 'en' ? 'ml-1' : 'ml-6'}>{t('userMenu.english')}</span>
                </button>
                <button onClick={() => { i18n.changeLanguage('zh'); setShowLang(false); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm ${currentLang === 'zh' ? 'text-blue-600 font-medium' : 'text-gray-600'} hover:bg-white rounded`}>
                  {currentLang === 'zh' && <Icon name="check" size={12} className="text-blue-600 ml-1" />}
                  <span className={currentLang === 'zh' ? 'ml-1' : 'ml-6'}>{t('userMenu.chinese')}</span>
                </button>
              </div>
            )}

            {/* Appearance */}
            <button
              onClick={() => setShowAppearance(!showAppearance)}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Icon name="settings" size={15} className="text-gray-400" />
              <span className="flex-1 text-left">{t('userMenu.appearance')}</span>
              <span className="text-xs text-gray-400 mr-1 capitalize">{theme}</span>
              <Icon name={showAppearance ? 'chevron-down' : 'chevron-right'} size={12} className="text-gray-400" />
            </button>
            {showAppearance && (
              <div className="bg-gray-50 mx-2 rounded-lg py-1 mb-1">
                {(['light', 'dark', 'system'] as const).map(mode => (
                  <button key={mode} onClick={() => { setTheme(mode); setShowAppearance(false); setOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm capitalize ${theme === mode ? 'text-blue-600 font-medium' : 'text-gray-600'} hover:bg-white rounded`}>
                    {theme === mode && <Icon name="check" size={12} className="text-blue-600 ml-1" />}
                    <span className={theme === mode ? 'ml-1' : 'ml-6'}>{mode}</span>
                  </button>
                ))}
              </div>
            )}
            {menuItem('info', t('userMenu.about'), () => { setOpen(false); setShowAbout(true); })}
          </div>

          {/* Sign Out */}
          <div className="border-t border-gray-100 py-1">
            {menuItem('close', t('userMenu.signOut'), undefined, undefined, true)}
          </div>
        </div>
      )}
      <AboutModal open={showAbout} onClose={() => setShowAbout(false)} />
    </div>
  );
}
