import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Clock,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Receipt,
  Download,
  Percent,
} from 'lucide-react';

interface EarningsSummary {
  today: number;
  thisWeek: number;
  thisMonth: number;
  available: number;
  totalConsultations: number;
}

interface EarningTransaction {
  id: string;
  date: string;
  clientIdentifier: string;
  consultationType: string;
  paidSeconds: number;
  grossAmount: number;
  platformFee: number;
  netEarning: number;
  currency: string;
  currencySymbol: string;
  status: string;
}

export const ExpertEarningsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [transactions, setTransactions] = useState<EarningTransaction[]>([]);
  const [currency, setCurrency] = useState('NZD');
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [payoutStatus, setPayoutStatus] = useState<string>('ACTIVE');
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  const fetchEarnings = async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/expert/earnings');
      if (res && res.data) {
        setSummary(res.data.summary);
        setTransactions(res.data.transactions || []);
        setCurrency(res.data.currency || 'NZD');
        setCurrencySymbol(res.data.currencySymbol || '$');
        setPayoutStatus(res.data.payoutStatus || 'ACTIVE');
      }
    } catch (err) {
      console.error('Failed to load expert earnings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEarnings();
  }, []);

  const handleStartPayoutOnboarding = async () => {
    setOnboardingLoading(true);
    try {
      const res = await api.post<any>('/expert/payout-onboarding');
      if (res?.data?.onboardingUrl) {
        window.open(res.data.onboardingUrl, '_blank');
      } else {
        alert(`Payout status: ${res?.data?.payoutStatus || 'Active'}`);
        fetchEarnings();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to start payout onboarding');
    } finally {
      setOnboardingLoading(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}m ${s < 10 ? '0' : ''}${s}s`;
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="h-64 bg-white rounded-3xl border border-slate-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Consultation Earnings & Payouts
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold">
              {currency} ({currencySymbol})
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Server-authoritative ledger of completed paid consultation seconds, platform deductions, and net earnings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleStartPayoutOnboarding}
            disabled={onboardingLoading}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            {onboardingLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>Stripe Payout Settings</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Today's Net Earnings
          </span>
          <div className="text-2xl font-extrabold text-slate-900">
            {currencySymbol}{(summary?.today || 0).toFixed(2)}
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
            <TrendingUp className="w-3 h-3" />
            <span>80% Net after 20% fee</span>
          </span>
        </div>

        {/* This Week */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
            This Week
          </span>
          <div className="text-2xl font-extrabold text-slate-900">
            {currencySymbol}{(summary?.thisWeek || 0).toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            Current calendar week
          </span>
        </div>

        {/* This Month */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
            This Month
          </span>
          <div className="text-2xl font-extrabold text-slate-900">
            {currencySymbol}{(summary?.thisMonth || 0).toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            Current monthly cycle
          </span>
        </div>

        {/* Available Balance */}
        <div className="bg-gradient-to-br from-emerald-900 to-slate-900 text-white rounded-3xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 block mb-1">
            Available For Payout
          </span>
          <div className="text-2xl font-extrabold text-white">
            {currencySymbol}{(summary?.available || 0).toFixed(2)}
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-400 font-semibold">
            <CheckCircle2 className="w-3 h-3" />
            <span>Payout status: {payoutStatus}</span>
          </div>
        </div>
      </div>

      {/* Payout & Commission Policy Notice */}
      <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-emerald-950 block">
              Transparent 80/20 Revenue Split
            </span>
            <span className="text-emerald-800 text-[11px]">
              You receive 80% of all paid consultation charges. Platform fee of 20% covers WebRTC infrastructure, payment processing, and consumer marketing.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="px-3 py-1 bg-white text-emerald-900 font-bold rounded-xl border border-emerald-200 text-xs">
            Direct Bank Transfer
          </span>
        </div>
      </div>

      {/* Consultation Earnings Breakdown Ledger */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Consultation Earnings Ledger ({transactions.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Server-settled paid seconds
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Client</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Paid Duration</th>
                <th className="py-3 px-4 text-right">Gross Charged</th>
                <th className="py-3 px-4 text-right">Platform Fee (20%)</th>
                <th className="py-3 px-4 text-right">Your Net Earning</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.length > 0 ? (
                transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-mono text-slate-800">
                      {new Date(t.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {t.clientIdentifier}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                        {t.consultationType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium">
                      {formatSeconds(t.paidSeconds)} ({t.paidSeconds}s)
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-700 font-mono">
                      {t.currencySymbol}{t.grossAmount.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-400 font-mono">
                      -{t.currencySymbol}{t.platformFee.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-emerald-600 font-mono text-sm">
                      {t.currencySymbol}{t.netEarning.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          t.status === 'AVAILABLE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : t.status === 'PAID_OUT'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-xs text-slate-600">No paid consultations completed yet</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                      When clients extend beyond the free introductory minute, your prorated earnings will log directly here.
                    </p>
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
