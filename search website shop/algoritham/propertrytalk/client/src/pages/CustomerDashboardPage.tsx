import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ConsultationChat, CallSession, Appointment, Expert } from '../types';
import { api } from '../services/api';
import {
  User,
  MessageSquare,
  PhoneCall,
  Calendar,
  Bookmark,
  Star,
  Clock,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

export const CustomerDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [chats, setChats] = useState<ConsultationChat[]>([]);
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chats' | 'calls' | 'appointments'>('chats');

  useEffect(() => {
    if (!user) {
      navigate('/auth?mode=login');
      return;
    }

    Promise.all([
      api.get<ConsultationChat[]>('/chats/my').catch(() => []),
      api.get<CallSession[]>('/calls/my').catch(() => []),
      api.get<Appointment[]>('/appointments/my').catch(() => []),
    ])
      .then(([chatsData, callsData, appointmentsData]) => {
        setChats(chatsData);
        setCalls(callsData);
        setAppointments(appointmentsData);
      })
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-24">
      {/* Profile Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-2xl shadow-md shadow-emerald-600/20">
            {user?.name.charAt(0) || 'U'}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              {user?.name}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
            <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
              Consumer Account
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/experts"
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
          >
            Find New Expert
          </Link>
          <Link
            to="/expert/onboarding"
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            Are you a professional? Apply to Consult
          </Link>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-6">
        <button
          onClick={() => setActiveTab('chats')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'chats'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>My Chats ({chats.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('calls')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'calls'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <PhoneCall className="w-4 h-4" />
          <span>My Call History ({calls.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('appointments')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'appointments'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Appointments ({appointments.length})</span>
        </button>
      </div>

      {/* Tab 1: Chats */}
      {activeTab === 'chats' && (
        <div className="space-y-3">
          {chats.length > 0 ? (
            chats.map((chat) => (
              <Link
                key={chat.id}
                to={`/chat/${chat.id}`}
                className="bg-white rounded-2xl border border-slate-200 p-4 hover:border-emerald-500 shadow-xs hover:shadow-md transition flex items-center justify-between gap-4 group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <img
                    src={chat.expert?.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80'}
                    alt={chat.expert?.user?.name}
                    className="w-12 h-12 rounded-xl object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 truncate">
                        {chat.expert?.user?.name}
                      </span>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="text-xs text-slate-400">
                        {chat.expert?.country?.flag}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-700 font-semibold truncate">
                      {chat.expert?.category?.name} • {chat.expert?.businessName}
                    </p>
                    <p className="text-xs text-slate-500 truncate mt-1">
                      {chat.messages?.[0]?.content || 'Open private consultation chat...'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-emerald-600 group-hover:translate-x-1 transition flex items-center gap-1">
                    Open Chat
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            ))
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
              <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No active consultation chats yet.</p>
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

      {/* Tab 2: Call History */}
      {activeTab === 'calls' && (
        <div className="space-y-3">
          {calls.length > 0 ? (
            calls.map((call) => (
              <div
                key={call.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                    <PhoneCall className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <span>{call.expert?.user?.name || 'Property Professional'}</span>
                      <span className="text-slate-400 font-normal">({call.callType})</span>
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      {call.connectedAt ? new Date(call.connectedAt).toLocaleString() : call.createdAt ? new Date(call.createdAt).toLocaleString() : 'Recent Consultation'}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-slate-800 block">
                    Duration: {Math.round((call.durationSeconds || 0) / 60)} mins
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold">
                    {call.extendedPaid ? `Paid Extension ($${call.costCharged})` : 'First 1 Min Free'}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
              <PhoneCall className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No calls recorded yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Appointments */}
      {activeTab === 'appointments' && (
        <div className="space-y-3">
          {appointments.length > 0 ? (
            appointments.map((appt) => (
              <div
                key={appt.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between gap-4"
              >
                <div>
                  <div className="font-bold text-xs text-slate-900">
                    {appt.expert?.name} — {appt.expert?.category?.name}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-3 mt-1">
                    <span>Date: <strong>{appt.date}</strong></span>
                    <span>Time: <strong>{appt.startTime} - {appt.endTime}</strong></span>
                  </div>
                </div>

                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                  {appt.status}
                </span>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No booked appointments yet.</p>
              <Link
                to="/appointments"
                className="mt-3 inline-block px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs"
              >
                Schedule Appointment
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
