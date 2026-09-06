import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from './AdminAuthContext';
import { Loader2, ShieldAlert, LogOut } from 'lucide-react';

export const AdminProtectedRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, loading, logout } = useAdminAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4 bg-slate-950 text-white">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-2" />
        <span className="text-xs text-slate-400 font-medium">Validating administrative session...</span>
      </div>
    );
  }

  if (!user || user.role !== 'SUPER_ADMIN') {
    const redirectPath = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirectPath}`} replace />;
  }

  return <>{children}</>;
};
