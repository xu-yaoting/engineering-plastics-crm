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
  { section: 'nav.sales', items: [
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
  { section: 'nav.workspace', items: [
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
        {!collapsed && <span className="text-base font-medium text-gray-900">Basepoint</span>}
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map(group => (
          <div key={group.section}>
            {!collapsed && (
              <div className="px-4 pt-4 pb-1 text-2xs font-450 text-gray-500 tracking-[0.08em] uppercase">
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
                        ? 'bg-blue-50 text-blue-600 font-450'
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
    <img
      src="/basepoint-logo.svg"
      alt="Basepoint"
      className="w-8 h-8 rounded-full flex-shrink-0 object-cover"
    />
  );
}
