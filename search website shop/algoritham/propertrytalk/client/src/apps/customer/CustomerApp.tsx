import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import { CountryProvider } from '../../context/CountryContext';
import { SocketProvider } from '../../context/SocketContext';

// Customer Components
import { CustomerHeader } from './CustomerHeader';
import { CustomerMobileNav } from './CustomerMobileNav';
import { CustomerAuthPage } from './CustomerAuthPage';
import { ProtectedRoute } from '../../components/common/ProtectedRoute';

// Global Modals
import { CountryModal } from '../../components/common/CountryModal';
import { IncomingCallModal } from '../../components/call/IncomingCallModal';
import { ActiveCallModal } from '../../components/call/ActiveCallModal';
import { ReviewModal } from '../../components/cards/ReviewModal';

// Shared Pages
import { HomePage } from '../../pages/HomePage';
import { CountrySelectPage } from '../../pages/CountrySelectPage';
import { ExpertDirectoryPage } from '../../pages/ExpertDirectoryPage';
import { ExpertProfilePage } from '../../pages/ExpertProfilePage';
import { ChatPage } from '../../pages/ChatPage';
import { ChatsListPage } from '../../pages/ChatsListPage';
import { AppointmentsPage } from '../../pages/AppointmentsPage';
import { CustomerDashboardPage } from '../../pages/CustomerDashboardPage';
import { ProfilePage } from '../../pages/ProfilePage';
import { ConsultationHistoryPage } from '../../pages/ConsultationHistoryPage';
import { CallHistoryPage } from '../../pages/CallHistoryPage';
import { WalletPage } from '../../pages/WalletPage';
import { SupportPage } from '../../pages/SupportPage';
import { SavedExpertsPage } from '../../pages/SavedExpertsPage';
import { NotificationsPage } from '../../pages/NotificationsPage';

export const CustomerApp: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CountryProvider>
          <SocketProvider>
            <div data-app="propertytalk-customer" className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
              {/* Customer Header - No expert toggle or admin nav */}
              <CustomerHeader />

              {/* Page Content */}
              <main className="flex-1">
                <Routes>
                  {/* Public Browsing Routes */}
                  <Route path="/" element={<HomePage />} />
                  <Route path="/select-country" element={<CountrySelectPage />} />
                  <Route path="/experts" element={<ExpertDirectoryPage />} />
                  <Route path="/experts/:id" element={<ExpertProfilePage />} />
                  <Route path="/support" element={<SupportPage />} />
                  <Route path="/auth" element={<CustomerAuthPage />} />

                  {/* Customer Authenticated Routes */}
                  <Route
                    path="/chat/:chatId"
                    element={
                      <ProtectedRoute>
                        <ChatPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/chats"
                    element={
                      <ProtectedRoute>
                        <ChatsListPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/calls"
                    element={
                      <ProtectedRoute>
                        <CallHistoryPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/appointments"
                    element={
                      <ProtectedRoute>
                        <AppointmentsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <ProfilePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/consultation-history"
                    element={
                      <ProtectedRoute>
                        <ConsultationHistoryPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/wallet"
                    element={
                      <ProtectedRoute>
                        <WalletPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/saved-experts"
                    element={
                      <ProtectedRoute>
                        <SavedExpertsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/notifications"
                    element={
                      <ProtectedRoute>
                        <NotificationsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute allowedRoles={['CONSUMER']}>
                        <CustomerDashboardPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Redirections for expert/admin routes to keep Customer App clean */}
                  <Route path="/expert/*" element={<Navigate to="/" replace />} />
                  <Route path="/admin/*" element={<Navigate to="/" replace />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>

              {/* Mobile Bottom Navigation */}
              <CustomerMobileNav />

              {/* Global Modals */}
              <CountryModal />
              <IncomingCallModal />
              <ActiveCallModal />
              <ReviewModal />
            </div>
          </SocketProvider>
        </CountryProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default CustomerApp;
