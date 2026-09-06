import React, { useState, useEffect } from 'react';
import { adminApi } from '../AdminAuthContext';
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  User,
  Award,
} from 'lucide-react';

export const AppointmentsView: React.FC = () => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [countryFilter, setCountryFilter] = useState('ALL');

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (countryFilter !== 'ALL') params.set('country', countryFilter);

      const res = await adminApi.get<any[]>(`/admin/appointments?${params.toString()}`);
      setAppointments(res);
    } catch (err) {
      console.error('Failed to load appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, [statusFilter, countryFilter]);

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <span>Scheduled Consultations & Booking Records</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor confirmed, pending, and completed advisory calendar bookings across NZ and AU
          </p>
        </div>
        <button
          onClick={loadAppointments}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Appointments</span>
        </button>
      </div>

      {/* 2. Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Approval</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Country:</span>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none"
            >
              <option value="ALL">All Countries</option>
              <option value="NZ">New Zealand (NZ)</option>
              <option value="AU">Australia (AU)</option>
            </select>
          </div>
        </div>

        <span className="text-slate-500 font-medium">
          Found {appointments.length} appointment record{appointments.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* 3. Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 font-bold border-b border-slate-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Client</th>
                <th className="py-3 px-4">Professional</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Timezone</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4 text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Loading appointments...
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No appointments found matching the selected filters.
                  </td>
                </tr>
              ) : (
                appointments.map((a) => {
                  const isConfirmed = a.status === 'CONFIRMED';
                  const isPending = a.status === 'PENDING';
                  const isCompleted = a.status === 'COMPLETED';
                  const isCancelled = a.status === 'CANCELLED';

                  return (
                    <tr key={a.id} className="hover:bg-slate-800/30 transition">
                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-xs">{a.consumer?.name || 'Customer'}</div>
                        <div className="text-[11px] text-slate-400">{a.consumer?.email}</div>
                        {a.consumer?.phone && (
                          <div className="text-[10px] text-slate-500">{a.consumer.phone}</div>
                        )}
                      </td>

                      {/* Expert */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-xs">{a.expert?.user?.name || 'Expert'}</div>
                        <div className="text-[11px] text-purple-400">
                          {a.expert?.category?.name || 'Advisor'} • {a.expert?.countryCode}
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-200">{a.date}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {a.startTime} – {a.endTime}
                        </div>
                      </td>

                      {/* Timezone */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                        {a.timezone || 'Pacific/Auckland'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
                            isConfirmed
                              ? 'bg-indigo-950/80 text-indigo-300 border-indigo-800'
                              : isPending
                              ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                              : isCompleted
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                              : 'bg-rose-950/80 text-rose-300 border-rose-800'
                          }`}
                        >
                          {isConfirmed && <CheckCircle2 className="w-3 h-3 text-indigo-400" />}
                          {isPending && <Clock className="w-3 h-3 text-amber-400" />}
                          {isCompleted && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                          {isCancelled && <XCircle className="w-3 h-3 text-rose-400" />}
                          <span>{a.status}</span>
                        </span>
                      </td>

                      {/* Notes */}
                      <td className="py-3.5 px-4 max-w-[200px] truncate text-[11px] text-slate-400">
                        {a.notes || '—'}
                      </td>

                      {/* Created */}
                      <td className="py-3.5 px-4 text-right text-slate-400 text-[11px]">
                        {new Date(a.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
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
