import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  CalendarOff,
  Globe,
  Sliders,
} from 'lucide-react';

interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface TimeOffItem {
  id: string;
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
  isAllDay: boolean;
  reason?: string | null;
}

const DAYS_OF_WEEK = [
  { day: 1, label: 'Monday' },
  { day: 2, label: 'Tuesday' },
  { day: 3, label: 'Wednesday' },
  { day: 4, label: 'Thursday' },
  { day: 5, label: 'Friday' },
  { day: 6, label: 'Saturday' },
  { day: 0, label: 'Sunday' },
];

export const ExpertAvailabilityPage: React.FC = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settings
  const [timezone, setTimezone] = useState<string>('Pacific/Auckland');
  const [bufferMinutes, setBufferMinutes] = useState<number>(10);
  const [minimumNoticeMinutes, setMinimumNoticeMinutes] = useState<number>(120);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState<number>(60);
  const [appointmentDurations, setAppointmentDurations] = useState<number[]>([15, 30, 45, 60]);

  // Schedule Slots
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);

  // Time-Off Blocks
  const [timeOffList, setTimeOffList] = useState<TimeOffItem[]>([]);
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  const [newTimeOff, setNewTimeOff] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '17:00',
    isAllDay: true,
    reason: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [availData, toData] = await Promise.all([
        api.get<any>('/appointments/expert/availability'),
        api.get<TimeOffItem[]>('/appointments/expert/time-off'),
      ]);

      setTimezone(availData.timezone || 'Pacific/Auckland');
      setBufferMinutes(availData.bufferMinutes ?? 10);
      setMinimumNoticeMinutes(availData.minimumNoticeMinutes ?? 120);
      setMaxAdvanceDays(availData.maxAdvanceDays ?? 60);
      if (Array.isArray(availData.appointmentDurations)) {
        setAppointmentDurations(availData.appointmentDurations);
      }

      if (Array.isArray(availData.slots) && availData.slots.length > 0) {
        setSlots(
          availData.slots.map((s: any) => ({
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
          }))
        );
      } else {
        // Defaults: Mon-Fri 09:00 - 17:00
        setSlots([
          { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
          { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
          { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
          { dayOfWeek: 4, startTime: '09:00', endTime: '17:00' },
          { dayOfWeek: 5, startTime: '09:00', endTime: '17:00' },
        ]);
      }

      setTimeOffList(toData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load availability configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDayToggle = (day: number) => {
    const daySlots = slots.filter((s) => s.dayOfWeek === day);
    if (daySlots.length > 0) {
      setSlots((prev) => prev.filter((s) => s.dayOfWeek !== day));
    } else {
      setSlots((prev) => [...prev, { dayOfWeek: day, startTime: '09:00', endTime: '17:00' }]);
    }
  };

  const handleAddSlot = (day: number) => {
    setSlots((prev) => [...prev, { dayOfWeek: day, startTime: '13:00', endTime: '17:00' }]);
  };

  const handleRemoveSlot = (indexToRemove: number) => {
    setSlots((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSlotChange = (index: number, field: 'startTime' | 'endTime', value: string) => {
    setSlots((prev) =>
      prev.map((slot, idx) => (idx === index ? { ...slot, [field]: value } : slot))
    );
  };

  const handleDurationToggle = (dur: number) => {
    if (appointmentDurations.includes(dur)) {
      if (appointmentDurations.length === 1) {
        alert('At least one appointment duration must remain enabled.');
        return;
      }
      setAppointmentDurations((prev) => prev.filter((d) => d !== dur));
    } else {
      setAppointmentDurations((prev) => [...prev, dur].sort((a, b) => a - b));
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await api.put('/appointments/expert/availability', {
        timezone,
        bufferMinutes,
        minimumNoticeMinutes,
        maxAdvanceDays,
        appointmentDurations,
        slots,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTimeOff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.post<TimeOffItem>('/appointments/expert/time-off', newTimeOff);
      setTimeOffList((prev) => [...prev, created]);
      setShowTimeOffModal(false);
      setNewTimeOff({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '17:00',
        isAllDay: true,
        reason: '',
      });
    } catch (err: any) {
      alert(err.message || 'Failed to add time-off block');
    }
  };

  const handleDeleteTimeOff = async (id: string) => {
    if (!confirm('Are you sure you want to remove this time-off block?')) return;
    try {
      await api.delete(`/appointments/expert/time-off/${id}`);
      setTimeOffList((prev) => prev.filter((to) => to.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete time-off block');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-500">
        <Clock className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-600" />
        <p className="text-sm font-medium">Loading availability schedule...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-28 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Availability & Scheduling
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              Timezone Safe
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Define your recurring weekly hours, buffer gaps between sessions, and block out holidays.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition active:scale-95 disabled:opacity-50 shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Schedule'}</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Availability schedule and rules saved successfully.</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. General Booking Rules & Timezone Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm border-b border-slate-100 pb-3">
          <Sliders className="w-4 h-4 text-emerald-600" />
          <span>Consultation Parameters & Rules</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Timezone */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span>Base Timezone</span>
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-hidden"
            >
              <option value="Pacific/Auckland">Pacific/Auckland (NZDT/NZST)</option>
              <option value="Australia/Sydney">Australia/Sydney (AEDT/AEST)</option>
              <option value="Australia/Melbourne">Australia/Melbourne (AEDT/AEST)</option>
              <option value="Australia/Brisbane">Australia/Brisbane (AEST)</option>
              <option value="Australia/Perth">Australia/Perth (AWST)</option>
            </select>
          </div>

          {/* Buffer Minutes */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Buffer Gap Between Calls
            </label>
            <select
              value={bufferMinutes}
              onChange={(e) => setBufferMinutes(Number(e.target.value))}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-hidden"
            >
              <option value={0}>0 minutes (No buffer)</option>
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes (Recommended)</option>
              <option value={15}>15 minutes</option>
              <option value={20}>20 minutes</option>
              <option value={30}>30 minutes</option>
            </select>
          </div>

          {/* Minimum Notice */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Minimum Booking Notice
            </label>
            <select
              value={minimumNoticeMinutes}
              onChange={(e) => setMinimumNoticeMinutes(Number(e.target.value))}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-hidden"
            >
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours (Recommended)</option>
              <option value={240}>4 hours</option>
              <option value={1440}>24 hours</option>
              <option value={2880}>48 hours</option>
            </select>
          </div>

          {/* Max Advance Booking */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Max Advance Booking
            </label>
            <select
              value={maxAdvanceDays}
              onChange={(e) => setMaxAdvanceDays(Number(e.target.value))}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-hidden"
            >
              <option value={14}>14 days ahead</option>
              <option value={30}>30 days ahead</option>
              <option value={60}>60 days ahead (Default)</option>
              <option value={90}>90 days ahead</option>
            </select>
          </div>
        </div>

        {/* Durations Checkboxes */}
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Allowed Consultation Durations
          </label>
          <div className="flex flex-wrap gap-2">
            {[15, 30, 45, 60].map((dur) => {
              const active = appointmentDurations.includes(dur);
              return (
                <button
                  type="button"
                  key={dur}
                  onClick={() => handleDurationToggle(dur)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                    active
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {dur} Minutes
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Weekly Recurring Availability Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>Weekly Recurring Schedule</span>
          </div>
          <span className="text-[11px] text-slate-500">
            Slots generated in 24-hour time format
          </span>
        </div>

        <div className="space-y-3">
          {DAYS_OF_WEEK.map(({ day, label }) => {
            const daySlots = slots.map((s, idx) => ({ ...s, originalIndex: idx })).filter((s) => s.dayOfWeek === day);
            const isEnabled = daySlots.length > 0;

            return (
              <div
                key={day}
                className={`p-3.5 rounded-xl border transition ${
                  isEnabled
                    ? 'bg-slate-50/70 border-slate-200'
                    : 'bg-slate-50/20 border-slate-100 opacity-60'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Day switch */}
                  <div className="flex items-center gap-3 min-w-[140px]">
                    <button
                      type="button"
                      onClick={() => handleDayToggle(day)}
                      className={`w-10 h-6 rounded-full transition-colors relative flex items-center ${
                        isEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          isEnabled ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className="font-bold text-xs text-slate-900">{label}</span>
                  </div>

                  {/* Time Blocks */}
                  <div className="flex-1 flex flex-col gap-2">
                    {isEnabled ? (
                      daySlots.map((slot) => (
                        <div key={slot.originalIndex} className="flex items-center gap-2">
                          <input
                            type="time"
                            value={slot.startTime}
                            onChange={(e) => handleSlotChange(slot.originalIndex, 'startTime', e.target.value)}
                            className="text-xs p-1.5 bg-white border border-slate-200 rounded-lg font-mono focus:ring-1 focus:ring-emerald-500 outline-hidden"
                          />
                          <span className="text-slate-400 text-xs font-bold">to</span>
                          <input
                            type="time"
                            value={slot.endTime}
                            onChange={(e) => handleSlotChange(slot.originalIndex, 'endTime', e.target.value)}
                            className="text-xs p-1.5 bg-white border border-slate-200 rounded-lg font-mono focus:ring-1 focus:ring-emerald-500 outline-hidden"
                          />

                          <button
                            type="button"
                            onClick={() => handleRemoveSlot(slot.originalIndex)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Remove block"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 font-medium italic">Unavailable</span>
                    )}
                  </div>

                  {/* Add additional block for this day */}
                  {isEnabled && (
                    <button
                      type="button"
                      onClick={() => handleAddSlot(day)}
                      className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 hover:bg-emerald-50 px-2 py-1 rounded-lg transition self-start sm:self-center"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add block</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Blocked Dates & Time-Off Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
            <CalendarOff className="w-4 h-4 text-emerald-600" />
            <span>Time-Off & Blocked Dates</span>
          </div>

          <button
            type="button"
            onClick={() => setShowTimeOffModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Time Off</span>
          </button>
        </div>

        {timeOffList.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {timeOffList.map((to) => (
              <div
                key={to.id}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>
                      {to.startDate === to.endDate ? to.startDate : `${to.startDate} → ${to.endDate}`}
                    </span>
                    <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px] font-semibold">
                      {to.isAllDay ? 'All Day' : `${to.startTime} - ${to.endTime}`}
                    </span>
                  </div>
                  {to.reason && (
                    <p className="text-slate-500 text-[11px] mt-0.5">{to.reason}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteTimeOff(to.id)}
                  className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition"
                  title="Remove time-off block"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50/50 rounded-xl">
            No active time-off blocks. Clients can book any open slots on your weekly schedule.
          </p>
        )}
      </div>

      {/* Add Time-Off Modal */}
      {showTimeOffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                <CalendarOff className="w-4 h-4 text-emerald-600" />
                <span>Add Time-Off Period</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowTimeOffModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTimeOff} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={newTimeOff.startDate}
                    onChange={(e) => setNewTimeOff({ ...newTimeOff, startDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={newTimeOff.endDate}
                    onChange={(e) => setNewTimeOff({ ...newTimeOff, endDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allDay"
                  checked={newTimeOff.isAllDay}
                  onChange={(e) => setNewTimeOff({ ...newTimeOff, isAllDay: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300"
                />
                <label htmlFor="allDay" className="font-semibold text-slate-700">
                  Block entire day(s)
                </label>
              </div>

              {!newTimeOff.isAllDay && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={newTimeOff.startTime}
                      onChange={(e) => setNewTimeOff({ ...newTimeOff, startTime: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">End Time</label>
                    <input
                      type="time"
                      value={newTimeOff.endTime}
                      onChange={(e) => setNewTimeOff({ ...newTimeOff, endTime: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Annual leave, Court appearance, Holiday"
                  value={newTimeOff.reason}
                  onChange={(e) => setNewTimeOff({ ...newTimeOff, reason: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTimeOffModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs"
                >
                  Save Time Off
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpertAvailabilityPage;
