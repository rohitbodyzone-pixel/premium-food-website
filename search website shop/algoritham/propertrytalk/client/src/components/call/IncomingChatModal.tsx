import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { MessageSquare, X, Check, Clock, User, ShieldCheck } from 'lucide-react';

export const IncomingChatModal: React.FC = () => {
  const { incomingChat, acceptChat, declineChat, dismissIncomingChat } = useSocket();
  const navigate = useNavigate();
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  if (!incomingChat) return null;

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await acceptChat(incomingChat.chatId);
      navigate(`/chat/${incomingChat.chatId}`);
    } catch (err) {
      console.error('Failed to accept chat:', err);
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    try {
      await declineChat(incomingChat.chatId);
    } catch (err) {
      console.error('Failed to decline chat:', err);
    } finally {
      setDeclining(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl relative overflow-hidden">
        {/* Decorative blur glows */}
        <div className="absolute -top-16 -left-16 w-36 h-36 bg-emerald-500/20 rounded-full blur-2xl animate-pulse" />
        <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-teal-500/20 rounded-full blur-2xl animate-pulse" />

        <div className="relative">
          {/* Header Badge */}
          <div className="flex items-center justify-between mb-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
              <Clock className="w-3.5 h-3.5" />
              <span>Incoming Consultation Request</span>
            </div>

            <button
              onClick={dismissIncomingChat}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Dismiss prompt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* User Info & Icon */}
          <div className="flex items-center gap-3.5 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 border-2 border-emerald-500 flex items-center justify-center shrink-0 animate-pulse">
              <MessageSquare className="w-7 h-7 text-emerald-400" />
            </div>

            <div className="min-w-0">
              <h3 className="text-lg font-bold text-white truncate flex items-center gap-1.5">
                <span>{incomingChat.consumerName}</span>
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              </h3>
              <p className="text-xs text-slate-400">
                Wants to start a consultation chat
              </p>
            </div>
          </div>

          {/* Message Preview */}
          {incomingChat.initialMessage ? (
            <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3.5 mb-6">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Client Inquiry Preview:
              </span>
              <p className="text-xs text-slate-200 italic line-clamp-3 leading-relaxed">
                "{incomingChat.initialMessage}"
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic mb-6">
              Customer initiated a private consultation chat.
            </p>
          )}

          {/* Consultation Rule Notice */}
          <div className="text-[11px] text-slate-400 mb-6 flex items-center gap-1.5 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              Accepting connects the chat and starts the customer's <strong>First 1 Minute FREE</strong> timer.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleDecline}
              disabled={declining || accepting}
              className="py-3 px-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95"
            >
              <X className="w-4 h-4 text-red-400" />
              <span>{declining ? 'Declining...' : 'Decline'}</span>
            </button>

            <button
              onClick={handleAccept}
              disabled={declining || accepting}
              className="py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95 animate-pulse"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{accepting ? 'Connecting...' : 'Accept Chat'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingChatModal;
