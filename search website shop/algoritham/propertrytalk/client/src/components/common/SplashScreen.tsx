import React, { useEffect, useState } from 'react';
import { Sparkles, ShieldCheck } from 'lucide-react';

interface SplashScreenProps {
  onFinish?: () => void;
  durationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish, durationMs = 1200 }) => {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Check if already displayed in this session
    const shown = sessionStorage.getItem('pt_splash_shown');
    if (shown) {
      setVisible(false);
      onFinish?.();
      return;
    }

    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, durationMs - 300);

    const finishTimer = setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem('pt_splash_shown', 'true');
      onFinish?.();
    }, durationMs);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [durationMs, onFinish]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white transition-opacity duration-300 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="relative flex flex-col items-center px-6 text-center animate-fade-in">
        {/* Glowing aura */}
        <div className="absolute w-44 h-44 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none -top-6" />

        {/* Emblem */}
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-2xl shadow-emerald-500/30 mb-5 flex items-center justify-center">
          <div className="w-full h-full bg-slate-950/80 backdrop-blur-xs rounded-[22px] flex items-center justify-center">
            <ShieldCheck className="w-10 h-10 text-emerald-400" />
          </div>
        </div>

        {/* Brand Name */}
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-1">
          Property<span className="text-emerald-400">Talk</span>
        </h1>

        <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-xs font-medium tracking-wide">
          New Zealand Property Marketplace & Verified Advisory
        </p>

        {/* Badges */}
        <div className="flex items-center gap-2 mt-5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-[11px] font-bold text-emerald-300">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>NZ First Launch</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-[11px] font-medium text-slate-300">
            <span>🇳🇿 Verified</span>
          </span>
        </div>

        {/* Loader bar */}
        <div className="w-32 h-1 bg-slate-800 rounded-full mt-8 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-300 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
};
