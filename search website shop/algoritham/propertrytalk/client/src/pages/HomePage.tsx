import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCountry } from '../context/CountryContext';
import { Category, Expert } from '../types';
import { api } from '../services/api';
import { ExpertCard } from '../components/cards/ExpertCard';
import { FilterModal, FilterState } from '../components/common/FilterModal';
import { ExpertCardSkeleton } from '../components/common/SkeletonLoader';
import {
  Search,
  SlidersHorizontal,
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
  Clock,
  Sparkles,
  ChevronRight,
  Radio,
  Star,
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

export const HomePage: React.FC = () => {
  const { selectedCountry } = useCountry();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('all');
  const [experts, setExperts] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter modal state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    onlineOnly: false,
    city: '',
    minRating: 0,
    minExperience: 0,
    language: '',
  });

  // Sort sub-tab
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'recommended' | 'topRated'>('all');

  // Fetch categories
  useEffect(() => {
    api.get<Category[]>('/categories')
      .then(setCategories)
      .catch(console.error);
  }, []);

  // Fetch experts based on country, category, search, and filters
  useEffect(() => {
    setLoading(true);
    const query = new URLSearchParams();
    query.set('countryCode', selectedCountry?.code || 'NZ');

    if (selectedCategorySlug && selectedCategorySlug !== 'all') {
      query.set('category', selectedCategorySlug);
    }
    if (filters.onlineOnly) query.set('onlineOnly', 'true');
    if (filters.city) query.set('city', filters.city);
    if (filters.minRating > 0) query.set('minRating', filters.minRating.toString());
    if (searchQuery.trim()) query.set('search', searchQuery.trim());

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
        if (activeSubTab === 'topRated') {
          filtered.sort((a, b) => (b.ratingAvg || 0) - (a.ratingAvg || 0));
        }
        setExperts(filtered);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCountry, selectedCategorySlug, filters, searchQuery, activeSubTab]);

  const handleCategorySelect = (slug: string) => {
    setSelectedCategorySlug(slug);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const onlineExperts = experts.filter((e) => e.isOnline);
  const displayExperts = activeSubTab === 'recommended'
    ? experts.filter((e) => e.ratingAvg >= 4.9)
    : experts;

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 pb-28">
      {/* 1. Top Hero Section */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs mb-4 text-center sm:text-left relative overflow-hidden">
        {/* Subtle accent background orb */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-50 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

        <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            <span>First 1 Minute FREE</span>
          </span>
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">
            • Verified {selectedCountry?.name} Professionals
          </span>
        </div>

        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          Talk to a verified property expert
        </h1>

        <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
          Chat first. Audio or video when you’re ready.
        </p>

        {/* Search Input: "What do you need help with?" */}
        <form onSubmit={handleSearchSubmit} className="mt-4 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="What do you need help with? (e.g. mortgage pre-approval, contract)"
            className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden placeholder:text-slate-400 transition"
          />
        </form>
      </div>

      {/* 2. Compact Horizontal Category Selector with [ Filter ] button */}
      <div className="mb-5">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {/* Separate [ Filter ] button */}
          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white border border-slate-200/90 text-slate-700 hover:border-slate-300 text-xs font-bold shrink-0 shadow-xs transition active:scale-95"
            title="Open advanced filters"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
            <span>Filter</span>
            {(filters.onlineOnly || filters.city || filters.minRating > 0) && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>

          {/* [ All ] Category Chip */}
          <button
            type="button"
            onClick={() => handleCategorySelect('all')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 active:scale-95 ${
              selectedCategorySlug === 'all'
                ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-600/20'
                : 'bg-white text-slate-600 border border-slate-200/90 hover:border-slate-300'
            }`}
          >
            <span>All</span>
          </button>

          {/* Dynamic Category Chips */}
          {categories.map((cat) => {
            const isSelected = selectedCategorySlug === cat.slug;
            const IconComp = categoryIconMap[cat.slug] || HomeIcon;
            const shortLabel = getCategoryShortLabel(cat.slug, cat.name);

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategorySelect(cat.slug)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 active:scale-95 ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-600/20'
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

      {/* 3. Section Header & Sub-Tabs */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            {filters.onlineOnly ? 'Experts Online Now' : 'Property Professionals'}
          </h2>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>

        {/* Sub-tabs: All, Recommended, Top Rated */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-[11px] font-bold">
          <button
            onClick={() => setActiveSubTab('all')}
            className={`px-2.5 py-1 rounded-lg transition ${
              activeSubTab === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveSubTab('recommended')}
            className={`px-2.5 py-1 rounded-lg transition ${
              activeSubTab === 'recommended' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Recommended
          </button>
          <button
            onClick={() => setActiveSubTab('topRated')}
            className={`px-2.5 py-1 rounded-lg transition ${
              activeSubTab === 'topRated' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Top Rated
          </button>
        </div>
      </div>

      {/* 4. Expert Cards List (Compact Horizontal Cards) */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            <ExpertCardSkeleton />
            <ExpertCardSkeleton />
            <ExpertCardSkeleton />
            <ExpertCardSkeleton />
          </div>
        ) : displayExperts.length > 0 ? (
          displayExperts.map((expert) => (
            <ExpertCard key={expert.id} expert={expert} />
          ))
        ) : (
          /* Empty State */
          <div className="bg-white rounded-3xl border border-slate-200/90 p-8 text-center my-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Radio className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {selectedCategorySlug !== 'all'
                ? 'No experts are available in this category yet.'
                : 'No online experts found right now'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {selectedCategorySlug !== 'all'
                ? 'Please check back shortly or explore another category.'
                : 'No experts match these specific filters right now. You can adjust filters or book an advance appointment.'}
            </p>
            <button
              onClick={() => {
                setSelectedCategorySlug('all');
                setFilters({ onlineOnly: false, city: '', minRating: 0, minExperience: 0, language: '' });
                setSearchQuery('');
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs"
            >
              Reset All Filters
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
