import { GeocodeAddressParams, GeocodingResult } from './google.interface';

export class GoogleGeocodingService {
  private apiKey: string;
  private timeoutMs: number;

  constructor(apiKey?: string, timeoutMs = 8000) {
    this.apiKey = apiKey || process.env.GOOGLE_MAPS_SERVER_API_KEY || '';
    this.timeoutMs = timeoutMs;
  }

  async geocodeAddress(params: GeocodeAddressParams): Promise<GeocodingResult> {
    if (!this.apiKey) {
      throw new Error('Google Maps Server API Key is not configured.');
    }

    const countryCode = (params.countryCode || 'NZ').toUpperCase();
    const queryParts = [params.streetAddress, params.suburb, params.city, params.region, params.postalCode].filter(
      Boolean
    );
    const addressStr = queryParts.join(', ');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        addressStr
      )}&components=country:${encodeURIComponent(countryCode)}&key=${encodeURIComponent(this.apiKey)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Google Geocoding API returned HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        throw new Error(
          data.error_message || `Geocoding failed with status: ${data.status || 'ZERO_RESULTS'}`
        );
      }

      const topResult = data.results[0];
      const location = topResult.geometry?.location || {};
      const placeId = topResult.place_id || null;
      const formattedAddress = topResult.formatted_address || addressStr;

      let suburb = params.suburb || '';
      let city = params.city || '';
      let region = params.region || '';
      let postalCode = params.postalCode || '';
      let streetAddress = params.streetAddress || '';

      let streetNum = '';
      let route = '';

      for (const comp of topResult.address_components || []) {
        const types: string[] = comp.types || [];
        if (types.includes('street_number')) streetNum = comp.long_name;
        if (types.includes('route')) route = comp.long_name;
        if (types.includes('sublocality') || types.includes('sublocality_level_1')) suburb = comp.long_name;
        if (types.includes('locality')) city = comp.long_name;
        if (types.includes('administrative_area_level_1')) region = comp.long_name;
        if (types.includes('postal_code')) postalCode = comp.long_name;
      }

      if (streetNum && route) {
        streetAddress = `${streetNum} ${route}`;
      }

      return {
        latitude: location.lat,
        longitude: location.lng,
        googlePlaceId: placeId,
        formattedAddress,
        streetAddress,
        suburb,
        city,
        region,
        postalCode,
        countryCode,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Google Geocoding API request timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
