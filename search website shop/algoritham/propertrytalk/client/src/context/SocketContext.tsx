import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { CallSession } from '../types';
import { api } from '../services/api';
import { WebRTCManager } from '../services/webrtc';

interface IncomingCallPayload {
  callSessionId: string;
  chatId: string;
  callType: 'AUDIO' | 'VIDEO';
  consumerName: string;
  expertName: string;
  expertId: string;
}

interface CallTimerTick {
  callSessionId: string;
  freeSecondsRemaining: number;
  totalElapsedSeconds: number;
  isFreeExpired: boolean;
  extendedPaid: boolean;
  paidSecondsElapsed?: number;
  estimatedCost?: number;
  currency?: string;
  currencySymbol?: string;
  ratePerMinute?: number;
}

interface FreeTimeExpiredPayload {
  callSessionId?: string;
  chatId?: string;
  message: string;
  expertRatePerMinute: number;
  expertHourlyRate: number;
  expertId: string;
  expertName: string;
  currency?: string;
  currencySymbol?: string;
}

export interface ChatTimerState {
  chatId: string;
  freeSecondsRemaining: number;
  totalElapsedSeconds?: number;
  isFreeExpired: boolean;
  extendedPaid: boolean;
  paidSecondsElapsed?: number;
  estimatedCost?: number;
  currency?: string;
  currencySymbol?: string;
  ratePerMinute?: number;
}

export interface ConsultationReceipt {
  receiptNumber: string;
  consultationType: string;
  expertName: string;
  freeDurationSeconds: number;
  paidDurationSeconds: number;
  ratePerMinute: number;
  grossAmount: number;
  currency: string;
  currencySymbol: string;
  date: string;
  status: string;
}

export interface IncomingChatRequest {
  chatId: string;
  consumerId: string;
  consumerName: string;
  initialMessage: string | null;
  requestedAt: string;
  expertId: string;
  expertName: string;
}

interface SocketContextType {
  socket: Socket | null;
  incomingCall: IncomingCallPayload | null;
  incomingChat: IncomingChatRequest | null;
  activeCall: CallSession | null;
  timerState: CallTimerTick | null;
  freeExpiredPayload: FreeTimeExpiredPayload | null;
  chatTimerState: ChatTimerState | null;
  chatFreeExpiredPayload: FreeTimeExpiredPayload | null;
  consultationReceipt: ConsultationReceipt | null;
  setConsultationReceipt: (r: ConsultationReceipt | null) => void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerConnectionState: RTCPeerConnectionState | 'idle';
  mediaError: string | null;
  isMuted: boolean;
  isVideoOff: boolean;
  toggleMute: () => void;
  toggleVideo: () => void;
  acceptIncomingCall: () => Promise<void>;
  declineIncomingCall: () => Promise<void>;
  acceptChat: (chatId: string) => Promise<any>;
  declineChat: (chatId: string, reason?: string) => Promise<void>;
  dismissIncomingChat: () => void;
  startCallRequest: (chatId: string, callType: 'AUDIO' | 'VIDEO') => Promise<CallSession>;
  extendCallPaid: (paymentMethodId?: string) => Promise<void>;
  extendChatPaid: (chatId: string, paymentMethodId?: string) => Promise<void>;
  endActiveCall: () => Promise<void>;
  dismissFreeExpiredPrompt: () => void;
  dismissChatFreeExpiredPrompt: () => void;
  reviewPendingExpertId: string | null;
  setReviewPendingExpertId: (id: string | null) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

// Web Audio synthesizer for incoming/outgoing phone chimes
function playTone(freq = 440, duration = 0.5, type: OscillatorType = 'sine') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio context may be restricted before user interaction
  }
}

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null);
  const [incomingChat, setIncomingChat] = useState<IncomingChatRequest | null>(null);
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [timerState, setTimerState] = useState<CallTimerTick | null>(null);
  const [freeExpiredPayload, setFreeExpiredPayload] = useState<FreeTimeExpiredPayload | null>(null);
  const [reviewPendingExpertId, setReviewPendingExpertId] = useState<string | null>(null);

  const [chatTimerState, setChatTimerState] = useState<ChatTimerState | null>(null);
  const [chatFreeExpiredPayload, setChatFreeExpiredPayload] = useState<FreeTimeExpiredPayload | null>(null);
  const [consultationReceipt, setConsultationReceipt] = useState<ConsultationReceipt | null>(null);

  // WebRTC State
  const webrtcManagerRef = useRef<WebRTCManager>(new WebRTCManager());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnectionState, setPeerConnectionState] = useState<RTCPeerConnectionState | 'idle'>('idle');
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);

  const incomingRingInterval = useRef<NodeJS.Timeout | null>(null);

  const cleanupMedia = () => {
    webrtcManagerRef.current.close();
    setLocalStream(null);
    setRemoteStream(null);
    setPeerConnectionState('idle');
    setMediaError(null);
    setIsMuted(false);
    setIsVideoOff(false);
  };

  useEffect(() => {
    const socketInstance = io(window.location.origin, {
      auth: { token: token || undefined },
      transports: ['websocket', 'polling'],
    });

    socketInstance.on('connect', () => {
      console.log('📡 Connected to PropertyTalk realtime gateway');
    });

    // Incoming Consultation Call for Expert
    socketInstance.on('call:incoming', (data: IncomingCallPayload) => {
      console.log('📞 Incoming call request received:', data);
      setIncomingCall(data);

      // Play periodic incoming chime
      playTone(587.33, 0.4); // D5
      if (incomingRingInterval.current) clearInterval(incomingRingInterval.current);
      incomingRingInterval.current = setInterval(() => {
        playTone(587.33, 0.3);
        setTimeout(() => playTone(880, 0.4), 300);
      }, 2500);
    });

    // Incoming Consultation Chat Request for Expert
    socketInstance.on('chat:incoming_request', (data: IncomingChatRequest) => {
      console.log('💬 Incoming chat request received:', data);
      setIncomingChat(data);
      playTone(523.25, 0.4); // C5
    });

    // Chat Request Cancelled by Customer
    socketInstance.on('chat:cancelled', (data: { chatId: string }) => {
      console.log('🚫 Chat request cancelled by customer:', data);
      setIncomingChat((prev) => (prev?.chatId === data.chatId ? null : prev));
    });

    // Call Accepted by Expert (Consumer receives this)
    socketInstance.on('call:accepted', async (data: { callSessionId: string; providerSession: any }) => {
      console.log('✅ Call accepted by expert. Starting WebRTC negotiation:', data);
      socketInstance.emit('call:join', data.callSessionId);

      setActiveCall((prev) =>
        prev ? { ...prev, status: 'IN_PROGRESS', providerSession: data.providerSession } : null
      );

      try {
        // Initialize WebRTC as Caller / Offer Creator
        const stream = await webrtcManagerRef.current.initialize({
          callType: activeCall?.callType || 'AUDIO',
          iceServers: data.providerSession?.iceServers,
          onIceCandidate: (candidate) => {
            socketInstance.emit('call:signal', {
              callSessionId: data.callSessionId,
              signal: { type: 'candidate', candidate },
            });
          },
          onRemoteStream: (remStream) => {
            console.log('🎥 Remote media stream connected');
            setRemoteStream(remStream);
          },
          onConnectionStateChange: async (state) => {
            console.log('📶 WebRTC peer connection state:', state);
            setPeerConnectionState(state);
            if (state === 'connected') {
              try {
                await api.post(`/calls/${data.callSessionId}/connect`);
              } catch (e) {
                console.warn('Connect trigger handled:', e);
              }
            }
          },
          onError: (err) => {
            console.warn('WebRTC media notice:', err.message);
            setMediaError(err.message);
          },
        });

        setLocalStream(stream);

        // Create WebRTC Offer and transmit via signalling
        const offer = await webrtcManagerRef.current.createOffer();
        socketInstance.emit('call:signal', {
          callSessionId: data.callSessionId,
          signal: { type: 'offer', sdp: offer },
        });
      } catch (err: any) {
        console.error('Failed to initialize WebRTC on call acceptance:', err);
        setMediaError(err.message || 'Media stream error');
      }
    });

    // Handle Peer WebRTC Signalling (Offer, Answer, ICE Candidates)
    socketInstance.on('call:signal', async (data: { callSessionId: string; signal: any; from: string }) => {
      const { signal, callSessionId } = data;
      if (!signal) return;

      try {
        if (signal.type === 'offer') {
          console.log('📥 Received WebRTC Offer, creating Answer...');
          const answer = await webrtcManagerRef.current.handleOffer(signal.sdp);
          socketInstance.emit('call:signal', {
            callSessionId,
            signal: { type: 'answer', sdp: answer },
          });
        } else if (signal.type === 'answer') {
          console.log('📥 Received WebRTC Answer, completing handshake...');
          await webrtcManagerRef.current.handleAnswer(signal.sdp);
        } else if (signal.type === 'candidate' && signal.candidate) {
          await webrtcManagerRef.current.addIceCandidate(signal.candidate);
        }
      } catch (signalErr) {
        console.error('Error handling incoming WebRTC signal:', signalErr);
      }
    });

    // Call Declined
    socketInstance.on('call:declined', (data: { callSessionId: string; reason: string }) => {
      alert(`Call declined: ${data.reason}`);
      cleanupMedia();
      setActiveCall(null);
    });

    // Server-Authoritative call timer tick (1 minute default)
    socketInstance.on('call:timer_tick', (tick: CallTimerTick) => {
      setTimerState(tick);
    });

    // Free 1-minute consultation call expired event from server
    socketInstance.on('call:free_time_expired', (payload: FreeTimeExpiredPayload) => {
      console.log('⏰ Free consultation call expired:', payload);
      setFreeExpiredPayload(payload);
      playTone(330, 0.6, 'triangle');
    });

    // Server-Authoritative chat timer tick (1 minute default)
    socketInstance.on('chat:timer_tick', (tick: ChatTimerState) => {
      setChatTimerState(tick);
    });

    // Free 1-minute consultation chat expired event from server
    socketInstance.on('chat:free_time_expired', (payload: FreeTimeExpiredPayload) => {
      console.log('⏰ Free consultation chat expired:', payload);
      setChatFreeExpiredPayload(payload);
      playTone(330, 0.6, 'triangle');
    });

    // Paid continuation confirmed for chat
    socketInstance.on('chat:paid_continuation_activated', () => {
      setChatTimerState((prev) => (prev ? { ...prev, extendedPaid: true, isFreeExpired: false } : null));
      setChatFreeExpiredPayload(null);
    });

    // Call Ended
    socketInstance.on('call:ended', (data: { callSessionId: string; durationSeconds: number; promptReview?: boolean; expertId?: string; receipt?: any }) => {
      cleanupMedia();
      setActiveCall(null);
      setTimerState(null);
      setFreeExpiredPayload(null);
      if (data.receipt) {
        setConsultationReceipt(data.receipt);
      }
      if (data.promptReview && data.expertId && user?.role === 'CONSUMER') {
        setReviewPendingExpertId(data.expertId);
      }
    });

    // Chat Ended
    socketInstance.on('chat:ended', (data: { chatId: string; receipt?: any }) => {
      setChatTimerState(null);
      setChatFreeExpiredPayload(null);
      if (data.receipt) {
        setConsultationReceipt(data.receipt);
      }
    });

    setSocket(socketInstance);

    return () => {
      if (incomingRingInterval.current) clearInterval(incomingRingInterval.current);
      cleanupMedia();
      socketInstance.disconnect();
    };
  }, [token]);

  const acceptIncomingCall = async () => {
    if (!incomingCall) return;
    if (incomingRingInterval.current) clearInterval(incomingRingInterval.current);

    try {
      const res = await api.post<CallSession>(`/calls/${incomingCall.callSessionId}/respond`, {
        action: 'ACCEPT',
      });

      if (socket) {
        socket.emit('call:join', incomingCall.callSessionId);
      }

      setActiveCall(res);

      // Initialize WebRTC as Call Recipient / Answerer
      try {
        const stream = await webrtcManagerRef.current.initialize({
          callType: incomingCall.callType,
          iceServers: res.providerSession?.iceServers,
          onIceCandidate: (candidate) => {
            if (socket) {
              socket.emit('call:signal', {
                callSessionId: incomingCall.callSessionId,
                signal: { type: 'candidate', candidate },
              });
            }
          },
          onRemoteStream: (remStream) => {
            console.log('🎥 Remote media stream connected for Expert');
            setRemoteStream(remStream);
          },
          onConnectionStateChange: async (state) => {
            console.log('📶 Expert WebRTC peer connection state:', state);
            setPeerConnectionState(state);
            if (state === 'connected') {
              try {
                await api.post(`/calls/${incomingCall.callSessionId}/connect`);
              } catch (e) {
                console.warn('Connect trigger handled:', e);
              }
            }
          },
          onError: (err) => {
            console.warn('WebRTC media notice:', err.message);
            setMediaError(err.message);
          },
        });

        setLocalStream(stream);
      } catch (mediaErr: any) {
        console.error('Expert media initialization warning:', mediaErr);
        setMediaError(mediaErr.message || 'Media acquisition failed');
      }

      setIncomingCall(null);
    } catch (err: any) {
      alert(err.message || 'Failed to accept call');
      setIncomingCall(null);
    }
  };

  const declineIncomingCall = async () => {
    if (!incomingCall) return;
    if (incomingRingInterval.current) clearInterval(incomingRingInterval.current);

    try {
      await api.post(`/calls/${incomingCall.callSessionId}/respond`, {
        action: 'DECLINE',
      });
    } catch (e) {
      console.error(e);
    } finally {
      cleanupMedia();
      setIncomingCall(null);
    }
  };

  const acceptChat = async (chatId: string) => {
    try {
      const res = await api.post<any>(`/chats/${chatId}/accept`);
      setIncomingChat(null);
      return res;
    } catch (err: any) {
      alert(err.message || 'Failed to accept chat request');
      throw err;
    }
  };

  const declineChat = async (chatId: string, reason?: string) => {
    try {
      await api.post(`/chats/${chatId}/decline`, { reason });
      setIncomingChat(null);
    } catch (err: any) {
      alert(err.message || 'Failed to decline chat request');
    }
  };

  const dismissIncomingChat = () => {
    setIncomingChat(null);
  };

  const startCallRequest = async (chatId: string, callType: 'AUDIO' | 'VIDEO'): Promise<CallSession> => {
    const session = await api.post<CallSession>('/calls/request', { chatId, callType });
    setActiveCall(session);

    if (socket) {
      socket.emit('call:join', session.id);
    }

    // Play ringing tone
    playTone(440, 0.8);
    return session;
  };

  const extendCallPaid = async (paymentMethodId?: string) => {
    if (!activeCall) return;
    try {
      await api.post(`/payments/consultations/${activeCall.id}/confirm-paid`, {
        type: activeCall.callType,
        paymentMethodId,
      });
      if (socket) {
        socket.emit('call:extend_paid', { callSessionId: activeCall.id, paymentMethodId });
      }
      setFreeExpiredPayload(null);
    } catch (err: any) {
      alert(err.message || 'Failed to extend call');
    }
  };

  const extendChatPaid = async (chatId: string, paymentMethodId?: string) => {
    try {
      await api.post(`/payments/consultations/${chatId}/confirm-paid`, {
        type: 'CHAT',
        paymentMethodId,
      });
      if (socket) {
        socket.emit('chat:extend_paid', { chatId, paymentMethodId });
      }
      setChatFreeExpiredPayload(null);
      setChatTimerState((prev) => (prev ? { ...prev, extendedPaid: true, isFreeExpired: false } : null));
    } catch (err: any) {
      alert(err.message || 'Failed to extend chat');
    }
  };

  const endActiveCall = async () => {
    if (!activeCall) return;
    try {
      const res = await api.post<any>(`/calls/${activeCall.id}/end`);
      if (res && res.receipt) {
        setConsultationReceipt(res.receipt);
      }
    } catch (err) {
      console.error(err);
    } finally {
      const expertId = activeCall.expertId;
      cleanupMedia();
      setActiveCall(null);
      setTimerState(null);
      setFreeExpiredPayload(null);
      if (user?.role === 'CONSUMER') {
        setReviewPendingExpertId(expertId);
      }
    }
  };

  const toggleMute = () => {
    const nextState = !isMuted;
    webrtcManagerRef.current.toggleAudio(!nextState);
    setIsMuted(nextState);
  };

  const toggleVideo = () => {
    const nextState = !isVideoOff;
    webrtcManagerRef.current.toggleVideo(!nextState);
    setIsVideoOff(nextState);
  };

  const dismissFreeExpiredPrompt = () => {
    setFreeExpiredPayload(null);
  };

  const dismissChatFreeExpiredPrompt = () => {
    setChatFreeExpiredPayload(null);
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        incomingCall,
        incomingChat,
        activeCall,
        timerState,
        freeExpiredPayload,
        chatTimerState,
        chatFreeExpiredPayload,
        consultationReceipt,
        setConsultationReceipt,
        localStream,
        remoteStream,
        peerConnectionState,
        mediaError,
        isMuted,
        isVideoOff,
        toggleMute,
        toggleVideo,
        acceptIncomingCall,
        declineIncomingCall,
        acceptChat,
        declineChat,
        dismissIncomingChat,
        startCallRequest,
        extendCallPaid,
        extendChatPaid,
        endActiveCall,
        dismissFreeExpiredPrompt,
        dismissChatFreeExpiredPrompt,
        reviewPendingExpertId,
        setReviewPendingExpertId,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within a SocketProvider');
  return context;
};
