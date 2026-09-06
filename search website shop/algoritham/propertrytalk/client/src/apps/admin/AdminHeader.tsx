import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldAlert,
  ShieldCheck,
  LogOut,
  Radio,
  ExternalLink,
} from 'lucide-react';

export const AdminHeader: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950 text-white border-b border-purple-900/40 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* LEFT: Super Admin Brand */}
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-purple-600/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base text-white tracking-tight leading-none">
                  Property<span className="text-purple-400">Talk</span>
                </span>
                <span className="bg-purple-900/60 text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-700/60 uppercase tracking-wider">
                  Super Admin
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block -mt-0.5">
                Central Platform Administration & Verification Console
              </span>
            </div>
          </Link>
        </div>

        {/* RIGHT: Admin Status & User Info */}
        <div className="flex items-center gap-3">
          {/* API Health Pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>Backend :5000</span>
          </div>

          {user && user.role === 'SUPER_ADMIN' && (
            <>
              {/* Admin Profile Info */}
              <div className="flex items-center gap-2 pl-2 sm:border-l sm:border-slate-800">
                <div className="w-8 h-8 rounded-full bg-purple-700 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  A
                </div>
                <div className="text-left hidden sm:block">
                  <span className="text-xs font-bold text-slate-200 block leading-tight">
                    {user.name}
                  </span>
                  <span className="text-[10px] text-purple-300 block">
                    {user.email}
                  </span>
                </div>
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-rose-400 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-semibold transition"
                title="Sign out of Admin Console"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          )}

          {!user && (
            <Link
              to="/login"
              className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold transition shadow-xs"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
