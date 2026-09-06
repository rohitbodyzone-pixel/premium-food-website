import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Expert } from '../types';
import { api } from '../services/api';
import { ExpertCard } from '../components/cards/ExpertCard';
import { Bookmark, User } from 'lucide-react';
import { ExpertCardSkeleton } from '../components/common/SkeletonLoader';

export const SavedExpertsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [savedExperts, setSavedExperts] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSaved = () => {
    if (!user) {
      navigate('/auth?mode=login');
      return;
    }

    // Filter experts where isSaved is true
    api.get<Expert[]>('/experts')
      .then((all) => {
        setSavedExperts(all.filter((e) => e.isSaved));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSaved();
  }, [user]);

  const handleSaveToggle = (expertId: string, saved: boolean) => {
    if (!saved) {
      setSavedExperts((prev) => prev.filter((e) => e.id !== expertId));
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28 space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          Saved Professionals
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Quickly re-connect with your favorited property experts.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <ExpertCardSkeleton />
          <ExpertCardSkeleton />
        </div>
      ) : savedExperts.length > 0 ? (
        <div className="space-y-3">
          {savedExperts.map((expert) => (
            <ExpertCard
              key={expert.id}
              expert={expert}
              onSaveToggle={handleSaveToggle}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-10 text-center">
          <Bookmark className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">No saved experts yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Tap the bookmark icon on any professional's card to keep them saved here for future reference.
          </p>
          <Link
            to="/experts"
            className="mt-4 inline-block px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs"
          >
            Browse Verified Experts
          </Link>
        </div>
      )}
    </div>
  );
};
