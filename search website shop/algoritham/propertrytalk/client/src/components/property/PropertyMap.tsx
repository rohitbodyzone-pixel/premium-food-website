import React, { useState } from 'react';
import { MapPin, Navigation, ExternalLink, Compass, Layers } from 'lucide-react';

interface PropertyMapProps {
  latitude?: number | null;
  longitude?: number | null;
  address: string;
  title?: string;
  heightClass?: string;
  showDirections?: boolean;
}

export const PropertyMap: React.FC<PropertyMapProps> = ({
  latitude,
  longitude,
  address,
  title,
  heightClass = 'h-72 sm:h-80',
  showDirections = true,
}) => {
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [zoomLevel, setZoomLevel] = useState(15);

  const hasCoords = typeof latitude === 'number' && typeof longitude === 'number';
  const googleMapsKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_API_KEY;

  if (!hasCoords) {
    return (
      <div className={`w-full ${heightClass} rounded-2xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center p-6 text-center`}>
        <div className="w-12 h-12 rounded-full bg-slate-200/80 flex items-center justify-center mb-2 text-slate-500">
          <MapPin className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-slate-700">Property Location Preview</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          {address || 'Coordinates will be updated once the address is validated.'}
        </p>
      </div>
    );
  }

  const lat = latitude as number;
  const lng = longitude as number;

  const googleDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const googleSearchUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  // If client API key is provided, use Google Maps embed
  const embedUrl = googleMapsKey
    ? `https://www.google.com/maps/embed/v1/place?key=${googleMapsKey}&q=${lat},${lng}&zoom=${zoomLevel}`
    : `https://maps.google.com/maps?q=${lat},${lng}&z=${zoomLevel}&output=embed`;

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-slate-900 group">
      {/* Map Embed Frame */}
      <iframe
        title={title || `Map location for ${address}`}
        src={embedUrl}
        className={`w-full ${heightClass} border-0 transition-opacity duration-300`}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
      />

      {/* Top Floating Badge: Address & Coordinates */}
      <div className="absolute top-3 left-3 right-3 sm:right-auto flex items-center justify-between sm:justify-start gap-2 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-md border border-slate-200/80 pointer-events-auto">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600" />
          </span>
          <div>
            <p className="text-xs font-bold text-slate-900 truncate max-w-[200px] sm:max-w-xs">{address}</p>
            <p className="text-[10px] text-slate-500 font-mono">
              {lat.toFixed(4)}, {lng.toFixed(4)}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Floating Controls: Open in Google Maps & Get Directions */}
      {showDirections && (
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <a
            href={googleDirectionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition transform active:scale-95"
            title="Get Directions in Google Maps"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Directions</span>
          </a>

          <a
            href={googleSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl shadow-md transition"
            title="Open in Google Maps"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}
    </div>
  );
};
