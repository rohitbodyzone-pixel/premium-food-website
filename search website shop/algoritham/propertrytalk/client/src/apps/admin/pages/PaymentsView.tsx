import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import {
  DollarSign,
  TrendingUp,
  Percent,
  RotateCcw,
  CreditCard,
  Receipt,
  Search,
  Filter,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  ArrowDownLeft,
  Calendar,
} from 'lucide-react';
import { ConsultationReceiptModal, ConsultationReceiptData } from '../../../components/payment/ConsultationReceiptModal';

interface PaymentOverview {
  totalGrossVolumeMinorUnits: number;
  totalPlatformFeesMinorUnits: number;
  totalExpertEarningsMinorUnits: number;
  totalRefundsMinorUnits: number;
  totalTransactionsCount: number;
  platformCommissionPct: number;
  paymentProvider: string;
  isMock: boolean;
}

interface AdminTransactionItem {
  id: string;
  amount: number;
  currency: string;
  currencySymbol: string;
  status: string;
  provider: string;
  createdAt: string;
  consultationType: string;
  paidSeconds: number;
  platformFee: number;
  expertNet: number;
  consumer: { id: string; name: string; email: string };
  expert: { id: string; name: string; email: string; countryCode: string };
  refunds: Array<{ id: string; amount: number; reason: string; createdAt: string }>;
}

export const PaymentsView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<PaymentOverview | null>(null);
  const [transactions, setTransactions] = useState<AdminTransactionItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Settings State
  const [commissionPctInput, setCommissionPctInput] = useState('20');
  const [savingSettings, setSavingSettings] = useState(false);

  // Refund Modal State
  const [selectedTxForRefund, setSelectedTxForRefund] = useState<AdminTransactionItem | null>(null);
  const [refundType, setRefundType] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [partialAmount, setPartialAmount] = useState('');
  const [refundReason, setRefundReason] = useState('Customer technical satisfaction');
  const [submittingRefund, setSubmittingRefund] = useState(false);

  // Receipt Modal State
  const [viewingReceipt, setViewingReceipt] = useState<ConsultationReceiptData | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [overviewRes, txRes] = await Promise.all([
        api.get<PaymentOverview>('/admin/payments/overview'),
        api.get<AdminTransactionItem[]>('/admin/payments/transactions'),
      ]);
      setOverview(overviewRes);
      setTransactions(txRes || []);
      if (overviewRes) {
        setCommissionPctInput(String(overviewRes.platformCommissionPct));
      }
    } catch (err) {
      console.error('Failed to load admin payments data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.patch('/admin/payments/settings', {
        platformCommissionPct: parseFloat(commissionPctInput),
      });
      alert('Payment settings updated successfully!');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update payment settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleOpenRefundModal = (tx: AdminTransactionItem) => {
    setSelectedTxForRefund(tx);
    setRefundType('FULL');
    const alreadyRefunded = tx.refunds.reduce((acc, r) => acc + r.amount, 0);
    const maxRefundable = Math.max(0, tx.amount - alreadyRefunded);
    setPartialAmount(maxRefundable.toFixed(2));
    setRefundReason('Super Admin customer resolution');
  };

  const handleSubmitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTxForRefund) return;

    setSubmittingRefund(true);
    try {
      const alreadyRefunded = selectedTxForRefund.refunds.reduce((acc, r) => acc + r.amount, 0);
      const remaining = selectedTxForRefund.amount - alreadyRefunded;
      const refundAmount = refundType === 'FULL' ? remaining : parseFloat(partialAmount);

      await api.post(`/admin/payments/transactions/${selectedTxForRefund.id}/refund`, {
        amount: refundAmount,
        reason: refundReason,
      });

      alert(`Refund of ${selectedTxForRefund.currencySymbol}${refundAmount.toFixed(2)} processed successfully!`);
      setSelectedTxForRefund(null);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to process refund');
    } finally {
      setSubmittingRefund(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const filteredTransactions = transactions.filter((tx) => {
    const matchesStatus = statusFilter === 'ALL' || tx.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      tx.id.toLowerCase().includes(q) ||
      tx.consumer.name.toLowerCase().includes(q) ||
      tx.consumer.email.toLowerCase().includes(q) ||
      tx.expert.name.toLowerCase().includes(q);

    return matchesStatus && matchesSearch;
  });

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 bg-slate-900 rounded-3xl border border-slate-800" />
        <div className="h-64 bg-slate-900 rounded-3xl border border-slate-800" />
      </div>
    );
  }

  const grossTotal = (overview?.totalGrossVolumeMinorUnits || 0) / 100;
  const platformFees = (overview?.totalPlatformFeesMinorUnits || 0) / 100;
  const expertPayouts = (overview?.totalExpertEarningsMinorUnits || 0) / 100;
  const refundsTotal = (overview?.totalRefundsMinorUnits || 0) / 100;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              Payments & Billing Management
            </h1>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                overview?.isMock
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}
            >
              Mode: {overview?.isMock ? 'Mock Development' : 'Live Stripe'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Audit prorated consultation charges, configure platform commission fees, and issue customer refunds.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Gross Volume */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Gross Volume</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">
            ${grossTotal.toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            {overview?.totalTransactionsCount || 0} total transactions
          </span>
        </div>

        {/* Platform Revenue (20%) */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Platform Revenue</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-extrabold text-purple-400 font-mono">
            ${platformFees.toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            {overview?.platformCommissionPct || 20}% platform take rate
          </span>
        </div>

        {/* Expert Payouts Net (80%) */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Expert Payouts</span>
            <Percent className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono">
            ${expertPayouts.toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            80% expert net earnings
          </span>
        </div>

        {/* Total Refunds Issued */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Refunds</span>
            <RotateCcw className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-extrabold text-rose-400 font-mono">
            ${refundsTotal.toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            Settled refund reversals
          </span>
        </div>
      </div>

      {/* Global Payment Settings Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-sm">
        <form onSubmit={handleSaveSettings} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-950/60 border border-purple-800/60 text-purple-300 flex items-center justify-center font-bold">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Platform Commission Setting</h3>
              <p className="text-xs text-slate-400">
                Determines PropertyTalk fee percentage snapshot on paid consultation continuation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-32">
              <input
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={commissionPctInput}
                onChange={(e) => setCommissionPctInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-purple-500"
                required
              />
              <span className="absolute right-3 top-2 text-xs text-slate-400 font-bold">%</span>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              {savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>Save Fee</span>
            </button>
          </div>
        </form>
      </div>

      {/* Transactions Table Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        {/* Table Filter Header */}
        <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white">
              Consultation Transactions ({filteredTransactions.length})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search consumer, expert, ID..."
                className="bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 w-48 sm:w-60"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="CAPTURED">Captured (Paid)</option>
              <option value="REFUNDED">Refunded</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Date & Tx ID</th>
                <th className="py-3 px-4">Consumer</th>
                <th className="py-3 px-4">Expert</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Paid Duration</th>
                <th className="py-3 px-4 text-right">Gross</th>
                <th className="py-3 px-4 text-right">Fee (20%)</th>
                <th className="py-3 px-4 text-right">Net</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => {
                  const refunded = tx.refunds.reduce((acc, r) => acc + r.amount, 0);
                  const isRefundable = tx.status === 'CAPTURED' && refunded < tx.amount;

                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        <span className="text-slate-200 block">
                          {new Date(tx.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                        <span className="text-slate-500 text-[10px] block">
                          {tx.id.substring(0, 8)}...
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-white block">{tx.consumer.name}</span>
                        <span className="text-[10px] text-slate-400 block">{tx.consumer.email}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-white block">{tx.expert.name}</span>
                        <span className="text-[10px] text-slate-400 block">
                          {tx.expert.countryCode} Expert
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 uppercase">
                          {tx.consultationType}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        {formatSeconds(tx.paidSeconds)} ({tx.paidSeconds}s)
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                        {tx.currencySymbol}{tx.amount.toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-purple-400">
                        {tx.currencySymbol}{tx.platformFee.toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-emerald-400 font-bold">
                        {tx.currencySymbol}{tx.expertNet.toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            tx.status === 'CAPTURED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : tx.status === 'REFUNDED'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {tx.status}
                        </span>
                        {refunded > 0 && tx.status !== 'REFUNDED' && (
                          <span className="block text-[9px] text-rose-400 mt-0.5">
                            Partially refunded ({tx.currencySymbol}{refunded.toFixed(2)})
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isRefundable && (
                            <button
                              onClick={() => handleOpenRefundModal(tx)}
                              className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-bold transition"
                            >
                              Refund
                            </button>
                          )}

                          <button
                            onClick={() =>
                              setViewingReceipt({
                                receiptNumber: `REC-${tx.id.substring(0, 8).toUpperCase()}`,
                                transactionId: tx.id,
                                consultationType: tx.consultationType,
                                expertName: tx.expert.name,
                                freeDurationSeconds: 60,
                                paidDurationSeconds: tx.paidSeconds,
                                ratePerMinute: (tx.amount / Math.max(1, tx.paidSeconds)) * 60,
                                grossAmount: tx.amount,
                                currency: tx.currency,
                                currencySymbol: tx.currencySymbol,
                                date: tx.createdAt,
                                status: tx.status,
                                paymentProvider: tx.provider,
                              })
                            }
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-bold transition"
                          >
                            Receipt
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <span>No transactions match the specified filters.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Refund Modal */}
      {selectedTxForRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden text-white">
            <div className="p-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-400" />
                <span className="font-bold text-sm text-slate-200">Process Consultation Refund</span>
              </div>
              <button
                onClick={() => setSelectedTxForRefund(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRefund} className="p-6 space-y-4">
              <div className="bg-slate-800/60 rounded-xl p-3 text-xs space-y-1 border border-slate-700/60">
                <div className="flex justify-between">
                  <span className="text-slate-400">Transaction:</span>
                  <span className="font-mono text-slate-200">{selectedTxForRefund.id.substring(0, 12)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Consumer:</span>
                  <span className="font-semibold text-slate-200">{selectedTxForRefund.consumer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Billed:</span>
                  <span className="font-bold text-white font-mono">
                    {selectedTxForRefund.currencySymbol}{selectedTxForRefund.amount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Refund Type */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRefundType('FULL')}
                  className={`py-2 rounded-xl text-xs font-bold border transition ${
                    refundType === 'FULL'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  Full Refund
                </button>
                <button
                  type="button"
                  onClick={() => setRefundType('PARTIAL')}
                  className={`py-2 rounded-xl text-xs font-bold border transition ${
                    refundType === 'PARTIAL'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  Partial Refund
                </button>
              </div>

              {refundType === 'PARTIAL' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Refund Amount ({selectedTxForRefund.currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedTxForRefund.amount}
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>
              )}

              <div>
                <label className="text-xs text-slate-400 block mb-1">Audit Reason</label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Call quality dispute or customer request"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={submittingRefund}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/30"
                >
                  {submittingRefund ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  <span>Execute Refund</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTxForRefund(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Itemized Receipt Modal */}
      {viewingReceipt && (
        <ConsultationReceiptModal
          receipt={viewingReceipt}
          onClose={() => setViewingReceipt(null)}
        />
      )}
    </div>
  );
};
