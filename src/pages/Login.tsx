import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { t } = useTranslation();
  const { requiresSetup, setup, login } = useAuth();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    if (pin.length !== 6) {
      setError(t('login.pinInvalid'));
      return;
    }
    if (requiresSetup && confirmPin !== pin) {
      setError(t('login.pinMismatch'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await (requiresSetup ? setup(clean, pin) : login(clean, pin));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('login.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const updateDigits = (value: string, setter: (digits: string) => void) => {
    setter(value.replace(/\D/g, '').slice(0, 6));
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm mx-auto p-8">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <img src="/basepoint-logo.svg" alt="" className="w-14 h-14 rounded-full mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-gray-900">Basepoint</h1>
          <p className="text-sm text-gray-500 mt-1">{t('login.subtitle')}</p>
        </div>

        <h2 className="text-base font-medium text-gray-900 text-center mb-5">
          {t(requiresSetup ? 'login.setupTitle' : 'login.loginTitle')}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="login-name">{t('login.yourName')}</label>
            <input
              id="login-name"
              name="username"
              className="input text-base"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('login.placeholderName')}
              autoComplete="username"
              maxLength={50}
              required
              autoFocus
              disabled={submitting}
            />
          </div>

          <div>
            <label className="label" htmlFor="login-pin">{t('login.pin')}</label>
            <input
              id="login-pin"
              name="pin"
              className="input text-base tabular-nums"
              type="password"
              inputMode="numeric"
              autoComplete={requiresSetup ? 'new-password' : 'current-password'}
              value={pin}
              onChange={e => updateDigits(e.target.value, setPin)}
              placeholder={t('login.placeholderPin')}
              maxLength={6}
              required
              disabled={submitting}
            />
          </div>

          {requiresSetup && (
            <div>
              <label className="label" htmlFor="login-confirm-pin">{t('login.confirmPin')}</label>
              <input
                id="login-confirm-pin"
                name="confirm-pin"
                className="input text-base tabular-nums"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                value={confirmPin}
                onChange={e => updateDigits(e.target.value, setConfirmPin)}
                placeholder={t('login.placeholderPin')}
                maxLength={6}
                required
                disabled={submitting}
              />
            </div>
          )}

          {error && (
            <div
              id="login-error"
              role="alert"
              className="text-xs text-red-600 text-center bg-red-50 rounded-lg py-2"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!name.trim() || pin.length !== 6 || submitting}
            className="btn-primary w-full py-2.5"
          >
            {submitting ? t('login.submitting') : t(requiresSetup ? 'login.setupAction' : 'login.loginAction')}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-8 leading-relaxed">
          {t(requiresSetup ? 'login.setupHint' : 'login.loginHint')}
        </p>
      </div>
    </div>
  );
}
