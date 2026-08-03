import { useState, useEffect, useRef } from 'react';
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
  const [errors, setErrors] = useState<{ company_id?: string; application_description?: string }>({});
  const companyInputRef = useRef<HTMLSelectElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { companies.list().then(setCompanyList); }, []);
  useEffect(() => {
    if (form.company_id) contacts.list(form.company_id).then(setContactList);
  }, [form.company_id]);

  const set = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const create = async () => {
    const nextErrors: { company_id?: string; application_description?: string } = {};
    if (!form.company_id) nextErrors.company_id = t('page.inquiryNew.companyRequired');
    if (!form.application_description.trim()) {
      nextErrors.application_description = t('page.inquiryNew.descriptionRequired');
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      if (nextErrors.company_id) companyInputRef.current?.focus();
      else descriptionInputRef.current?.focus();
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const inq = await inquiries.create({
        ...form,
      });
      toast.success(t('page.inquiries.inquiryCreated'));
      navigate(`/inquiries/${inq.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('page.inquiries.inquiryCreateFailed'));
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
          <h3 className="section-label mb-3">{t('page.inquiryNew.customer')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="inquiry-company">{t('page.inquiryNew.company')} *</label>
              <select
                ref={companyInputRef}
                id="inquiry-company"
                className={errors.company_id ? 'input-error' : 'input'}
                value={form.company_id}
                required
                aria-invalid={!!errors.company_id}
                aria-describedby={errors.company_id ? 'inquiry-company-error' : undefined}
                onChange={e => {
                  set('company_id', e.target.value);
                  set('contact_id', '');
                  if (e.target.value) setErrors(current => ({ ...current, company_id: undefined }));
                }}
              >
                <option value="">{t('page.inquiryNew.selectCompany')}</option>
                {companyList.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.company_id && <p id="inquiry-company-error" role="alert" className="field-error">{errors.company_id}</p>}
            </div>
            <div>
              <label className="label" htmlFor="inquiry-contact">{t('page.inquiryNew.contact')}</label>
              <select id="inquiry-contact" className="input" value={form.contact_id} onChange={e => set('contact_id', e.target.value)}>
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
            <label className="label" htmlFor="inquiry-source">{t('page.inquiryNew.source')}</label>
            <select id="inquiry-source" className="input" value={form.source} onChange={e => set('source', e.target.value)}>
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
            <label className="label" htmlFor="inquiry-urgency">{t('page.inquiryNew.urgency')}</label>
            <select id="inquiry-urgency" className="input" value={form.urgency} onChange={e => set('urgency', e.target.value)}>
              <option value="immediate">🔴 {t('page.inquiryNew.immediate')}</option>
              <option value="within_2_weeks">🟡 {t('page.inquiryNew.within2Weeks')}</option>
              <option value="within_1_month">⚪ {t('page.inquiryNew.within1Month')}</option>
              <option value="no_rush">⚪ {t('page.inquiryNew.noRush')}</option>
            </select>
          </div>
        </div>

        {/* Application */}
        <div>
          <label className="label" htmlFor="inquiry-description">{t('page.inquiryNew.applicationDescription')} *</label>
          <textarea
            ref={descriptionInputRef}
            id="inquiry-description"
            className={`${errors.application_description ? 'input-error' : 'input'} min-h-[100px] resize-y`}
            value={form.application_description}
            required
            aria-invalid={!!errors.application_description}
            aria-describedby={errors.application_description ? 'inquiry-description-error' : undefined}
            onChange={e => {
              set('application_description', e.target.value);
              if (e.target.value.trim()) setErrors(current => ({ ...current, application_description: undefined }));
            }}
            placeholder={t('page.inquiryNew.placeholderDescription')}
          />
          {errors.application_description && <p id="inquiry-description-error" role="alert" className="field-error">{errors.application_description}</p>}
        </div>

        {/* Material & Quantity */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="inquiry-material">{t('page.inquiryNew.targetMaterial')}</label>
            <input id="inquiry-material" className="input" value={form.target_material_requested} onChange={e => set('target_material_requested', e.target.value)} placeholder={t('page.inquiryNew.placeholderMaterial')} />
          </div>
          <div>
            <label className="label" htmlFor="inquiry-quantity">{t('page.inquiryDetail.quantity')}</label>
            <input id="inquiry-quantity" className="input" value={form.quantity_estimate} onChange={e => set('quantity_estimate', e.target.value)} placeholder={t('page.inquiryNew.placeholderQuantityKg')} />
          </div>
        </div>



        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t border-gray-100">
          <button
            onClick={create}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? t('page.inquiryNew.creating') : t('page.inquiryNew.createInquiry')}
          </button>
          <button onClick={() => navigate(-1)} disabled={saving} className="btn-secondary">{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
}
