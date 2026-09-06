import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import { CountryProvider } from '../../context/CountryContext';
import { SocketProvider } from '../../context/SocketContext';

// Expert Components
import { ExpertHeader } from './ExpertHeader';
import { ExpertAuthPage } from './ExpertAuthPage';
import { ExpertProtectedRoute } from './ExpertProtectedRoute';

// Shared Pages
import { ExpertDashboardPage } from '../../pages/ExpertDashboardPage';
import { ExpertOnboardingPage } from '../../pages/ExpertOnboardingPage';
import { AppointmentsPage } from '../../pages/AppointmentsPage';
import { ChatsListPage } from '../../pages/ChatsListPage';
import { ChatPage } from '../../pages/ChatPage';
import { CallHistoryPage } from '../../pages/CallHistoryPage';
import { ExpertEarningsPage } from '../../pages/ExpertEarningsPage';
import { ProfilePage } from '../../pages/ProfilePage';
import { NotificationsPage } from '../../pages/NotificationsPage';
import { ExpertAvailabilityPage } from '../../pages/ExpertAvailabilityPage';

// Call & Consultation Modals (Required for receiving incoming calls & chats)
import { IncomingCallModal } from '../../components/call/IncomingCallModal';
import { IncomingChatModal } from '../../components/call/IncomingChatModal';
import { ActiveCallModal } from '../../components/call/ActiveCallModal';
import { ReviewModal } from '../../components/cards/ReviewModal';

export const ExpertApp: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CountryProvider>
          <SocketProvider>
            <div data-app="propertytalk-expert" className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
              {/* Expert Portal Header */}
              <ExpertHeader />

              {/* Main Content */}
              <main className="flex-1">
                <Routes>
                  {/* Public Auth Routes */}
                  <Route path="/login" element={<ExpertAuthPage />} />
                  <Route path="/register" element={<ExpertAuthPage />} />

                  {/* Protected Expert Routes */}
                  <Route
                    path="/dashboard"
                    element={
                      <ExpertProtectedRoute>
                        <ExpertDashboardPage />
                      </ExpertProtectedRoute>
                    }
                  />
                  <Route
                    path="/onboarding"
                    element={
                      <ExpertProtectedRoute>
                        <ExpertOnboardingPage />
                      </ExpertProtectedRoute>
                    }
                  />
                  <Route
                    path="/appointments"
                    element={
                      <ExpertProtectedRoute>
                        <AppointmentsPage />
                      </ExpertProtectedRoute>
                    }
                  />
                  <Route
                    path="/availability"
                    element={
                      <ExpertProtectedRoute>
                        <ExpertAvailabilityPage />
                      </ExpertProtectedRoute>
                    }
                  />
                  <Route
                    path="/chats"
                    element={
                      <ExpertProtectedRoute>
                        <ChatsListPage />
                      </ExpertProtectedRoute>
                    }
                  />
                  <Route
                    path="/chat/:chatId"
                    element={
                      <ExpertProtectedRoute>
                        <ChatPage />
                      </ExpertProtectedRoute>
                    }
                  />
                  <Route
                    path="/calls"
                    element={
                      <ExpertProtectedRoute>
                        <CallHistoryPage />
                      </ExpertProtectedRoute>
                    }
                  />
                  <Route
                    path="/earnings"
                    element={
                      <ExpertProtectedRoute>
                        <ExpertEarningsPage />
                      </ExpertProtectedRoute>
                    }
                  />
                  <Route
                    path="/consultation-history"
                    element={
                      <ExpertProtectedRoute>
                        <ExpertEarningsPage />
                      </ExpertProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <ExpertProtectedRoute>
                        <ProfilePage />
                      </ExpertProtectedRoute>
                    }
                  />
                  <Route
                    path="/notifications"
                    element={
                      <ExpertProtectedRoute>
                        <NotificationsPage />
                      </ExpertProtectedRoute>
                    }
                  />

                  {/* Default / Fallback Routes */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/admin/*" element={<Navigate to="/dashboard" replace />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </main>

              {/* Call & Chat Modals */}
              <IncomingCallModal />
              <IncomingChatModal />
              <ActiveCallModal />
              <ReviewModal />
            </div>
          </SocketProvider>
        </CountryProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default ExpertApp;
