import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ConsultationChat, ChatMessage } from '../types';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../services/api';
import {
  PhoneCall,
  Video,
  Send,
  ShieldCheck,
  Radio,
  Clock,
  ChevronLeft,
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  Zap,
} from 'lucide-react';

import { PaidContinuationModal } from '../components/payment/PaidContinuationModal';
import { ConsultationReceiptModal } from '../components/payment/ConsultationReceiptModal';

export const ChatPage: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const { user } = useAuth();
  const {
    socket,
    startCallRequest,
    activeCall,
    acceptChat,
    declineChat,
    chatTimerState,
    chatFreeExpiredPayload,
    consultationReceipt,
    setConsultationReceipt,
    extendChatPaid,
    dismissChatFreeExpiredPrompt,
  } = useSocket();
  const navigate = useNavigate();

  const [chat, setChat] = useState<ConsultationChat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requestingCall, setRequestingCall] = useState(false);
  const [extendingChat, setExtendingChat] = useState(false);
  const [respondingChat, setRespondingChat] = useState(false);
  const [cancellingChat, setCancellingChat] = useState(false);

  // Local fallback timer initialized from chat data
  const [localSeconds, setLocalSeconds] = useState<number>(60);
  const [localExpired, setLocalExpired] = useState<boolean>(false);
  const [localPaid, setLocalPaid] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Format seconds to mm:ss
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Load chat and history
  useEffect(() => {
    if (!chatId) return;
    setLoading(true);

    api.get<any>(`/chats/${chatId}`)
      .then((data) => {
        setChat(data);
        setMessages(data.messages || []);
        if (data.timerState) {
          setLocalSeconds(data.timerState.freeSecondsRemaining ?? 60);
          setLocalExpired(data.timerState.isFreeExpired ?? false);
          setLocalPaid(data.timerState.extendedPaid ?? false);
        }
      })
      .catch((err) => {
        console.error('Failed to load chat:', err);
      })
      .finally(() => setLoading(false));
  }, [chatId]);

  // Join chat socket room and listen for real-time messages & lifecycle transitions
  useEffect(() => {
    if (!socket || !chatId) return;

    socket.emit('chat:join', chatId);

    const handleNewMessage = (msg: ChatMessage) => {
      if (msg.chatId === chatId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
      }
    };

    const handleChatAccepted = (payload: any) => {
      if (payload.chatId === chatId) {
        setChat((prev) =>
          prev
            ? {
                ...prev,
                status: 'CONNECTED',
                acceptedAt: payload.acceptedAt,
                connectedAt: payload.connectedAt,
                freeStartedAt: payload.freeStartedAt,
              }
            : null
        );
        if (payload.timerState) {
          setLocalSeconds(payload.timerState.freeSecondsRemaining ?? 60);
          setLocalExpired(payload.timerState.isFreeExpired ?? false);
          setLocalPaid(payload.timerState.extendedPaid ?? false);
        }
      }
    };

    const handleChatDeclined = (payload: any) => {
      if (payload.chatId === chatId) {
        setChat((prev) =>
          prev
            ? {
                ...prev,
                status: 'DECLINED',
                declineReason: payload.reason,
                declinedAt: new Date().toISOString(),
              }
            : null
        );
      }
    };

    const handleChatCancelled = (payload: any) => {
      if (payload.chatId === chatId) {
        setChat((prev) =>
          prev
            ? {
                ...prev,
                status: 'CANCELLED',
              }
            : null
        );
      }
    };

    const handleChatTimeout = (payload: any) => {
      if (payload.chatId === chatId) {
        setChat((prev) =>
          prev
            ? {
                ...prev,
                status: 'MISSED',
              }
            : null
        );
      }
    };

    const handleChatEnded = (payload: any) => {
      if (payload.chatId === chatId) {
        setChat((prev) =>
          prev
            ? {
                ...prev,
                status: 'ENDED',
                endedAt: new Date().toISOString(),
              }
            : null
        );
        if (payload.receipt) {
          setConsultationReceipt(payload.receipt);
        }
      }
    };

    socket.on('chat:message', handleNewMessage);
    socket.on('chat:accepted', handleChatAccepted);
    socket.on('chat:connected', handleChatAccepted);
    socket.on('chat:declined', handleChatDeclined);
    socket.on('chat:cancelled', handleChatCancelled);
    socket.on('chat:request_timeout', handleChatTimeout);
    socket.on('chat:ended', handleChatEnded);

    return () => {
      socket.emit('chat:leave', chatId);
      socket.off('chat:message', handleNewMessage);
      socket.off('chat:accepted', handleChatAccepted);
      socket.off('chat:connected', handleChatAccepted);
      socket.off('chat:declined', handleChatDeclined);
      socket.off('chat:cancelled', handleChatCancelled);
      socket.off('chat:request_timeout', handleChatTimeout);
      socket.off('chat:ended', handleChatEnded);
    };
  }, [socket, chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Sync timer state from socket
  const effectiveSeconds =
    chatTimerState && chatTimerState.chatId === chatId
      ? chatTimerState.freeSecondsRemaining
      : localSeconds;

  const isFreeExpired =
    (chatTimerState && chatTimerState.chatId === chatId
      ? chatTimerState.isFreeExpired
      : localExpired) || Boolean(chatFreeExpiredPayload);

  const extendedPaid =
    chatTimerState && chatTimerState.chatId === chatId
      ? chatTimerState.extendedPaid
      : localPaid;

  const isConsumer = user?.role === 'CONSUMER';
  const isRequested = chat?.status === 'REQUESTED';
  const isDeclined = chat?.status === 'DECLINED';
  const isMissed = chat?.status === 'MISSED';
  const isCancelled = chat?.status === 'CANCELLED';
  const isEnded = chat?.status === 'ENDED';
  const isTerminal = isDeclined || isMissed || isCancelled || isEnded;
  const isConnected = !isRequested && !isTerminal;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId) return;

    if (isRequested) {
      alert('Please wait for the expert to accept your consultation request.');
      return;
    }

    if (isFreeExpired && !extendedPaid && isConsumer) {
      alert('Your free introductory minute has concluded. Please select an option to continue.');
      return;
    }

    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');

    try {
      if (socket && socket.connected) {
        socket.emit('chat:message', { chatId, content });
      } else {
        const saved = await api.post<ChatMessage>(`/chats/${chatId}/messages`, { content });
        setMessages((prev) => [...prev, saved]);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
      scrollToBottom();
    }
  };

  const handleStartCall = async (type: 'AUDIO' | 'VIDEO') => {
    if (!chatId || requestingCall || !isConnected) return;
    setRequestingCall(true);

    try {
      await startCallRequest(chatId, type);
    } catch (err: any) {
      alert(err.message || 'Failed to initiate consultation call');
    } finally {
      setRequestingCall(false);
    }
  };

  const handleConfirmPaidChat = async () => {
    if (!chatId) return;
    setExtendingChat(true);
    try {
      await extendChatPaid(chatId);
      setLocalPaid(true);
      setLocalExpired(false);
    } catch (e) {
      console.error(e);
    } finally {
      setExtendingChat(false);
    }
  };

  const handleAcceptChatAction = async () => {
    if (!chatId || respondingChat) return;
    setRespondingChat(true);
    try {
      const res = await acceptChat(chatId);
      if (res?.chat) {
        setChat(res.chat);
      } else {
        setChat((prev) => (prev ? { ...prev, status: 'CONNECTED', acceptedAt: new Date().toISOString() } : null));
      }
      if (res?.timerState) {
        setLocalSeconds(res.timerState.freeSecondsRemaining ?? 60);
        setLocalExpired(res.timerState.isFreeExpired ?? false);
        setLocalPaid(res.timerState.extendedPaid ?? false);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to accept consultation');
    } finally {
      setRespondingChat(false);
    }
  };

  const handleDeclineChatAction = async (reason?: string) => {
    if (!chatId || respondingChat) return;
    setRespondingChat(true);
    try {
      await declineChat(chatId, reason);
      setChat((prev) => (prev ? { ...prev, status: 'DECLINED', declineReason: reason } : null));
    } catch (err: any) {
      alert(err.message || 'Failed to decline consultation');
    } finally {
      setRespondingChat(false);
    }
  };

  const handleCancelRequestAction = async () => {
    if (!chatId || cancellingChat) return;
    setCancellingChat(true);
    try {
      await api.post(`/chats/${chatId}/cancel`);
      setChat((prev) => (prev ? { ...prev, status: 'CANCELLED' } : null));
    } catch (err: any) {
      alert(err.message || 'Failed to cancel consultation request');
    } finally {
      setCancellingChat(false);
    }
  };

  const handleEndChatAction = async () => {
    if (!chatId) return;
    if (!window.confirm('Are you sure you want to end this consultation?')) return;
    try {
      const res = await api.post<any>(`/chats/${chatId}/end`);
      setChat((prev) => (prev ? { ...prev, status: 'ENDED', endedAt: new Date().toISOString() } : null));
      if (res.receipt) {
        setConsultationReceipt(res.receipt);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to end consultation');
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl p-6 border border-slate-200 h-[70vh] animate-pulse" />
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-slate-800">Chat conversation not found</h2>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs"
        >
          Return Home
        </button>
      </div>
    );
  }

  const partnerName = isConsumer ? chat.expert?.user?.name || 'Property Expert' : chat.consumer?.name || 'Customer';
  const partnerPhoto = isConsumer
    ? chat.expert?.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80'
    : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80';

  const currencyCode = chat.expert?.countryCode === 'AU' ? 'AUD' : 'NZD';
  const expertRate = chat.expert?.callPerMinuteRate || 2.50;

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-4 py-4 pb-20 sm:pb-8 flex flex-col h-[calc(100vh-5rem)] relative">
      {/* Consultation Chat Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs flex items-center justify-between gap-3 mb-2 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition shrink-0"
            title="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="relative shrink-0">
            <img
              src={partnerPhoto}
              alt={partnerName}
              className="w-11 h-11 rounded-full object-cover border border-slate-100"
            />
            {isConsumer && chat.expert && (
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                  chat.expert.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
                title={chat.expert.isOnline ? 'Online' : 'Offline'}
              />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="font-bold text-sm sm:text-base text-slate-900 truncate">
                {partnerName}
              </h2>
              {isConsumer && (
                <span title="Verified Professional">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              {isConsumer && chat.expert ? (
                <>
                  <span className="truncate">{chat.expert.category?.name}</span>
                  <span>•</span>
                  <span className={chat.expert.isOnline ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>
                    {chat.expert.isOnline ? 'Online Now' : 'Offline'}
                  </span>
                </>
              ) : (
                <span>Private Consultation</span>
              )}
            </div>
          </div>
        </div>

        {/* Header Right: State Badge, Timers, Call Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {isConsumer && (
            <>
              {isRequested && (
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300"
                  title="Your 1-minute free consultation begins once accepted"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                  <span>WAITING FOR EXPERT</span>
                </div>
              )}

              {isConnected && !extendedPaid && (
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                    effectiveSeconds <= 15
                      ? 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}
                  title="Server-authoritative introductory free chat countdown"
                >
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>FREE CHAT {formatTimer(effectiveSeconds)}</span>
                </div>
              )}

              {isConnected && extendedPaid && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
                  <span>
                    PAID CHAT • {currencyCode === 'AUD' ? 'A$' : 'NZ$'}{(chatTimerState?.ratePerMinute || (chat.expert?.chatRateMinorUnits ? chat.expert.chatRateMinorUnits / 100 : expertRate)).toFixed(2)}/min • {formatTimer(chatTimerState?.paidSecondsElapsed || 0)}
                  </span>
                </div>
              )}

              {isTerminal && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
                  <span>{chat.status}</span>
                </div>
              )}

              <button
                onClick={() => handleStartCall('AUDIO')}
                disabled={requestingCall || !!activeCall || !isConnected}
                className="px-2.5 sm:px-3 py-2 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                title={isConnected ? 'Start Audio Call (First 1 min FREE)' : 'Call available once consultation connects'}
              >
                <PhoneCall className="w-4 h-4 text-emerald-600" />
                <span className="hidden sm:inline">Audio</span>
              </button>

              <button
                onClick={() => handleStartCall('VIDEO')}
                disabled={requestingCall || !!activeCall || !isConnected}
                className="px-2.5 sm:px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                title={isConnected ? 'Start Video Call (First 1 min FREE)' : 'Call available once consultation connects'}
              >
                <Video className="w-4 h-4" />
                <span className="hidden sm:inline">Video</span>
              </button>
            </>
          )}

          {!isConsumer && (
            <div className="flex items-center gap-2">
              {isRequested && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                  <Radio className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                  <span>NEW REQUEST</span>
                </div>
              )}

              {isConnected && !extendedPaid && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>FREE {formatTimer(effectiveSeconds)}</span>
                </div>
              )}

              {isConnected && extendedPaid && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
                  <span>PAID ACTIVE</span>
                </div>
              )}

              {isConnected && (
                <button
                  onClick={handleEndChatAction}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-xs font-bold border border-slate-200 transition"
                  title="Conclude consultation"
                >
                  End Chat
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Customer Status Banner: Waiting for Expert Acceptance */}
      {isConsumer && isRequested && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 sm:p-5 mb-2 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 animate-pulse">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Waiting for {partnerName} to accept your request...
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Your consultation request has been sent to the expert. Your introductory <strong>1-minute free consultation</strong> will start the moment they accept.
              </p>
            </div>
          </div>
          <button
            onClick={handleCancelRequestAction}
            disabled={cancellingChat}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition shrink-0 disabled:opacity-50"
          >
            {cancellingChat ? 'Cancelling...' : 'Cancel Request'}
          </button>
        </div>
      )}

      {/* Expert Status Banner: Incoming Request with Accept/Decline */}
      {!isConsumer && isRequested && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 sm:p-5 mb-2 shrink-0 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  Incoming Consultation Request
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-1">
                {partnerName} requested an instant consultation
              </h3>
              {chat.initialMessage && (
                <p className="text-xs text-slate-700 mt-1.5 bg-white/80 p-2.5 rounded-xl border border-emerald-100 italic">
                  "{chat.initialMessage}"
                </p>
              )}
              <p className="text-[11px] text-slate-500 mt-1">
                Accepting will connect the consultation and start the customer's 1-minute free introductory period.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleAcceptChatAction}
                disabled={respondingChat}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{respondingChat ? 'Connecting...' : 'Accept Request'}</span>
              </button>
              <button
                onClick={() => handleDeclineChatAction('Expert currently unavailable')}
                disabled={respondingChat}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                <span>Decline</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminal State: Declined Banner */}
      {isDeclined && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-center space-y-2 mb-2 shrink-0">
          <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <XCircle className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Consultation Request Declined</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            {chat.declineReason || 'The expert is currently unavailable to accept this consultation.'}
          </p>
          {isConsumer && (
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={() => navigate('/browse')}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition"
              >
                Browse Other Experts
              </button>
              {chat.expert && (
                <button
                  onClick={() => navigate(`/appointments?expertId=${chat.expert.id}`)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                >
                  Book Appointment
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Terminal State: Missed/Timeout Banner */}
      {isMissed && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center space-y-2 mb-2 shrink-0">
          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Request Timed Out</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            The expert did not respond to the consultation request within the time limit.
          </p>
          {isConsumer && (
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={() => navigate('/browse')}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition"
              >
                Browse Other Experts
              </button>
              {chat.expert && (
                <button
                  onClick={() => navigate(`/appointments?expertId=${chat.expert.id}`)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                >
                  Book Appointment
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Terminal State: Cancelled Banner */}
      {isCancelled && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-center mb-2 shrink-0">
          <p className="text-xs font-bold text-slate-700">This consultation request was cancelled.</p>
        </div>
      )}

      {/* Terminal State: Ended Banner */}
      {isEnded && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center text-xs text-slate-600 mb-2 shrink-0 flex items-center justify-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>This consultation has concluded.</span>
        </div>
      )}

      {/* Active Connected State Guidance Banner */}
      {isConnected && (
        <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-xl px-3.5 py-2 text-xs text-emerald-900 flex items-center justify-between gap-2 mb-2 shrink-0">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>First 1 Minute FREE.</strong> Applies to Chat, Audio, and Video. No automatic charges.
            </span>
          </div>

          {isConsumer && chat.expert && (
            <button
              onClick={() => navigate(`/appointments?expertId=${chat.expert.id}`)}
              className="text-[11px] font-bold text-emerald-700 underline hover:text-emerald-900 shrink-0"
            >
              Book Appointment
            </button>
          )}
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-4 overflow-y-auto space-y-3 shadow-xs relative">
        {messages.map((msg) => {
          const isMe = msg.senderId === user?.id;

          if (msg.isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <div className="bg-slate-100 text-slate-600 text-[11px] px-3.5 py-2 rounded-xl max-w-md text-center border border-slate-200/60 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{msg.content}</span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] sm:max-w-md rounded-2xl px-4 py-2.5 text-sm shadow-xs ${
                  isMe
                    ? 'bg-emerald-600 text-white rounded-tr-xs'
                    : 'bg-slate-100 text-slate-900 rounded-tl-xs'
                }`}
              >
                <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                <span
                  className={`block text-[10px] text-right mt-1 ${
                    isMe ? 'text-emerald-200' : 'text-slate-400'
                  }`}
                >
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />

        {/* 1-MINUTE FREE CHAT CONCLUDED OVERLAY MODAL */}
        {isFreeExpired && !extendedPaid && isConsumer && isConnected && (
          <PaidContinuationModal
            consultationId={chatId || chat.id}
            consultationType="CHAT"
            expertName={partnerName}
            expertRatePerMinute={chat.expert?.chatRateMinorUnits ? chat.expert.chatRateMinorUnits / 100 : expertRate}
            currency={currencyCode}
            currencySymbol={currencyCode === 'AUD' ? 'A$' : 'NZ$'}
            onConfirm={async (paymentMethodId) => {
              if (chatId) {
                await extendChatPaid(chatId, paymentMethodId);
                setLocalPaid(true);
                setLocalExpired(false);
              }
            }}
            onBookAppointment={() => {
              if (chat.expert) navigate(`/appointments?expertId=${chat.expert.id}`);
            }}
            onEnd={() => navigate('/chats')}
          />
        )}
      </div>

      {/* Message Composer / Status Indicator */}
      {isRequested ? (
        <div className="mt-2 p-3 bg-amber-50/90 border border-amber-200 rounded-2xl text-center text-xs text-amber-800 font-medium shrink-0">
          {isConsumer
            ? 'Waiting for expert to accept before sending more messages.'
            : 'Accept the consultation request above to reply to this customer.'}
        </div>
      ) : isTerminal ? (
        <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-500 font-medium shrink-0">
          This consultation is concluded.
        </div>
      ) : (
        <form
          onSubmit={handleSendMessage}
          className="mt-2 flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs shrink-0"
        >
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={isFreeExpired && !extendedPaid && isConsumer}
            placeholder={
              isFreeExpired && !extendedPaid && isConsumer
                ? 'Free introductory minute ended. Select an option above to continue.'
                : 'Ask a question or discuss consultation details...'
            }
            className="flex-1 px-3 py-2 text-sm bg-transparent outline-hidden text-slate-900 placeholder:text-slate-400 disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={sending || !newMessage.trim() || (isFreeExpired && !extendedPaid && isConsumer)}
            className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none shadow-xs"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* Consultation Receipt Modal */}
      {consultationReceipt && (
        <ConsultationReceiptModal
          receipt={consultationReceipt}
          onClose={() => setConsultationReceipt(null)}
        />
      )}
    </div>
  );
};

