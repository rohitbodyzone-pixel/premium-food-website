import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  Star,
  Trash2,
  Eye,
  Video,
  ExternalLink,
  Search,
} from 'lucide-react';

interface PropertyItem {
  id: string;
  title: string;
  suburb: string;
  city: string;
  priceDisplay: string;
  listingType: string;
  status: string;
  isFeatured: boolean;
  isModerated: boolean;
  remoteViewingAvailable: boolean;
  agentProfile?: { name: string };
  createdAt: string;
}

export const ListingsModerationView: React.FC = () => {
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadProperties = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ properties: PropertyItem[] }>('/admin/properties');
      setProperties(res.properties || []);
    } catch {
      // Fallback endpoint if needed
      try {
        const fallback = await api.get<{ properties: PropertyItem[] }>('/properties?limit=50');
        setProperties(fallback.properties || []);
      } catch (e) {
        console.error('Failed to load listings:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProperties();
  }, []);

  const handleToggleModeration = async (propertyId: string, current: boolean) => {
    try {
      await api.put(`/admin/properties/${propertyId}`, { isModerated: !current });
      setProperties((prev) =>
        prev.map((p) => (p.id === propertyId ? { ...p, isModerated: !current } : p))
      );
    } catch (err) {
      console.error('Failed to toggle moderation:', err);
    }
  };

  const handleToggleFeatured = async (propertyId: string, current: boolean) => {
    try {
      await api.put(`/admin/properties/${propertyId}`, { isFeatured: !current });
      setProperties((prev) =>
        prev.map((p) => (p.id === propertyId ? { ...p, isFeatured: !current } : p))
      );
    } catch (err) {
      console.error('Failed to toggle featured:', err);
    }
  };

  const filtered = properties.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.suburb.toLowerCase().includes(search.toLowerCase()) ||
      p.city.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-purple-400" />
            <span>Property Listings Moderation</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit public listings, verify compliance with REA guidelines, toggle featured badges.
          </p>
        </div>

        <div className="relative w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or suburb..."
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500">Loading listings...</div>
      ) : filtered.length > 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Property</th>
                <th className="px-4 py-3.5">Price & Type</th>
                <th className="px-4 py-3.5">Seller / Agent</th>
                <th className="px-4 py-3.5">Remote Live</th>
                <th className="px-4 py-3.5">Featured</th>
                <th className="px-4 py-3.5">Moderation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/30 transition">
                  <td className="px-5 py-3.5">
                    <span className="font-bold text-white block">{item.title}</span>
                    <span className="text-[11px] text-slate-400">
                      {item.suburb}, {item.city}
                    </span>
                  </td>

                  <td className="px-4 py-3.5">
                    <span className="font-bold text-white block">{item.priceDisplay}</span>
                    <span className="text-[10px] text-slate-400 uppercase">{item.listingType}</span>
                  </td>

                  <td className="px-4 py-3.5">
                    <span className="text-xs text-slate-300">
                      {item.agentProfile?.name || 'Private Seller'}
                    </span>
                  </td>

                  <td className="px-4 py-3.5">
                    {item.remoteViewingAvailable ? (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                        <Video className="w-3 h-3" /> Enabled
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">None</span>
                    )}
                  </td>

                  <td className="px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => handleToggleFeatured(item.id, item.isFeatured)}
                      className={`p-1.5 rounded-lg transition ${
                        item.isFeatured
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'text-slate-600 hover:text-slate-400'
                      }`}
                      title={item.isFeatured ? 'Unfeature' : 'Feature on Homepage'}
                    >
                      <Star className="w-4 h-4 fill-current" />
                    </button>
                  </td>

                  <td className="px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => handleToggleModeration(item.id, item.isModerated)}
                      className={`px-3 py-1 rounded-xl text-[11px] font-bold border transition ${
                        item.isModerated
                          ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80'
                          : 'bg-rose-950/60 text-rose-400 border-rose-800/80'
                      }`}
                    >
                      {item.isModerated ? 'Approved' : 'Suspended'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-xs text-slate-400">
          No property listings found.
        </div>
      )}
    </div>
  );
};
