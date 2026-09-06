import React, { useState, useEffect } from 'react';
import { adminApi } from '../AdminAuthContext';
import {
  Layers,
  Plus,
  Edit2,
  Check,
  X,
  Award,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
} from 'lucide-react';

export const CategoriesView: React.FC = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal / Form state for Add/Edit
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formIcon, setFormIcon] = useState('Briefcase');
  const [formDescription, setFormDescription] = useState('');
  const [formDisplayOrder, setFormDisplayOrder] = useState(0);
  const [formIsActive, setFormIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<any[]>('/admin/categories');
      setCategories(res);
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const openNewModal = () => {
    setIsNew(true);
    setEditingCategory({});
    setFormName('');
    setFormSlug('');
    setFormIcon('Briefcase');
    setFormDescription('');
    setFormDisplayOrder(categories.length + 1);
    setFormIsActive(true);
  };

  const openEditModal = (cat: any) => {
    setIsNew(false);
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormSlug(cat.slug);
    setFormIcon(cat.icon || 'Briefcase');
    setFormDescription(cat.description || '');
    setFormDisplayOrder(cat.displayOrder || 0);
    setFormIsActive(cat.isActive ?? true);
  };

  const handleToggleActive = async (cat: any) => {
    try {
      await adminApi.patch(`/admin/categories/${cat.id}`, {
        isActive: !cat.isActive,
      });
      loadCategories();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle category state');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isNew) {
        await adminApi.post('/admin/categories', {
          name: formName,
          slug: formSlug || formName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          icon: formIcon,
          description: formDescription,
          displayOrder: Number(formDisplayOrder),
        });
      } else {
        await adminApi.patch(`/admin/categories/${editingCategory.id}`, {
          name: formName,
          icon: formIcon,
          description: formDescription,
          displayOrder: Number(formDisplayOrder),
          isActive: formIsActive,
        });
      }
      setEditingCategory(null);
      loadCategories();
    } catch (err: any) {
      alert(err.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-400" />
            <span>Advisory Category Architecture</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            10 professional property advisory categories across New Zealand & Australia
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openNewModal}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-md shadow-purple-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
          <button
            onClick={loadCategories}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Category Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 py-12 text-center text-slate-500 text-xs">
            Loading advisory categories...
          </div>
        ) : (
          categories.map((cat) => (
            <div
              key={cat.id}
              className={`p-5 rounded-2xl border transition ${
                cat.isActive
                  ? 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  : 'bg-slate-950/60 border-slate-800/40 opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-800/60 text-purple-300 flex items-center justify-center font-bold text-sm">
                    {cat.displayOrder ?? 0}
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <span>{cat.name}</span>
                      {!cat.isActive && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                          Inactive
                        </span>
                      )}
                    </h3>
                    <span className="text-[11px] font-mono text-purple-400">/{cat.slug}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleToggleActive(cat)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white transition"
                    title={cat.isActive ? 'Deactivate Category' : 'Activate Category'}
                  >
                    {cat.isActive ? (
                      <ToggleRight className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-slate-500" />
                    )}
                  </button>
                  <button
                    onClick={() => openEditModal(cat)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition"
                    title="Edit Details"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {cat.description && (
                <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                  {cat.description}
                </p>
              )}

              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-purple-400" />
                  <span>
                    <strong className="text-white font-bold">{cat._count?.expertProfiles || 0}</strong> registered professionals
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">Icon: {cat.icon || 'Briefcase'}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 3. Add/Edit Category Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-white">
                {isNew ? 'Create New Advisory Category' : `Edit Category: ${formName}`}
              </h3>
              <button
                onClick={() => setEditingCategory(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Quantity Surveyor"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              </div>

              {isNew && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Slug (URL Key)</label>
                  <input
                    type="text"
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    placeholder="quantity-surveyor"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Lucide Icon Identifier</label>
                <input
                  type="text"
                  value={formIcon}
                  onChange={(e) => setFormIcon(e.target.value)}
                  placeholder="Briefcase, Scale, Calculator..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Display Order Priority</label>
                <input
                  type="number"
                  value={formDisplayOrder}
                  onChange={(e) => setFormDisplayOrder(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description</label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Official advisory scope description..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
