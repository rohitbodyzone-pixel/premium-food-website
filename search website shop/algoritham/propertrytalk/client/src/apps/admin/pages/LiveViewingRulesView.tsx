import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import {
  Video,
  DollarSign,
  Users,
  ShieldAlert,
  Clock,
  Save,
  CheckCircle2,
} from 'lucide-react';

export const LiveViewingRulesView: React.FC = () => {
  const [rules, setRules] = useState({
    group_ticket_price: '20',
    private_ticket_price: '60',
    min_group_attendees: '5',
    default_max_capacity: '10',
    upper_max_capacity: '100',
    streaming_cost_minor_units: '150', // $1.50 NZD
    recording_consent_required: 'true',
    strict_10min_enforcement: 'true',
    recording_retention_days: '30',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const loadRules = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/live-viewing-rules');
      if (res) {
        setRules((prev) => ({ ...prev, ...res }));
      }
    } catch (err) {
      console.error('Failed to load rules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.put('/admin/live-viewing-rules', { rules });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save live viewing rules:', err);
      alert('Failed to update live viewing rules.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
          <Video className="w-6 h-6 text-purple-400" />
          <span>Remote Live Viewing Rules & Economics</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Configure financial settlements, capacity constraints, minimum attendee quotas, and tech cost deductions.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Live viewing rules successfully updated across the platform.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xs space-y-5 text-xs">
        {/* 1. Ticket Pricing Bounds */}
        <div>
          <h3 className="font-bold text-sm text-purple-300 uppercase tracking-wider mb-3">
            Ticket Pricing (NZD)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Standard Group Viewing Ticket ($ NZD)
              </label>
              <input
                type="number"
                min="5"
                max="100"
                value={rules.group_ticket_price}
                onChange={(e) => setRules({ ...rules, group_ticket_price: e.target.value })}
                className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Default: $20 NZD per attendee.
              </span>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Private 1-on-1 Viewing Ticket ($ NZD)
              </label>
              <input
                type="number"
                min="20"
                max="300"
                value={rules.private_ticket_price}
                onChange={(e) => setRules({ ...rules, private_ticket_price: e.target.value })}
                className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Default: $60 NZD for private exclusive walkthrough.
              </span>
            </div>
          </div>
        </div>

        {/* 2. Attendee Quota & Capacities */}
        <div className="pt-4 border-t border-slate-800">
          <h3 className="font-bold text-sm text-purple-300 uppercase tracking-wider mb-3">
            Attendee Quota & Capacities
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Min Paid Attendees for Group
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={rules.min_group_attendees}
                onChange={(e) => setRules({ ...rules, min_group_attendees: e.target.value })}
                className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Default: 5 bookings. Auto-refunds if missed.
              </span>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Default Capacity
              </label>
              <input
                type="number"
                min="5"
                max="50"
                value={rules.default_max_capacity}
                onChange={(e) => setRules({ ...rules, default_max_capacity: e.target.value })}
                className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Default max seats per session (10).
              </span>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Max Capacity Ceiling (50 - 200)
              </label>
              <input
                type="number"
                min="50"
                max="200"
                value={rules.upper_max_capacity}
                onChange={(e) => setRules({ ...rules, upper_max_capacity: e.target.value })}
                className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Configurable upper limit for high-demand sessions.
              </span>
            </div>
          </div>
        </div>

        {/* 3. Tech Cost Deduction */}
        <div className="pt-4 border-t border-slate-800">
          <h3 className="font-bold text-sm text-purple-300 uppercase tracking-wider mb-3">
            Streaming Infrastructure Settlement
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Tech Cost Deducted from Agent Settlement (Minor Units - Cents)
              </label>
              <input
                type="number"
                value={rules.streaming_cost_minor_units}
                onChange={(e) => setRules({ ...rules, streaming_cost_minor_units: e.target.value })}
                className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Default: 150 cents ($1.50 NZD) flat deduction upon broadcast completion.
              </span>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Recording Retention Period (Days)
              </label>
              <input
                type="number"
                value={rules.recording_retention_days}
                onChange={(e) => setRules({ ...rules, recording_retention_days: e.target.value })}
                className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Recordings automatically pruned after retention expiry.
              </span>
            </div>
          </div>
        </div>

        {/* 4. Policy Toggles */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between p-3 bg-slate-800/60 rounded-xl">
            <div>
              <span className="font-bold text-white block">Strict 10-Minute Auto-Termination</span>
              <span className="text-[11px] text-slate-400">Server timer enforces immediate broadcast termination at 600s. No extensions allowed.</span>
            </div>
            <input
              type="checkbox"
              checked={rules.strict_10min_enforcement === 'true'}
              onChange={(e) => setRules({ ...rules, strict_10min_enforcement: e.target.checked ? 'true' : 'false' })}
              className="w-4 h-4 accent-purple-600"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-800/60 rounded-xl">
            <div>
              <span className="font-bold text-white block">Require Written Seller Consent</span>
              <span className="text-[11px] text-slate-400">Host must verify vendor permission prior to scheduling. Recording is OFF by default.</span>
            </div>
            <input
              type="checkbox"
              checked={rules.recording_consent_required === 'true'}
              onChange={(e) => setRules({ ...rules, recording_consent_required: e.target.checked ? 'true' : 'false' })}
              className="w-4 h-4 accent-purple-600"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Economics & Rules'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
