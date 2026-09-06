import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCountry } from '../context/CountryContext';
import { CallSession, ConsultationChat, Appointment } from '../types';
import { api } from '../services/api';
import {
  PhoneCall,
  MessageSquare,
  Calendar,
  Clock,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Video,
  ExternalLink,
} from 'lucide-react';

export const ConsultationHistoryPage: React.FC = () => {
  const { user } = useAuth();
  const { selectedCountry } = useCountry();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'calls' | 'chats' | 'bookings'>('calls');
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [chats, setChats] = useState<ConsultationChat[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth?mode=login');
      return;
    }

    Promise.all([
      api.get<CallSession[]>('/calls/my').catch(() => []),
      api.get<ConsultationChat[]>('/chats/my').catch(() => []),
      api.get<Appointment[]>('/appointments/my').catch(() => []),
    ])
      .then(([callsData, chatsData, apptsData]) => {
        setCalls(callsData);
        setChats(chatsData);
        setAppointments(apptsData);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const currencySymbol = selectedCountry?.currencySymbol || '$';
  const currencyCode = selectedCountry?.currency || 'NZD';

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28 space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          Consultation History
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Review your previous calls, messages, and formal appointments.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
        <button
          onClick={() => setActiveTab('calls')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
            activeTab === 'calls'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>Calls ({calls.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('chats')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
            activeTab === 'chats'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Chats ({chats.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('bookings')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
            activeTab === 'bookings'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Bookings ({appointments.length})</span>
        </button>
      </div>

      {/* Tab 1: Calls */}
      {activeTab === 'calls' && (
        <div className="space-y-3">
          {calls.length > 0 ? (
            calls.map((call) => {
              const isVideo = call.callType === 'VIDEO';
              const durationMins = Math.max(1, Math.round((call.durationSeconds || 0) / 60));
              const isFree = !call.extendedPaid || call.costCharged === 0;

              return (
                <div
                  key={call.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex items-center justify-between gap-3 hover:border-slate-300 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={call.expert?.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80'}
                      alt={call.expert?.name}
                      className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-100"
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                          {call.expert?.name || call.expert?.user?.name || 'Property Expert'}
                        </span>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="text-[10px] text-slate-400 font-medium">
                          ({call.expert?.country?.code || 'NZ'})
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {call.expert?.category?.name || 'Consultation'}
                      </p>

                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                        <span>{call.connectedAt ? new Date(call.connectedAt).toLocaleDateString() : 'Recent'}</span>
                        <span>•</span>
                        <span>{durationMins} min {isVideo ? 'Video' : 'Audio'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isFree
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {isFree ? 'Free Consultation' : `Paid: ${currencyCode} $${call.costCharged}`}
                    </span>

                    <button
                      onClick={() => navigate(`/chat/${call.chatId}`)}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                    >
                      <span>Reopen Chat</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-8 text-center">
              <PhoneCall className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">No calls logged yet.</p>
              <Link
                to="/experts"
                className="mt-3 inline-block px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs"
              >
                Find an Expert
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Chats */}
      {activeTab === 'chats' && (
        <div className="space-y-3">
          {chats.length > 0 ? (
            chats.map((chat) => (
              <Link
                key={chat.id}
                to={`/chat/${chat.id}`}
                className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex items-center justify-between gap-3 hover:border-emerald-500 transition group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={chat.expert?.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80'}
                    alt={chat.expert?.name}
                    className="w-12 h-12 rounded-xl object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="font-bold text-xs sm:text-sm text-slate-900 truncate block">
                      {chat.expert?.name || chat.expert?.user?.name}
                    </span>
                    <p className="text-[11px] text-emerald-700 font-semibold truncate mt-0.5">
                      {chat.expert?.category?.name}
                    </p>
                    <p className="text-xs text-slate-500 truncate mt-1">
                      {chat.messages?.[0]?.content || 'Open chat...'}
                    </p>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition" />
              </Link>
            ))
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-8 text-center">
              <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">No consultation chats yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Bookings */}
      {activeTab === 'bookings' && (
        <div className="space-y-3">
          {appointments.length > 0 ? (
            appointments.map((appt) => (
              <div
                key={appt.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex items-center justify-between gap-3"
              >
                <div>
                  <span className="font-bold text-xs sm:text-sm text-slate-900 block">
                    {appt.expert?.name} ({appt.expert?.category?.name})
                  </span>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                    <span>{appt.date}</span>
                    <span>•</span>
                    <span>{appt.startTime} - {appt.endTime}</span>
                  </div>
                </div>

                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                  {appt.status}
                </span>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-8 text-center">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">No scheduled appointments.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
