import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  TrendingUp,
  DollarSign,
  History,
  Building,
  CheckCircle2,
  Compass,
  Info,
  ExternalLink,
  ShieldAlert,
  BadgePercent,
  Home,
  Bed,
  Bath,
  Car,
  Maximize2,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import {
  TradeMePropertyInsightsResponse,
  NZSchoolItem,
  NearbySoldPropertyItem,
} from '../../types';
import { api } from '../../services/api';

interface PropertyInsightsProps {
  propertyIdOrSlug: string;
  className?: string;
}

export const PropertyInsights: React.FC<PropertyInsightsProps> = ({
  propertyIdOrSlug,
  className = '',
}) => {
  const [data, setData] = useState<TradeMePropertyInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'valuation' | 'schools' | 'sales' | 'legal' | 'hazards'>('all');
  const [schoolFilter, setSchoolFilter] = useState<'ALL' | 'IN_ZONE_ONLY' | 'PRIMARY' | 'SECONDARY'>('ALL');

  useEffect(() => {
    if (!propertyIdOrSlug) return;
    setLoading(true);
    setError(null);

    api.get<TradeMePropertyInsightsResponse>(`/properties/${propertyIdOrSlug}/insights`)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        console.warn('Failed to load property insights:', err);
        setError(err.message || 'Failed to load property insights');
      })
      .finally(() => setLoading(false));
  }, [propertyIdOrSlug]);

  if (loading) {
    return (
      <div className={`bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs ${className}`}>
        <div className="flex items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-2xl bg-slate-200" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-slate-200 rounded w-1/3" />
            <div className="h-3 bg-slate-100 rounded w-1/2" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="h-28 bg-slate-50 rounded-2xl animate-pulse" />
          <div className="h-28 bg-slate-50 rounded-2xl animate-pulse" />
          <div className="h-28 bg-slate-50 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  if (data.enabled === false) {
    return (
      <div className={`bg-slate-50/70 rounded-3xl border border-slate-200/90 p-6 sm:p-8 text-center ${className}`}>
        <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-slate-700">Property Insights Feature Inactive</h3>
        <p className="text-xs text-slate-500 mt-1">
          {data.message || 'Property insights feature is currently disabled by administrator.'}
        </p>
      </div>
    );
  }

  const {
    valuation,
    rental,
    rentalYield,
    councilValuation,
    schools,
    salesHistory,
    nearbySales,
    legalDetails,
    hazards,
  } = data;

  // Filter schools based on selection
  const filteredSchools = (schools?.schools || []).filter((s) => {
    if (schoolFilter === 'IN_ZONE_ONLY') return s.zoneStatus === 'IN_ZONE';
    if (schoolFilter === 'PRIMARY') {
      const t = s.schoolType.toLowerCase();
      return t.includes('primary') || t.includes('contributing');
    }
    if (schoolFilter === 'SECONDARY') {
      const t = s.schoolType.toLowerCase();
      return t.includes('secondary') || t.includes('high') || t.includes('college') || t.includes('intermediate');
    }
    return true;
  });

  return (
    <div className={`bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-8 ${className}`}>
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Property Insights
            </span>
            <span className="text-[11px] text-slate-400 font-medium">Authoritative NZ Data</span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-1">
            Property Data & Valuation Insights
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Equivalent to Trade Me Property Insights • Ministry of Education zones, CoreLogic/QV estimates, and Council records
          </p>
        </div>

        {/* Filter Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'All Insights' },
            { id: 'valuation', label: 'Valuation & Rent' },
            { id: 'schools', label: `Schools (${schools?.inZoneCount || 0} In Zone)` },
            { id: 'sales', label: 'Sales History' },
            { id: 'legal', label: 'Council & Legal' },
            { id: 'hazards', label: 'Hazards & Flooding' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. ESTIMATES & RENTAL YIELD CARDS */}
      {(activeTab === 'all' || activeTab === 'valuation') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Valuation & Rental Estimates</span>
            </h3>
            {valuation?.source && (
              <span className="text-[11px] text-slate-400 font-medium">
                Source: {valuation.source}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Property Value Estimate */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4.5 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-slate-400" />
                  Estimated Value
                </span>
                {valuation?.confidence && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      valuation.confidence === 'HIGH'
                        ? 'bg-emerald-100 text-emerald-800'
                        : valuation.confidence === 'MEDIUM'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {valuation.confidence} CONFIDENCE
                  </span>
                )}
              </div>

              {valuation?.available ? (
                <>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {valuation.estimatedValueDisplay}
                  </div>
                  {valuation.estimatedLowerDisplay && valuation.estimatedUpperDisplay && (
                    <div className="text-xs text-slate-500 font-medium">
                      Estimated range:{' '}
                      <span className="font-semibold text-slate-700">
                        {valuation.estimatedLowerDisplay} – {valuation.estimatedUpperDisplay}
                      </span>
                    </div>
                  )}
                  {valuation.lastUpdated && (
                    <div className="text-[11px] text-slate-400 pt-1">
                      Updated {valuation.lastUpdated}
                    </div>
                  )}
                </>
              ) : (
                <div className="py-2">
                  <div className="text-sm font-bold text-slate-700">
                    {valuation?.unavailabilityReason || 'Property estimate unavailable'}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Commercial valuation model is not configured for this specific listing.
                  </p>
                </div>
              )}
            </div>

            {/* Weekly Rental Estimate */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                  {rental?.label || 'Weekly Rent Estimate'}
                </span>
                <span className="text-[10px] font-semibold text-slate-400">
                  {rental?.label === 'Area Market Rent' ? 'MBIE Bonds' : 'Market Index'}
                </span>
              </div>

              {rental?.available ? (
                <>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {rental.weeklyRentDisplay}
                  </div>
                  {rental.weeklyRangeDisplay && (
                    <div className="text-xs text-slate-500 font-medium">
                      Estimated range:{' '}
                      <span className="font-semibold text-slate-700">{rental.weeklyRangeDisplay}</span>
                    </div>
                  )}
                  <div className="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
                    <span>{rental.source || 'MBIE Tenancy Services'}</span>
                    {rental.lastUpdated && <span>Updated {rental.lastUpdated}</span>}
                  </div>
                </>
              ) : (
                <div className="py-2">
                  <div className="text-sm font-bold text-slate-700">Rental estimate unavailable</div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Insufficient comparable rental bonds recorded in this immediate radius.
                  </p>
                </div>
              )}
            </div>

            {/* Estimated Gross Rental Yield */}
            <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-2xl p-4.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <BadgePercent className="w-3.5 h-3.5 text-emerald-600" />
                  Est. Gross Rental Yield
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  INDICATIVE
                </span>
              </div>

              {rentalYield?.available ? (
                <>
                  <div className="text-2xl font-black text-emerald-950 tracking-tight">
                    {rentalYield.grossYieldDisplay}
                  </div>
                  {rentalYield.annualRentDisplay && (
                    <div className="text-xs text-emerald-800 font-medium">
                      {rentalYield.annualRentDisplay}
                    </div>
                  )}
                  <p className="text-[10px] text-emerald-700/80 leading-snug pt-1">
                    Formula: (Est. Annual Rent ÷ Est. Property Value) × 100. Excludes rates & maintenance.
                  </p>
                </>
              ) : (
                <div className="py-2">
                  <div className="text-sm font-bold text-slate-600">Yield unavailable</div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Requires both property valuation and rental estimates.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. SCHOOL ZONES & MoE SCHOOL DETAILS */}
      {(activeTab === 'all' || activeTab === 'schools') && (
        <div className="space-y-4 pt-2 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-emerald-600" />
                <span>Schools & Enrolment Zones</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Official Ministry of Education NZ school directory and enrolment schemes (home zones).
              </p>
            </div>

            {/* School Filter Chips */}
            <div className="flex items-center gap-1.5">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'IN_ZONE_ONLY', label: `In Zone (${schools?.inZoneCount || 0})` },
                { id: 'PRIMARY', label: 'Primary' },
                { id: 'SECONDARY', label: 'Secondary' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSchoolFilter(f.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    schoolFilter === f.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredSchools.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredSchools.map((school: NZSchoolItem) => {
                const isInZone = school.zoneStatus === 'IN_ZONE';
                const isOutOfZone = school.zoneStatus === 'OUT_OF_ZONE';

                return (
                  <div
                    key={school.id}
                    className={`rounded-2xl p-4 border transition-all ${
                      isInZone
                        ? 'bg-emerald-50/40 border-emerald-200/80 shadow-2xs'
                        : 'bg-white border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 leading-snug">
                            {school.name}
                          </h4>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600 font-medium">
                          <span>{school.schoolType}</span>
                          <span className="text-slate-300">•</span>
                          <span>{school.yearLevels}</span>
                          <span className="text-slate-300">•</span>
                          <span>{school.gender}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-0.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                            {school.authority}
                          </span>
                          {school.decile && (
                            <span className="text-slate-400">Decile {school.decile}</span>
                          )}
                          {school.enrolmentRoll && (
                            <span className="text-slate-400">• Roll {school.enrolmentRoll}</span>
                          )}
                          <span className="text-slate-400">• {school.distanceText} away</span>
                        </div>
                      </div>

                      {/* Zone Status Badge */}
                      <div>
                        {isInZone ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-600 text-white shadow-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            In Zone
                          </span>
                        ) : isOutOfZone ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                            Out of Zone
                          </span>
                        ) : school.zoneStatus === 'UNKNOWN' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600">
                            Zone Unverified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600">
                            Not Zoned
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
              No schools matched the selected filter.
            </div>
          )}
        </div>
      )}

      {/* 3. COUNCIL RATEABLE VALUE (CV) & LEGAL DETAILS */}
      {(activeTab === 'all' || activeTab === 'legal') && (
        <div className="space-y-4 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Building className="w-4 h-4 text-emerald-600" />
              <span>Council Valuation (CV) & Legal Details</span>
            </h3>
            {councilValuation?.valuationSource && (
              <span className="text-[11px] text-slate-400 font-medium">
                {councilValuation.valuationSource}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Council Rateable Valuation (CV) */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                <span className="text-xs font-bold text-slate-700">Official Capital Value (CV / RV)</span>
                <span className="text-base font-black text-slate-900">
                  {councilValuation?.capitalValueDisplay || 'Not recorded'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Land Value (LV)</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                    {councilValuation?.landValueDisplay || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Improvements Value (IV)</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                    {councilValuation?.improvementsValueDisplay || '—'}
                  </span>
                </div>
              </div>

              {councilValuation?.valuationDate && (
                <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-200/60">
                  Valuation as at: {councilValuation.valuationDate}
                </div>
              )}
            </div>

            {/* Legal & Property Details */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span className="font-bold text-slate-800">Property & Land</span>
                <span className="text-[11px] text-slate-400 font-medium">Source: {legalDetails?.source || 'LINZ'}</span>
              </div>

              {!legalDetails || (!legalDetails.legalDescription && !legalDetails.parcelId && !legalDetails.titleReference) ? (
                <div className="py-4 text-center text-slate-500">
                  <p className="font-medium text-slate-600">Property legal details unavailable</p>
                  {legalDetails?.status === 'WAITING_FOR_PROVIDER_CREDENTIALS' && (
                    <p className="text-[11px] text-amber-600 mt-1">Architecture ready — LINZ API key required</p>
                  )}
                </div>
              ) : (
                <>
                  {legalDetails?.legalDescription && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Legal Description</span>
                      <span className="font-bold text-slate-800 text-right">
                        {legalDetails.legalDescription}
                      </span>
                    </div>
                  )}
                  {legalDetails?.landAreaM2 && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Land Area</span>
                      <span className="font-bold text-slate-800">
                        {legalDetails.landAreaM2} m²
                      </span>
                    </div>
                  )}
                  {legalDetails?.estateType && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Estate Type</span>
                      <span className="font-bold text-slate-800">
                        {legalDetails.estateType}
                      </span>
                    </div>
                  )}
                  {legalDetails?.titleReference && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Title Reference</span>
                      <span className="font-bold text-slate-800">
                        {legalDetails.titleReference}
                      </span>
                    </div>
                  )}
                  {legalDetails?.parcelId && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">LINZ Parcel ID</span>
                      <span className="font-bold text-slate-800 font-mono">
                        {legalDetails.parcelId}
                      </span>
                    </div>
                  )}
                  {legalDetails?.councilName && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Territorial Authority</span>
                      <span className="font-bold text-slate-800">
                        {legalDetails.councilName}
                      </span>
                    </div>
                  )}
                  {legalDetails?.districtZoning && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">District Plan Zoning</span>
                      <span className="font-bold text-slate-800 text-right">
                        {legalDetails.districtZoning}
                      </span>
                    </div>
                  )}
                  <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                    <span>Source: {legalDetails?.source || 'Land Information New Zealand (LINZ)'}</span>
                    {legalDetails?.status === 'LIVE' && (
                      <span className="text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Authoritative LINZ Cadastre
                      </span>
                    )}
                    {legalDetails?.status === 'WAITING_FOR_PROVIDER_CREDENTIALS' && (
                      <span className="text-amber-600 font-medium">Awaiting Live LINZ Key</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. PUBLIC SALES HISTORY */}
      {(activeTab === 'all' || activeTab === 'sales') && (
        <div className="space-y-4 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-600" />
              <span>Public Sales History</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">
              Land Information NZ & Public Transfer Records
            </span>
          </div>

          {salesHistory && salesHistory.length > 0 ? (
            <div className="overflow-hidden border border-slate-200/80 rounded-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold">
                    <th className="py-3 px-4">Sale Date</th>
                    <th className="py-3 px-4">Sale Price</th>
                    <th className="py-3 px-4">Transaction Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salesHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">{item.saleDate}</td>
                      <td className="py-3 px-4 font-black text-slate-900">{item.priceDisplay}</td>
                      <td className="py-3 px-4 text-slate-500">{item.saleType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
              No historical public transfer transactions recorded on title for this property.
            </div>
          )}
        </div>
      )}

      {/* 5. NEARBY COMPARABLE RECENT SALES */}
      {(activeTab === 'all' || activeTab === 'sales') && (
        <div className="space-y-4 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Compass className="w-4 h-4 text-emerald-600" />
                <span>Nearby Comparable Recent Sales</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Authoritative recent property transactions within immediate proximity.
              </p>
            </div>
            <span className="text-[11px] text-slate-400 font-semibold">
              {nearbySales?.length || 0} Comparables
            </span>
          </div>

          {nearbySales && nearbySales.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {nearbySales.map((sale: NearbySoldPropertyItem) => (
                <div
                  key={sale.id}
                  className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden hover:border-slate-300 transition-all shadow-2xs"
                >
                  {sale.imageUrl && (
                    <div className="h-28 w-full overflow-hidden bg-slate-100">
                      <img
                        src={sale.imageUrl}
                        alt={sale.address}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="p-3.5 space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-base font-black text-slate-900 tracking-tight">
                        {sale.soldPriceDisplay}
                      </span>
                      <span className="text-[11px] font-bold text-slate-500">{sale.soldDate}</span>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-800 line-clamp-1">
                        {sale.address}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {sale.suburb}, {sale.city} •{' '}
                        <span className="text-emerald-700 font-semibold">{sale.distanceText}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3 pt-1 border-t border-slate-100 text-[11px] text-slate-600 font-medium">
                      <span className="flex items-center gap-1">
                        <Bed className="w-3 h-3 text-slate-400" />
                        {sale.bedrooms}
                      </span>
                      <span className="flex items-center gap-1">
                        <Bath className="w-3 h-3 text-slate-400" />
                        {sale.bathrooms}
                      </span>
                      {sale.parkingSpaces > 0 && (
                        <span className="flex items-center gap-1">
                          <Car className="w-3 h-3 text-slate-400" />
                          {sale.parkingSpaces}
                        </span>
                      )}
                      {sale.floorAreaM2 && (
                        <span className="flex items-center gap-1">
                          <Maximize2 className="w-3 h-3 text-slate-400" />
                          {sale.floorAreaM2}m²
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
              No comparable recent sales found within the immediate radius.
            </div>
          )}
        </div>
      )}

      {/* 6. COUNCIL FLOOD & HAZARD MAPPING OVERLAYS */}
      {(activeTab === 'all' || activeTab === 'hazards') && (
        <div className="space-y-4 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Council Flood & Natural Hazard Mapping</span>
            </h3>
            {hazards?.councilName && (
              <span className="text-[11px] text-slate-400 font-medium">
                {hazards.councilName} GIS
              </span>
            )}
          </div>

          {hazards?.isHazardDataAvailable ? (
            <div className="space-y-3">
              {hazards.overlays.map((ov, idx) => (
                <div
                  key={idx}
                  className={`rounded-2xl p-4 border flex items-start gap-3 ${
                    ov.severity === 'HIGH'
                      ? 'bg-rose-50/60 border-rose-200 text-rose-950'
                      : ov.severity === 'MEDIUM'
                      ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                      : 'bg-blue-50/60 border-blue-200 text-blue-950'
                  }`}
                >
                  <AlertTriangle
                    className={`w-5 h-5 shrink-0 mt-0.5 ${
                      ov.severity === 'HIGH'
                        ? 'text-rose-600'
                        : ov.severity === 'MEDIUM'
                        ? 'text-amber-600'
                        : 'text-blue-600'
                    }`}
                  />
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold">{ov.label}</h4>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-white/80 border">
                        {ov.severity} RISK LAYER
                      </span>
                    </div>
                    <p className="text-xs opacity-90 leading-relaxed">{ov.description}</p>
                    {ov.sourceUrl && (
                      <a
                        href={ov.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:underline pt-1"
                      >
                        View Official Council GIS Viewer
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600">
              <span className="font-bold text-slate-800 block">
                {hazards?.unavailabilityReason || 'Hazard map data unavailable for this area'}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">
                Official council GIS hazard overlays have not been digitized or published for this territorial jurisdiction.
              </p>
            </div>
          )}

          {/* Mandatory Council LIM Notice */}
          <div className="bg-amber-50/40 border border-amber-200/70 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed text-[11px]">
              <span className="font-bold">Important Notice: </span>
              {hazards?.limNotice ||
                'Absence of mapped hazard data does not imply absence of risk. Consult a Land Information Memorandum (LIM) from the relevant district council for complete flood, overland flow, and geotechnical records.'}
            </div>
          </div>
        </div>
      )}

      {/* 7. AUTHORITATIVE DATA SOURCES & PROVENANCE */}
      {data.dataSources && data.dataSources.length > 0 && (
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Authoritative Data Provenance
            </span>
            <span className="text-[10px] text-slate-400">
              Verified New Zealand Government & Council Sources
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.dataSources.map((ds, idx) => (
              <div
                key={idx}
                className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-2.5 text-xs flex items-center justify-between gap-2"
              >
                <div className="truncate">
                  <div className="font-semibold text-slate-800 text-[11px] truncate">{ds.module}</div>
                  <div className="text-[10px] text-slate-500 truncate">{ds.source}</div>
                </div>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase shrink-0 ${
                    ds.status === 'LIVE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : ds.status === 'CACHED'
                      ? 'bg-blue-100 text-blue-800'
                      : ds.status === 'WAITING_FOR_CREDENTIALS'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {ds.status === 'WAITING_FOR_CREDENTIALS' ? 'PENDING KEY' : ds.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
