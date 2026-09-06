import React from 'react';
import { useCountry } from '../../context/CountryContext';
import { X, CheckCircle2, Globe2, ShieldCheck } from 'lucide-react';

export const CountryModal: React.FC = () => {
  const { countries, selectedCountry, setCountryCode, isCountryModalOpen, setIsCountryModalOpen } = useCountry();

  if (!isCountryModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative">
        <button
          onClick={() => setIsCountryModalOpen(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
            <Globe2 className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">
            Select Destination Country
          </h3>
          <p className="text-sm text-slate-500 mt-1.5">
            Which country's property experts would you like to talk to?
          </p>
          <p className="text-xs text-emerald-700 bg-emerald-50 py-1 px-3 rounded-full mt-2 inline-block font-medium">
            💡 You can connect from anywhere in the world
          </p>
        </div>

        <div className="space-y-3">
          {countries.map((country) => {
            const isSelected = selectedCountry?.code === country.code;
            return (
              <button
                key={country.code}
                onClick={() => setCountryCode(country.code)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 text-left transition-all ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <span className="text-3xl leading-none">{country.flag}</span>
                  <div>
                    <div className="font-semibold text-slate-900 flex items-center gap-2">
                      {country.name}
                      <span className="text-xs font-normal text-slate-400 uppercase">({country.currency})</span>
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Verified {country.code === 'NZ' ? 'REA & FSP' : 'ASIC & REI'} Licensed Pros
                    </p>
                  </div>
                </div>

                {isSelected && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">
            You can switch your consultation destination anytime from the header.
          </p>
        </div>
      </div>
    </div>
  );
};
