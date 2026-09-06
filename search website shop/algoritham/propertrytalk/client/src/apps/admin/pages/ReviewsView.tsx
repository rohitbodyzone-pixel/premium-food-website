import React, { useState, useEffect } from 'react';
import { adminApi } from '../AdminAuthContext';
import {
  Star,
  Trash2,
  AlertTriangle,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

export const ReviewsView: React.FC = () => {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<any[]>('/admin/reviews');
      setReviews(res);
    } catch (err) {
      console.error('Failed to load reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const handleDeleteReview = async (review: any) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete this review by ${review.consumer?.name || 'Client'}? This will adjust the expert's aggregate rating.`
    );
    if (!confirmDelete) return;

    try {
      await adminApi.delete(`/admin/reviews/${review.id}`);
      loadReviews();
    } catch (err: any) {
      alert(err.message || 'Failed to remove review');
    }
  };

  const avgScore = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : '5.0';

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            <span>Platform Reviews & Moderation Controls</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit customer feedback, ratings, and moderate defamatory or inappropriate comments
          </p>
        </div>
        <button
          onClick={loadReviews}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Reviews</span>
        </button>
      </div>

      {/* 2. Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block font-medium">Total Reviews Submitted</span>
            <div className="text-2xl font-black text-white mt-1">{reviews.length}</div>
          </div>
          <div className="p-3 bg-slate-800 rounded-xl text-purple-400">
            <MessageSquare className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block font-medium">Platform Average Score</span>
            <div className="text-2xl font-black text-white mt-1 flex items-center gap-1.5">
              <span>{avgScore}</span>
              <span className="text-xs text-slate-500 font-normal">/ 5.0</span>
            </div>
          </div>
          <div className="p-3 bg-slate-800 rounded-xl text-amber-400">
            <Star className="w-5 h-5 fill-amber-400" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block font-medium">Moderation Policy</span>
            <div className="text-sm font-bold text-emerald-400 mt-1">NZ / AU Defamation Compliant</div>
          </div>
          <div className="p-3 bg-slate-800 rounded-xl text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Reviews List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 font-bold border-b border-slate-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Client</th>
                <th className="py-3 px-4">Professional</th>
                <th className="py-3 px-4">Rating</th>
                <th className="py-3 px-4">Review Text</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Moderation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Loading customer reviews...
                  </td>
                </tr>
              ) : reviews.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No customer reviews recorded yet.
                  </td>
                </tr>
              ) : (
                reviews.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/30 transition">
                    {/* Customer */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white text-xs">{r.consumer?.name || 'Customer'}</div>
                      <div className="text-[11px] text-slate-400">{r.consumer?.email}</div>
                    </td>

                    {/* Expert */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white text-xs">{r.expert?.user?.name || 'Expert'}</div>
                      <div className="text-[11px] text-purple-400">{r.expert?.category?.name}</div>
                    </td>

                    {/* Rating */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${
                              i < (r.rating || 0)
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-700'
                            }`}
                          />
                        ))}
                        <span className="ml-1 font-bold text-slate-200 text-xs">{r.rating}.0</span>
                      </div>
                    </td>

                    {/* Review text */}
                    <td className="py-3.5 px-4 max-w-sm">
                      <p className="text-slate-300 text-xs italic leading-relaxed">
                        "{r.comment || 'No written feedback provided.'}"
                      </p>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {new Date(r.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>

                    {/* Moderation */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDeleteReview(r)}
                        className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/70 text-rose-300 border border-rose-800/60 transition"
                        title="Delete Review (Violates Terms)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
