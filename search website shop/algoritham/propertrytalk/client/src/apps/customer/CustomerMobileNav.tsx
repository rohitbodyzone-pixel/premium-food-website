import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Home,
  Compass,
  Video,
  MessageSquare,
  User,
} from 'lucide-react';

export const CustomerMobileNav: React.FC = () => {
  const { user } = useAuth();

  const getProfileLink = () => {
    if (!user) return '/auth?mode=login';
    return '/profile';
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-1 py-1.5 shadow-lg flex items-center justify-around max-w-md mx-auto sm:max-w-full">
      {/* 1. Home */}
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `flex flex-col items-center py-1 px-2.5 rounded-xl transition ${
            isActive ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`
        }
      >
        <Home className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] tracking-tight">Home</span>
      </NavLink>

      {/* 2. Explore (Properties & Pros) */}
      <NavLink
        to="/explore"
        className={({ isActive }) =>
          `flex flex-col items-center py-1 px-2.5 rounded-xl transition ${
            isActive ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`
        }
      >
        <Compass className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] tracking-tight">Explore</span>
      </NavLink>

      {/* 3. Live Viewings */}
      <NavLink
        to="/live-viewings"
        className={({ isActive }) =>
          `flex flex-col items-center py-1 px-2.5 rounded-xl transition relative ${
            isActive ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`
        }
      >
        <div className="relative">
          <Video className="w-5 h-5 mb-0.5" />
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute -top-0.5 -right-0.5 animate-pulse" />
        </div>
        <span className="text-[10px] tracking-tight">Live Viewings</span>
      </NavLink>

      {/* 4. Messages */}
      <NavLink
        to="/chats"
        className={({ isActive }) =>
          `flex flex-col items-center py-1 px-2.5 rounded-xl transition ${
            isActive ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`
        }
      >
        <MessageSquare className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] tracking-tight">Messages</span>
      </NavLink>

      {/* 5. Profile */}
      <NavLink
        to={getProfileLink()}
        className={({ isActive }) =>
          `flex flex-col items-center py-1 px-2.5 rounded-xl transition ${
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
