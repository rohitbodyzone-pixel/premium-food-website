import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCountry } from '../../context/CountryContext';
import { useSocket } from '../../context/SocketContext';
import { api } from '../../services/api';
import {
  Building2,
  ChevronDown,
  Search,
  Bell,
  Wallet,
  User as UserIcon,
  HelpCircle,
} from 'lucide-react';
import { SearchOverlay } from '../../components/common/SearchOverlay';

export const CustomerHeader: React.FC = () => {
  const { user } = useAuth();
  const { selectedCountry, setIsCountryModalOpen } = useCountry();
  const { socket } = useSocket();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
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

  const isNZ = selectedCountry?.code === 'NZ';
  const countryShort = isNZ ? 'NZ' : 'AU';
  const currencySymbol = selectedCountry?.currencySymbol || '$';

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          {/* LEFT: Logo & Brand */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight leading-none">
                  Property<span className="text-emerald-600">Talk</span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium hidden sm:inline leading-tight">
                  Verified Property Advice
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 ml-4">
              <Link
                to="/explore"
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-emerald-600 hover:bg-slate-50 transition"
              >
                Explore Properties
              </Link>
              <Link
                to="/live-viewings"
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-emerald-600 hover:bg-slate-50 transition flex items-center gap-1"
              >
                <span>Live Viewings</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </Link>
              <Link
                to="/experts"
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-emerald-600 hover:bg-slate-50 transition"
              >
                Find Professionals
              </Link>
            </nav>
          </div>

          {/* CENTER: Selected Advice Country Pill (NZ or AU) */}
          <div className="flex items-center justify-center">
            <button
              onClick={() => setIsCountryModalOpen(true)}
              className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/90 text-slate-800 px-3 py-1.5 rounded-full text-xs font-bold border border-slate-200 shadow-2xs hover:shadow-xs transition active:scale-95"
              title="Switch professional advice country"
            >
              <span className="text-base leading-none">{selectedCountry?.flag || '🇳🇿'}</span>
              <span>{countryShort} Experts</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>

          {/* RIGHT: Search, Notifications, Wallet, Profile / Auth */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Quick Wallet link (if consumer user) */}
            {user && (
              <Link
                to="/wallet"
                className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition"
                title="Wallet & Payment History"
              >
                <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                <span>{currencySymbol}0.00</span>
              </Link>
            )}

            {/* Search Icon */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition"
              title="Search experts by name, category, or city"
            >
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Notifications */}
            {user && (
              <Link
                to="/notifications"
                className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition relative"
                title="Notifications"
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                {unreadCount > 0 ? (
                  <span className="absolute top-1.5 right-1.5 px-1 min-w-[15px] h-[15px] bg-emerald-600 text-white font-black text-[9px] rounded-full flex items-center justify-center border-2 border-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-2 right-2 border-2 border-white" />
                )}
              </Link>
            )}

            {/* Support Link */}
            <Link
              to="/support"
              className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition hidden md:block"
              title="Customer Support"
            >
              <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </Link>

            {/* Profile Avatar or Login Button */}
            {user ? (
              <Link
                to="/profile"
                className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 transition"
                title="Your Customer Account"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-bold text-slate-800 hidden lg:inline">
                  {user.name.split(' ')[0]}
                </span>
              </Link>
            ) : (
              <Link
                to="/auth?mode=login"
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-xs transition"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
};
