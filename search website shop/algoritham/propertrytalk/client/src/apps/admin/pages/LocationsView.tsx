import React, { useState, useEffect } from 'react';
import { adminApi } from '../AdminAuthContext';
import {
  MapPin,
  Globe2,
  Building,
  ToggleLeft,
  ToggleRight,
  Award,
  RefreshCw,
} from 'lucide-react';

export const LocationsView: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadLocations = async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<any>('/admin/locations');
      setData(res);
    } catch (err) {
      console.error('Failed to load locations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  const handleToggleCountry = async (country: any) => {
    try {
      await adminApi.patch(`/admin/locations/country/${country.code}`, {
        isActive: !country.isActive,
      });
      loadLocations();
    } catch (err: any) {
      alert(err.message || 'Failed to update country status');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <MapPin className="w-5 h-5 text-purple-400" />
            <span>Jurisdiction & Regional Markets</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Geographic governance across New Zealand (NZ) and Australia (AU)
          </p>
        </div>
        <button
          onClick={loadLocations}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Locations</span>
        </button>
      </div>

      {/* 2. Countries Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-2 py-12 text-center text-slate-500 text-xs">
            Loading geographical configurations...
          </div>
        ) : (
          data?.countries?.map((country: any) => {
            const cities = data?.cities?.[country.code] || [];

            return (
              <div
                key={country.code}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-5"
              >
                {/* Top Row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-2xl font-black text-purple-300">
                      {country.code === 'NZ' ? '🇳🇿' : '🇦🇺'}
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                        <span>{country.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-purple-300 border border-slate-700 font-mono">
                          {country.code}
                        </span>
                      </h3>
                      <span className="text-xs text-slate-400">
                        Primary Currency: <strong className="text-white">{country.currency}</strong> ({country.currencySymbol})
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleCountry(country)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs transition"
                    title={country.isActive ? 'Deactivate Region' : 'Activate Region'}
                  >
                    {country.isActive ? (
                      <>
                        <span className="text-emerald-400 font-bold">Active</span>
                        <ToggleRight className="w-5 h-5 text-emerald-400" />
                      </>
                    ) : (
                      <>
                        <span className="text-slate-500 font-bold">Disabled</span>
                        <ToggleLeft className="w-5 h-5 text-slate-500" />
                      </>
                    )}
                  </button>
                </div>

                {/* Regional Details Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Timezone</span>
                    <span className="font-semibold text-slate-200 mt-0.5 block">{country.timezone || 'Pacific/Auckland'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Phone Dial Code</span>
                    <span className="font-mono font-semibold text-slate-200 mt-0.5 block">{country.phonePrefix || '+64'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Licensed Experts</span>
                    <span className="font-semibold text-purple-400 mt-0.5 block">
                      {country._count?.expertProfiles ?? 0} registered
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Platform Status</span>
                    <span className="font-semibold text-emerald-400 mt-0.5 block">Live & Accepting Bookings</span>
                  </div>
                </div>

                {/* Cities Coverage */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-purple-400" />
                    <span>Primary Metropolitan Hubs ({cities.length})</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {cities.map((city: string) => (
                      <span
                        key={city}
                        className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-medium"
                      >
                        {city}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
