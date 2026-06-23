import { NavLink } from 'react-router-dom';
import { CircleDot, LayoutDashboard, Workflow, Building2, Users, Inbox, FileText, Package, Truck, Warehouse, Wallet, History, CheckSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import UserMenu from '../shared/UserMenu';

const iconMap: Record<string, React.ComponentType<any>> = {
  'circle-dot': CircleDot,
  'layout-dashboard': LayoutDashboard,
  'workflow': Workflow,
  'building': Building2,
  'users': Users,
  'inbox': Inbox,
  'file-text': FileText,
  'package': Package,
  'truck': Truck,
  'warehouse': Warehouse,
  'wallet': Wallet,
  'history': History,
  'check-square': CheckSquare,
};

const navItems: { section: string; items: { label: string; path: string; icon: string }[] }[] = [
  { section: '', items: [
    { label: 'nav.workspace', path: '/dashboard', icon: 'layout-dashboard' },
    { label: 'nav.pipeline', path: '/', icon: 'workflow' },
  ]},
  { section: 'Sales', items: [
    { label: 'nav.companies', path: '/companies', icon: 'building' },
    { label: 'nav.contacts', path: '/contacts', icon: 'users' },
    { label: 'nav.inquiries', path: '/inquiries', icon: 'inbox' },
    { label: 'nav.quotations', path: '/quotations', icon: 'file-text' },
  ]},
  { section: 'nav.fulfillment', items: [
    { label: 'nav.orders', path: '/orders', icon: 'package' },
    { label: 'nav.shipments', path: '/shipments', icon: 'truck' },
    { label: 'nav.inventory', path: '/inventory', icon: 'warehouse' },
    { label: 'nav.payments', path: '/payments', icon: 'wallet' },
  ]},
  { section: 'Workspace', items: [
    { label: 'nav.activities', path: '/activities', icon: 'history' },
    { label: 'nav.tasks', path: '/tasks', icon: 'check-square' },
  ]},
];

export default function Sidebar({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();

  return (
    <aside className={`${collapsed ? 'w-14' : 'w-60'} flex-shrink-0 bg-white border-r border-gray-200 flex flex-col transition-all duration-200`}>
      <div className={`h-14 flex items-center border-b border-gray-200 ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'}`}>
        <BasepointLogo />
        {!collapsed && <span className="text-base font-semibold text-gray-900 tracking-tight">Basepoint</span>}
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map(group => (
          <div key={group.section}>
            {!collapsed && (
              <div className="px-4 pt-4 pb-1 text-[11px] font-semibold text-gray-500 tracking-[0.06em] uppercase">
                {t(group.section)}
              </div>
            )}
            {group.items.map(item => {
              const LucideIcon = iconMap[item.icon] || LayoutDashboard;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex items-center justify-center gap-3 ${collapsed ? 'px-0' : 'mx-2 px-3'} py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 font-semibold'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
                  <LucideIcon size={18} strokeWidth={1.75} className="flex-shrink-0" />
                  {!collapsed && <span className="flex-1 truncate">{t(item.label)}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <UserMenu collapsed={collapsed} />
    </aside>
  );
}

function BasepointLogo() {
  return (
    <div
      className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)]"
      aria-label="Basepoint"
    >
      <svg viewBox="0 0 32 32" className="w-7 h-7" role="img" aria-hidden="true">
        <circle cx="16" cy="16" r="11.55" fill="none" stroke="white" strokeWidth="2.05" />
        <path
          d="M11.65 20.15V12.35C11.65 9.75 13.25 8.75 16.15 8.75H17.95C21.65 8.75 23.1 10.65 22.72 13.65C22.33 16.78 20.35 17.72 17.45 17.85C16.15 17.92 15.28 18.75 15.18 19.88C15.05 21.18 16.05 21.72 17.25 21.2C18.82 20.52 19.92 19.08 20.35 17.12C22.88 18.2 23.55 21.58 21.25 23.15C19.78 24.15 17.42 24.35 15.25 24.12C12.68 23.85 11.65 22.55 11.65 20.15Z"
          fill="none"
          stroke="white"
          strokeWidth="2.65"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20.72 16.88C18.88 17.1 17.42 18.02 16.9 19.28C16.46 20.35 17.08 21.15 18.2 20.92C19.72 20.6 20.58 19.02 20.72 16.88Z"
          fill="white"
        />
        <path
          d="M17.74 19.82C18.48 18.93 19.25 18.42 20.22 18.1"
          fill="none"
          stroke="#2563EB"
          strokeWidth="0.82"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
