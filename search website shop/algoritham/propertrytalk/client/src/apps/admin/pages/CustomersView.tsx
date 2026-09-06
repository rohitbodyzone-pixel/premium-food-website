import React, { useState, useEffect } from 'react';
import { adminApi } from '../AdminAuthContext';
import {
  Users,
  Search,
  UserCheck,
  Ban,
  Phone,
  Mail,
  Calendar,
  PhoneCall,
  MessageSquare,
  Star,
  RefreshCw,
} from 'lucide-react';

export const CustomersView: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('ALL');
  const [accountStatus, setAccountStatus] = useState('ALL');

  const maskPhone = (phone?: string | null) => {
    if (!phone) return '—';
    if (phone.includes('•••')) return phone;
    const cleaned = phone.trim();
    if (cleaned.length < 8) return cleaned;
    const prefix = cleaned.startsWith('+1') ? '+1' : cleaned.startsWith('+') ? cleaned.slice(0, 3) : cleaned.slice(0, 2);
    const last4 = cleaned.slice(-4);
    return `${prefix} ••• ••• ${last4}`;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (country !== 'ALL') params.set('country', country);
      if (accountStatus !== 'ALL') params.set('accountStatus', accountStatus);

      const res = await adminApi.get<any[]>(`/admin/customers?${params.toString()}`);
      setCustomers(res);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [country, accountStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleToggleStatus = async (customer: any) => {
    const isSuspended = customer.accountStatus === 'SUSPENDED';
    const nextStatus = isSuspended ? 'ACTIVE' : 'SUSPENDED';
    const confirmMsg = isSuspended
      ? `Reactivate account for ${customer.name}? They will be permitted to log in and book consultations.`
      : `Suspend account for ${customer.name}? They will be blocked from logging in.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await adminApi.patch(`/admin/customers/${customer.id}/status`, {
        accountStatus: nextStatus,
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update customer status');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            <span>Customer & Client Directory</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage registered property buyers, sellers, and advice seekers across NZ and AU
          </p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Customers</span>
        </button>
      </div>

      {/* 2. Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by client name, email, or phone..."
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

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800 text-xs">
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

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Account Status:</span>
            <select
              value={accountStatus}
              onChange={(e) => setAccountStatus(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>

          <span className="text-slate-500 ml-auto font-medium">
            Found {customers.length} customer{customers.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* 3. Customers Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 font-bold border-b border-slate-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Country</th>
                <th className="py-3 px-4">Platform Engagement</th>
                <th className="py-3 px-4">Joined</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Loading customers directory...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No customers found matching your criteria.
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const isSuspended = c.accountStatus === 'SUSPENDED';

                  return (
                    <tr key={c.id} className="hover:bg-slate-800/30 transition">
                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-xs">{c.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">ID: {c.id.substring(0, 8)}...</div>
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-4 text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span>{c.email}</span>
                        </div>
                        {c.phone && (
                          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mt-0.5">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>{maskPhone(c.phone)}</span>
                          </div>
                        )}
                      </td>

                      {/* Country */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[10px] border border-slate-700">
                          {c.countryCode || 'NZ'}
                        </span>
                      </td>

                      {/* Platform Engagement */}
                      <td className="py-3.5 px-4">
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                          <span className="text-slate-400">
                            Calls: <strong className="text-white">{c._count?.callsInitiated || 0}</strong>
                          </span>
                          <span className="text-slate-400">
                            Appts: <strong className="text-white">{c._count?.appointments || 0}</strong>
                          </span>
                          <span className="text-slate-400">
                            Chats: <strong className="text-white">{c._count?.chatsInitiated || 0}</strong>
                          </span>
                          <span className="text-slate-400">
                            Reviews: <strong className="text-white">{c._count?.reviewsGiven || 0}</strong>
                          </span>
                        </div>
                      </td>

                      {/* Joined */}
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {new Date(c.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                            isSuspended
                              ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                              : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                          }`}
                        >
                          {isSuspended ? (
                            <>
                              <Ban className="w-3 h-3 text-rose-400" />
                              <span>SUSPENDED</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3 h-3 text-emerald-400" />
                              <span>ACTIVE</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleToggleStatus(c)}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs border transition ${
                            isSuspended
                              ? 'bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border-emerald-800'
                              : 'bg-rose-950/40 hover:bg-rose-900 text-rose-300 border-rose-800'
                          }`}
                        >
                          {isSuspended ? 'Reactivate' : 'Suspend'}
                        </button>
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
