import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCountry } from '../context/CountryContext';
import { api } from '../services/api';
import {
  Wallet,
  Clock,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Plus,
  Trash2,
  Star,
  Receipt,
  Loader2,
  Lock,
} from 'lucide-react';
import { ConsultationReceiptModal, ConsultationReceiptData } from '../components/payment/ConsultationReceiptModal';

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

interface TransactionItem {
  id: string;
  amount: number;
  currency: string;
  currencySymbol: string;
  status: string;
  consultationType: string;
  freeSeconds: number;
  paidSeconds: number;
  ratePerMinute: number;
  expertName: string;
  expertCategory: string;
  createdAt: string;
  refundedAmount: number;
}

export const WalletPage: React.FC = () => {
  const { user } = useAuth();
  const { selectedCountry } = useCountry();

  const [activeTab, setActiveTab] = useState<'transactions' | 'methods' | 'policy'>('transactions');
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Card State
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardNumber, setCardNumber] = useState('4242424242424242');
  const [cardExp, setCardExp] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('123');
  const [setAsDefault, setSetAsDefault] = useState(true);
  const [submittingCard, setSubmittingCard] = useState(false);

  // Selected Receipt Modal
  const [activeReceipt, setActiveReceipt] = useState<ConsultationReceiptData | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [txRes, pmRes] = await Promise.all([
        api.get<TransactionItem[]>('/payments/transactions/my').catch(() => []),
        api.get<PaymentMethod[]>('/payments/methods').catch(() => []),
      ]);
      setTransactions(txRes || []);
      setPaymentMethods(pmRes || []);
    } catch (e) {
      console.error('Error fetching wallet data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingCard(true);
    try {
      const [expMonthStr, expYearStr] = cardExp.split('/');
      await api.post('/payments/methods', {
        cardNumber: cardNumber.replace(/\s+/g, ''),
        cardLast4: cardNumber.slice(-4),
        cardBrand: cardNumber.startsWith('4') ? 'visa' : 'mastercard',
        expMonth: parseInt(expMonthStr || '12', 10),
        expYear: parseInt(`20${expYearStr || '28'}`, 10),
        setAsDefault,
      });

      setShowAddCard(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to add card');
    } finally {
      setSubmittingCard(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await api.patch(`/payments/methods/${id}/default`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update default card');
    }
  };

  const handleDeleteMethod = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this card?')) return;
    try {
      await api.delete(`/payments/methods/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete card');
    }
  };

  const handleViewReceipt = async (txId: string) => {
    setLoadingReceipt(true);
    try {
      const res = await api.get<any>(`/payments/receipt/${txId}`);
      if (res) {
        setActiveReceipt(res);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to load receipt details');
    } finally {
      setLoadingReceipt(false);
    }
  };

  const isNZ = selectedCountry?.code === 'NZ';
  const currencyCode = isNZ ? 'NZD' : 'AUD';
  const currencySymbol = selectedCountry?.currencySymbol || '$';

  const totalSpent = transactions.reduce((acc, t) => acc + (t.status === 'CAPTURED' ? t.amount : 0), 0);

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}m ${s < 10 ? '0' : ''}${s}s`;
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28 space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          Payments & Billing
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage payment cards, review itemized receipts, and audit consultation expenses in {currencyCode}.
        </p>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <Wallet className="w-4 h-4" />
            <span>Consultation Billing Account</span>
          </span>

          <span className="text-xs text-slate-300 font-semibold bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
            {selectedCountry?.flag} {currencyCode}
          </span>
        </div>

        <div className="mt-4 mb-2 flex items-baseline justify-between">
          <div>
            <span className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              {currencySymbol}{totalSpent.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400 block mt-1">
              Total consultation spend to date
            </span>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-slate-200">
              {paymentMethods.length} {paymentMethods.length === 1 ? 'Card' : 'Cards'}
            </span>
            <span className="text-[11px] text-slate-400 block">Saved methods</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            First 1 minute of every consultation is 100% free
          </span>
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            No automatic charges
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'transactions' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Consultation Receipts ({transactions.length})
        </button>

        <button
          onClick={() => setActiveTab('methods')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'methods' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Saved Cards ({paymentMethods.length})
        </button>

        <button
          onClick={() => setActiveTab('policy')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'policy' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Billing Rules & FAQ
        </button>
      </div>

      {/* Tab 1: Receipts & Transactions */}
      {activeTab === 'transactions' && (
        <div className="space-y-3">
          {transactions.length > 0 ? (
            transactions.map((tx) => (
              <div
                key={tx.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex items-center justify-between gap-3 hover:border-slate-300 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Receipt className="w-5 h-5" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">
                        {tx.expertName}
                      </span>
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.2 rounded-full bg-slate-100 text-slate-600">
                        {tx.consultationType}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {new Date(tx.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} • {tx.expertCategory}
                    </span>
                    <span className="text-[11px] text-slate-600 font-medium block mt-0.5">
                      1m Free + {formatSeconds(tx.paidSeconds)} Paid @ {tx.currencySymbol}{tx.ratePerMinute.toFixed(2)}/min
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-sm font-extrabold text-slate-900 block">
                    {tx.currencySymbol}{tx.amount.toFixed(2)}
                  </span>
                  <button
                    onClick={() => handleViewReceipt(tx.id)}
                    className="mt-1 text-[11px] text-emerald-600 hover:text-emerald-700 font-bold underline transition"
                  >
                    View Receipt
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-8 text-center">
              <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-600 font-semibold">No paid consultation receipts yet</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                Whenever you confirm and complete a paid consultation continuation, full itemized tax receipts will appear here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Saved Cards */}
      {activeTab === 'methods' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Registered Cards
            </span>
            <button
              onClick={() => setShowAddCard(true)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Card</span>
            </button>
          </div>

          {/* Add Card Form Modal */}
          {showAddCard && (
            <form onSubmit={handleAddCard} className="bg-white rounded-3xl border-2 border-emerald-500/30 p-5 shadow-lg space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-sm text-slate-900">Add Payment Card</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddCard(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Card Number (Test Cards Accepted)
                </label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="4242 4242 4242 4242"
                    maxLength={19}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                    required
                  />
                </div>
                {/* Test Card Quick Chips */}
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-400">Quick Test:</span>
                  <button
                    type="button"
                    onClick={() => setCardNumber('4242424242424242')}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-emerald-50 text-slate-600 font-mono"
                  >
                    4242 (Success)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardNumber('4000000000000002')}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-red-50 text-slate-600 font-mono"
                  >
                    0002 (Decline)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardNumber('4000000000000003')}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-amber-50 text-slate-600 font-mono"
                  >
                    0003 (Funds)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Expiry (MM/YY)</label>
                  <input
                    type="text"
                    value={cardExp}
                    onChange={(e) => setCardExp(e.target.value)}
                    placeholder="12/28"
                    maxLength={5}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">CVC / CVV</label>
                  <input
                    type="text"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value)}
                    placeholder="123"
                    maxLength={4}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                    required
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={setAsDefault}
                  onChange={(e) => setSetAsDefault(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Set as default payment method</span>
              </label>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={submittingCard}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                >
                  {submittingCard ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Save Payment Card</span>
                </button>
              </div>
            </form>
          )}

          {/* Cards List */}
          <div className="space-y-2.5">
            {paymentMethods.length > 0 ? (
              paymentMethods.map((pm) => (
                <div
                  key={pm.id}
                  className={`bg-white rounded-2xl border p-4 shadow-xs flex items-center justify-between transition ${
                    pm.isDefault ? 'border-emerald-500/80 bg-emerald-50/20' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs uppercase">
                      {pm.brand}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 font-mono">
                          •••• {pm.last4}
                        </span>
                        {pm.isDefault && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <Star className="w-3 h-3 fill-emerald-600 text-emerald-600" />
                            Default
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        Expires {pm.expMonth}/{pm.expYear}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!pm.isDefault && (
                      <button
                        onClick={() => handleSetDefault(pm.id)}
                        className="text-xs text-slate-600 hover:text-emerald-700 font-semibold px-2.5 py-1 rounded-lg hover:bg-slate-100 transition"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteMethod(pm.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                      title="Remove card"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center">
                <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-600 font-semibold">No saved payment methods</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Add a card to easily continue consultations beyond the free 1st minute.
                </p>
              </div>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5 text-xs text-slate-600">
            <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Zero Card Details Stored Locally:</strong> Card details are securely tokenized with the PCI-DSS certified payment provider. PropertyTalk only stores masked identifiers and token references.
            </span>
          </div>
        </div>
      )}

      {/* Tab 3: Billing Rules */}
      {activeTab === 'policy' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-4 text-xs text-slate-600 leading-relaxed">
          <h3 className="text-sm font-bold text-slate-900">PropertyTalk Consultation Billing Rules</h3>

          <div className="space-y-2">
            <p>
              • <strong>First 1 Minute Always Free:</strong> Every single consultation across Chat, Voice, and Video begins with 60 seconds completely free of charge.
            </p>
            <p>
              • <strong>Explicit Consent Gate:</strong> Consultations pause automatically at 00:00. We will never silently or automatically charge you.
            </p>
            <p>
              • <strong>Per-Second Prorated Billing:</strong> If you approve continuing, metering is calculated per second based on the expert's rate. For example, 165 seconds at $3.00/min is billed exactly $8.25.
            </p>
            <p>
              • <strong>Local Currency Isolation:</strong> New Zealand professionals are billed in NZD; Australian professionals are billed in AUD.
            </p>
            <p>
              • <strong>Itemized Receipts:</strong> Every transaction generates a downloadable, printable receipt stored permanently in your wallet.
            </p>
          </div>
        </div>
      )}

      {/* Itemized Receipt Modal */}
      {activeReceipt && (
        <ConsultationReceiptModal
          receipt={activeReceipt}
          onClose={() => setActiveReceipt(null)}
        />
      )}
    </div>
  );
};
