import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { exportFullCsv } from '../lib/exportCsv';
import { auth, companies, team, type TeamMember } from '../lib/api';
import StatusBadge from '../components/shared/StatusBadge';
import ConfirmDialog from '../components/shared/ConfirmDialog';
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
  const [form, setForm] = useState({ name: '', company_type: 'end_user', industry: '', country: 'US', city: '', notes: '', customer_code: '' });
  const [createErrors, setCreateErrors] = useState<{ name?: string }>({});
  const createNameInputRef = useRef<HTMLInputElement>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', company_type: 'end_user', industry: '', country: 'US', city: '', status: 'active', classification: 'C', owner_user_id: '' });
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const navigate = useNavigate();

  const load = () => companies.list().then(setList).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    team.list().then(setMembers).catch(() => setMembers([]));
    auth.me().then(({ user }) => setCurrentUserId(user.id)).catch(() => setCurrentUserId(''));
  }, []);

  const filtered = list.filter(c => {
    const matchesSearch = c.name?.toLowerCase().includes(search.toLowerCase()) || c.city?.toLowerCase().includes(search.toLowerCase());
    const matchesOwner = ownerFilter === 'all'
      || (ownerFilter === 'mine' && c.owner_user_id === currentUserId)
      || (ownerFilter === 'unassigned' && !c.owner_user_id)
      || c.owner_user_id === ownerFilter;
    return matchesSearch && matchesOwner;
  });

  const companyTypeLabel = (type: string) => {
    const key = type === 'end_user' ? 'endUser'
      : type === 'trading_company' ? 'trading'
        : type;
    return t(`page.companies.${key}`, type?.replace('_', ' '));
  };

  const classificationLabel = (value: string) => value === 'A'
    ? t('page.companies.strategic')
    : value === 'B'
      ? t('page.companies.regular')
      : t('page.companies.emerging');

  const create = async () => {
    if (!form.name.trim()) {
      setCreateErrors({ name: t('page.companies.companyNameRequired') });
      createNameInputRef.current?.focus();
      return;
    }
    setCreateErrors({});
    try {
      await companies.create(form);
      toast.success(t('page.companies.companyCreated'));
      setShowForm(false);
      setForm({ name: '', company_type: 'end_user', industry: '', country: 'US', city: '', notes: '', customer_code: '' });
      load();
    } catch (e: any) {
      toast.error(e.message || t('page.companies.createFailed'));
    }
  };

  const closeCreatePanel = () => {
    setCreateErrors({});
    setShowForm(false);
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
      owner_user_id: c.owner_user_id || '',
    });
    setEditTarget(c);
    setOpenMenu(null);
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    await companies.update(editTarget.id, { ...editForm, owner_user_id: editForm.owner_user_id || null });
    toast.success(t('page.companies.companyUpdated'));
    setEditTarget(null);
    load();
  };

  const duplicate = async (c: any) => {
    setOpenMenu(null);
    await companies.create({
      name: `${c.name} (${t('common.duplicate')})`,
      company_type: c.company_type,
      industry: c.industry,
      country: c.country,
      city: c.city,
    });
    load();
  };

  const handleRowClick = (id: string) => { navigate(`/companies/${id}`); };

  const remove = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await companies.delete(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('page.companies.companySaveFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const closeImport = () => {
    if (importing) return;
    setShowImport(false);
    setImportResult(null);
    setImportFile(null);
  };

  const renderCompanyActions = (company: any) => (
    <div className="relative" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
      <button onClick={() => setOpenMenu(openMenu === company.id ? null : company.id)} className="icon-btn" aria-label={t('common.moreActions')} title={t('common.moreActions')}>
        <Icon name="more" size={16} />
      </button>
      {openMenu === company.id && (
        <div className="menu-surface absolute right-0 top-full mt-1 w-36">
          <button onClick={() => openEdit(company)} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"><Icon name="square-pen" size={13} />{t('common.edit')}</button>
          <button onClick={() => duplicate(company)} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"><Icon name="copy" size={13} />{t('common.duplicate')}</button>
          <button onClick={() => { setDeleteTarget(company); setOpenMenu(null); }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"><Icon name="delete" size={13} />{t('common.delete')}</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="page-shell">
      {/* New Company Panel */}
      <SidePanel open={showForm} onClose={closeCreatePanel} title={t('page.companies.new')}>
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="company-create-name">{t('page.companies.companyName')} *</label>
            <input
              ref={createNameInputRef}
              id="company-create-name"
              className={createErrors.name ? 'input-error' : 'input'}
              value={form.name}
              onChange={e => {
                setForm({...form, name: e.target.value});
                if (e.target.value.trim()) setCreateErrors({});
              }}
              placeholder="Acme Aerospace Corp"
              required
              autoComplete="organization"
              aria-invalid={!!createErrors.name}
              aria-describedby={createErrors.name ? 'company-create-name-error' : undefined}
            />
            {createErrors.name && <p id="company-create-name-error" className="field-error" role="alert">{createErrors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="company-create-type">{t('page.companies.type')}</label>
              <select id="company-create-type" className="input" value={form.company_type} onChange={e => setForm({...form, company_type: e.target.value})}>
                <option value="end_user">{t('page.companies.endUser')}</option>
                <option value="distributor">{t('page.companies.distributor')}</option>
                <option value="oem">OEM</option>
                <option value="trading_company">{t('page.companies.trading')}</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="company-create-industry">{t('page.companies.industry')}</label>
              <input id="company-create-industry" className="input" value={form.industry} onChange={e => setForm({...form, industry: e.target.value})} placeholder={t('page.companies.placeholderIndustry')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="company-create-country">{t('page.companies.country')}</label>
              <input id="company-create-country" className="input" value={form.country} onChange={e => setForm({...form, country: e.target.value})} autoComplete="country-name" />
            </div>
            <div>
              <label className="label" htmlFor="company-create-city">{t('page.companies.city')}</label>
              <input id="company-create-city" className="input" value={form.city} onChange={e => setForm({...form, city: e.target.value})} placeholder={t('page.companies.placeholderCity')} autoComplete="address-level2" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="company-create-customer-code">{t('page.companies.customerCode')}</label>
            <input id="company-create-customer-code" className="input tabular-nums uppercase" value={form.customer_code} onChange={e => setForm({...form, customer_code: e.target.value.toUpperCase()})} placeholder="SMP" maxLength={10} aria-describedby="company-create-customer-code-help" />
            <span id="company-create-customer-code-help" className="text-2xs text-gray-400">{t('page.companies.orderNumberHint')}</span>
          </div>
          <div className="flex gap-2 pt-4 border-t border-gray-100">
            <button onClick={create} className="btn-primary flex-1">{t('common.create')}</button>
            <button onClick={closeCreatePanel} className="btn-secondary">{t('common.cancel')}</button>
          </div>
        </div>
      </SidePanel>

      <SidePanel open={!!editTarget} onClose={() => setEditTarget(null)} title={t('page.companies.editCompany')} subtitle={editTarget?.name}>
        <div className="space-y-4">
              <div>
                <label className="label" htmlFor="company-list-edit-name">{t('page.companies.companyName')}</label>
                <input id="company-list-edit-name" className="input" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} autoComplete="organization" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="company-list-edit-type">{t('page.companies.type')}</label>
                  <select id="company-list-edit-type" className="input" value={editForm.company_type} onChange={e => setEditForm({...editForm, company_type: e.target.value})}>
                    <option value="end_user">{t('page.companies.endUser')}</option><option value="distributor">{t('page.companies.distributor')}</option>
                    <option value="oem">OEM</option><option value="trading_company">{t('page.companies.trading')}</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="company-list-edit-industry">{t('page.companies.industry')}</label>
                  <input id="company-list-edit-industry" className="input" value={editForm.industry} onChange={e => setEditForm({...editForm, industry: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="company-list-edit-owner">{t('accountability.owner')}</label>
                <select id="company-list-edit-owner" className="input" value={editForm.owner_user_id} onChange={e => setEditForm({...editForm, owner_user_id: e.target.value})}>
                  <option value="">{t('accountability.unassigned')}</option>
                  {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="company-list-edit-country">{t('page.companies.country')}</label>
                  <input id="company-list-edit-country" className="input" value={editForm.country} onChange={e => setEditForm({...editForm, country: e.target.value})} autoComplete="country-name" />
                </div>
                <div>
                  <label className="label" htmlFor="company-list-edit-city">{t('page.companies.city')}</label>
                  <input id="company-list-edit-city" className="input" value={editForm.city} onChange={e => setEditForm({...editForm, city: e.target.value})} autoComplete="address-level2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="company-list-edit-status">{t('page.companies.status')}</label>
                  <select id="company-list-edit-status" className="input" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                    <option value="active">{t('status.active')}</option><option value="on_hold">{t('status.onHold')}</option>
                    <option value="dormant">{t('status.dormant')}</option><option value="blacklisted">{t('status.blacklisted')}</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="company-list-edit-classification">{t('page.companies.classification')}</label>
                  <select id="company-list-edit-classification" className="input" value={editForm.classification} onChange={e => setEditForm({...editForm, classification: e.target.value})}>
                    <option value="A">A — {t('page.companies.strategic')}</option><option value="B">B — {t('page.companies.regular')}</option><option value="C">C — {t('page.companies.emerging')}</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={saveEdit} className="btn-primary flex-1">{t('page.companies.saveChanges')}</button>
                <button onClick={() => setEditTarget(null) } className="btn-secondary">{t('common.cancel')}</button>
              </div>
        </div>
      </SidePanel>

      <SidePanel
        open={showImport}
        onClose={closeImport}
        title={t('page.companies.importCompanies')}
        subtitle={t('page.companies.importHelp')}
        width="w-[min(560px,calc(100vw-1rem))]"
      >
        {/* Template */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4 text-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-700">{t('page.companies.templateFormat')}</span>
                <button
                  onClick={() => {
                    const csv = 'Name,Type,Industry,Country,City,Phone,Email,Website,Status,Classification,CustomerCode,RegistrationNo,Address1,Address2,State,PostalCode\nAcme Aerospace,end_user,Aerospace,US,Los Angeles,+1-555-0100,sales@acme.com,https://acme.com,active,A,SMP,,,,,,\n';
                    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = 'companies_template.csv'; a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="text-blue-600 hover:underline font-medium"
                >{t('page.companies.downloadTemplate')}</button>
              </div>
              <div className="tabular-nums text-2xs text-gray-500 leading-relaxed">
                Name*,Type,Industry,Country,City,Phone,Email,Website,Status,Classification<br />
                <span className="text-gray-300">CustomerCode,RegistrationNo,Address1,Address2,State,PostalCode</span>
              </div>
        </div>

        <div className="space-y-4">
              <div>
                <label className="label">{t('page.companies.file')}</label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 border-0">
                    {t('page.companies.chooseFile')}
                    <input type="file" accept=".csv,.xlsx" onChange={e => { setImportFile(e.target.files?.[0] || null); setImportResult(null); }} className="sr-only" />
                  </label>
                  <span className="text-xs text-gray-500">{importFile ? importFile.name : t('page.companies.noFileSelected')}</span>
                </div>
              </div>

              <button
                onClick={async () => {
                  if (!importFile) return;
                  setImporting(true);
                  try {
                    const fd = new FormData();
                    fd.append('file', importFile);
                    const res = await fetch('/api/companies/import', { method: 'POST', body: fd });
                    const data = await res.json();
                    setImportResult(data);
                    if (res.ok) { load(); toast.success(`${data.created} ${t('page.companies.importedCompanies')}`); }
                    else { toast.error(data.error || t('page.companies.importFailed')); }
                  } catch { toast.error(t('page.companies.importFailed')); }
                  finally { setImporting(false); }
                }}
                disabled={!importFile || importing}
                className="btn-primary"
              >
                {importing ? t('page.companies.importing') : t('page.companies.uploadImport')}
              </button>

              {/* Result */}
              {importResult && (
                <div className={`rounded-lg p-3 text-sm ${importResult.created > 0 ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                  <div className="font-semibold text-gray-900 mb-1">
                    {importResult.created > 0 ? `✅ ${importResult.created} ${t('page.companies.importedCompanies')}` : t('page.companies.noNewCompanies')}
                  </div>
                  <div className="text-xs text-gray-600">
                    {t('page.companies.totalRows')}: {importResult.total} | {t('page.companies.created')}: {importResult.created} | {t('page.companies.skipped')}: {importResult.skipped}
                  </div>
                  {importResult.results?.slice(0, 10).map((r: any, i: number) => (
                    <div key={i} className="text-2xs text-gray-500 mt-1">{r.name} — {r.action}</div>
                  ))}
                  {importResult.errors?.length > 0 && (
                    <div className="mt-2 text-xs text-red-600">{importResult.errors.length} errors ({t('page.companies.checkFormat')})</div>
                  )}
                </div>
              )}
        </div>

        <div className="sticky bottom-0 z-10 -mx-5 mt-4 flex justify-end border-t border-gray-200 bg-white px-5 pt-4">
          <button onClick={closeImport} disabled={importing} className="btn-secondary btn-sm">{t('common.close')}</button>
        </div>
      </SidePanel>

      <div className="page-header">
        <div>
          <h1 className="page-heading">{t('page.title.companies')}</h1>
          <p className="page-summary tabular-nums">{filtered.length}{search ? ` / ${list.length}` : ''} {t('common.records')}</p>
        </div>
        <div className="page-actions">
          <button onClick={() => { setCreateErrors({}); setShowForm(true); }} className="btn-primary"><Icon name="plus" size="toolbar" />{t('page.companies.new')}</button>
        </div>
      </div>

      <div className="toolbar">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <label className="sr-only" htmlFor="company-search">{t('common.searchCompanies')}</label>
          <Icon name="search" size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input id="company-search" className="input pl-8" placeholder={t('common.searchCompanies')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <select className="input w-auto min-w-[130px]" value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} aria-label={t('accountability.owner')}>
            <option value="all">{t('accountability.allOwners')}</option>
            <option value="mine">{t('accountability.myCustomers')}</option>
            <option value="unassigned">{t('accountability.unassigned')}</option>
            {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
          <div className="relative">
            <button onClick={() => setOpenMenu(openMenu === '_tools' ? null : '_tools')} className="btn-secondary btn-sm"><Icon name="more" size={14} /></button>
            {openMenu === '_tools' && (
              <div className="menu-surface absolute right-0 top-full mt-1 w-32" onClick={e => e.stopPropagation()}>
                <button onClick={() => { setOpenMenu(null); setShowImport(true); }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"><Icon name="upload" size={13} />{t('page.companies.import')}</button>
                <button onClick={() => { setOpenMenu(null); exportFullCsv('/api/companies', 'companies'); }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"><Icon name="download" size={13} />CSV</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="data-surface border-t-0 rounded-t-none p-3" aria-label={t('common.loading')}>
          <div className="animate-pulse space-y-2">
            {[0, 1, 2, 3, 4, 5].map(row => <div key={row} className="h-10 rounded-md bg-gray-100" />)}
          </div>
        </div>
      ) : (
            <div className="hidden data-surface md:block">
              <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="table-header">{t("page.companies.name")}</th>
                <th className="table-header hidden sm:table-cell">{t("page.companies.industry")}</th>
                <th className="table-header hidden md:table-cell">{t("page.companies.location")}</th>
                <th className="table-header hidden lg:table-cell">{t('accountability.owner')}</th>
                <th className="table-header">{t("page.companies.status")}</th>
                <th className="table-header w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="table-row" onClick={() => handleRowClick(c.id)}>
                  <td className="table-cell">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-medium ${
                        c.classification === 'A' ? 'bg-blue-100 text-blue-700' :
                        c.classification === 'B' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {c.name?.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <span className="font-medium text-gray-900 truncate block">{c.name}</span>
                        {c.customer_code && <span className="text-2xs text-gray-400 tabular-nums">{c.customer_code}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="table-cell hidden sm:table-cell text-gray-500">{c.industry || '—'}</td>
                  <td className="table-cell hidden md:table-cell text-gray-500">{c.city ? `${c.city}, ${c.country}` : c.country}</td>
                  <td className="table-cell hidden lg:table-cell text-gray-500">{c.owner_name || t('accountability.unassigned')}</td>
                  <td className="table-cell"><StatusBadge status={c.status} /></td>
                  <td className="table-cell">{renderCompanyActions(c)}</td>
                </tr>
              ))}
                </tbody>
              </table>
              {filtered.length === 0 && <div className="empty-state">{t('noData.companies')}</div>}
            </div>
          )}
          {!loading && (
            <div className="data-surface md:hidden divide-y divide-gray-100">
              {filtered.map(c => (
                <article
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  className="p-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
                  onClick={() => handleRowClick(c.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleRowClick(c.id);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-medium ${
                      c.classification === 'A' ? 'bg-blue-100 text-blue-700' :
                      c.classification === 'B' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {c.name?.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-900">{c.name}</div>
                      <div className="mt-0.5 truncate text-2xs text-gray-500">
                        {c.industry || ''}{c.customer_code ? ` · ${c.customer_code}` : ''}
                      </div>
                    </div>
                    {renderCompanyActions(c)}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusBadge status={c.status} />
                    <span className="text-2xs text-gray-400">{c.city ? `${c.city}, ${c.country}` : c.country}</span>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-gray-100 pt-3 text-xs">
                    <div className="min-w-0">
                      <dt className="text-2xs text-gray-400">{t('page.companies.industry')}</dt>
                      <dd className="mt-0.5 truncate text-gray-700">{c.industry || '—'}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-2xs text-gray-400">{t('accountability.owner')}</dt>
                      <dd className="mt-0.5 truncate text-gray-700">{c.owner_name || t('accountability.unassigned')}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-2xs text-gray-400">{t('page.companies.code')}</dt>
                      <dd className="mt-0.5 truncate tabular-nums text-gray-700">{c.customer_code || '—'}</dd>
                    </div>
                  </dl>
                </article>
              ))}
              {filtered.length === 0 && <div className="empty-state">{t('noData.companies')}</div>}
            </div>
          )}
          <ConfirmDialog
        open={!!deleteTarget}
        title={t('common.delete')}
        description={<>{t('common.confirmDelete')} <strong>{deleteTarget?.name}</strong></>}
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
