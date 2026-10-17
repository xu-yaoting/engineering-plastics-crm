import { NavLink, useLocation } from 'react-router-dom';
import { CircleDot, LayoutDashboard, Workflow, Building2, CalendarClock, Inbox, FileText, Package, Truck, Warehouse, Wallet, History, CheckSquare, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import UserMenu from '../shared/UserMenu';

const iconMap: Record<string, React.ComponentType<any>> = {
  'circle-dot': CircleDot,
  'layout-dashboard': LayoutDashboard,
  'workflow': Workflow,
  'building': Building2,
  'calendar-clock': CalendarClock,
  'inbox': Inbox,
  'file-text': FileText,
  'package': Package,
  'truck': Truck,
  'warehouse': Warehouse,
  'wallet': Wallet,
  'history': History,
  'check-square': CheckSquare,
  'wrench': Wrench,
};

const navItems: { section: string; items: { label: string; path: string; icon: string }[] }[] = [
  { section: '', items: [
    { label: 'nav.workspace', path: '/dashboard', icon: 'layout-dashboard' },
    { label: 'nav.pipeline', path: '/pipeline', icon: 'workflow' },
  ]},
  { section: 'nav.sales', items: [
    { label: 'nav.companies', path: '/companies', icon: 'building' },
    { label: 'page.customerDevelopment.workbench', path: '/companies/follow-ups', icon: 'calendar-clock' },
    { label: 'nav.quotations', path: '/quotations', icon: 'file-text' },
  ]},
  { section: 'nav.fulfillment', items: [
    { label: 'nav.orders', path: '/orders', icon: 'package' },
    { label: 'nav.shipments', path: '/shipments', icon: 'truck' },
    { label: 'nav.payments', path: '/payments', icon: 'wallet' },
    { label: 'nav.inventory', path: '/inventory', icon: 'warehouse' },
    { label: 'nav.materialsTooling', path: '/materials-tooling', icon: 'wrench' },
  ]},
  { section: 'nav.workspace', items: [
    { label: 'nav.activities', path: '/activities', icon: 'history' },
    { label: 'nav.tasks', path: '/tasks', icon: 'check-square' },
  ]},
];

export default function Sidebar({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <aside className={`${collapsed ? 'w-14' : 'w-60'} flex-shrink-0 bg-surface border-r border-border flex flex-col transition-all duration-200`}>
      <div className={`h-14 flex items-center border-b border-border ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'}`}>
        <JekinLogo />
        {!collapsed && <span className="text-base font-semibold text-ink">JEKIN CRM</span>}
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map(group => (
          <div key={group.section}>
            {!collapsed && (
              <div className="section-label px-4 pb-1 pt-4">
                {t(group.section)}
              </div>
            )}
            {group.items.map(item => {
              const LucideIcon = iconMap[item.icon] || LayoutDashboard;
              const companySectionActive = item.path === '/companies'
                && location.pathname.startsWith('/companies/')
                && location.pathname !== '/companies/follow-ups';
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/' || item.path === '/companies'}
                  className={({ isActive }) =>
                    `flex items-center justify-center gap-3 ${collapsed ? 'px-0' : 'mx-2 px-3'} py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive || companySectionActive
                        ? 'bg-brand-soft text-brand font-450'
                        : 'text-ink-muted hover:bg-surface-hover'
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

function JekinLogo() {
  return (
    <img
      src="/jekin-logo.svg"
      alt="JEKIN CRM"
      className="w-8 h-8 rounded-full flex-shrink-0 object-cover"
    />
  );
}
