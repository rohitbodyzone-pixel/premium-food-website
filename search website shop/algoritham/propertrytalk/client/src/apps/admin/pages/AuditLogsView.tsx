import React, { useState, useEffect } from 'react';
import { adminApi } from '../AdminAuthContext';
import {
  FileText,
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Ban,
  Settings,
  RefreshCw,
  Clock,
  User,
} from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<any[]>('/admin/audit-logs');
      setLogs(res);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        log.action?.toLowerCase().includes(q) ||
        log.notes?.toLowerCase().includes(q) ||
        log.source?.toLowerCase().includes(q) ||
        log.adminUser?.name?.toLowerCase().includes(q) ||
        log.expertProfile?.user?.name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'APPROVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>APPROVE</span>
          </span>
        );
      case 'REJECT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800">
            <XCircle className="w-3 h-3 text-rose-400" />
            <span>REJECT</span>
          </span>
        );
      case 'SUSPEND':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800">
            <Ban className="w-3 h-3 text-rose-400" />
            <span>SUSPEND</span>
          </span>
        );
      case 'REQUEST_INFO':
      case 'REQUIRE_REVERIFICATION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>{action}</span>
          </span>
        );
      case 'CONFIG_UPDATE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800">
            <Settings className="w-3 h-3 text-cyan-400" />
            <span>CONFIG_UPDATE</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
            <span>{action}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            <span>Immutable Administrative Audit Log</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cryptographically recorded trail of credential audits, suspensions, approvals, and platform edits
          </p>
        </div>
        <button
          onClick={loadLogs}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Audit Trail</span>
        </button>
      </div>

      {/* 2. Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Action:</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none"
            >
              <option value="ALL">All Actions</option>
              <option value="APPROVE">Approve</option>
              <option value="REJECT">Reject</option>
              <option value="SUSPEND">Suspend</option>
              <option value="REQUEST_INFO">Request Info</option>
              <option value="CONFIG_UPDATE">Config Update</option>
            </select>
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search audit trail notes or names..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            />
          </div>
        </div>

        <span className="text-slate-500 font-medium">
          {filteredLogs.length} audit event{filteredLogs.length === 1 ? '' : 's'} recorded
        </span>
      </div>

      {/* 3. Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 font-bold border-b border-slate-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Admin Officer</th>
                <th className="py-3 px-4">Target / Entity</th>
                <th className="py-3 px-4">Audit Notes & Justification</th>
                <th className="py-3 px-4">Source System</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Loading audit trail...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No audit records match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition">
                    {/* Action */}
                    <td className="py-3.5 px-4">
                      {getActionBadge(log.action)}
                    </td>

                    {/* Admin User */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white text-xs">{log.adminUser?.name || 'Super Admin'}</div>
                      <div className="text-[10px] text-slate-400">{log.adminUser?.email}</div>
                    </td>

                    {/* Target */}
                    <td className="py-3.5 px-4">
                      {log.expertProfile ? (
                        <div>
                          <div className="font-semibold text-purple-300 text-xs">
                            {log.expertProfile.user?.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {log.expertProfile.title || log.expertProfile.businessName}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500 font-mono text-[11px]">System Platform</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="py-3.5 px-4 max-w-md">
                      <p className="text-slate-200 text-xs leading-relaxed">
                        {log.notes}
                      </p>
                    </td>

                    {/* Source */}
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400">
                        {log.source || 'Super Admin Console'}
                      </span>
                    </td>

                    {/* Timestamp */}
                    <td className="py-3.5 px-4 text-right text-slate-400 text-[11px] font-mono">
                      {new Date(log.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
