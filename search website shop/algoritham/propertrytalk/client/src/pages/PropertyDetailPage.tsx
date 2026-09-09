import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Property, LiveViewingSession } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Bed,
  Bath,
  Car,
  Maximize2,
  MapPin,
  Calendar,
  Clock,
  Video,
  FileText,
  ShieldCheck,
  Building,
  Heart,
  Share2,
  ArrowLeft,
  CheckCircle2,
  Users,
  MessageSquare,
  Phone,
  AlertCircle,
  Download,
  Eye,
  ExternalLink,
} from 'lucide-react';

export const PropertyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [property, setProperty] = useState<Property | null>(null);
  const [liveSessions, setLiveSessions] = useState<LiveViewingSession[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  // Inquiry Modal State
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
  const [inquiryName, setInquiryName] = useState(user?.name || '');
  const [inquiryEmail, setInquiryEmail] = useState(user?.email || '');
  const [inquiryPhone, setInquiryPhone] = useState('');
  const [inquiryMessage, setInquiryMessage] = useState('Hi, I am interested in this property and would like more details.');
  const [inquirySuccess, setInquirySuccess] = useState(false);
  const [inquirySubmitting, setInquirySubmitting] = useState(false);

  // Physical Viewing Modal State
  const [isPhysicalModalOpen, setIsPhysicalModalOpen] = useState(false);
  const [physicalDate, setPhysicalDate] = useState('');
  const [physicalTime, setPhysicalTime] = useState('10:00');
  const [physicalNotes, setPhysicalNotes] = useState('');
  const [physicalSuccess, setPhysicalSuccess] = useState(false);
  const [physicalSubmitting, setPhysicalSubmitting] = useState(false);

  // Booking Group/Private Live Viewing Modal State
  const [selectedSessionForBooking, setSelectedSessionForBooking] = useState<LiveViewingSession | null>(null);
  const [bookingLiveSubmitting, setBookingLiveSubmitting] = useState(false);
  const [bookingLiveSuccess, setBookingLiveSuccess] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    api.get<Property>(`/properties/${id}`)
      .then((data) => {
        setProperty(data);
        setIsSaved(data.isSaved || false);
        if (data.liveViewingSessions) {
          setLiveSessions(data.liveViewingSessions);
        }
      })
      .catch((err) => {
        console.error('Failed to load property details:', err);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSaveToggle = async () => {
    if (!user) {
      navigate('/auth?mode=login');
      return;
    }
    if (!property) return;
    try {
      const res = await api.post<{ saved: boolean }>(`/properties/${property.id}/save`, {});
      setIsSaved(res.saved);
    } catch (err) {
      console.error('Failed to toggle save:', err);
    }
  };

  const handleSendInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property) return;
    try {
      setInquirySubmitting(true);
      await api.post(`/properties/${property.id}/inquiries`, {
        name: inquiryName,
        email: inquiryEmail,
        phone: inquiryPhone,
        message: inquiryMessage,
      });
      setInquirySuccess(true);
      setTimeout(() => {
        setIsInquiryModalOpen(false);
        setInquirySuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to send inquiry:', err);
      alert('Failed to send inquiry. Please try again.');
    } finally {
      setInquirySubmitting(false);
    }
  };

  const handleBookPhysicalViewing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/auth?mode=login');
      return;
    }
    if (!property || !physicalDate) return;
    try {
      setPhysicalSubmitting(true);
      await api.post(`/properties/${property.id}/book-physical-viewing`, {
        preferredDate: physicalDate,
        preferredTime: physicalTime,
        notes: physicalNotes,
      });
      setPhysicalSuccess(true);
      setTimeout(() => {
        setIsPhysicalModalOpen(false);
        setPhysicalSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to book viewing:', err);
      alert('Failed to book viewing. Please try again.');
    } finally {
      setPhysicalSubmitting(false);
    }
  };

  const handleBookLiveTicket = async (session: LiveViewingSession) => {
    if (!user) {
      navigate('/auth?mode=login');
      return;
    }
    try {
      setBookingLiveSubmitting(true);
      await api.post(`/live-viewings/${session.id}/book`, {});
      setBookingLiveSuccess(true);
      setTimeout(() => {
        setSelectedSessionForBooking(null);
        setBookingLiveSuccess(false);
        // Refresh page data
        api.get<Property>(`/properties/${id}`).then((data) => {
          setProperty(data);
          if (data.liveViewingSessions) setLiveSessions(data.liveViewingSessions);
        });
      }, 2000);
    } catch (err: any) {
      console.error('Failed to book live viewing ticket:', err);
      alert(err.response?.data?.error || err.message || 'Failed to book live viewing ticket.');
    } finally {
      setBookingLiveSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500 text-sm">Loading property details...</p>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Property Not Found</h2>
        <p className="text-xs text-slate-500 mt-1">
          This property listing may have expired or been removed.
        </p>
        <Link
          to="/explore"
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Explore</span>
        </Link>
      </div>
    );
  }

  const images = property.images && property.images.length > 0
    ? property.images
    : ['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80'];

  const priceText = property.priceDisplay || (property.priceMinorUnits
    ? (property.priceMinorUnits / 100).toLocaleString('en-NZ', {
        style: 'currency',
        currency: property.currency || 'NZD',
        maximumFractionDigits: 0,
      })
    : 'Price by Negotiation');

  const agentSlug = property.agentProfile?.user?.name
    ? property.agentProfile.user.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    : '';

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-5 pb-28 space-y-6">
      {/* Top Bar: Back, Title, Actions */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveToggle}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
              isSaved
                ? 'border-red-200 bg-red-50 text-red-600'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-current text-red-600' : ''}`} />
            <span>{isSaved ? 'Saved' : 'Save'}</span>
          </button>

          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: property.title, url: window.location.href });
              } else {
                navigator.clipboard.writeText(window.location.href);
                alert('Property link copied to clipboard!');
              }
            }}
            className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
            title="Share Property"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image Gallery */}
      <div className="space-y-2">
        <div className="aspect-16/9 sm:aspect-21/9 w-full rounded-3xl overflow-hidden bg-slate-900 relative shadow-md">
          <img
            src={images[activeImageIndex]}
            alt={property.title}
            className="w-full h-full object-cover transition-all duration-300"
          />
          <div className="absolute top-4 left-4 flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider text-white shadow-md ${
                property.listingType === 'FOR_SALE' ? 'bg-emerald-600' : 'bg-indigo-600'
              }`}
            >
              {property.listingType === 'FOR_SALE' ? 'For Sale' : 'For Rent'}
            </span>

            {property.remoteViewingAvailable && (
              <span className="text-xs font-extrabold bg-amber-500 text-slate-950 px-3 py-1 rounded-full flex items-center gap-1 shadow-md">
                <Video className="w-3.5 h-3.5 fill-current" />
                <span>Remote Live Viewing Available</span>
              </span>
            )}
          </div>

          <div className="absolute bottom-4 right-4 bg-slate-950/70 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-semibold">
            {activeImageIndex + 1} / {images.length}
          </div>
        </div>

        {/* Thumbnail Thumb Row */}
        {images.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImageIndex(idx)}
                className={`w-20 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition ${
                  activeImageIndex === idx ? 'border-emerald-600 scale-105 shadow-xs' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Grid: Details + Sticky Action Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Details, Specs, Documents, Remote Viewings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header Info */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {property.title}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 flex items-center gap-1 mt-1">
                  <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{property.streetAddress}, {property.suburb}, {property.city}</span>
                </p>
              </div>

              <div className="text-right shrink-0">
                <div className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight">
                  {priceText}
                  {property.listingType === 'FOR_RENT' && <span className="text-xs text-slate-500 font-medium"> /week</span>}
                </div>
                {property.rateableValue && (
                  <div className="text-[11px] text-slate-400 font-medium">
                    RV: ${(property.rateableValue / 100).toLocaleString('en-NZ')}
                  </div>
                )}
              </div>
            </div>

            {/* Spec Bar */}
            <div className="grid grid-cols-4 gap-2 pt-4 border-t border-slate-100 text-center">
              <div className="p-2 bg-slate-50 rounded-2xl">
                <Bed className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                <div className="text-xs font-bold text-slate-900">{property.bedrooms} Beds</div>
              </div>
              <div className="p-2 bg-slate-50 rounded-2xl">
                <Bath className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                <div className="text-xs font-bold text-slate-900">{property.bathrooms} Baths</div>
              </div>
              <div className="p-2 bg-slate-50 rounded-2xl">
                <Car className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                <div className="text-xs font-bold text-slate-900">{property.parkingSpaces} Cars</div>
              </div>
              <div className="p-2 bg-slate-50 rounded-2xl">
                <Maximize2 className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                <div className="text-xs font-bold text-slate-900">
                  {property.floorAreaM2 ? `${property.floorAreaM2} m²` : 'Section'}
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-3">
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
              Property Description
            </h2>
            <div className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {property.description}
            </div>

            {/* Additional details */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-xs text-slate-600">
              {property.landAreaM2 && (
                <div>
                  <span className="text-slate-400 block text-[11px]">Land Area</span>
                  <span className="font-semibold text-slate-800">{property.landAreaM2} m²</span>
                </div>
              )}
              {property.yearBuilt && (
                <div>
                  <span className="text-slate-400 block text-[11px]">Year Built</span>
                  <span className="font-semibold text-slate-800">{property.yearBuilt}</span>
                </div>
              )}
              {property.propertyType && (
                <div>
                  <span className="text-slate-400 block text-[11px]">Type</span>
                  <span className="font-semibold text-slate-800">{property.propertyType}</span>
                </div>
              )}
              {property.annualRatesMinorUnits && (
                <div>
                  <span className="text-slate-400 block text-[11px]">Council Rates</span>
                  <span className="font-semibold text-slate-800">${property.annualRatesMinorUnits / 100}/yr</span>
                </div>
              )}
            </div>
          </div>

          {/* REMOTE LIVE VIEWINGS SECTION */}
          {property.remoteViewingAvailable && (
            <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white rounded-3xl border border-amber-200 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900">
                      Paid Remote Live Viewing
                    </h2>
                    <p className="text-xs text-slate-600">
                      Walk through this home live in 10 minutes with the agent from anywhere.
                    </p>
                  </div>
                </div>
              </div>

              {/* Group & Private Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Group Option Card */}
                <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        Group Walkthrough
                      </span>
                      <span className="text-base font-black text-slate-900">$20 <span className="text-xs text-slate-400">NZD</span></span>
                    </div>
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 mt-2">
                      Group 10-Minute Remote Viewing
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Min 5 paid bookings required before broadcast starts. Automatic refund if quota is not reached. Viewer mic/camera kept strictly OFF with Q&A chat.
                    </p>
                  </div>

                  {liveSessions.find(s => s.viewingType === 'GROUP') ? (
                    <button
                      type="button"
                      onClick={() => setSelectedSessionForBooking(liveSessions.find(s => s.viewingType === 'GROUP')!)}
                      className="mt-3 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                    >
                      Book Group Ticket ($20)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => alert('Please contact the listing agent to schedule a Group Remote Viewing session for this property.')}
                      className="mt-3 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                    >
                      Request Group Session
                    </button>
                  )}
                </div>

                {/* Private Option Card */}
                <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        Private 1-on-1
                      </span>
                      <span className="text-base font-black text-slate-900">$60 <span className="text-xs text-slate-400">NZD</span></span>
                    </div>
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 mt-2">
                      Private 10-Minute Walkthrough
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Direct 1-on-1 audio and video walkthrough exclusively for you. Ask the agent to inspect specific rooms, storage, or views in detail.
                    </p>
                  </div>

                  {liveSessions.find(s => s.viewingType === 'PRIVATE') ? (
                    <button
                      type="button"
                      onClick={() => setSelectedSessionForBooking(liveSessions.find(s => s.viewingType === 'PRIVATE')!)}
                      className="mt-3 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                    >
                      Book Private Ticket ($60)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => alert('Please contact the listing agent to schedule a Private Remote Viewing slot for this property.')}
                      className="mt-3 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                    >
                      Request Private Session
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Documents Section */}
          {property.documents && property.documents.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Due Diligence & Documents</span>
              </h2>
              <p className="text-xs text-slate-500">
                Official property documentation provided by the seller or listing agent.
              </p>

              <div className="divide-y divide-slate-100">
                {property.documents.map((doc, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <div>
                        <span className="text-xs font-semibold text-slate-800 block">{doc.title}</span>
                        <span className="text-[10px] text-slate-400 uppercase">{doc.type}</span>
                      </div>
                    </div>

                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Sticky Contact & Booking Card */}
        <div className="space-y-4">
          {/* Agent or Private Seller Profile Card */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-4 sticky top-20">
            {property.agentProfile ? (
              <div>
                <div className="flex items-center gap-3">
                  <img
                    src={property.agentProfile.photoUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=160&q=80'}
                    alt={property.agentProfile.name}
                    className="w-14 h-14 rounded-2xl object-cover border border-slate-200"
                  />
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{property.agentProfile.name}</h3>
                    <p className="text-xs text-slate-500">{property.agentProfile.businessName || 'Licensed Agent'}</p>
                    <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold mt-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>REA Verified</span>
                    </div>
                  </div>
                </div>

                {agentSlug && (
                  <Link
                    to={`/agent/${agentSlug}`}
                    className="mt-3 w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
                  >
                    <span>View Agent Website & Listings</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            ) : (
              <div className="text-center py-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-2">
                  <Building className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">Private Seller Listing</h3>
                <p className="text-xs text-slate-500 mt-0.5">Listed directly by verified owner</p>
              </div>
            )}

            {/* Booking Actions */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsPhysicalModalOpen(true)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition active:scale-98"
              >
                <Calendar className="w-4 h-4" />
                <span>Book In-Person Viewing</span>
              </button>

              <button
                type="button"
                onClick={() => setIsInquiryModalOpen(true)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Free Property Inquiry</span>
              </button>

              {property.agentProfile && (
                <Link
                  to={`/experts/${property.agentProfile.id}`}
                  className="w-full py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Consult Agent Online (60s Free)</span>
                </Link>
              )}
            </div>

            {/* Marketplace Integrity Notice */}
            <div className="bg-slate-50 p-3 rounded-2xl text-[11px] text-slate-500 border border-slate-100 space-y-1">
              <div className="font-semibold text-slate-700 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                PropertyTalk Standards
              </div>
              <p>
                PropertyTalk operates as a verified advertising and viewing facilitation platform. All contracts are finalized legally through licensed solicitors.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Free Property Inquiry Modal */}
      {isInquiryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative">
            <h3 className="font-extrabold text-base text-slate-900">
              Send Inquiry to {property.agentProfile?.name || 'Seller'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Regarding: <strong>{property.title}</strong>
            </p>

            {inquirySuccess ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-slate-900">Inquiry Sent!</h4>
                <p className="text-xs text-slate-500">The listing contact has received your message.</p>
              </div>
            ) : (
              <form onSubmit={handleSendInquiry} className="space-y-3 mt-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Your Name</label>
                  <input
                    type="text"
                    required
                    value={inquiryName}
                    onChange={(e) => setInquiryName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Your Email</label>
                  <input
                    type="email"
                    required
                    value={inquiryEmail}
                    onChange={(e) => setInquiryEmail(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={inquiryPhone}
                    onChange={(e) => setInquiryPhone(e.target.value)}
                    placeholder="e.g. 021 123 4567"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Message</label>
                  <textarea
                    rows={3}
                    required
                    value={inquiryMessage}
                    onChange={(e) => setInquiryMessage(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsInquiryModalOpen(false)}
                    className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inquirySubmitting}
                    className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
                  >
                    {inquirySubmitting ? 'Sending...' : 'Send Inquiry'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Book In-Person Viewing Modal */}
      {isPhysicalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative">
            <h3 className="font-extrabold text-base text-slate-900">
              Schedule In-Person Viewing
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Select a preferred date and time to visit <strong>{property.title}</strong>
            </p>

            {physicalSuccess ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-slate-900">Viewing Request Submitted!</h4>
                <p className="text-xs text-slate-500">The agent will confirm your appointment shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleBookPhysicalViewing} className="space-y-3 mt-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Preferred Date</label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={physicalDate}
                    onChange={(e) => setPhysicalDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Time Slot</label>
                  <select
                    value={physicalTime}
                    onChange={(e) => setPhysicalTime(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="10:00">10:00 AM</option>
                    <option value="11:00">11:00 AM</option>
                    <option value="13:00">1:00 PM</option>
                    <option value="14:00">2:00 PM</option>
                    <option value="15:30">3:30 PM</option>
                    <option value="17:00">5:00 PM</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Notes / Questions</label>
                  <textarea
                    rows={2}
                    value={physicalNotes}
                    onChange={(e) => setPhysicalNotes(e.target.value)}
                    placeholder="e.g. Looking to buy in next 3 months, finance pre-approved"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPhysicalModalOpen(false)}
                    className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={physicalSubmitting}
                    className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
                  >
                    {physicalSubmitting ? 'Booking...' : 'Confirm Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Book Live Viewing Modal */}
      {selectedSessionForBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative">
            <h3 className="font-extrabold text-base text-slate-900">
              Confirm {selectedSessionForBooking.viewingType === 'GROUP' ? 'Group' : 'Private'} Live Viewing Ticket
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {property.title} • 10-Minute Remote Walkthrough
            </p>

            {bookingLiveSuccess ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-slate-900">Ticket Confirmed!</h4>
                <p className="text-xs text-slate-500">Your live viewing session is ready in Live Viewings.</p>
              </div>
            ) : (
              <div className="space-y-4 mt-4 text-xs">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex justify-between font-bold text-slate-900 text-sm">
                    <span>Ticket Fee:</span>
                    <span>${selectedSessionForBooking.ticketPriceMinorUnits / 100} NZD</span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-xs">
                    <span>Duration:</span>
                    <span>10 Minutes (Strict auto-end)</span>
                  </div>
                  {selectedSessionForBooking.viewingType === 'GROUP' && (
                    <div className="text-[11px] text-amber-700 font-medium">
                      * If 5 bookings are not received prior to start, you will be automatically refunded in full.
                    </div>
                  )}
                  <div className="text-[11px] text-slate-500">
                    Viewer camera & microphone remain OFF for your privacy. You can ask questions via live chat.
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSessionForBooking(null)}
                    className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={bookingLiveSubmitting}
                    onClick={() => handleBookLiveTicket(selectedSessionForBooking)}
                    className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs"
                  >
                    {bookingLiveSubmitting ? 'Processing...' : `Pay $${selectedSessionForBooking.ticketPriceMinorUnits / 100} & Book`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
