import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Appointment, Expert } from '../types';
import { api } from '../services/api';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  User,
  Plus,
  MessageSquare,
  PhoneCall,
  RotateCcw,
  ArrowLeft,
  CalendarCheck,
} from 'lucide-react';

export const AppointmentsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const preselectedExpertId = searchParams.get('expertId');

  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [showBookingModal, setShowBookingModal] = useState<boolean>(Boolean(preselectedExpertId));

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [expert, setExpert] = useState<Expert | null>(null);
  const [allExperts, setAllExperts] = useState<Expert[]>([]);
  const [selectedExpertId, setSelectedExpertId] = useState<string>(preselectedExpertId || '');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [bookedSuccess, setBookedSuccess] = useState(false);

  // Reschedule Modal State
  const [rescheduleAppointment, setRescheduleAppointment] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([]);
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState<string>('');
  const [rescheduleReason, setRescheduleReason] = useState<string>('');
  const [rescheduling, setRescheduling] = useState(false);

  // Cancel Modal State
  const [cancelAppointment, setCancelAppointment] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelling, setCancelling] = useState(false);

  // Load user's booked appointments
  const loadAppointments = () => {
    if (!user) return;
    api.get<Appointment[]>('/appointments/my')
      .then(setAppointments)
      .catch(console.error);
  };

  useEffect(() => {
    loadAppointments();
  }, [user]);

  // Load all verified experts for booking selector
  useEffect(() => {
    api.get<Expert[]>('/experts')
      .then((data) => {
        setAllExperts(data);
        if (!selectedExpertId && data.length > 0) {
          setSelectedExpertId(preselectedExpertId || data[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [preselectedExpertId]);

  // When expert or date changes, load bookable slots
  useEffect(() => {
    if (!selectedExpertId) return;

    api.get<Expert>(`/experts/${selectedExpertId}`)
      .then(setExpert)
      .catch(console.error);

    api.get<{ availableSlots: string[]; timezone: string }>(
      `/appointments/slots/${selectedExpertId}?date=${selectedDate}`
    )
      .then((data) => {
        setAvailableSlots(data.availableSlots || []);
        if (data.availableSlots && data.availableSlots.length > 0) {
          setSelectedSlot(data.availableSlots[0]);
        } else {
          setSelectedSlot('');
        }
      })
      .catch(console.error);
  }, [selectedExpertId, selectedDate]);

  // When reschedule appointment or reschedule date changes, load available slots
  useEffect(() => {
    if (!rescheduleAppointment) return;

    const expertId = rescheduleAppointment.expertId;
    api.get<{ availableSlots: any[] }>(
      `/appointments/slots/${expertId}?date=${rescheduleDate}`
    )
      .then((data) => {
        const slots = Array.isArray(data.availableSlots)
          ? data.availableSlots.map((s) => typeof s === 'string' ? s : s.localDisplay || `${s.startTime} - ${s.endTime}`)
          : [];
        setRescheduleSlots(slots);
        if (slots.length > 0) {
          setSelectedRescheduleSlot(slots[0]);
        } else {
          setSelectedRescheduleSlot('');
        }
      })
      .catch(console.error);
  }, [rescheduleAppointment, rescheduleDate]);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/auth?mode=login');
      return;
    }

    if (!selectedExpertId || !selectedSlot) {
      alert('Please select an expert and available time slot.');
      return;
    }

    setBooking(true);
    try {
      await api.post('/appointments/book', {
        expertId: selectedExpertId,
        date: selectedDate,
        slotTime: selectedSlot,
        notes: notes.trim(),
        timezone: expert?.countryCode === 'AU' ? 'Australia/Sydney' : 'Pacific/Auckland',
      });

      setBookedSuccess(true);
      loadAppointments();
      setTimeout(() => {
        setBookedSuccess(false);
        setShowBookingModal(false);
        setActiveTab('upcoming');
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Failed to book appointment');
    } finally {
      setBooking(false);
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleAppointment || !selectedRescheduleSlot) return;

    setRescheduling(true);
    try {
      await api.patch(`/appointments/${rescheduleAppointment.id}/reschedule`, {
        date: rescheduleDate,
        slotTime: selectedRescheduleSlot,
        reason: rescheduleReason.trim() || undefined,
      });

      alert('Appointment rescheduled successfully!');
      setRescheduleAppointment(null);
      setRescheduleReason('');
      loadAppointments();
    } catch (err: any) {
      alert(err.message || 'Failed to reschedule appointment');
    } finally {
      setRescheduling(false);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelAppointment) return;

    setCancelling(true);
    try {
      await api.patch(`/appointments/${cancelAppointment.id}/cancel`, {
        reason: cancelReason.trim() || undefined,
      });

      setCancelAppointment(null);
      setCancelReason('');
      loadAppointments();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel appointment');
    } finally {
      setCancelling(false);
    }
  };

  // Categorize appointments
  const upcomingAppointments = useMemo(() => {
    return appointments.filter(
      (a) => a.status !== 'CANCELLED' && a.status !== 'COMPLETED'
    );
  }, [appointments]);

  const completedAppointments = useMemo(() => {
    return appointments.filter((a) => a.status === 'COMPLETED');
  }, [appointments]);

  const cancelledAppointments = useMemo(() => {
    return appointments.filter((a) => a.status === 'CANCELLED');
  }, [appointments]);

  const displayedList =
    activeTab === 'upcoming'
      ? upcomingAppointments
      : activeTab === 'completed'
      ? completedAppointments
      : cancelledAppointments;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-28 space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Consultation Bookings
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage scheduled one-on-one sessions with NZ & AU property experts.
          </p>
        </div>

        <button
          onClick={() => setShowBookingModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Book Session</span>
        </button>
      </div>

      {/* Segmented Tabs: Upcoming, Completed, Cancelled */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
            activeTab === 'upcoming'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Upcoming</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
            {upcomingAppointments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
            activeTab === 'completed'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Completed</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
            {completedAppointments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('cancelled')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
            activeTab === 'cancelled'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Cancelled</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
            {cancelledAppointments.length}
          </span>
        </button>
      </div>

      {/* Appointments List */}
      <div className="space-y-3">
        {displayedList.length > 0 ? (
          displayedList.map((appt) => {
            const isCancelled = appt.status === 'CANCELLED';
            const isCompleted = appt.status === 'COMPLETED';
            const exp = appt.expert;

            return (
              <div
                key={appt.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={exp?.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80'}
                      alt={exp?.name}
                      className="w-12 h-12 rounded-full object-cover border border-slate-100 shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{exp?.country?.flag || '🇳🇿'}</span>
                        <h3 className="font-bold text-xs sm:text-sm text-slate-900">
                          {user?.role === 'EXPERT' ? appt.consumer?.name || 'Customer' : exp?.name || 'Property Expert'}
                        </h3>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {exp?.title || exp?.category?.name || 'Property Advisor'} • {exp?.businessName || 'Consultation'}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      isCancelled
                        ? 'bg-slate-100 text-slate-600 border border-slate-200'
                        : isCompleted
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {appt.status}
                  </span>
                </div>

                {/* Session Time & Timezone */}
                <div className="bg-slate-50 rounded-xl p-2.5 flex items-center justify-between text-xs text-slate-700 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold">{appt.date}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-medium text-slate-600">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{appt.startTime} - {appt.endTime}</span>
                    <span className="text-[10px] text-slate-400">
                      ({exp?.countryCode === 'AU' ? 'Sydney' : 'NZST'})
                    </span>
                  </div>
                </div>

                {/* Notes if any */}
                {appt.notes && (
                  <p className="text-xs text-slate-600 bg-slate-50/60 p-2.5 rounded-xl border border-slate-100 italic">
                    "{appt.notes}"
                  </p>
                )}

                {/* Action Buttons Footer */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                  {activeTab === 'upcoming' && (
                    <>
                      <button
                        onClick={() => setCancelAppointment(appt)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          setRescheduleAppointment(appt);
                          setRescheduleDate(appt.date);
                        }}
                        className="text-xs font-semibold text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition border border-slate-200 flex items-center gap-1"
                      >
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>Reschedule</span>
                      </button>
                      <button
                        onClick={() => {
                          if (exp?.id) navigate(`/chat/talk-now?expertId=${exp.id}`);
                        }}
                        className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Chat With Expert</span>
                      </button>
                    </>
                  )}

                  {activeTab === 'completed' && (
                    <>
                      <button
                        onClick={() => {
                          if (exp?.id) navigate(`/appointments?expertId=${exp.id}`);
                        }}
                        className="text-xs font-semibold text-slate-700 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 transition flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                        <span>Book Again</span>
                      </button>
                      <button
                        onClick={() => {
                          if (exp?.id) navigate(`/experts/${exp.id}`);
                        }}
                        className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3.5 py-1.5 rounded-xl border border-emerald-200 transition"
                      >
                        View Profile
                      </button>
                    </>
                  )}

                  {activeTab === 'cancelled' && (
                    <button
                      onClick={() => {
                        if (exp?.id) {
                          setSelectedExpertId(exp.id);
                          setShowBookingModal(true);
                        }
                      }}
                      className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-1.5 rounded-xl border border-emerald-200 transition flex items-center gap-1.5"
                    >
                      <CalendarCheck className="w-3.5 h-3.5" />
                      <span>Rebook Session</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-8 text-center">
            <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-bold text-sm text-slate-800">
              No {activeTab} bookings
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {activeTab === 'upcoming'
                ? 'You do not have any upcoming consultations scheduled. Book a session with a verified specialist anytime.'
                : activeTab === 'completed'
                ? 'No past completed consultations logged yet.'
                : 'No cancelled bookings.'}
            </p>
            {activeTab === 'upcoming' && (
              <button
                onClick={() => setShowBookingModal(true)}
                className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition"
              >
                Schedule an Appointment
              </button>
            )}
          </div>
        )}
      </div>

      {/* Booking Drawer / Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-emerald-600" />
                <h2 className="font-extrabold text-sm sm:text-base text-slate-900">
                  Book Consultation Appointment
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowBookingModal(false);
                  if (preselectedExpertId) {
                    searchParams.delete('expertId');
                    setSearchParams(searchParams);
                  }
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            {bookedSuccess && (
              <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Appointment booked successfully!</span>
              </div>
            )}

            <form onSubmit={handleBook} className="space-y-4">
              {/* Select Expert */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Property Professional
                </label>
                <select
                  value={selectedExpertId}
                  onChange={(e) => setSelectedExpertId(e.target.value)}
                  className="w-full text-xs font-medium p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden"
                >
                  {allExperts.map((exp) => (
                    <option key={exp.id} value={exp.id}>
                      {exp.country?.flag} {exp.name} — {exp.title} ({exp.category?.name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Expert Badge Preview */}
              {expert && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={expert.photoUrl}
                      alt={expert.name}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200"
                    />
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1">
                        <span>{expert.name}</span>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      <span className="text-[11px] text-slate-500">{expert.businessName}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">Timezone</span>
                    <span className="font-semibold text-slate-700 text-[11px]">
                      {expert.countryCode === 'AU' ? 'Sydney (AEST)' : 'Auckland (NZST)'}
                    </span>
                  </div>
                </div>
              )}

              {/* Date Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Choose Consultation Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full text-xs font-medium p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden"
                />
              </div>

              {/* Available Time Slots */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Available Time Slots ({expert?.countryCode === 'AU' ? 'Sydney Time' : 'NZ Time'})
                </label>
                {availableSlots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                    {availableSlots.map((slot) => {
                      const isSelected = selectedSlot === slot;
                      return (
                        <button
                          type="button"
                          key={slot}
                          onClick={() => setSelectedSlot(slot)}
                          className={`p-2 rounded-xl text-xs font-semibold border transition ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl">
                    No slots available on this date.
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Notes for Expert (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Property address, key questions, or documents..."
                  rows={2}
                  className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={booking || !selectedSlot}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/25 transition active:scale-95 disabled:opacity-50"
              >
                {booking ? 'Confirming Appointment...' : 'Confirm & Book Appointment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600" />
                <h2 className="font-extrabold text-sm sm:text-base text-slate-900">
                  Reschedule Appointment
                </h2>
              </div>
              <button
                onClick={() => setRescheduleAppointment(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-slate-700">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Current Booking</span>
                <p className="font-bold text-slate-900 mt-0.5">
                  {rescheduleAppointment.date} at {rescheduleAppointment.startTime} - {rescheduleAppointment.endTime}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  With {rescheduleAppointment.expert?.name || 'Property Expert'}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Select New Date
                </label>
                <input
                  type="date"
                  value={rescheduleDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full text-xs font-medium p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Available Slots on {rescheduleDate}
                </label>
                {rescheduleSlots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                    {rescheduleSlots.map((slot) => {
                      const isSelected = selectedRescheduleSlot === slot;
                      return (
                        <button
                          type="button"
                          key={slot}
                          onClick={() => setSelectedRescheduleSlot(slot)}
                          className={`p-2 rounded-xl text-xs font-semibold border transition ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl">
                    No slots available on this date. Please pick another date.
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Reason for Rescheduling (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Schedule clash, need more time for documents"
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRescheduleAppointment(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rescheduling || !selectedRescheduleSlot}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs disabled:opacity-50"
                >
                  {rescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-sm w-full shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2 text-rose-600 font-extrabold text-sm sm:text-base">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>Cancel Consultation</span>
              </div>
              <button
                onClick={() => setCancelAppointment(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCancelSubmit} className="space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Are you sure you want to cancel this appointment on{' '}
                <span className="font-bold text-slate-900">{cancelAppointment.date}</span> at{' '}
                <span className="font-bold text-slate-900">{cancelAppointment.startTime}</span>?
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Cancellation Reason (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Issue resolved, plans changed..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:ring-2 focus:ring-rose-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCancelAppointment(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Keep Appointment
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

