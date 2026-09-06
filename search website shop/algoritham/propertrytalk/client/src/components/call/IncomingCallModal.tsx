import React from 'react';
import { useSocket } from '../../context/SocketContext';
import { PhoneCall, PhoneOff, Video, Clock } from 'lucide-react';

export const IncomingCallModal: React.FC = () => {
  const { incomingCall, acceptIncomingCall, declineIncomingCall } = useSocket();

  if (!incomingCall) return null;

  const isVideo = incomingCall.callType === 'VIDEO';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-bounce-gentle">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-6 text-center text-white shadow-2xl relative overflow-hidden">
        {/* Animated pulse ring */}
        <div className="absolute -top-16 -left-16 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl animate-pulse" />
        <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl animate-pulse" />

        <div className="relative">
          {/* Incoming icon */}
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-600/20 border-2 border-emerald-500 flex items-center justify-center animate-pulse">
            {isVideo ? (
              <Video className="w-10 h-10 text-emerald-400" />
            ) : (
              <PhoneCall className="w-10 h-10 text-emerald-400" />
            )}
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-2">
            <Clock className="w-3.5 h-3.5" />
            <span>First 1 Minute FREE Consultation</span>
          </div>

          <h3 className="text-xl font-bold tracking-tight text-white mb-1">
            {incomingCall.consumerName}
          </h3>
          <p className="text-sm text-slate-400 mb-6">
            Incoming {isVideo ? 'Video' : 'Audio'} consultation request
          </p>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-6">
            {/* Decline */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={declineIncomingCall}
                className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg shadow-red-600/30 active:scale-95 transition"
                title="Decline call"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
              <span className="text-xs text-slate-400 font-medium">Decline</span>
            </div>

            {/* Accept */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={acceptIncomingCall}
                className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/40 active:scale-95 transition animate-pulse"
                title="Accept call"
              >
                {isVideo ? <Video className="w-7 h-7" /> : <PhoneCall className="w-7 h-7" />}
              </button>
              <span className="text-xs text-emerald-400 font-bold">Accept Call</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
