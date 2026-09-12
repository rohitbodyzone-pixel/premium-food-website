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
  Save,
  MapPin,
  Search,
  GraduationCap,
  TrendingUp,
  History,
  Building2,
  Scale,
  ShieldAlert,
  Layers,
  DollarSign,
  Sparkles,
} from 'lucide-react';

interface FlagGroup {
  groupTitle: string;
  groupDesc: string;
  flags: {
    key: string;
    title: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

export const FeatureFlagsView: React.FC = () => {
  const [flags, setFlags] = useState<Record<string, string>>({
    australia_enabled: 'false',
    remote_live_viewing_enabled: 'true',
    agent_mini_websites_enabled: 'true',
    ai_seo_articles_enabled: 'true',
    google_maps_enabled: 'true',
    google_places_enabled: 'true',
    property_insights_enabled: 'true',
    property_value_enabled: 'true',
    rent_estimate_enabled: 'true',
    sales_history_enabled: 'true',
    nearby_sales_enabled: 'true',
    school_information_enabled: 'true',
    school_zones_enabled: 'true',
    council_valuation_enabled: 'true',
    legal_property_details_enabled: 'true',
    property_hazards_enabled: 'true',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  const loadFlags = async () => {
    try {
      setLoading(true);
      const res = await api.get<Record<string, any>>('/admin/feature-flags');
      if (res) {
        const stringified: Record<string, string> = {};
        for (const [k, v] of Object.entries(res)) {
          stringified[k] = v === true || v === 'true' ? 'true' : 'false';
        }
        setFlags((prev) => ({ ...prev, ...stringified }));
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
    setFlags((prev) => {
      const isCurrentlyEnabled = prev[key] === 'true';
      return {
        ...prev,
        [key]: isCurrentlyEnabled ? 'false' : 'true',
      };
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/admin/feature-flags', { flags });
      setSavedMessage('All feature flags saved successfully.');
      setTimeout(() => setSavedMessage(''), 3500);
    } catch (err) {
      console.error('Failed to save feature flags:', err);
      alert('Failed to update feature flags');
    } finally {
      setSaving(false);
    }
  };

  const flagSections: FlagGroup[] = [
    {
      groupTitle: 'Trade Me-Equivalent Property Insights & Authoritative Data',
      groupDesc:
        'Granular switches governing authoritative NZ public data sources (MoE, LINZ, MBIE, Council GIS & Rating Valuations).',
      flags: [
        {
          key: 'property_insights_enabled',
          title: 'Property Insights Master Switch',
          desc: 'Global master toggle for the entire Property Insights module across all public customer property pages.',
          icon: Sparkles,
        },
        {
          key: 'property_value_enabled',
          title: 'Commercial Property Value Estimate (AVM)',
          desc: 'CoreLogic / QV automated valuation model integration. In production, unconfigured keys return clean waiting notices without fabricated figures.',
          icon: TrendingUp,
        },
        {
          key: 'rent_estimate_enabled',
          title: 'Weekly Rent Estimate (MBIE Tenancy Services)',
          desc: 'Official MBIE Tenancy Services lodged bond statistics by suburb and TA, labeled Area Market Rent.',
          icon: DollarSign,
        },
        {
          key: 'sales_history_enabled',
          title: 'Public Settled Sales History',
          desc: 'Authoritative title transfer settled sales register ordered chronologically descending.',
          icon: History,
        },
        {
          key: 'nearby_sales_enabled',
          title: 'Nearby Recent Comparable Sales',
          desc: 'Radius-based recent comparable settled property transactions. Zero mock fallback records in production.',
          icon: Building2,
        },
        {
          key: 'school_information_enabled',
          title: 'MoE School Information Directory',
          desc: 'Official Ministry of Education NZ directory with institution IDs, year levels, deciles, and verified rolls.',
          icon: GraduationCap,
        },
        {
          key: 'school_zones_enabled',
          title: 'MoE School Enrolment Scheme Spatial Zones',
          desc: 'Geometric ray-casting point-in-polygon resolution against official MoE home enrolment scheme boundary polygons.',
          icon: Layers,
        },
        {
          key: 'council_valuation_enabled',
          title: 'Council Rating Valuation (CV / RV)',
          desc: 'Official Council rating valuation breakdown (Capital Value, Land Value, Improvements Value, and valuation roll date).',
          icon: Building2,
        },
        {
          key: 'legal_property_details_enabled',
          title: 'LINZ Cadastral & Legal Details',
          desc: 'Land Information New Zealand (LINZ) Primary Parcels (Layer 50772) WFS cadastral boundaries and title references.',
          icon: Scale,
        },
        {
          key: 'property_hazards_enabled',
          title: 'Council GIS Flood & Hazard Mapping',
          desc: 'Regional council GIS overland flow paths, 1% AEP flood plains, and liquefaction overlays with mandatory LIM advisory notices.',
          icon: ShieldAlert,
        },
      ],
    },
    {
      groupTitle: 'Google Maps Platform Integration',
      groupDesc: 'Location mapping, satellite visualisations, and address geocoding caches.',
      flags: [
        {
          key: 'google_maps_enabled',
          title: 'Google Maps Interactive Views',
          desc: 'Interactive Google Maps property location cards, pin markers, and road/satellite views.',
          icon: MapPin,
        },
        {
          key: 'google_places_enabled',
          title: 'Google Address Validation & Places Autocomplete',
          desc: 'Official Google Address Validation API and database amenity caching engine.',
          icon: Search,
        },
      ],
    },
    {
      groupTitle: 'Core Platform & Market Capabilities',
      groupDesc: 'Core market rollout, live viewing engines, and agent SEO publishing modules.',
      flags: [
        {
          key: 'australia_enabled',
          title: 'Australia Market Rollout',
          desc: 'Enable or disable Australia country selector and Australian expert listings for public consumers. Keep FALSE for NZ-First launch.',
          icon: Globe,
        },
        {
          key: 'remote_live_viewing_enabled',
          title: 'Remote Live Property Viewings',
          desc: 'Enable Group (NZ$20) and Private (NZ$60) 10-minute HD live viewing booking and host broadcast engine.',
          icon: Video,
        },
        {
          key: 'agent_mini_websites_enabled',
          title: 'Agent Mini-Websites with Google SEO',
          desc: 'Enable public /agent/:slug landing pages, RealEstateAgent JSON-LD schemas, and QR code flyer generators.',
          icon: Shield,
        },
        {
          key: 'ai_seo_articles_enabled',
          title: 'Agent AI SEO Article Publishing',
          desc: 'Enable weekly topic suggestions, anti-duplication AI drafts, and public suburban market guides.',
          icon: BookOpen,
        },
      ],
    },
  ];

  return (
    <div className="max-w-4xl space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">
            Platform Feature Flags
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Super Admin global switches governing market availability, Google Platform, and Trade Me-equivalent property insights.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save All Flags'}</span>
        </button>
      </div>

      {savedMessage && (
        <div className="p-3.5 bg-emerald-950/70 border border-emerald-700/80 rounded-xl text-emerald-300 text-xs flex items-center gap-2.5 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold">{savedMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500">Loading flags...</div>
      ) : (
        <div className="space-y-8">
          {flagSections.map((section, idx) => (
            <div key={idx} className="space-y-3.5">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="text-sm font-black text-slate-200 tracking-wide">
                  {section.groupTitle}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{section.groupDesc}</p>
              </div>

              <div className="space-y-2.5">
                {section.flags.map((cfg) => {
                  const Icon = cfg.icon;
                  const isEnabled = flags[cfg.key] === 'true';

                  return (
                    <div
                      key={cfg.key}
                      className={`border p-4 rounded-2xl flex items-center justify-between gap-4 transition-colors ${
                        isEnabled
                          ? 'bg-slate-900/90 border-slate-800'
                          : 'bg-slate-950/60 border-slate-900 opacity-75'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                            isEnabled
                              ? 'bg-purple-950/60 text-purple-400 border border-purple-800/40'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-white">{cfg.title}</h4>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                isEnabled
                                  ? 'text-emerald-400 bg-emerald-950/80 border border-emerald-800/60'
                                  : 'text-slate-400 bg-slate-800 border border-slate-700'
                              }`}
                            >
                              {isEnabled ? 'Enabled' : 'Disabled'}
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
