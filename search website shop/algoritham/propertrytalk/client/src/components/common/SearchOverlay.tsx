import React, { useState, useEffect } from 'react';
import { X, Search as SearchIcon, ArrowRight } from 'lucide-react';
import { Expert } from '../../types';
import { api } from '../../services/api';
import { ExpertCard } from '../cards/ExpertCard';
import { useCountry } from '../../context/CountryContext';
import { ExpertCardSkeleton } from './SkeletonLoader';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({ isOpen, onClose }) => {
  const { selectedCountry } = useCountry();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      api.get<Expert[]>(`/experts?countryCode=${selectedCountry?.code || 'NZ'}&search=${encodeURIComponent(query.trim())}`)
        .then(setResults)
        .catch(console.error)
        .finally(() => setLoading(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [query, selectedCountry]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col animate-fade-in">
      {/* Search Header */}
      <div className="p-3 sm:p-4 border-b border-slate-200 flex items-center gap-3">
        <div className="relative flex-1">
          <SearchIcon className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, profession, city, speciality..."
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
          />
        </div>

        <button
          onClick={onClose}
          className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Quick Search Chips */}
      {!query && (
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
            Popular Searches
          </span>
          <div className="flex flex-wrap gap-1.5">
            {['Auction strategy', 'First home loan', 'Pre-purchase inspection', 'Title check', 'Auckland', 'Sydney'].map((term) => (
              <button
                key={term}
                onClick={() => setQuery(term)}
                className="text-xs bg-white text-slate-700 px-3 py-1.5 rounded-full border border-slate-200 hover:border-emerald-500 font-medium"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            <ExpertCardSkeleton />
            <ExpertCardSkeleton />
            <ExpertCardSkeleton />
          </div>
        ) : results.length > 0 ? (
          results.map((expert) => (
            <ExpertCard key={expert.id} expert={expert} />
          ))
        ) : query.trim() ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            No verified professionals found matching "{query}".
          </div>
        ) : null}
      </div>
    </div>
  );
};
