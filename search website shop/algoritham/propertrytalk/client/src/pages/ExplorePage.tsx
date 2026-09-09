import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useCountry } from '../context/CountryContext';
import { Property, Expert, Category } from '../types';
import { api } from '../services/api';
import { PropertyCard } from '../components/cards/PropertyCard';
import { ExpertCard } from '../components/cards/ExpertCard';
import { ExpertCardSkeleton } from '../components/common/SkeletonLoader';
import {
  Building2,
  Users,
  Search,
  Filter,
  SlidersHorizontal,
  Home,
  Video,
  CheckCircle2,
  X,
  Radio,
  MapPin,
} from 'lucide-react';

export const ExplorePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedCountry } = useCountry();

  // Primary Explore Tab: 'properties' | 'professionals'
  const initialTab = (searchParams.get('tab') as 'properties' | 'professionals') || 'properties';
  const [activeTab, setActiveTab] = useState<'properties' | 'professionals'>(initialTab);

  // Property Filters
  const [listingType, setListingType] = useState<string>(searchParams.get('type') || 'ALL');
  const [propertyType, setPropertyType] = useState<string>('ALL');
  const [cityFilter, setCityFilter] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [minBedrooms, setMinBedrooms] = useState<number>(0);
  const [remoteViewingOnly, setRemoteViewingOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('search') || '');

  // Professional Filters
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [onlineOnlyPros, setOnlineOnlyPros] = useState<boolean>(false);

  // Data States
  const [properties, setProperties] = useState<Property[]>([]);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Sync tab with URL
  const handleTabChange = (tab: 'properties' | 'professionals') => {
    setActiveTab(tab);
    searchParams.set('tab', tab);
    setSearchParams(searchParams);
  };

  // Load categories
  useEffect(() => {
    api.get<Category[]>('/categories')
      .then(setCategories)
      .catch(console.error);
  }, []);

  // Fetch properties or experts depending on activeTab
  useEffect(() => {
    setLoading(true);

    if (activeTab === 'properties') {
      const q = new URLSearchParams();
      if (listingType !== 'ALL') q.set('listingType', listingType);
      if (propertyType !== 'ALL') q.set('propertyType', propertyType);
      if (cityFilter) q.set('city', cityFilter);
      if (minPrice) q.set('minPrice', (parseInt(minPrice) * 100).toString());
      if (maxPrice) q.set('maxPrice', (parseInt(maxPrice) * 100).toString());
      if (minBedrooms > 0) q.set('minBedrooms', minBedrooms.toString());
      if (remoteViewingOnly) q.set('remoteViewingOnly', 'true');
      if (searchQuery.trim()) q.set('search', searchQuery.trim());

      api.get<{ properties: Property[]; total: number }>(`/properties?${q.toString()}`)
        .then((res) => setProperties(res.properties || []))
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      const q = new URLSearchParams();
      q.set('countryCode', selectedCountry?.code || 'NZ');
      if (selectedCategory && selectedCategory !== 'all') q.set('category', selectedCategory);
      if (onlineOnlyPros) q.set('onlineOnly', 'true');
      if (cityFilter) q.set('city', cityFilter);
      if (searchQuery.trim()) q.set('search', searchQuery.trim());

      api.get<Expert[]>(`/experts?${q.toString()}`)
        .then(setExperts)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [
    activeTab,
    listingType,
    propertyType,
    cityFilter,
    minPrice,
    maxPrice,
    minBedrooms,
    remoteViewingOnly,
    selectedCategory,
    onlineOnlyPros,
    searchQuery,
    selectedCountry,
  ]);

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-5 pb-28 space-y-6">
      {/* 1. Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Explore PropertyTalk
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Browse verified listings, remote live viewings, or consult licensed experts
          </p>
        </div>

        {/* Big 2-Tab Switcher */}
        <div className="bg-slate-200/80 p-1 rounded-2xl flex items-center shadow-inner self-start sm:self-auto">
          <button
            type="button"
            onClick={() => handleTabChange('properties')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
              activeTab === 'properties'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span>Properties ({properties.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('professionals')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
              activeTab === 'professionals'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-600" />
            <span>Professionals</span>
          </button>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-4 shadow-xs space-y-3">
        {/* Search input row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'properties'
                  ? 'Search by suburb, city, or property title (e.g. Ponsonby, Auckland)...'
                  : 'Search expert by name, specialty, or city...'
              }
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition shrink-0 ${
              showAdvancedFilters || remoteViewingOnly || minBedrooms > 0 || cityFilter
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Filters</span>
          </button>
        </div>

        {/* Tab-specific Quick Filter Chips */}
        {activeTab === 'properties' ? (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {/* Buy / Rent toggle chips */}
            {['ALL', 'SALE', 'RENT'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setListingType(type)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition ${
                  listingType === type
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {type === 'ALL' ? 'All Listings' : type === 'SALE' ? 'Buy' : 'Rent'}
              </button>
            ))}

            {/* Remote Live Viewing Toggle */}
            <button
              type="button"
              onClick={() => setRemoteViewingOnly(!remoteViewingOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 ${
                remoteViewingOnly
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Remote Live Viewing</span>
            </button>

            {/* City Quick Pills */}
            {['Auckland', 'Wellington', 'Christchurch'].map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => setCityFilter(cityFilter === city ? '' : city)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1 ${
                  cityFilter === city
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <MapPin className="w-3 h-3" />
                <span>{city}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Categories
            </button>

            <button
              type="button"
              onClick={() => setOnlineOnlyPros(!onlineOnlyPros)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 ${
                onlineOnlyPros
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Online Now</span>
            </button>

            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c.slug)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition ${
                  selectedCategory === c.slug
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Collapsible Advanced Filters Drawer */}
        {showAdvancedFilters && activeTab === 'properties' && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-slate-500 font-medium mb-1">Property Type</label>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium"
              >
                <option value="ALL">Any Type</option>
                <option value="HOUSE">House</option>
                <option value="APARTMENT">Apartment</option>
                <option value="TOWNHOUSE">Townhouse</option>
                <option value="UNIT">Unit</option>
                <option value="LAND">Section / Land</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-500 font-medium mb-1">Min Bedrooms</label>
              <select
                value={minBedrooms}
                onChange={(e) => setMinBedrooms(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium"
              >
                <option value="0">Any</option>
                <option value="1">1+ Beds</option>
                <option value="2">2+ Beds</option>
                <option value="3">3+ Beds</option>
                <option value="4">4+ Beds</option>
                <option value="5">5+ Beds</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-500 font-medium mb-1">Min Price ($ NZD)</label>
              <input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="e.g. 500000"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-medium mb-1">Max Price ($ NZD)</label>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="e.g. 2500000"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Results Content */}
      {activeTab === 'properties' ? (
        <div>
          <div className="flex items-center justify-between mb-3 text-xs text-slate-500">
            <span>Showing {properties.length} properties</span>
            {remoteViewingOnly && (
              <span className="text-amber-700 font-bold flex items-center gap-1">
                <Video className="w-3.5 h-3.5" /> Remote Viewing Enabled Only
              </span>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
              <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
              <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
            </div>
          ) : properties.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {properties.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center">
              <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="font-bold text-slate-800 text-sm">No properties match your current filters</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Try clearing your search query or price constraints to see all available New Zealand properties.
              </p>
              <button
                type="button"
                onClick={() => {
                  setListingType('ALL');
                  setPropertyType('ALL');
                  setCityFilter('');
                  setMinPrice('');
                  setMaxPrice('');
                  setMinBedrooms(0);
                  setRemoteViewingOnly(false);
                  setSearchQuery('');
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Professionals Tab */
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2 text-xs text-slate-500">
            <span>Showing {experts.length} verified property professionals</span>
            {onlineOnlyPros && (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Online Only
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              <ExpertCardSkeleton />
              <ExpertCardSkeleton />
              <ExpertCardSkeleton />
            </div>
          ) : experts.length > 0 ? (
            experts.map((expert) => <ExpertCard key={expert.id} expert={expert} />)
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center">
              <Radio className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="font-bold text-slate-800 text-sm">No professionals found</h3>
              <p className="text-xs text-slate-500 mt-1">
                Try selecting a different category or resetting your search.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
