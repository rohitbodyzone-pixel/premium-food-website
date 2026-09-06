import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ConsultationChat } from '../types';
import { api } from '../services/api';
import { MessageSquare, ShieldCheck, ChevronRight, Clock } from 'lucide-react';

export const ChatsListPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chats, setChats] = useState<ConsultationChat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth?mode=login');
      return;
    }

    api.get<ConsultationChat[]>('/chats/my')
      .then(setChats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 animate-pulse h-96" />
      </div>
    );
  }

  const isExpert = user?.role === 'EXPERT';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          My Consultation Chats
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Private in-app consultations. Start audio or video calls directly inside any chat.
        </p>
      </div>

      {chats.length > 0 ? (
        <div className="space-y-3">
          {chats.map((chat) => {
            const partnerName = isExpert ? chat.consumer?.name || 'Customer' : chat.expert?.user?.name || 'Property Expert';
            const partnerPhoto = isExpert
              ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80'
              : chat.expert?.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80';

            return (
              <Link
                key={chat.id}
                to={`/chat/${chat.id}`}
                className="bg-white rounded-2xl border border-slate-200 p-4 hover:border-emerald-500 shadow-xs hover:shadow-md transition flex items-center justify-between gap-4 group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <img
                    src={partnerPhoto}
                    alt={partnerName}
                    className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-100"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 truncate">
                        {partnerName}
                      </span>
                      {!isExpert && <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />}
                      <span className="text-xs text-slate-400">
                        {chat.expert?.country?.flag}
                      </span>
                    </div>

                    <p className="text-xs text-emerald-700 font-semibold truncate mt-0.5">
                      {chat.expert?.category?.name} • {chat.expert?.businessName}
                    </p>

                    <p className="text-xs text-slate-500 truncate mt-1">
                      {chat.messages?.[0]?.content || 'Open private conversation...'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-emerald-600 group-hover:translate-x-1 transition flex items-center gap-1">
                    Open
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
          <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No active chats</h3>
          <p className="text-xs text-slate-500 mt-1">
            Browse verified experts and tap "Talk Now" to start a private consultation chat.
          </p>
          <Link
            to="/experts"
            className="mt-4 inline-block px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs"
          >
            Find Property Experts
          </Link>
        </div>
      )}
    </div>
  );
};
