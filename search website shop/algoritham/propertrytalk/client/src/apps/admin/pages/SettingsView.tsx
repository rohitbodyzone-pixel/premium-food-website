import React, { useState, useEffect } from 'react';
import { adminApi } from '../AdminAuthContext';
import {
  Settings,
  Clock,
  Sparkles,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  ShieldAlert,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [configs, setConfigs] = useState<any[]>([]);
  const [smsConfig, setSmsConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Editable form state
  const [freeCallSeconds, setFreeCallSeconds] = useState(60);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const [res, smsRes] = await Promise.all([
        adminApi.get<any[]>('/admin/config').catch(() => []),
        adminApi.get<any>('/admin/sms-config').catch(() => null),
      ]);
      setConfigs(res);
      setSmsConfig(smsRes);

      const freeSecConfig = res.find((c) => c.key === 'free_call_duration_seconds');
      if (freeSecConfig) {
        setFreeCallSeconds(parseInt(freeSecConfig.value, 10) || 60);
      }
    } catch (err) {
      console.error('Failed to load system config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const handleSaveFreeDuration = async () => {
    setSavingKey('free_call_duration_seconds');
    setSuccessMsg('');
    try {
      await adminApi.put('/admin/config/free_call_duration_seconds', {
        value: String(freeCallSeconds),
        description: 'Duration in seconds for the mandatory initial free consultation tier',
      });
      setSuccessMsg('Free consultation duration updated successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
      loadConfigs();
    } catch (err: any) {
      alert(err.message || 'Failed to update configuration');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-400" />
            <span>Platform Configuration & Global Governance</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure consultation policies, free consultation grace periods, and platform parameters
          </p>
        </div>
        <button
          onClick={loadConfigs}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reload Config</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 2. Free Consultation Duration (First 1 Minute Free) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-950/80 border border-purple-800/60 text-purple-300 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">
                Initial Free Consultation Grace Period
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                PropertyTalk guarantee: Every client gets free initial seconds before paid per-minute billing commences.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 text-[10px] font-bold uppercase">
            Active Policy
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Free Duration (in seconds)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="600"
                step="5"
                value={freeCallSeconds}
                onChange={(e) => setFreeCallSeconds(Number(e.target.value))}
                className="w-36 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              />
              <span className="text-xs text-slate-400">
                = {Math.floor(freeCallSeconds / 60)}m {freeCallSeconds % 60}s free tier
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Default is 60 seconds ("First 1 Minute Free"). Any change here is audited and applies platform-wide to WebRTC and Socket session timers.
            </p>
          </div>

          <div className="flex flex-col justify-end items-start sm:items-end">
            <button
              onClick={handleSaveFreeDuration}
              disabled={savingKey === 'free_call_duration_seconds'}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-md shadow-purple-600/30 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>
                {savingKey === 'free_call_duration_seconds' ? 'Saving Config...' : 'Update Free Tier'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Phase 2D: Phone Authentication & SMS Delivery Governance */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-950/80 border border-purple-800/60 text-purple-300 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">
                Phone Number Authentication & SMS Delivery Governance
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Carrier-grade mobile registration, cryptographic OTP verification, and role boundaries
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 text-[10px] font-bold uppercase">
            Phase 2D Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2">
          {/* Status Card: Authentication Policies */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Phone Auth Policies
            </span>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Customer Signup:</span>
                <span className="text-emerald-400 font-bold">Enabled</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Expert Signup:</span>
                <span className="text-emerald-400 font-bold">Enabled (Draft)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Phone OTP Login:</span>
                <span className="text-emerald-400 font-bold">Enabled</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-300">Super Admin Phone:</span>
                <span className="text-amber-400 font-bold">Disabled (Policy)</span>
              </div>
            </div>
          </div>

          {/* Status Card: Active SMS Provider */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              SMS Delivery Provider
            </span>
            <div className="font-bold text-white text-sm">
              {smsConfig?.smsProvider?.isDevelopment
                ? 'DEVELOPMENT SMS MODE'
                : (smsConfig?.smsProvider?.name || 'Twilio SMS Provider')}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {smsConfig?.smsProvider?.isDevelopment
                ? 'Dispatches verification codes to developer console preview. Production activates automatically via TWILIO credentials.'
                : 'Live carrier SMS delivery active.'}
            </p>
            {smsConfig?.metrics && (
              <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800">
                Dispatches: {smsConfig.metrics.totalSmsDispatched} | Verified: {smsConfig.metrics.successfulPhoneVerifications}
              </div>
            )}
          </div>

          {/* Status Card: OTP Security Parameters */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              OTP Security Parameters
            </span>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Code Length:</span>
                <span className="text-white font-mono font-bold">6 Digits</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Hash Storage:</span>
                <span className="text-purple-300 font-bold">SHA-256 Only</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Expiry Window:</span>
                <span className="text-white font-bold">10 Minutes</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Resend Cooldown:</span>
                <span className="text-white font-bold">60 Seconds</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-300">Max Attempts:</span>
                <span className="text-rose-400 font-bold">3 (Auto-Invalidate)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Global Platform Safety & Verification Policies */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
        <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-purple-400" />
          <span>Professional Governance Policies</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="font-bold text-slate-200">Strict Official Registry Verification</div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Professionals in regulated fields (lawyers, real estate agents, architects, builders) must provide a valid government license number verified by a Super Admin before going online.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="font-bold text-slate-200">Autonomous Signalling Fallbacks</div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              WebRTC sessions use redundant STUN endpoints (Google STUN) and fall back to low-latency Socket.io signalling if peer-to-peer audio fails.
            </p>
          </div>
        </div>
      </div>

      {/* 5. Email & Notification Delivery Infrastructure Governance */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-400" />
            <span>Email Delivery & Notification Foundation</span>
          </h3>
          <span className="px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 text-[10px] font-bold border border-blue-800">
            Phase 2C Engine
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Active Provider
            </span>
            <div className="font-bold text-emerald-400 text-sm">DEVELOPMENT EMAIL MODE</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Safe simulated provider logging preview links & briefs to terminal. Production activates seamlessly with <code className="text-purple-300">RESEND_API_KEY</code>.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              OTP & Password Security
            </span>
            <div className="font-bold text-white text-sm">Cryptographic SHA-256</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              6-digit OTPs, 10-minute validity, 3-attempt auto lock, 60s resend cooldown. Single-use hashes are never exposed in database or APIs.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Appointment Reminders
            </span>
            <div className="font-bold text-white text-sm">24h & 1h Background Runner</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Atomic deduplication prevents duplicate emails or notifications. Scheduled background daemon runs every 5 minutes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
