import { useState } from 'react';
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
  is_primary_contact: boolean;
  is_decision_maker: boolean;
  notes: string;
};

const emptyForm: ContactForm = {
  first_name: '', last_name: '', job_title: '', department: '',
  role_in_process: 'procurement', email: '', phone_direct: '', phone_mobile: '',
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
    is_primary_contact: !!contact.is_primary_contact,
    is_decision_maker: !!contact.is_decision_maker,
    notes: contact.notes || '',
  } : emptyForm);
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [localCompanyId, setLocalCompanyId] = useState(companyId);

  const set = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));
  const activeCompanyId = isEdit ? companyId : localCompanyId;

  const save = async () => {
    if (!activeCompanyId) { toast.error('请先选择所属公司'); return; }
    if (!form.first_name || !form.last_name) { toast.error('请填写联系人姓名'); return; }
    if (!form.email) { toast.error('请填写邮箱地址'); return; }
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
    if (!window.confirm(t('page.contacts.confirmDeleteContact', { name: `${contact.first_name} ${contact.last_name}` }))) return;
    try {
      await contacts.delete(contact.id);
      toast.success(t('page.contacts.contactDeleted'));
      onSaved();
      onClose();
    } catch (e) {
      toast.error(t('page.contacts.deleteFailed'));
    }
  };

  return (
    <SidePanel
      open={true}
      onClose={onClose}
      title={isEdit ? t('page.contacts.editContact') : t('page.contacts.newContact')}
      subtitle={isEdit ? `${contact.first_name} ${contact.last_name}` : undefined}
    >
      <div className="space-y-4">
        {!isEdit && allCompanies && allCompanies.length > 0 && (
          <div>
            <label className="label">{t('page.companies.companyName')}</label>
            <select className="input" value={localCompanyId} onChange={e => setLocalCompanyId(e.target.value)}>
              {allCompanies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t('page.contacts.firstName')} *</label>
            <input className="input" value={form.first_name} onChange={e => set('first_name', e.target.value)} />
          </div>
          <div>
            <label className="label">{t('page.contacts.lastName')} *</label>
            <input className="input" value={form.last_name} onChange={e => set('last_name', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">{t('common.email')} *</label>
          <input className="input" value={form.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t('page.contacts.jobTitle')}</label>
            <input className="input" value={form.job_title} onChange={e => set('job_title', e.target.value)} />
          </div>
          <div>
            <label className="label">{t('page.contacts.department')}</label>
            <input className="input" value={form.department} onChange={e => set('department', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">{t('page.contacts.role')}</label>
          <select className="input" value={form.role_in_process} onChange={e => set('role_in_process', e.target.value)}>
            <option value="procurement">{t('page.contacts.roles.procurement')}</option>
            <option value="engineering">{t('page.contacts.roles.engineering')}</option>
            <option value="quality">{t('page.contacts.roles.quality')}</option>
            <option value="management">{t('page.contacts.roles.management')}</option>
            <option value="logistics">{t('page.contacts.roles.logistics')}</option>
            <option value="other">{t('page.contacts.roles.other')}</option>
          </select>
        </div>
        <div>
          <label className="label">{t('page.contacts.directPhone')}</label>
          <input className="input" value={form.phone_direct} onChange={e => set('phone_direct', e.target.value)} />
        </div>
        <div>
          <label className="label">{t('page.contacts.mobilePhone')}</label>
          <input className="input" value={form.phone_mobile} onChange={e => set('phone_mobile', e.target.value)} />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_primary_contact} onChange={e => set('is_primary_contact', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
            <span className={`w-2.5 h-2.5 rounded-full ${form.is_primary_contact ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="text-sm text-gray-700">{t('page.contacts.primaryContact')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_decision_maker} onChange={e => set('is_decision_maker', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
            <span className={`w-2.5 h-2.5 rounded-full ${form.is_decision_maker ? 'bg-red-500' : 'bg-gray-300'}`} />
            <span className="text-sm text-gray-700">{t('page.contacts.decisionMaker')}</span>
          </label>
        </div>

        <div>
          <label className="label">{t('page.companies.notes')}</label>
          <textarea className="input min-h-[60px] resize-y" value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>

        <div className="flex gap-2 pt-4 border-t border-gray-100">
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
          <button onClick={remove} className="text-xs text-red-500 hover:text-red-700 w-full text-center pt-2">
            {t('page.contacts.deleteContact')}
          </button>
        )}
      </div>
    </SidePanel>
  );
}
