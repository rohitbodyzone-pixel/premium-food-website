import {
  IGooglePropertyProvider,
  AddressValidationParams,
  AddressValidationResult,
  GeocodeAddressParams,
  GeocodingResult,
  NearbyAmenityItem,
  AmenityCategory,
} from './google.interface';

// Haversine distance helper in meters
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export function formatDistanceText(meters: number): string {
  if (meters < 1000) {
    return `${meters} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

export class MockGooglePropertyProvider implements IGooglePropertyProvider {
  async validateAddress(params: AddressValidationParams): Promise<AddressValidationResult> {
    const rawStreet = (params.streetAddress || '').trim();
    const rawCity = (params.city || 'Auckland').trim();
    const rawSuburb = (params.suburb || '').trim();
    const rawCountry = (params.countryCode || 'NZ').toUpperCase();

    // 1. Error simulation
    if (rawStreet.includes('TRIGGER_TIMEOUT')) {
      throw new Error('Google Address Validation API request timed out after 5000ms');
    }
    if (rawStreet.includes('TRIGGER_ERROR')) {
      throw new Error('Google Address Validation API returned HTTP 500 Internal Server Error');
    }

    // 2. Unverifiable / Invalid addresses
    if (
      rawStreet.toLowerCase().includes('nowhere') ||
      rawStreet.toLowerCase().includes('invalid') ||
      rawStreet.toLowerCase().includes('galaxy') ||
      rawStreet.toLowerCase().includes('nonexistent') ||
      rawStreet.length < 4
    ) {
      return {
        status: 'COULD_NOT_VERIFY',
        formattedAddress: `${rawStreet}, ${rawSuburb ? rawSuburb + ', ' : ''}${rawCity}, New Zealand`,
        streetAddress: rawStreet,
        suburb: rawSuburb,
        city: rawCity,
        region: 'Unknown Region',
        postalCode: params.postalCode || '',
        countryCode: rawCountry,
        latitude: null,
        longitude: null,
        googlePlaceId: null,
        hasCorrections: false,
        correctedFields: [],
        unconfirmedComponents: ['street_number', 'route'],
        message: 'Google could not verify this address. Please check the street name and number.',
        rawVerdict: {
          validationGranularity: 'OTHER',
          hasUnconfirmedComponents: true,
        },
      };
    }

    // 3. Typo / Needs Confirmation addresses
    // e.g. "Qeen St" -> "Queen Street", or missing postal code inferred
    const hasTypo =
      rawStreet.toLowerCase().includes('qeen') ||
      rawStreet.toLowerCase().includes('pnsby') ||
      rawStreet.toLowerCase().includes('hamiltn') ||
      rawStreet.toLowerCase().includes('k-rd') ||
      !params.postalCode;

    if (hasTypo) {
      let correctedStreet = rawStreet;
      const correctedFields = [];

      if (rawStreet.toLowerCase().includes('qeen')) {
        correctedStreet = rawStreet.replace(/qeen/i, 'Queen');
        correctedFields.push({
          field: 'streetAddress',
          original: rawStreet,
          corrected: correctedStreet,
        });
      } else if (rawStreet.toLowerCase().includes('pnsby')) {
        correctedStreet = rawStreet.replace(/pnsby/i, 'Ponsonby');
        correctedFields.push({
          field: 'streetAddress',
          original: rawStreet,
          corrected: correctedStreet,
        });
      } else if (rawStreet.toLowerCase().includes('hamiltn')) {
        correctedStreet = rawStreet.replace(/hamiltn/i, 'Hamilton');
        correctedFields.push({
          field: 'streetAddress',
          original: rawStreet,
          corrected: correctedStreet,
        });
      }

      const inferredPostal = params.postalCode || '1010';
      if (!params.postalCode) {
        correctedFields.push({
          field: 'postalCode',
          original: '',
          corrected: inferredPostal,
        });
      }

      const formatted = `${correctedStreet}, ${rawSuburb || 'Auckland CBD'}, ${rawCity} ${inferredPostal}, New Zealand`;

      return {
        status: 'NEEDS_CONFIRMATION',
        formattedAddress: formatted,
        streetAddress: correctedStreet,
        suburb: rawSuburb || 'Auckland CBD',
        city: rawCity,
        region: 'Auckland',
        postalCode: inferredPostal,
        countryCode: rawCountry,
        latitude: -36.8509,
        longitude: 174.7645,
        googlePlaceId: 'ChIJN1tT3MtdDW0R72uC1_C_uEQ',
        hasCorrections: true,
        correctedFields,
        unconfirmedComponents: [],
        message: 'Google suggested corrections to this address. Please review and confirm.',
        rawVerdict: {
          validationGranularity: 'PREMISE',
          hasReplacedComponents: true,
          hasInferredComponents: !params.postalCode,
        },
      };
    }

    // 4. Fully Verified Address
    // Deterministic lat/lng based on city or default to NZ coordinates
    let lat = -36.8509;
    let lng = 174.7645;
    let region = 'Auckland';
    let postal = params.postalCode || '1010';

    const cityLower = rawCity.toLowerCase();
    if (cityLower.includes('wellington')) {
      lat = -41.2865;
      lng = 174.7762;
      region = 'Wellington';
      postal = params.postalCode || '6011';
    } else if (cityLower.includes('christchurch')) {
      lat = -43.5321;
      lng = 172.6362;
      region = 'Canterbury';
      postal = params.postalCode || '8011';
    } else if (cityLower.includes('tauranga')) {
      lat = -37.6878;
      lng = 176.1651;
      region = 'Bay of Plenty';
      postal = params.postalCode || '3110';
    } else if (cityLower.includes('hamilton')) {
      lat = -37.787;
      lng = 175.2793;
      region = 'Waikato';
      postal = params.postalCode || '3204';
    }

    const formatted = `${rawStreet}, ${rawSuburb ? rawSuburb + ', ' : ''}${rawCity} ${postal}, New Zealand`;

    return {
      status: 'VERIFIED',
      formattedAddress: formatted,
      streetAddress: rawStreet,
      suburb: rawSuburb || 'Auckland Central',
      city: rawCity,
      region,
      postalCode: postal,
      countryCode: rawCountry,
      latitude: lat,
      longitude: lng,
      googlePlaceId: `ChIJ_${Math.abs(Math.round(lat * 1000))}_${Math.abs(Math.round(lng * 1000))}`,
      hasCorrections: false,
      correctedFields: [],
      unconfirmedComponents: [],
      message: 'Address verified successfully with Google Address Validation.',
      rawVerdict: {
        validationGranularity: 'PREMISE',
        addressComplete: true,
      },
    };
  }

  async geocodeAddress(params: GeocodeAddressParams): Promise<GeocodingResult> {
    const val = await this.validateAddress({
      streetAddress: params.streetAddress,
      suburb: params.suburb,
      city: params.city,
      region: params.region,
      postalCode: params.postalCode,
      countryCode: params.countryCode,
    });

    if (val.status === 'COULD_NOT_VERIFY') {
      throw new Error('Geocoding failed with status: ZERO_RESULTS');
    }

    return {
      latitude: val.latitude || -36.8509,
      longitude: val.longitude || 174.7645,
      googlePlaceId: val.googlePlaceId || 'ChIJ_mock_place_id',
      formattedAddress: val.formattedAddress,
      streetAddress: val.streetAddress,
      suburb: val.suburb,
      city: val.city,
      region: val.region,
      postalCode: val.postalCode,
      countryCode: val.countryCode,
    };
  }

  async searchNearbyAmenities(
    lat: number,
    lng: number,
    _options?: { radiusMeters?: number; categories?: AmenityCategory[] }
  ): Promise<NearbyAmenityItem[]> {
    // Generate realistic, localized amenities around the given coordinates
    const mockTemplates: Array<{
      category: AmenityCategory;
      categoryLabel: string;
      name: string;
      address: string;
      offsetLat: number;
      offsetLng: number;
      rating: number;
      reviews: number;
      openNow: boolean;
    }> = [
      {
        category: 'schools',
        categoryLabel: 'Schools',
        name: 'Auckland Grammar School',
        address: 'Mountain Rd, Epsom, Auckland',
        offsetLat: 0.0045,
        offsetLng: 0.0035,
        rating: 4.8,
        reviews: 142,
        openNow: true,
      },
      {
        category: 'schools',
        categoryLabel: 'Schools',
        name: 'Central Primary School',
        address: '52 Victoria St West, Auckland',
        offsetLat: -0.0032,
        offsetLng: 0.0028,
        rating: 4.6,
        reviews: 64,
        openNow: true,
      },
      {
        category: 'supermarkets',
        categoryLabel: 'Supermarkets',
        name: 'Countdown Supermarket Metro',
        address: '76 Quay Street, Auckland CBD',
        offsetLat: 0.0052,
        offsetLng: -0.0041,
        rating: 4.4,
        reviews: 489,
        openNow: true,
      },
      {
        category: 'supermarkets',
        categoryLabel: 'Supermarkets',
        name: 'New World Metro',
        address: '125 Queen Street, Auckland',
        offsetLat: -0.0025,
        offsetLng: 0.003,
        rating: 4.5,
        reviews: 312,
        openNow: true,
      },
      {
        category: 'hospitals',
        categoryLabel: 'Hospitals',
        name: 'Auckland City Hospital',
        address: '2 Park Rd, Grafton, Auckland',
        offsetLat: 0.0125,
        offsetLng: 0.0098,
        rating: 4.2,
        reviews: 620,
        openNow: true,
      },
      {
        category: 'pharmacies',
        categoryLabel: 'Pharmacies',
        name: 'Life Pharmacy Queen Street',
        address: '134 Queen St, Auckland CBD',
        offsetLat: 0.0018,
        offsetLng: -0.0015,
        rating: 4.5,
        reviews: 78,
        openNow: true,
      },
      {
        category: 'parks',
        categoryLabel: 'Parks',
        name: 'Albert Park',
        address: 'Princes St, Auckland CBD',
        offsetLat: 0.0035,
        offsetLng: 0.0048,
        rating: 4.7,
        reviews: 1250,
        openNow: true,
      },
      {
        category: 'gyms',
        categoryLabel: 'Gyms & Fitness',
        name: 'Les Mills City Centre',
        address: '186 Victoria St W, Auckland',
        offsetLat: -0.0048,
        offsetLng: -0.0052,
        rating: 4.7,
        reviews: 580,
        openNow: true,
      },
      {
        category: 'petrol_stations',
        categoryLabel: 'Petrol Stations',
        name: 'BP 2go Quay Street',
        address: '18 Quay St, Auckland',
        offsetLat: 0.0068,
        offsetLng: -0.0072,
        rating: 4.1,
        reviews: 130,
        openNow: true,
      },
      {
        category: 'cafes',
        categoryLabel: 'Cafes',
        name: 'Daily Bread Britomart',
        address: '12 Galway St, Auckland CBD',
        offsetLat: 0.0022,
        offsetLng: -0.0018,
        rating: 4.8,
        reviews: 245,
        openNow: true,
      },
      {
        category: 'transit',
        categoryLabel: 'Transit & Bus Stops',
        name: 'Britomart Transport Centre',
        address: 'Queen St / Custom St, Auckland',
        offsetLat: 0.0042,
        offsetLng: -0.0038,
        rating: 4.6,
        reviews: 890,
        openNow: true,
      },
    ];

    return mockTemplates.map((t, idx) => {
      const placeLat = lat + t.offsetLat;
      const placeLng = lng + t.offsetLng;
      const distanceMeters = calculateDistanceMeters(lat, lng, placeLat, placeLng);

      return {
        id: `mock_amenity_${idx + 1}`,
        placeId: `ChIJ_place_${idx + 1}_${t.category}`,
        category: t.category,
        categoryLabel: t.categoryLabel,
        name: t.name,
        formattedAddress: t.address,
        distanceMeters,
        distanceText: formatDistanceText(distanceMeters),
        rating: t.rating,
        userRatingCount: t.reviews,
        openNow: t.openNow,
        locationLat: placeLat,
        locationLng: placeLng,
      };
    }).sort((a, b) => a.distanceMeters - b.distanceMeters);
  }
}
