import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import {
  ToggleLeft,
  ToggleRight,
  Shield,
  Globe,
  Video,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Save,
} from 'lucide-react';

interface FeatureFlag {
  key: string;
  value: string;
  description: string;
}

export const FeatureFlagsView: React.FC = () => {
  const [flags, setFlags] = useState<Record<string, string>>({
    australia_enabled: 'false',
    remote_live_viewing_enabled: 'true',
    agent_mini_websites_enabled: 'true',
    ai_seo_articles_enabled: 'true',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  const loadFlags = async () => {
    try {
      setLoading(true);
      const res = await api.get<Record<string, string>>('/admin/feature-flags');
      if (res) {
        setFlags((prev) => ({ ...prev, ...res }));
      }
    } catch (err) {
      console.error('Failed to load feature flags:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlags();
  }, []);

  const handleToggle = (key: string) => {
    setFlags((prev) => ({
      ...prev,
      [key]: prev[key] === 'true' ? 'false' : 'true',
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/admin/feature-flags', { flags });
      setSavedMessage('Feature flags updated successfully.');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (err) {
      console.error('Failed to save feature flags:', err);
      alert('Failed to update feature flags');
    } finally {
      setSaving(false);
    }
  };

  const flagConfigs = [
    {
      key: 'australia_enabled',
      title: 'Australia Market Rollout',
      desc: 'Enable or disable Australia country selector and Australian expert listings for public consumers. Keep FALSE for initial NZ launch.',
      icon: Globe,
      badge: flags.australia_enabled === 'true' ? 'Active' : 'Disabled (NZ-First)',
      badgeColor: flags.australia_enabled === 'true' ? 'text-emerald-400 bg-emerald-950/60' : 'text-amber-400 bg-amber-950/60',
    },
    {
      key: 'remote_live_viewing_enabled',
      title: 'Remote Live Property Viewings',
      desc: 'Enable Group (NZ$20) and Private (NZ$60) 10-minute HD live viewing booking and host broadcast engine.',
      icon: Video,
      badge: flags.remote_live_viewing_enabled === 'true' ? 'Active' : 'Disabled',
      badgeColor: flags.remote_live_viewing_enabled === 'true' ? 'text-emerald-400 bg-emerald-950/60' : 'text-slate-400 bg-slate-800',
    },
    {
      key: 'agent_mini_websites_enabled',
      title: 'Agent Mini-Websites with Google SEO',
      desc: 'Enable public /agent/:slug landing pages, RealEstateAgent JSON-LD schemas, and QR code flyer generators.',
      icon: Shield,
      badge: flags.agent_mini_websites_enabled === 'true' ? 'Active' : 'Disabled',
      badgeColor: flags.agent_mini_websites_enabled === 'true' ? 'text-emerald-400 bg-emerald-950/60' : 'text-slate-400 bg-slate-800',
    },
    {
      key: 'ai_seo_articles_enabled',
      title: 'Agent AI SEO Article Publishing',
      desc: 'Enable weekly topic suggestions, anti-duplication AI drafts, and public suburban market guides.',
      icon: BookOpen,
      badge: flags.ai_seo_articles_enabled === 'true' ? 'Active' : 'Disabled',
      badgeColor: flags.ai_seo_articles_enabled === 'true' ? 'text-emerald-400 bg-emerald-950/60' : 'text-slate-400 bg-slate-800',
    },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">
            Platform Feature Flags
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Super Admin global switches governing market availability and system modules.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-xs transition"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Flags'}</span>
        </button>
      </div>

      {savedMessage && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{savedMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500">Loading flags...</div>
      ) : (
        <div className="space-y-3">
          {flagConfigs.map((cfg) => {
            const Icon = cfg.icon;
            const isEnabled = flags[cfg.key] === 'true';

            return (
              <div
                key={cfg.key}
                className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl flex items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-white">{cfg.title}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${cfg.badgeColor}`}>
                        {cfg.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
                      {cfg.desc}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggle(cfg.key)}
                  className="p-1 text-purple-400 hover:text-purple-300 transition shrink-0"
                  title={isEnabled ? 'Disable Feature' : 'Enable Feature'}
                >
                  {isEnabled ? (
                    <ToggleRight className="w-10 h-10 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-slate-600" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
