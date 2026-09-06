import React from 'react';

export const ExpertCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs flex items-center justify-between gap-3 animate-pulse">
      {/* Left Avatar & Rating skeleton */}
      <div className="flex flex-col items-center gap-1.5 shrink-0">
        <div className="w-14 h-14 rounded-full bg-slate-200" />
        <div className="w-10 h-3 bg-slate-200 rounded-md" />
      </div>

      {/* Center info skeleton */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="w-32 h-4 bg-slate-200 rounded-md" />
        <div className="w-24 h-3 bg-slate-200 rounded-md" />
        <div className="w-40 h-2.5 bg-slate-200 rounded-md" />
        <div className="w-28 h-4 bg-emerald-100/60 rounded-md" />
      </div>

      {/* Right button skeleton */}
      <div className="shrink-0">
        <div className="w-16 h-8 bg-slate-200 rounded-xl" />
      </div>
    </div>
  );
};

export const ListSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, idx) => (
        <ExpertCardSkeleton key={idx} />
      ))}
    </div>
  );
};
