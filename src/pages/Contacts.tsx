import { useState, useEffect } from 'react';
import { contacts, companies } from '../lib/api';
import ContactPanel from '../components/contacts/ContactPanel';
import Icon from '../components/shared/Icon';
import { useTranslation } from 'react-i18next';
import { exportFullCsv } from '../lib/exportCsv';

export default function Contacts() {
  const { t } = useTranslation();
  const [list, setList] = useState<any[]>([]);
  const [allCompanies, setAllCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [contactPanel, setContactPanel] = useState<{ companyId: string; contact?: any } | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    contacts.list(filterCompany || undefined).then(setList).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [filterCompany]);
  useEffect(() => { companies.list().then(setAllCompanies); }, []);

  const filtered = list.filter(c =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.company_name?.toLowerCase().includes(search.toLowerCase())
  );

  const duplicate = async (c: any) => {
    await contacts.create({
      company_id: c.company_id,
      first_name: c.first_name, last_name: c.last_name,
      job_title: c.job_title, email: c.email,
      role_in_process: c.role_in_process,
      phone_direct: c.phone_direct, phone_mobile: c.phone_mobile,
      notes: c.notes,
    });
    load();
  };

  const remove = async (id: string) => {
    await contacts.delete(id);
    setOpenMenu(null);
    setConfirmDelete(null);
    load();
  };

  const roleBadge = (role: string) => {
    const styles: Record<string, string> = {
      procurement: 'bg-blue-50 text-blue-600',
      engineering: 'bg-green-50 text-green-600',
      quality: 'bg-yellow-50 text-yellow-600',
    };
    return <span className={`inline-flex px-1.5 py-0.5 rounded text-2xs font-450 ${styles[role] || 'bg-gray-100 text-gray-500'}`}>{t(`page.contacts.roles.${role}`, role)}</span>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('page.title.contacts')}</h1>
          <p className="text-sm text-gray-500">{list.length} {t('page.title.contacts')}</p>
        </div>
        <div className="flex items-center gap-2">
          {allCompanies.length > 0 && (
            <button onClick={() => setContactPanel({ companyId: allCompanies[0].id })} className="btn-primary btn-sm">➕ {t('common.new')}</button>
          )}
          <button onClick={() => exportFullCsv('/api/contacts', 'contacts')} className="btn-secondary btn-sm"><Icon name="download" size={14} className="mr-1" />CSV</button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input className="input max-w-sm" placeholder={t('common.searchContacts')} value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input max-w-[200px]" value={filterCompany} onChange={e => setFilterCompany(e.target.value)}>
          <option value="">{t('page.contacts.allCompanies')}</option>
          {allCompanies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Contact Panel (edit/create) */}
      {contactPanel && (
        <ContactPanel
          companyId={contactPanel.companyId}
          contact={contactPanel.contact}
          allCompanies={allCompanies}
          onClose={() => setContactPanel(null)}
          onSaved={load}
        />
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">{t('common.loading')}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(c => (
            <div key={c.id} className="card p-4 relative bg-gray-50">
              {/* Actions menu */}
              <div className="absolute top-2 right-2">
                <div className="relative">
                  <button
                    onClick={() => setOpenMenu(openMenu === c.id ? null : c.id)}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 text-xs"
                  >
                    ⋮
                  </button>
                  {openMenu === c.id && (
                    <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-md z-20 py-1">
                      {confirmDelete === c.id ? (
                        <div className="px-3 py-2">
                          <p className="text-2xs text-red-600 mb-1">{t('common.confirmDelete')}</p>
                          <div className="flex gap-1">
                            <button onClick={() => remove(c.id)} className="text-xs bg-red-600 text-white px-2 py-0.5 rounded">{t('common.yes')}</button>
                            <button onClick={() => { setConfirmDelete(null); setOpenMenu(null); }} className="text-xs text-gray-500 px-2 py-0.5">{t('common.no')}</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => { setOpenMenu(null); setContactPanel({ companyId: c.company_id, contact: c }); }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                            <Icon name="square-pen" size={13} />{t('common.edit')}
                          </button>
                          <button onClick={() => duplicate(c)} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                            <Icon name="copy" size={13} />{t('common.duplicate')}
                          </button>
                          <button onClick={() => setConfirmDelete(c.id)} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
                            <Icon name="delete" size={13} />{t('common.delete')}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Card content */}
              <div className="flex items-start justify-between mb-2 pr-6">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-medium">
                  {c.first_name?.[0]}{c.last_name?.[0]}
                </div>
                <div className="flex gap-1">
                  <span className={`w-2 h-2 rounded-full inline-block ${c.is_primary_contact ? 'bg-green-500' : 'bg-gray-300'}`} title={c.is_primary_contact ? t('page.contacts.primaryContact') : ''} />
                  <span className={`w-2 h-2 rounded-full inline-block ${c.is_decision_maker ? 'bg-red-500' : 'bg-gray-300'}`} title={c.is_decision_maker ? t('page.contacts.decisionMaker') : ''} />
                </div>
              </div>
              <h3 className="text-sm font-medium text-gray-900">{c.first_name} {c.last_name}</h3>
              <p className="text-xs text-gray-500 mb-2">{c.job_title || '—'}</p>
              {c.company_name && (
                <button onClick={() => window.location.href = `/companies/${c.company_id}`} className="text-xs text-blue-600 hover:underline mb-2 block">
                  {c.company_name}
                </button>
              )}
              <div className="space-y-1 text-xs text-gray-600">
                <div className="truncate">{c.email}</div>
                {c.phone_direct && <div>{c.phone_direct}</div>}
              </div>
              <div className="mt-3">{roleBadge(c.role_in_process)}</div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400 text-sm">{t('noData.contacts')}</div>
          )}
        </div>
      )}
    </div>
  );
}
