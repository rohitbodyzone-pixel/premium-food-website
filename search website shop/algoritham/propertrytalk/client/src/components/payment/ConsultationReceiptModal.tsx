import React from 'react';
import {
  CheckCircle,
  Receipt,
  Printer,
  X,
  ShieldCheck,
  Clock,
  User,
  Calendar,
  DollarSign,
  Download,
} from 'lucide-react';

export interface ConsultationReceiptData {
  receiptNumber: string;
  transactionId?: string;
  consultationType: string;
  expertName: string;
  expertCategory?: string;
  freeDurationSeconds?: number;
  paidDurationSeconds: number;
  ratePerMinute: number;
  grossAmount: number;
  currency: string;
  currencySymbol: string;
  date: string;
  status: string;
  paymentProvider?: string;
}

interface ConsultationReceiptModalProps {
  receipt: ConsultationReceiptData;
  onClose: () => void;
}

export const ConsultationReceiptModal: React.FC<ConsultationReceiptModalProps> = ({
  receipt,
  onClose,
}) => {
  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in print:p-0 print:bg-white">
      <div className="bg-slate-900 border border-slate-700 print:border-none print:bg-white print:text-black rounded-3xl max-w-md w-full shadow-2xl overflow-hidden text-white flex flex-col">
        {/* Receipt Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-900/50 to-slate-900 border-b border-slate-800 print:border-b-2 print:border-black flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white print:text-black">Consultation Receipt</h3>
              <span className="text-[11px] text-slate-400 print:text-gray-600 font-mono">
                {receipt.receiptNumber}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white print:hidden transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Content */}
        <div className="p-6 space-y-4">
          {/* Status Badge & Amount */}
          <div className="text-center py-2 bg-slate-800/60 print:bg-gray-100 rounded-2xl border border-slate-700/50 print:border-gray-300">
            <div className="flex items-center justify-center gap-1 text-emerald-400 font-semibold text-xs mb-1">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Payment Successful • {receipt.status || 'PAID'}</span>
            </div>
            <div className="text-3xl font-extrabold text-white print:text-black">
              {receipt.currencySymbol}{receipt.grossAmount.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400 print:text-gray-600 font-medium">
              {receipt.currency} Total Billed (Prorated)
            </div>
          </div>

          {/* Breakdown Items */}
          <div className="space-y-2 text-xs border-y border-slate-800 print:border-gray-300 py-3">
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400 print:text-gray-600">Expert / Professional</span>
              <span className="font-semibold text-slate-200 print:text-black">{receipt.expertName}</span>
            </div>

            {receipt.expertCategory && (
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400 print:text-gray-600">Category</span>
                <span className="text-slate-300 print:text-gray-800">{receipt.expertCategory}</span>
              </div>
            )}

            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400 print:text-gray-600">Consultation Type</span>
              <span className="font-semibold text-slate-200 print:text-black uppercase">
                {receipt.consultationType}
              </span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400 print:text-gray-600">Complimentary Free Duration</span>
              <span className="text-emerald-400 font-medium">
                {formatSeconds(receipt.freeDurationSeconds ?? 60)} (FREE)
              </span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400 print:text-gray-600">Paid Billable Duration</span>
              <span className="font-semibold text-slate-200 print:text-black">
                {formatSeconds(receipt.paidDurationSeconds)} ({receipt.paidDurationSeconds}s)
              </span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400 print:text-gray-600">Rate per Minute</span>
              <span className="text-slate-300 print:text-gray-800 font-mono">
                {receipt.currencySymbol}{receipt.ratePerMinute.toFixed(2)}/min
              </span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400 print:text-gray-600">Prorated Calculation</span>
              <span className="text-slate-300 print:text-gray-800 font-mono text-[11px]">
                ({receipt.paidDurationSeconds}s / 60) × {receipt.currencySymbol}{receipt.ratePerMinute.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400 print:text-gray-600">Date & Time</span>
              <span className="text-slate-300 print:text-gray-800">
                {new Date(receipt.date).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 print:text-gray-600">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>PropertyTalk Secure Billing Engine</span>
            </span>
            <span>{receipt.paymentProvider || 'Card'}</span>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex gap-3 print:hidden">
            <button
              onClick={handlePrint}
              className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition flex items-center justify-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-1.5"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Done</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
