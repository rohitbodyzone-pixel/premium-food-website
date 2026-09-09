import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Property } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Bed,
  Bath,
  Car,
  Maximize2,
  Video,
  Heart,
  ShieldCheck,
  Building,
  MapPin,
} from 'lucide-react';

interface PropertyCardProps {
  property: Property;
  onSaveToggle?: (saved: boolean) => void;
}

export const PropertyCard: React.FC<PropertyCardProps> = ({ property, onSaveToggle }) => {
  const { user } = useAuth();
  const [isSaved, setIsSaved] = useState(property.isSaved || false);
  const [saving, setSaving] = useState(false);

  const formatPrice = (prop: Property) => {
    if (prop.priceDisplay) return prop.priceDisplay;
    if (!prop.priceMinorUnits) return 'Price by Negotiation';
    const amount = (prop.priceMinorUnits / 100).toLocaleString('en-NZ', {
      style: 'currency',
      currency: prop.currency || 'NZD',
      maximumFractionDigits: 0,
    });
    return prop.listingType === 'FOR_RENT' ? `${amount}/wk` : amount;
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      window.location.href = '/auth?mode=login';
      return;
    }
    try {
      setSaving(true);
      const res = await api.post<{ saved: boolean }>(`/properties/${property.id}/save`, {});
      setIsSaved(res.saved);
      if (onSaveToggle) onSaveToggle(res.saved);
    } catch (err) {
      console.error('Failed to toggle save property:', err);
    } finally {
      setSaving(false);
    }
  };

  const coverImage = property.images && property.images.length > 0
    ? property.images[0]
    : 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80';

  return (
    <div className="group bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col">
      {/* Image & Badges */}
      <div className="relative aspect-16/10 w-full overflow-hidden bg-slate-100">
        <img
          src={coverImage}
          alt={property.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-black/20" />

        {/* Top badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-xs ${
                property.listingType === 'FOR_SALE'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 text-white'
              }`}
            >
              {property.listingType === 'FOR_SALE' ? 'For Sale' : 'For Rent'}
            </span>

            {property.remoteViewingAvailable && (
              <span className="text-[10px] font-bold bg-amber-500 text-slate-950 px-2 py-1 rounded-full flex items-center gap-1 shadow-xs">
                <Video className="w-3 h-3 fill-current" />
                <span>Remote Live Viewing</span>
              </span>
            )}
          </div>

          {/* Bookmark Button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="pointer-events-auto w-8 h-8 rounded-full bg-white/90 backdrop-blur-xs text-slate-700 hover:text-red-500 flex items-center justify-center shadow-xs transition hover:scale-110 active:scale-95"
            title={isSaved ? 'Saved to Bookmarks' : 'Save Property'}
          >
            <Heart
              className={`w-4 h-4 transition ${
                isSaved ? 'fill-red-500 text-red-500' : 'text-slate-700'
              }`}
            />
          </button>
        </div>

        {/* Bottom price overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-white">
          <div>
            <div className="text-xl font-black tracking-tight drop-shadow-sm">
              {formatPrice(property)}
            </div>
            <div className="text-xs text-slate-200 flex items-center gap-1 mt-0.5 drop-shadow-sm">
              <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="truncate">{property.suburb}, {property.city}</span>
            </div>
          </div>

          {property.isPrivateListing ? (
            <span className="text-[10px] font-semibold bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-md text-white border border-white/20">
              Private Seller
            </span>
          ) : property.agentProfile ? (
            <span className="text-[10px] font-semibold bg-emerald-950/70 backdrop-blur-md px-2 py-0.5 rounded-md text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              REA Agent
            </span>
          ) : null}
        </div>
      </div>

      {/* Details Body */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <Link to={`/properties/${property.id}`} className="block group-hover:text-emerald-600 transition">
            <h3 className="font-bold text-slate-900 text-sm line-clamp-1">
              {property.title}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
              {property.streetAddress}
            </p>
          </Link>

          {/* Specs */}
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
            {property.bedrooms > 0 && (
              <div className="flex items-center gap-1" title={`${property.bedrooms} Bedrooms`}>
                <Bed className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold">{property.bedrooms}</span>
              </div>
            )}
            {property.bathrooms > 0 && (
              <div className="flex items-center gap-1" title={`${property.bathrooms} Bathrooms`}>
                <Bath className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold">{property.bathrooms}</span>
              </div>
            )}
            {property.parkingSpaces > 0 && (
              <div className="flex items-center gap-1" title={`${property.parkingSpaces} Parking Spaces`}>
                <Car className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold">{property.parkingSpaces}</span>
              </div>
            )}
            {property.floorAreaM2 && (
              <div className="flex items-center gap-1 ml-auto text-[11px] text-slate-400" title="Floor Area">
                <Maximize2 className="w-3 h-3" />
                <span>{property.floorAreaM2} m²</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Link / Footer */}
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between">
          {property.agentProfile ? (
            <Link
              to={property.agentProfile.user?.name ? `/agent/${property.agentProfile.user.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : `/experts/${property.agentProfile.id}`}
              className="flex items-center gap-2 text-xs text-slate-600 hover:text-emerald-700 transition"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={property.agentProfile.photoUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&q=80'}
                alt={property.agentProfile.name}
                className="w-5 h-5 rounded-full object-cover border border-slate-200"
              />
              <span className="font-medium truncate max-w-[110px]">{property.agentProfile.name}</span>
            </Link>
          ) : (
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Building className="w-3 h-3" /> Private Listing
            </span>
          )}

          <Link
            to={`/properties/${property.id}`}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-0.5"
          >
            <span>View details</span>
            <span>&rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
