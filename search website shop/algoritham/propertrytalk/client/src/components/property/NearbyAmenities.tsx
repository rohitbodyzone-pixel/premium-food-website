import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  ShoppingCart,
  HeartPulse,
  Pill,
  Trees,
  Dumbbell,
  Fuel,
  Coffee,
  Bus,
  Star,
  Clock,
  MapPin,
  ChevronRight,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';
import { NearbyAmenityItem, NearbyAmenitiesResponse, AmenityCategory } from '../../types';
import { api } from '../../services/api';

interface NearbyAmenitiesProps {
  propertyIdOrSlug: string;
  latitude?: number | null;
  longitude?: number | null;
}

const CATEGORY_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  all: { label: 'All Places', icon: Layers },
  schools: { label: 'Schools', icon: GraduationCap },
  supermarkets: { label: 'Supermarkets', icon: ShoppingCart },
  hospitals: { label: 'Hospitals', icon: HeartPulse },
  pharmacies: { label: 'Pharmacies', icon: Pill },
  parks: { label: 'Parks & Recreation', icon: Trees },
  gyms: { label: 'Gyms & Fitness', icon: Dumbbell },
  petrol_stations: { label: 'Petrol Stations', icon: Fuel },
  cafes: { label: 'Cafes', icon: Coffee },
  transit: { label: 'Transit & Bus Stops', icon: Bus },
};

export const NearbyAmenities: React.FC<NearbyAmenitiesProps> = ({
  propertyIdOrSlug,
  latitude,
  longitude,
}) => {
  const [data, setData] = useState<NearbyAmenitiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!propertyIdOrSlug) return;
    setLoading(true);
    setError(null);

    api.get<NearbyAmenitiesResponse>(`/properties/${propertyIdOrSlug}/nearby-amenities`)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        console.warn('Failed to load nearby amenities:', err);
        setError(err.message || 'Failed to load amenities');
      })
      .finally(() => setLoading(false));
  }, [propertyIdOrSlug, latitude, longitude]);

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="h-6 w-48 bg-slate-100 rounded-lg animate-pulse" />
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 w-24 bg-slate-100 rounded-xl shrink-0 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-slate-50 rounded-2xl border border-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // If disabled by administrator feature flag or no data
  if (!data || data.enabled === false) {
    return null;
  }

  const allAmenities = data.amenities || [];
  const filteredAmenities =
    selectedCategory === 'all'
      ? allAmenities
      : allAmenities.filter((a) => a.category === selectedCategory);

  const availableCategories = ['all', ...(data.categoriesAvailable || [])];

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>Nearby Amenities</span>
            {data.cached && (
              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                Verified Local Data
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Key services, transport, and daily essentials within walking & driving distance
          </p>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          {allAmenities.length} places identified
        </div>
      </div>

      {/* Category Chips / Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {availableCategories.map((catKey) => {
          const meta = CATEGORY_META[catKey] || { label: catKey, icon: Layers };
          const Icon = meta.icon;
          const isActive = selectedCategory === catKey;
          const count = catKey === 'all' ? allAmenities.length : (data.byCategory?.[catKey]?.length || 0);

          return (
            <button
              key={catKey}
              onClick={() => setSelectedCategory(catKey)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
              <span>{meta.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  isActive ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Amenity Cards Grid */}
      {filteredAmenities.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100">
          <p className="text-xs text-slate-500">No amenities found in this category nearby.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredAmenities.map((item) => {
            const meta = CATEGORY_META[item.category] || { label: item.category, icon: MapPin };
            const Icon = meta.icon;

            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              item.name + ' ' + (item.formattedAddress || '')
            )}`;

            return (
              <div
                key={item.id}
                className="p-3.5 bg-slate-50/80 hover:bg-slate-50 rounded-2xl border border-slate-100 hover:border-slate-200 transition flex items-start justify-between gap-3 group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 text-emerald-600 shadow-2xs">
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-emerald-700 transition">
                        {item.name}
                      </h3>
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-1">
                      {item.formattedAddress}
                    </p>

                    <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-0.5">
                      {item.rating !== null && (
                        <div className="flex items-center gap-0.5 font-bold text-amber-600">
                          <Star className="w-3 h-3 fill-current text-amber-500" />
                          <span>{item.rating.toFixed(1)}</span>
                          {item.userRatingCount && (
                            <span className="text-slate-400 font-normal">({item.userRatingCount})</span>
                          )}
                        </div>
                      )}

                      {item.openNow !== null && (
                        <span
                          className={`font-semibold ${
                            item.openNow ? 'text-emerald-600' : 'text-slate-400'
                          }`}
                        >
                          {item.openNow ? 'Open Now' : 'Closed'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Distance Badge & External Link */}
                <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                  <span className="text-xs font-black text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs">
                    {item.distanceText}
                  </span>

                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-emerald-600 transition"
                    title="View place on Google Maps"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
