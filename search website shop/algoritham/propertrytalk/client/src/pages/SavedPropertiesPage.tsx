import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Property } from '../types';
import { api } from '../services/api';
import { PropertyCard } from '../components/cards/PropertyCard';
import { Heart, Building, ArrowLeft } from 'lucide-react';

export const SavedPropertiesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [savedProperties, setSavedProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSaved = () => {
    if (!user) {
      navigate('/auth?mode=login');
      return;
    }

    api.get<Property[]>('/properties/saved')
      .then((data) => setSavedProperties(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSaved();
  }, [user]);

  const handleSaveToggle = (propertyId: string, saved: boolean) => {
    if (!saved) {
      setSavedProperties((prev) => prev.filter((p) => p.id !== propertyId));
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-5 pb-28 space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500 fill-current" />
            <span>Saved Properties</span>
          </h1>
          <p className="text-xs text-slate-500">
            Properties you've bookmarked for sale and rent
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
          <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
        </div>
      ) : savedProperties.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {savedProperties.map((property) => (
            <PropertyCard
              key={property.id}
              property={{ ...property, isSaved: true }}
              onSaveToggle={(saved) => handleSaveToggle(property.id, saved)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
          <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-sm">No saved properties yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Browse through New Zealand properties and click the heart icon to save listings you love.
          </p>
          <Link
            to="/explore"
            className="mt-4 inline-block px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl"
          >
            Explore Properties
          </Link>
        </div>
      )}
    </div>
  );
};
