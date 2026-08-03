import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface CompanyModuleNavProps {
  children: ReactNode;
}

const links = [
  {
    to: '/companies',
    label: 'page.customerDevelopment.companyList',
    end: true,
  },
  {
    to: '/companies/follow-ups',
    label: 'page.customerDevelopment.workbench',
  },
  {
    to: '/companies/contacts',
    label: 'page.customerDevelopment.contactDirectory',
  },
];

export default function CompanyModuleNav({ children }: CompanyModuleNavProps) {
  const { t } = useTranslation();

  return (
    <>
      <nav aria-label={t('nav.companies')} className="overflow-x-auto border-b border-gray-200 bg-white px-5 sm:px-6">
        <div className="flex min-w-max gap-6">
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `border-b-2 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800'
                }`
              }
            >
              {t(link.label)}
            </NavLink>
          ))}
        </div>
      </nav>
      {children}
    </>
  );
}
