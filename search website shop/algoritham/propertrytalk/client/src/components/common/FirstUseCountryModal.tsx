import React, { useState, useEffect } from 'react';
import { useCountry } from '../../context/CountryContext';
import { ShieldCheck, CheckCircle2, ArrowRight, Building2, Lock } from 'lucide-react';

export const FirstUseCountryModal: React.FC = () => {
  const { setCountryCode } = useCountry();
  const [isOpen, setIsOpen] = useState(false);
  const [chosenCountry, setChosenCountry] = useState('NZ');

  useEffect(() => {
    const hasCompleted = localStorage.getItem('pt_country_onboarding_completed');
    if (!hasCompleted) {
      setIsOpen(true);
    }
  }, []);

  if (!isOpen) return null;

  const handleConfirm = () => {
    localStorage.setItem('pt_country_onboarding_completed', 'true');
    setCountryCode(chosenCountry);
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 relative">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
            <Building2 className="w-7 h-7" />
          </div>
          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-3 py-1 rounded-full uppercase tracking-wider">
            NZ-First Platform Launch
          </span>
          <h2 className="text-2xl font-black text-slate-900 mt-2 tracking-tight">
            Welcome to PropertyTalk
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
            New Zealand's verified property marketplace, remote live viewings, and professional advice platform.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {/* New Zealand Option */}
          <button
            type="button"
            onClick={() => setChosenCountry('NZ')}
            className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 text-left transition-all ${
              chosenCountry === 'NZ'
                ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <span className="text-3xl leading-none">🇳🇿</span>
              <div>
                <div className="font-bold text-slate-900 flex items-center gap-2 text-sm sm:text-base">
                  New Zealand
                  <span className="text-[10px] font-extrabold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                    Active Launch
                  </span>
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Verified REA Agents, FMA Advisers & NZ Law Society Pros
                </p>
              </div>
            </div>
            {chosenCountry === 'NZ' && (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            )}
          </button>

          {/* Australia Option (Disabled for NZ Launch) */}
          <div
            className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/80 text-left opacity-75 cursor-not-allowed"
          >
            <div className="flex items-center gap-3.5">
              <span className="text-3xl leading-none grayscale opacity-60">🇦🇺</span>
              <div>
                <div className="font-bold text-slate-500 flex items-center gap-2 text-sm">
                  Australia
                  <span className="text-[10px] font-semibold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Coming Soon
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Australian market rollout configured for future phase.
                </p>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          className="w-full py-3.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition active:scale-98"
        >
          <span>Explore New Zealand Properties & Experts</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="text-[11px] text-slate-400 text-center mt-3.5">
          You can change your consultation market anytime from the top bar.
        </p>
      </div>
    </div>
  );
};
