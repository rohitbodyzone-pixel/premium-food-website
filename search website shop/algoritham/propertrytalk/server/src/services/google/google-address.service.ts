import {
  AddressValidationParams,
  AddressValidationResult,
  AddressValidationStatus,
  CorrectedField,
} from './google.interface';

export class GoogleAddressService {
  private apiKey: string;
  private timeoutMs: number;

  constructor(apiKey?: string, timeoutMs = 8000) {
    this.apiKey = apiKey || process.env.GOOGLE_MAPS_SERVER_API_KEY || '';
    this.timeoutMs = timeoutMs;
  }

  async validateAddress(params: AddressValidationParams): Promise<AddressValidationResult> {
    if (!this.apiKey) {
      throw new Error('Google Maps Server API Key is not configured.');
    }

    const countryCode = (params.countryCode || 'NZ').toUpperCase();
    const addressLines = [params.streetAddress];
    if (params.suburb) addressLines.push(params.suburb);

    const payload = {
      address: {
        regionCode: countryCode,
        locality: params.city,
        addressLines,
        postalCode: params.postalCode || undefined,
      },
      enableUspsCass: false,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = `https://addressvalidation.googleapis.com/v1:validateAddress?key=${encodeURIComponent(
        this.apiKey
      )}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Google Address Validation API returned HTTP ${response.status}: ${errorText}`
        );
      }

      const data = await response.json();
      return this.normalizeGoogleResponse(data, params);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(
          `Google Address Validation API request timed out after ${this.timeoutMs}ms`
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private normalizeGoogleResponse(
    data: any,
    originalInput: AddressValidationParams
  ): AddressValidationResult {
    const result = data?.result;
    const verdict = result?.verdict || {};
    const address = result?.address || {};
    const postalAddress = address?.postalAddress || {};
    const geocode = result?.geocode || {};

    const formattedAddress =
      address.formattedAddress ||
      `${originalInput.streetAddress}, ${originalInput.city}, New Zealand`;

    const components = address.addressComponents || [];
    const correctedFields: CorrectedField[] = [];
    const unconfirmedComponents: string[] = [];

    let streetNumber = '';
    let route = '';
    let suburb = originalInput.suburb || '';
    let city = originalInput.city || '';
    let region = originalInput.region || '';
    let postalCode = originalInput.postalCode || '';

    for (const comp of components) {
      const type = comp.componentType;
      const text = comp.componentName?.text || '';

      if (comp.confirmationLevel === 'UNCONFIRMED') {
        unconfirmedComponents.push(type);
      }

      if (type === 'street_number') streetNumber = text;
      if (type === 'route') route = text;
      if (type === 'sublocality_level_1' || type === 'sublocality') suburb = text;
      if (type === 'locality') city = text;
      if (type === 'administrative_area_level_1') region = text;
      if (type === 'postal_code') postalCode = text;

      // Detect replaced or corrected components
      if (comp.inferred || comp.replaced) {
        correctedFields.push({
          field: type,
          original: (originalInput as any)[type] || 'None',
          corrected: text,
        });
      }
    }

    const correctedStreetAddress =
      streetNumber && route ? `${streetNumber} ${route}` : originalInput.streetAddress;

    if (
      correctedStreetAddress.toLowerCase() !== originalInput.streetAddress.toLowerCase() &&
      !correctedFields.some((f) => f.field === 'streetAddress')
    ) {
      correctedFields.push({
        field: 'streetAddress',
        original: originalInput.streetAddress,
        corrected: correctedStreetAddress,
      });
    }

    // Determine status
    let status: AddressValidationStatus = 'VERIFIED';
    let message = 'Address verified successfully with Google Address Validation.';

    if (
      verdict.validationGranularity === 'OTHER' ||
      verdict.hasUnconfirmedComponents ||
      unconfirmedComponents.includes('route') ||
      unconfirmedComponents.includes('street_number')
    ) {
      status = 'COULD_NOT_VERIFY';
      message = 'Google could not verify this address. Please review street number and name.';
    } else if (
      verdict.hasReplacedComponents ||
      verdict.hasInferredComponents ||
      correctedFields.length > 0 ||
      verdict.validationGranularity === 'ROUTE'
    ) {
      status = 'NEEDS_CONFIRMATION';
      message = 'Google corrected address components. Please review and confirm the normalized address.';
    }

    const lat = geocode?.location?.latitude ?? null;
    const lng = geocode?.location?.longitude ?? null;
    const googlePlaceId = geocode?.placeId ?? null;

    return {
      status,
      formattedAddress,
      streetAddress: correctedStreetAddress,
      suburb: suburb || originalInput.suburb || '',
      city: city || originalInput.city,
      region: region || 'Auckland',
      postalCode: postalCode || postalAddress.postalCode || '',
      countryCode: originalInput.countryCode || 'NZ',
      latitude: lat,
      longitude: lng,
      googlePlaceId,
      hasCorrections: correctedFields.length > 0,
      correctedFields,
      unconfirmedComponents,
      message,
      rawVerdict: verdict,
    };
  }
}
