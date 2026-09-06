import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2, ShieldX, LogOut, ExternalLink } from 'lucide-react';

interface ExpertProtectedRouteProps {
  children: React.ReactNode;
}

export const ExpertProtectedRoute: React.FC<ExpertProtectedRouteProps> = ({ children }) => {
  const { user, loading, logout } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-2" />
        <span className="text-xs text-slate-500 font-medium">Verifying professional credentials...</span>
      </div>
    );
  }

  if (!user) {
    const redirectPath = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirectPath}`} replace />;
  }

  // Strictly block non-expert accounts (Consumer or Super Admin)
  if (user.role !== 'EXPERT') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 text-center shadow-lg">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
            <ShieldX className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Access Denied: Expert Account Required
          </h2>
          <p className="text-xs text-slate-600 mb-6 leading-relaxed">
            You are currently signed in as <strong>{user.name}</strong> with a{' '}
            <strong className="text-slate-900">{user.role}</strong> account.
            The Expert Advisory Portal is strictly restricted to registered property professionals.
          </p>

          <div className="space-y-2">
            <a
              href="http://localhost:5173/"
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition shadow-xs"
            >
              <span>Go to Customer App (:5173)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={() => logout()}
              className="w-full inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out of Current Account</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
