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

// Global Modals & Branding
import { CountryModal } from '../../components/common/CountryModal';
import { FirstUseCountryModal } from '../../components/common/FirstUseCountryModal';
import { SplashScreen } from '../../components/common/SplashScreen';
import { IncomingCallModal } from '../../components/call/IncomingCallModal';
import { ActiveCallModal } from '../../components/call/ActiveCallModal';
import { ReviewModal } from '../../components/cards/ReviewModal';

// Shared & Customer Pages
import { HomePage } from '../../pages/HomePage';
import { ExplorePage } from '../../pages/ExplorePage';
import { PropertyDetailPage } from '../../pages/PropertyDetailPage';
import { LiveViewingsPage } from '../../pages/LiveViewingsPage';
import { AgentMiniWebsitePage } from '../../pages/AgentMiniWebsitePage';
import { ArticleDetailPage } from '../../pages/ArticleDetailPage';
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
import { SavedPropertiesPage } from '../../pages/SavedPropertiesPage';
import { NotificationsPage } from '../../pages/NotificationsPage';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';

export const CustomerApp: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CountryProvider>
          <SocketProvider>
            <ErrorBoundary name="CustomerRoot">
              {/* Optional Splash Screen for First Visit in Session */}
              <SplashScreen />

              <div data-app="propertytalk-customer" className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
                {/* Customer Header - Clean customer navigation */}
                <CustomerHeader />

                {/* Page Content */}
                <main className="flex-1">
                  <ErrorBoundary name="CustomerRoutes">
                    <Routes>
                      {/* Public Browsing & Marketplace Routes */}
                      <Route path="/" element={<HomePage />} />
                      <Route path="/explore" element={<ExplorePage />} />
                      <Route path="/properties/:id" element={<PropertyDetailPage />} />
                      <Route path="/live-viewings" element={<LiveViewingsPage />} />
                      <Route path="/live-viewings/:id" element={<LiveViewingsPage />} />
                      <Route path="/agent/:slug" element={<AgentMiniWebsitePage />} />
                      <Route path="/articles/:id" element={<ArticleDetailPage />} />
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
                        path="/saved-properties"
                        element={
                          <ProtectedRoute>
                            <SavedPropertiesPage />
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
                  </ErrorBoundary>
                </main>

                {/* Mobile Bottom Navigation (5 Strict Tabs) */}
                <CustomerMobileNav />

                {/* Global Modals */}
                <ErrorBoundary name="CustomerModals">
                  <CountryModal />
                  <FirstUseCountryModal />
                  <IncomingCallModal />
                  <ActiveCallModal />
                  <ReviewModal />
                </ErrorBoundary>
              </div>
            </ErrorBoundary>
          </SocketProvider>
        </CountryProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default CustomerApp;
