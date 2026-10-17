import { useState, useEffect } from 'react';
import SidePanel from '../shared/SidePanel';
import { companies, team, type TeamMember } from '../../lib/api';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth';

export default function CompanyEditPanel({
  company,
  onClose,
  onSaved,
}: {
  company: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: '', company_type: 'end_user', industry: '', registration_number: '',
    website: '', phone: '', email: '', address_line_1: '', address_line_2: '',
    city: '', state_province: '', country: 'US', postal_code: '',
    status: 'active', classification: 'C', notes: '', customer_code: '',
    owner_user_id: '',
  });
  const { t } = useTranslation();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [showFullAddress, setShowFullAddress] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersLoadError, setMembersLoadError] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

  const loadMembers = () => {
    setMembersLoadError(false);
    team.list()
      .then(setMembers)
      .catch(() => {
        setMembers([]);
        setMembersLoadError(true);
      });
  };

  useEffect(() => {
    if (user?.role !== 'admin') {
      setMembers([]);
      setMembersLoadError(false);
      return;
    }
    loadMembers();
  }, [user?.role]);

  useEffect(() => {
    if (!company) return;
    setErrors({});
    setShowFullAddress(!!(company.address_line_1 || company.address_line_2));
    setForm({
      name: company.name || '',
      company_type: company.company_type || 'end_user',
      industry: company.industry || '',
      registration_number: company.registration_number || '',
      website: company.website || '',
      phone: company.phone || '',
      email: company.email || '',
      address_line_1: company.address_line_1 || '',
      address_line_2: company.address_line_2 || '',
      city: company.city || '',
      state_province: company.state_province || '',
      country: company.country || 'US',
      postal_code: company.postal_code || '',
      status: company.status || 'active',
      classification: company.classification || 'C',
      notes: company.notes || '',
      customer_code: company.customer_code || '',
      owner_user_id: company.owner_user_id || '',
    });
  }, [company]);

  const save = async () => {
    if (!company?.id) return;
    if (!form.name.trim()) {
      setErrors({ name: `${t('page.companies.companyName')} *` });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (user?.role === 'admin') {
        payload.owner_user_id = form.owner_user_id || null;
      } else {
        delete payload.owner_user_id;
      }
      await companies.update(company.id, payload);
      toast.success(t('page.companies.companyUpdated'));
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('page.companies.companySaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const set = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'name' && String(value).trim()) {
      setErrors(current => ({ ...current, name: undefined }));
    }
  };

  return (
    <SidePanel
      open={!!company}
      onClose={onClose}
      title={t('page.companyDetail.edit')}
      subtitle={company?.name}
    >
      <div className="space-y-5">
        {/* ── Basic Info ── */}
        <fieldset>
          <legend className="section-label mb-3">{t('page.companies.companyName')}</legend>
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="company-name">{t('page.companies.companyName')} *</label>
              <input
                id="company-name"
                className={errors.name ? 'input-error' : 'input'}
                value={form.name}
                required
                autoComplete="organization"
                onChange={e => set('name', e.target.value)}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'company-name-error' : undefined}
              />
              {errors.name && <p id="company-name-error" className="field-error" role="alert">{errors.name}</p>}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="company-type">{t('page.companies.type')}</label>
                <select id="company-type" className="input" value={form.company_type} onChange={e => set('company_type', e.target.value)}>
                  <option value="end_user">{t('page.companies.endUser')}</option>
                  <option value="distributor">{t('page.companies.distributor')}</option>
                  <option value="oem">{t('page.companies.oem')}</option>
                  <option value="trading_company">{t('page.companies.trading')}</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="company-industry">{t('page.companies.industry')}</label>
                <input id="company-industry" className="input" value={form.industry} onChange={e => set('industry', e.target.value)} placeholder={t('page.companies.placeholderIndustry')} />
              </div>
            </div>
            {user?.role === 'admin' && (
              <div>
                <label className="label" htmlFor="company-owner">{t('accountability.owner', { defaultValue: 'Owner' })}</label>
                <select id="company-owner" className="input" value={form.owner_user_id} onChange={e => set('owner_user_id', e.target.value)}>
                  <option value="">{t('accountability.unassigned', { defaultValue: 'Unassigned' })}</option>
                  {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
                {membersLoadError && (
                  <div className="mt-1 flex items-center justify-between gap-2" role="alert">
                    <span className="text-2xs text-danger">{t('page.error.loadFailed')}</span>
                    <button type="button" onClick={loadMembers} className="text-2xs text-brand hover:underline">
                      {t('common.refresh')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </fieldset>

        {/* ── Code & Contact ── */}
        <fieldset className="border-t border-border pt-4">
          <legend className="section-label mb-3">{t('page.companies.code')}</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="company-customer-code">{t('page.companies.customerCode')}</label>
              <input id="company-customer-code" className="input tabular-nums uppercase" value={form.customer_code} onChange={e => set('customer_code', e.target.value.toUpperCase())} placeholder="SMP" maxLength={10} aria-describedby="company-customer-code-help" />
              <span id="company-customer-code-help" className="text-2xs text-ink-subtle">{t('page.companies.usedForOrderNumbering')}: {`{PREFIX}-{CODE}-{YYMM}-{SEQ}`}</span>
            </div>
            <div>
              <label className="label" htmlFor="company-registration-number">{t('page.companies.registrationNumber')}</label>
              <input id="company-registration-number" className="input" value={form.registration_number} onChange={e => set('registration_number', e.target.value)} />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="company-website">{t('page.companies.website')}</label>
              <input id="company-website" className="input" value={form.website} autoComplete="url" onChange={e => set('website', e.target.value)} placeholder={t('page.companies.placeholderWebsite')} />
            </div>
            <div>
              <label className="label" htmlFor="company-phone">{t('page.companies.phone')}</label>
              <input id="company-phone" className="input" value={form.phone} autoComplete="tel" onChange={e => set('phone', e.target.value)} />
            </div>
          </div>
        </fieldset>

        {/* ── Address (collapsible) ── */}
        <fieldset className="border-t border-border pt-4">
          <legend className="flex w-full items-center justify-between">
            <span className="section-label">{t('page.companies.address')}</span>
            <button
              type="button"
              onClick={() => setShowFullAddress(v => !v)}
              className="text-xs text-brand hover:underline"
            >
              {showFullAddress ? t('common.collapse') : t('common.expand')}
            </button>
          </legend>
          {!showFullAddress ? (
            <p className="mt-2 text-sm text-ink-muted">
              {[form.city, form.state_province, form.country].filter(Boolean).join(', ') || '—'}
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              <div>
                <label className="label" htmlFor="company-address-line-1">{t('page.companies.placeholderAddress1')}</label>
                <input id="company-address-line-1" className="input" value={form.address_line_1} autoComplete="address-line1" onChange={e => set('address_line_1', e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="company-address-line-2">{t('page.companies.placeholderAddress2')}</label>
                <input id="company-address-line-2" className="input" value={form.address_line_2} autoComplete="address-line2" onChange={e => set('address_line_2', e.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="company-city">{t('page.companies.city')}</label>
                  <input id="company-city" className="input" value={form.city} autoComplete="address-level2" onChange={e => set('city', e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="company-state">{t('page.companies.placeholderState')}</label>
                  <input id="company-state" className="input" value={form.state_province} autoComplete="address-level1" onChange={e => set('state_province', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="company-country">{t('page.companies.country')}</label>
                  <input id="company-country" className="input" value={form.country} autoComplete="country-name" onChange={e => set('country', e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="company-postal-code">{t('page.companies.placeholderPostal')}</label>
                  <input id="company-postal-code" className="input" value={form.postal_code} autoComplete="postal-code" onChange={e => set('postal_code', e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </fieldset>

        {/* ── Classification ── */}
        <fieldset className="border-t border-border pt-4">
          <legend className="section-label mb-3">{t('page.companies.classificationCredit')}</legend>
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="company-status">{t('page.companies.status')}</label>
              <select id="company-status" className="input" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="active">{t('status.active')}</option>
                <option value="on_hold">{t('status.onHold')}</option>
                <option value="dormant">{t('status.dormant')}</option>
                <option value="blacklisted">{t('status.blacklisted')}</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="company-classification">{t('page.companies.classification')}</label>
              <select id="company-classification" className="input" value={form.classification} onChange={e => set('classification', e.target.value)}>
                <option value="A">A — {t('page.companies.strategic')}</option>
                <option value="B">B — {t('page.companies.regular')}</option>
                <option value="C">C — {t('page.companies.emerging')}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="company-notes">{t('page.companies.notes')}</label>
            <textarea id="company-notes" className="input min-h-[60px] resize-y" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </fieldset>

        {/* ── Sticky footer ── */}
        <div className="sticky bottom-0 z-10 -mx-5 flex gap-2 border-t border-border bg-surface px-5 py-4">
          <button onClick={save} disabled={saving} className="btn-primary flex-1">
            {saving ? t('page.companies.saving') : t('common.save')}
          </button>
          <button onClick={onClose} disabled={saving} className="btn-secondary">{t('common.cancel')}</button>
        </div>
      </div>
    </SidePanel>
  );
}
