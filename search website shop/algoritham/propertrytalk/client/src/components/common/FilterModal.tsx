import React, { useState } from 'react';
import { X, SlidersHorizontal, Star, Radio, Check, RotateCcw } from 'lucide-react';
import { useCountry } from '../../context/CountryContext';

export interface FilterState {
  onlineOnly: boolean;
  city: string;
  minRating: number;
  minExperience: number;
  language: string;
}

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onApply: (newFilters: FilterState) => void;
  onReset: () => void;
}

export const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  onClose,
  filters,
  onApply,
  onReset,
}) => {
  const { selectedCountry } = useCountry();
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);

  if (!isOpen) return null;

  const isNZ = selectedCountry?.code === 'NZ';
  const cities = isNZ
    ? ['Auckland', 'Wellington', 'Christchurch', 'Hamilton', 'Tauranga', 'Queenstown']
    : ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast'];

  const languages = ['English', 'Mandarin', 'Hindi', 'Greek', 'French', 'Punjabi'];

  const handleApply = () => {
    onApply(localFilters);
    onClose();
  };

  const handleReset = () => {
    const defaultFilters: FilterState = {
      onlineOnly: false,
      city: '',
      minRating: 0,
      minExperience: 0,
      language: '',
    };
    setLocalFilters(defaultFilters);
    onReset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Filters</h3>
              <p className="text-xs text-slate-400">Showing {selectedCountry?.name} Professionals</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Online Now Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <div>
                <span className="text-xs font-bold text-emerald-950 block">Online Now Only</span>
                <span className="text-[11px] text-emerald-700">Available for immediate chat & call</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLocalFilters((prev) => ({ ...prev, onlineOnly: !prev.onlineOnly }))}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                localFilters.onlineOnly ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`block w-4 h-4 rounded-full bg-white shadow-xs transition-transform absolute top-1 ${
                  localFilters.onlineOnly ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Region / City */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
              City / Region
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setLocalFilters((prev) => ({ ...prev, city: '' }))}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  !localFilters.city
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                All Regions
              </button>
              {cities.map((city) => {
                const isSelected = localFilters.city === city;
                return (
                  <button
                    type="button"
                    key={city}
                    onClick={() => setLocalFilters((prev) => ({ ...prev, city }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {city}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minimum Rating */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
              Customer Rating
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Any', value: 0 },
                { label: '4.5+', value: 4.5 },
                { label: '4.8+', value: 4.8 },
                { label: '5.0', value: 5.0 },
              ].map((item) => (
                <button
                  type="button"
                  key={item.value}
                  onClick={() => setLocalFilters((prev) => ({ ...prev, minRating: item.value }))}
                  className={`p-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1 ${
                    localFilters.minRating === item.value
                      ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Experience */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
              Experience
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Any', value: 0 },
                { label: '5+ yrs', value: 5 },
                { label: '10+ yrs', value: 10 },
                { label: '15+ yrs', value: 15 },
              ].map((item) => (
                <button
                  type="button"
                  key={item.value}
                  onClick={() => setLocalFilters((prev) => ({ ...prev, minExperience: item.value }))}
                  className={`p-2 rounded-xl text-xs font-semibold border transition text-center ${
                    localFilters.minExperience === item.value
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Languages */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
              Language
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setLocalFilters((prev) => ({ ...prev, language: '' }))}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  !localFilters.language
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                All Languages
              </button>
              {languages.map((lang) => {
                const isSelected = localFilters.language === lang;
                return (
                  <button
                    type="button"
                    key={lang}
                    onClick={() => setLocalFilters((prev) => ({ ...prev, language: lang }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition active:scale-95 text-center"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};
