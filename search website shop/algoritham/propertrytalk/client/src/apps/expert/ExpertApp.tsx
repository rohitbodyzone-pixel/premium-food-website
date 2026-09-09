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
import { ExpertAvailabilityPage } from '../../pages/ExpertAvailabilityPage';
import { ProfilePage } from '../../pages/ProfilePage';
import { NotificationsPage } from '../../pages/NotificationsPage';

// Real Estate Agent & Property Specialist Pages
import { AgentPropertiesPage } from './pages/AgentPropertiesPage';
import { AgentLiveViewingsPage } from './pages/AgentLiveViewingsPage';
import { AgentMiniWebsiteEditorPage } from './pages/AgentMiniWebsiteEditorPage';
import { AgentSeoArticlesPage } from './pages/AgentSeoArticlesPage';
import { AgentLeadsPage } from './pages/AgentLeadsPage';

// Call & Consultation Modals (Required for receiving incoming calls & chats)
import { IncomingCallModal } from '../../components/call/IncomingCallModal';
import { IncomingChatModal } from '../../components/call/IncomingChatModal';
import { ActiveCallModal } from '../../components/call/ActiveCallModal';
import { ReviewModal } from '../../components/cards/ReviewModal';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';

export const ExpertApp: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CountryProvider>
          <SocketProvider>
            <ErrorBoundary name="ExpertRoot">
              <div data-app="propertytalk-expert" className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
                {/* Expert Portal Header */}
                <ExpertHeader />

                {/* Main Content */}
                <main className="flex-1">
                  <ErrorBoundary name="ExpertRoutes">
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

                  {/* Real Estate Agent & Specialist Routes */}
                  <Route
                    path="/properties"
                    element={
                      <ExpertProtectedRoute>
                        <AgentPropertiesPage />
                      </ExpertProtectedRoute>
                    }
                  />
                  <Route
                    path="/live-viewings"
                    element={
                      <ExpertProtectedRoute>
                        <AgentLiveViewingsPage />
                      </ExpertProtectedRoute>
                    }
                  />
                  <Route
                    path="/mini-website"
                    element={
                      <ExpertProtectedRoute>
                        <AgentMiniWebsiteEditorPage />
                      </ExpertProtectedRoute>
                    }
                  />
                  <Route
                    path="/articles"
                    element={
                      <ExpertProtectedRoute>
                        <AgentSeoArticlesPage />
                      </ExpertProtectedRoute>
                    }
                  />
                  <Route
                    path="/seo-articles"
                    element={
                      <ExpertProtectedRoute>
                        <AgentSeoArticlesPage />
                      </ExpertProtectedRoute>
                    }
                  />
                  <Route
                    path="/leads"
                    element={
                      <ExpertProtectedRoute>
                        <AgentLeadsPage />
                      </ExpertProtectedRoute>
                    }
                  />

                  {/* Default / Fallback Routes */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/admin/*" element={<Navigate to="/dashboard" replace />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </ErrorBoundary>
            </main>

            {/* Call & Chat Modals */}
            <ErrorBoundary name="ExpertModals">
              <IncomingCallModal />
              <IncomingChatModal />
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

export default ExpertApp;
