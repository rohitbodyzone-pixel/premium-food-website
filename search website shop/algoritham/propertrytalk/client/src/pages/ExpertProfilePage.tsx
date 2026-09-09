import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Expert } from '../types';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  ShieldCheck,
  Star,
  Clock,
  MessageSquare,
  Calendar,
  Bookmark,
  MapPin,
  Globe2,
  Briefcase,
  Building,
  Award,
  Radio,
  CheckCircle2,
  ChevronLeft,
} from 'lucide-react';
import { VerifiedBadge } from '../components/common/VerifiedBadge';

export const ExpertProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [expert, setExpert] = useState<Expert | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get<Expert>(`/experts/${id}`)
      .then((data) => {
        setExpert(data);
        setIsSaved(data.isSaved || false);
      })
      .catch((err) => console.error('Failed to load expert:', err))
      .finally(() => setLoading(false));
  }, [id]);

  const handleTalkNow = async () => {
    if (!expert) return;
    if (!user) {
      navigate('/auth?mode=register&redirect=' + encodeURIComponent(`/experts/${expert.id}`));
      return;
    }

    setStartingChat(true);
    try {
      const chat = await api.post<any>('/chats/talk-now', { expertId: expert.id });
      navigate(`/chat/${chat.id}`);
    } catch (err: any) {
      alert(err.message || 'Failed to start Talk Now');
    } finally {
      setStartingChat(false);
    }
  };

  const handleToggleSave = async () => {
    if (!expert) return;
    if (!user) {
      navigate('/auth?mode=login');
      return;
    }

    try {
      const res = await api.post<{ saved: boolean }>(`/experts/${expert.id}/save`);
      setIsSaved(res.saved);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 animate-pulse h-96" />
      </div>
    );
  }

  if (!expert) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-slate-800">Expert not found</h2>
        <button
          onClick={() => navigate('/experts')}
          className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs"
        >
          Return to Directory
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-4 transition"
      >
        <ChevronLeft className="w-4 h-4" />
        <span>Back to Experts</span>
      </button>

      {/* Main Profile Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        {/* Banner Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-slate-900 p-6 sm:p-8 text-white relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="relative shrink-0">
                <img
                  src={expert.photoUrl}
                  alt={expert.name}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-3 border-white/20 shadow-md"
                />
                <span
                  className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-2 border-slate-900 flex items-center justify-center ${
                    expert.isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                  title={expert.isOnline ? 'Online Now' : 'Offline'}
                >
                  {expert.isOnline && (
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  )}
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {expert.name}
                  </h1>
                  <VerifiedBadge
                    categorySlug={expert.category?.slug}
                    categoryName={expert.category?.name}
                    licenseNumber={expert.licenseNumber}
                    size="md"
                    showFullLabel
                  />
                </div>

                <p className="text-xs sm:text-sm text-emerald-300 font-semibold mt-1">
                  {expert.category?.name} • {expert.businessName}
                </p>

                <div className="flex items-center gap-3 text-xs text-slate-300 mt-2 flex-wrap">
                  <span className="flex items-center gap-1">
                    <span className="text-base leading-none">{expert.country?.flag}</span>
                    <span>{expert.city}, {expert.country?.name}</span>
                  </span>
                  <span>•</span>
                  <span>{expert.yearsOfExperience} Years Experience</span>
                  {expert.isOnline && (
                    <>
                      <span>•</span>
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                        Online Now
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleToggleSave}
              className={`p-2.5 rounded-xl border transition flex items-center gap-1.5 text-xs font-semibold ${
                isSaved
                  ? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                  : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-amber-400' : ''}`} />
              <span className="hidden sm:inline">{isSaved ? 'Saved' : 'Save Expert'}</span>
            </button>
          </div>
        </div>

        {/* Free Consultation & Transparent Rates Highlight Banner */}
        <div className="bg-emerald-50/90 border-b border-emerald-100 p-4 sm:px-8 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                  <span>First 1 Minute Always 100% FREE</span>
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-200 text-emerald-900 font-bold">
                    No Auto-Charge
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Talk Now opens a private chat. If you choose to continue after 1 minute, you explicitly confirm paid continuation.
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <span className="text-[11px] text-slate-500 block">Currency & Country:</span>
              <span className="text-xs font-bold text-slate-800">
                {expert.countryCode === 'AU' ? 'AUD (A$)' : 'NZD (NZ$)'} • {expert.country?.name}
              </span>
            </div>
          </div>

          {/* Rates breakdown grid */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-200/60 text-center">
            <div className="bg-white/80 rounded-xl p-2 border border-emerald-200/50">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Text Chat</span>
              <span className="text-xs font-extrabold text-slate-900">
                {expert.countryCode === 'AU' ? 'A$' : 'NZ$'}{expert.chatRateMinorUnits ? (expert.chatRateMinorUnits / 100).toFixed(2) : ((expert.callPerMinuteRate || 2.5) * 0.8).toFixed(2)}/min
              </span>
            </div>
            <div className="bg-white/80 rounded-xl p-2 border border-emerald-200/50">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Audio Call</span>
              <span className="text-xs font-extrabold text-slate-900">
                {expert.countryCode === 'AU' ? 'A$' : 'NZ$'}{expert.audioRateMinorUnits ? (expert.audioRateMinorUnits / 100).toFixed(2) : ((expert.callPerMinuteRate || 2.5) * 0.85).toFixed(2)}/min
              </span>
            </div>
            <div className="bg-white/80 rounded-xl p-2 border border-emerald-200/50">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Video Call</span>
              <span className="text-xs font-extrabold text-slate-900">
                {expert.countryCode === 'AU' ? 'A$' : 'NZ$'}{expert.videoRateMinorUnits ? (expert.videoRateMinorUnits / 100).toFixed(2) : (expert.callPerMinuteRate || 3.0).toFixed(2)}/min
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons Bar */}
        <div className="p-4 sm:p-6 bg-white border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Primary: Talk Now */}
          <button
            onClick={handleTalkNow}
            disabled={startingChat}
            className="py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/25 transition active:scale-95 flex items-center justify-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{startingChat ? 'Opening Consultation...' : 'Talk Now (Private Chat First)'}</span>
          </button>

          {/* Book Appointment */}
          <button
            onClick={() => navigate(`/appointments?expertId=${expert.id}`)}
            className="py-3.5 px-5 rounded-2xl border-2 border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-sm transition flex items-center justify-center gap-2"
          >
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>Book Appointment</span>
          </button>
        </div>

        {/* Content Details */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Bio */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-2">
              About Professional

            </h3>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {expert.bio || 'Verified professional registered on PropertyTalk.'}
            </p>
          </div>

          {/* Specialities */}
          {expert.specialities && expert.specialities.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-2">
                Specialities & Expertise
              </h3>
              <div className="flex flex-wrap gap-2">
                {expert.specialities.map((spec, i) => (
                  <span
                    key={i}
                    className="bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{spec}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Verified Credentials */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Verified Official Credentials</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block">Licence / Registration Number:</span>
                <span className="font-semibold text-slate-800 font-mono">
                  {expert.licenseNumber || 'Verified Registration'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block">Business / Company:</span>
                <span className="font-semibold text-slate-800">
                  {expert.businessName} {expert.businessRegNumber ? `(${expert.businessRegNumber})` : ''}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block">Languages Spoken:</span>
                <span className="font-semibold text-slate-800">
                  {expert.languages?.join(', ') || 'English'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block">Jurisdiction:</span>
                <span className="font-semibold text-slate-800">
                  {expert.country?.name} Property Framework
                </span>
              </div>
            </div>
          </div>

          {/* Customer Reviews */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                Verified Reviews ({expert.reviewCount || 0})
              </h3>
              <div className="flex items-center gap-1 text-sm font-bold text-slate-900">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span>{expert.ratingAvg?.toFixed(1) || '5.0'}</span>
              </div>
            </div>

            {expert.reviews && expert.reviews.length > 0 ? (
              <div className="space-y-3">
                {expert.reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">
                          {rev.consumer?.name || 'Verified Customer'}
                        </span>
                        <div className="flex items-center text-amber-400">
                          {[...Array(rev.rating)].map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-amber-400" />
                          ))}
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(rev.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      "{rev.comment}"
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                No reviews yet. Be the first to consult with this professional!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Floating Mobile Action Bar */}
      <div className="fixed bottom-16 inset-x-0 sm:hidden z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2.5 shadow-lg flex items-center gap-2">
        <button
          onClick={handleTalkNow}
          disabled={startingChat}
          className="flex-1 py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition active:scale-95 flex items-center justify-center gap-1.5"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Talk Now (First 1 min FREE)</span>
        </button>

        <button
          onClick={() => navigate(`/appointments?expertId=${expert.id}`)}
          className="py-3 px-3 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-xs transition flex items-center justify-center gap-1 shrink-0"
        >
          <Calendar className="w-4 h-4 text-emerald-600" />
          <span>Book</span>
        </button>
      </div>
    </div>
  );
};

