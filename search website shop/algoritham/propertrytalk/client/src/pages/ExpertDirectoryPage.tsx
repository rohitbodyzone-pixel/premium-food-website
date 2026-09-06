import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCountry } from '../context/CountryContext';
import { Expert, Category } from '../types';
import { api } from '../services/api';
import { ExpertCard } from '../components/cards/ExpertCard';
import { FilterModal, FilterState } from '../components/common/FilterModal';
import { ExpertCardSkeleton } from '../components/common/SkeletonLoader';
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  X,
  Home as HomeIcon,
  Landmark,
  Scale,
  ShieldCheck,
  Key,
  Calculator,
  Shield,
  Hammer,
  FileText,
  TrendingUp,
} from 'lucide-react';

const categoryIconMap: Record<string, React.ElementType> = {
  'real-estate-agent': HomeIcon,
  'mortgage-adviser': Landmark,
  'property-lawyer': Scale,
  'building-inspector': ShieldCheck,
  'property-manager': Key,
  'property-valuer': Calculator,
  'insurance-adviser': Shield,
  'builder-renovation': Hammer,
  'property-tax-adviser': FileText,
  'property-investment-expert': TrendingUp,
};

const getCategoryShortLabel = (slug: string, defaultName: string) => {
  const map: Record<string, string> = {
    'real-estate-agent': 'Real Estate',
    'mortgage-adviser': 'Mortgage',
    'property-lawyer': 'Lawyer',
    'building-inspector': 'Inspector',
    'property-manager': 'Property Manager',
    'property-valuer': 'Valuer',
    'insurance-adviser': 'Insurance',
    'builder-renovation': 'Builder',
    'property-tax-adviser': 'Tax Adviser',
    'property-investment-expert': 'Investment',
  };
  return map[slug] || defaultName;
};

export const ExpertDirectoryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedCountry, setIsCountryModalOpen } = useCountry();

  const [experts, setExperts] = useState<Expert[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters from URL query or state
  const activeCategory = searchParams.get('category') || 'all';
  const countryCode = searchParams.get('country') || selectedCountry?.code || 'NZ';
  const initialSearch = searchParams.get('search') || '';

  const [search, setSearch] = useState(initialSearch);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    onlineOnly: false,
    city: '',
    minRating: 0,
    minExperience: 0,
    language: '',
  });

  // Fetch categories
  useEffect(() => {
    api.get<Category[]>('/categories')
      .then(setCategories)
      .catch(console.error);
  }, []);

  // Fetch experts with active filters
  useEffect(() => {
    setLoading(true);
    const query = new URLSearchParams();
    query.set('countryCode', countryCode);
    if (activeCategory && activeCategory !== 'all') query.set('category', activeCategory);
    if (filters.onlineOnly) query.set('onlineOnly', 'true');
    if (filters.city) query.set('city', filters.city);
    if (filters.minRating > 0) query.set('minRating', filters.minRating.toString());
    if (search.trim()) query.set('search', search.trim());

    api.get<Expert[]>(`/experts?${query.toString()}`)
      .then((data) => {
        let filtered = [...data];
        if (filters.minExperience > 0) {
          filtered = filtered.filter((e) => e.yearsOfExperience >= filters.minExperience);
        }
        if (filters.language) {
          filtered = filtered.filter((e) =>
            e.languages?.some((l) => l.toLowerCase() === filters.language.toLowerCase())
          );
        }
        setExperts(filtered);
      })
      .catch((err) => console.error('Failed to load experts:', err))
      .finally(() => setLoading(false));
  }, [activeCategory, countryCode, filters, search]);

  const handleCategorySelect = (slug: string) => {
    if (slug === 'all') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', slug);
    }
    setSearchParams(searchParams);
  };

  const currentCategoryObj = categories.find((c) => c.slug === activeCategory);

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 pb-28">
      {/* Top Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-0.5">
              <button
                onClick={() => setIsCountryModalOpen(true)}
                className="hover:text-emerald-600 flex items-center gap-1 font-bold text-slate-800"
              >
                <span>{selectedCountry?.flag}</span>
                <span>{selectedCountry?.name}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              <span>/</span>
              <span className="text-emerald-600 font-medium">
                {currentCategoryObj ? currentCategoryObj.name : 'All Categories'}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {currentCategoryObj ? currentCategoryObj.name : 'Verified Property Experts'}
            </h1>
          </div>

          <span className="text-xs text-slate-400 font-semibold shrink-0">
            {experts.length} found
          </span>
        </div>

        {/* Search input */}
        <div className="mt-3 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, city, specialities..."
            className="w-full pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Category Chips with [ Filter ] button */}
      <div className="mb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {/* Filter Button */}
          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white border border-slate-200/90 text-slate-700 hover:border-slate-300 text-xs font-bold shrink-0 shadow-xs transition active:scale-95"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
            <span>Filter</span>
            {(filters.onlineOnly || filters.city || filters.minRating > 0) && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>

          {/* All Chip */}
          <button
            type="button"
            onClick={() => handleCategorySelect('all')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 ${
              activeCategory === 'all' || !activeCategory
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200/90 hover:border-slate-300'
            }`}
          >
            <span>All</span>
          </button>

          {/* Dynamic Categories */}
          {categories.map((cat) => {
            const isSelected = activeCategory === cat.slug;
            const IconComp = categoryIconMap[cat.slug] || HomeIcon;
            const shortLabel = getCategoryShortLabel(cat.slug, cat.name);

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategorySelect(cat.slug)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200/90 hover:border-slate-300'
                }`}
              >
                <IconComp className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                <span>{shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Filter Chips summary */}
      {(filters.onlineOnly || filters.city || filters.minRating > 0 || filters.language) && (
        <div className="flex items-center gap-2 mb-3 text-xs flex-wrap">
          <span className="text-slate-400 font-medium">Active filters:</span>
          {filters.onlineOnly && (
            <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold">
              Online Only
            </span>
          )}
          {filters.city && (
            <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-semibold">
              {filters.city}
            </span>
          )}
          {filters.minRating > 0 && (
            <span className="bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded-full font-semibold">
              ★ {filters.minRating}+
            </span>
          )}
          {filters.language && (
            <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-semibold">
              {filters.language}
            </span>
          )}
          <button
            onClick={() =>
              setFilters({ onlineOnly: false, city: '', minRating: 0, minExperience: 0, language: '' })
            }
            className="text-red-500 font-semibold hover:underline text-[11px]"
          >
            Clear
          </button>
        </div>
      )}

      {/* Expert Cards List (Compact Horizontal Cards) */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            <ExpertCardSkeleton />
            <ExpertCardSkeleton />
            <ExpertCardSkeleton />
          </div>
        ) : experts.length > 0 ? (
          experts.map((expert) => (
            <ExpertCard key={expert.id} expert={expert} />
          ))
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-8 text-center my-6">
            <h3 className="text-sm font-bold text-slate-800">
              {activeCategory !== 'all'
                ? 'No experts are available in this category yet.'
                : 'No professionals found'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {activeCategory !== 'all'
                ? 'Please check back shortly or explore another category.'
                : 'Try adjusting your category or clearing filters.'}
            </p>
            <button
              onClick={() => {
                handleCategorySelect('all');
                setFilters({ onlineOnly: false, city: '', minRating: 0, minExperience: 0, language: '' });
                setSearch('');
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Filter Bottom Sheet Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filters={filters}
        onApply={(newFilters) => setFilters(newFilters)}
        onReset={() =>
          setFilters({ onlineOnly: false, city: '', minRating: 0, minExperience: 0, language: '' })
        }
      />
    </div>
  );
};
