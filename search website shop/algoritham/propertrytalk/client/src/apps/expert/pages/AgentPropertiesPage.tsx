import React, { useState, useEffect } from 'react';
import { Property, AddressValidationResult } from '../../../types';
import { api } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { PropertyMap } from '../../../components/property/PropertyMap';
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  Sparkles,
  Video,
  Eye,
  MapPin,
  Bed,
  Bath,
  Car,
  X,
  ExternalLink,
} from 'lucide-react';

export const AgentPropertiesPage: React.FC = () => {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [suburb, setSuburb] = useState('');
  const [city, setCity] = useState('Auckland');
  const [region, setRegion] = useState('Auckland');
  const [postalCode, setPostalCode] = useState('');
  const [listingType, setListingType] = useState<'FOR_SALE' | 'FOR_RENT'>('FOR_SALE');
  const [propertyType, setPropertyType] = useState('HOUSE');
  const [priceMinorUnits, setPriceMinorUnits] = useState('1250000');
  const [priceDisplay, setPriceDisplay] = useState('$1,250,000');
  const [bedrooms, setBedrooms] = useState(3);
  const [bathrooms, setBathrooms] = useState(2);
  const [parkingSpaces, setParkingSpaces] = useState(2);
  const [floorAreaM2, setFloorAreaM2] = useState(180);
  const [description, setDescription] = useState('');
  const [remoteViewingAvailable, setRemoteViewingAvailable] = useState(true);
  const [imageUrl, setImageUrl] = useState('https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80');

  // Address Validation & Geocoding State
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<AddressValidationResult | null>(null);
  const [validationStatus, setValidationStatus] = useState<'VERIFIED' | 'NEEDS_CONFIRMATION' | 'COULD_NOT_VERIFY' | null>(null);
  const [validatedCoords, setValidatedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [validatedFormattedAddress, setValidatedFormattedAddress] = useState('');
  const [validatedPlaceId, setValidatedPlaceId] = useState('');
  const [showCorrectionBanner, setShowCorrectionBanner] = useState(false);

  const loadProperties = async () => {
    if (!user?.expertProfile?.id) return;
    try {
      setLoading(true);
      const res = await api.get<{ properties: Property[] }>(`/properties?agentProfileId=${user.expertProfile.id}`);
      setProperties(res.properties || []);
    } catch (err) {
      console.error('Failed to load agent properties:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProperties();
  }, [user]);

  const handleValidateAddress = async () => {
    if (!streetAddress || !city) {
      alert('Please enter at least a street address and city before validating.');
      return;
    }
    try {
      setValidating(true);
      const res = await api.post<{ success: boolean; result: AddressValidationResult }>('/properties/validate-address', {
        streetAddress,
        suburb,
        city,
        region,
        postalCode,
        country: 'NZ',
      });

      if (res.result) {
        setValidationResult(res.result);
        setValidationStatus(res.result.status);
        if (res.result.formattedAddress) {
          setValidatedFormattedAddress(res.result.formattedAddress);
        }
        if (res.result.latitude && res.result.longitude) {
          setValidatedCoords({ lat: res.result.latitude, lng: res.result.longitude });
        }
        if (res.result.googlePlaceId) {
          setValidatedPlaceId(res.result.googlePlaceId);
        }
        if (res.result.hasCorrections || res.result.status === 'NEEDS_CONFIRMATION') {
          setShowCorrectionBanner(true);
        } else {
          setShowCorrectionBanner(false);
        }
      }
    } catch (err: any) {
      console.error('Failed to validate address:', err);
      setValidationStatus('COULD_NOT_VERIFY');
    } finally {
      setValidating(false);
    }
  };

  const handleApplyCorrections = () => {
    if (!validationResult) return;
    const comps = validationResult.addressComponents;
    if (comps) {
      if (comps.streetNumber && comps.route) {
        setStreetAddress(`${comps.streetNumber} ${comps.route}`);
      }
      if (comps.suburb) setSuburb(comps.suburb);
      if (comps.city) setCity(comps.city);
      if (comps.region) setRegion(comps.region);
      if (comps.postalCode) setPostalCode(comps.postalCode);
    } else {
      if (validationResult.streetAddress) setStreetAddress(validationResult.streetAddress);
      if (validationResult.suburb) setSuburb(validationResult.suburb);
      if (validationResult.city) setCity(validationResult.city);
      if (validationResult.region) setRegion(validationResult.region);
      if (validationResult.postalCode) setPostalCode(validationResult.postalCode);
    }
    setShowCorrectionBanner(false);
    setValidationStatus('VERIFIED');
  };

  const handleDismissCorrections = () => {
    setShowCorrectionBanner(false);
  };

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.post('/properties', {
        title,
        streetAddress,
        suburb,
        city,
        region: region || undefined,
        postalCode: postalCode || undefined,
        listingType,
        propertyType,
        priceMinorUnits: Number(priceMinorUnits) * 100,
        priceDisplay: priceDisplay || `$${Number(priceMinorUnits).toLocaleString()}`,
        bedrooms: Number(bedrooms),
        bathrooms: Number(bathrooms),
        parkingSpaces: Number(parkingSpaces),
        floorAreaM2: Number(floorAreaM2),
        description,
        remoteViewingAvailable,
        images: [imageUrl],
        latitude: validatedCoords?.lat,
        longitude: validatedCoords?.lng,
        googlePlaceId: validatedPlaceId || undefined,
        formattedAddress: validatedFormattedAddress || undefined,
        addressValidationStatus: validationStatus || 'COULD_NOT_VERIFY',
      });
      setIsCreateModalOpen(false);
      resetForm();
      loadProperties();
    } catch (err: any) {
      console.error('Failed to create property listing:', err);
      alert(err.response?.data?.error || err.message || 'Failed to create property');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setStreetAddress('');
    setSuburb('');
    setCity('Auckland');
    setRegion('Auckland');
    setPostalCode('');
    setDescription('');
    setValidationResult(null);
    setValidationStatus(null);
    setValidatedCoords(null);
    setValidatedFormattedAddress('');
    setValidatedPlaceId('');
    setShowCorrectionBanner(false);
  };

  const handleStatusChange = async (propertyId: string, status: string) => {
    try {
      await api.put(`/properties/${propertyId}`, { status });
      loadProperties();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleDelete = async (propertyId: string) => {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    try {
      await api.delete(`/properties/${propertyId}`);
      loadProperties();
    } catch (err) {
      console.error('Failed to delete property:', err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            My Property Listings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage your active sales, rentals, and remote live viewing sessions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Listing</span>
        </button>
      </div>

      {/* Properties Table / Grid */}
      {loading ? (
        <div className="py-12 text-center">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading listings...</p>
        </div>
      ) : properties.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs flex flex-col justify-between">
              <div>
                <div className="relative aspect-16/9 bg-slate-100">
                  <img
                    src={p.images?.[0] || 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80'}
                    alt={p.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 flex gap-1">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-900 text-white">
                      {p.status}
                    </span>
                    {p.remoteViewingAvailable && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 flex items-center gap-1">
                        <Video className="w-3 h-3" /> Live Viewing
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  <div className="text-lg font-black text-slate-900">
                    {p.priceDisplay || `$${(p.priceMinorUnits || 0) / 100}`}
                  </div>
                  <h3 className="font-bold text-sm text-slate-800 line-clamp-1 mt-0.5">{p.title}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{p.streetAddress}, {p.suburb}</span>
                  </p>

                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
                    <div className="flex items-center gap-1">
                      <Bed className="w-3.5 h-3.5 text-slate-400" />
                      <span>{p.bedrooms}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Bath className="w-3.5 h-3.5 text-slate-400" />
                      <span>{p.bathrooms}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Car className="w-3.5 h-3.5 text-slate-400" />
                      <span>{p.parkingSpaces}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                <select
                  value={p.status}
                  onChange={(e) => handleStatusChange(p.id, e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="UNDER_OFFER">UNDER OFFER</option>
                  <option value="SOLD">SOLD</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                    title="Delete listing"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-sm">No Property Listings Yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Add your active sales or rentals to showcase them on your agent mini-website and enable remote live viewings.
          </p>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl"
          >
            Create Your First Listing
          </button>
        </div>
      )}

      {/* Add Listing Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 relative my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-base text-slate-900">Add Property Listing</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProperty} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Listing Headline / Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Stunning Renovated Heritage Villa"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Listing Type</label>
                  <select
                    value={listingType}
                    onChange={(e) => setListingType(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="FOR_SALE">For Sale</option>
                    <option value="FOR_RENT">For Rent</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Property Type</label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="HOUSE">House</option>
                    <option value="APARTMENT">Apartment</option>
                    <option value="TOWNHOUSE">Townhouse</option>
                    <option value="LAND">Section / Land</option>
                  </select>
                </div>
              </div>

              {/* Address Fields */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    Property Address (New Zealand)
                  </span>
                  {validationStatus === 'VERIFIED' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Address Verified
                    </span>
                  )}
                  {validationStatus === 'NEEDS_CONFIRMATION' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" /> Needs Review
                    </span>
                  )}
                  {validationStatus === 'COULD_NOT_VERIFY' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                      <HelpCircle className="w-3 h-3" /> Unverified
                    </span>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Street Address</label>
                  <input
                    type="text"
                    required
                    value={streetAddress}
                    onChange={(e) => {
                      setStreetAddress(e.target.value);
                      setValidationStatus(null);
                    }}
                    placeholder="e.g. 14 Hamilton Road"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Suburb</label>
                    <input
                      type="text"
                      required
                      value={suburb}
                      onChange={(e) => {
                        setSuburb(e.target.value);
                        setValidationStatus(null);
                      }}
                      placeholder="e.g. Ponsonby"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">City</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        setValidationStatus(null);
                      }}
                      placeholder="e.g. Auckland"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Region</label>
                    <input
                      type="text"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder="e.g. Auckland"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Postal Code</label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="e.g. 1011"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>

                {/* Validate Address Action */}
                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-slate-500">
                    Verify against Google Address Validation to get authoritative coordinates and nearby amenities.
                  </p>
                  <button
                    type="button"
                    disabled={validating || !streetAddress || !city}
                    onClick={handleValidateAddress}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-xs transition"
                  >
                    {validating ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Validating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Validate Address</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Google Correction Suggestion Banner */}
                {showCorrectionBanner && validationResult && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-amber-900">Google suggested corrections:</p>
                          <p className="text-amber-800 font-medium mt-0.5">
                            {validationResult.formattedAddress}
                          </p>
                          {validationResult.correctedFields && validationResult.correctedFields.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5 text-[11px] text-amber-700">
                              {validationResult.correctedFields.map((cf, i) => (
                                <li key={i}>
                                  <span className="font-bold capitalize">{cf.field}:</span>{' '}
                                  <span className="line-through text-slate-500">{cf.original || '(empty)'}</span> →{' '}
                                  <span className="font-semibold text-emerald-800">{cf.suggested || cf.corrected}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-amber-200/60">
                      <button
                        type="button"
                        onClick={handleApplyCorrections}
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-lg shadow-xs transition"
                      >
                        Accept Suggested Address
                      </button>
                      <button
                        type="button"
                        onClick={handleDismissCorrections}
                        className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] rounded-lg border border-slate-200 transition"
                      >
                        Keep Original
                      </button>
                    </div>
                  </div>
                )}

                {/* Map Location Preview */}
                {validatedCoords && (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-[11px] text-slate-700 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-emerald-600" />
                        Location Map Preview ({validatedCoords.lat.toFixed(4)}, {validatedCoords.lng.toFixed(4)})
                      </span>
                      {validationResult?.geocodeGranularity && (
                        <span className="text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {validationResult.geocodeGranularity}
                        </span>
                      )}
                    </div>
                    <PropertyMap
                      latitude={validatedCoords.lat}
                      longitude={validatedCoords.lng}
                      address={validatedFormattedAddress || `${streetAddress}, ${suburb}, ${city}`}
                      title={title || 'Listing Preview'}
                      heightClass="h-44"
                      showDirections={false}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Price ($ NZD)</label>
                  <input
                    type="number"
                    required
                    value={priceMinorUnits}
                    onChange={(e) => setPriceMinorUnits(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Display Text</label>
                  <input
                    type="text"
                    value={priceDisplay}
                    onChange={(e) => setPriceDisplay(e.target.value)}
                    placeholder="e.g. By Negotiation or $1,250,000"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Beds</label>
                  <input
                    type="number"
                    value={bedrooms}
                    onChange={(e) => setBedrooms(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Baths</label>
                  <input
                    type="number"
                    value={bathrooms}
                    onChange={(e) => setBathrooms(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cars</label>
                  <input
                    type="number"
                    value={parkingSpaces}
                    onChange={(e) => setParkingSpaces(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Floor (m²)</label>
                  <input
                    type="number"
                    value={floorAreaM2}
                    onChange={(e) => setFloorAreaM2(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Photo Image URL</label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the property's key features, location benefits, zoning..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 block">Enable Remote Live Viewing</span>
                  <span className="text-[11px] text-slate-500">Allow buyers to book Group ($20) or Private ($60) 10-minute live walkthroughs.</span>
                </div>
                <input
                  type="checkbox"
                  checked={remoteViewingAvailable}
                  onChange={(e) => setRemoteViewingAvailable(e.target.checked)}
                  className="w-5 h-5 accent-emerald-600"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="w-1/2 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
                >
                  {submitting ? 'Publishing...' : 'Publish Listing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
