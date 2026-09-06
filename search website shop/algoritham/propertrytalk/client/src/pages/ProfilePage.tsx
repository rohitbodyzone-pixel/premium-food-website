import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCountry } from '../context/CountryContext';
import {
  User,
  MessageSquare,
  PhoneCall,
  Calendar,
  Wallet,
  HelpCircle,
  Bookmark,
  Shield,
  Bell,
  Settings,
  Lock,
  FileText,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Edit2,
  ExternalLink,
  Smartphone,
  CheckCircle2,
  KeyRound,
  Sparkles,
  X,
} from 'lucide-react';
import { CountryCodePicker, SupportedCountryPhone, SUPPORTED_COUNTRY_PHONES } from '../components/CountryCodePicker';

export const ProfilePage: React.FC = () => {
  const { user, logout, requestPhoneChange, verifyPhoneChange } = useAuth();
  const { selectedCountry } = useCountry();
  const navigate = useNavigate();

  // Phone Modal States
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [modalCountry, setModalCountry] = useState<SupportedCountryPhone>(SUPPORTED_COUNTRY_PHONES[0]);
  const [newPhone, setNewPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [devOtpPreview, setDevOtpPreview] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  if (!user) {
    navigate('/auth?mode=login');
    return null;
  }

  // Mask email for privacy (e.g., j***n@gmail.com)
  const maskEmail = (email?: string | null) => {
    if (!email) return '';
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    const name = parts[0];
    const domain = parts[1];
    if (name.length <= 2) return `${name[0]}*@${domain}`;
    return `${name[0]}${'*'.repeat(name.length - 2)}${name[name.length - 1]}@${domain}`;
  };

  // Mask phone for privacy (e.g., +64 ••• ••• 4567)
  const maskPhone = (phone?: string | null) => {
    if (!phone) return null;
    const cleaned = phone.trim();
    if (cleaned.length < 8) return cleaned;
    const prefix = cleaned.startsWith('+1') ? '+1' : cleaned.startsWith('+') ? cleaned.slice(0, 3) : cleaned.slice(0, 2);
    const last4 = cleaned.slice(-4);
    return `${prefix} ••• ••• ${last4}`;
  };

  const isExpert = user.role === 'EXPERT';
  const isAdmin = user.role === 'SUPER_ADMIN';
  const hasVerifiedPhone = Boolean(user.phoneNumber || user.phoneVerifiedAt);

  const handleOpenPhoneModal = () => {
    setModalError('');
    setModalSuccess('');
    setOtpSent(false);
    setOtpCode('');
    setNewPhone('');
    setDevOtpPreview(null);
    setShowPhoneModal(true);
  };

  const handleSendOtp = async () => {
    if (!newPhone.trim()) {
      setModalError('Please enter your mobile phone number.');
      return;
    }

    setModalLoading(true);
    setModalError('');
    setModalSuccess('');

    try {
      const res = await requestPhoneChange(newPhone.trim(), modalCountry.code);
      setOtpSent(true);
      setCooldown(60);
      setModalSuccess(res.message);
      if (res.devOtpPreview) {
        setDevOtpPreview(res.devOtpPreview);
      }
    } catch (err: any) {
      setModalError(err.message || 'Failed to dispatch verification code.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      setModalError('Please enter the 6-digit code.');
      return;
    }

    setModalLoading(true);
    setModalError('');
    setModalSuccess('');

    try {
      const res = await verifyPhoneChange(newPhone.trim(), modalCountry.code, otpCode.trim());
      setModalSuccess(res.message);
      setTimeout(() => {
        setShowPhoneModal(false);
      }, 1500);
    } catch (err: any) {
      setModalError(err.message || 'Failed to verify phone number.');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28 space-y-5">
      {/* 1. Customer Profile Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xl font-bold shadow-xs">
            {user.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-bold text-slate-900">{user.name}</h2>
              {isExpert && (
                <span title="Verified Professional">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {user.email ? maskEmail(user.email) : (maskPhone(user.phoneNumber || user.phone) || 'Phone Verified Account')}
            </p>
            <span className="inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
              {isExpert ? 'Professional Account' : isAdmin ? 'Super Admin' : 'Consumer Account'}
            </span>
          </div>
        </div>

        {isExpert ? (
          <Link
            to="/expert/dashboard"
            className="p-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 rounded-xl hover:bg-emerald-50 transition"
          >
            Dashboard →
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleOpenPhoneModal}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
            title="Update Mobile Phone"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 2. Quick Action Cards */}
      <div className="grid grid-cols-3 gap-3">
        {/* My Consultations */}
        <Link
          to="/consultation-history"
          className="bg-white rounded-2xl border border-slate-200/90 p-3.5 text-center shadow-xs hover:border-emerald-500 hover:shadow-sm transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2 group-hover:bg-emerald-600 group-hover:text-white transition">
            <PhoneCall className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-slate-800 block">Consultations</span>
          <span className="text-[10px] text-slate-400">Calls & History</span>
        </Link>

        {/* Payments / Wallet */}
        <Link
          to="/wallet"
          className="bg-white rounded-2xl border border-slate-200/90 p-3.5 text-center shadow-xs hover:border-emerald-500 hover:shadow-sm transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2 group-hover:bg-blue-600 group-hover:text-white transition">
            <Wallet className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-slate-800 block">Wallet</span>
          <span className="text-[10px] text-slate-400">{selectedCountry?.currency || 'NZD'} $0.00</span>
        </Link>

        {/* Support */}
        <Link
          to="/support"
          className="bg-white rounded-2xl border border-slate-200/90 p-3.5 text-center shadow-xs hover:border-emerald-500 hover:shadow-sm transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-2 group-hover:bg-amber-600 group-hover:text-white transition">
            <HelpCircle className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-slate-800 block">Support</span>
          <span className="text-[10px] text-slate-400">Help & FAQs</span>
        </Link>
      </div>

      {/* 3. Mobile Phone & Authentication Security Section */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-slate-900">Mobile Phone & OTP Security</h3>
                {hasVerifiedPhone && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Verified
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-slate-500 mt-0.5">
                {user.phoneNumber || user.phone ? maskPhone(user.phoneNumber || user.phone) : 'No mobile number linked yet'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenPhoneModal}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs font-bold transition"
          >
            {user.phoneNumber || user.phone ? 'Change' : 'Add Phone'}
          </button>
        </div>
      </div>

      {/* 4. Section: EXPLORE */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-1">
        <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 px-3 pb-1">
          Explore
        </h3>

        <Link
          to="/experts"
          className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-800">Find Property Experts</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" />
        </Link>

        <Link
          to="/chats"
          className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-800">My Chats</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" />
        </Link>

        <Link
          to="/appointments"
          className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-800">My Appointments</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" />
        </Link>
      </div>

      {/* 5. Section: SUPPORT */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-1">
        <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 px-3 pb-1">
          Support
        </h3>

        <Link
          to="/support"
          className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-800">Customer Support</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" />
        </Link>

        <Link
          to="/support#report"
          className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-800">Report a Problem</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" />
        </Link>

        <Link
          to="/support#faqs"
          className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-800">Help Centre & FAQs</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" />
        </Link>
      </div>

      {/* 6. Section: APP & PRIVACY */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-1">
        <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 px-3 pb-1">
          App
        </h3>

        <div className="flex items-center justify-between p-3 rounded-xl text-slate-500">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-800 block">Manage Privacy</span>
              <span className="text-[10px] text-slate-400">Encrypted in-app chats & calls</span>
            </div>
          </div>
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            Protected
          </span>
        </div>

        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center justify-between p-3 rounded-xl text-red-600 hover:bg-red-50 transition group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <LogOut className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold">Logout</span>
          </div>
          <ChevronRight className="w-4 h-4 text-red-400 group-hover:translate-x-0.5 transition" />
        </button>
      </div>

      {/* Expert Onboarding callout if consumer wants to become an expert */}
      {!isExpert && (
        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-center">
          <span className="text-xs font-bold text-emerald-900 block">
            Are you a licensed property professional?
          </span>
          <p className="text-[11px] text-emerald-700 mt-0.5">
            Apply to consult on PropertyTalk in New Zealand or Australia.
          </p>
          <Link
            to="/expert/onboarding"
            className="mt-2.5 inline-block px-4 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs hover:bg-emerald-700 transition"
          >
            Apply for Verification
          </Link>
        </div>
      )}

      {/* ======================================================== */}
      {/* PHONE ADD / CHANGE MODAL */}
      {/* ======================================================== */}
      {showPhoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-sm text-slate-900">
                  {user.phoneNumber || user.phone ? 'Change Mobile Phone' : 'Add Mobile Phone'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPhoneModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Enter your new mobile phone number. We’ll send a 6-digit verification code to confirm ownership.
            </p>

            {modalError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {modalSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{modalSuccess}</span>
              </div>
            )}

            {devOtpPreview && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Dev Preview OTP: <strong className="font-mono text-sm">{devOtpPreview}</strong></span>
                </div>
                <button
                  type="button"
                  onClick={() => setOtpCode(devOtpPreview)}
                  className="text-[11px] font-bold text-amber-800 underline hover:text-amber-950"
                >
                  Auto-fill
                </button>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  New Mobile Phone Number
                </label>
                <div className="flex items-center gap-2">
                  <CountryCodePicker
                    value={modalCountry.code}
                    onChange={(c) => setModalCountry(c)}
                    disabled={otpSent}
                  />
                  <input
                    type="tel"
                    required
                    disabled={otpSent}
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder={modalCountry.placeholder}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-60 transition"
                  />
                </div>
              </div>

              {!otpSent ? (
                <button
                  type="button"
                  disabled={modalLoading || !newPhone.trim()}
                  onClick={handleSendOtp}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {modalLoading ? 'Sending Verification Code...' : 'Send Verification Code'}
                </button>
              ) : (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-700">
                        6-Digit Verification Code
                      </label>
                      <button
                        type="button"
                        disabled={cooldown > 0 || modalLoading}
                        onClick={handleSendOtp}
                        className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                      >
                        {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                      </button>
                    </div>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        autoFocus
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={modalLoading || otpCode.length !== 6}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {modalLoading ? 'Verifying...' : 'Verify & Update Number'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtpCode('');
                      setDevOtpPreview(null);
                    }}
                    className="w-full py-1 text-center text-slate-500 hover:text-slate-800 text-[11px]"
                  >
                    ← Edit Phone Number
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
