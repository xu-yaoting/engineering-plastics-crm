import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Icon from '../components/shared/Icon';
import { useAuth } from '../lib/auth';

interface Profile {
  fullName: string;
  jobTitle: string;
  company: string;
  email: string;
}

function profileStorageKey(userId: string) {
  return `crm-profile:${userId}`;
}

function defaultProfile(fullName = ''): Profile {
  return { fullName, jobTitle: '', company: '', email: '' };
}

export default function SettingsProfile() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [form, setForm] = useState<Profile>(() => defaultProfile(user?.name));
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    if (!user) {
      setForm(defaultProfile());
      setSaved(true);
      return;
    }

    const fallback = defaultProfile(user.name);
    const stored = localStorage.getItem(profileStorageKey(user.id));
    if (stored) {
      try {
        setForm({ ...fallback, ...JSON.parse(stored) });
      } catch {
        setForm(fallback);
      }
    } else {
      setForm(fallback);
    }
    setSaved(true);
  }, [user?.id, user?.name]);

  const set = (field: keyof Profile, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const save = () => {
    if (!user) return;
    localStorage.setItem(profileStorageKey(user.id), JSON.stringify(form));
    window.dispatchEvent(new CustomEvent('crm-profile-updated', { detail: { userId: user.id, profile: form } }));
    setSaved(true);
    toast.success(t('profile.saved'));
  };

  return (
    <div className="page-shell max-w-2xl">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-start gap-3">
          <button onClick={() => navigate(-1)} className="icon-btn" aria-label={t('common.back')} title={t('common.back')}><Icon name="back" size={16} /></button>
          <div>
            <h1 className="page-heading">{t('profile.title')}</h1>
            <p className="page-summary">{t('profile.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="data-surface p-5">
      {/* Avatar */}
      <div className="flex items-center gap-4 mb-6 border-b border-gray-100 pb-5">
        <span className="size-14 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-semibold">
          {form.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
        </span>
        <div>
          <div className="text-sm font-medium text-gray-900">{form.fullName || t('profile.yourName')}</div>
          <div className="text-xs text-gray-500">{form.jobTitle || t('profile.yourRole')}</div>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-5">
        <div>
          <label className="label" htmlFor="profile-full-name">{t('profile.fullName')}</label>
          <input id="profile-full-name" className="input" value={form.fullName} autoComplete="name" onChange={e => set('fullName', e.target.value)} placeholder={t('profile.placeholderFullName')} />
        </div>
        <div>
          <label className="label" htmlFor="profile-job-title">{t('profile.jobTitle')}</label>
          <input id="profile-job-title" className="input" value={form.jobTitle} autoComplete="organization-title" onChange={e => set('jobTitle', e.target.value)} placeholder={t('profile.placeholderJobTitle')} />
        </div>
        <div>
          <label className="label" htmlFor="profile-company">{t('profile.company')}</label>
          <input id="profile-company" className="input" value={form.company} autoComplete="organization" onChange={e => set('company', e.target.value)} placeholder={t('profile.placeholderCompany')} />
        </div>
        <div>
          <label className="label" htmlFor="profile-email">{t('profile.email')}</label>
          <input id="profile-email" className="input" type="email" value={form.email} autoComplete="email" onChange={e => set('email', e.target.value)} placeholder="email@company.com" />
        </div>
      </div>

      <div className="flex gap-2 mt-8">
        <button onClick={save} disabled={saved} className="btn-primary">
          {saved ? t('profile.saved_btn') : t('profile.saveChanges')}
        </button>
        {!saved && (
          <button onClick={() => { setForm(defaultProfile(user?.name)); setSaved(false); }} className="btn-secondary">
            {t('profile.reset')}
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
