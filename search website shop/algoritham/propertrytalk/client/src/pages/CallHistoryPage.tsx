import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCountry } from '../context/CountryContext';
import { CallSession } from '../types';
import { api } from '../services/api';
import {
  PhoneCall,
  Video,
  Clock,
  Calendar,
  MessageSquare,
  ShieldCheck,
  ChevronRight,
  PhoneOff,
} from 'lucide-react';

export const CallHistoryPage: React.FC = () => {
  const { user } = useAuth();
  const { selectedCountry } = useCountry();
  const navigate = useNavigate();

  const [calls, setCalls] = useState<CallSession[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'AUDIO' | 'VIDEO' | 'MISSED'>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth?mode=login');
      return;
    }

    api.get<CallSession[]>('/calls/my')
      .then(setCalls)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const currencyCode = selectedCountry?.currency || 'NZD';

  const filteredCalls = calls.filter((c) => {
    if (filterType === 'AUDIO') return c.callType === 'AUDIO';
    if (filterType === 'VIDEO') return c.callType === 'VIDEO';
    if (filterType === 'MISSED') return c.status === 'DECLINED' || c.status === 'CANCELLED';
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28 space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          Call History
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          View your completed and missed audio & video consultations.
        </p>
      </div>

      {/* Filter Tabs: All, Audio, Video, Missed */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
        {(['ALL', 'AUDIO', 'VIDEO', 'MISSED'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterType(tab)}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
              filterType === tab
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Call List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading call history...</div>
        ) : filteredCalls.length > 0 ? (
          filteredCalls.map((call) => {
            const isVideo = call.callType === 'VIDEO';
            const durationMins = Math.max(1, Math.round((call.durationSeconds || 0) / 60));
            const isFree = !call.extendedPaid || call.costCharged === 0;
            const isMissed = call.status === 'DECLINED' || call.status === 'CANCELLED';

            return (
              <div
                key={call.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <img
                      src={call.expert?.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80'}
                      alt={call.expert?.name}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-100"
                    />
                    <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center absolute -bottom-1 -right-1">
                      {isVideo ? <Video className="w-2.5 h-2.5" /> : <PhoneCall className="w-2.5 h-2.5" />}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs sm:text-sm text-slate-900">
                        {call.expert?.name || call.expert?.user?.name || 'Property Expert'}
                      </span>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    </div>

                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {call.expert?.category?.name || 'Consultation'}
                    </p>

                    <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                      <span>{call.connectedAt ? new Date(call.connectedAt).toLocaleDateString() : 'Recent'}</span>
                      <span>•</span>
                      <span>{isMissed ? 'Declined' : `${durationMins} mins duration`}</span>
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isMissed
                        ? 'bg-slate-100 text-slate-600'
                        : isFree
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {isMissed ? 'Missed Call' : isFree ? 'Free Consultation' : `Paid ${currencyCode} $${call.costCharged}`}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/chat/${call.chatId}`)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:border-slate-300 text-xs font-bold transition flex items-center gap-1"
                    >
                      <MessageSquare className="w-3 h-3 text-emerald-600" />
                      <span>Chat Again</span>
                    </button>

                    {call.expert && (
                      <button
                        onClick={() => navigate(`/appointments?expertId=${call.expert?.id}`)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                        title="Book Appointment"
                      >
                        <Calendar className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-8 text-center">
            <PhoneCall className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">No calls in this category.</p>
          </div>
        )}
      </div>
    </div>
  );
};
