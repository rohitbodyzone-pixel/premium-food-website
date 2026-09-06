import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  HelpCircle,
  PhoneCall,
  Wallet,
  MessageSquare,
  Shield,
  FileText,
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export const SupportPage: React.FC = () => {
  const { user } = useAuth();
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [issueType, setIssueType] = useState('Professional Conduct');
  const [issueDetails, setIssueDetails] = useState('');
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does the First 1 Minute Free consultation work?',
      a: 'Your consultation starts with 1 minute free across chat, audio, or video. The server-authoritative timer begins counting down from 01:00. When 1 minute concludes, you are given clear choices: Continue (paid consultation), Start Call, Book Appointment, or Conclude. You will never be billed automatically.',
    },
    {
      q: 'Does the 1-minute free timer apply to both chat and calls?',
      a: 'Yes! PropertyTalk gives you 1 minute free consultation that covers messaging in your private chat as well as audio and video calls once connected.',
    },
    {
      q: 'How are property professionals verified on PropertyTalk?',
      a: 'Super Admins manually check each expert’s government identity, practicing license/registration number against official public registers (such as NZ REA or Australian ASIC/state licensing bodies), and business registration numbers (NZBN/ABN) before granting verified status.',
    },
    {
      q: 'Can I talk to experts in New Zealand if I live overseas?',
      a: 'Yes! PropertyTalk is a mobile-first global marketplace. You can be anywhere in the world and choose whether you want advice from verified New Zealand or Australian property experts.',
    },
  ];

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setReportSubmitted(true);
    setTimeout(() => {
      setReportSubmitted(false);
      setIssueDetails('');
    }, 3000);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28 space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          Help & Support
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Frequently asked questions, consultation help, and dispute resolution.
        </p>
      </div>

      {/* Customer profile summary */}
      {user && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
              {user.name.charAt(0)}
            </div>
            <div>
              <span className="font-bold text-xs text-slate-900 block">{user.name}</span>
              <span className="text-[11px] text-slate-400 block">{user.email}</span>
            </div>
          </div>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
            Account Active
          </span>
        </div>
      )}

      {/* Quick Action Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          to="/consultation-history"
          className="bg-white rounded-2xl border border-slate-200/90 p-3 text-center shadow-xs hover:border-emerald-500 transition group"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-1.5 group-hover:bg-emerald-600 group-hover:text-white transition">
            <PhoneCall className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold text-slate-800 block">My Calls</span>
        </Link>

        <Link
          to="/wallet"
          className="bg-white rounded-2xl border border-slate-200/90 p-3 text-center shadow-xs hover:border-emerald-500 transition group"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-1.5 group-hover:bg-blue-600 group-hover:text-white transition">
            <Wallet className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold text-slate-800 block">Payments</span>
        </Link>

        <Link
          to="/chats"
          className="bg-white rounded-2xl border border-slate-200/90 p-3 text-center shadow-xs hover:border-emerald-500 transition group"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-1.5 group-hover:bg-amber-600 group-hover:text-white transition">
            <MessageSquare className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold text-slate-800 block">Support Chat</span>
        </Link>
      </div>

      {/* FAQs Section */}
      <div id="faqs" className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-emerald-600" />
          <span>Frequently Asked Questions</span>
        </h2>

        <div className="space-y-2">
          {faqs.map((faq, index) => {
            const isOpen = activeFaq === index;
            return (
              <div
                key={index}
                className="border border-slate-100 rounded-2xl overflow-hidden transition"
              >
                <button
                  type="button"
                  onClick={() => setActiveFaq(isOpen ? null : index)}
                  className="w-full text-left p-3.5 flex items-center justify-between gap-3 text-xs font-bold text-slate-800 hover:bg-slate-50"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      isOpen ? 'rotate-180 text-emerald-600' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-3.5 pb-3.5 text-xs text-slate-600 leading-relaxed bg-slate-50/50">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Report a Problem / Report Professional Form */}
      <div id="report" className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span>Report an Issue or Professional</span>
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          All reports are reviewed directly by the platform Super Admin team.
        </p>

        {reportSubmitted ? (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Thank you. Your report has been submitted for Super Admin review.</span>
          </div>
        ) : (
          <form onSubmit={handleReportSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Issue Category
              </label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className="w-full text-xs font-medium p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <option value="Professional Conduct">Report a Professional</option>
                <option value="Technical Problem">Technical Call or Audio/Video Problem</option>
                <option value="Billing / Pricing Dispute">Consultation Billing Inquiry</option>
                <option value="Verification Question">License Verification Question</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Details & Description
              </label>
              <textarea
                required
                value={issueDetails}
                onChange={(e) => setIssueDetails(e.target.value)}
                placeholder="Provide specific details, dates, or expert name..."
                rows={3}
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition"
            >
              Submit Report
            </button>
          </form>
        )}
      </div>

      {/* Privacy Guarantee Note */}
      <div className="p-4 rounded-2xl bg-slate-50 text-slate-500 text-[11px] text-center flex items-center justify-center gap-2">
        <Lock className="w-3.5 h-3.5 text-emerald-600" />
        <span>In-app consultation audio/video calls are private and not recorded by default.</span>
      </div>
    </div>
  );
};
