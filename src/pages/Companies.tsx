import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { exportFullCsv } from '../lib/exportCsv';
import { companies } from '../lib/api';
import StatusBadge from '../components/shared/StatusBadge';
import { formatCurrency } from '../lib/currency';
import Icon from '../components/shared/Icon';
import SidePanel from '../components/shared/SidePanel';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

export default function Companies() {
  const { t } = useTranslation();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', company_type: 'end_user', industry: '', country: 'US', city: '', notes: '' });
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', company_type: 'end_user', industry: '', country: 'US', city: '', status: 'active', classification: 'C' });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = () => companies.list().then(setList).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const filtered = list.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.city?.toLowerCase().includes(search.toLowerCase())
  );

  const create = async () => {
    await companies.create(form);
    toast.success('Company created');
    setShowForm(false);
    setForm({ name: '', company_type: 'end_user', industry: '', country: 'US', city: '', notes: '' });
    load();
  };

  const openEdit = (c: any) => {
    setEditForm({
      name: c.name || '',
      company_type: c.company_type || 'end_user',
      industry: c.industry || '',
      country: c.country || 'US',
      city: c.city || '',
      status: c.status || 'active',
      classification: c.classification || 'C',
    });
    setEditTarget(c);
    setOpenMenu(null);
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    await companies.update(editTarget.id, editForm);
    toast.success('Company updated');
    setEditTarget(null);
    load();
  };

  const duplicate = async (c: any) => {
    setOpenMenu(null);
    await companies.create({
      name: `${c.name} (copy)`,
      company_type: c.company_type,
      industry: c.industry,
      country: c.country,
      city: c.city,
    });
    load();
  };

  const handleRowClick = (id: string) => { navigate(`/companies/${id}`); };

  const remove = async (id: string) => {
    await companies.delete(id);
    setConfirmDelete(null);
    setOpenMenu(null);
    load();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* New Company Panel */}
      <SidePanel open={showForm} onClose={() => setShowForm(false)} title="New Company">
        <div className="space-y-4">
          <div>
            <label className="label">Company Name *</label>
            <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Acme Aerospace Corp" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.company_type} onChange={e => setForm({...form, company_type: e.target.value})}>
                <option value="end_user">End-user</option>
                <option value="distributor">Distributor</option>
                <option value="oem">OEM</option>
                <option value="trading_company">Trading Company</option>
              </select>
            </div>
            <div>
              <label className="label">Industry</label>
              <input className="input" value={form.industry} onChange={e => setForm({...form, industry: e.target.value})} placeholder="Aerospace, Medical..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Country</label>
              <input className="input" value={form.country} onChange={e => setForm({...form, country: e.target.value})} />
            </div>
            <div>
              <label className="label">City</label>
              <input className="input" value={form.city} onChange={e => setForm({...form, city: e.target.value})} placeholder="City" />
            </div>
          </div>
          <div className="flex gap-2 pt-4 border-t border-gray-100">
            <button onClick={create} className="btn-primary flex-1">{t('common.create')}</button>
            <button onClick={() => setShowForm(false) } className="btn-secondary">{t('common.cancel')}</button>
          </div>
        </div>
      </SidePanel>

      {/* Edit Modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-lg p-6 w-[480px]">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Edit Company — {editTarget.name}</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Company Name</label>
                <input className="input" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={editForm.company_type} onChange={e => setEditForm({...editForm, company_type: e.target.value})}>
                    <option value="end_user">End-user</option><option value="distributor">Distributor</option>
                    <option value="oem">OEM</option><option value="trading_company">Trading Company</option>
                  </select>
                </div>
                <div>
                  <label className="label">Industry</label>
                  <input className="input" value={editForm.industry} onChange={e => setEditForm({...editForm, industry: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Country</label>
                  <input className="input" value={editForm.country} onChange={e => setEditForm({...editForm, country: e.target.value})} />
                </div>
                <div>
                  <label className="label">City</label>
                  <input className="input" value={editForm.city} onChange={e => setEditForm({...editForm, city: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                    <option value="active">{t('status.active')}</option><option value="on_hold">{t('status.onHold')}</option>
                    <option value="dormant">{t('status.dormant')}</option><option value="blacklisted">{t('status.blacklisted')}</option>
                  </select>
                </div>
                <div>
                  <label className="label">Classification</label>
                  <select className="input" value={editForm.classification} onChange={e => setEditForm({...editForm, classification: e.target.value})}>
                    <option value="A">A — Strategic</option><option value="B">B — Regular</option><option value="C">C — Emerging</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={saveEdit} className="btn-primary flex-1">Save Changes</button>
                <button onClick={() => setEditTarget(null) } className="btn-secondary">{t('common.cancel')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('page.title.companies')}</h1>
          <p className="text-sm text-gray-500">{list.length} {t('page.title.companies')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowForm(true)} className="btn-primary btn-sm"><Icon name="plus" size={16} className="mr-1.5" />{t('page.companies.new')}</button>
          <button onClick={() => exportFullCsv('/api/companies', 'companies')} className="btn-secondary btn-sm"><Icon name="download" size={14} className="mr-1" />CSV</button>
        </div>
      </div>

      <div className="mb-4">
        <input className="input max-w-sm" placeholder={t("common.search")} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">{t('common.loading')}</div>
      ) : (
        <div className="card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="table-header">{t("page.companies.name")}</th>
                <th className="table-header hidden sm:table-cell">{t("page.companies.type")}</th>
                <th className="table-header hidden md:table-cell">{t("page.companies.industry")}</th>
                <th className="table-header hidden md:table-cell">{t("page.companies.location")}</th>
                <th className="table-header">{t("page.companies.status")}</th>
                <th className="table-header">{t("page.companies.classification")}</th>
                <th className="table-header w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="table-row" onClick={() => handleRowClick(c.id)}>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-medium">
                        {c.name?.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="font-medium text-gray-900">{c.name}</span>
                    </div>
                  </td>
                  <td className="table-cell hidden sm:table-cell text-2xs text-gray-500">{c.company_type?.replace('_', ' ')}</td>
                  <td className="table-cell hidden md:table-cell text-xs text-gray-500">{c.industry || '—'}</td>
                  <td className="table-cell hidden md:table-cell text-xs text-gray-500">{c.city ? `${c.city}, ${c.country}` : c.country}</td>
                  <td className="table-cell"><StatusBadge status={c.status} /></td>
                  <td className="table-cell text-2xs">{c.classification || 'C'}-Class</td>
                  <td className="table-cell" onClick={e => e.stopPropagation()}>
                    <div className="relative">
                      <button onClick={() => setOpenMenu(openMenu === c.id ? null : c.id)} className="btn-ghost btn-sm text-xs px-1">⋮</button>
                      {openMenu === c.id && (
                        <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-md z-20 py-1">
                          <button onClick={() => openEdit(c)} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"><Icon name="square-pen" size={13} />{t('common.edit')}</button>
                          <button onClick={() => duplicate(c)} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"><Icon name="copy" size={13} />Duplicate</button>
                          {confirmDelete !== c.id ? (
                            <button onClick={() => setConfirmDelete(c.id)} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"><Icon name="delete" size={13} />{t('common.delete')}</button>
                          ) : (
                            <div className="px-3 py-2">
                              <p className="text-2xs text-red-600 mb-1">Confirm?</p>
                              <div className="flex gap-1">
                                <button onClick={() => remove(c.id)} className="text-xs bg-red-600 text-white px-2 py-0.5 rounded">Yes</button>
                                <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-500 px-2 py-0.5">No</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">{t('noData.companies')}</div>}
        </div>
      )}
    </div>
  );
}
