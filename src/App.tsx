import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from './lib/toast';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import CompanyDetail from './pages/CompanyDetail';
import Contacts from './pages/Contacts';
import Inquiries from './pages/Inquiries';
import InquiryNew from './pages/InquiryNew';
import InquiryDetail from './pages/InquiryDetail';
import Quotations from './pages/Quotations';
import QuotationDetail from './pages/QuotationDetail';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Shipments from './pages/Shipments';
import ShipmentDetail from './pages/ShipmentDetail';
import Payments from './pages/Payments';
import InventoryPage from './pages/InventoryPage';
import Activities from './pages/Activities';
import Tasks from './pages/Tasks';
import Pipeline from './pages/Pipeline';
import SettingsProfile from './pages/SettingsProfile';

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <>
      <Toaster position="top-right" toastOptions={{ duration: 3000, style: { fontSize: '13px' } }} />
      <div className="h-screen flex overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Pipeline />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/companies" element={<Companies />} />
              <Route path="/companies/:id" element={<CompanyDetail />} />
              <Route path="/contacts" element={<Contacts />} />
              <Route path="/inquiries" element={<Inquiries />} />
              <Route path="/inquiries/new" element={<InquiryNew />} />
              <Route path="/inquiries/:id" element={<InquiryDetail />} />
              <Route path="/quotations" element={<Quotations />} />
              <Route path="/quotations/:id" element={<QuotationDetail />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/shipments" element={<Shipments />} />
              <Route path="/shipments/:id" element={<ShipmentDetail />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/activities" element={<Activities />} />
              <Route path="/tasks" element={<Tasks />} />
            <Route path="/settings/profile" element={<SettingsProfile />} />
            </Routes>
          </main>
        </div>
      </div>
    </>
  );
}
