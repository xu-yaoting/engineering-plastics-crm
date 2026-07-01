import { useState, useEffect } from 'react';
import SidePanel from '../shared/SidePanel';
import { companies } from '../../lib/api';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

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
  });
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!company) return;
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
    });
  }, [company]);

  const save = async () => {
    if (!company?.id) return;
    setSaving(true);
    try {
      await companies.update(company.id, form);
      toast.success(t('page.companies.companyUpdated'));
      onSaved();
      onClose();
    } catch (e) {
      toast.error(t('page.companies.companySaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const set = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <SidePanel
      open={!!company}
      onClose={onClose}
      title={t('page.companyDetail.edit')}
      subtitle={company?.name}
    >
      <div className="space-y-4">
        <div>
          <label className="label">{t('page.companies.companyName')} *</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t('page.companies.type')}</label>
            <select className="input" value={form.company_type} onChange={e => set('company_type', e.target.value)}>
              <option value="end_user">{t('page.companies.endUser')}</option>
              <option value="distributor">{t('page.companies.distributor')}</option>
              <option value="oem">{t('page.companies.oem')}</option>
              <option value="trading_company">{t('page.companies.trading')}</option>
            </select>
          </div>
          <div>
            <label className="label">{t('page.companies.industry')}</label>
            <input className="input" value={form.industry} onChange={e => set('industry', e.target.value)} placeholder={t('page.companies.placeholderIndustry')} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t('page.companies.registrationNumber')}</label>
            <input className="input" value={form.registration_number} onChange={e => set('registration_number', e.target.value)} />
          </div>
          <div>
            <label className="label">{t('page.companies.customerCode')}</label>
            <input className="input font-mono uppercase" value={form.customer_code} onChange={e => set('customer_code', e.target.value.toUpperCase())} placeholder="SMP" maxLength={10} />
            <span className="text-2xs text-gray-400">{t('page.companies.usedForOrderNumbering')}: {`{PREFIX}-{CODE}-{YYMM}-{SEQ}`}</span>
          </div>
        </div>

        <div>
          <label className="label">{t('page.companies.website')}</label>
          <input className="input" value={form.website} onChange={e => set('website', e.target.value)} placeholder={t('page.companies.placeholderWebsite')} />
        </div>

        <div>
          <label className="label">{t('page.companies.phone')}</label>
          <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} />
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h4 className="text-xs font-450 text-gray-500 uppercase tracking-[0.08em] mb-3">{t('page.companies.address')}</h4>
          <div className="space-y-3">
            <input className="input" value={form.address_line_1} onChange={e => set('address_line_1', e.target.value)} placeholder={t('page.companies.placeholderAddress1')} />
            <input className="input" value={form.address_line_2} onChange={e => set('address_line_2', e.target.value)} placeholder={t('page.companies.placeholderAddress2')} />
            <div className="grid grid-cols-2 gap-3">
              <input className="input" value={form.city} onChange={e => set('city', e.target.value)} placeholder={t('page.companies.placeholderCity')} />
              <input className="input" value={form.state_province} onChange={e => set('state_province', e.target.value)} placeholder={t('page.companies.placeholderState')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input className="input" value={form.country} onChange={e => set('country', e.target.value)} placeholder={t('page.companies.placeholderCountry')} />
              <input className="input" value={form.postal_code} onChange={e => set('postal_code', e.target.value)} placeholder={t('page.companies.placeholderPostal')} />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h4 className="text-xs font-450 text-gray-500 uppercase tracking-[0.08em] mb-3">{t('page.companies.classificationCredit')}</h4>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label">{t('page.companies.status')}</label>
              <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="active">{t('status.active')}</option>
                <option value="on_hold">{t('status.onHold')}</option>
                <option value="dormant">{t('status.dormant')}</option>
                <option value="blacklisted">{t('status.blacklisted')}</option>
              </select>
            </div>
            <div>
              <label className="label">{t('page.companies.classification')}</label>
              <select className="input" value={form.classification} onChange={e => set('classification', e.target.value)}>
                <option value="A">A — {t('page.companies.strategic')}</option>
                <option value="B">B — {t('page.companies.regular')}</option>
                <option value="C">C — {t('page.companies.emerging')}</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="label">{t('page.companies.notes')}</label>
          <textarea className="input min-h-[80px] resize-y" value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>

        <div className="flex gap-2 pt-4 border-t border-gray-100">
          <button onClick={save} disabled={saving || !form.name} className="btn-primary flex-1">
            {saving ? t('page.companies.saving') : t('common.save')}
          </button>
          <button onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
        </div>
      </div>
    </SidePanel>
  );
}
