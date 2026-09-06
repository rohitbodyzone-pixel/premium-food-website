import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider } from './AdminAuthContext';
import { AdminLayout } from './AdminLayout';
import { AdminAuthPage } from './AdminAuthPage';
import { AdminProtectedRoute } from './AdminProtectedRoute';

// 13 Super Admin Views
import { DashboardView } from './pages/DashboardView';
import { VerificationView } from './pages/VerificationView';
import { ExpertsView } from './pages/ExpertsView';
import { CustomersView } from './pages/CustomersView';
import { CategoriesView } from './pages/CategoriesView';
import { LocationsView } from './pages/LocationsView';
import { ConsultationsView } from './pages/ConsultationsView';
import { AppointmentsView } from './pages/AppointmentsView';
import { ReviewsView } from './pages/ReviewsView';
import { PaymentsView } from './pages/PaymentsView';
import { SettingsView } from './pages/SettingsView';
import { RegistersView } from './pages/RegistersView';
import { SystemStatusView } from './pages/SystemStatusView';
import { AuditLogsView } from './pages/AuditLogsView';
import { NotificationLogsView } from './pages/NotificationLogsView';

export const AdminApp: React.FC = () => {
  return (
    <div data-app="propertytalk-super-admin" className="min-h-screen bg-slate-950 font-sans text-slate-100">
      <BrowserRouter>
        <AdminAuthProvider>
          <Routes>
            {/* Public Admin Sign In */}
            <Route path="/login" element={<AdminAuthPage />} />

            {/* Protected Admin Console Layout */}
            <Route
              element={
                <AdminProtectedRoute>
                  <AdminLayout />
                </AdminProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardView />} />
              <Route path="/verification" element={<VerificationView />} />
              <Route path="/experts" element={<ExpertsView />} />
              <Route path="/customers" element={<CustomersView />} />
              <Route path="/categories" element={<CategoriesView />} />
              <Route path="/locations" element={<LocationsView />} />
              <Route path="/consultations" element={<ConsultationsView />} />
              <Route path="/appointments" element={<AppointmentsView />} />
              <Route path="/reviews" element={<ReviewsView />} />
              <Route path="/payments" element={<PaymentsView />} />
              <Route path="/settings" element={<SettingsView />} />
              <Route path="/registers" element={<RegistersView />} />
              <Route path="/system" element={<SystemStatusView />} />
              <Route path="/audit-logs" element={<AuditLogsView />} />
              <Route path="/notifications" element={<NotificationLogsView />} />
            </Route>

            {/* Default / Fallback Navigation */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AdminAuthProvider>
      </BrowserRouter>
    </div>
  );
};

export default AdminApp;
