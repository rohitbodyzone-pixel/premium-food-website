import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  ShieldCheck,
  AlertCircle,
  Radio,
  Calendar,
  MessageSquare,
  PhoneCall,
  User,
  LogOut,
  FileCheck,
  ExternalLink,
  DollarSign,
  Clock,
  Bell,
  Globe,
  Video,
  BookOpen,
  Users,
} from 'lucide-react';
import { api } from '../../services/api';
import { useSocket } from '../../context/SocketContext';

export const ExpertHeader: React.FC = () => {
  const { user, refreshUser, logout } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    api.get<{ unreadCount: number }>('/notifications?limit=1')
      .then((data) => setUnreadCount(data.unreadCount || 0))
      .catch(() => {});

    if (socket) {
      const handleNewNotification = () => {
        setUnreadCount((prev) => prev + 1);
      };
      socket.on('notification:new', handleNewNotification);
      return () => {
        socket.off('notification:new', handleNewNotification);
      };
    }
  }, [user, socket]);

  const expertProfile = user?.expertProfile;
  const isVerified = expertProfile?.verificationStatus === 'VERIFIED';
  const isOnline = expertProfile?.isOnline || false;

  const toggleExpertOnline = async () => {
    if (!expertProfile) return;
    if (!isVerified) {
      alert('Only verified professionals can go Online for consultations. Please check your verification status.');
      return;
    }

    setUpdatingStatus(true);
    try {
      const nextStatus = !isOnline;
      await api.patch('/experts/me/status', { isOnline: nextStatus });
      await refreshUser();
    } catch (err: any) {
      alert(err.message || 'Failed to update online status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navLinks = [
    { label: 'Dashboard', path: '/dashboard', icon: Building2 },
    { label: 'Listings', path: '/properties', icon: Building2 },
    { label: 'Live Viewings', path: '/live-viewings', icon: Video },
    { label: 'Mini-Website', path: '/mini-website', icon: Globe },
    { label: 'SEO Articles', path: '/articles', icon: BookOpen },
    { label: 'Leads', path: '/leads', icon: Users },
    { label: 'Appointments', path: '/appointments', icon: Calendar },
    { label: 'Availability', path: '/availability', icon: Clock },
    { label: 'Chats', path: '/chats', icon: MessageSquare },
    { label: 'Calls', path: '/calls', icon: PhoneCall },
    { label: 'Earnings', path: '/earnings', icon: DollarSign },
    { label: 'Verification', path: '/onboarding', icon: FileCheck },
    { label: 'Settings', path: '/profile', icon: User },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* LEFT: Expert Brand Logo */}
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-900 flex items-center justify-center font-black text-sm shadow-md group-hover:bg-emerald-400 transition">
              PRO
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base text-white tracking-tight leading-none">
                  Property<span className="text-emerald-400">Talk</span>
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">
                  EXPERT
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block -mt-0.5">
                Professional Advisory Portal
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          {user && user.role === 'EXPERT' && (
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      isActive
                        ? 'bg-slate-800 text-emerald-400'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        {/* RIGHT: Status Toggle & User Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user && user.role === 'EXPERT' && (
            <>
              {/* Verification Status Pill */}
              <div
                className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                  isVerified
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
                    : 'bg-amber-950/60 text-amber-300 border-amber-700/50'
                }`}
                title={
                  isVerified
                    ? 'Your professional license is verified by Super Admin'
                    : 'Your profile is awaiting Super Admin verification'
                }
              >
                {isVerified ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>{expertProfile?.verificationStatus || 'PENDING'}</span>
              </div>

              {/* Online / Offline Presence Toggle */}
              <button
                onClick={toggleExpertOnline}
                disabled={updatingStatus || !isVerified}
                title={
                  !isVerified
                    ? 'You must be verified by Super Admin before going online'
                    : isOnline
                    ? 'Click to go Offline'
                    : 'Click to go Online for consultations'
                }
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                  !isVerified
                    ? 'bg-slate-800/80 text-slate-500 border-slate-700 cursor-not-allowed opacity-60'
                    : isOnline
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-xs'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                <Radio className={`w-3.5 h-3.5 ${isOnline ? 'text-white animate-pulse' : 'text-slate-500'}`} />
                <span>{isOnline ? 'Online' : 'Offline'}</span>
              </button>

              {/* Notification Bell with live unread badge */}
              <Link
                to="/notifications"
                className="relative p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 px-1.5 py-0.2 min-w-[16px] h-4 bg-emerald-500 text-slate-950 font-black text-[9px] rounded-full flex items-center justify-center border-2 border-slate-900">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>

              {/* Expert Profile & Name */}
              <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-800">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-xs">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="text-left leading-tight">
                  <span className="text-xs font-bold text-slate-200 block truncate max-w-[120px]">
                    {user.name}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {user.countryCode || 'NZ'} Professional
                  </span>
                </div>
              </div>

              {/* Logout button */}
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                title="Sign out of Expert Portal"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}

          {!user && (
            <Link
              to="/login"
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-1.5 rounded-full text-xs font-bold transition shadow-xs"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Nav Bar for Expert */}
      {user && user.role === 'EXPERT' && (
        <div className="md:hidden border-t border-slate-800 px-2 py-1.5 flex items-center justify-around bg-slate-900/90 text-xs">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex flex-col items-center py-1 px-2 rounded-lg transition ${
                  isActive ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span className="text-[10px]">{link.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
};
