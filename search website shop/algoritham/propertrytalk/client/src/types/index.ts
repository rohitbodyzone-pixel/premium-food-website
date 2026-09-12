export interface Country {
  code: string;
  name: string;
  flag: string;
  currency: string;
  currencySymbol: string;
  isActive: boolean;
  freeCallMinutesDefault: number;
  legalText?: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string;
  description: string;
  isActive: boolean;
  displayOrder: number;
}

export interface OfficialRegisterLink {
  id: string;
  countryCode: string;
  categoryId: string;
  title: string;
  urlPattern: string;
  notes?: string;
}

export interface Expert {
  id: string;
  userId: string;
  name: string;
  countryCode?: string;
  user?: { id: string; name: string; email?: string };
  photoUrl: string;
  title: string;
  bio?: string;
  category: Category;
  country: Country;
  city: string;
  yearsOfExperience: number;
  languages: string[];
  specialities: string[];
  ratingAvg: number;
  reviewCount: number;
  isOnline: boolean;
  verificationStatus: 'DRAFT' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED' | 'EXPIRED';
  hourlyRate: number;
  callPerMinuteRate: number;
  chatRateMinorUnits?: number;
  audioRateMinorUnits?: number;
  videoRateMinorUnits?: number;
  paidConsultationsEnabled?: boolean;
  payoutStatus?: string;
  stripeAccountId?: string;
  freeCallMinutes: number;
  businessName: string;
  businessRegNumber?: string;
  licenseNumber?: string;
  payoutDetails?: string;
  isSaved?: boolean;
  reviews?: Review[];
  availabilitySlots?: AvailabilitySlot[];
}

export interface AvailabilitySlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  role: 'CONSUMER' | 'EXPERT' | 'SUPER_ADMIN';
  phone?: string;
  phoneNumber?: string;
  phoneCountryCode?: string;
  phoneVerifiedAt?: string | null;
  countryCode?: string;
  accountStatus?: 'ACTIVE' | 'SUSPENDED';
  emailVerifiedAt?: string | null;
  expertProfile?: Expert;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  isSystem: boolean;
  readAt?: string;
  createdAt: string;
}

export type ConsultationChatStatus =
  | 'REQUESTED'
  | 'CONNECTED'
  | 'DECLINED'
  | 'MISSED'
  | 'CANCELLED'
  | 'EXPIRED_FREE'
  | 'PAID_ACTIVE'
  | 'ENDED'
  | 'ACTIVE'
  | 'CLOSED';

export interface ConsultationChat {
  id: string;
  consumerId: string;
  expertId: string;
  status: ConsultationChatStatus;
  requestedAt?: string;
  acceptedAt?: string;
  connectedAt?: string;
  declinedAt?: string;
  endedAt?: string;
  initialMessage?: string;
  declineReason?: string;
  freeSecondsRemaining: number;
  freeStartedAt?: string;
  freeExpiredAt?: string;
  isFreeExpired: boolean;
  extendedPaid: boolean;
  costCharged: number;
  createdAt: string;
  updatedAt: string;
  expert: Expert;
  consumer: { id: string; name: string; phone?: string };
  messages: ChatMessage[];
  calls?: CallSession[];
}

export interface CallSession {
  id: string;
  chatId: string;
  consumerId: string;
  expertId: string;
  callType: 'AUDIO' | 'VIDEO';
  status: 'REQUESTED' | 'ACCEPTED' | 'DECLINED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  freeMinutesAllowed: number;
  startedAt?: string;
  connectedAt?: string;
  endedAt?: string;
  durationSeconds: number;
  freeSecondsRemaining: number;
  freeTimeExpiredAt?: string;
  extendedPaid: boolean;
  costCharged: number;
  expert?: Expert;
  consumer?: { id: string; name: string };
  providerSession?: any;
  createdAt?: string;
}

export interface Appointment {
  id: string;
  expertId: string;
  consumerId: string;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  status: 'BOOKED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
  notes?: string;
  createdAt: string;
  expert?: Expert;
  consumer?: { id: string; name: string; email?: string; phone?: string };
}

export interface Review {
  id: string;
  expertId: string;
  consumerId: string;
  rating: number;
  comment: string;
  createdAt: string;
  consumer?: { id: string; name: string };
}

export interface VerificationDocument {
  id: string;
  expertProfileId: string;
  docType: string;
  title: string;
  fileUrl: string;
  uploadedAt: string;
}

export interface VerificationAuditLog {
  id: string;
  expertProfileId: string;
  adminUserId?: string;
  action: string;
  notes?: string;
  source?: string;
  createdAt: string;
  adminUser?: { name: string; email: string };
}

export interface Property {
  id: string;
  title: string;
  slug: string;
  description: string;
  propertyType: 'HOUSE' | 'APARTMENT' | 'TOWNHOUSE' | 'LAND' | 'COMMERCIAL' | 'LIFESTYLE';
  listingType: 'FOR_SALE' | 'FOR_RENT';
  priceMinorUnits?: number | null;
  priceDisplay: string;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  floorAreaM2?: number | null;
  landAreaM2?: number | null;
  yearBuilt?: number | null;
  annualRatesMinorUnits?: number | null;
  rateableValue?: number | null;
  currency?: string;
  streetAddress: string;
  suburb: string;
  city: string;
  countryCode: string;
  postalCode?: string | null;
  formattedAddress?: string | null;
  region?: string | null;
  googlePlaceId?: string | null;
  addressValidationStatus?: 'VERIFIED' | 'NEEDS_CONFIRMATION' | 'COULD_NOT_VERIFY' | null;
  latitude?: number | null;
  longitude?: number | null;
  images: string[];
  videoUrl?: string | null;
  documents?: { title: string; fileUrl: string; type: string }[];
  isPrivateListing: boolean;
  agentProfileId?: string | null;
  agentProfile?: Expert;
  status: 'ACTIVE' | 'UNDER_OFFER' | 'SOLD' | 'RENTED' | 'DRAFT' | 'ARCHIVED';
  isFeatured: boolean;
  isModerated: boolean;
  remoteViewingAvailable: boolean;
  viewsCount: number;
  legalDescription?: string | null;
  titleReference?: string | null;
  estateType?: string | null;
  councilName?: string | null;
  districtZoning?: string | null;
  capitalValueMinorUnits?: number | null;
  landValueMinorUnits?: number | null;
  improvementsValueMinorUnits?: number | null;
  valuationDate?: string | null;
  valuationSource?: string | null;
  estimatedValueMinorUnits?: number | null;
  estimatedLowerMinorUnits?: number | null;
  estimatedUpperMinorUnits?: number | null;
  estimateConfidence?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  estimateDate?: string | null;
  estimateSource?: string | null;
  rentWeeklyEstimatedMinorUnits?: number | null;
  rentWeeklyLowerMinorUnits?: number | null;
  rentWeeklyUpperMinorUnits?: number | null;
  rentEstimateDate?: string | null;
  rentEstimateSource?: string | null;
  isSaved?: boolean;
  liveViewingSessions?: LiveViewingSession[];
  createdAt: string;
  updatedAt: string;
}

export type AmenityCategory =
  | 'schools'
  | 'supermarkets'
  | 'hospitals'
  | 'pharmacies'
  | 'parks'
  | 'gyms'
  | 'petrol_stations'
  | 'cafes'
  | 'transit';

export interface NearbyAmenityItem {
  id: string;
  placeId: string;
  category: AmenityCategory;
  categoryLabel: string;
  name: string;
  formattedAddress: string;
  distanceMeters: number;
  distanceText: string;
  rating: number | null;
  userRatingCount: number | null;
  openNow: boolean | null;
  locationLat: number;
  locationLng: number;
}

export interface NearbyAmenitiesResponse {
  enabled: boolean;
  propertyId?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  amenities: NearbyAmenityItem[];
  byCategory: Record<string, NearbyAmenityItem[]>;
  categoriesAvailable: string[];
  totalCount: number;
  cached?: boolean;
  fetchedAt?: string;
  message?: string;
}

export interface CorrectedField {
  field: string;
  original: string;
  corrected: string;
  suggested?: string;
}

export interface AddressValidationResult {
  status: 'VERIFIED' | 'NEEDS_CONFIRMATION' | 'COULD_NOT_VERIFY';
  formattedAddress: string;
  streetAddress: string;
  suburb: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
  googlePlaceId: string | null;
  hasCorrections: boolean;
  correctedFields: CorrectedField[];
  unconfirmedComponents: string[];
  message: string;
  addressComponents?: {
    streetNumber?: string;
    route?: string;
    suburb?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  };
  geocodeGranularity?: string;
}

export interface LiveViewingSession {
  id: string;
  propertyId: string;
  hostProfileId: string;
  viewingType: 'GROUP' | 'PRIVATE';
  title?: string;
  scheduledAt: string;
  durationMinutes: number;
  ticketPriceMinorUnits: number;
  currency: string;
  minAttendees: number;
  maxCapacity: number;
  status: 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
  startedAt?: string | null;
  endedAt?: string | null;
  streamRoomId?: string | null;
  streamingCostMinorUnits: number;
  actualUsageMinutes?: number;
  streamingCostType?: 'ESTIMATED_TEST' | 'PROVIDER_ACTUAL';
  isProductionProvider?: boolean;
  providerCostDetails?: string | null;
  recordingAllowed: boolean;
  sellerConsentGiven: boolean;
  recordingRetentionDays: number;
  property?: Property;
  hostProfile?: Expert;
  confirmedCount?: number;
  spotsRemaining?: number;
  minQuotaMet?: boolean;
  userRole?: 'HOST' | 'CONFIRMED_VIEWER' | 'PENDING_VIEWER' | 'GUEST';
  createdAt: string;
}

export interface AgentMiniWebsite {
  id: string;
  expertProfileId: string;
  slug: string;
  customHeadline?: string;
  customAbout?: string;
  coverImageUrl?: string;
  agencyName?: string;
  agencyLogoUrl?: string;
  serviceAreas: string[];
  socialLinks: Record<string, string>;
  contactPhone?: string;
  contactEmail?: string;
  isPublished: boolean;
  isModerated: boolean;
  metaTitle?: string;
  metaDescription?: string;
  visitorCount: number;
  enquiryCount: number;
  expertProfile?: Expert;
  articles?: AgentArticle[];
  structuredData?: any;
}

export interface AgentArticle {
  id: string;
  agentProfileId: string;
  miniWebsiteId: string;
  title: string;
  slug: string;
  content: string;
  summary?: string;
  topic: string;
  targetCity?: string;
  targetSuburb?: string;
  metaTitle?: string;
  metaDescription?: string;
  status: 'DRAFT' | 'AGENT_REVIEW' | 'PUBLISHED' | 'ARCHIVED';
  source: 'AI_SUGGESTED' | 'MANUAL';
  isModerated: boolean;
  viewsCount: number;
  publishedAt?: string;
  lastReviewedAt?: string;
  agentProfile?: Expert;
  needsReview?: boolean;
  daysSinceUpdate?: number;
  analytics?: { views: number; estimatedImpressions: number; clicks: number };
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------
// Trade Me Property Insights Equivalent Interfaces
// ----------------------------------------------------

export interface NZSchoolItem {
  id: string;
  name: string;
  schoolType: string;
  distanceMeters: number;
  distanceText: string;
  yearLevels: string;
  gender: 'Co-educational' | 'Boys School' | 'Girls School';
  authority: 'State' | 'State-Integrated' | 'Private';
  zoneStatus: 'IN_ZONE' | 'OUT_OF_ZONE' | 'NOT_ZONED' | 'UNKNOWN' | 'UNAVAILABLE';
  decile?: number | null;
  enrolmentRoll?: number;
  source?: string;
  sourceUpdateDate?: string;
}

export interface PropertyValuationEstimate {
  available: boolean;
  estimatedValueMinorUnits?: number | null;
  estimatedValueDisplay?: string;
  estimatedLowerMinorUnits?: number | null;
  estimatedLowerDisplay?: string;
  estimatedUpperMinorUnits?: number | null;
  estimatedUpperDisplay?: string;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  lastUpdated?: string;
  source?: string;
  unavailabilityReason?: string;
}

export interface RentalEstimate {
  available: boolean;
  weeklyRentEstimatedMinorUnits?: number | null;
  weeklyRentDisplay?: string;
  weeklyLowerMinorUnits?: number | null;
  weeklyUpperMinorUnits?: number | null;
  weeklyRangeDisplay?: string;
  lastUpdated?: string;
  source?: string;
  label?: 'Property Rent Estimate' | 'Area Market Rent';
}

export interface RentalYieldResult {
  available: boolean;
  grossYieldPercentage?: number | null;
  grossYieldDisplay?: string;
  annualRentDisplay?: string;
  formula?: string;
  disclaimer?: string;
}

export interface PropertySalesHistoryItem {
  id: string;
  saleDate: string;
  saleYear: number;
  priceMinorUnits: number;
  priceDisplay: string;
  saleType: string;
}

export interface NearbySoldPropertyItem {
  id: string;
  address: string;
  suburb: string;
  city: string;
  soldPriceMinorUnits: number;
  soldPriceDisplay: string;
  soldDate: string;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  floorAreaM2?: number | null;
  propertyType: string;
  distanceMeters: number;
  distanceText: string;
  imageUrl?: string;
}

export interface PropertyLegalDetails {
  available?: boolean;
  parcelId?: string | null;
  legalDescription?: string | null;
  titleReference?: string | null;
  estateType?: string | null;
  landAreaM2?: number | null;
  floorAreaM2?: number | null;
  councilName?: string | null;
  districtZoning?: string | null;
  parcelGeometry?: any | null;
  source?: string;
  sourceRecordId?: string;
  status?: 'LIVE' | 'WAITING_FOR_PROVIDER_CREDENTIALS' | 'UNAVAILABLE';
  unavailabilityReason?: string;
  fetchedAt?: string | null;
  lastUpdated?: string | null;
}

export interface CouncilHazardOverlay {
  isHazardDataAvailable: boolean;
  councilName: string;
  status?: 'HAZARD_LAYER_MATCH' | 'NO_LAYER_INTERSECTION' | 'DATA_UNAVAILABLE' | 'PROVIDER_UNAVAILABLE';
  overlays: {
    type: string;
    label: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'INFO';
    description: string;
    sourceUrl?: string;
  }[];
  limNotice: string;
  unavailabilityReason?: string;
}

export interface DataSourceInfo {
  module: string;
  source: string;
  sourceRecordId?: string;
  sourceDate?: string;
  status: 'LIVE' | 'CACHED' | 'UNAVAILABLE' | 'WAITING_FOR_CREDENTIALS' | 'DISABLED';
  message?: string;
}

export interface TradeMePropertyInsightsResponse {
  propertyId: string;
  enabled?: boolean;
  message?: string;
  valuation: PropertyValuationEstimate;
  rental: RentalEstimate;
  rentalYield: RentalYieldResult;
  councilValuation: {
    capitalValueMinorUnits?: number | null;
    capitalValueDisplay?: string;
    landValueMinorUnits?: number | null;
    landValueDisplay?: string;
    improvementsValueMinorUnits?: number | null;
    improvementsValueDisplay?: string;
    valuationDate?: string | null;
    valuationSource?: string | null;
  };
  schools: {
    totalCount: number;
    inZoneCount: number;
    schools: NZSchoolItem[];
  };
  salesHistory: PropertySalesHistoryItem[];
  nearbySales: NearbySoldPropertyItem[];
  legalDetails: PropertyLegalDetails;
  hazards: CouncilHazardOverlay;
  dataSources?: DataSourceInfo[];
}

