import React, { useState, useEffect } from 'react';
import { adminApi } from '../AdminAuthContext';
import {
  Activity,
  Server,
  Database,
  Radio,
  Video,
  CheckCircle2,
  RefreshCw,
  Clock,
  Zap,
  Phone,
  Mail,
  CreditCard,
  Bell,
  ShieldCheck,
  Lock,
} from 'lucide-react';

export const SystemStatusView: React.FC = () => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

  const checkHealth = async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<any>('/admin/system-status');
      setStatus(res);
      setLastCheck(new Date());
    } catch (err) {
      console.error('Failed to get system status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds?: number) => {
    if (!seconds) return '—';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <span>Infrastructure Health & Realtime Node Status</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Realtime telemetry for Express API server, Prisma SQLite, Socket.io, and WebRTC STUN
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-500 font-mono">
            Checked: {lastCheck.toLocaleTimeString()}
          </span>
          <button
            onClick={checkHealth}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Run Diagnostics</span>
          </button>
        </div>
      </div>

      {/* 2. Core Service Node Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* A. Backend Express Service */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-purple-950/80 border border-purple-800/60 text-purple-300">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">Express API Server</h3>
                <span className="text-xs text-slate-400 font-mono">Port 5000 (HTTP/1.1)</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950 border border-emerald-800 text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{status?.backend?.status || 'Online'}</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Uptime</span>
              <span className="font-mono text-slate-200 mt-0.5 block">
                {formatUptime(status?.backend?.uptimeSeconds)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Host Platform</span>
              <span className="text-slate-200 mt-0.5 block font-mono">Node.js / Windows</span>
            </div>
          </div>
        </div>

        {/* B. Database Engine */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-300">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">Database Engine</h3>
                <span className="text-xs text-slate-400 font-mono">Prisma ORM Client</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950 border border-emerald-800 text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{status?.database?.status || 'Connected'}</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Engine / Storage</span>
              <span className="text-slate-200 mt-0.5 block">{status?.database?.provider || 'SQLite'}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Query Latency</span>
              <span className="font-mono text-emerald-400 mt-0.5 block font-bold">
                {status?.database?.latencyMs ?? 0} ms
              </span>
            </div>
          </div>
        </div>

        {/* C. Realtime Socket.io Node */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-800/60 text-emerald-300">
                <Radio className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">Socket.io Signalling</h3>
                <span className="text-xs text-slate-400 font-mono">Realtime Presence & Handshake</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950 border border-emerald-800 text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{status?.realtimeSocket?.status || 'Operational'}</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Supported Transports</span>
              <span className="text-slate-200 mt-0.5 block font-mono">WebSocket, Polling</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Active Signalling Nodes</span>
              <span className="text-slate-200 mt-0.5 block font-mono">1 Cluster Instance</span>
            </div>
          </div>
        </div>

        {/* D. WebRTC Audio/Video Topology */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-indigo-950/80 border border-indigo-800/60 text-indigo-300">
                <Video className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">WebRTC Signalling & ICE</h3>
                <span className="text-xs text-slate-400 font-mono">Peer-to-Peer STUN Relay</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-950 border border-indigo-800 text-indigo-300">
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              <span>P2P Ready</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">STUN Servers</span>
              <span className="text-slate-200 mt-0.5 block font-mono text-[11px] truncate">
                stun.l.google.com:19302
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">TURN Relay</span>
              <span className="text-slate-200 mt-0.5 block font-mono text-[11px]">
                {status?.webrtc?.turnConfigured ? 'Active (TURN Relay)' : 'STUN Only (Direct P2P)'}
              </span>
            </div>
          </div>
        </div>

        {/* E. SMS Gateway Integration */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-950/80 border border-amber-800/60 text-amber-300">
                <Phone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">SMS Gateway</h3>
                <span className="text-xs text-slate-400 font-mono">
                  {status?.sms?.provider || 'DevelopmentSmsProvider'}
                </span>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                status?.sms?.configured
                  ? 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                  : 'bg-amber-950 border border-amber-800 text-amber-300'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{status?.sms?.configured ? 'Twilio Live' : 'Dev Console'}</span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Configured</span>
              <span className={`font-mono text-[11px] font-bold mt-0.5 block ${status?.sms?.configured ? 'text-emerald-400' : 'text-amber-400'}`}>
                {status?.sms?.configuredStatus || (status?.sms?.configured ? 'YES' : 'NO')}
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Sender</span>
              <span className="text-slate-200 mt-0.5 block font-mono text-[11px] truncate">
                {status?.sms?.senderNumber || 'Console Preview'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Real SMS Test</span>
              <span className={`font-bold text-[11px] mt-0.5 block ${
                status?.sms?.realSmsTest === 'PASS'
                  ? 'text-emerald-400'
                  : status?.sms?.realSmsTest === 'FAILED'
                  ? 'text-rose-400'
                  : 'text-slate-400'
              }`}>
                {status?.sms?.realSmsTest || 'NOT TESTED'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Last Test</span>
              <span className="text-slate-200 mt-0.5 block text-[11px] font-mono truncate">
                {status?.sms?.lastTestAt ? new Date(status.sms.lastTestAt).toLocaleTimeString() : 'None'}
              </span>
            </div>
          </div>
        </div>

        {/* F. Transactional Email Service */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-sky-950/80 border border-sky-800/60 text-sky-300">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">Email Dispatcher</h3>
                <span className="text-xs text-slate-400 font-mono">
                  {status?.email?.provider || 'DevelopmentEmailProvider'}
                </span>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                status?.email?.configured
                  ? 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                  : 'bg-sky-950 border border-sky-800 text-sky-300'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{status?.email?.configured ? 'Resend API' : 'Dev Console'}</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">From Address</span>
              <span className="text-slate-200 mt-0.5 block font-mono text-[11px] truncate">
                {status?.email?.fromAddress || 'notifications@propertytalk.com'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Link Protection</span>
              <span className="text-slate-200 mt-0.5 block text-[11px]">
                {status?.backend?.nodeEnv === 'production' ? 'Links Redacted' : 'Inspectable'}
              </span>
            </div>
          </div>
        </div>

        {/* G. Payments & Stripe Safety Guard */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-800/60 text-emerald-300">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">Payment Engine</h3>
                <span className="text-xs text-slate-400 font-mono">
                  {status?.payment?.provider || 'MockPaymentProvider'}
                </span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950 border border-emerald-800 text-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Live Charges Blocked</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Mode</span>
              <span className="text-slate-200 mt-0.5 block font-mono text-[11px]">
                {status?.payment?.stripeTestModeConfigured ? 'Stripe Test (sk_test_)' : 'Mock Billing'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Live Money Guard</span>
              <span className="text-emerald-400 mt-0.5 block font-bold text-[11px]">
                Active (sk_live_ Blocked)
              </span>
            </div>
          </div>
        </div>

        {/* H. Browser Web Push & In-App Alerts */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-800/60 text-rose-300">
                <Bell className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">Browser Push Provider</h3>
                <span className="text-xs text-slate-400 font-mono">
                  {status?.webPush?.provider || 'Web Push / VAPID'}
                </span>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                status?.webPush?.configured
                  ? 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                  : 'bg-purple-950 border border-purple-800 text-purple-300'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{status?.webPush?.configured ? 'VAPID Active' : 'In-App Active'}</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">VAPID Configured</span>
              <span
                className={`mt-0.5 block font-mono font-bold text-[11px] ${
                  status?.webPush?.configured ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {status?.webPush?.configured ? 'YES (RFC 8292)' : 'NO'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold block">Service Worker</span>
              <span className="text-emerald-400 mt-0.5 block font-bold text-[11px]">
                {status?.webPush?.serviceWorkerAvailable ? 'Available (/sw.js)' : 'Unavailable'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Live Platform Volume Counters */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
          Instantaneous Platform Traffic
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl text-center">
            <span className="text-[11px] text-slate-400 font-semibold block">Online Experts</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {status?.metrics?.onlineExperts ?? 0}
            </div>
          </div>
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl text-center">
            <span className="text-[11px] text-slate-400 font-semibold block">Active Calls</span>
            <div className="text-2xl font-black text-cyan-400 mt-1">
              {status?.metrics?.activeCalls ?? 0}
            </div>
          </div>
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl text-center">
            <span className="text-[11px] text-slate-400 font-semibold block">Consumers Registered</span>
            <div className="text-2xl font-black text-white mt-1">
              {status?.metrics?.totalConsumers ?? 0}
            </div>
          </div>
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl text-center">
            <span className="text-[11px] text-slate-400 font-semibold block">Total Experts</span>
            <div className="text-2xl font-black text-white mt-1">
              {status?.metrics?.totalExperts ?? 0}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
