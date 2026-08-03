import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { contacts, companies } from '../lib/api';
import ContactPanel from '../components/contacts/ContactPanel';
import ConfirmDialog from '../components/shared/ConfirmDialog';
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
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    contacts.list(filterCompany || undefined).then(setList).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [filterCompany]);
  useEffect(() => { companies.list().then(setAllCompanies); }, []);

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
      <article key={c.id} className="rounded-md border border-gray-200 bg-white p-3">
        <div className="flex items-start gap-2.5">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
            onClick={() => setContactPanel({ companyId: c.company_id, contact: c })}
          >
            <span className="flex size-8 flex-shrink-0 items-center justify-center rounded-md bg-blue-50 text-xs font-medium text-blue-600">
              {c.first_name?.[0]}{c.last_name?.[0]}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-gray-900">{c.first_name} {c.last_name}</span>
              <span className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-2xs text-gray-400">
                <span>{c.job_title || (c.role_in_process ? t(`page.contacts.roles.${c.role_in_process}`) : '—')}</span>
                {isPrimaryContact && <span>{t('page.contacts.primaryContact')}</span>}
                {isDecisionMaker && <span>{t('page.contacts.decisionMaker')}</span>}
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
                <button onClick={() => { setOpenMenu(null); setContactPanel({ companyId: c.company_id, contact: c }); }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                  <Icon name="square-pen" size={13} />{t('common.edit')}
                </button>
                <button onClick={() => { setDeleteTarget(c); setOpenMenu(null); }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
                  <Icon name="delete" size={13} />{t('common.delete')}
                </button>
              </div>
            )}
          </div>
        </div>
        {c.company_name ? (
          <Link
            to={`/companies/${c.company_id}`}
            className="mt-3 block truncate border-t border-gray-100 pt-2 text-xs text-blue-600 hover:underline"
          >
            {c.company_name}
          </Link>
        ) : null}
        <div className="mt-2 space-y-1 text-xs text-gray-500">
          {phone ? (
            <a className="block truncate hover:text-blue-600" href={`tel:${phone}`}>
              {phone}
              {phoneFromCompany ? <span className="ml-1 text-2xs text-gray-400">· {t('page.contacts.company')}</span> : null}
            </a>
          ) : null}
          {c.wechat_id ? <div className="truncate">{t('page.contacts.wechatShort')}: {c.wechat_id}</div> : null}
          {email ? (
            <a className="block truncate hover:text-blue-600" href={`mailto:${email}`}>
              {email}
              {emailFromCompany ? <span className="ml-1 text-2xs text-gray-400">· {t('page.contacts.company')}</span> : null}
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
        <div>
          <h1 className="page-heading">{t('page.title.contacts')}</h1>
          <p className="page-summary tabular-nums">{filtered.length} / {list.length} {t('page.title.contacts')}</p>
        </div>
        <div className="page-actions">
          {allCompanies.length > 0 && (
            <button onClick={() => setContactPanel({ companyId: allCompanies[0].id })} className="btn-primary btn-sm"><Icon name="plus" size={15} className="mr-1.5" />{t('common.new')}</button>
          )}
          <button onClick={() => exportFullCsv('/api/contacts', 'contacts')} className="btn-secondary btn-sm"><Icon name="download" size={14} className="mr-1" />CSV</button>
        </div>
      </div>

      <div className="toolbar gap-3">
        <div className="relative w-full max-w-sm">
          <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <label className="sr-only" htmlFor="contacts-search">{t('common.searchContacts')}</label>
            <input id="contacts-search" className="input h-10 w-full pl-9 md:h-8" placeholder={t('common.searchContacts')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <label className="sr-only" htmlFor="contacts-company-filter">{t('page.contacts.allCompanies')}</label>
            <select id="contacts-company-filter" className="input h-10 max-w-[200px] md:h-8" value={filterCompany} onChange={e => setFilterCompany(e.target.value)}>
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
        <div className="data-surface p-3" aria-label={t('common.loading')}>
          <div className="animate-pulse space-y-2">
            {[0, 1, 2, 3, 4].map(row => <div key={row} className="h-12 rounded bg-gray-100" />)}
          </div>
        </div>
      ) : (
        <>
        <div className="space-y-2 md:hidden">
          {filtered.map(renderMobileContact)}
          {filtered.length === 0 && (
            <div className="empty-state rounded-md border border-gray-200 bg-white">
              <span>{t('noData.contacts')}</span>
              {allCompanies.length > 0 && (
                <button onClick={() => setContactPanel({ companyId: allCompanies[0].id })} className="btn-primary btn-sm">{t('page.contacts.newContact')}</button>
              )}
            </div>
          )}
        </div>
        <div className="hidden data-surface overflow-x-auto md:block">
          <table className="w-full min-w-[680px] table-fixed">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="table-header w-[25%]">{t('page.contacts.contact')}</th>
                <th className="table-header w-[24%]">{t('page.contacts.company')}</th>
                <th className="table-header w-[25%]">{t('page.contacts.phoneWechat')}</th>
                <th className="table-header hidden w-[24%] md:table-cell">{t('common.email')}</th>
                <th className="table-header w-12"></th>
              </tr>
            </thead>
            <tbody>
          {filtered.map(c => {
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
                  <span className="flex size-7 flex-shrink-0 items-center justify-center rounded-md bg-blue-50 text-xs font-medium text-blue-600">
                    {c.first_name?.[0]}{c.last_name?.[0]}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-gray-900">{c.first_name} {c.last_name}</div>
                    <div className="mt-0.5 flex min-w-0 gap-2 text-2xs text-gray-400">
                      <span className="truncate">
                        {c.job_title || (c.role_in_process ? t(`page.contacts.roles.${c.role_in_process}`) : '—')}
                      </span>
                      {(isPrimaryContact || isDecisionMaker) && (
                        <>
                        {isPrimaryContact ? <span>{t('page.contacts.primaryContact')}</span> : null}
                        {isDecisionMaker ? <span>{t('page.contacts.decisionMaker')}</span> : null}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </td>
              <td className="table-cell">
                {c.company_name ? (
                  <Link
                    to={`/companies/${c.company_id}`}
                    onClick={e => e.stopPropagation()}
                    className="block truncate text-blue-600 hover:underline"
                  >
                    {c.company_name}
                  </Link>
                ) : '—'}
              </td>
              <td className="table-cell text-xs">
                <div className="space-y-0.5 truncate">
                  {c.wechat_id ? <div className="truncate">{t('page.contacts.wechatShort')}: {c.wechat_id}</div> : null}
                  {phone ? (
                    <div className="truncate text-gray-500">
                      {phone}
                      {phoneFromCompany ? <span className="ml-1 text-2xs text-gray-400">· {t('page.contacts.company')}</span> : null}
                    </div>
                  ) : null}
                  {!c.wechat_id && !phone ? '—' : null}
                </div>
              </td>
              <td className="table-cell hidden truncate text-xs md:table-cell">
                {email || '—'}
                {emailFromCompany ? <span className="ml-1 text-2xs text-gray-400">· {t('page.contacts.company')}</span> : null}
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
                      <button onClick={() => { setOpenMenu(null); setContactPanel({ companyId: c.company_id, contact: c }); }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                        <Icon name="square-pen" size={13} />{t('common.edit')}
                      </button>
                      <button onClick={() => {
                        setDeleteTarget(c);
                        setOpenMenu(null);
                      }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
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
                  {allCompanies.length > 0 && (
                    <button onClick={() => setContactPanel({ companyId: allCompanies[0].id })} className="btn-primary btn-sm">{t('page.contacts.newContact')}</button>
                  )}
                </div>
              </td>
            </tr>
          )}
            </tbody>
          </table>
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
