import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle,
  CreditCard,
  ShieldCheck,
  Calendar,
  PhoneOff,
  ArrowLeft,
  Zap,
  Plus,
  Loader2,
} from 'lucide-react';
import { api } from '../../services/api';

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

interface PaidContinuationModalProps {
  consultationId: string;
  consultationType: 'CHAT' | 'AUDIO' | 'VIDEO';
  expertName: string;
  expertRatePerMinute: number;
  currency?: string;
  currencySymbol?: string;
  onConfirm: (paymentMethodId?: string) => Promise<void>;
  onBookAppointment: () => void;
  onEnd: () => void;
}

export const PaidContinuationModal: React.FC<PaidContinuationModalProps> = ({
  consultationId,
  consultationType,
  expertName,
  expertRatePerMinute,
  currency = 'NZD',
  currencySymbol = '$',
  onConfirm,
  onBookAppointment,
  onEnd,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string>('');
  const [quoteDetails, setQuoteDetails] = useState<any>(null);

  // Add Card inline sub-modal/state
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardNumber, setCardNumber] = useState('4242424242424242');
  const [cardExp, setCardExp] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('123');
  const [addingCard, setAddingCard] = useState(false);

  // Load payment methods and prepare quote on mount or step 2
  useEffect(() => {
    const fetchQuoteAndMethods = async () => {
      setLoading(true);
      try {
        const [methodsRes, quoteRes] = await Promise.all([
          api.get<PaymentMethod[]>('/payments/methods').catch(() => ({ data: [] })),
          api.post(`/payments/consultations/${consultationId}/prepare-paid`, {
            type: consultationType,
          }).catch(() => null),
        ]);

        if (methodsRes && Array.isArray(methodsRes)) {
          setPaymentMethods(methodsRes);
          const defaultMethod = methodsRes.find((m: any) => m.isDefault) || methodsRes[0];
          if (defaultMethod) {
            setSelectedMethodId(defaultMethod.id);
          }
        }

        if (quoteRes) {
          setQuoteDetails(quoteRes);
        }
      } catch (e) {
        console.warn('Error fetching quote or payment methods:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchQuoteAndMethods();
  }, [consultationId, consultationType]);

  const handleAddNewCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingCard(true);
    try {
      const [expMonthStr, expYearStr] = cardExp.split('/');
      const res = await api.post<any>('/payments/methods', {
        cardNumber: cardNumber.replace(/\s+/g, ''),
        cardLast4: cardNumber.slice(-4),
        cardBrand: cardNumber.startsWith('4') ? 'visa' : 'mastercard',
        expMonth: parseInt(expMonthStr || '12', 10),
        expYear: parseInt(`20${expYearStr || '28'}`, 10),
        setAsDefault: true,
      });

      if (res && res.id) {
        setPaymentMethods((prev) => [res, ...prev]);
        setSelectedMethodId(res.id);
        setShowAddCard(false);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to add card');
    } finally {
      setAddingCard(false);
    }
  };

  const handleFinalConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm(selectedMethodId || undefined);
    } finally {
      setConfirming(false);
    }
  };

  const activeRate = quoteDetails?.ratePerMinute ?? expertRatePerMinute ?? 2.5;
  const activeCurrencySymbol = quoteDetails?.currencySymbol ?? currencySymbol;
  const activeCurrency = quoteDetails?.currency ?? currency;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden text-white transition-all">
        {/* Step Header */}
        <div className="p-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-bold text-sm text-slate-200">
              {step === 1 ? 'Free Consultation Concluded' : 'Confirm Paid Continuation'}
            </span>
          </div>
          <div className="text-xs px-2.5 py-1 rounded-full bg-slate-700/60 font-semibold text-slate-300">
            Step {step} of 2
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {step === 1 ? (
            /* STEP 1: FREE TIME ENDED */
            <div>
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8" />
              </div>

              <h3 className="text-xl font-extrabold text-center text-white">
                Your 1 Minute Free is Complete
              </h3>
              <p className="text-xs text-slate-300 text-center mt-2 leading-relaxed">
                Your complimentary consultation with <strong>{expertName}</strong> has ended.
                The consultation is currently <strong>paused</strong>.
              </p>

              <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 my-5 text-left space-y-2">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-700">
                  <span className="text-slate-400">Consultation Type:</span>
                  <span className="font-semibold text-slate-200 uppercase tracking-wide">
                    {consultationType}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-700">
                  <span className="text-slate-400">Standard Continuation Rate:</span>
                  <span className="font-bold text-emerald-400">
                    {activeCurrencySymbol}{activeRate.toFixed(2)} {activeCurrency} / min
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Billing Basis:</span>
                  <span className="text-slate-300 font-medium">Per-second prorated (No lock-in)</span>
                </div>
              </div>

              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 mb-5 flex items-start gap-2 text-xs text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Strict Security Guarantee:</strong> You will <em>never</em> be charged
                  automatically. You must review the rate and explicitly approve payment in the next step.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5">
                <button
                  onClick={() => setStep(2)}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition active:scale-95 flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>Continue Paid ({activeCurrencySymbol}{activeRate.toFixed(2)}/min)</span>
                </button>

                <button
                  onClick={onBookAppointment}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition flex items-center justify-center gap-2"
                >
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span>Book Formal 45-Min Appointment Instead</span>
                </button>

                <button
                  onClick={onEnd}
                  className="w-full py-2 px-4 rounded-xl text-red-400 hover:text-red-300 font-medium text-xs transition flex items-center justify-center gap-1.5"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  <span>Conclude Consultation (No Charge)</span>
                </button>
              </div>
            </div>
          ) : (
            /* STEP 2: RATE & PAYMENT CONFIRMATION SCREEN */
            <div>
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setStep(1)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                  title="Back to Step 1"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h3 className="text-base font-bold text-white">Review Rate & Payment Method</h3>
              </div>

              {/* Exact Rate & Terms Card */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-emerald-500/40 rounded-2xl p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider">
                    Paid Consultation Rate
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    Live Prorated
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-white">
                    {activeCurrencySymbol}{activeRate.toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-300 font-medium">
                    {activeCurrency} / minute
                  </span>
                  <span className="text-xs text-slate-500 ml-2">
                    (~{activeCurrencySymbol}{(activeRate / 60).toFixed(3)}/sec)
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-2.5 leading-snug">
                  • Metering begins only when you confirm.
                  <br />• Charges are calculated strictly per second used.
                  <br />• You can end the consultation at any moment.
                </p>
              </div>

              {/* Payment Method Selector */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300">Payment Card</span>
                  {!showAddCard && (
                    <button
                      onClick={() => setShowAddCard(true)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Card</span>
                    </button>
                  )}
                </div>

                {showAddCard ? (
                  /* Inline Add Card Form */
                  <form onSubmit={handleAddNewCard} className="bg-slate-800/90 border border-slate-700 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-700">
                      <span className="text-xs font-bold text-slate-200">Add Payment Card</span>
                      <button
                        type="button"
                        onClick={() => setShowAddCard(false)}
                        className="text-xs text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Card Number (Mock/Test)</label>
                      <div className="relative">
                        <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          placeholder="4242 4242 4242 4242"
                          maxLength={19}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">MM/YY</label>
                        <input
                          type="text"
                          value={cardExp}
                          onChange={(e) => setCardExp(e.target.value)}
                          placeholder="12/28"
                          maxLength={5}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">CVC</label>
                        <input
                          type="text"
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value)}
                          placeholder="123"
                          maxLength={4}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={addingCard}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      {addingCard ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      <span>Save Card</span>
                    </button>
                  </form>
                ) : (
                  /* List of Cards */
                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {paymentMethods.length > 0 ? (
                      paymentMethods.map((m) => (
                        <div
                          key={m.id}
                          onClick={() => setSelectedMethodId(m.id)}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                            selectedMethodId === m.id
                              ? 'border-emerald-500 bg-emerald-950/20 text-white'
                              : 'border-slate-800 bg-slate-800/50 hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <CreditCard className={`w-4 h-4 ${selectedMethodId === m.id ? 'text-emerald-400' : 'text-slate-400'}`} />
                            <div className="text-xs">
                              <div className="font-semibold uppercase flex items-center gap-2">
                                <span>{m.brand} •••• {m.last4}</span>
                                {m.isDefault && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-700 text-slate-300">
                                    Default
                                  </span>
                                )}
                              </div>
                              <span className="text-slate-400 text-[10px]">Exp {m.expMonth}/{m.expYear}</span>
                            </div>
                          </div>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            selectedMethodId === m.id ? 'border-emerald-500 bg-emerald-500' : 'border-slate-600'
                          }`}>
                            {selectedMethodId === m.id && <CheckCircle className="w-3 h-3 text-slate-950" />}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 rounded-xl border border-dashed border-slate-700 text-center text-xs text-slate-400">
                        <span>No saved payment method found.</span>
                        <button
                          type="button"
                          onClick={() => setShowAddCard(true)}
                          className="block mx-auto mt-1 text-emerald-400 hover:underline font-semibold"
                        >
                          Add a test card to continue
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Confirmation Button */}
              <div className="space-y-2">
                <button
                  onClick={handleFinalConfirm}
                  disabled={confirming || (paymentMethods.length === 0 && !selectedMethodId)}
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm shadow-xl shadow-emerald-600/30 transition active:scale-95 flex items-center justify-center gap-2"
                >
                  {confirming ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Activating Paid Consultation...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Confirm & Continue Paid Consultation</span>
                    </>
                  )}
                </button>

                <button
                  onClick={onEnd}
                  className="w-full py-2 px-4 rounded-xl text-slate-400 hover:text-white text-xs transition"
                >
                  Cancel and End Consultation
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
