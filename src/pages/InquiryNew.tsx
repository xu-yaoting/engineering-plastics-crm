import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { companies, contacts, inquiries } from '../lib/api';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

export default function InquiryNew() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetCompanyId = searchParams.get('company');

  const [companyList, setCompanyList] = useState<any[]>([]);
  const [contactList, setContactList] = useState<any[]>([]);
  const [form, setForm] = useState({
    company_id: presetCompanyId || '',
    contact_id: '',
    source: 'email',
    application_description: '',
    target_material_requested: '', quantity_estimate: '',
    urgency: 'within_1_month',
    currency: 'USD',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { companies.list().then(setCompanyList); }, []);
  useEffect(() => {
    if (form.company_id) contacts.list(form.company_id).then(setContactList);
  }, [form.company_id]);

  const set = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const create = async () => {
    if (!form.company_id || !form.application_description) return;
    setSaving(true);
    try {
      const inq = await inquiries.create({
        ...form,
      });
      toast.success('Inquiry created');
      navigate(`/inquiries/${inq.id}`);
    } catch (e) {
      toast.error('Failed to create inquiry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <button onClick={() => navigate(-1)} className="text-xs text-gray-400 hover:text-gray-600 mb-2">{t('common.back')}</button>
        <h1 className="text-2xl font-semibold text-gray-900">{t('page.title.newInquiry')}</h1>
        <p className="text-sm text-gray-500">{t('page.inquiryNew.subtitle')}</p>
      </div>

      <div className="card p-5 space-y-5">
        {/* Customer */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('page.inquiryNew.customer')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('page.inquiryNew.company')} *</label>
              <select className="input" value={form.company_id} onChange={e => { set('company_id', e.target.value); set('contact_id', ''); }}>
                <option value="">{t('page.inquiryNew.selectCompany')}</option>
                {companyList.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t('page.inquiryNew.contact')}</label>
              <select className="input" value={form.contact_id} onChange={e => set('contact_id', e.target.value)}>
                <option value="">{t('page.inquiryNew.selectContact')}</option>
                {contactList.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Source & Urgency */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t('page.inquiryNew.source')}</label>
            <select className="input" value={form.source} onChange={e => set('source', e.target.value)}>
              <option value="email">{t('page.inquiryNew.email')}</option>
              <option value="phone_wechat">{t('page.inquiryNew.phoneWechat')}</option>
              <option value="website">{t('page.inquiryNew.website')}</option>
              <option value="social_media">{t('page.inquiryNew.socialMedia')}</option>
              <option value="alibaba_platform">{t('page.inquiryNew.alibabaPlatform')}</option>
              <option value="trade_show">{t('page.inquiryNew.tradeShow')}</option>
              <option value="referral">{t('page.inquiryNew.referral')}</option>
            </select>
          </div>
          <div>
            <label className="label">{t('page.inquiryNew.urgency')}</label>
            <select className="input" value={form.urgency} onChange={e => set('urgency', e.target.value)}>
              <option value="immediate">🔴 {t('page.inquiryNew.immediate')}</option>
              <option value="within_2_weeks">🟡 {t('page.inquiryNew.within2Weeks')}</option>
              <option value="within_1_month">⚪ {t('page.inquiryNew.within1Month')}</option>
              <option value="no_rush">⚪ {t('page.inquiryNew.noRush')}</option>
            </select>
          </div>
        </div>

        {/* Application */}
        <div>
          <label className="label">{t('page.inquiryNew.applicationDescription')} *</label>
          <textarea
            className="input min-h-[100px] resize-y"
            value={form.application_description}
            onChange={e => set('application_description', e.target.value)}
            placeholder={t('page.inquiryNew.placeholderDescription')}
          />
        </div>

        {/* Material & Quantity */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t('page.inquiryNew.targetMaterial')}</label>
            <input className="input" value={form.target_material_requested} onChange={e => set('target_material_requested', e.target.value)} placeholder={t('page.inquiryNew.placeholderMaterial')} />
          </div>
          <div>
            <label className="label">Quantity</label>
            <input className="input" value={form.quantity_estimate} onChange={e => set('quantity_estimate', e.target.value)} placeholder="e.g. 500 kg/year" />
          </div>
        </div>



        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t border-gray-100">
          <button
            onClick={create}
            disabled={saving || !form.company_id || !form.application_description}
            className="btn-primary"
          >
            {saving ? t('page.inquiryNew.creating') : t('page.inquiryNew.createInquiry')}
          </button>
          <button onClick={() => navigate(-1)} className="btn-secondary">{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
}
