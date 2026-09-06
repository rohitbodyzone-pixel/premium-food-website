import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCountry } from '../context/CountryContext';
import { Globe2, ShieldCheck, ArrowRight, Building2 } from 'lucide-react';

export const CountrySelectPage: React.FC = () => {
  const { countries, setCountryCode } = useCountry();
  const navigate = useNavigate();

  const handleSelectCountry = (code: string) => {
    setCountryCode(code);
    navigate('/');
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="max-w-xl w-full text-center">
        {/* Brand Icon */}
        <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-600/30">
          <Building2 className="w-8 h-8" />
        </div>

        <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 py-1 px-3 rounded-full">
          Global Marketplace
        </span>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3 tracking-tight">
          Which country's property experts would you like to talk to?
        </h1>

        <p className="text-sm sm:text-base text-slate-600 mt-2 max-w-md mx-auto">
          Connect from anywhere in the world with licensed, verified property professionals.
        </p>

        {/* Country Choice Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
          {countries.map((country) => (
            <button
              key={country.code}
              onClick={() => handleSelectCountry(country.code)}
              className="group p-6 rounded-2xl bg-white border-2 border-slate-200 hover:border-emerald-500 shadow-xs hover:shadow-xl transition-all duration-200 text-left relative overflow-hidden flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <span className="text-5xl">{country.flag}</span>
                <span className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-emerald-50 text-slate-400 group-hover:text-emerald-600 flex items-center justify-center transition">
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>

              <div className="mt-6">
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-emerald-700 transition">
                  {country.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  {country.code === 'NZ' ? 'REA & FSPR Licensed' : 'State Fair Trading & ASIC'}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Currency: <strong>{country.currency}</strong></span>
                  <span className="text-emerald-600 font-semibold">First 1 Min Free</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <p className="text-xs text-slate-400 mt-6">
          🔒 You do not need to choose your own country. You can switch target countries anytime.
        </p>
      </div>
    </div>
  );
};
