import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  Lock,
  Mail,
  User,
  Phone,
  ArrowRight,
  KeyRound,
  CheckCircle2,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { CountryCodePicker, SupportedCountryPhone, SUPPORTED_COUNTRY_PHONES } from '../../components/CountryCodePicker';

type CustomerAuthMode = 'login' | 'register' | 'forgot-password' | 'reset-password';
type CustomerAuthMethod = 'email' | 'phone';

export const CustomerAuthPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    login,
    registerCustomer,
    forgotPassword,
    resetPassword,
    sendPhoneOtp,
    signupWithPhone,
    loginWithPhone,
  } = useAuth();

  const initialMode = (searchParams.get('mode') as CustomerAuthMode) || 'login';
  const tokenParam = searchParams.get('token') || '';
  const redirect = searchParams.get('redirect') || '/';

  const [mode, setMode] = useState<CustomerAuthMode>(
    initialMode === 'register' || initialMode === 'forgot-password' || initialMode === 'reset-password'
      ? initialMode
      : 'login'
  );

  const [authMethod, setAuthMethod] = useState<CustomerAuthMethod>('email');

  // Email form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState(tokenParam);

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
    const urlMode = searchParams.get('mode') as CustomerAuthMode;
    if (urlMode && ['login', 'register', 'forgot-password', 'reset-password'].includes(urlMode)) {
      setMode(urlMode);
    }
    const token = searchParams.get('token');
    if (token) {
      setResetToken(token);
      setMode('reset-password');
      setAuthMethod('email');
    }
  }, [searchParams]);

  const switchMode = (newMode: CustomerAuthMode) => {
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
      const reason = mode === 'register' ? 'SIGNUP' : 'LOGIN';
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
          await loginWithPhone(rawPhoneNumber.trim(), selectedCountry.code, otpCode.trim(), 'customer');
          navigate(redirect);
        } else if (mode === 'register') {
          if (!name.trim()) {
            throw new Error('Please enter your full name.');
          }
          await signupWithPhone({
            name: name.trim(),
            phoneNumber: rawPhoneNumber.trim(),
            countryCode: selectedCountry.code,
            otp: otpCode.trim(),
            role: 'CONSUMER',
          });
          navigate(redirect);
        }
      } else {
        // Email & Password flow
        if (mode === 'login') {
          await login(email, password);
          navigate(redirect);
        } else if (mode === 'register') {
          await registerCustomer({
            name,
            email,
            phone,
            password,
            countryCode: selectedCountry.code,
          });
          navigate(redirect);
        } else if (mode === 'forgot-password') {
          const res = await forgotPassword(email);
          setSuccessMsg(res.message || 'If an account exists with this email, password reset instructions have been sent.');
        } else if (mode === 'reset-password') {
          if (password !== confirmPassword) {
            throw new Error('Passwords do not match');
          }
          const res = await resetPassword(resetToken, password);
          setSuccessMsg(res.message || 'Password reset successfully. You can now sign in.');
          setTimeout(() => switchMode('login'), 2000);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-emerald-600/20">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {mode === 'login' && 'Welcome to PropertyTalk'}
            {mode === 'register' && 'Create Your Customer Account'}
            {mode === 'forgot-password' && 'Reset Your Password'}
            {mode === 'reset-password' && 'Set New Password'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {mode === 'login' && 'Sign in to consult with verified property experts'}
            {mode === 'register' && 'Sign up in seconds to start 1-minute free property consultations'}
            {mode === 'forgot-password' && 'Enter your email to receive password reset instructions'}
            {mode === 'reset-password' && 'Enter your new secure account password'}
          </p>
        </div>

        {/* Auth Mode Toggle Tabs (Login vs Register) */}
        {(mode === 'login' || mode === 'register') && (
          <div className="flex bg-slate-200/80 p-1 rounded-2xl mb-4">
            <button
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => switchMode('register')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                mode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              New Account
            </button>
          </div>
        )}

        {/* Auth Method Switcher (Email vs Mobile Phone OTP) */}
        {(mode === 'login' || mode === 'register') && (
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

        {/* Dev OTP Quick Hint */}
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
          {/* PHONE AUTHENTICATION FORM */}
          {/* ======================================================== */}
          {authMethod === 'phone' && (mode === 'login' || mode === 'register') ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name for Phone Registration */}
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Full Name
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

              {/* Mobile Phone Number with Country Code Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mobile Phone Number
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
                  Standard carrier SMS rates apply. We’ll send a 6-digit verification code.
                </p>
              </div>

              {/* Send Code Button (Step 1) */}
              {!otpSent ? (
                <button
                  type="button"
                  disabled={sendingOtp || !rawPhoneNumber.trim()}
                  onClick={handleSendPhoneOtp}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {sendingOtp ? 'Sending 6-Digit Code...' : 'Send Verification Code'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                /* 6-Digit OTP Code Input (Step 2) */
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

                  <button
                    type="submit"
                    disabled={submitting || otpCode.length !== 6}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                  >
                    {submitting ? 'Verifying...' : mode === 'register' ? 'Verify & Create Customer Account' : 'Sign In with OTP'}
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
            /* EMAIL & PASSWORD AUTHENTICATION FORM (ORIGINAL) */
            /* ======================================================== */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name (Register only) */}
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Alex Morgan"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              {mode !== 'reset-password' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    />
                  </div>
                </div>
              )}

              {/* Phone (Register only) */}
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Mobile Phone (Optional)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+64 21 000 0000"
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

              {/* Confirm Password (Reset Password only) */}
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

              {/* Reset Token Input (if reset-password) */}
              {mode === 'reset-password' && !tokenParam && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Password Reset Token
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
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 mt-2"
              >
                {submitting ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <span>
                      {mode === 'login' && 'Sign In'}
                      {mode === 'register' && 'Create Account'}
                      {mode === 'forgot-password' && 'Send Reset Link'}
                      {mode === 'reset-password' && 'Reset Password'}
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
                ← Back to Sign In
              </button>
            </div>
          )}
        </div>

        {/* Portal Separation Callout */}
        <div className="text-center mt-6">
          <p className="text-xs text-slate-500">
            Are you a licensed property professional?{' '}
            <a
              href="http://localhost:5174/auth?mode=register-expert"
              className="text-emerald-600 font-bold hover:underline"
            >
              Join as an Expert on Port 5174 →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
