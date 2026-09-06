import React, { useState, useEffect } from 'react';
import { adminApi } from '../AdminAuthContext';
import {
  ExternalLink,
  Plus,
  ShieldCheck,
  Building,
  RefreshCw,
  Search,
  Globe2,
} from 'lucide-react';

export const RegistersView: React.FC = () => {
  const [registers, setRegisters] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [countryFilter, setCountryFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Add Register modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formCountry, setFormCountry] = useState('NZ');
  const [formCategory, setFormCategory] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formUrlPattern, setFormUrlPattern] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [regsRes, catsRes] = await Promise.all([
        adminApi.get<any[]>('/admin/registers'),
        adminApi.get<any[]>('/admin/categories'),
      ]);
      setRegisters(regsRes);
      setCategories(catsRes);
      if (catsRes.length > 0 && !formCategory) {
        setFormCategory(catsRes[0].id);
      }
    } catch (err) {
      console.error('Failed to load official registers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.post('/admin/official-registers', {
        countryCode: formCountry,
        categoryId: formCategory,
        title: formTitle,
        urlPattern: formUrlPattern,
        notes: formNotes,
      });
      setShowAddModal(false);
      setFormTitle('');
      setFormUrlPattern('');
      setFormNotes('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create official register entry');
    } finally {
      setSaving(false);
    }
  };

  const filtered = registers.filter((r) => {
    if (countryFilter !== 'ALL' && r.countryCode !== countryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.title?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q) ||
        r.category?.name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-purple-400" />
            <span>Official Government Licensing Registers</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Direct public verification links for NZ and AU regulatory authorities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-md shadow-purple-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Register Entry</span>
          </button>
          <button
            onClick={loadData}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Jurisdiction:</span>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none"
            >
              <option value="ALL">All Jurisdictions (NZ & AU)</option>
              <option value="NZ">New Zealand Only (NZ)</option>
              <option value="AU">Australia Only (AU)</option>
            </select>
          </div>

          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by authority or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            />
          </div>
        </div>

        <span className="text-slate-500 font-medium">
          {filtered.length} official public registers configured
        </span>
      </div>

      {/* 3. Register Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-500 text-xs">
            Loading government registers...
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 text-xs">
            No official registers match your criteria.
          </div>
        ) : (
          filtered.map((reg) => (
            <div
              key={reg.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 font-mono font-bold text-[10px] border border-purple-800">
                    {reg.countryCode}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {reg.category?.name || 'General Licensing'}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white leading-tight">
                  {reg.title}
                </h3>

                {reg.notes && (
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {reg.notes}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <a
                  href={reg.urlPattern}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition"
                >
                  <span>Open Registry</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <span className="text-[10px] text-slate-500 truncate max-w-[120px]">
                  {reg.urlPattern.replace(/^https?:\/\//, '')}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 4. Add Register Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-white">Add Government Register</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                &times;
              </button>
            </div>

            <form onSubmit={handleAddRegister} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Country</label>
                  <select
                    value={formCountry}
                    onChange={(e) => setFormCountry(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="NZ">New Zealand (NZ)</option>
                    <option value="AU">Australia (AU)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Register Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. REA Public Licensing Register"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Official Verification URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://rea.govt.nz/public-register"
                  value={formUrlPattern}
                  onChange={(e) => setFormUrlPattern(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Guidance Notes</label>
                <textarea
                  rows={2}
                  placeholder="What auditors should check (e.g. active license status, complaints history)..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition disabled:opacity-50"
                >
                  {saving ? 'Adding...' : 'Save Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
