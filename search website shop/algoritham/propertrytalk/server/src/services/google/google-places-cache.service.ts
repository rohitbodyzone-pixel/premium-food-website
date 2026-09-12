import { prisma } from '../../db/prisma';
import {
  AmenityCategory,
  NearbyAmenityItem,
  NearbyAmenitiesResponse,
  IGooglePropertyProvider,
} from './google.interface';
import { formatDistanceText } from './mock-google.service';

const CATEGORY_LABELS: Record<string, string> = {
  schools: 'Schools',
  supermarkets: 'Supermarkets',
  hospitals: 'Hospitals',
  pharmacies: 'Pharmacies',
  parks: 'Parks',
  gyms: 'Gyms & Fitness',
  petrol_stations: 'Petrol Stations',
  cafes: 'Cafes',
  transit: 'Transit & Bus Stops',
};

export class GooglePlacesCacheService {
  /**
   * Retrieves nearby amenities for a property.
   * If cached and valid, returns cached results directly to protect API cost.
   * If not cached or expired, queries the provider, caches results in DB, and returns them.
   */
  async getOrFetchAmenities(
    propertyId: string,
    coordinates: { latitude: number; longitude: number },
    provider: IGooglePropertyProvider,
    options?: { ttlDays?: number; forceRefresh?: boolean }
  ): Promise<NearbyAmenitiesResponse> {
    const ttlDays = options?.ttlDays || 14;
    const now = new Date();

    // Check feature flag
    const placesConfig = await prisma.systemConfig.findUnique({
      where: { key: 'google_places_enabled' },
    });
    const isPlacesEnabled = placesConfig ? placesConfig.value === 'true' : true;

    if (!isPlacesEnabled) {
      return {
        enabled: false,
        message: 'Nearby amenities feature is currently disabled by administrator.',
        propertyId,
        coordinates,
        amenities: [],
        byCategory: {},
        categoriesAvailable: [],
        totalCount: 0,
        cached: false,
        fetchedAt: now.toISOString(),
      };
    }

    // 1. Check DB cache if not force refreshing
    if (!options?.forceRefresh) {
      const cachedRecords = await prisma.propertyAmenityCache.findMany({
        where: {
          propertyId,
          expiresAt: { gt: now },
        },
        orderBy: { distanceMeters: 'asc' },
      });

      if (cachedRecords.length > 0) {
        const amenities: NearbyAmenityItem[] = cachedRecords.map((r) => ({
          id: r.id,
          placeId: r.placeId,
          category: r.category as AmenityCategory,
          categoryLabel: CATEGORY_LABELS[r.category] || r.category,
          name: r.name,
          formattedAddress: r.formattedAddress || '',
          distanceMeters: r.distanceMeters || 0,
          distanceText: formatDistanceText(r.distanceMeters || 0),
          rating: r.rating,
          userRatingCount: r.userRatingCount,
          openNow: r.openNow,
          locationLat: r.locationLat || coordinates.latitude,
          locationLng: r.locationLng || coordinates.longitude,
        }));

        return this.formatResponse(propertyId, coordinates, amenities, true, cachedRecords[0].fetchedAt.toISOString());
      }
    }

    // 2. Fetch fresh from provider
    const freshItems = await provider.searchNearbyAmenities(coordinates.latitude, coordinates.longitude);

    // 3. Clear old cache for this property
    await prisma.propertyAmenityCache.deleteMany({
      where: { propertyId },
    }).catch(() => {});

    // 4. Cache fresh items with expiration TTL
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    const fetchedAt = new Date();

    if (freshItems.length > 0) {
      await prisma.$transaction(
        freshItems.map((item) =>
          prisma.propertyAmenityCache.create({
            data: {
              propertyId,
              category: item.category,
              placeId: item.placeId,
              name: item.name,
              formattedAddress: item.formattedAddress,
              distanceMeters: item.distanceMeters,
              rating: item.rating,
              userRatingCount: item.userRatingCount,
              openNow: item.openNow,
              locationLat: item.locationLat,
              locationLng: item.locationLng,
              fetchedAt,
              expiresAt,
            },
          })
        )
      ).catch((err) => {
        console.warn('[GooglePlacesCacheService] Error saving cache transaction:', err.message);
      });
    }

    return this.formatResponse(propertyId, coordinates, freshItems, false, fetchedAt.toISOString());
  }

  private formatResponse(
    propertyId: string,
    coordinates: { latitude: number; longitude: number },
    amenities: NearbyAmenityItem[],
    cached: boolean,
    fetchedAt: string
  ): NearbyAmenitiesResponse {
    const byCategory: Record<string, NearbyAmenityItem[]> = {};

    for (const item of amenities) {
      if (!byCategory[item.category]) {
        byCategory[item.category] = [];
      }
      byCategory[item.category].push(item);
    }

    const categoriesAvailable = Object.keys(byCategory);

    return {
      enabled: true,
      propertyId,
      coordinates,
      amenities,
      byCategory,
      categoriesAvailable,
      totalCount: amenities.length,
      cached,
      fetchedAt,
    };
  }

  async invalidateCache(propertyId: string): Promise<void> {
    await prisma.propertyAmenityCache.deleteMany({
      where: { propertyId },
    }).catch(() => {});
  }
}

export const placesCacheService = new GooglePlacesCacheService();
