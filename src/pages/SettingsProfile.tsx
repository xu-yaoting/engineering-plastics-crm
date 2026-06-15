import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

const STORAGE_KEY = 'crm-profile';

interface Profile {
  fullName: string;
  jobTitle: string;
  company: string;
  email: string;
}

const defaultProfile: Profile = {
  fullName: 'Yaoting Xu',
  jobTitle: 'Sales Engineer',
  company: 'JEKIN Polymer',
  email: 'nathan@jekinpolymer.com',
};

export default function SettingsProfile() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState<Profile>(defaultProfile);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setForm(JSON.parse(stored));
      } catch {}
    }
  }, []);

  const set = (field: keyof Profile, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    setSaved(true);
    toast.success(t('profile.saved'));
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <button onClick={() => navigate(-1)} className="text-xs text-gray-400 hover:text-gray-600 mb-3 flex items-center gap-1">
          ← Back
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">{t('profile.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('profile.subtitle')}</p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4 mb-8">
        <span className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-semibold">
          {form.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
        </span>
        <div>
          <div className="text-sm font-medium text-gray-900">{form.fullName || 'Your Name'}</div>
          <div className="text-xs text-gray-500">{form.jobTitle || 'Your Role'}</div>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-5">
        <div>
          <label className="label">{t('profile.fullName')}</label>
          <input className="input" value={form.fullName} onChange={e => set('fullName', e.target.value)} placeholder="Your full name" />
        </div>
        <div>
          <label className="label">{t('profile.jobTitle')}</label>
          <input className="input" value={form.jobTitle} onChange={e => set('jobTitle', e.target.value)} placeholder="e.g. Sales Engineer" />
        </div>
        <div>
          <label className="label">{t('profile.company')}</label>
          <input className="input" value={form.company} onChange={e => set('company', e.target.value)} placeholder="Company name" />
        </div>
        <div>
          <label className="label">{t('profile.email')}</label>
          <input className="input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@company.com" />
        </div>
      </div>

      <div className="flex gap-2 mt-8">
        <button onClick={save} disabled={saved} className="btn-primary">
          {saved ? t('profile.saved_btn') : t('profile.saveChanges')}
        </button>
        {!saved && (
          <button onClick={() => { setForm(defaultProfile); setSaved(false); }} className="btn-secondary">
            {t('profile.reset')}
          </button>
        )}
      </div>
    </div>
  );
}
