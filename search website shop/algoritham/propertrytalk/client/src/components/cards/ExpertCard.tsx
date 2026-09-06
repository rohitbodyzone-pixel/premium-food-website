import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Expert } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  ShieldCheck,
  Star,
  MessageSquare,
  Bookmark,
  Calendar,
  Info,
  X,
} from 'lucide-react';

interface ExpertCardProps {
  expert: Expert;
  onSaveToggle?: (expertId: string, saved: boolean) => void;
}

export const ExpertCard: React.FC<ExpertCardProps> = ({ expert, onSaveToggle }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isSaved, setIsSaved] = useState(expert.isSaved || false);
  const [saving, setSaving] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  const [showVerifiedTooltip, setShowVerifiedTooltip] = useState(false);

  const isNZ = expert.country?.code === 'NZ' || expert.countryCode === 'NZ';
  const currencyCode = isNZ ? 'NZD' : 'AUD';

  const handleToggleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/auth?mode=login');
      return;
    }

    setSaving(true);
    try {
      const res = await api.post<{ saved: boolean }>(`/experts/${expert.id}/save`);
      setIsSaved(res.saved);
      onSaveToggle?.(expert.id, res.saved);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleChat = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      navigate('/auth?mode=register&redirect=' + encodeURIComponent(`/chat/new?expertId=${expert.id}`));
      return;
    }

    setStartingChat(true);
    try {
      const chat = await api.post<any>('/chats/talk-now', { expertId: expert.id });
      navigate(`/chat/${chat.id}`);
    } catch (err: any) {
      alert(err.message || 'Failed to open private consultation chat');
    } finally {
      setStartingChat(false);
    }
  };

  const handleCardClick = () => {
    navigate(`/experts/${expert.id}`);
  };

  return (
    <div
      onClick={handleCardClick}
      className="bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 shadow-xs hover:shadow-md transition-all duration-150 p-3.5 sm:p-4 cursor-pointer relative group flex items-center justify-between gap-3 sm:gap-4"
    >
      {/* LEFT SIDE: Circular Avatar + Rating & Review Count underneath */}
      <div className="flex flex-col items-center shrink-0 w-16 sm:w-20 text-center">
        <div className="relative">
          <img
            src={
              expert.photoUrl ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80'
            }
            alt={expert.name}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-slate-100 shadow-xs"
          />

          {/* Online status indicator */}
          <span
            className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
              expert.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
            title={expert.isOnline ? 'Online Now' : 'Offline'}
          >
            {expert.isOnline && (
              <span className="w-1.5 h-1.5 rounded-full bg-white block m-auto mt-0.5 animate-pulse" />
            )}
          </span>
        </div>

        {/* Rating & Review count under photo */}
        <div className="flex items-center justify-center gap-1 mt-1.5 text-[11px] font-bold text-slate-800">
          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
          <span>{expert.ratingAvg ? expert.ratingAvg.toFixed(1) : '5.0'}</span>
          <span className="text-slate-400 font-normal">
            ({expert.reviewCount || 0})
          </span>
        </div>
      </div>

      {/* CENTER: Name, Verified Badge, Title, Category, Languages, Exp, Location, Pricing */}
      <div className="flex-1 min-w-0 pr-1">
        {/* Name & Verified Badge */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate tracking-tight group-hover:text-emerald-700 transition">
            {expert.name}
          </h3>

          {/* Verified Badge */}
          {expert.verificationStatus === 'VERIFIED' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowVerifiedTooltip(!showVerifiedTooltip);
              }}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded-full hover:bg-emerald-100 transition"
              title="Verified by PropertyTalk"
            >
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>Verified</span>
            </button>
          )}
        </div>

        {/* Profession / Title */}
        <p className="text-xs text-slate-600 font-medium truncate mt-0.5">
          {expert.category?.name || expert.title}
        </p>

        {/* Meta details: Languages, Exp, Location */}
        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
          <span>{expert.languages?.join(', ') || 'English'}</span>
          <span className="text-slate-300">•</span>
          <span className="font-semibold text-slate-700">
            Exp: {expert.yearsOfExperience || 0} Years
          </span>
          <span className="text-slate-300">•</span>
          <span className="truncate">
            {expert.city}, {expert.country?.code || (isNZ ? 'NZ' : 'AU')}
          </span>
        </div>

        {/* PRICE / FREE AREA */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="inline-flex items-center text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
            First 1 min FREE
          </span>

          <span className="text-xs font-bold text-slate-800">
            {currencyCode} ${(expert.callPerMinuteRate || 2.5).toFixed(2)}/min
          </span>
        </div>
      </div>

      {/* RIGHT SIDE: Large Outlined CHAT Button + Bookmark button */}
      <div className="flex flex-col items-end justify-between shrink-0 h-full py-1 gap-3">
        {/* Bookmark Icon */}
        <button
          type="button"
          onClick={handleToggleSave}
          disabled={saving}
          className={`p-1 rounded-full transition ${
            isSaved
              ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
              : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
          }`}
          title={isSaved ? 'Remove from saved' : 'Save expert'}
        >
          <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-amber-500' : ''}`} />
        </button>

        {/* Outlined CHAT button */}
        <button
          type="button"
          onClick={handleChat}
          disabled={startingChat}
          className="px-4 py-2 rounded-xl border-2 border-emerald-600 hover:bg-emerald-600 hover:text-white text-emerald-700 font-bold text-xs shadow-xs transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{startingChat ? '...' : 'Chat'}</span>
        </button>
      </div>

      {/* Verified Badge Tooltip Modal */}
      {showVerifiedTooltip && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setShowVerifiedTooltip(false);
          }}
          className="absolute inset-0 z-20 bg-slate-900/85 backdrop-blur-xs rounded-2xl p-4 flex flex-col justify-center text-white text-xs animate-fade-in"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 font-bold text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Verified Professional</span>
            </div>
            <button className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-slate-200 leading-relaxed">
            PropertyTalk has checked {expert.name}’s submitted credentials ({expert.licenseNumber || 'License on file'}) against official public registers.
          </p>
        </div>
      )}
    </div>
  );
};
