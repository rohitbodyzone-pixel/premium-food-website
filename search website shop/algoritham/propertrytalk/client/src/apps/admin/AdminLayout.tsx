import React from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from './AdminAuthContext';
import {
  LayoutDashboard,
  ShieldCheck,
  Award,
  Users,
  Layers,
  MapPin,
  PhoneCall,
  Calendar,
  Star,
  Settings,
  ExternalLink,
  Activity,
  FileText,
  LogOut,
  Radio,
  Building2,
  ChevronRight,
  CreditCard,
  Bell,
  Video,
  ToggleRight,
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Feature Flags', path: '/features', icon: ToggleRight },
    { label: 'Live Viewing Rules', path: '/live-viewing-rules', icon: Video },
    { label: 'Listings Moderation', path: '/moderation/listings', icon: Building2 },
    { label: 'Content Moderation', path: '/moderation/content', icon: ShieldCheck },
    { label: 'Expert Verification', path: '/verification', icon: ShieldCheck },
    { label: 'Experts', path: '/experts', icon: Award },
    { label: 'Customers', path: '/customers', icon: Users },
    { label: 'Categories', path: '/categories', icon: Layers },
    { label: 'Countries & Cities', path: '/locations', icon: MapPin },
    { label: 'Consultations', path: '/consultations', icon: PhoneCall },
    { label: 'Payments & Billing', path: '/payments', icon: CreditCard },
    { label: 'Appointments', path: '/appointments', icon: Calendar },
    { label: 'Reviews & Reports', path: '/reviews', icon: Star },
    { label: 'Platform Settings', path: '/settings', icon: Settings },
    { label: 'Official Registers', path: '/registers', icon: ExternalLink },
    { label: 'System Status', path: '/system', icon: Activity },
    { label: 'Audit Logs', path: '/audit-logs', icon: FileText },
    { label: 'Notification Logs', path: '/notifications', icon: Bell },
  ];

  const currentItem = navItems.find((item) => item.path === location.pathname) || navItems[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans antialiased">
      {/* 1. LEFT SIDEBAR */}
      <aside className="w-64 bg-slate-900/95 border-r border-slate-800 flex flex-col shrink-0">
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-md shadow-purple-600/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm text-white tracking-tight leading-none">
                Property<span className="text-purple-400">Talk</span>
              </span>
              <span className="bg-purple-950 text-purple-300 text-[9px] font-bold px-1.5 py-0.5 rounded border border-purple-800">
                ADMIN
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
              Super Admin Control Panel
            </span>
          </div>
        </div>

        {/* Navigation Menu (13 Items) */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
          <div className="px-3 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Platform Management
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-xs font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom of Sidebar: Admin Profile & Logout */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/60 border border-slate-700/50 mb-2">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-purple-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                A
              </div>
              <div className="overflow-hidden leading-tight">
                <span className="text-xs font-bold text-slate-200 block truncate">
                  {user?.name || 'Super Admin'}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  {user?.email || 'admin@propertytalk.com'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/30 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* 2. RIGHT SIDE: HEADER + MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TOP HEADER */}
        <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
          {/* Breadcrumb Title */}
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold text-white tracking-tight">
              PropertyTalk Super Admin
            </h1>
            <ChevronRight className="w-4 h-4 text-slate-600" />
            <span className="text-xs font-bold text-purple-400">{currentItem.label}</span>
          </div>

          {/* Header Controls & Status */}
          <div className="flex items-center gap-3">
            {/* Environment Badge */}
            <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-300 tracking-wide uppercase">
              Development
            </span>

            {/* Backend Connectivity Indicator */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs font-medium">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Backend :5000 Online</span>
            </div>

            {/* Quick Logout button */}
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
