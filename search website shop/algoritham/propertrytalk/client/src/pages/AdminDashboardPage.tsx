import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Users,
  Clock,
  Settings,
  PhoneCall,
  Save,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'queue' | 'config' | 'calls'>('queue');

  // Config edit state
  const [freeDurationInput, setFreeDurationInput] = useState('60');
  const [updatingConfig, setUpdatingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState('');

  // Selected expert action modal
  const [actionExpert, setActionExpert] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'REQUEST_INFO' | 'SUSPEND'>('APPROVE');
  const [actionNotes, setActionNotes] = useState('');
  const [actionSource, setActionSource] = useState('Official Public Register Check');
  const [actionProcessing, setActionProcessing] = useState(false);

  const loadAdminData = async () => {
    try {
      const [statsData, queueData, callsData, configsData] = await Promise.all([
        api.get<any>('/admin/overview'),
        api.get<any[]>('/admin/verification-queue'),
        api.get<any[]>('/admin/calls'),
        api.get<any[]>('/admin/config'),
      ]);

      setStats(statsData);
      setQueue(queueData);
      setCalls(callsData);
      setConfigs(configsData);

      const freeDuration = configsData.find((c: any) => c.key === 'free_call_duration_seconds');
      if (freeDuration) {
        setFreeDurationInput(freeDuration.value);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'SUPER_ADMIN') {
      // If not admin, alert or redirect
      navigate('/');
      return;
    }
    loadAdminData();
  }, [user]);

  const handleUpdateFreeDuration = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingConfig(true);
    setConfigSuccess('');

    try {
      await api.put('/admin/config/free_call_duration_seconds', {
        value: freeDurationInput,
        description: 'Default free audio/video consultation duration in seconds',
      });
      setConfigSuccess(`Free consultation duration updated to ${freeDurationInput} seconds (${Math.round(parseInt(freeDurationInput, 10)/60)} mins)!`);
      setTimeout(() => setConfigSuccess(''), 3000);
      loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to update configuration');
    } finally {
      setUpdatingConfig(false);
    }
  };

  const executeVerificationAction = async () => {
    if (!actionExpert) return;
    setActionProcessing(true);

    try {
      await api.post(`/admin/verify/${actionExpert.id}`, {
        action: actionType,
        notes: actionNotes.trim() || `Admin manual verification: ${actionType}`,
        source: actionSource,
      });

      setActionExpert(null);
      setActionNotes('');
      loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to execute verification action');
    } finally {
      setActionProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 animate-pulse h-96" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-24">
      {/* Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/40 flex items-center justify-center font-bold">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Super Admin Console
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manual professional verification, public register links, configurable consultation timer, and audit logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
            Phase 1 Foundation Active
          </span>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-semibold block">Pending Queue</span>
          <div className="text-2xl font-extrabold text-amber-600 mt-1">
            {stats?.pendingVerificationCount ?? 0}
          </div>
          <span className="text-[10px] text-slate-400">Applications awaiting review</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-semibold block">Verified Experts</span>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">
            {stats?.verifiedExperts ?? 0}
          </div>
          <span className="text-[10px] text-slate-400">Across NZ and Australia</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-semibold block">Online Right Now</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">
            {stats?.onlineExperts ?? 0}
          </div>
          <span className="text-[10px] text-slate-400">Available for instant calls</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-semibold block">Free Call Duration</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">
            {stats?.freeCallDurationSeconds ?? 60}s
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold">Configurable Globally</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-6">
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'queue' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Verification Queue ({queue.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'config' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Timer & Pricing Config</span>
        </button>

        <button
          onClick={() => setActiveTab('calls')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'calls' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <PhoneCall className="w-4 h-4" />
          <span>Call Records Audit ({calls.length})</span>
        </button>
      </div>

      {/* TAB 1: Verification Queue */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          {queue.map((exp) => {
            const registerLink = exp.officialRegister?.urlPattern || (exp.countryCode === 'NZ' ? 'https://www.rea.govt.nz/public-register/' : 'https://www.onegov.nsw.gov.au/publicregister/');
            const registerTitle = exp.officialRegister?.title || `${exp.countryCode} Official Register`;

            return (
              <div
                key={exp.id}
                className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs hover:border-slate-300 transition"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <img
                      src={exp.photoUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80'}
                      alt={exp.user?.name}
                      className="w-14 h-14 rounded-2xl object-cover shrink-0 border border-slate-100"
                    />

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-slate-900">
                          {exp.user?.name}
                        </h3>
                        <span className="text-sm">{exp.country?.flag}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            exp.verificationStatus === 'VERIFIED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : exp.verificationStatus === 'PENDING_VERIFICATION'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {exp.verificationStatus}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 mt-0.5">
                        {exp.category?.name} • {exp.city}, {exp.country?.name}
                      </p>

                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">
                        <div>
                          <span className="text-slate-400">Licence / Reg #:</span>{' '}
                          <strong className="font-mono text-slate-900">{exp.licenseNumber || 'None provided'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">Business Name:</span>{' '}
                          <strong className="text-slate-900">{exp.businessName}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">Business ID:</span>{' '}
                          <span className="text-slate-700">{exp.businessRegNumber || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Payout Details:</span>{' '}
                          <span className="text-slate-700">{exp.payoutDetails || 'None'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Official Register Check */}
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0">
                    {/* Official Register Link */}
                    <a
                      href={registerLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition flex items-center justify-center gap-1.5"
                      title="Open official register to verify license number"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Official Register</span>
                    </a>

                    {/* Verification Actions Modal Trigger */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setActionExpert(exp);
                          setActionType('APPROVE');
                          setActionNotes(`Verified ${exp.licenseNumber} on ${registerTitle}`);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
                      >
                        Approve
                      </button>

                      <button
                        onClick={() => {
                          setActionExpert(exp);
                          setActionType('REJECT');
                          setActionNotes('Unable to locate license on official public register');
                        }}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition"
                      >
                        Reject
                      </button>

                      <button
                        onClick={() => {
                          setActionExpert(exp);
                          setActionType('SUSPEND');
                          setActionNotes('Suspended pending license re-verification');
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
                      >
                        Suspend
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: Config Management */}
      {activeTab === 'config' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs max-w-2xl">
          <h2 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            <span>Consultation Timer & Free Minutes Configuration</span>
          </h2>
          <p className="text-xs text-slate-500 mb-6">
            Requirement: "The default free consultation duration is 1 minute (60 seconds), configurable so Super Admin can change it globally or eventually per country/category."
          </p>

          {configSuccess && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{configSuccess}</span>
            </div>
          )}

          <form onSubmit={handleUpdateFreeDuration} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Free Call Duration (in Seconds)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="30"
                  max="600"
                  step="10"
                  value={freeDurationInput}
                  onChange={(e) => setFreeDurationInput(e.target.value)}
                  className="w-40 text-sm font-mono font-bold p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden"
                />
                <span className="text-xs text-slate-600 font-medium">
                  = <strong>{Math.round(parseInt(freeDurationInput || '0', 10) / 60)} minutes</strong> ({freeDurationInput} seconds)
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">
                Server-authoritative timer uses this value for all newly connected calls.
              </span>
            </div>

            <button
              type="submit"
              disabled={updatingConfig}
              className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{updatingConfig ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: Call Records Audit */}
      {activeTab === 'calls' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 mb-4">
            Call Audit Records ({calls.length})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-400 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="p-3">Session ID</th>
                  <th className="p-3">Consumer</th>
                  <th className="p-3">Expert</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3">Paid Charged</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calls.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="p-3 font-mono text-slate-400">{c.id.slice(0, 8)}...</td>
                    <td className="p-3 font-semibold text-slate-900">{c.consumer?.name || 'Customer'}</td>
                    <td className="p-3 font-semibold text-slate-900">{c.expert?.user?.name || 'Expert'}</td>
                    <td className="p-3">{c.callType}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100">
                        {c.status}
                      </span>
                    </td>
                    <td className="p-3">{c.durationSeconds}s</td>
                    <td className="p-3 font-bold text-emerald-600">${c.costCharged || '0.00'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Verification Decision Modal */}
      {actionExpert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Confirm Verification Action
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Updating status for <strong>{actionExpert.user?.name}</strong> ({actionExpert.country?.name} {actionExpert.category?.name}).
            </p>

            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Action
                </label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as any)}
                  className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="APPROVE">APPROVE (Set to Verified, enable Online consultations)</option>
                  <option value="REJECT">REJECT (Application rejected)</option>
                  <option value="REQUEST_INFO">REQUEST_INFO (Awaiting more documents)</option>
                  <option value="SUSPEND">SUSPEND (Revoke access and force offline)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Verification Source
                </label>
                <input
                  type="text"
                  value={actionSource}
                  onChange={(e) => setActionSource(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Audit Notes
                </label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  rows={2}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActionExpert(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionProcessing}
                onClick={executeVerificationAction}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
              >
                {actionProcessing ? 'Processing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
