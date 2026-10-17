import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { contacts, companies } from '../lib/api';
import ContactPanel from '../components/contacts/ContactPanel';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import Icon from '../components/shared/Icon';
import Pagination from '../components/shared/Pagination';
import { useTranslation } from 'react-i18next';
import { exportFullCsv } from '../lib/exportCsv';

const CONTACTS_PAGE_SIZE = 10;

export default function Contacts() {
  const { t } = useTranslation();
  const [list, setList] = useState<any[]>([]);
  const [allCompanies, setAllCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [companiesLoadError, setCompaniesLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const paramCompany = searchParams.get('company') || '';
  const [filterCompany, setFilterCompany] = useState(paramCompany);
  const [page, setPage] = useState(1);
  const [contactPanel, setContactPanel] = useState<{ companyId: string; contact?: any } | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError(false);
    contacts.list(filterCompany || undefined)
      .then(data => setList(data))
      .catch(() => {
        setList([]);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  };
  const loadCompanies = () => {
    setCompaniesLoadError(false);
    companies.list()
      .then(data => setAllCompanies(data))
      .catch(() => {
        setAllCompanies([]);
        setCompaniesLoadError(true);
      });
  };
  useEffect(() => { load(); }, [filterCompany]);
  useEffect(() => { loadCompanies(); }, []);
  useEffect(() => { setFilterCompany(paramCompany); }, [paramCompany]);

  const changeCompanyFilter = (value: string) => {
    setFilterCompany(value);
    setSearchParams(value ? { company: value } : {}, { replace: true });
  };

  const searchTerm = search.trim().toLowerCase();
  const filtered = list
    .filter(c => {
      const matchesSearch = !searchTerm || [
        c.first_name, c.last_name, c.email, c.company_name,
        c.phone_direct, c.phone_mobile, c.wechat_id, c.company_phone, c.company_email,
      ].some(value => String(value || '').toLowerCase().includes(searchTerm));
      return matchesSearch;
    })
    .sort((a, b) => `${a.first_name || ''} ${a.last_name || ''}`.localeCompare(`${b.first_name || ''} ${b.last_name || ''}`));
  const pageCount = Math.max(1, Math.ceil(filtered.length / CONTACTS_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice(
    (currentPage - 1) * CONTACTS_PAGE_SIZE,
    currentPage * CONTACTS_PAGE_SIZE,
  );
  const newContactCompanyId = filterCompany || allCompanies[0]?.id;

  useEffect(() => {
    setPage(1);
  }, [search, filterCompany]);

  useEffect(() => {
    setPage(current => Math.min(current, pageCount));
  }, [pageCount]);

  const remove = async () => {
    if (!deleteTarget?.id || deleting) return;
    setDeleting(true);
    try {
      await contacts.delete(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  };

  const renderMobileContact = (c: any) => {
    const phone = c.phone_mobile || c.phone_direct || c.company_phone;
    const email = c.email || c.company_email;
    const phoneFromCompany = !c.phone_mobile && !c.phone_direct && !!c.company_phone;
    const emailFromCompany = !c.email && !!c.company_email;
    const isPrimaryContact = Boolean(c.is_primary_contact);
    const isDecisionMaker = Boolean(c.is_decision_maker);

    return (
      <article key={c.id} className="rounded-md border border-border bg-surface p-3">
        <div className="flex items-start gap-2.5">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
            onClick={() => setContactPanel({ companyId: c.company_id, contact: c })}
          >
            <span className="flex size-8 flex-shrink-0 items-center justify-center rounded-md bg-brand-soft text-xs font-medium text-brand">
              {c.first_name?.[0]}{c.last_name?.[0]}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">{c.first_name} {c.last_name}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-ink-subtle">
                <span>{c.job_title || (c.role_in_process ? t(`page.contacts.roles.${c.role_in_process}`) : '—')}</span>
                {isPrimaryContact && <span className="badge-blue" title={t('page.contacts.primaryContact')}>{t('page.contacts.primaryBadge')}</span>}
                {isDecisionMaker && <span className="badge-yellow" title={t('page.contacts.decisionMaker')}>{t('page.contacts.decisionBadge')}</span>}
              </span>
            </span>
          </button>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === c.id ? null : c.id)}
              className="icon-btn"
              aria-label={t('common.moreActions')}
              title={t('common.moreActions')}
            >
              <Icon name="more" size={16} />
            </button>
            {openMenu === c.id && (
              <div className="menu-surface absolute right-0 top-full z-20 mt-1 w-36">
                <button onClick={() => { setOpenMenu(null); setContactPanel({ companyId: c.company_id, contact: c }); }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-ink-muted hover:bg-surface-hover">
                  <Icon name="square-pen" size={13} />{t('common.edit')}
                </button>
                <button onClick={() => { setDeleteTarget(c); setOpenMenu(null); }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-danger hover:bg-danger-soft">
                  <Icon name="delete" size={13} />{t('common.delete')}
                </button>
              </div>
            )}
          </div>
        </div>
        {c.company_name ? (
          <Link
            to={`/companies/${c.company_id}`}
            className="mt-3 block truncate border-t border-border pt-2 text-xs text-brand hover:underline"
          >
            {c.company_name}
          </Link>
        ) : null}
        <div className="mt-2 space-y-1 text-xs text-ink-muted">
          {phone ? (
            <a className="block truncate hover:text-brand" href={`tel:${phone}`}>
              {phone}
              {phoneFromCompany ? <span className="ml-1 text-2xs text-ink-subtle">· {t('page.contacts.company')}</span> : null}
            </a>
          ) : null}
          {c.wechat_id ? <div className="truncate">{t('page.contacts.wechatShort')}: {c.wechat_id}</div> : null}
          {email ? (
            <a className="block truncate hover:text-brand" href={`mailto:${email}`}>
              {email}
              {emailFromCompany ? <span className="ml-1 text-2xs text-ink-subtle">· {t('page.contacts.company')}</span> : null}
            </a>
          ) : null}
          {!phone && !c.wechat_id && !email ? <span>—</span> : null}
        </div>
      </article>
    );
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="px-3">
          <h1 className="page-heading">{t('page.title.contacts')}</h1>
          <p className="page-summary tabular-nums">{filtered.length}{search || filterCompany ? ` / ${list.length}` : ''} {t('common.records')}</p>
        </div>
        <div className="page-actions px-3">
          {newContactCompanyId && (
            <button onClick={() => setContactPanel({ companyId: newContactCompanyId })} className="btn-primary btn-sm"><Icon name="plus" size={15} className="mr-1.5" />{t('common.new')}</button>
          )}
          <button onClick={() => exportFullCsv('/api/contacts', 'contacts')} className="btn-secondary btn-sm"><Icon name="download" size={14} className="mr-1" />CSV</button>
        </div>
      </div>

      <div className="toolbar gap-3">
        <div className="relative w-full max-w-sm">
          <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
          <label className="sr-only" htmlFor="contacts-search">{t('common.searchContacts')}</label>
            <input id="contacts-search" className="input h-10 w-full pl-9 md:h-8" placeholder={t('common.searchContacts')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <label className="sr-only" htmlFor="contacts-company-filter">{t('page.contacts.allCompanies')}</label>
            <select id="contacts-company-filter" className="input h-10 max-w-[200px] md:h-8" value={filterCompany} onChange={e => changeCompanyFilter(e.target.value)}>
          <option value="">{t('page.contacts.allCompanies')}</option>
          {allCompanies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {companiesLoadError && (
        <div className="data-surface mb-3 p-3" role="alert">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-muted">{t('page.error.loadFailed')}</p>
            <button type="button" onClick={loadCompanies} className="btn-secondary btn-sm">
              <Icon name="refresh" size={14} className="mr-1.5" />
              {t('common.refresh')}
            </button>
          </div>
        </div>
      )}

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
        <div className="data-surface p-3" aria-label={t('common.loading')}>
          <div className="animate-pulse space-y-2">
            {[0, 1, 2, 3, 4].map(row => <div key={row} className="h-12 rounded bg-surface-hover" />)}
          </div>
        </div>
      ) : loadError ? (
        <div className="data-surface p-6" role="alert">
          <div className="empty-state">
            <p>{t('page.error.loadFailed')}</p>
            <button type="button" onClick={load} className="btn-secondary btn-sm mt-3">
              <Icon name="refresh" size={14} className="mr-1.5" />
              {t('common.refresh')}
            </button>
          </div>
        </div>
      ) : (
        <>
        <div className="space-y-2 md:hidden">
          {paged.map(renderMobileContact)}
          {filtered.length === 0 && (
            <div className="empty-state rounded-md border border-border bg-surface">
              <span>{t('noData.contacts')}</span>
              {newContactCompanyId && (
                <button onClick={() => setContactPanel({ companyId: newContactCompanyId })} className="btn-primary btn-sm">{t('page.contacts.newContact')}</button>
              )}
            </div>
          )}
          <Pagination
            page={currentPage}
            pageSize={CONTACTS_PAGE_SIZE}
            total={filtered.length}
            onPageChange={setPage}
          />
        </div>
        <div className="hidden data-surface overflow-x-auto md:block">
          <table className="w-full min-w-[680px] table-fixed">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-surface-subtle">
                <th className="table-header w-[25%]">{t('page.contacts.contact')}</th>
                <th className="table-header w-[24%]">{t('page.contacts.company')}</th>
                <th className="table-header w-[25%]">{t('page.contacts.phoneWechat')}</th>
                <th className="table-header hidden w-[24%] md:table-cell">{t('common.email')}</th>
                <th className="table-header w-12"></th>
              </tr>
            </thead>
            <tbody>
          {paged.map(c => {
            const phone = c.phone_mobile || c.phone_direct || c.company_phone;
            const email = c.email || c.company_email;
            const phoneFromCompany = !c.phone_mobile && !c.phone_direct && !!c.company_phone;
            const emailFromCompany = !c.email && !!c.company_email;
            const isPrimaryContact = Boolean(c.is_primary_contact);
            const isDecisionMaker = Boolean(c.is_decision_maker);

            return (
            <tr key={c.id} className="table-row" onClick={() => setContactPanel({ companyId: c.company_id, contact: c })}>
              <td className="table-cell">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex size-7 flex-shrink-0 items-center justify-center rounded-md bg-brand-soft text-xs font-medium text-brand">
                    {c.first_name?.[0]}{c.last_name?.[0]}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink">{c.first_name} {c.last_name}</div>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-2xs text-ink-subtle">
                      <span className="truncate">
                        {c.job_title || (c.role_in_process ? t(`page.contacts.roles.${c.role_in_process}`) : '—')}
                      </span>
                      {isPrimaryContact ? <span className="badge-blue shrink-0" title={t('page.contacts.primaryContact')}>{t('page.contacts.primaryBadge')}</span> : null}
                      {isDecisionMaker ? <span className="badge-yellow shrink-0" title={t('page.contacts.decisionMaker')}>{t('page.contacts.decisionBadge')}</span> : null}
                    </div>
                  </div>
                </div>
              </td>
              <td className="table-cell">
                {c.company_name ? (
                  <Link
                    to={`/companies/${c.company_id}`}
                    onClick={e => e.stopPropagation()}
                    className="block truncate text-brand hover:underline"
                  >
                    {c.company_name}
                  </Link>
                ) : '—'}
              </td>
              <td className="table-cell text-xs">
                <div className="space-y-0.5 truncate">
                  {c.wechat_id ? <div className="truncate">{t('page.contacts.wechatShort')}: {c.wechat_id}</div> : null}
                  {phone ? (
                    <div className="truncate text-ink-muted">
                      {phone}
                      {phoneFromCompany ? <span className="ml-1 text-2xs text-ink-subtle">· {t('page.contacts.company')}</span> : null}
                    </div>
                  ) : null}
                  {!c.wechat_id && !phone ? '—' : null}
                </div>
              </td>
              <td className="table-cell hidden truncate text-xs md:table-cell">
                {email || '—'}
                {emailFromCompany ? <span className="ml-1 text-2xs text-ink-subtle">· {t('page.contacts.company')}</span> : null}
              </td>
              <td className="table-cell" onClick={e => e.stopPropagation()}>
                <div className="relative">
                  <button
                    onClick={() => setOpenMenu(openMenu === c.id ? null : c.id)}
                    className="icon-btn"
                    aria-label={t('common.moreActions')}
                    title={t('common.moreActions')}
                  >
                    <Icon name="more" size={16} />
                  </button>
                  {openMenu === c.id && (
                    <div className="menu-surface absolute right-0 top-full mt-1 w-36">
                      <button onClick={() => { setOpenMenu(null); setContactPanel({ companyId: c.company_id, contact: c }); }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-ink-muted hover:bg-surface-hover">
                        <Icon name="square-pen" size={13} />{t('common.edit')}
                      </button>
                      <button onClick={() => {
                        setDeleteTarget(c);
                        setOpenMenu(null);
                      }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-danger hover:bg-danger-soft">
                        <Icon name="delete" size={13} />{t('common.delete')}
                      </button>
                    </div>
                  )}
                </div>
              </td>
            </tr>
            );
          })}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7}>
                <div className="empty-state">
                  <span>{t('noData.contacts')}</span>
                  {newContactCompanyId && (
                    <button onClick={() => setContactPanel({ companyId: newContactCompanyId })} className="btn-primary btn-sm">{t('page.contacts.newContact')}</button>
                  )}
                </div>
              </td>
            </tr>
          )}
          </tbody>
          </table>
          <Pagination
            page={currentPage}
            pageSize={CONTACTS_PAGE_SIZE}
            total={filtered.length}
            onPageChange={setPage}
          />
        </div>
        </>
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        title={t('common.delete')}
        description={<>{t('common.confirmDelete')} <strong>{`${deleteTarget?.first_name || ''} ${deleteTarget?.last_name || ''}`.trim()}</strong></>}
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
