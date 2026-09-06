import React, { useState, useEffect } from 'react';
import { adminApi } from '../AdminAuthContext';
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  FileText,
  Building2,
  Phone,
  Mail,
  Search,
  UserCheck,
  Filter,
} from 'lucide-react';

export const VerificationView: React.FC = () => {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED'>('ALL');
  const [search, setSearch] = useState('');

  // Modal review state
  const [selectedExpert, setSelectedExpert] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'REQUEST_INFO' | 'SUSPEND' | 'REQUIRE_REVERIFICATION'>('APPROVE');
  const [actionNotes, setActionNotes] = useState('');
  const [actionSource, setActionSource] = useState('Official Public Register Check');
  const [processing, setProcessing] = useState(false);
  const [confirmPrompt, setConfirmPrompt] = useState(false);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const url = statusFilter === 'ALL' ? '/admin/verification-queue' : `/admin/verification-queue?status=${statusFilter}`;
      const res = await adminApi.get<any[]>(url);
      setQueue(res);
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [statusFilter]);

  const executeAction = async () => {
    if (!selectedExpert) return;
    setProcessing(true);
    try {
      await adminApi.post(`/admin/verify/${selectedExpert.id}`, {
        action: actionType,
        notes: actionNotes.trim() || `Admin action: ${actionType}`,
        source: actionSource,
      });

      setSelectedExpert(null);
      setConfirmPrompt(false);
      setActionNotes('');
      loadQueue();
    } catch (err: any) {
      alert(err.message || 'Failed to update verification status');
    } finally {
      setProcessing(false);
    }
  };

  const filteredQueue = queue.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.user?.name?.toLowerCase().includes(q) ||
      item.businessName?.toLowerCase().includes(q) ||
      item.title?.toLowerCase().includes(q) ||
      item.licenseNumber?.toLowerCase().includes(q) ||
      item.user?.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">
            Expert Credential Verification
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit professional licenses against official NZ and AU government registries
          </p>
        </div>
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-2 rounded-2xl">
        <div className="flex items-center gap-1 overflow-x-auto">
          {[
            { label: 'All Applications', value: 'ALL' },
            { label: 'Pending Review', value: 'PENDING_VERIFICATION' },
            { label: 'Verified Experts', value: 'VERIFIED' },
            { label: 'Rejected', value: 'REJECTED' },
            { label: 'Suspended', value: 'SUSPENDED' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                statusFilter === tab.value
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, license, business..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
          />
        </div>
      </div>

      {/* Verification Queue Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-md">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading verification queue...</div>
        ) : filteredQueue.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mx-auto mb-2" />
            No applications match the current filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Expert</th>
                  <th className="py-3 px-4">Profession & Category</th>
                  <th className="py-3 px-4">Jurisdiction</th>
                  <th className="py-3 px-4">License / Reg Number</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredQueue.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                          alt=""
                          className="w-9 h-9 rounded-xl object-cover border border-slate-700 shrink-0"
                        />
                        <div className="overflow-hidden">
                          <span className="font-bold text-white block truncate">{item.user?.name}</span>
                          <span className="text-[11px] text-slate-400 block truncate">{item.user?.email}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-semibold text-white block">{item.title}</span>
                      <span className="text-[11px] text-purple-300 block">{item.category?.name}</span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{item.country?.flag}</span>
                        <span className="font-medium text-white">{item.countryCode}</span>
                        <span className="text-[11px] text-slate-400">• {item.city}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-mono text-purple-200 font-bold block">{item.licenseNumber || 'N/A'}</span>
                      <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">{item.businessName}</span>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          item.verificationStatus === 'VERIFIED'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            : item.verificationStatus === 'PENDING_VERIFICATION'
                            ? 'bg-amber-950 text-amber-300 border-amber-800 animate-pulse'
                            : item.verificationStatus === 'SUSPENDED'
                            ? 'bg-rose-950 text-rose-300 border-rose-800'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {item.verificationStatus}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedExpert(item);
                          setActionType(item.verificationStatus === 'VERIFIED' ? 'SUSPEND' : 'APPROVE');
                          setConfirmPrompt(false);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-xs transition"
                      >
                        Audit Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Verification Detailed Audit Modal */}
      {selectedExpert && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl text-white space-y-6 my-8">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <img
                  src={selectedExpert.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                  alt=""
                  className="w-12 h-12 rounded-2xl object-cover border border-slate-700 shrink-0"
                />
                <div>
                  <h3 className="text-lg font-black text-white">{selectedExpert.user?.name}</h3>
                  <p className="text-xs text-slate-400">
                    {selectedExpert.title} • {selectedExpert.category?.name} ({selectedExpert.countryCode})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedExpert(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* 1. Identity & Registration Details */}
            <div className="grid grid-cols-2 gap-3 bg-slate-950/70 p-4 rounded-2xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 font-semibold block text-[10px]">Professional Licence / Reg #</span>
                <span className="font-mono font-bold text-purple-300 text-sm">{selectedExpert.licenseNumber || 'Not provided'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block text-[10px]">Business Registration (NZBN/ABN)</span>
                <span className="font-mono font-bold text-slate-200">{selectedExpert.businessRegNumber || 'Not provided'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block text-[10px]">Practice / Company</span>
                <span className="font-semibold text-slate-200">{selectedExpert.businessName}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block text-[10px]">Contact</span>
                <span className="text-slate-200">{selectedExpert.user?.email} • {selectedExpert.user?.phone || 'No phone'}</span>
              </div>
            </div>

            {/* 2. Official Register External Link */}
            {selectedExpert.officialRegister ? (
              <div className="p-3.5 bg-purple-950/40 border border-purple-800/60 rounded-2xl text-xs flex items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-purple-300 block">Official Public Register Check:</span>
                  <span className="text-[11px] text-slate-400">{selectedExpert.officialRegister.title}</span>
                </div>
                <a
                  href={selectedExpert.officialRegister.urlPattern}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 transition"
                >
                  <span>Open Registry</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ) : (
              <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-2xl text-xs text-slate-500">
                No automated official register URL configured for {selectedExpert.countryCode} {selectedExpert.category?.name}.
              </div>
            )}

            {/* 3. Uploaded Verification Documents */}
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Verification Documents ({selectedExpert.documents?.length || 0})
              </h4>
              {selectedExpert.documents && selectedExpert.documents.length > 0 ? (
                <div className="space-y-1.5">
                  {selectedExpert.documents.map((doc: any) => (
                    <div
                      key={doc.id}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-purple-400 shrink-0" />
                        <div>
                          <span className="font-semibold text-white block">{doc.title}</span>
                          <span className="text-[10px] text-slate-500">Type: {doc.docType}</span>
                        </div>
                      </div>
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-purple-400 hover:underline flex items-center gap-1"
                      >
                        <span>View Document</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-500 text-center">
                  No separate document files uploaded. Verification relies on direct public license registration number.
                </div>
              )}
            </div>

            {/* 4. Action Selector & Audit Notes */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <label className="block text-xs font-bold text-slate-300">
                Select Administrative Verification Decision:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Approve & Verify', value: 'APPROVE', color: 'bg-emerald-600 hover:bg-emerald-500' },
                  { label: 'Reject', value: 'REJECT', color: 'bg-rose-600 hover:bg-rose-500' },
                  { label: 'Request More Info', value: 'REQUEST_INFO', color: 'bg-amber-600 hover:bg-amber-500' },
                  { label: 'Suspend Expert', value: 'SUSPEND', color: 'bg-slate-700 hover:bg-slate-600' },
                ].map((act) => (
                  <button
                    key={act.value}
                    type="button"
                    onClick={() => {
                      setActionType(act.value as any);
                      setConfirmPrompt(false);
                    }}
                    className={`p-2 rounded-xl text-xs font-bold transition border ${
                      actionType === act.value
                        ? 'bg-purple-600 text-white border-purple-400 shadow-md'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {act.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Audit Log Notes (Reason for decision):
                </label>
                <input
                  type="text"
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder={`e.g. Verified registration #${selectedExpert.licenseNumber} on official authority register`}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
              </div>

              {/* Confirmation Step */}
              {confirmPrompt ? (
                <div className="p-4 rounded-2xl bg-purple-950/80 border border-purple-800 flex items-center justify-between gap-4">
                  <span className="text-xs font-bold text-purple-200">
                    Are you sure you want to execute action: <strong>{actionType}</strong> for {selectedExpert.user?.name}?
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setConfirmPrompt(false)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={executeAction}
                      disabled={processing}
                      className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md"
                    >
                      {processing ? 'Recording...' : 'Confirm & Save Audit'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmPrompt(true)}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition"
                >
                  Proceed with Decision: {actionType}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
