import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AgentMiniWebsite, Property, AgentArticle } from '../types';
import { api } from '../services/api';
import { PropertyCard } from '../components/cards/PropertyCard';
import {
  ShieldCheck,
  Star,
  MapPin,
  QrCode,
  Share2,
  Mail,
  Phone,
  Building,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  MessageSquare,
  ExternalLink,
  X,
} from 'lucide-react';

export const AgentMiniWebsitePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const [website, setWebsite] = useState<AgentMiniWebsite | null>(null);
  const [activeProperties, setActiveProperties] = useState<Property[]>([]);
  const [soldProperties, setSoldProperties] = useState<Property[]>([]);
  const [articles, setArticles] = useState<AgentArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [propertyTab, setPropertyTab] = useState<'ACTIVE' | 'SOLD'>('ACTIVE');

  // Contact / Lead Form State
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadType, setLeadType] = useState('APPRAISAL');
  const [leadMessage, setLeadMessage] = useState('');
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState(false);

  // QR Code Modal State
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);

    api.get<AgentMiniWebsite>(`/agent-websites/${slug}`)
      .then((data) => {
        setWebsite(data);
        if (data.metaTitle) {
          document.title = data.metaTitle;
        } else if (data.expertProfile?.name) {
          document.title = `${data.expertProfile.name} | Licensed Real Estate Agent | PropertyTalk`;
        }

        // Meta description
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
          metaDesc = document.createElement('meta');
          metaDesc.setAttribute('name', 'description');
          document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute(
          'content',
          data.metaDescription || `Connect with ${data.expertProfile?.name || 'licensed agent'} on PropertyTalk for property valuations and remote live viewings.`
        );

        // Canonical link
        let canonical = document.querySelector('link[rel="canonical"]');
        if (!canonical) {
          canonical = document.createElement('link');
          canonical.setAttribute('rel', 'canonical');
          document.head.appendChild(canonical);
        }
        canonical.setAttribute('href', `https://propertytalk.co.nz/agent/${slug}`);

        if (data.expertProfileId) {
          // Fetch agent's properties
          api.get<{ properties: Property[] }>(`/properties?agentProfileId=${data.expertProfileId}`)
            .then((res) => {
              const allProps = res.properties || [];
              setActiveProperties(allProps.filter(p => p.status === 'ACTIVE'));
              setSoldProperties(allProps.filter(p => p.status === 'SOLD'));
            })
            .catch(console.error);

          // Fetch agent's published articles
          api.get<{ articles: AgentArticle[] }>(`/articles/agent/${data.expertProfileId}?status=PUBLISHED`)
            .then((res) => setArticles(res.articles || []))
            .catch(console.error);
        }
      })
      .catch((err) => {
        console.error('Failed to load agent website:', err);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    try {
      setLeadSubmitting(true);
      await api.post(`/agent-websites/${slug}/leads`, {
        name: leadName,
        email: leadEmail,
        phone: leadPhone,
        enquiryType: leadType,
        message: leadMessage,
      });
      setLeadSuccess(true);
      setTimeout(() => {
        setLeadSuccess(false);
        setLeadMessage('');
      }, 3000);
    } catch (err) {
      console.error('Failed to submit enquiry:', err);
      alert('Failed to send message. Please try again.');
    } finally {
      setLeadSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500 text-sm">Loading agent profile...</p>
      </div>
    );
  }

  if (!website || !website.expertProfile) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Agent Website Not Found</h2>
        <p className="text-xs text-slate-500 mt-1">
          This agent website may have moved or is pending publishing.
        </p>
        <Link
          to="/"
          className="mt-4 inline-block px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
        >
          Return Home
        </Link>
      </div>
    );
  }

  const agent = website.expertProfile;
  const agentName = (agent as any).user?.name || agent.name || website.agencyName || 'Sarah Jenkins';
  const firstName = agentName.split(' ')[0] || 'Agent';
  const currentUrl = window.location.href;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(currentUrl)}`;

  const serviceAreasList: string[] = (() => {
    if (Array.isArray(website.serviceAreas)) return website.serviceAreas;
    if (typeof website.serviceAreas === 'string') {
      try {
        const parsed = JSON.parse(website.serviceAreas);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return ['Auckland Central', 'Ponsonby'];
  })();

  // Structured Data Schema for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: agentName,
    description: website.customAbout || agent.bio,
    image: agent.photoUrl,
    telephone: website.contactPhone,
    email: website.contactEmail,
    address: {
      '@type': 'PostalAddress',
      addressLocality: agent.city || 'Auckland',
      addressCountry: 'NZ',
    },
    areaServed: serviceAreasList,
    priceRange: '$$$$',
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 pb-28 space-y-8">
      {/* Inject Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header Banner & Profile Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Cover image banner */}
        <div className="h-44 sm:h-60 w-full bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 relative overflow-hidden">
          {website.coverImageUrl ? (
            <img
              src={website.coverImageUrl}
              alt="Cover"
              className="w-full h-full object-cover opacity-60"
            />
          ) : (
            <div className="w-full h-full bg-slate-900 opacity-80" />
          )}

          {/* Top Actions: QR code & Share */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsQrModalOpen(true)}
              className="flex items-center gap-1.5 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800 hover:bg-white shadow-xs transition"
              title="Generate QR Code"
            >
              <QrCode className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">QR Flyer</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: agentName, url: currentUrl });
                } else {
                  navigator.clipboard.writeText(currentUrl);
                  alert('Agent link copied!');
                }
              }}
              className="p-2 bg-white/90 backdrop-blur-md rounded-xl text-slate-800 hover:bg-white shadow-xs transition"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Agent Profile Details row */}
        <div className="px-5 sm:px-8 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-16 sm:-mt-20 mb-4">
            <div className="flex items-end gap-4">
              <img
                src={agent.photoUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=240&q=80'}
                alt={agentName}
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl object-cover border-4 border-white shadow-lg bg-white shrink-0"
              />
              <div className="mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {agentName}
                  </h1>
                  <span className="text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>REA Licensed</span>
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-600">
                  {website.agencyName || agent.businessName || 'Bayleys Real Estate'} • {agent.city || 'Auckland'}
                </p>
                {agent.licenseNumber && (
                  <p className="text-[11px] text-slate-400">
                    License: #{agent.licenseNumber} (Real Estate Authority NZ)
                  </p>
                )}
              </div>
            </div>

            {/* Direct Connect Buttons */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Link
                to={`/chat/agent-${agent.id}`}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Free Chat / Advice</span>
              </Link>
            </div>
          </div>

          {/* Headline & About */}
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
              {website.customHeadline || 'Auckland Luxury & Heritage Property Specialist'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
              {website.customAbout || agent.bio || 'With extensive experience across New Zealand residential property, I provide genuine local expertise, verified market appraisals, and seamless remote live viewings.'}
            </p>

            {/* Service Areas */}
            {serviceAreasList.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap pt-2">
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Suburbs:
                </span>
                {serviceAreasList.map((area, idx) => (
                  <span
                    key={idx}
                    className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-lg"
                  >
                    {area}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Listings & Contact Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Properties & Articles */}
        <div className="lg:col-span-2 space-y-6">
          {/* Properties Section */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Listings by {firstName}
              </h2>

              {/* Active vs Sold Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setPropertyTab('ACTIVE')}
                  className={`px-3 py-1 rounded-lg transition ${
                    propertyTab === 'ACTIVE'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Active ({activeProperties.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPropertyTab('SOLD')}
                  className={`px-3 py-1 rounded-lg transition ${
                    propertyTab === 'SOLD'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Recently Sold ({soldProperties.length})
                </button>
              </div>
            </div>

            {/* Properties Grid */}
            {propertyTab === 'ACTIVE' ? (
              activeProperties.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeProperties.map((p) => (
                    <PropertyCard key={p.id} property={p} />
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  No active listings at this moment. Contact {firstName} for off-market opportunities.
                </div>
              )
            ) : soldProperties.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {soldProperties.map((p) => (
                  <PropertyCard key={p.id} property={p} />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No archived sold listings displayed.
              </div>
            )}
          </div>

          {/* Published Articles & Market Guides */}
          {articles.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Local Market Guides by {firstName}
                </h2>
              </div>

              <div className="space-y-3">
                {articles.map((article) => (
                  <Link
                    key={article.id}
                    to={`/articles/${article.id}`}
                    className="block p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-emerald-500 transition group"
                  >
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                      {article.targetSuburb ? `${article.targetSuburb}, ${article.targetCity}` : 'NZ Property Guide'}
                    </span>
                    <h3 className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition mt-0.5">
                      {article.title}
                    </h3>
                    {article.summary && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{article.summary}</p>
                    )}
                    <div className="mt-2 text-[11px] font-bold text-emerald-600 flex items-center gap-0.5">
                      <span>Read article</span>
                      <span>&rarr;</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Lead Contact Form */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4 sticky top-20">
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                Contact {firstName}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Request a free market appraisal or ask questions about buying or selling.
              </p>
            </div>

            {leadSuccess ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-slate-900">Enquiry Sent!</h4>
                <p className="text-xs text-slate-500">
                  {firstName} has received your details and will get back to you shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleLeadSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Enquiry Type</label>
                  <select
                    value={leadType}
                    onChange={(e) => setLeadType(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="APPRAISAL">Free Property Appraisal</option>
                    <option value="BUYING">Looking to Buy in this Area</option>
                    <option value="SELLING">Planning to Sell</option>
                    <option value="GENERAL">General Property Question</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Your Name</label>
                  <input
                    type="text"
                    required
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    placeholder="Full name"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={leadEmail}
                    onChange={(e) => setLeadEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone (Optional)</label>
                  <input
                    type="tel"
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                    placeholder="e.g. 021 123 4567"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Message</label>
                  <textarea
                    rows={3}
                    required
                    value={leadMessage}
                    onChange={(e) => setLeadMessage(e.target.value)}
                    placeholder="Tell Sarah about your property or what you're looking for..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <button
                  type="submit"
                  disabled={leadSubmitting}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-98"
                >
                  {leadSubmitting ? 'Sending...' : 'Send Enquiry to Agent'}
                </button>
              </form>
            )}

            {/* Direct Contact Info */}
            <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
              {website.contactPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <a href={`tel:${website.contactPhone}`} className="hover:underline">
                    {website.contactPhone}
                  </a>
                </div>
              )}
              {website.contactEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-emerald-600" />
                  <a href={`mailto:${website.contactEmail}`} className="hover:underline">
                    {website.contactEmail}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Offline Marketing Modal */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center relative">
            <button
              onClick={() => setIsQrModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
              <QrCode className="w-6 h-6" />
            </div>

            <h3 className="font-extrabold text-base text-slate-900">
              Offline Flyer & Signboard QR
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Print this QR code on open home flyers, signboards, or business cards.
            </p>

            <div className="my-5 p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block shadow-inner">
              <img
                src={qrCodeUrl}
                alt="Agent QR Code"
                className="w-48 h-48 mx-auto rounded-lg"
              />
            </div>

            <p className="text-[11px] text-slate-400 mb-4 font-mono break-all">
              {currentUrl}
            </p>

            <button
              type="button"
              onClick={() => window.print()}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl"
            >
              Print QR Code Flyer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
