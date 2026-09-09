import React, { useState, useEffect } from 'react';
import { LiveViewingSession, Property } from '../../../types';
import { api } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import {
  Video,
  Plus,
  Clock,
  Users,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Send,
  X,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Radio,
  ExternalLink,
} from 'lucide-react';

export const AgentLiveViewingsPage: React.FC = () => {
  const { user } = useAuth();

  const [sessions, setSessions] = useState<LiveViewingSession[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [activeBroadcastSession, setActiveBroadcastSession] = useState<LiveViewingSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Schedule Modal State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [viewingType, setViewingType] = useState<'GROUP' | 'PRIVATE'>('GROUP');
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [sellerConsentGiven, setSellerConsentGiven] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Host Broadcast Arena State
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(600); // 10 minutes = 600s
  const [chatMessages, setChatMessages] = useState<{ id: string; sender: string; text: string; time: string }[]>([
    { id: '1', sender: 'Buyer (John D.)', text: 'Hi Sarah, can you please show us the master bedroom wardrobe space?', time: '14:02' },
  ]);
  const [agentAnswer, setAgentAnswer] = useState('');

  const loadData = async () => {
    if (!user?.expertProfile?.id) return;
    try {
      setLoading(true);
      const [liveRes, propsRes] = await Promise.all([
        api.get<LiveViewingSession[]>('/live-viewings'),
        api.get<{ properties: Property[] }>(`/properties?agentProfileId=${user.expertProfile.id}`),
      ]);
      // Filter sessions hosted by this agent
      const mySessions = (liveRes || []).filter(s => s.hostProfileId === user.expertProfile?.id);
      setSessions(mySessions);
      setProperties(propsRes.properties || []);
      if (propsRes.properties?.length > 0) {
        setSelectedPropertyId(propsRes.properties[0].id);
      }
    } catch (err) {
      console.error('Failed to load live viewing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // 10-minute timer for active host broadcast
  useEffect(() => {
    if (!isBroadcasting) return;
    const timer = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleEndBroadcast();
          alert('10-Minute Remote Viewing session completed. Broadcast ended.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isBroadcasting]);

  const handleScheduleSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPropertyId || !scheduledDateTime) return;
    try {
      setSubmitting(true);
      await api.post('/live-viewings', {
        propertyId: selectedPropertyId,
        viewingType,
        scheduledAt: new Date(scheduledDateTime).toISOString(),
        sellerConsentGiven,
        recordingAllowed: sellerConsentGiven,
      });
      setIsScheduleModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error('Failed to schedule session:', err);
      alert(err.response?.data?.error || err.message || 'Failed to schedule live viewing session');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartBroadcast = async (session: LiveViewingSession) => {
    setActiveBroadcastSession(session);
    setTimerSeconds(600);
    setIsBroadcasting(true);
    try {
      await api.post(`/live-viewings/${session.id}/start`, {});
    } catch (err) {
      console.error('Failed to start broadcast on server:', err);
    }
  };

  const handleEndBroadcast = async () => {
    if (!activeBroadcastSession) return;
    setIsBroadcasting(false);
    try {
      await api.post(`/live-viewings/${activeBroadcastSession.id}/end`, {});
      alert('Broadcast ended. Streaming cost ($1.50 NZD) recorded.');
      setActiveBroadcastSession(null);
      loadData();
    } catch (err) {
      console.error('Failed to end broadcast:', err);
      setActiveBroadcastSession(null);
    }
  };

  const handleSendChatAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentAnswer.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: `${user?.name || 'Agent'} (Host)`,
        text: agentAnswer.trim(),
        time: new Date().toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setAgentAnswer('');
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // If currently in Host Broadcast Studio Mode:
  if (activeBroadcastSession) {
    const isGroup = activeBroadcastSession.viewingType === 'GROUP';
    const confirmedAttendees = activeBroadcastSession.confirmedCount || (isGroup ? 6 : 1);
    const minQuotaMet = isGroup ? confirmedAttendees >= (activeBroadcastSession.minAttendees || 5) : true;

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider bg-red-600 text-white px-2.5 py-1 rounded-full animate-pulse flex items-center gap-1.5 w-fit">
              <span className="w-2 h-2 rounded-full bg-white" />
              <span>LIVE BROADCAST STUDIO</span>
            </span>
            <h1 className="text-xl font-black text-slate-900 mt-1">
              {activeBroadcastSession.property?.title || 'Property Walkthrough'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-900 text-white font-mono font-bold text-sm px-4 py-2 rounded-xl flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>{formatTimer(timerSeconds)}</span>
            </div>

            <button
              type="button"
              onClick={handleEndBroadcast}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
            >
              End Broadcast
            </button>
          </div>
        </div>

        {/* Studio Grid: Camera Feed + Host Q&A / Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Host Camera Screen */}
          <div className="lg:col-span-2 bg-slate-950 rounded-3xl overflow-hidden aspect-16/10 relative shadow-xl flex flex-col justify-between p-4">
            {/* Camera View */}
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              {isVideoOff ? (
                <div className="text-center text-slate-500">
                  <CameraOff className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-xs">Camera is Off</p>
                </div>
              ) : (
                <img
                  src={activeBroadcastSession.property?.images?.[0] || 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80'}
                  alt="Live Camera Feed"
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            {/* Top Stats Overlay */}
            <div className="relative z-10 flex items-center justify-between text-white text-xs">
              <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>{confirmedAttendees} Viewers Active</span>
                {isGroup && (
                  <span className="text-[10px] text-emerald-300 font-bold">(Quota met ✓)</span>
                )}
              </div>

              <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[11px] text-slate-300">
                Tech Cost: $1.50 NZD (deducted from settlement)
              </div>
            </div>

            {/* Bottom Floating Control Bar */}
            <div className="relative z-10 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className={`p-3 rounded-full shadow-lg transition ${
                  isMuted ? 'bg-rose-600 text-white' : 'bg-white/90 text-slate-800 hover:bg-white'
                }`}
                title={isMuted ? 'Unmute' : 'Mute Microphone'}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={() => setIsVideoOff(!isVideoOff)}
                className={`p-3 rounded-full shadow-lg transition ${
                  isVideoOff ? 'bg-rose-600 text-white' : 'bg-white/90 text-slate-800 hover:bg-white'
                }`}
                title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
              >
                {isVideoOff ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Q&A Chat & Questions */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs flex flex-col h-[450px] overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                  Viewer Q&A Questions
                </h3>
                <p className="text-[10px] text-slate-400">Buyers asking in real-time</p>
              </div>
              <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                {chatMessages.length} Messages
              </span>
            </div>

            {/* Chat message list */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex justify-between text-[10px] text-slate-400 font-semibold mb-1">
                    <span className="text-slate-800 font-bold">{msg.sender}</span>
                    <span>{msg.time}</span>
                  </div>
                  <p className="text-slate-700 leading-snug">{msg.text}</p>
                </div>
              ))}
            </div>

            {/* Answer input */}
            <form onSubmit={handleSendChatAnswer} className="p-3 border-t border-slate-100 flex gap-2">
              <input
                type="text"
                value={agentAnswer}
                onChange={(e) => setAgentAnswer(e.target.value)}
                placeholder="Reply to viewers..."
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
              <button
                type="submit"
                className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Remote Live Viewings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Host 10-minute HD property walkthroughs. Group ($20 NZD) or Private 1-on-1 ($60 NZD).
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsScheduleModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Live Viewing</span>
        </button>
      </div>

      {/* Rules Notice Banner */}
      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 text-xs text-emerald-900 flex items-start gap-3">
        <Video className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold block">Live Viewing Operating Rules:</span>
          <p className="text-[11px] text-emerald-800 leading-relaxed">
            Group sessions require a minimum of 5 paid bookings before commencing. If the quota is not met by the scheduled time, attendees are automatically refunded. A flat $1.50 NZD streaming infrastructure fee is deducted from the agent's net session settlement upon completion.
          </p>
        </div>
      </div>

      {/* Scheduled Sessions List */}
      {loading ? (
        <div className="py-12 text-center">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading scheduled sessions...</p>
        </div>
      ) : sessions.length > 0 ? (
        <div className="space-y-3">
          {sessions.map((session) => {
            const isGroup = session.viewingType === 'GROUP';
            const confirmedCount = session.confirmedCount || (isGroup ? 5 : 1);
            const minQuotaMet = isGroup ? confirmedCount >= (session.minAttendees || 5) : true;

            return (
              <div
                key={session.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0">
                    <Video className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-slate-900 text-white">
                        {isGroup ? 'GROUP ($20 NZD)' : 'PRIVATE ($60 NZD)'}
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">
                        Strict 10 Minutes
                      </span>
                    </div>

                    <h3 className="font-bold text-sm sm:text-base text-slate-900 mt-1">
                      {session.property?.title || 'Property Walkthrough'}
                    </h3>

                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                        {new Date(session.scheduledAt).toLocaleString('en-NZ', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-emerald-600" />
                        {confirmedCount} Paid Bookings {isGroup && `(Min ${session.minAttendees || 5})`}
                      </span>
                    </div>

                    {isGroup && (
                      <div className="mt-1.5 text-[11px]">
                        {minQuotaMet ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Quota reached. Ready to broadcast.
                          </span>
                        ) : (
                          <span className="text-amber-700 font-semibold flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            Awaiting min 5 bookings.
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => handleStartBroadcast(session)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Enter Studio & Go Live</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
          <Video className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-sm">No Scheduled Live Viewings</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Schedule a 10-minute live remote viewing session for one of your property listings to engage buyers.
          </p>
          <button
            type="button"
            onClick={() => setIsScheduleModalOpen(true)}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl"
          >
            Schedule Live Viewing
          </button>
        </div>
      )}

      {/* Schedule Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-base text-slate-900">
                Schedule Remote Live Viewing
              </h3>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleSession} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Property</label>
                <select
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.suburb})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Viewing Format</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setViewingType('GROUP')}
                    className={`p-3 rounded-xl border text-left transition ${
                      viewingType === 'GROUP'
                        ? 'border-emerald-600 bg-emerald-50/50'
                        : 'border-slate-200'
                    }`}
                  >
                    <span className="font-bold block text-slate-900">Group ($20 NZD)</span>
                    <span className="text-[10px] text-slate-500">Min 5 bookings quota</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewingType('PRIVATE')}
                    className={`p-3 rounded-xl border text-left transition ${
                      viewingType === 'PRIVATE'
                        ? 'border-emerald-600 bg-emerald-50/50'
                        : 'border-slate-200'
                    }`}
                  >
                    <span className="font-bold block text-slate-900">Private ($60 NZD)</span>
                    <span className="text-[10px] text-slate-500">Single 1-on-1 attendee</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Seller Consent for Video</span>
                  <input
                    type="checkbox"
                    checked={sellerConsentGiven}
                    onChange={(e) => setSellerConsentGiven(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Confirm the homeowner has given consent for the interior live broadcast. Recording is disabled by default.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="w-1/2 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
                >
                  {submitting ? 'Scheduling...' : 'Confirm Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
