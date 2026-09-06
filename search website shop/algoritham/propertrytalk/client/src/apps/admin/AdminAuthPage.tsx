import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAdminAuth } from './AdminAuthContext';
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

export const AdminAuthPage: React.FC = () => {
  const { user, login } = useAdminAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const redirect = searchParams.get('redirect') || '/dashboard';

  const [email, setEmail] = useState('admin@propertytalk.com');
  const [password, setPassword] = useState('password123');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    document.title = 'PropertyTalk Super Admin';
  }, []);

  useEffect(() => {
    if (user && user.role === 'SUPER_ADMIN') {
      navigate('/dashboard', { replace: true });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      await login(email.trim(), password);
      navigate(redirect);
    } catch (err: any) {
      setErrorMsg(err.message || 'Super Admin authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDevQuickSignIn = async () => {
    setEmail('admin@propertytalk.com');
    setPassword('password123');
    setSubmitting(true);
    setErrorMsg('');
    try {
      await login('admin@propertytalk.com', 'password123');
      navigate('/dashboard');
    } catch (err: any) {
      setErrorMsg(err.message || 'Admin authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-app="propertytalk-super-admin"
      className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-white selection:bg-purple-600 selection:text-white"
    >
      <div className="max-w-md w-full">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-purple-600 text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-purple-600/30 border border-purple-400/30">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            PropertyTalk
          </h1>
          <h2 className="text-sm font-bold text-purple-400 uppercase tracking-widest mt-0.5">
            Super Admin Console
          </h2>
          <p className="text-xs text-slate-400 mt-2">
            Restricted access: Platform configuration, verification audit, and administrative controls.
          </p>
        </div>

        {/* Security Warning Notice */}
        <div className="mb-5 p-3.5 bg-purple-950/60 border border-purple-800/60 rounded-2xl text-purple-200 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold text-white block">Authorized Access Only</span>
            All administrative sessions and actions are cryptographically recorded in audit logs. Public signups are strictly disabled on this portal.
          </div>
        </div>

        {/* 1-Click Fast Dev Sign In */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl mb-5 shadow-md">
          <div className="flex items-center gap-1.5 text-xs font-bold text-purple-400 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Development Quick Sign In:</span>
          </div>
          <button
            type="button"
            onClick={handleDevQuickSignIn}
            disabled={submitting}
            className="w-full py-2.5 px-3 rounded-xl bg-purple-900/50 hover:bg-purple-900/80 text-purple-200 text-xs font-bold transition border border-purple-700/50 flex items-center justify-center gap-2"
          >
            <span>Sign In as Super Admin (admin@propertytalk.com)</span>
          </button>
        </div>

        {/* Feedback Error Message */}
        {errorMsg && (
          <div className="mb-4 p-3.5 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Credentials Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@propertytalk.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-3 rounded-xl shadow-md shadow-purple-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{submitting ? 'Verifying Authorization...' : 'Sign In'}</span>
              {!submitting && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
