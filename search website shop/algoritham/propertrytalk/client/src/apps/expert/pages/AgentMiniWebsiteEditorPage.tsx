import React, { useState, useEffect } from 'react';
import { AgentMiniWebsite } from '../../../types';
import { api } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import {
  Globe,
  Save,
  QrCode,
  ExternalLink,
  Eye,
  MessageSquare,
  CheckCircle2,
  MapPin,
  Building,
  Image,
  X,
} from 'lucide-react';

export const AgentMiniWebsiteEditorPage: React.FC = () => {
  const { user } = useAuth();
  const [website, setWebsite] = useState<AgentMiniWebsite | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Form Fields
  const [slug, setSlug] = useState('');
  const [customHeadline, setCustomHeadline] = useState('');
  const [customAbout, setCustomAbout] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [serviceAreasStr, setServiceAreasStr] = useState('');

  // QR Modal
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    if (!user?.expertProfile?.id) return;
    setLoading(true);

    api.get<AgentMiniWebsite>('/agent-websites/me')
      .then((data) => {
        setWebsite(data);
        if (data) {
          setSlug(data.slug || '');
          setCustomHeadline(data.customHeadline || '');
          setCustomAbout(data.customAbout || '');
          setAgencyName(data.agencyName || '');
          setCoverImageUrl(data.coverImageUrl || '');
          setContactPhone(data.contactPhone || '');
          setContactEmail(data.contactEmail || '');
          setServiceAreasStr((data.serviceAreas || []).join(', '));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const areas = serviceAreasStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const updated = await api.put<AgentMiniWebsite>('/agent-websites/me', {
        slug: slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
        customHeadline,
        customAbout,
        agencyName,
        coverImageUrl,
        contactPhone,
        contactEmail,
        serviceAreas: areas,
      });

      setWebsite(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to update mini-website:', err);
      alert(err.response?.data?.error || err.message || 'Failed to save mini-website.');
    } finally {
      setSaving(false);
    }
  };

  const publicUrl = slug ? `${window.location.origin}/agent/${slug}` : '';
  const qrUrl = publicUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(publicUrl)}`
    : '';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Globe className="w-6 h-6 text-emerald-600" />
            <span>Agent Mini-Website & SEO</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Your dedicated landing page with Google structured data, listings, and flyer QR code.
          </p>
        </div>

        {publicUrl && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-2xs transition"
            >
              <QrCode className="w-4 h-4 text-emerald-600" />
              <span>QR Code Flyer</span>
            </button>

            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition"
            >
              <span>View Live Website</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>

      {/* Analytics Summary Banner */}
      {website && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-emerald-600" />
              <span>Total Page Visitors</span>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {website.visitorCount || 0}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span>Enquiries & Leads</span>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {website.enquiryCount || 0}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
            <div className="text-xs font-semibold text-slate-400">Google Schema Status</div>
            <div className="text-xs font-bold text-emerald-700 mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>RealEstateAgent JSON-LD Active</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4 text-xs">
        <div>
          <label className="block font-bold text-slate-800 mb-1">
            Public Website URL Slug
          </label>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-mono text-xs bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl">
              propertytalk.co.nz/agent/
            </span>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="sarah-jenkins"
              className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-900"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-800 mb-1">Agency Brand Name</label>
            <input
              type="text"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              placeholder="e.g. Bayleys Real Estate Ponsonby"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">Service Area Suburbs (comma separated)</label>
            <input
              type="text"
              value={serviceAreasStr}
              onChange={(e) => setServiceAreasStr(e.target.value)}
              placeholder="Ponsonby, St Marys Bay, Grey Lynn, Herne Bay"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
            />
          </div>
        </div>

        <div>
          <label className="block font-bold text-slate-800 mb-1">Custom Headline / Value Proposition</label>
          <input
            type="text"
            value={customHeadline}
            onChange={(e) => setCustomHeadline(e.target.value)}
            placeholder="e.g. Auckland Central & Heritage Property Specialist"
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-800 mb-1">Custom Biography & Pitch</label>
          <textarea
            rows={4}
            value={customAbout}
            onChange={(e) => setCustomAbout(e.target.value)}
            placeholder="Share your track record, marketing philosophy, local heritage knowledge, and viewing availability..."
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-800 mb-1">Contact Phone</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="021 123 4567"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">Contact Email</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="sarah.jenkins@bayleys.co.nz"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
            />
          </div>
        </div>

        <div>
          <label className="block font-bold text-slate-800 mb-1">Cover Banner Image URL</label>
          <input
            type="url"
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder="https://images.unsplash.com/..."
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
          />
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          {savedSuccess && (
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Changes saved and published!
            </span>
          )}

          <button
            type="submit"
            disabled={saving}
            className="ml-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save & Update Mini-Website'}</span>
          </button>
        </div>
      </form>

      {/* QR Flyer Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center relative">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-black text-base text-slate-900">Signboard & Flyer QR</h3>
            <p className="text-xs text-slate-500 mt-1">
              Buyers can scan this code to access your listings and book remote live viewings directly.
            </p>

            <div className="my-5 p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block shadow-inner">
              <img src={qrUrl} alt="QR Code" className="w-48 h-48 mx-auto rounded-lg" />
            </div>

            <p className="text-[11px] text-slate-400 mb-4 font-mono break-all">{publicUrl}</p>

            <button
              type="button"
              onClick={() => window.print()}
              className="w-full py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl"
            >
              Print Flyer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
