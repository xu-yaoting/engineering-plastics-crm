import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Toaster } from './lib/toast';
import { useAuth } from './lib/auth';
import { useMediaQuery } from './lib/useMediaQuery';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Companies = lazy(() => import('./pages/Companies'));
const CompanyDetail = lazy(() => import('./pages/CompanyDetail'));
const Contacts = lazy(() => import('./pages/Contacts'));
const FollowUpWorkbench = lazy(() => import('./pages/FollowUpWorkbench'));
const Quotations = lazy(() => import('./pages/Quotations'));
const QuotationDetail = lazy(() => import('./pages/QuotationDetail'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));
const Shipments = lazy(() => import('./pages/Shipments'));
const ShipmentDetail = lazy(() => import('./pages/ShipmentDetail'));
const Payments = lazy(() => import('./pages/Payments'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const MaterialsToolingPage = lazy(() => import('./pages/MaterialsToolingPage'));
const Activities = lazy(() => import('./pages/Activities'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Pipeline = lazy(() => import('./pages/Pipeline'));
const SettingsProfile = lazy(() => import('./pages/SettingsProfile'));

function RouteLoadingFallback() {
  const { t } = useTranslation();

  return (
    <div role="status" aria-label={t('common.loading')} className="page-shell">
      <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
        <div className="h-7 w-40 rounded-md bg-border-strong" />
        <div className="mt-3 h-3 w-64 max-w-full rounded bg-surface-hover" />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 rounded-lg border border-border bg-surface p-4">
              <div className="h-3 w-24 rounded bg-surface-hover" />
              <div className="mt-5 h-7 w-20 rounded bg-border-strong" />
            </div>
          ))}
        </div>
        <div className="mt-5 h-64 rounded-lg border border-border bg-surface" />
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileSidebarOpen(false);
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [mobileSidebarOpen]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileSidebarOpen]);

  const toggleNavigation = () => {
    if (isMobile) {
      setMobileSidebarOpen(open => !open);
      return;
    }

    setSidebarCollapsed(collapsed => !collapsed);
  };

  if (loading) {
    return (
      <div
        role="status"
        aria-label={t('common.loading')}
        className="flex h-dvh overflow-hidden bg-canvas"
      >
        <div aria-hidden="true" className="flex min-w-0 flex-1 animate-pulse motion-reduce:animate-none">
          <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface p-4 sm:flex">
            <div className="h-8 w-32 rounded-md bg-border-strong" />
            <div className="mt-8 space-y-3">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="h-8 rounded-md bg-surface-hover" />
              ))}
            </div>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-5">
              <div className="h-7 w-7 rounded-md bg-border-strong" />
              <div className="h-8 w-28 rounded-md bg-surface-hover" />
            </header>
            <main className="flex-1 p-5">
              <div className="h-7 w-40 rounded-md bg-border-strong" />
              <div className="mt-3 h-3 w-64 max-w-full rounded bg-surface-hover" />
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-28 rounded-lg border border-border bg-surface p-4">
                    <div className="h-3 w-24 rounded bg-surface-hover" />
                    <div className="mt-5 h-7 w-20 rounded bg-border-strong" />
                  </div>
                ))}
              </div>
              <div className="mt-5 h-64 rounded-lg border border-border bg-surface" />
            </main>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <>
      <Toaster position="top-right" toastOptions={{ duration: 3000, style: { fontSize: '13px' } }} />
      <div className="h-dvh flex overflow-hidden">
        <div className="hidden md:flex">
          <Sidebar collapsed={sidebarCollapsed} />
        </div>
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-50 md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.workspace')}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/35"
              aria-label={t('common.close')}
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="relative flex h-dvh w-[min(15rem,calc(100vw-3rem))] [&>aside]:w-full">
              <Sidebar collapsed={false} />
            </div>
          </div>
        )}
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar
            onToggleSidebar={toggleNavigation}
            navigationExpanded={isMobile ? mobileSidebarOpen : !sidebarCollapsed}
          />
          <main className="flex-1 overflow-y-auto">
            <Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
                <Route path="/" element={<Navigate to="/quotations" replace />} />
                <Route path="/pipeline" element={<Pipeline />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/companies" element={<Companies />} />
                <Route path="/companies/follow-ups" element={<FollowUpWorkbench />} />
                <Route path="/companies/contacts" element={<Contacts />} />
                <Route path="/companies/:id" element={<CompanyDetail />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/inquiries" element={<Navigate to="/quotations" replace />} />
                <Route path="/inquiries/new" element={<Navigate to="/quotations" replace />} />
                <Route path="/inquiries/:id" element={<Navigate to="/quotations" replace />} />
                <Route path="/quotations" element={<Quotations />} />
                <Route path="/quotations/:id" element={<QuotationDetail />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/orders/:id" element={<OrderDetail />} />
                <Route path="/shipments" element={<Shipments />} />
                <Route path="/shipments/:id" element={<ShipmentDetail />} />
                <Route path="/payments" element={<Payments />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/materials-tooling" element={<MaterialsToolingPage />} />
                <Route path="/activities" element={<Activities />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/settings/profile" element={<SettingsProfile />} />
                <Route path="*" element={<Navigate to="/quotations" replace />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </div>
    </>
  );
}
