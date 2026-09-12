export interface AddressValidationParams {
  streetAddress: string;
  suburb?: string;
  city: string;
  region?: string;
  postalCode?: string;
  countryCode?: string; // Default 'NZ'
}

export type AddressValidationStatus = 'VERIFIED' | 'NEEDS_CONFIRMATION' | 'COULD_NOT_VERIFY';

export interface CorrectedField {
  field: string;
  original: string;
  corrected: string;
}

export interface AddressValidationResult {
  status: AddressValidationStatus;
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
  rawVerdict?: any;
}

export interface GeocodeAddressParams {
  streetAddress: string;
  suburb?: string;
  city: string;
  region?: string;
  postalCode?: string;
  countryCode?: string;
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  googlePlaceId: string | null;
  formattedAddress: string;
  streetAddress: string;
  suburb: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
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
  enabled?: boolean;
  message?: string;
  propertyId: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  amenities: NearbyAmenityItem[];
  byCategory: Record<string, NearbyAmenityItem[]>;
  categoriesAvailable: string[];
  totalCount: number;
  cached: boolean;
  fetchedAt: string;
}

export interface IGooglePropertyProvider {
  validateAddress(params: AddressValidationParams): Promise<AddressValidationResult>;
  geocodeAddress(params: GeocodeAddressParams): Promise<GeocodingResult>;
  searchNearbyAmenities(
    lat: number,
    lng: number,
    options?: { radiusMeters?: number; categories?: AmenityCategory[] }
  ): Promise<NearbyAmenityItem[]>;
}
