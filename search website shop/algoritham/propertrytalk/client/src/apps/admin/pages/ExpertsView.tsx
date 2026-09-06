import React, { useState, useEffect } from 'react';
import { adminApi } from '../AdminAuthContext';
import {
  Award,
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Radio,
  ExternalLink,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Ban,
  UserCheck,
  Building2,
  RefreshCw,
} from 'lucide-react';

export const ExpertsView: React.FC = () => {
  const [experts, setExperts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [verificationStatus, setVerificationStatus] = useState('ALL');
  const [onlineFilter, setOnlineFilter] = useState('ALL');

  // Action modal state
  const [selectedExpert, setSelectedExpert] = useState<any | null>(null);
  const [actionVerificationStatus, setActionVerificationStatus] = useState('VERIFIED');
  const [actionAccountStatus, setActionAccountStatus] = useState('ACTIVE');
  const [actionNotes, setActionNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (country !== 'ALL') params.set('country', country);
      if (category !== 'ALL') params.set('category', category);
      if (verificationStatus !== 'ALL') params.set('verificationStatus', verificationStatus);
      if (onlineFilter !== 'ALL') params.set('isOnline', onlineFilter === 'ONLINE' ? 'true' : 'false');

      const [expertsRes, catsRes] = await Promise.all([
        adminApi.get<any[]>(`/admin/experts?${params.toString()}`),
        adminApi.get<any[]>('/admin/categories'),
      ]);
      setExperts(expertsRes);
      setCategories(catsRes);
    } catch (err) {
      console.error('Failed to load experts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [country, category, verificationStatus, onlineFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const openActionModal = (expert: any) => {
    setSelectedExpert(expert);
    setActionVerificationStatus(expert.verificationStatus);
    setActionAccountStatus(expert.user?.accountStatus || 'ACTIVE');
    setActionNotes('');
  };

  const handleSaveStatus = async () => {
    if (!selectedExpert) return;
    setUpdating(true);
    try {
      await adminApi.patch(`/admin/experts/${selectedExpert.id}/status`, {
        verificationStatus: actionVerificationStatus,
        accountStatus: actionAccountStatus,
        notes: actionNotes.trim() || `Status updated to ${actionVerificationStatus} / ${actionAccountStatus}`,
      });
      setSelectedExpert(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update expert status');
    } finally {
      setUpdating(false);
    }
  };

  const handleQuickToggleSuspension = async (expert: any) => {
    const isSuspended = expert.verificationStatus === 'SUSPENDED';
    const nextStatus = isSuspended ? 'VERIFIED' : 'SUSPENDED';
    const nextAccStatus = isSuspended ? 'ACTIVE' : 'SUSPENDED';
    const confirmMsg = isSuspended
      ? `Reactivate expert ${expert.user?.name}? This will restore their verified listing.`
      : `Suspend expert ${expert.user?.name}? They will immediately be taken offline and hidden from public search.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await adminApi.patch(`/admin/experts/${expert.id}/status`, {
        verificationStatus: nextStatus,
        accountStatus: nextAccStatus,
        notes: isSuspended ? 'Expert account reactivated by admin' : 'Expert account suspended by admin',
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle status');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-400" />
            <span>Expert Directory & Professional Management</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage verified property professionals, licensing records, availability, and suspensions
          </p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Directory</span>
        </button>
      </div>

      {/* 2. Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          {/* Search input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email, business name, or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition"
          >
            Search
          </button>
        </form>

        {/* Dropdown filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800 text-xs">
          {/* Country */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Country:</span>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none"
            >
              <option value="ALL">All Countries</option>
              <option value="NZ">New Zealand (NZ)</option>
              <option value="AU">Australia (AU)</option>
            </select>
          </div>

          {/* Category */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Category:</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Verification Status */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Verification:</span>
            <select
              value={verificationStatus}
              onChange={(e) => setVerificationStatus(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="VERIFIED">Verified</option>
              <option value="PENDING_VERIFICATION">Pending Verification</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Online Presence */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Presence:</span>
            <select
              value={onlineFilter}
              onChange={(e) => setOnlineFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none"
            >
              <option value="ALL">All States</option>
              <option value="ONLINE">Online Now</option>
              <option value="OFFLINE">Offline</option>
            </select>
          </div>

          <span className="text-slate-500 ml-auto font-medium">
            Found {experts.length} expert{experts.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* 3. Experts Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 font-bold border-b border-slate-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Professional</th>
                <th className="py-3 px-4">Category & Jurisdiction</th>
                <th className="py-3 px-4">License / Registration</th>
                <th className="py-3 px-4">Verification</th>
                <th className="py-3 px-4">Presence</th>
                <th className="py-3 px-4">Activity</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Loading experts directory...
                  </td>
                </tr>
              ) : experts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No professionals match the selected criteria.
                  </td>
                </tr>
              ) : (
                experts.map((expert) => {
                  const isVerified = expert.verificationStatus === 'VERIFIED';
                  const isPending = expert.verificationStatus === 'PENDING_VERIFICATION';
                  const isSuspended = expert.verificationStatus === 'SUSPENDED';

                  return (
                    <tr key={expert.id} className="hover:bg-slate-800/30 transition">
                      {/* Professional */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-xs">{expert.user?.name}</div>
                        <div className="text-[11px] text-slate-400">{expert.user?.email}</div>
                        <div className="text-[10px] text-purple-400 font-medium mt-0.5">
                          {expert.title}
                        </div>
                      </td>

                      {/* Category & Country */}
                      <td className="py-3.5 px-4">
                        <div className="text-white font-medium">{expert.category?.name || 'Unassigned'}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[10px] border border-slate-700">
                            {expert.countryCode}
                          </span>
                          <span className="text-[10px] text-slate-400">{expert.city || 'N/A'}</span>
                        </div>
                      </td>

                      {/* License */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-slate-200">{expert.licenseNumber || '—'}</div>
                        <div className="text-[10px] text-slate-400">{expert.businessName}</div>
                      </td>

                      {/* Verification Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
                            isVerified
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                              : isPending
                              ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                              : isSuspended
                              ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {isVerified && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                          {isPending && <Clock className="w-3 h-3 text-amber-400" />}
                          {isSuspended && <Ban className="w-3 h-3 text-rose-400" />}
                          <span>{expert.verificationStatus}</span>
                        </span>
                      </td>

                      {/* Presence */}
                      <td className="py-3.5 px-4">
                        {expert.isOnline ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>ONLINE</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-medium">Offline</span>
                        )}
                      </td>

                      {/* Activity */}
                      <td className="py-3.5 px-4 text-[11px] text-slate-300">
                        <div>Calls: <span className="font-bold text-white">{expert._count?.callSessions || 0}</span></div>
                        <div>Appointments: <span className="font-bold text-white">{expert._count?.appointments || 0}</span></div>
                        <div>Reviews: <span className="font-bold text-white">{expert._count?.reviewsReceived || 0}</span></div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openActionModal(expert)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                          >
                            Manage
                          </button>

                          <button
                            onClick={() => handleQuickToggleSuspension(expert)}
                            title={isSuspended ? 'Reactivate Expert' : 'Suspend Expert'}
                            className={`p-1.5 rounded-lg border transition ${
                              isSuspended
                                ? 'bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border-emerald-800'
                                : 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800'
                            }`}
                          >
                            {isSuspended ? (
                              <UserCheck className="w-3.5 h-3.5" />
                            ) : (
                              <Ban className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Manage Expert Modal */}
      {selectedExpert && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Manage Professional: {selectedExpert.user?.name}
                </h3>
                <span className="text-xs text-slate-400">{selectedExpert.user?.email}</span>
              </div>
              <button
                onClick={() => setSelectedExpert(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Verification Status
                </label>
                <select
                  value={actionVerificationStatus}
                  onChange={(e) => setActionVerificationStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="VERIFIED">VERIFIED (Active on Marketplace)</option>
                  <option value="PENDING_VERIFICATION">PENDING_VERIFICATION (Needs Admin Audit)</option>
                  <option value="SUSPENDED">SUSPENDED (Hidden from Marketplace)</option>
                  <option value="REJECTED">REJECTED (Application Denied)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  User Account Status
                </label>
                <select
                  value={actionAccountStatus}
                  onChange={(e) => setActionAccountStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="ACTIVE">ACTIVE (Can sign in)</option>
                  <option value="SUSPENDED">SUSPENDED (Locked out)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Audit Notes / Reason for change
                </label>
                <textarea
                  rows={3}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="e.g., Annual license verified on NZ LBP register, or account suspended pending investigation..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedExpert(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStatus}
                disabled={updating}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {updating ? 'Updating...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
