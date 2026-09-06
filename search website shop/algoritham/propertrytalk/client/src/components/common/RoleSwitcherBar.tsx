import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Users, Shield, Award, UserCheck, ChevronDown, ChevronUp } from 'lucide-react';

export const RoleSwitcherBar: React.FC = () => {
  const { user, switchDemoRole } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  // Strictly hidden in production
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="bg-slate-900 text-white border-b border-slate-800 text-xs py-1.5 px-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
            <Users className="w-3.5 h-3.5" />
            <span>Role Switcher (Phase 1 Demo):</span>
          </span>
          {user ? (
            <span className="text-slate-300 hidden sm:inline">
              Logged in as: <strong className="text-white">{user.name}</strong> ({user.role})
            </span>
          ) : (
            <span className="text-amber-400">Viewing as Guest</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {!collapsed && (
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => switchDemoRole('consumer')}
                className={`px-2 py-0.5 rounded transition ${
                  user?.role === 'CONSUMER' ? 'bg-emerald-600 text-white font-medium' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
                title="Switch to James Wilson (Consumer)"
              >
                👤 Consumer
              </button>

              <button
                onClick={() => switchDemoRole('expert_nz')}
                className={`px-2 py-0.5 rounded transition ${
                  user?.role === 'EXPERT' && user.countryCode === 'NZ' ? 'bg-emerald-600 text-white font-medium' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
                title="Switch to Sarah Jenkins (NZ Real Estate Agent)"
              >
                🇳🇿 NZ Expert
              </button>

              <button
                onClick={() => switchDemoRole('expert_au')}
                className={`px-2 py-0.5 rounded transition ${
                  user?.role === 'EXPERT' && user.countryCode === 'AU' ? 'bg-emerald-600 text-white font-medium' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
                title="Switch to Marcus Vance (AU Buyer Advocate)"
              >
                🇦🇺 AU Expert
              </button>

              <button
                onClick={() => switchDemoRole('admin')}
                className={`px-2 py-0.5 rounded transition ${
                  user?.role === 'SUPER_ADMIN' ? 'bg-purple-600 text-white font-medium' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
                title="Switch to Super Admin (Verification & Configs)"
              >
                ⚡ Super Admin
              </button>
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-slate-400 hover:text-white p-1"
            title={collapsed ? "Expand switcher" : "Collapse switcher"}
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
