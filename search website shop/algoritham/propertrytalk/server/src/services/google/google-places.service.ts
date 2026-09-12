import { AmenityCategory, NearbyAmenityItem } from './google.interface';
import { calculateDistanceMeters, formatDistanceText } from './mock-google.service';

const CATEGORY_MAPPINGS: Record<
  AmenityCategory,
  { label: string; includedTypes: string[]; maxResults: number }
> = {
  schools: {
    label: 'Schools',
    includedTypes: ['school', 'primary_school', 'secondary_school'],
    maxResults: 5,
  },
  supermarkets: {
    label: 'Supermarkets',
    includedTypes: ['supermarket', 'grocery_store'],
    maxResults: 5,
  },
  hospitals: {
    label: 'Hospitals',
    includedTypes: ['hospital'],
    maxResults: 3,
  },
  pharmacies: {
    label: 'Pharmacies',
    includedTypes: ['pharmacy'],
    maxResults: 4,
  },
  parks: {
    label: 'Parks',
    includedTypes: ['park'],
    maxResults: 4,
  },
  gyms: {
    label: 'Gyms & Fitness',
    includedTypes: ['gym', 'fitness_center'],
    maxResults: 4,
  },
  petrol_stations: {
    label: 'Petrol Stations',
    includedTypes: ['gas_station'],
    maxResults: 3,
  },
  cafes: {
    label: 'Cafes',
    includedTypes: ['cafe', 'coffee_shop'],
    maxResults: 5,
  },
  transit: {
    label: 'Transit & Bus Stops',
    includedTypes: ['bus_stop', 'transit_station', 'train_station'],
    maxResults: 5,
  },
};

export class GooglePlacesService {
  private apiKey: string;
  private timeoutMs: number;

  constructor(apiKey?: string, timeoutMs = 8000) {
    this.apiKey = apiKey || process.env.GOOGLE_MAPS_SERVER_API_KEY || '';
    this.timeoutMs = timeoutMs;
  }

  async searchNearbyAmenities(
    lat: number,
    lng: number,
    options?: { radiusMeters?: number; categories?: AmenityCategory[] }
  ): Promise<NearbyAmenityItem[]> {
    if (!this.apiKey) {
      throw new Error('Google Maps Server API Key is not configured.');
    }

    const radius = Math.min(10000, Math.max(500, options?.radiusMeters || 3000));
    const categoriesToSearch = options?.categories || (Object.keys(CATEGORY_MAPPINGS) as AmenityCategory[]);

    const allItems: NearbyAmenityItem[] = [];

    // Search categories in parallel batches of 3 to avoid rate spikes
    for (let i = 0; i < categoriesToSearch.length; i += 3) {
      const batch = categoriesToSearch.slice(i, i + 3);
      const batchPromises = batch.map((category) =>
        this.fetchCategoryPlaces(lat, lng, radius, category).catch((err) => {
          console.warn(`[GooglePlacesService] Error fetching category ${category}:`, err.message);
          return [] as NearbyAmenityItem[];
        })
      );
      const results = await Promise.all(batchPromises);
      for (const res of results) {
        allItems.push(...res);
      }
    }

    return allItems.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  private async fetchCategoryPlaces(
    lat: number,
    lng: number,
    radius: number,
    category: AmenityCategory
  ): Promise<NearbyAmenityItem[]> {
    const config = CATEGORY_MAPPINGS[category];
    if (!config) return [];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const payload = {
      includedTypes: config.includedTypes,
      maxResultCount: config.maxResults,
      locationRestriction: {
        circle: {
          center: {
            latitude: lat,
            longitude: lng,
          },
          radius: Number(radius),
        },
      },
    };

    try {
      const url = 'https://places.googleapis.com/v1/places:searchNearby';
      const fieldMask = [
        'places.id',
        'places.displayName',
        'places.location',
        'places.formattedAddress',
        'places.rating',
        'places.userRatingCount',
        'places.currentOpeningHours.openNow',
        'places.types',
        'places.primaryType',
      ].join(',');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': fieldMask,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Google Places API returned HTTP ${response.status}: ${errorText}`
        );
      }

      const data = await response.json();
      const places = data.places || [];

      return places.map((p: any) => {
        const placeLat = p.location?.latitude || lat;
        const placeLng = p.location?.longitude || lng;
        const distanceMeters = calculateDistanceMeters(lat, lng, placeLat, placeLng);

        return {
          id: p.id || `place_${Math.random().toString(36).slice(2, 9)}`,
          placeId: p.id || '',
          category,
          categoryLabel: config.label,
          name: p.displayName?.text || 'Local Amenity',
          formattedAddress: p.formattedAddress || '',
          distanceMeters,
          distanceText: formatDistanceText(distanceMeters),
          rating: p.rating ?? null,
          userRatingCount: p.userRatingCount ?? null,
          openNow: p.currentOpeningHours?.openNow ?? null,
          locationLat: placeLat,
          locationLng: placeLng,
        };
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Google Places API request for ${category} timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
