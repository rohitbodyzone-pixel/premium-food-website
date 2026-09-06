import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth, ExpertRegisterData } from '../context/AuthContext';
import {
  Building2,
  Lock,
  Mail,
  User,
  Phone,
  ArrowRight,
  Sparkles,
  Briefcase,
  Globe,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';

type AuthMode = 'login' | 'register' | 'register-expert' | 'forgot-password' | 'reset-password';

export const AuthPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, registerCustomer, registerExpert, forgotPassword, resetPassword, switchDemoRole } = useAuth();

  const initialMode = (searchParams.get('mode') as AuthMode) || 'login';
  const tokenParam = searchParams.get('token') || '';
  const redirect = searchParams.get('redirect') || '/';

  const [mode, setMode] = useState<AuthMode>(initialMode);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState(tokenParam);

  // Expert specific states
  const [countryCode, setCountryCode] = useState<'NZ' | 'AU'>('NZ');
  const [title, setTitle] = useState('');
  const [businessName, setBusinessName] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const urlMode = searchParams.get('mode') as AuthMode;
    if (urlMode) {
      setMode(urlMode);
    }
    const token = searchParams.get('token');
    if (token) {
      setResetToken(token);
      setMode('reset-password');
    }
  }, [searchParams]);

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setErrorMsg('');
    setSuccessMsg('');
    setSearchParams({ mode: newMode });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (mode === 'login') {
        await login(email, password);
        navigate(redirect);
      } else if (mode === 'register') {
        await registerCustomer({
          name,
          email,
          phone,
          password,
          countryCode: 'NZ',
        });
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
        navigate(res.redirectTo || '/expert/onboarding');
      } else if (mode === 'forgot-password') {
        const res = await forgotPassword(email);
        setSuccessMsg(res.message || 'If an account exists with this email, password reset instructions have been generated.');
      } else if (mode === 'reset-password') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        const res = await resetPassword(resetToken, password);
        setSuccessMsg(res.message || 'Password reset successfully. You can now sign in.');
        setTimeout(() => switchMode('login'), 2000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoSwitch = async (roleType: 'consumer' | 'expert_nz' | 'expert_au' | 'admin') => {
    setSubmitting(true);
    try {
      await switchDemoRole(roleType);
      if (roleType === 'admin') navigate('/admin');
      else if (roleType.startsWith('expert')) navigate('/expert/dashboard');
      else navigate('/');
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
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-emerald-600/20">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {mode === 'login' && 'Welcome Back to PropertyTalk'}
            {mode === 'register' && 'Create Your Account'}
            {mode === 'register-expert' && 'Join as a Property Professional'}
            {mode === 'forgot-password' && 'Reset Your Password'}
            {mode === 'reset-password' && 'Set New Password'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {mode === 'login' && 'Sign in to access your consultations and verified experts'}
            {mode === 'register' && 'Connect with verified NZ & AU property experts in seconds'}
            {mode === 'register-expert' && 'Offer verified advice, voice/video consultations, and build your client base'}
            {mode === 'forgot-password' && 'Enter your account email to receive reset instructions'}
            {mode === 'reset-password' && 'Enter your new secure account password'}
          </p>
        </div>

        {/* 1-Click Demo Login Box - Strictly hidden in production */}
        {import.meta.env.DEV && (
          <div className="bg-slate-900 text-white p-4 rounded-2xl mb-6 shadow-lg border border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Development Mode Quick Login:</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDemoSwitch('consumer')}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-left text-xs font-medium border border-slate-700/60 transition"
              >
                <span className="font-bold text-white block">👤 James Wilson</span>
                <span className="text-[10px] text-slate-400">Consumer Account</span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoSwitch('expert_nz')}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-left text-xs font-medium border border-slate-700/60 transition"
              >
                <span className="font-bold text-white block">🇳🇿 Sarah Jenkins</span>
                <span className="text-[10px] text-slate-400">NZ Real Estate Agent</span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoSwitch('expert_au')}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-left text-xs font-medium border border-slate-700/60 transition"
              >
                <span className="font-bold text-white block">🇦🇺 Marcus Vance</span>
                <span className="text-[10px] text-slate-400">AU Buyer Advocate</span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoSwitch('admin')}
                className="p-2 rounded-xl bg-purple-900/60 hover:bg-purple-900 text-left text-xs font-medium border border-purple-500/40 transition"
              >
                <span className="font-bold text-purple-200 block">⚡ Super Admin</span>
                <span className="text-[10px] text-purple-300">Verification Console</span>
              </button>
            </div>
          </div>
        )}

        {/* Auth Mode Toggle Tabs (When not in password recovery mode) */}
        {mode !== 'forgot-password' && mode !== 'reset-password' && (
          <div className="flex bg-slate-100 p-1 rounded-2xl mb-4 text-xs font-semibold">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 rounded-xl transition ${
                mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`flex-1 py-2 rounded-xl transition ${
                mode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Customer Signup
            </button>
            <button
              type="button"
              onClick={() => switchMode('register-expert')}
              className={`flex-1 py-2 rounded-xl transition ${
                mode === 'register-expert' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Expert Signup
            </button>
          </div>
        )}

        {/* Main Form Container */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name for Registration */}
            {(mode === 'register' || mode === 'register-expert') && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  />
                </div>
              </div>
            )}

            {/* Email Address */}
            {mode !== 'reset-password' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  />
                </div>
              </div>
            )}

            {/* Expert Specific Fields */}
            {mode === 'register-expert' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Licensed Jurisdiction
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCountryCode('NZ')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                        countryCode === 'NZ'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-base">🇳🇿</span>
                      <span>New Zealand</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCountryCode('AU')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                        countryCode === 'AU'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-base">🇦🇺</span>
                      <span>Australia</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Professional Title / Role
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Registered Property Valuer"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Trading / Business Name
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Jenkins Valuations NZ Ltd"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Mobile Number for Registration */}
            {(mode === 'register' || mode === 'register-expert') && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number {mode === 'register' ? '(Optional)' : '(Required for Verification)'}
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required={mode === 'register-expert'}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={countryCode === 'AU' ? '+61 400 000 000' : '+64 21 000 0000'}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  />
                </div>
              </div>
            )}

            {/* Password Field (when not forgot-password) */}
            {mode !== 'forgot-password' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    {mode === 'reset-password' ? 'New Password' : 'Password'}
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot-password')}
                      className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="•••••••• (min 6 chars)"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  />
                </div>
              </div>
            )}

            {/* Confirm Password for Reset Mode */}
            {mode === 'reset-password' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <span>
                {submitting
                  ? 'Please wait...'
                  : mode === 'login'
                  ? 'Sign In'
                  : mode === 'register'
                  ? 'Create Customer Account'
                  : mode === 'register-expert'
                  ? 'Complete Expert Registration'
                  : mode === 'forgot-password'
                  ? 'Send Reset Link'
                  : 'Update Password'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Footer Back/Switch Links */}
          <div className="mt-5 pt-4 border-t border-slate-100 text-center">
            {mode === 'login' && (
              <p className="text-xs text-slate-500">
                Are you a property professional?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('register-expert')}
                  className="font-bold text-emerald-600 hover:text-emerald-700"
                >
                  Join as an Expert
                </button>
              </p>
            )}

            {(mode === 'register' || mode === 'register-expert') && (
              <p className="text-xs text-slate-500">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-bold text-emerald-600 hover:text-emerald-700"
                >
                  Sign in
                </button>
              </p>
            )}

            {(mode === 'forgot-password' || mode === 'reset-password') && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                ← Back to Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
