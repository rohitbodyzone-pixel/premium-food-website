import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Home,
  MessageSquare,
  PhoneCall,
  Calendar,
  User,
} from 'lucide-react';

export const CustomerMobileNav: React.FC = () => {
  const { user } = useAuth();

  const getProfileLink = () => {
    if (!user) return '/auth?mode=login';
    return '/profile';
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-1.5 shadow-lg flex items-center justify-around max-w-md mx-auto sm:max-w-full">
      {/* 1. Home */}
      <NavLink
        to="/"
        className={({ isActive }) =>
          `flex flex-col items-center py-1 px-3 rounded-xl transition ${
            isActive ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`
        }
      >
        <Home className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] tracking-tight">Home</span>
      </NavLink>

      {/* 2. Chat */}
      <NavLink
        to="/chats"
        className={({ isActive }) =>
          `flex flex-col items-center py-1 px-3 rounded-xl transition ${
            isActive ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`
        }
      >
        <MessageSquare className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] tracking-tight">Chat</span>
      </NavLink>

      {/* 3. Call */}
      <NavLink
        to="/calls"
        className={({ isActive }) =>
          `flex flex-col items-center py-1 px-3 rounded-xl transition ${
            isActive ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`
        }
      >
        <PhoneCall className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] tracking-tight">Call</span>
      </NavLink>

      {/* 4. Bookings */}
      <NavLink
        to="/appointments"
        className={({ isActive }) =>
          `flex flex-col items-center py-1 px-3 rounded-xl transition ${
            isActive ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`
        }
      >
        <Calendar className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] tracking-tight">Bookings</span>
      </NavLink>

      {/* 5. Profile */}
      <NavLink
        to={getProfileLink()}
        className={({ isActive }) =>
          `flex flex-col items-center py-1 px-3 rounded-xl transition ${
            isActive ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`
        }
      >
        <User className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] tracking-tight">Profile</span>
      </NavLink>
    </nav>
  );
};
