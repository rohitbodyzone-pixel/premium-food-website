import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../AdminAuthContext';
import {
  Users,
  Award,
  ShieldCheck,
  Clock,
  Radio,
  PhoneCall,
  Calendar,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Activity,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadOverview = async () => {
    try {
      const res = await adminApi.get<any>('/admin/overview');
      setData(res);
    } catch (err) {
      console.error('Failed to load overview data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-900 border border-slate-800 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const kpis = [
    { label: 'Total Customers', value: data?.totalConsumers ?? 0, icon: Users, color: 'text-blue-400', bg: 'bg-blue-950/40 border-blue-800/40' },
    { label: 'Total Experts', value: data?.totalExperts ?? 0, icon: Award, color: 'text-purple-400', bg: 'bg-purple-950/40 border-purple-800/40' },
    { label: 'Verified Experts', value: data?.verifiedExperts ?? 0, icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-950/40 border-emerald-800/40' },
    { label: 'Pending Verification', value: data?.pendingVerificationCount ?? 0, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-950/40 border-amber-800/40' },
    { label: 'Online Experts', value: data?.onlineExperts ?? 0, icon: Radio, color: 'text-emerald-400', bg: 'bg-emerald-950/40 border-emerald-800/40' },
    { label: 'Busy Experts', value: data?.busyExperts ?? 0, icon: Activity, color: 'text-rose-400', bg: 'bg-rose-950/40 border-rose-800/40' },
    { label: 'Total Consultations', value: data?.totalCalls ?? 0, icon: PhoneCall, color: 'text-cyan-400', bg: 'bg-cyan-950/40 border-cyan-800/40' },
    { label: 'Total Appointments', value: data?.totalAppointments ?? 0, icon: Calendar, color: 'text-indigo-400', bg: 'bg-indigo-950/40 border-indigo-800/40' },
  ];

  return (
    <div className="space-y-8">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">
            Platform Operations & Intelligence
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time advisory activity across New Zealand and Australia
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadOverview}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700 transition"
          >
            Refresh Metrics
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards (8 Metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className={`p-4 rounded-2xl border ${kpi.bg} shadow-md flex items-center justify-between`}
            >
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block">{kpi.label}</span>
                <div className="text-2xl font-black text-white mt-1">{kpi.value}</div>
              </div>
              <div className={`p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 ${kpi.color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Platform Alerts Section */}
      {data?.platformAlerts && data.platformAlerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Operational Alerts
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {data.platformAlerts.map((alert: any) => (
              <div
                key={alert.id}
                className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
                  alert.type === 'WARNING'
                    ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                    : alert.type === 'INFO'
                    ? 'bg-blue-950/40 border-blue-800/60 text-blue-200'
                    : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                }`}
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <div className="font-bold">{alert.title}</div>
                  <div className="text-[11px] opacity-80 mt-0.5 leading-relaxed">{alert.message}</div>
                  {alert.link && (
                    <Link
                      to={alert.link}
                      className="inline-flex items-center gap-1 font-bold text-[11px] mt-1.5 underline hover:no-underline"
                    >
                      <span>Take Action</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Two-Column Row: Pending Verifications & Live Expert Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* A. Pending Expert Verifications */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Pending Expert Verifications</h3>
            </div>
            <Link
              to="/verification"
              className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              <span>View All Queue ({data?.pendingVerificationCount ?? 0})</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {data?.pendingExperts && data.pendingExperts.length > 0 ? (
            <div className="space-y-2">
              {data.pendingExperts.map((exp: any) => (
                <div
                  key={exp.id}
                  className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white truncate">{exp.user?.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 font-semibold border border-amber-800">
                        {exp.countryCode}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 block truncate">
                      {exp.title} • {exp.businessName}
                    </span>
                  </div>
                  <Link
                    to="/verification"
                    className="px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shrink-0 transition"
                  >
                    Review
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-500">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mx-auto mb-2" />
              Verification queue is completely clear. No pending applications.
            </div>
          )}
        </div>

        {/* B. Live Expert Presence */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Live Expert Status</h3>
            </div>
            <Link
              to="/experts"
              className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              <span>All Professionals</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {data?.liveExperts && data.liveExperts.length > 0 ? (
            <div className="space-y-2">
              {data.liveExperts.map((exp: any) => (
                <div
                  key={exp.id}
                  className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">{exp.user?.name}</span>
                      <span className="text-[10px] text-slate-400">({exp.countryCode})</span>
                    </div>
                    <span className="text-[11px] text-slate-400 block">
                      {exp.category?.name}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                      exp.presence === 'BUSY'
                        ? 'bg-rose-950 text-rose-300 border-rose-800'
                        : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${exp.presence === 'BUSY' ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                    {exp.presence}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-500">
              No verified professionals are currently online.
            </div>
          )}
        </div>
      </div>

      {/* 5. Recent Consultations & Appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Consultations */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-cyan-400" />
              <span>Recent Consultations</span>
            </h3>
            <Link to="/consultations" className="text-xs font-bold text-purple-400 hover:text-purple-300">
              View Log &rarr;
            </Link>
          </div>

          <div className="space-y-2">
            {data?.recentConsultations && data.recentConsultations.length > 0 ? (
              data.recentConsultations.map((c: any) => (
                <div
                  key={c.id}
                  className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-white">
                      {c.consumer?.name || 'Consumer'} &rarr; {c.expert?.user?.name || 'Expert'}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Type: {c.callType} • Duration: {c.durationSeconds || 0}s • Status: {c.status}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-purple-300 font-bold">
                    ${(c.costCharged || 0).toFixed(2)}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-slate-500">No consultation records yet.</div>
            )}
          </div>
        </div>

        {/* Recent Appointments */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>Recent Appointments</span>
            </h3>
            <Link to="/appointments" className="text-xs font-bold text-purple-400 hover:text-purple-300">
              View All &rarr;
            </Link>
          </div>

          <div className="space-y-2">
            {data?.recentAppointments && data.recentAppointments.length > 0 ? (
              data.recentAppointments.map((a: any) => (
                <div
                  key={a.id}
                  className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-white">
                      {a.consumer?.name || 'Consumer'} with {a.expert?.user?.name || 'Expert'}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Date: {a.date} at {a.startTime} • Status: {a.status}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300">
                    {a.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-slate-500">No appointments scheduled yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
