import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Expert, ConsultationChat, CallSession, Appointment } from '../types';
import { api } from '../services/api';
import {
  Radio,
  ShieldCheck,
  MessageSquare,
  PhoneCall,
  Calendar,
  Star,
  Clock,
  DollarSign,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  Users,
} from 'lucide-react';

export const ExpertDashboardPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Expert | null>(null);
  const [chats, setChats] = useState<ConsultationChat[]>([]);
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingOnline, setTogglingOnline] = useState(false);

  const [rates, setRates] = useState({
    chatRatePerMinute: 2.5,
    audioRatePerMinute: 2.5,
    videoRatePerMinute: 3.0,
    currencySymbol: '$',
    currency: 'NZD',
  });
  const [editingRates, setEditingRates] = useState(false);
  const [rateForm, setRateForm] = useState({
    chat: '2.50',
    audio: '2.50',
    video: '3.00',
  });
  const [savingRates, setSavingRates] = useState(false);

  const loadData = async () => {
    try {
      const me = await api.get<any>('/auth/me');
      if (me.expertProfile) {
        const fullExpert = await api.get<Expert>(`/experts/${me.expertProfile.id}`);
        setProfile(fullExpert);
      }
      const [chatsData, callsData, apptsData, ratesData] = await Promise.all([
        api.get<ConsultationChat[]>('/chats/my').catch(() => []),
        api.get<CallSession[]>('/calls/my').catch(() => []),
        api.get<Appointment[]>('/appointments/my').catch(() => []),
        api.get<any>('/expert/rates').catch(() => null),
      ]);
      setChats(chatsData);
      setCalls(callsData);
      setAppointments(apptsData);
      if (ratesData && ratesData.data) {
        setRates(ratesData.data);
        setRateForm({
          chat: ratesData.data.chatRatePerMinute.toFixed(2),
          audio: ratesData.data.audioRatePerMinute.toFixed(2),
          video: ratesData.data.videoRatePerMinute.toFixed(2),
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/auth?mode=login');
      return;
    }
    loadData();
  }, [user]);

  const handleToggleOnline = async () => {
    if (!profile) return;
    if (profile.verificationStatus !== 'VERIFIED') {
      alert('You must be verified by Super Admin before you can go online for consultations.');
      return;
    }

    setTogglingOnline(true);
    try {
      const res = await api.patch<{ isOnline: boolean }>('/experts/me/status', {
        isOnline: !profile.isOnline,
      });
      setProfile((prev) => (prev ? { ...prev, isOnline: res.isOnline } : null));
      await refreshUser();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle status');
    } finally {
      setTogglingOnline(false);
    }
  };

  const handleSaveRates = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRates(true);
    try {
      const res = await api.patch<any>('/expert/rates', {
        chatRatePerMinute: parseFloat(rateForm.chat),
        audioRatePerMinute: parseFloat(rateForm.audio),
        videoRatePerMinute: parseFloat(rateForm.video),
      });
      if (res && res.data) {
        setRates((prev) => ({
          ...prev,
          chatRatePerMinute: res.data.chatRatePerMinute,
          audioRatePerMinute: res.data.audioRatePerMinute,
          videoRatePerMinute: res.data.videoRatePerMinute,
        }));
        setEditingRates(false);
        alert('Consultation rates updated successfully!');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update rates');
    } finally {
      setSavingRates(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 animate-pulse h-96" />
      </div>
    );
  }

  const isVerified = profile?.verificationStatus === 'VERIFIED';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-24">
      {/* Top Banner: Verification Status & Online Toggle */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={profile?.photoUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80'}
                alt={user?.name}
                className="w-16 h-16 rounded-2xl object-cover border border-slate-100"
              />
              <span
                className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                  profile?.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  {user?.name}
                </h1>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                    isVerified
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{profile?.verificationStatus || 'PENDING'}</span>
                </span>
              </div>

              <p className="text-xs text-slate-500 mt-0.5">
                {profile?.category?.name} • {profile?.businessName} ({profile?.country?.flag} {profile?.country?.name})
              </p>
            </div>
          </div>

          {/* Online Toggle & Status */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-xs font-semibold text-slate-800 block">
                Consultation Availability
              </span>
              <span className="text-[11px] text-slate-400">
                {profile?.isOnline ? 'Visible to consumers as Online' : 'Appearing Offline'}
              </span>
            </div>

            <button
              onClick={handleToggleOnline}
              disabled={togglingOnline || !isVerified}
              className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-xs transition ${
                profile?.isOnline
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              } ${!isVerified ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Radio className={`w-4 h-4 ${profile?.isOnline ? 'animate-pulse' : ''}`} />
              <span>{profile?.isOnline ? 'Online Now' : 'Go Online'}</span>
            </button>
          </div>
        </div>

        {/* If not verified, show prominent onboarding banner */}
        {!isVerified && (
          <div className="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>
                Your verification status is <strong>{profile?.verificationStatus || 'PENDING_VERIFICATION'}</strong>.
                Complete onboarding documents so Super Admin can verify your professional license.
              </span>
            </div>

            <Link
              to="/expert/onboarding"
              className="px-3 py-1.5 rounded-xl bg-amber-600 text-white font-bold text-xs shrink-0 hover:bg-amber-700 transition"
            >
              Verification Details
            </Link>
          </div>
        )}
      </div>

      {/* Analytics KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Active Chats</span>
            <MessageSquare className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{chats.length}</div>
          <span className="text-[10px] text-slate-400">Incoming consultation inquiries</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Completed Calls</span>
            <PhoneCall className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{calls.length}</div>
          <span className="text-[10px] text-slate-400">Audio & Video sessions</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Appointments</span>
            <Calendar className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{appointments.length}</div>
          <span className="text-[10px] text-slate-400">Booked sessions</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Rating Average</span>
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {profile?.ratingAvg?.toFixed(1) || '5.0'}
          </div>
          <span className="text-[10px] text-slate-400">
            Based on {profile?.reviewCount || 0} reviews
          </span>
        </div>
      </div>

      {/* Pending Consultation Requests Section */}
      {chats.filter((c) => c.status === 'REQUESTED').length > 0 && (
        <div className="bg-emerald-50 border-2 border-emerald-400 rounded-3xl p-5 sm:p-6 mb-8 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <h2 className="text-base font-extrabold text-slate-900">
                Pending Consultation Requests ({chats.filter((c) => c.status === 'REQUESTED').length})
              </h2>
            </div>
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full">
              Action Required
            </span>
          </div>

          <div className="space-y-3">
            {chats
              .filter((c) => c.status === 'REQUESTED')
              .map((reqChat) => (
                <div
                  key={reqChat.id}
                  className="bg-white rounded-2xl border border-emerald-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">
                        {reqChat.consumer?.name || 'Customer'}
                      </span>
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                        Requested {new Date(reqChat.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {reqChat.initialMessage && (
                      <p className="text-xs text-slate-600 mt-1 italic">
                        "{reqChat.initialMessage}"
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-1">
                      Accepting will start the customer's introductory 1-minute free consultation.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigate(`/chat/${reqChat.id}`)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
                    >
                      Review & Respond →
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Consultation Rates & Earnings Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Consultation Rates ({rates.currency} {rates.currencySymbol})
              </h2>
              <p className="text-xs text-slate-500">
                Set per-minute rates for paid consultation continuation. 1st minute is always free.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/earnings"
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-1.5"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>View Earnings Ledger</span>
            </Link>

            {!editingRates && (
              <button
                onClick={() => setEditingRates(true)}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition"
              >
                Edit Rates
              </button>
            )}
          </div>
        </div>

        {editingRates ? (
          <form onSubmit={handleSaveRates} className="pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Text Chat Rate ({rates.currencySymbol}/min)
                </label>
                <input
                  type="number"
                  step="0.10"
                  min="1.00"
                  max="20.00"
                  value={rateForm.chat}
                  onChange={(e) => setRateForm({ ...rateForm, chat: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Min $1.00 • Max $20.00</span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Audio Call Rate ({rates.currencySymbol}/min)
                </label>
                <input
                  type="number"
                  step="0.10"
                  min="1.00"
                  max="20.00"
                  value={rateForm.audio}
                  onChange={(e) => setRateForm({ ...rateForm, audio: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Min $1.00 • Max $20.00</span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Video Call Rate ({rates.currencySymbol}/min)
                </label>
                <input
                  type="number"
                  step="0.10"
                  min="1.00"
                  max="20.00"
                  value={rateForm.video}
                  onChange={(e) => setRateForm({ ...rateForm, video: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Min $1.00 • Max $20.00</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={savingRates}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <span>{savingRates ? 'Saving...' : 'Save Rates'}</span>
              </button>
              <button
                type="button"
                onClick={() => setEditingRates(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                Text Chat Continuation
              </span>
              <div className="text-xl font-extrabold text-slate-900">
                {rates.currencySymbol}{rates.chatRatePerMinute.toFixed(2)}
                <span className="text-xs font-normal text-slate-500 ml-1">/ minute</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                Prorated at ~{rates.currencySymbol}{(rates.chatRatePerMinute / 60).toFixed(3)}/sec
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                Voice Audio Consultation
              </span>
              <div className="text-xl font-extrabold text-slate-900">
                {rates.currencySymbol}{rates.audioRatePerMinute.toFixed(2)}
                <span className="text-xs font-normal text-slate-500 ml-1">/ minute</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                Prorated at ~{rates.currencySymbol}{(rates.audioRatePerMinute / 60).toFixed(3)}/sec
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">
                HD Video Consultation
              </span>
              <div className="text-xl font-extrabold text-slate-900">
                {rates.currencySymbol}{rates.videoRatePerMinute.toFixed(2)}
                <span className="text-xs font-normal text-slate-500 ml-1">/ minute</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                Prorated at ~{rates.currencySymbol}{(rates.videoRatePerMinute / 60).toFixed(3)}/sec
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Sections: Recent Chats & Appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chats & Leads */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>Incoming Customer Inquiries</span>
            </h2>
          </div>

          {chats.length > 0 ? (
            <div className="space-y-3">
              {chats.map((chat) => (
                <Link
                  key={chat.id}
                  to={`/chat/${chat.id}`}
                  className="p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-500 transition flex items-center justify-between gap-3 group"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 block group-hover:text-emerald-700">
                        {chat.consumer?.name || 'Customer'}
                      </span>
                      {chat.status === 'REQUESTED' && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded-md">
                          Requested
                        </span>
                      )}
                      {chat.status === 'CONNECTED' && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-md">
                          Connected
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                      {chat.initialMessage || chat.messages?.[0]?.content || 'Open private chat...'}
                    </span>
                  </div>

                  <span className="text-xs font-bold text-emerald-600 shrink-0">
                    {chat.status === 'REQUESTED' ? 'Respond →' : 'Open Chat →'}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic py-6 text-center">
              No customer inquiries yet. Keep your status Online to receive instant calls!
            </p>
          )}
        </div>

        {/* Appointments Schedule */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>Scheduled Appointments</span>
            </h2>
          </div>

          {appointments.length > 0 ? (
            <div className="space-y-3">
              {appointments.map((appt) => (
                <div
                  key={appt.id}
                  className="p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 block">
                      {appt.consumer?.name || 'Customer'}
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      {appt.date} • {appt.startTime} - {appt.endTime}
                    </span>
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                    {appt.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic py-6 text-center">
              No appointments booked yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
