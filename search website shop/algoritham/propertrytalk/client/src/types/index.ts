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
