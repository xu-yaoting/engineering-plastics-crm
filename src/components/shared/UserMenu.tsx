import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import AboutModal from './AboutModal';

const defaultProfile = {
  fullName: '',
  jobTitle: '',
};

type ManagedUser = {
  id: string;
  name: string;
  role: string;
  is_active: number;
  last_seen_at: string | null;
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function profileStorageKey(userId?: string) {
  return userId ? `crm-profile:${userId}` : null;
}

function loadProfile(userId?: string) {
  const storageKey = profileStorageKey(userId);
  if (!storageKey) return defaultProfile;
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) return { ...defaultProfile, ...JSON.parse(stored) };
  } catch {}
  return defaultProfile;
}

export default function UserMenu({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [profile, setProfile] = useState(() => loadProfile(user?.id));
  const ref = useRef<HTMLDivElement>(null);
  const userMenuTriggerRef = useRef<HTMLButtonElement>(null);

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

  // Re-read profile from localStorage when the menu opens
  useEffect(() => {
    if (open) setProfile(loadProfile(user?.id));
  }, [open, user?.id]);

  useEffect(() => {
    setProfile(loadProfile(user?.id));
  }, [user?.id]);

  useEffect(() => {
    const refreshProfile = (event: Event) => {
      const profileEvent = event as CustomEvent<{ userId?: string }>;
      if (profileEvent.detail?.userId !== user?.id) return;
      setProfile(loadProfile(user?.id));
    };
    const refreshProfileFromStorage = (event: StorageEvent) => {
      if (event.key !== profileStorageKey(user?.id)) return;
      setProfile(loadProfile(user?.id));
    };
    window.addEventListener('crm-profile-updated', refreshProfile);
    window.addEventListener('storage', refreshProfileFromStorage);
    return () => {
      window.removeEventListener('crm-profile-updated', refreshProfile);
      window.removeEventListener('storage', refreshProfileFromStorage);
    };
  }, [user?.id]);

  const displayName = profile.fullName || user?.name || 'User';
  const initials = getInitials(displayName);

  const currentLang = i18n.language;
  const { theme, setTheme } = useTheme();
  const [showAppearance, setShowAppearance] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [accountName, setAccountName] = useState('');
  const [accountPin, setAccountPin] = useState('');
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const manageUsersTriggerRef = useRef<HTMLButtonElement>(null);
  const userManagementDialogRef = useRef<HTMLDivElement>(null);
  const userManagementCloseRef = useRef<HTMLButtonElement>(null);

  const closeUserManagement = () => {
    setShowUserManagement(false);
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    setUserError('');
    try {
      const res = await fetch('/api/auth/users');
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || t('userMenu.loadUsersFailed'));
      setManagedUsers(data);
    } catch (error: unknown) {
      setUserError(error instanceof Error ? error.message : t('userMenu.loadUsersFailed'));
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (showUserManagement) void loadUsers();
  }, [showUserManagement]);

  useEffect(() => {
    if (!showUserManagement) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = requestAnimationFrame(() => userManagementCloseRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeUserManagement();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = userManagementDialogRef.current?.querySelectorAll<HTMLElement>(
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
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
      else manageUsersTriggerRef.current?.focus();
    };
  }, [showUserManagement]);

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (accountPin.length !== 6) {
      setUserError(t('userMenu.pinRequired'));
      return;
    }
    setCreatingUser(true);
    setUserError('');
    setUserSuccess('');
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: accountName.trim(), pin: accountPin }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || t('userMenu.createUserFailed'));
      setAccountName('');
      setAccountPin('');
      setUserSuccess(t('userMenu.accountCreated'));
      await loadUsers();
    } catch (error: unknown) {
      setUserError(error instanceof Error ? error.message : t('userMenu.createUserFailed'));
    } finally {
      setCreatingUser(false);
    }
  };

  const menuItem = (icon: string, label: string, onClick?: () => void, right?: React.ReactNode, danger?: boolean, buttonRef?: React.Ref<HTMLButtonElement>) => (
    <button
      ref={buttonRef}
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
        ref={userMenuTriggerRef}
        onClick={() => { setOpen(!open); setShowLang(false); setShowAppearance(false); }}
        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
      >
        <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-medium flex-shrink-0">
          {initials}
        </span>
        {!collapsed && (
          <div className="flex-1 text-left min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate leading-tight">
              {displayName}
            </div>
            <div className="text-2xs text-gray-500 truncate leading-tight mt-0.5">{profile.jobTitle || (user ? t('userMenu.teamMember') : '')}</div>
          </div>
        )}
      </button>

      {/* Dropdown menu — pops up from bottom */}
      {open && (
        <div className="menu-surface absolute bottom-full left-0 right-0 mb-2 z-50 overflow-visible">
          {/* User info header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium flex-shrink-0">
                {initials}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">
                  {displayName}
                </div>
                <div className="text-xs text-gray-500 truncate">{profile.jobTitle || ''}</div>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="py-1">
            {menuItem('users', t('userMenu.profile'), () => { setOpen(false); navigate('/settings/profile'); })}
            {user?.role === 'admin' && menuItem('users', t('userMenu.manageUsers'), () => {
              setShowUserManagement(true);
            }, undefined, false, manageUsersTriggerRef)}

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
            {menuItem('close', t('userMenu.signOut'), () => { setOpen(false); logout(); }, undefined, true)}
          </div>
        </div>
      )}
      <AboutModal open={showAbout} onClose={() => setShowAbout(false)} returnFocusRef={userMenuTriggerRef} />
      {showUserManagement && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4" onMouseDown={event => { event.stopPropagation(); closeUserManagement(); }}>
          <div ref={userManagementDialogRef} className="modal-surface w-full max-w-lg" role="dialog" aria-modal="true" aria-labelledby="user-management-title" onMouseDown={event => event.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 id="user-management-title" className="text-base font-semibold text-gray-900">{t('userMenu.manageUsers')}</h2>
              <button ref={userManagementCloseRef} type="button" className="icon-btn" onClick={closeUserManagement} aria-label={t('common.close')}>
                <Icon name="close" size={16} />
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto divide-y divide-gray-100">
              {loadingUsers && <div className="px-5 py-5 text-sm text-gray-500">{t('common.loading')}</div>}
              {!loadingUsers && managedUsers.length === 0 && <div className="px-5 py-5 text-sm text-gray-500">{t('userMenu.noUsers')}</div>}
              {!loadingUsers && managedUsers.map(account => (
                <div key={account.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-medium">
                    {getInitials(account.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">{account.name}</div>
                    <div className="text-xs text-gray-500">
                      {t(`userMenu.${account.role === 'admin' ? 'administrator' : 'member'}`)} · {t('userMenu.lastSeen')}: {account.last_seen_at ? new Date(account.last_seen_at).toLocaleString() : t('userMenu.never')}
                    </div>
                  </div>
                  <span className="badge badge-green">{t('userMenu.active')}</span>
                </div>
              ))}
            </div>

            <form onSubmit={createUser} className="px-5 py-4 border-t border-gray-200 space-y-3">
              <h3 className="text-sm font-medium text-gray-900">{t('userMenu.addColleague')}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="managed-user-name">{t('userMenu.accountName')}</label>
                  <input id="managed-user-name" className="input" value={accountName} onChange={event => setAccountName(event.target.value)} maxLength={50} disabled={creatingUser} />
                </div>
                <div>
                  <label className="label" htmlFor="managed-user-pin">{t('userMenu.initialPin')}</label>
                  <input id="managed-user-pin" className="input tabular-nums" type="password" inputMode="numeric" value={accountPin}
                    onChange={event => setAccountPin(event.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} disabled={creatingUser} />
                </div>
              </div>
              {userError && <div className="text-xs text-red-600" role="alert">{userError}</div>}
              {userSuccess && <div className="text-xs text-green-600" role="status">{userSuccess}</div>}
              <div className="flex justify-end">
                <button className="btn-primary" type="submit" disabled={!accountName.trim() || accountPin.length !== 6 || creatingUser}>
                  {creatingUser ? t('userMenu.creatingAccount') : t('userMenu.createAccount')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
