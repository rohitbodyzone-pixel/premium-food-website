import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import {
  Bell,
  Mail,
  Smartphone,
  Radio,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react';

interface NotificationLog {
  id: string;
  userId?: string | null;
  type: string;
  channel: string;
  status: string;
  provider: string;
  referenceId?: string | null;
  createdAt: string;
}

export const NotificationLogsView: React.FC = () => {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await api.get<NotificationLog[]>('/notifications/logs?limit=100');
      setLogs(data || []);
    } catch (err) {
      console.error('Failed to load notification logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (channelFilter !== 'ALL' && log.channel !== channelFilter) return false;
    if (statusFilter !== 'ALL' && log.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        log.type.toLowerCase().includes(q) ||
        (log.userId && log.userId.toLowerCase().includes(q)) ||
        log.provider.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'EMAIL':
        return <Mail className="w-3.5 h-3.5 text-blue-400" />;
      case 'PUSH':
        return <Smartphone className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <Radio className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
            DELIVERED
          </span>
        );
      case 'SENT_CONSOLE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/80 text-blue-300 border border-blue-800">
            DEV CONSOLE
          </span>
        );
      case 'SKIPPED_PREFERENCE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800">
            SKIPPED PREF
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black tracking-tight text-white">
              Notification & Email Delivery Logs
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 text-[10px] font-bold border border-purple-700">
              Audit Trail
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time audit record of all in-app socket alerts, transactional emails, OTP dispatches, and push notifications.
          </p>
        </div>

        <button
          onClick={loadLogs}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Provider Status Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-950/60 border border-blue-800 flex items-center justify-center text-blue-400">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-white">Email Provider</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-blue-900/40 text-blue-300">
                ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {process.env.RESEND_API_KEY ? 'Production (Resend API)' : 'DEVELOPMENT EMAIL MODE (Console)'}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800 flex items-center justify-center text-emerald-400">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-white">In-App Socket.io</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-900/40 text-emerald-300">
                ONLINE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Bi-directional real-time alert engine connected
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-800 flex items-center justify-center text-purple-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-white">Web Push Foundation</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-purple-900/40 text-purple-300">
                READY
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              VAPID subscription subscription endpoint active
            </p>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search type, user, or provider..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-purple-500 outline-hidden"
            />
          </div>

          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="p-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-300 focus:ring-1 focus:ring-purple-500 outline-hidden"
          >
            <option value="ALL">All Channels</option>
            <option value="IN_APP">In-App</option>
            <option value="EMAIL">Email</option>
            <option value="PUSH">Push</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-300 focus:ring-1 focus:ring-purple-500 outline-hidden"
          >
            <option value="ALL">All Statuses</option>
            <option value="DELIVERED">Delivered</option>
            <option value="SENT_CONSOLE">Dev Console</option>
            <option value="SKIPPED_PREFERENCE">Skipped (Pref)</option>
          </select>
        </div>

        <span className="text-[11px] text-slate-400">
          Showing {filteredLogs.length} events
        </span>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/60 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">User ID / Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300 font-medium">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">
                      {log.type}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        {getChannelIcon(log.channel)}
                        <span>{log.channel}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {log.provider}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(log.status)}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[10px] truncate max-w-[140px]">
                      {log.userId || log.referenceId || 'N/A'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No notification events match the filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default NotificationLogsView;
