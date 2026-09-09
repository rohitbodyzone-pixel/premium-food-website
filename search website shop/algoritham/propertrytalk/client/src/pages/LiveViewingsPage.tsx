import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { LiveViewingSession } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { LiveViewingCard } from '../components/cards/LiveViewingCard';
import {
  Video,
  Clock,
  Users,
  ShieldCheck,
  Send,
  AlertCircle,
  Calendar,
  MicOff,
  CameraOff,
  ArrowLeft,
  DollarSign,
  Info,
  CheckCircle2,
} from 'lucide-react';

export const LiveViewingsPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<LiveViewingSession[]>([]);
  const [currentSession, setCurrentSession] = useState<LiveViewingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'ALL' | 'GROUP' | 'PRIVATE'>('ALL');

  // Broadcast Room States
  const [chatMessages, setChatMessages] = useState<{ id: string; sender: string; text: string; time: string }[]>([
    { id: '1', sender: 'Host (Sarah Jenkins)', text: 'Welcome everyone! We are starting the 10-minute live tour promptly.', time: '14:00' },
  ]);
  const [newMsg, setNewMsg] = useState('');
  const [secondsRemaining, setSecondsRemaining] = useState(600); // 10 minutes = 600s
  const [isSessionActive, setIsSessionActive] = useState(false);

  // Booking Modal State
  const [bookingSession, setBookingSession] = useState<LiveViewingSession | null>(null);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Load Sessions List or Specific Session
  useEffect(() => {
    setLoading(true);
    if (id) {
      api.get<LiveViewingSession>(`/live-viewings/${id}`)
        .then((data) => {
          setCurrentSession(data);
          if (data.status === 'LIVE') {
            setIsSessionActive(true);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      api.get<LiveViewingSession[]>('/live-viewings')
        .then(setSessions)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id]);

  // 10-minute timer for active session
  useEffect(() => {
    if (!isSessionActive) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsSessionActive(false);
          alert('10-Minute Remote Viewing has concluded. Thank you for joining!');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isSessionActive]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: user?.name || 'Viewer',
        text: newMsg.trim(),
        time: new Date().toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setNewMsg('');
  };

  const handleBookTicket = async (session: LiveViewingSession) => {
    if (!user) {
      navigate('/auth?mode=login');
      return;
    }
    try {
      setBookingSubmitting(true);
      await api.post(`/live-viewings/${session.id}/book`, {});
      setBookingSuccess(true);
      setTimeout(() => {
        setBookingSession(null);
        setBookingSuccess(false);
        // Refresh list
        api.get<LiveViewingSession[]>('/live-viewings').then(setSessions);
      }, 2000);
    } catch (err: any) {
      console.error('Booking failed:', err);
      alert(err.response?.data?.error || err.message || 'Failed to book live viewing ticket.');
    } finally {
      setBookingSubmitting(false);
    }
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // If viewing a specific live broadcast room:
  if (id && currentSession) {
    const isHost = currentSession.userRole === 'HOST';
    const isConfirmed = currentSession.userRole === 'CONFIRMED_VIEWER' || isHost;
    const property = currentSession.property;

    return (
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 pb-28 space-y-4">
        <div className="flex items-center justify-between">
          <Link
            to="/live-viewings"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>All Live Viewings</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold bg-slate-900 text-white px-3 py-1 rounded-full flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Time Left: {formatTimer(secondsRemaining)}</span>
            </span>
          </div>
        </div>

        {/* Live Broadcast Arena */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Video Screen */}
          <div className="lg:col-span-2 bg-slate-950 rounded-3xl overflow-hidden shadow-xl aspect-16/10 flex flex-col relative">
            {/* Simulated Live Stream / Video Frame */}
            <div className="w-full h-full relative flex items-center justify-center bg-slate-900">
              <img
                src={property?.images?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80'}
                alt="Live stream"
                className="w-full h-full object-cover opacity-85"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30" />

              {/* Status Pill */}
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="bg-red-600 text-white text-[11px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1.5 animate-pulse shadow-md">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  <span>LIVE BROADCAST</span>
                </span>
                <span className="bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
                  {currentSession.viewingType === 'GROUP' ? 'Group Session' : 'Private Session'}
                </span>
              </div>

              {/* Viewer Mic & Cam Privacy Pill */}
              <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-slate-300 text-[11px] border border-white/10">
                <MicOff className="w-3.5 h-3.5 text-red-400" />
                <CameraOff className="w-3.5 h-3.5 text-red-400" />
                <span>Your Mic & Cam OFF</span>
              </div>

              {/* Agent info bar at bottom of stream */}
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between text-white">
                <div>
                  <h3 className="font-bold text-sm sm:text-base drop-shadow-sm">
                    {property?.title || 'Live Walkthrough'}
                  </h3>
                  <p className="text-xs text-slate-300 drop-shadow-sm">
                    Host: {currentSession.hostProfile?.name || 'Agent'} ({currentSession.hostProfile?.businessName || 'REA Licensed'})
                  </p>
                </div>

                {!isSessionActive && (
                  <button
                    type="button"
                    onClick={() => setIsSessionActive(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-lg animate-bounce"
                  >
                    Start 10-Minute Stream
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Live Q&A Chat Column */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs flex flex-col h-[400px] lg:h-auto overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                  Live Q&A Chat
                </h4>
                <p className="text-[10px] text-slate-400">Ask the host questions live</p>
              </div>
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                Strict 10m limit
              </span>
            </div>

            {/* Chat message list */}
            <div className="flex-1 p-3.5 overflow-y-auto space-y-2.5 text-xs">
              {chatMessages.map((m) => (
                <div key={m.id} className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mb-0.5">
                    <span className="text-slate-700">{m.sender}</span>
                    <span>{m.time}</span>
                  </div>
                  <p className="text-slate-800 leading-snug">{m.text}</p>
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="p-2.5 border-t border-slate-100 flex gap-2">
              <input
                type="text"
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                placeholder="Ask a question about the property..."
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
              <button
                type="submit"
                className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Remote Live Viewing Guidelines */}
        <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-xs text-slate-600 space-y-2">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-emerald-600" />
            <span>PropertyTalk Remote Viewing Standards:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-500 text-[11px]">
            <li>10-Minute Fixed Window: To preserve high energy and fast decision making, all remote viewings auto-terminate at 10 minutes.</li>
            <li>No extensions permitted. Follow-up inquiries can be made directly via free messaging.</li>
            <li>Private by Design: Viewer microphones and webcams are disabled by default for privacy.</li>
            <li>Recording is strictly disabled unless written consent is provided by the vendor and host.</li>
          </ul>
        </div>
      </div>
    );
  }

  // Live Viewings Marketplace Overview / Index
  const filteredSessions = sessions.filter((s) => {
    if (filterType === 'GROUP') return s.viewingType === 'GROUP';
    if (filterType === 'PRIVATE') return s.viewingType === 'PRIVATE';
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-5 pb-28 space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-900/80 border border-emerald-500/30 px-3 py-1 rounded-full">
            Paid Remote Live Viewings
          </span>
          <h1 className="text-2xl sm:text-3xl font-black mt-2 tracking-tight">
            Inspect Properties in Real Time from Anywhere
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
            High-definition 10-minute live walkthroughs hosted by verified licensed agents. Group viewings ($20 NZD) or 1-on-1 private viewings ($60 NZD).
          </p>

          <div className="flex items-center gap-3 mt-4 text-xs">
            <div className="flex items-center gap-1 text-slate-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Min 5 Bookings or 100% Refund</span>
            </div>
            <div className="flex items-center gap-1 text-slate-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Camera/Mic Privacy</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-xl transition ${
              filterType === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All Sessions ({sessions.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('GROUP')}
            className={`px-3 py-1.5 rounded-xl transition ${
              filterType === 'GROUP' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Group ($20 NZD)
          </button>
          <button
            type="button"
            onClick={() => setFilterType('PRIVATE')}
            className={`px-3 py-1.5 rounded-xl transition ${
              filterType === 'PRIVATE' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Private ($60 NZD)
          </button>
        </div>
      </div>

      {/* Sessions Grid */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            <div className="h-40 bg-slate-100 rounded-3xl animate-pulse" />
            <div className="h-40 bg-slate-100 rounded-3xl animate-pulse" />
          </div>
        ) : filteredSessions.length > 0 ? (
          filteredSessions.map((session) => (
            <LiveViewingCard
              key={session.id}
              session={session}
              onBook={() => setBookingSession(session)}
            />
          ))
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center">
            <Video className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-bold text-slate-800 text-sm">No scheduled live viewings in this category</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Explore property listings to request or book a remote live viewing session directly with the agent.
            </p>
            <Link
              to="/explore"
              className="mt-4 inline-block px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl"
            >
              Browse Properties
            </Link>
          </div>
        )}
      </div>

      {/* Ticket Purchase Modal */}
      {bookingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative">
            <h3 className="font-extrabold text-base text-slate-900">
              Confirm {bookingSession.viewingType === 'GROUP' ? 'Group' : 'Private'} Live Viewing Ticket
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {bookingSession.property?.title || 'Property Walkthrough'}
            </p>

            {bookingSuccess ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-slate-900">Booking Confirmed!</h4>
                <p className="text-xs text-slate-500">Your live viewing session is ready.</p>
              </div>
            ) : (
              <div className="space-y-4 mt-4 text-xs">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex justify-between font-bold text-slate-900 text-sm">
                    <span>Ticket Price:</span>
                    <span>${bookingSession.ticketPriceMinorUnits / 100} NZD</span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-xs">
                    <span>Duration:</span>
                    <span>10 Minutes (Strict auto-end)</span>
                  </div>
                  {bookingSession.viewingType === 'GROUP' && (
                    <div className="text-[11px] text-amber-700 font-medium">
                      * If 5 bookings are not received prior to start, you will be automatically refunded in full.
                    </div>
                  )}
                  <div className="text-[11px] text-slate-500">
                    Viewer camera & microphone remain OFF for your privacy. You can ask questions via live chat.
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setBookingSession(null)}
                    className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={bookingSubmitting}
                    onClick={() => handleBookTicket(bookingSession)}
                    className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs"
                  >
                    {bookingSubmitting ? 'Processing...' : `Pay $${bookingSession.ticketPriceMinorUnits / 100} & Book`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
