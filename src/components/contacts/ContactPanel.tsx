import { useState } from 'react';
import ConfirmDialog from '../shared/ConfirmDialog';
import SidePanel from '../shared/SidePanel';
import { contacts } from '../../lib/api';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

type ContactForm = {
  first_name: string;
  last_name: string;
  job_title: string;
  department: string;
  role_in_process: string;
  email: string;
  phone_direct: string;
  phone_mobile: string;
  wechat_id: string;
  is_primary_contact: boolean;
  is_decision_maker: boolean;
  notes: string;
};

type ContactErrors = Partial<Record<'company_id' | 'first_name' | 'last_name', string>>;

const emptyForm: ContactForm = {
  first_name: '', last_name: '', job_title: '', department: '',
  role_in_process: 'procurement', email: '', phone_direct: '', phone_mobile: '', wechat_id: '',
  is_primary_contact: false, is_decision_maker: false, notes: '',
};

export default function ContactPanel({
  companyId,
  contact,
  allCompanies,
  onClose,
  onSaved,
}: {
  companyId: string;
  contact?: any;
  allCompanies?: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!contact;
  const [form, setForm] = useState<ContactForm>(contact ? {
    first_name: contact.first_name || '',
    last_name: contact.last_name || '',
    job_title: contact.job_title || '',
    department: contact.department || '',
    role_in_process: contact.role_in_process || 'procurement',
    email: contact.email || '',
    phone_direct: contact.phone_direct || '',
    phone_mobile: contact.phone_mobile || '',
    wechat_id: contact.wechat_id || '',
    is_primary_contact: !!contact.is_primary_contact,
    is_decision_maker: !!contact.is_decision_maker,
    notes: contact.notes || '',
  } : emptyForm);
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [localCompanyId, setLocalCompanyId] = useState(companyId);
  const [errors, setErrors] = useState<ContactErrors>({});

  const set = (field: keyof ContactForm, value: ContactForm[keyof ContactForm]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(current => {
      const next = { ...current };
      if (field === 'first_name' || field === 'last_name') delete next[field];
      return next;
    });
  };
  const activeCompanyId = isEdit ? companyId : localCompanyId;

  const save = async () => {
    const nextErrors: ContactErrors = {};
    if (!activeCompanyId) nextErrors.company_id = t('page.contacts.companyRequired');
    if (!form.first_name.trim()) nextErrors.first_name = t('page.contacts.nameRequired');
    if (!form.last_name.trim()) nextErrors.last_name = t('page.contacts.nameRequired');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSaving(true);
    try {
      if (isEdit && contact?.id) {
        await contacts.update(contact.id, { ...form, company_id: activeCompanyId });
      } else {
        await contacts.create({ ...form, company_id: activeCompanyId });
      }
      toast.success(isEdit ? t('page.contacts.contactUpdated') : t('page.contacts.contactCreated'));
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('page.contacts.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!contact?.id) return;
    setDeleting(true);
    try {
      await contacts.delete(contact.id);
      toast.success(t('page.contacts.contactDeleted'));
      setConfirmDelete(false);
      onSaved();
      onClose();
    } catch {
      toast.error(t('page.contacts.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <SidePanel
        open={true}
        onClose={onClose}
        title={isEdit ? t('page.contacts.editContact') : t('page.contacts.newContact')}
        subtitle={isEdit ? `${contact.first_name} ${contact.last_name}` : undefined}
      >
        <div className="space-y-5">
        <fieldset className="space-y-4">
          <legend className="section-label mb-3">{isEdit ? t('page.contacts.editContact') : t('page.contacts.newContact')}</legend>
        {!isEdit && allCompanies && allCompanies.length > 0 && (
          <div>
            <label className="label" htmlFor="contact-company">{t('page.companies.companyName')}</label>
            <select
              id="contact-company"
              className={errors.company_id ? 'input-error' : 'input'}
              value={localCompanyId}
              onChange={e => {
                setLocalCompanyId(e.target.value);
                setErrors(current => ({ ...current, company_id: undefined }));
              }}
              aria-invalid={!!errors.company_id}
              aria-describedby={errors.company_id ? 'contact-company-error' : undefined}
            >
              {allCompanies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.company_id && <p id="contact-company-error" className="field-error" role="alert">{errors.company_id}</p>}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="contact-first-name">{t('page.contacts.firstName')} *</label>
            <input
              id="contact-first-name"
              className={errors.first_name ? 'input-error' : 'input'}
              value={form.first_name}
              onChange={e => set('first_name', e.target.value)}
              aria-invalid={!!errors.first_name}
              aria-describedby={errors.first_name ? 'contact-first-name-error' : undefined}
            />
            {errors.first_name && <p id="contact-first-name-error" className="field-error" role="alert">{errors.first_name}</p>}
          </div>
          <div>
            <label className="label" htmlFor="contact-last-name">{t('page.contacts.lastName')} *</label>
            <input
              id="contact-last-name"
              className={errors.last_name ? 'input-error' : 'input'}
              value={form.last_name}
              onChange={e => set('last_name', e.target.value)}
              aria-invalid={!!errors.last_name}
              aria-describedby={errors.last_name ? 'contact-last-name-error' : undefined}
            />
            {errors.last_name && <p id="contact-last-name-error" className="field-error" role="alert">{errors.last_name}</p>}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="contact-email">{t('common.email')}</label>
          <input
            id="contact-email"
            className="input"
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="contact-job-title">{t('page.contacts.jobTitle')}</label>
            <input id="contact-job-title" className="input" value={form.job_title} onChange={e => set('job_title', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="contact-department">{t('page.contacts.department')}</label>
            <input id="contact-department" className="input" value={form.department} onChange={e => set('department', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="contact-role">{t('page.contacts.role')}</label>
          <select id="contact-role" className="input" value={form.role_in_process} onChange={e => set('role_in_process', e.target.value)}>
            <option value="procurement">{t('page.contacts.roles.procurement')}</option>
            <option value="engineering">{t('page.contacts.roles.engineering')}</option>
            <option value="quality">{t('page.contacts.roles.quality')}</option>
            <option value="management">{t('page.contacts.roles.management')}</option>
            <option value="logistics">{t('page.contacts.roles.logistics')}</option>
            <option value="other">{t('page.contacts.roles.other')}</option>
          </select>
        </div>
        </fieldset>

        <fieldset className="space-y-3 border-t border-border pt-4">
          <legend className="section-label mb-3">{t('page.contacts.contactMethods')}</legend>
        <div>
          <label className="label" htmlFor="contact-direct-phone">{t('page.contacts.directPhone')}</label>
          <input id="contact-direct-phone" className="input" value={form.phone_direct} onChange={e => set('phone_direct', e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="contact-mobile-phone">{t('page.contacts.mobilePhone')}</label>
          <input id="contact-mobile-phone" className="input" value={form.phone_mobile} onChange={e => set('phone_mobile', e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="contact-wechat">{t('page.contacts.wechat')}</label>
          <input id="contact-wechat" className="input" value={form.wechat_id} onChange={e => set('wechat_id', e.target.value)} />
        </div>
        </fieldset>

        <fieldset className="space-y-2 border-t border-border pt-4">
          <legend className="section-label mb-3">{t('page.contacts.role')}</legend>
          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 hover:bg-canvas">
            <input type="checkbox" checked={form.is_primary_contact} onChange={e => set('is_primary_contact', e.target.checked)} className="size-4 rounded border-border-strong text-brand" />
            <span className={`w-2.5 h-2.5 rounded-full ${form.is_primary_contact ? 'bg-success' : 'bg-border-strong'}`} />
            <span className="text-sm text-ink">{t('page.contacts.primaryContact')}</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 hover:bg-canvas">
            <input type="checkbox" checked={form.is_decision_maker} onChange={e => set('is_decision_maker', e.target.checked)} className="size-4 rounded border-border-strong text-brand" />
            <span className={`w-2.5 h-2.5 rounded-full ${form.is_decision_maker ? 'bg-danger' : 'bg-border-strong'}`} />
            <span className="text-sm text-ink">{t('page.contacts.decisionMaker')}</span>
          </label>
        </fieldset>

        <div>
          <label className="label" htmlFor="contact-notes">{t('page.companies.notes')}</label>
          <textarea id="contact-notes" className="input min-h-[60px] resize-y" value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>

        <div className="sticky bottom-0 z-10 -mx-5 flex gap-2 border-t border-border bg-surface px-5 py-4">
          <button
            onClick={save}
            disabled={saving}
            className="btn-primary flex-1"
          >
            {saving ? t('page.companies.saving') : isEdit ? t('page.companies.saveChanges') : t('page.contacts.createContact')}
          </button>
          <button onClick={onClose} disabled={saving} className="btn-secondary">{t('common.cancel')}</button>
        </div>

        {isEdit && (
          <button onClick={() => setConfirmDelete(true)} className="text-xs text-danger hover:text-danger w-full text-center pt-2">
            {t('page.contacts.deleteContact')}
          </button>
        )}
        </div>
      </SidePanel>
      <ConfirmDialog
        open={confirmDelete}
        title={t('page.contacts.deleteContact')}
        description={t('page.contacts.confirmDeleteContact', { name: `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim() })}
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
