import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { exportFullCsv } from '../lib/exportCsv';
import { auth, companies, team, type TeamMember } from '../lib/api';
import { daysSince } from '../lib/dates';
import StatusBadge from '../components/shared/StatusBadge';
import ClassBadge from '../components/shared/ClassBadge';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import CompanyEditPanel from '../components/companies/CompanyEditPanel';
import Icon from '../components/shared/Icon';
import SidePanel from '../components/shared/SidePanel';
import Pagination from '../components/shared/Pagination';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

const COMPANIES_PAGE_SIZE = 10;

export default function Companies() {
  const { t } = useTranslation();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', company_type: 'end_user', industry: '', country: 'US', city: '', notes: '', customer_code: '' });
  const [createErrors, setCreateErrors] = useState<{ name?: string }>({});
  const createNameInputRef = useRef<HTMLInputElement>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersLoadError, setMembersLoadError] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<null | 'name' | 'last_activity'>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    setLoadError(false);
    companies.list()
      .then(data => setList(data))
      .catch(() => {
        setList([]);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const loadOwnerData = () => {
    setMembersLoadError(false);
    team.list()
      .then(setMembers)
      .catch(() => {
        setMembers([]);
        setMembersLoadError(true);
      });
    auth.me()
      .then(({ user }) => setCurrentUserId(user.id))
      .catch(() => {
        setCurrentUserId('');
        setMembersLoadError(true);
      });
  };

  useEffect(() => {
    loadOwnerData();
  }, []);

  const searchTerm = search.trim().toLowerCase();
  const filtered = list.filter(c => {
    const matchesSearch = !searchTerm || [c.name, c.city, c.customer_code, c.industry]
      .some(value => String(value || '').toLowerCase().includes(searchTerm));
    const matchesOwner = ownerFilter === 'all'
      || (ownerFilter === 'mine' && c.owner_user_id === currentUserId)
      || (ownerFilter === 'unassigned' && !c.owner_user_id)
      || c.owner_user_id === ownerFilter;
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesOwner && matchesStatus;
  });
  const hasFilters = search || ownerFilter !== 'all' || statusFilter !== 'all';
  const ordered = sortKey
    ? [...filtered].sort((a, b) => {
      if (sortKey === 'name') {
        const cmp = String(a.name || '').localeCompare(String(b.name || ''));
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const av = a.last_activity_at ? new Date(a.last_activity_at).getTime() : null;
      const bv = b.last_activity_at ? new Date(b.last_activity_at).getTime() : null;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return sortDir === 'asc' ? av - bv : bv - av;
    })
    : filtered;
  const pageCount = Math.max(1, Math.ceil(ordered.length / COMPANIES_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = ordered.slice(
    (currentPage - 1) * COMPANIES_PAGE_SIZE,
    currentPage * COMPANIES_PAGE_SIZE,
  );

  const toggleSort = (key: 'name' | 'last_activity') => {
    if (sortKey === key) {
      setSortDir(dir => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const renderEmptyState = () => (
    <div className="empty-state">
      <p>{hasFilters ? t('noData.companiesFiltered') : t('noData.companies')}</p>
      {hasFilters ? (
        <button
          type="button"
          onClick={() => { setSearch(''); setOwnerFilter('all'); setStatusFilter('all'); }}
          className="btn-secondary btn-sm"
        >
          {t('common.clearFilters')}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => { setCreateErrors({}); setShowForm(true); }}
          className="btn-primary btn-sm"
        >
          <Icon name="plus" size={14} className="mr-1.5" />
          {t('page.companies.new')}
        </button>
      )}
    </div>
  );

  useEffect(() => {
    setPage(1);
  }, [search, ownerFilter, statusFilter, sortKey, sortDir]);

  useEffect(() => {
    setPage(current => Math.min(current, pageCount));
  }, [pageCount]);

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
    setEditTarget(c);
    setOpenMenu(null);
  };

  const duplicate = async (c: any) => {
    if (duplicatingId) return;
    setOpenMenu(null);
    setDuplicatingId(c.id);
    try {
      await companies.create({
        name: `${c.name} (${t('common.duplicate')})`,
        company_type: c.company_type,
        industry: c.industry,
        country: c.country,
        city: c.city,
      });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('page.companies.createFailed'));
    } finally {
      setDuplicatingId(null);
    }
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
          <button onClick={() => openEdit(company)} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-ink-muted hover:bg-surface-hover"><Icon name="square-pen" size={13} />{t('common.edit')}</button>
          <button onClick={() => duplicate(company)} disabled={duplicatingId === company.id} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-ink-muted hover:bg-surface-hover"><Icon name="copy" size={13} />{t('common.duplicate')}</button>
          <button onClick={() => { setDeleteTarget(company); setOpenMenu(null); }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-danger hover:bg-danger-soft"><Icon name="delete" size={13} />{t('common.delete')}</button>
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
            <span id="company-create-customer-code-help" className="text-2xs text-ink-subtle">{t('page.companies.orderNumberHint')}</span>
          </div>
          <div className="flex gap-2 pt-4 border-t border-border">
            <button onClick={create} className="btn-primary flex-1">{t('common.create')}</button>
            <button onClick={closeCreatePanel} className="btn-secondary">{t('common.cancel')}</button>
          </div>
        </div>
      </SidePanel>

      {/* List editing reuses the full company panel so list and detail stay in sync */}
      <CompanyEditPanel company={editTarget} onClose={() => setEditTarget(null)} onSaved={load} />

      <SidePanel
        open={showImport}
        onClose={closeImport}
        title={t('page.companies.importCompanies')}
        subtitle={t('page.companies.importHelp')}
        width="w-[min(560px,calc(100vw-1rem))]"
      >
        {/* Template */}
        <div className="bg-surface-subtle border border-border rounded-lg p-3 mb-4 text-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-ink-muted">{t('page.companies.templateFormat')}</span>
                <button
                  onClick={() => {
                    const csv = 'Name,Type,Industry,Country,City,Phone,Email,Website,Status,Classification,CustomerCode,RegistrationNo,Address1,Address2,State,PostalCode\nAcme Aerospace,end_user,Aerospace,US,Los Angeles,+1-555-0100,sales@acme.com,https://acme.com,active,A,SMP,,,,,,\n';
                    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = 'companies_template.csv'; a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="text-brand hover:underline font-medium"
                >{t('page.companies.downloadTemplate')}</button>
              </div>
              <div className="tabular-nums text-2xs text-ink-muted leading-relaxed">
                Name*,Type,Industry,Country,City,Phone,Email,Website,Status,Classification<br />
                <span className="text-ink-subtle">CustomerCode,RegistrationNo,Address1,Address2,State,PostalCode</span>
              </div>
        </div>

        <div className="space-y-4">
              <div>
                <label className="label">{t('page.companies.file')}</label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-brand-soft text-brand hover:bg-brand-100 border-0">
                    {t('page.companies.chooseFile')}
                    <input type="file" accept=".csv,.xlsx" onChange={e => { setImportFile(e.target.files?.[0] || null); setImportResult(null); }} className="sr-only" />
                  </label>
                  <span className="text-xs text-ink-muted">{importFile ? importFile.name : t('page.companies.noFileSelected')}</span>
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
                <div className={`rounded-lg p-3 text-sm ${importResult.created > 0 ? 'bg-success-soft border border-success/40' : 'bg-surface-hover'}`}>
                  <div className="font-semibold text-ink mb-1">
                    {importResult.created > 0 ? `✅ ${importResult.created} ${t('page.companies.importedCompanies')}` : t('page.companies.noNewCompanies')}
                  </div>
                  <div className="text-xs text-ink-muted">
                    {t('page.companies.totalRows')}: {importResult.total} | {t('page.companies.created')}: {importResult.created} | {t('page.companies.skipped')}: {importResult.skipped}
                  </div>
                  {importResult.results?.slice(0, 10).map((r: any, i: number) => (
                    <div key={i} className="text-2xs text-ink-muted mt-1">{r.name} — {r.action}</div>
                  ))}
                  {importResult.errors?.length > 0 && (
                    <div className="mt-2 text-xs text-danger">{importResult.errors.length} errors ({t('page.companies.checkFormat')})</div>
                  )}
                </div>
              )}
        </div>

        <div className="sticky bottom-0 z-10 -mx-5 mt-4 flex justify-end border-t border-border bg-surface px-5 pt-4">
          <button onClick={closeImport} disabled={importing} className="btn-secondary btn-sm">{t('common.close')}</button>
        </div>
      </SidePanel>

      <div className="page-header">
        <div className="px-3">
          <h1 className="page-heading">{t('page.title.companies')}</h1>
          <p className="page-summary tabular-nums">{filtered.length}{hasFilters ? ` / ${list.length}` : ''} {t('common.records')}</p>
        </div>
        <div className="page-actions px-3">
          <button onClick={() => { setCreateErrors({}); setShowForm(true); }} className="btn-primary"><Icon name="plus" size="toolbar" />{t('page.companies.new')}</button>
        </div>
      </div>

      <div className="toolbar">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <label className="sr-only" htmlFor="company-search">{t('common.searchCompanies')}</label>
          <Icon name="search" size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
          <input id="company-search" className="input pl-8" placeholder={t('common.searchCompanies')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <select className="input w-auto min-w-[130px]" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label={t('page.companies.status')}>
            <option value="all">{t('page.companies.allStatuses')}</option>
            <option value="active">{t('status.active')}</option>
            <option value="on_hold">{t('status.onHold')}</option>
            <option value="dormant">{t('status.dormant')}</option>
            <option value="blacklisted">{t('status.blacklisted')}</option>
          </select>
          <select className="input w-auto min-w-[130px]" value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} aria-label={t('accountability.owner')}>
            <option value="all">{t('accountability.allOwners')}</option>
            <option value="mine">{t('accountability.myCustomers')}</option>
            <option value="unassigned">{t('accountability.unassigned')}</option>
            {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
          {membersLoadError && (
            <div className="flex items-center gap-2" role="alert">
              <span className="text-2xs text-danger">{t('page.error.loadFailed')}</span>
              <button type="button" onClick={loadOwnerData} className="inline-flex items-center gap-1 text-2xs text-brand hover:underline">
                <Icon name="refresh" size={12} />
                {t('common.refresh')}
              </button>
            </div>
          )}
          <div className="relative">
            <button onClick={() => setOpenMenu(openMenu === '_tools' ? null : '_tools')} className="btn-secondary btn-sm" aria-label={t('common.moreActions')} title={t('common.moreActions')}><Icon name="more" size={14} /></button>
            {openMenu === '_tools' && (
              <div className="menu-surface absolute right-0 top-full mt-1 w-32" onClick={e => e.stopPropagation()}>
                <button onClick={() => { setOpenMenu(null); setShowImport(true); }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-ink-muted hover:bg-surface-hover"><Icon name="upload" size={13} />{t('page.companies.import')}</button>
                <button onClick={() => { setOpenMenu(null); exportFullCsv('/api/companies', 'companies'); }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-ink-muted hover:bg-surface-hover"><Icon name="download" size={13} />CSV</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="data-surface border-t-0 rounded-t-none p-3" aria-label={t('common.loading')}>
          <div className="animate-pulse space-y-2">
            {[0, 1, 2, 3, 4, 5].map(row => <div key={row} className="h-10 rounded-md bg-surface-hover" />)}
          </div>
        </div>
      ) : loadError ? (
        <div className="data-surface border-t-0 rounded-t-none p-6" role="alert">
          <div className="empty-state">
            <p>{t('page.error.loadFailed')}</p>
            <button type="button" onClick={load} className="btn-secondary btn-sm mt-3">
              <Icon name="refresh" size={14} className="mr-1.5" />
              {t('common.refresh')}
            </button>
          </div>
        </div>
      ) : (
            <div className="hidden data-surface md:block">
              <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-surface-subtle">
                <th className="table-header" aria-sort={sortKey === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  <button
                    type="button"
                    onClick={() => toggleSort('name')}
                    className="inline-flex items-center gap-1 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    {t("page.companies.name")}
                    {sortKey === 'name' && <Icon name="chevron-down" size={12} className={sortDir === 'asc' ? 'rotate-180' : ''} />}
                  </button>
                </th>
                <th className="table-header">{t("page.companies.status")}</th>
                <th className="table-header hidden lg:table-cell">{t('accountability.owner')}</th>
                <th className="table-header hidden md:table-cell">{t("page.companies.location")}</th>
                <th className="table-header hidden sm:table-cell">{t("page.companies.industry")}</th>
                <th className="table-header hidden lg:table-cell" aria-sort={sortKey === 'last_activity' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  <button
                    type="button"
                    onClick={() => toggleSort('last_activity')}
                    className="inline-flex items-center gap-1 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    {t('page.companyDetail.lastActivity')}
                    {sortKey === 'last_activity' && <Icon name="chevron-down" size={12} className={sortDir === 'asc' ? 'rotate-180' : ''} />}
                  </button>
                </th>
                <th className="table-header w-12"></th>
              </tr>
            </thead>
            <tbody>
              {paged.map(c => (
                <tr key={c.id} className="table-row group" onClick={() => handleRowClick(c.id)}>
                  <td className="table-cell">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="min-w-0 font-medium text-ink truncate underline decoration-border-strong underline-offset-2 group-hover:decoration-ink">{c.name}</span>
                        <ClassBadge classification={c.classification} />
                      </div>
                      {c.customer_code && <span className="text-2xs text-ink-subtle tabular-nums">{c.customer_code}</span>}
                    </div>
                  </td>
                  <td className="table-cell"><StatusBadge status={c.status} /></td>
                  <td className="table-cell hidden lg:table-cell text-ink-muted">{c.owner_name || t('accountability.unassigned')}</td>
                  <td className="table-cell hidden md:table-cell text-ink-muted">{c.city ? `${c.city}, ${c.country}` : c.country}</td>
                  <td className="table-cell hidden sm:table-cell text-ink-muted">{c.industry || '—'}</td>
                  <td className="table-cell hidden lg:table-cell tabular-nums text-ink-muted">{c.last_activity_at ? t('page.companyDetail.daysAgo', { count: daysSince(c.last_activity_at) }) : '—'}</td>
                  <td className="table-cell">{renderCompanyActions(c)}</td>
                </tr>
              ))}
                </tbody>
              </table>
              {filtered.length === 0 && renderEmptyState()}
              <Pagination
                page={currentPage}
                pageSize={COMPANIES_PAGE_SIZE}
                total={filtered.length}
                onPageChange={setPage}
              />
            </div>
          )}
          {!loading && (
            <>
            <div className="data-surface md:hidden divide-y divide-border">
              {paged.map(c => (
                <article
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  className="group p-3 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
                  onClick={() => handleRowClick(c.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleRowClick(c.id);
                    }
                  }}
                >
                  <div className="flex items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <div className="min-w-0 truncate text-sm font-medium text-ink underline decoration-border-strong underline-offset-2 group-hover:decoration-ink">{c.name}</div>
                        <ClassBadge classification={c.classification} />
                      </div>
                      <div className="mt-0.5 truncate text-2xs text-ink-muted">
                        {c.industry || '—'}
                      </div>
                    </div>
                    {renderCompanyActions(c)}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusBadge status={c.status} />
                    <span className="text-2xs text-ink-subtle">{c.city ? `${c.city}, ${c.country}` : c.country}</span>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-xs">
                    <div className="min-w-0">
                      <dt className="text-2xs text-ink-subtle">{t('accountability.owner')}</dt>
                      <dd className="mt-0.5 truncate text-ink-muted">{c.owner_name || t('accountability.unassigned')}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-2xs text-ink-subtle">{t('page.companyDetail.lastActivity')}</dt>
                      <dd className="mt-0.5 truncate tabular-nums text-ink-muted">{c.last_activity_at ? t('page.companyDetail.daysAgo', { count: daysSince(c.last_activity_at) }) : '—'}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-2xs text-ink-subtle">{t('page.companies.code')}</dt>
                      <dd className="mt-0.5 truncate tabular-nums text-ink-muted">{c.customer_code || '—'}</dd>
                    </div>
                  </dl>
                </article>
              ))}
              {filtered.length === 0 && renderEmptyState()}
            </div>
            <div className="md:hidden">
              <Pagination
                page={currentPage}
                pageSize={COMPANIES_PAGE_SIZE}
                total={filtered.length}
                onPageChange={setPage}
              />
            </div>
            </>
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
