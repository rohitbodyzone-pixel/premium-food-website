import React, { useState, useEffect } from 'react';
import { adminApi } from '../AdminAuthContext';
import {
  PhoneCall,
  Video,
  Phone,
  Clock,
  DollarSign,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export const ConsultationsView: React.FC = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [callType, setCallType] = useState('ALL');
  const [status, setStatus] = useState('ALL');

  const loadSessions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (callType !== 'ALL') params.set('type', callType);
      if (status !== 'ALL') params.set('status', status);

      const res = await adminApi.get<any[]>(`/admin/consultations?${params.toString()}`);
      setSessions(res);
    } catch (err) {
      console.error('Failed to load consultations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [callType, status]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-cyan-400" />
            <span>Consultations & Live Signalling Records</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit realtime audio/video advisory sessions, durations, and free tier allocations
          </p>
        </div>
        <button
          onClick={loadSessions}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Consultations</span>
        </button>
      </div>

      {/* 2. Privacy & Compliance Banner */}
      <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-800/60 text-cyan-200 text-xs flex items-start gap-3">
        <ShieldAlert className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-white block font-bold">Privacy-Preserving Teleconsultation Auditing</strong>
          Under New Zealand Privacy Act 2020 and Australian Privacy Principles, customer consultation audio and video streams are peer-to-peer encrypted. Administrators can inspect session metadata, timestamp logs, durations, and billing metrics, but not communication contents.
        </div>
      </div>

      {/* 3. Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Session Type:</span>
            <select
              value={callType}
              onChange={(e) => setCallType(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none"
            >
              <option value="ALL">All Types (Audio & Video)</option>
              <option value="AUDIO">Audio Call</option>
              <option value="VIDEO">Video Conference</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Status:</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="CONNECTED">In Progress (Active)</option>
              <option value="INITIATED">Initiated</option>
              <option value="MISSED">Missed / Unanswered</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>

        <span className="text-slate-500 font-medium">
          Showing {sessions.length} consultation record{sessions.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* 4. Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 font-bold border-b border-slate-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Session</th>
                <th className="py-3 px-4">Participants</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Free Tier (1 Min)</th>
                <th className="py-3 px-4">Billed Cost</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Loading consultation logs...
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No consultation sessions found matching the filters.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => {
                  const isCompleted = s.status === 'COMPLETED';
                  const isConnected = s.status === 'CONNECTED';

                  return (
                    <tr key={s.id} className="hover:bg-slate-800/30 transition">
                      {/* Session ID */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                        {s.id.substring(0, 8)}...
                      </td>

                      {/* Participants */}
                      <td className="py-3.5 px-4">
                        <div className="text-white font-bold">
                          {s.consumer?.name || 'Consumer'}
                        </div>
                        <div className="text-[11px] text-purple-400 mt-0.5">
                          &rarr; {s.expert?.user?.name} ({s.expert?.category?.name})
                        </div>
                      </td>

                      {/* Type */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-semibold text-slate-200">
                          {s.callType === 'VIDEO' ? (
                            <Video className="w-3.5 h-3.5 text-cyan-400" />
                          ) : (
                            <Phone className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                          <span>{s.callType}</span>
                        </span>
                      </td>

                      {/* Duration */}
                      <td className="py-3.5 px-4 font-mono font-medium text-white">
                        {formatDuration(s.durationSeconds)}
                      </td>

                      {/* Free Tier */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                          <Sparkles className="w-3 h-3" />
                          <span>{s.freeSecondsUsed || 60}s applied</span>
                        </span>
                      </td>

                      {/* Cost */}
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        ${(s.costCharged || 0).toFixed(2)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                            isCompleted
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                              : isConnected
                              ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {isCompleted && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                          {isConnected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                          <span>{s.status}</span>
                        </span>
                      </td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-4 text-right text-slate-400 text-[11px]">
                        {new Date(s.createdAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
