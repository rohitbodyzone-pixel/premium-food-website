import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Clock,
  AlertCircle,
  Calendar,
  CheckCircle,
  ShieldCheck,
  Zap,
  Wifi,
} from 'lucide-react';

import { PaidContinuationModal } from '../payment/PaidContinuationModal';
import { ConsultationReceiptModal } from '../payment/ConsultationReceiptModal';

export const ActiveCallModal: React.FC = () => {
  const {
    activeCall,
    timerState,
    freeExpiredPayload,
    consultationReceipt,
    setConsultationReceipt,
    extendCallPaid,
    endActiveCall,
    localStream,
    remoteStream,
    peerConnectionState,
    mediaError,
    isMuted,
    isVideoOff,
    toggleMute,
    toggleVideo,
  } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [confirmingPaid, setConfirmingPaid] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Attach local media stream
  useEffect(() => {
    try {
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream || null;
      }
    } catch (e) {
      console.warn('Error attaching localStream:', e);
    }
  }, [localStream, isVideoOff]);

  // Attach remote media stream
  useEffect(() => {
    try {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream || null;
      }
    } catch (e) {
      console.warn('Error attaching remoteVideo:', e);
    }
    try {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream || null;
      }
    } catch (e) {
      console.warn('Error attaching remoteAudio:', e);
    }
  }, [remoteStream]);

  if (!activeCall) {
    if (consultationReceipt) {
      return (
        <ConsultationReceiptModal
          receipt={consultationReceipt}
          onClose={() => setConsultationReceipt(null)}
        />
      );
    }
    return null;
  }

  const isVideo = activeCall.callType === 'VIDEO';
  const isConsumer = user?.role === 'CONSUMER';

  // Format seconds to mm:ss safely
  const formatTimer = (seconds: number | undefined | null) => {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const freeSecondsRemaining = timerState?.freeSecondsRemaining ?? 60;
  const isFreeExpired = (timerState?.isFreeExpired ?? false) || Boolean(freeExpiredPayload);
  const isExtendedPaid = timerState?.extendedPaid ?? false;

  // Handle strict media cutoff when free time expires (zero voice or video continuation)
  useEffect(() => {
    if (isFreeExpired && !isExtendedPaid) {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.muted = true;
        remoteAudioRef.current.pause();
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.pause();
      }
      if (localVideoRef.current) {
        localVideoRef.current.pause();
      }
    } else if (isExtendedPaid) {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.play().catch((err) => console.warn('Audio play resumed:', err));
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.play().catch((err) => console.warn('Video play resumed:', err));
      }
      if (localVideoRef.current) {
        localVideoRef.current.play().catch((err) => console.warn('Local video resumed:', err));
      }
    }
  }, [isFreeExpired, isExtendedPaid]);

  const handleBookAppointment = () => {
    endActiveCall();
    if (freeExpiredPayload?.expertId) {
      navigate(`/appointments?expertId=${freeExpiredPayload.expertId}`);
    } else {
      navigate('/appointments');
    }
  };

  const handleConfirmPaidExtension = async () => {
    setConfirmingPaid(true);
    await extendCallPaid();
    setConfirmingPaid(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md">
      {/* Hidden audio element to ensure remote audio playback across all browsers */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full h-[88vh] max-h-[640px] flex flex-col shadow-2xl relative overflow-hidden text-white">
        {/* Call Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-700/40 border border-emerald-500/50 flex items-center justify-center text-emerald-400 font-bold">
              PT
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold text-sm text-slate-100">
                <span>PropertyTalk Secure Consultation</span>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{isVideo ? 'HD WebRTC Video' : 'Encrypted WebRTC Audio'}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Wifi className="w-3 h-3 text-emerald-400" />
                  <span className="capitalize">{peerConnectionState === 'connected' ? 'P2P Connected' : peerConnectionState}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Prominent Server-Authoritative Timer Header */}
          <div className="flex items-center gap-2">
            {!isExtendedPaid ? (
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  freeSecondsRemaining <= 30
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>
                  FREE CONSULTATION {formatTimer(freeSecondsRemaining)} remaining
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold shadow-sm">
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>
                  PAID CONSULTATION • {timerState?.currencySymbol || '$'}{(Number(timerState?.ratePerMinute) || Number(freeExpiredPayload?.expertRatePerMinute) || 3.0).toFixed(2)}/min • {formatTimer(timerState?.paidSecondsElapsed ?? timerState?.totalElapsedSeconds ?? 0)} • Est: {timerState?.currencySymbol || '$'}{(Number(timerState?.estimatedCost) || 0).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Permission / Hardware Notice Banner if any */}
        {mediaError && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{mediaError}</span>
            </span>
          </div>
        )}

        {/* Call Media Stage */}
        <div className="flex-1 bg-slate-950 p-4 relative flex items-center justify-center overflow-hidden">
          {isVideo ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full h-full max-h-[380px]">
              {/* Remote Stream Tile (Expert or Consumer) */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-800 border border-slate-700/60 flex items-center justify-center group">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                {!remoteStream && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 text-slate-400">
                    <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center text-white text-xl font-bold mb-2 animate-pulse">
                      PT
                    </div>
                    <span className="text-xs font-medium">Waiting for remote video...</span>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>{isConsumer ? 'Property Professional' : 'Client'}</span>
                </div>
              </div>

              {/* Local Stream Tile */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-800 border border-slate-700/60 flex items-center justify-center">
                {!isVideoOff ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted // Prevent local mic loopback echo
                    className="w-full h-full object-cover mirror"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col items-center justify-center text-slate-400">
                    <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center text-white text-xl font-bold mb-2">
                      {user?.name ? user.name.charAt(0) : 'You'}
                    </div>
                    <span className="text-xs font-medium">Camera Muted</span>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded-lg text-xs font-semibold text-white border border-white/10">
                  You ({isMuted ? 'Muted' : 'Mic Active'})
                </div>
              </div>
            </div>
          ) : (
            /* Audio Call Stage */
            <div className="text-center py-8">
              <div className="relative inline-block mb-4">
                <div className="w-28 h-28 rounded-full bg-emerald-600/20 border-2 border-emerald-500/60 flex items-center justify-center animate-pulse">
                  <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center text-3xl font-extrabold text-white">
                    PT
                  </div>
                </div>
                {/* Audio wave ripples */}
                <div className="absolute inset-0 rounded-full border border-emerald-500/30 animate-ping pointer-events-none" />
              </div>
              <h4 className="text-lg font-bold text-slate-100">Live Voice Consultation</h4>
              <p className="text-xs text-slate-400 mt-1">
                {peerConnectionState === 'connected'
                  ? 'Realtime WebRTC voice connected'
                  : 'Establishing secure peer connection...'}
              </p>
            </div>
          )}

          {/* Paused indicator on media stage when free consultation expires */}
          {isFreeExpired && !isExtendedPaid && (
            <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center">
              <div className="px-3.5 py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-2 mb-2">
                <Clock className="w-3.5 h-3.5" />
                <span>Consultation Paused • Audio & Video Cut Off</span>
              </div>
              <p className="text-xs text-slate-400 max-w-xs">
                Zero audio or video transmission while awaiting continuation choice.
              </p>
            </div>
          )}
        </div>

        {/* Call Footer Controls */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-center gap-4">
          {/* Mute Button */}
          <button
            onClick={toggleMute}
            disabled={isFreeExpired && !isExtendedPaid}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed ${
              isMuted ? 'bg-red-600/20 text-red-400 border border-red-500/40' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* End Call Button */}
          <button
            onClick={endActiveCall}
            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg shadow-red-600/40 active:scale-95 transition"
            title="End Call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>

          {/* Video Toggle Button (if video call) */}
          {isVideo && (
            <button
              onClick={toggleVideo}
              disabled={isFreeExpired && !isExtendedPaid}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed ${
                isVideoOff ? 'bg-red-600/20 text-red-400 border border-red-500/40' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
              title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      {/* FREE TIME FINISHED OVERLAY MODAL (Server Authoritative) */}
      {freeExpiredPayload && !isExtendedPaid && (
        isConsumer ? (
          <PaidContinuationModal
            consultationId={activeCall.id}
            consultationType={activeCall.callType}
            expertName={freeExpiredPayload.expertName || 'Property Professional'}
            expertRatePerMinute={freeExpiredPayload.expertRatePerMinute || 2.50}
            currency={freeExpiredPayload.currency || 'NZD'}
            currencySymbol={freeExpiredPayload.currencySymbol || '$'}
            onConfirm={async (paymentMethodId) => {
              await extendCallPaid(paymentMethodId);
            }}
            onBookAppointment={handleBookAppointment}
            onEnd={endActiveCall}
          />
        ) : (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3 animate-pulse">
                <Clock className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-extrabold text-white">1 Minute Free Consultation Ended</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                The complimentary 1-minute period has completed. The consultation is currently <strong>paused</strong> with zero audio or video transmission while the customer decides whether to continue as a paid session.
              </p>
              <div className="mt-5 p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-400">
                Awaiting customer confirmation or conclusion...
              </div>
              <button
                onClick={endActiveCall}
                className="mt-4 w-full py-2.5 px-4 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 font-semibold text-xs border border-red-500/30 transition flex items-center justify-center gap-2"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Conclude Call (No Charge)</span>
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
};
