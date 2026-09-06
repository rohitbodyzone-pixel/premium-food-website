import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth, ExpertRegisterData } from '../../context/AuthContext';
import {
  Building2,
  Lock,
  Mail,
  User,
  Phone,
  ArrowRight,
  Briefcase,
  Globe,
  KeyRound,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Smartphone,
  AlertTriangle,
} from 'lucide-react';
import { CountryCodePicker, SupportedCountryPhone, SUPPORTED_COUNTRY_PHONES } from '../../components/CountryCodePicker';

type ExpertAuthMode = 'login' | 'register-expert' | 'forgot-password' | 'reset-password';
type ExpertAuthMethod = 'email' | 'phone';

export const ExpertAuthPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    user,
    login,
    registerExpert,
    forgotPassword,
    resetPassword,
    switchDemoRole,
    sendPhoneOtp,
    signupWithPhone,
    loginWithPhone,
  } = useAuth();

  const initialMode = (searchParams.get('mode') as ExpertAuthMode) || 'login';
  const tokenParam = searchParams.get('token') || '';
  const redirect = searchParams.get('redirect') || '/dashboard';

  const [mode, setMode] = useState<ExpertAuthMode>(
    initialMode === 'register-expert' || initialMode === 'forgot-password' || initialMode === 'reset-password'
      ? initialMode
      : 'login'
  );

  const [authMethod, setAuthMethod] = useState<ExpertAuthMethod>('email');

  // Form states (Email)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState(tokenParam);

  // Expert registration specifics
  const [countryCode, setCountryCode] = useState<'NZ' | 'AU'>('NZ');
  const [title, setTitle] = useState('');
  const [businessName, setBusinessName] = useState('');

  // Phone OTP states
  const [selectedCountry, setSelectedCountry] = useState<SupportedCountryPhone>(SUPPORTED_COUNTRY_PHONES[0]);
  const [rawPhoneNumber, setRawPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devOtpPreview, setDevOtpPreview] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    // If user is already logged in as EXPERT, redirect to dashboard
    if (user && user.role === 'EXPERT') {
      navigate('/dashboard', { replace: true });
    }
  }, [user]);

  useEffect(() => {
    const urlMode = searchParams.get('mode') as ExpertAuthMode;
    if (urlMode && ['login', 'register-expert', 'forgot-password', 'reset-password'].includes(urlMode)) {
      setMode(urlMode);
    }
    const token = searchParams.get('token');
    if (token) {
      setResetToken(token);
      setMode('reset-password');
      setAuthMethod('email');
    }
  }, [searchParams]);

  const switchMode = (newMode: ExpertAuthMode) => {
    setMode(newMode);
    setErrorMsg('');
    setSuccessMsg('');
    setOtpSent(false);
    setOtpCode('');
    setDevOtpPreview(null);
    setSearchParams({ mode: newMode });
  };

  const handleSendPhoneOtp = async () => {
    if (!rawPhoneNumber.trim()) {
      setErrorMsg('Please enter your mobile phone number.');
      return;
    }

    setSendingOtp(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const reason = mode === 'register-expert' ? 'SIGNUP' : 'LOGIN';
      const res = await sendPhoneOtp(rawPhoneNumber.trim(), selectedCountry.code, reason);
      setOtpSent(true);
      setCooldown(60);
      setSuccessMsg(res.message);
      if (res.devOtpPreview) {
        setDevOtpPreview(res.devOtpPreview);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch verification code.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (authMethod === 'phone') {
        if (!otpSent) {
          await handleSendPhoneOtp();
          setSubmitting(false);
          return;
        }

        if (mode === 'login') {
          await loginWithPhone(rawPhoneNumber.trim(), selectedCountry.code, otpCode.trim(), 'expert');
          navigate(redirect);
        } else if (mode === 'register-expert') {
          if (!name.trim()) {
            throw new Error('Please enter your full name.');
          }
          const res = await signupWithPhone({
            name: name.trim(),
            phoneNumber: rawPhoneNumber.trim(),
            countryCode: selectedCountry.code,
            otp: otpCode.trim(),
            role: 'EXPERT',
            expertDetails: {
              title: title.trim() || 'Property Professional',
              businessName: businessName.trim() || `${name.trim()} Property Services`,
            },
          });
          navigate(res.redirectTo || '/onboarding');
        }
      } else {
        // Email & Password flow
        if (mode === 'login') {
          await login(email, password);
          navigate(redirect);
        } else if (mode === 'register-expert') {
          const res = await registerExpert({
            name,
            email,
            password,
            phone,
            countryCode,
            title: title.trim() || 'Property Professional',
            businessName: businessName.trim() || `${name.trim()} Property Services`,
          });
          navigate(res.redirectTo || '/onboarding');
        } else if (mode === 'forgot-password') {
          const res = await forgotPassword(email);
          setSuccessMsg(res.message || 'If an account exists with this email, reset instructions have been generated.');
        } else if (mode === 'reset-password') {
          if (password !== confirmPassword) {
            throw new Error('Passwords do not match');
          }
          const res = await resetPassword(resetToken, password);
          setSuccessMsg(res.message || 'Password reset successfully. You can now log in.');
          setTimeout(() => switchMode('login'), 2000);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async (roleType: 'expert_nz' | 'expert_au') => {
    setSubmitting(true);
    try {
      await switchDemoRole(roleType);
      navigate('/dashboard');
    } catch (e: any) {
      setErrorMsg(e.message || 'Demo login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center mx-auto mb-3 shadow-md shadow-emerald-500/20 font-black text-base">
            PRO
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {mode === 'login' && 'Expert Professional Portal'}
            {mode === 'register-expert' && 'Join as a Property Professional'}
            {mode === 'forgot-password' && 'Reset Expert Password'}
            {mode === 'reset-password' && 'Set New Expert Password'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {mode === 'login' && 'Access your consultation requests, earnings, and availability'}
            {mode === 'register-expert' && 'Provide paid and free consultations to property clients'}
            {mode === 'forgot-password' && 'Enter your verified email to receive reset instructions'}
            {mode === 'reset-password' && 'Enter your new account password'}
          </p>
        </div>

        {/* Portal Role Notice Banner */}
        <div className="mb-4 p-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-300 text-xs flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold text-white block">Dedicated Expert Environment (Port 5174)</span>
            Clients cannot access expert earnings or controls from this portal. Unverified accounts start in DRAFT status.
          </div>
        </div>

        {/* Auth Mode Toggle Tabs (Login vs Register) */}
        {(mode === 'login' || mode === 'register-expert') && (
          <div className="flex bg-slate-200/80 p-1 rounded-2xl mb-4">
            <button
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Expert Sign In
            </button>
            <button
              onClick={() => switchMode('register-expert')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                mode === 'register-expert' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Apply as Expert
            </button>
          </div>
        )}

        {/* Auth Method Switcher (Email vs Mobile Phone OTP) */}
        {(mode === 'login' || mode === 'register-expert') && (
          <div className="flex bg-emerald-50/80 border border-emerald-100 p-1 rounded-2xl mb-5">
            <button
              type="button"
              onClick={() => {
                setAuthMethod('email');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition ${
                authMethod === 'email'
                  ? 'bg-white text-emerald-900 shadow-xs font-bold'
                  : 'text-emerald-700 hover:text-emerald-900'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email & Password</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMethod('phone');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition ${
                authMethod === 'phone'
                  ? 'bg-white text-emerald-900 shadow-xs font-bold'
                  : 'text-emerald-700 hover:text-emerald-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile Phone (OTP)</span>
            </button>
          </div>
        )}

        {/* 1-Click Fast Dev Expert Role Selector */}
        {mode === 'login' && authMethod === 'email' && import.meta.env.DEV && (
          <div className="bg-white border border-slate-200 p-3.5 rounded-2xl mb-5 shadow-xs">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>1-Click Dev Expert Sign In:</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin('expert_nz')}
                className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-lg transition text-center"
              >
                🇳🇿 Sarah Jenkins (NZ)
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('expert_au')}
                className="py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-800 text-[11px] font-bold rounded-lg transition text-center"
              >
                🇦🇺 Marcus Vance (AU)
              </button>
            </div>
          </div>
        )}

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Dev OTP Preview */}
        {devOtpPreview && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Dev Preview OTP: <strong className="font-mono text-sm tracking-widest">{devOtpPreview}</strong></span>
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

        {/* Card Body */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs">
          {/* ======================================================== */}
          {/* PHONE OTP FLOW */}
          {/* ======================================================== */}
          {authMethod === 'phone' && (mode === 'login' || mode === 'register-expert') ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Registration Specifics */}
              {mode === 'register-expert' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Full Legal Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. David Ross"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Professional Title
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Property Lawyer"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Practice / Business Name
                      </label>
                      <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. Ross Advisory Ltd"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Mobile Phone Input with CountryCodePicker */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Professional Mobile Number
                </label>
                <div className="flex items-center gap-2">
                  <CountryCodePicker
                    value={selectedCountry.code}
                    onChange={(c) => setSelectedCountry(c)}
                    disabled={otpSent}
                  />
                  <div className="relative flex-1">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      disabled={otpSent}
                      value={rawPhoneNumber}
                      onChange={(e) => setRawPhoneNumber(e.target.value)}
                      placeholder={selectedCountry.placeholder}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-60 transition"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  We verify professional mobile numbers using a 6-digit cryptographic SMS code.
                </p>
              </div>

              {/* Step 1: Send Code */}
              {!otpSent ? (
                <button
                  type="button"
                  disabled={sendingOtp || !rawPhoneNumber.trim()}
                  onClick={handleSendPhoneOtp}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {sendingOtp ? 'Dispatching 6-Digit Code...' : 'Send Verification Code'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                /* Step 2: 6-Digit OTP Input */
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-700">
                        6-Digit Verification Code
                      </label>
                      <button
                        type="button"
                        disabled={cooldown > 0 || sendingOtp}
                        onClick={handleSendPhoneOtp}
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

                  {mode === 'register-expert' && (
                    <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-[11px] leading-relaxed">
                      <strong>Note:</strong> Phone verification creates your account in <strong>DRAFT</strong> status. Super Admin verification is required before taking consultations online.
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || otpCode.length !== 6}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                  >
                    {submitting ? 'Verifying...' : mode === 'register-expert' ? 'Verify & Apply as Expert' : 'Sign In with OTP'}
                    <ArrowRight className="w-3.5 h-3.5" />
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
                    ← Change Phone Number
                  </button>
                </div>
              )}
            </form>
          ) : (
            /* ======================================================== */
            /* EMAIL & PASSWORD FLOW (ORIGINAL) */
            /* ======================================================== */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              {mode === 'register-expert' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Full Legal Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Sarah Jenkins"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    />
                  </div>
                </div>
              )}

              {/* Jurisdiction */}
              {mode === 'register-expert' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Primary Jurisdiction
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCountryCode('NZ')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                        countryCode === 'NZ'
                          ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <span>🇳🇿</span>
                      <span>New Zealand (NZ)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCountryCode('AU')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                        countryCode === 'AU'
                          ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <span>🇦🇺</span>
                      <span>Australia (AU)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Professional Title & Business */}
              {mode === 'register-expert' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Professional Title
                    </label>
                    <div className="relative">
                      <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Registered Valuer"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Practice / Business
                    </label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Jenkins Valuation Ltd"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              {mode !== 'reset-password' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Professional Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="professional@firm.co.nz"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    />
                  </div>
                </div>
              )}

              {/* Password */}
              {mode !== 'forgot-password' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      {mode === 'reset-password' ? 'New Password' : 'Password'}
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => switchMode('forgot-password')}
                        className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={6}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    />
                  </div>
                </div>
              )}

              {/* Confirm Password */}
              {mode === 'reset-password' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={6}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    />
                  </div>
                </div>
              )}

              {/* Reset Token */}
              {mode === 'reset-password' && !tokenParam && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Reset Token
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="Paste token from reset email"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 mt-2"
              >
                {submitting ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <span>
                      {mode === 'login' && 'Sign In to Expert Dashboard'}
                      {mode === 'register-expert' && 'Create Expert Application'}
                      {mode === 'forgot-password' && 'Send Password Reset Link'}
                      {mode === 'reset-password' && 'Update Password'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Mode Footer Helper Links */}
          {mode === 'forgot-password' && (
            <div className="text-center mt-4 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-xs text-slate-500 hover:text-slate-800 font-medium"
              >
                ← Back to Expert Sign In
              </button>
            </div>
          )}
        </div>

        {/* Portal Separation Callout */}
        <div className="text-center mt-6">
          <p className="text-xs text-slate-500">
            Looking for property advice?{' '}
            <a
              href="http://localhost:5173/auth"
              className="text-emerald-600 font-bold hover:underline"
            >
              Sign In as a Customer on Port 5173 →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
