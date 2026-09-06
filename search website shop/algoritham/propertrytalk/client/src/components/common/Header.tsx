import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCountry } from '../../context/CountryContext';
import {
  Building2,
  ChevronDown,
  Search,
  Bell,
  Radio,
  Wallet,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../services/api';
import { SearchOverlay } from './SearchOverlay';

export const Header: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { selectedCountry, setIsCountryModalOpen } = useCountry();
  const navigate = useNavigate();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const toggleExpertOnline = async () => {
    if (!user?.expertProfile) return;
    setUpdatingStatus(true);
    try {
      const nextStatus = !user.expertProfile.isOnline;
      await api.patch('/experts/me/status', { isOnline: nextStatus });
      await refreshUser();
    } catch (err: any) {
      alert(err.message || 'Failed to change online status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const isNZ = selectedCountry?.code === 'NZ';
  const countryShort = isNZ ? 'NZ' : 'AU';
  const currencySymbol = selectedCountry?.currencySymbol || '$';

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          {/* LEFT: Customer Profile Avatar / Brand Logo */}
          <div className="flex items-center gap-2.5">
            {user ? (
              <Link
                to={user.role === 'EXPERT' ? '/expert/dashboard' : '/profile'}
                className="flex items-center gap-2 group p-1 -ml-1 rounded-full hover:bg-slate-100 transition"
                title="View Profile & Settings"
              >
                <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs group-hover:ring-2 group-hover:ring-emerald-500/40 transition">
                  {user.name.charAt(0)}
                </div>
                <div className="hidden sm:block text-left">
                  <span className="text-xs font-bold text-slate-800 block leading-tight">
                    {user.name.split(' ')[0]}
                  </span>
                  <span className="text-[10px] text-slate-400 block -mt-0.5">
                    {user.role === 'EXPERT' ? 'Expert Account' : 'Account'}
                  </span>
                </div>
              </Link>
            ) : (
              <Link to="/auth?mode=login" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs border border-slate-200">
                  PT
                </div>
                <span className="font-extrabold text-sm text-slate-900 hidden sm:inline">
                  Property<span className="text-emerald-600">Talk</span>
                </span>
              </Link>
            )}
          </div>

          {/* CENTER: Selected Expert-Country Pill (🇳🇿 NZ or 🇦🇺 AU) */}
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

          {/* RIGHT: Search, Notifications, & Quick Controls */}
          <div className="flex items-center gap-1.5">
            {/* Quick Wallet preview pill (if customer) */}
            {user?.role === 'CONSUMER' && (
              <Link
                to="/wallet"
                className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition"
                title="Wallet & Payment History"
              >
                <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                <span>{currencySymbol}0.00</span>
              </Link>
            )}

            {/* Expert Online Toggle (if expert user) */}
            {user?.role === 'EXPERT' && user.expertProfile && (
              <button
                onClick={toggleExpertOnline}
                disabled={updatingStatus || user.expertProfile.verificationStatus !== 'VERIFIED'}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition ${
                  user.expertProfile.isOnline
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}
              >
                <Radio className={`w-3 h-3 ${user.expertProfile.isOnline ? 'text-emerald-500 animate-pulse' : ''}`} />
                <span className="hidden xs:inline">{user.expertProfile.isOnline ? 'Online' : 'Offline'}</span>
              </button>
            )}

            {/* Search Icon button */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition"
              title="Search experts by name, profession, city..."
            >
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Notifications button */}
            <Link
              to="/notifications"
              className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-2 right-2 border-2 border-white" />
            </Link>
          </div>
        </div>
      </header>

      {/* Global Search Overlay */}
      <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
};
