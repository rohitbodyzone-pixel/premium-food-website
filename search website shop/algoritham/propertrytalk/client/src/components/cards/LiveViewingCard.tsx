import React from 'react';
import { Link } from 'react-router-dom';
import { LiveViewingSession } from '../../types';
import {
  Video,
  Clock,
  Users,
  Calendar,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

interface LiveViewingCardProps {
  session: LiveViewingSession;
  onBook?: (session: LiveViewingSession) => void;
}

export const LiveViewingCard: React.FC<LiveViewingCardProps> = ({ session, onBook }) => {
  const isGroup = session.viewingType === 'GROUP';
  const priceDollars = session.ticketPriceMinorUnits / 100;
  const property = session.property;

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-NZ', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const coverImage = property?.images?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80';

  const confirmedCount = session.confirmedCount || 0;
  const minQuotaMet = session.minQuotaMet || (isGroup ? confirmedCount >= session.minAttendees : true);
  const spotsLeft = session.spotsRemaining !== undefined
    ? session.spotsRemaining
    : Math.max(0, session.maxCapacity - confirmedCount);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col sm:flex-row">
      {/* Property Thumbnail */}
      <div className="relative w-full sm:w-48 h-44 sm:h-auto shrink-0 bg-slate-100 overflow-hidden">
        <img
          src={coverImage}
          alt={property?.title || 'Property'}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-black/20 sm:hidden" />

        {/* Live / Status Badge */}
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-slate-900/80 backdrop-blur-xs text-white border border-white/20">
            {isGroup ? 'Group Viewing' : 'Private Viewing'}
          </span>
          {session.status === 'LIVE' && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-red-600 text-white animate-pulse flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              <span>LIVE NOW</span>
            </span>
          )}
        </div>

        {/* Price tag on mobile image */}
        <div className="absolute bottom-2 left-3 sm:hidden text-white font-black text-lg">
          ${priceDollars} <span className="text-xs font-normal text-slate-200">NZD / ticket</span>
        </div>
      </div>

      {/* Info Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Header row with price on desktop */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Strict 10-Minute Remote Viewing</span>
              </span>
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base mt-1.5 line-clamp-1">
                {property?.title || session.title || 'Live Walkthrough Session'}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                {property?.streetAddress ? `${property.streetAddress}, ${property.suburb}` : 'Auckland, NZ'}
              </p>
            </div>

            <div className="hidden sm:block text-right shrink-0">
              <div className="text-lg font-black text-slate-900">
                ${priceDollars} <span className="text-xs font-semibold text-slate-500">NZD</span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium">per ticket</div>
            </div>
          </div>

          {/* Schedule & Quota Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="font-semibold">{formatDate(session.scheduledAt)}</span>
            </div>

            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              {isGroup ? (
                <span>
                  <strong>{confirmedCount}</strong> / {session.maxCapacity} Booked ({spotsLeft} spots left)
                </span>
              ) : (
                <span>Private 1-on-1 Walkthrough</span>
              )}
            </div>
          </div>

          {/* Group Quota Notice */}
          {isGroup && (
            <div className="mt-2 text-[11px] flex items-center gap-1.5 text-slate-500">
              {minQuotaMet ? (
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Confirmed: Min 5 attendees quota reached
                </span>
              ) : (
                <span className="text-amber-700 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  Min 5 required to run (Auto-refunded if quota not met)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action Row */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          {session.hostProfile && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <img
                src={session.hostProfile.photoUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&q=80'}
                alt={session.hostProfile.name}
                className="w-5 h-5 rounded-full object-cover"
              />
              <span className="truncate max-w-[120px] font-medium">{session.hostProfile.name}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Link
              to={property ? `/properties/${property.id}` : `/live-viewings/${session.id}`}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2 py-1.5"
            >
              Property Info
            </Link>

            <Link
              to={`/live-viewings/${session.id}`}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs ${
                session.status === 'LIVE'
                  ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>{session.status === 'LIVE' ? 'Join Stream' : `Book Ticket ($${priceDollars})`}</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
