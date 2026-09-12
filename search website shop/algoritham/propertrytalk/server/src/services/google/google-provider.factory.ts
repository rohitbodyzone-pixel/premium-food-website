import {
  IGooglePropertyProvider,
  AddressValidationParams,
  AddressValidationResult,
  GeocodeAddressParams,
  GeocodingResult,
  NearbyAmenityItem,
  AmenityCategory,
} from './google.interface';
import { GoogleAddressService } from './google-address.service';
import { GoogleGeocodingService } from './google-geocoding.service';
import { GooglePlacesService } from './google-places.service';
import { MockGooglePropertyProvider } from './mock-google.service';

export class RealGooglePropertyProvider implements IGooglePropertyProvider {
  private addressService: GoogleAddressService;
  private geocodingService: GoogleGeocodingService;
  private placesService: GooglePlacesService;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GOOGLE_MAPS_SERVER_API_KEY || '';
    this.addressService = new GoogleAddressService(key);
    this.geocodingService = new GoogleGeocodingService(key);
    this.placesService = new GooglePlacesService(key);
  }

  async validateAddress(params: AddressValidationParams): Promise<AddressValidationResult> {
    return this.addressService.validateAddress(params);
  }

  async geocodeAddress(params: GeocodeAddressParams): Promise<GeocodingResult> {
    return this.geocodingService.geocodeAddress(params);
  }

  async searchNearbyAmenities(
    lat: number,
    lng: number,
    options?: { radiusMeters?: number; categories?: AmenityCategory[] }
  ): Promise<NearbyAmenityItem[]> {
    return this.placesService.searchNearbyAmenities(lat, lng, options);
  }
}

let activeProviderInstance: IGooglePropertyProvider | null = null;

export function getGooglePropertyProvider(): IGooglePropertyProvider {
  if (activeProviderInstance) {
    return activeProviderInstance;
  }

  const explicitMode = (process.env.GOOGLE_PROVIDER || '').toLowerCase();
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;

  if (explicitMode === 'mock' || !apiKey) {
    activeProviderInstance = new MockGooglePropertyProvider();
    return activeProviderInstance;
  }

  activeProviderInstance = new RealGooglePropertyProvider(apiKey);
  return activeProviderInstance;
}

export function setGoogleProviderForTesting(provider: IGooglePropertyProvider | null): void {
  activeProviderInstance = provider;
}

export function resetGoogleProviderForTesting(): void {
  activeProviderInstance = null;
}

export function isGoogleLiveProvider(): boolean {
  const provider = getGooglePropertyProvider();
  return provider instanceof RealGooglePropertyProvider;
}

export function getGoogleAddressService(): { validateAddress: (params: AddressValidationParams) => Promise<AddressValidationResult> } {
  return getGooglePropertyProvider();
}

export function getGoogleGeocodingService(): { geocodeAddress: (params: GeocodeAddressParams) => Promise<GeocodingResult> } {
  return getGooglePropertyProvider();
}

export function getGooglePlacesService(): { searchNearbyAmenities: (lat: number, lng: number, options?: { radiusMeters?: number; categories?: AmenityCategory[] }) => Promise<NearbyAmenityItem[]> } {
  return getGooglePropertyProvider();
}
