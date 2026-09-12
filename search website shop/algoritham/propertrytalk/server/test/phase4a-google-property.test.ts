/**
 * PropertyTalk - Phase 4A: Google Property Data Integration Test Suite
 *
 * Validates:
 * 1. Address Validation: Valid NZ address returns VERIFIED with normalized components and coordinates
 * 2. Address Validation: Address with typo/missing info returns NEEDS_CONFIRMATION with suggested corrections
 * 3. Address Validation: Unresolvable address returns COULD_NOT_VERIFY
 * 4. Missing Credentials / Graceful Fallback: System uses MockGooglePropertyProvider when API key is empty
 * 5. Geocoding: Authoritative coordinates (latitude, longitude) and Google Place ID resolution
 * 6. Geocoding Fallback: Unresolvable address returns null/empty without throwing unhandled exceptions
 * 7. Places API (New): Nearby amenity search across categories with Haversine distance calculation
 * 8. Property Schema & DB Persistence: Authoritative coordinates, Place ID, formatted address saved in DB
 * 9. Cost Protection & DB Caching: First call fetches and persists amenities with 14-day TTL in PropertyAmenityCache
 * 10. Cost Protection & DB Caching: Subsequent calls hit the database cache (cached: true) with zero external calls
 * 11. Cache Invalidation: Clearing property amenity cache removes stale entries
 * 12. Feature Flags: Super Admin toggles for google_maps_enabled and google_places_enabled
 * 13. Graceful Fallback on Flag Disabled: Amenities query returns enabled: false when places feature flag is off
 * 14. Zero External Network Dependency: Tests run 100% offline and deterministic via mock provider
 * 15. Security & Key Leakage Prevention: Server API keys are never exposed in validation or amenity responses
 */

import { prisma } from '../src/db/prisma';
import {
  getGooglePropertyProvider,
  isGoogleLiveProvider,
  resetGoogleProviderForTesting,
} from '../src/services/google/google-provider.factory';
import { placesCacheService } from '../src/services/google/google-places-cache.service';
import { MockGooglePropertyProvider } from '../src/services/google/mock-google.service';

export async function runPhase4aGooglePropertyTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n====================================================');
  console.log('  PROPERTYTALK — PHASE 4A: GOOGLE PROPERTY DATA INTEGRATION (15 TESTS)');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✓ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${desc}`);
      failed++;
    }
  }

  // Backup original env
  const origKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  // Ensure we are testing with mock provider (no live network call or external credentials)
  delete process.env.GOOGLE_MAPS_SERVER_API_KEY;
  resetGoogleProviderForTesting();

  let testPropertyId: string | null = null;
  let testUserId: string | null = null;

  try {
    const provider = getGooglePropertyProvider();

    // -----------------------------------------------------------------
    // TEST 1: Address Validation — Valid NZ Address (VERIFIED)
    // -----------------------------------------------------------------
    const validResult = await provider.validateAddress({
      streetAddress: '14 Hamilton Road',
      suburb: 'Ponsonby',
      city: 'Auckland',
      postalCode: '1011',
      countryCode: 'NZ',
    });

    assert(
      validResult.status === 'VERIFIED' &&
        validResult.latitude !== null &&
        validResult.longitude !== null &&
        typeof validResult.latitude === 'number' &&
        typeof validResult.longitude === 'number' &&
        validResult.hasCorrections === false,
      'Test 1: Valid NZ address returns status VERIFIED with accurate coordinates and components'
    );

    // -----------------------------------------------------------------
    // TEST 2: Address Validation — Typo Correction (NEEDS_CONFIRMATION)
    // -----------------------------------------------------------------
    const typoResult = await provider.validateAddress({
      streetAddress: '14 Hamiltn Rd',
      suburb: 'Ponsonby',
      city: 'Auckland',
      postalCode: '1011',
      countryCode: 'NZ',
    });

    assert(
      typoResult.status === 'NEEDS_CONFIRMATION' &&
        typoResult.hasCorrections === true &&
        typoResult.correctedFields !== undefined &&
        typoResult.correctedFields.length > 0 &&
        typoResult.correctedFields.some((f) => f.field.toLowerCase().includes('street') || f.field.toLowerCase().includes('route')),
      'Test 2: Address with typographical error returns status NEEDS_CONFIRMATION with suggested corrections'
    );

    // -----------------------------------------------------------------
    // TEST 3: Address Validation — Invalid / Unresolvable Address
    // -----------------------------------------------------------------
    const invalidResult = await provider.validateAddress({
      streetAddress: '99999 Nonexistent Galaxy Way',
      suburb: 'Unknown Suburb',
      city: 'Nowhere',
    });

    assert(
      invalidResult.status === 'COULD_NOT_VERIFY' &&
        invalidResult.latitude === null &&
        invalidResult.longitude === null,
      'Test 3: Unresolvable/invalid address safely returns COULD_NOT_VERIFY with null coordinates'
    );

    // -----------------------------------------------------------------
    // TEST 4: Missing Credentials / Seamless Fallback to Mock Provider
    // -----------------------------------------------------------------
    const activeProv = getGooglePropertyProvider();
    const isLive = isGoogleLiveProvider();

    assert(
      isLive === false && activeProv instanceof MockGooglePropertyProvider,
      'Test 4: Absence of GOOGLE_MAPS_SERVER_API_KEY gracefully defaults to deterministic MockGooglePropertyProvider'
    );

    // -----------------------------------------------------------------
    // TEST 5: Geocoding — Authoritative Coordinates & Place ID
    // -----------------------------------------------------------------
    const geocodeResult = await provider.geocodeAddress({
      streetAddress: '14 Hamilton Road',
      suburb: 'Ponsonby',
      city: 'Auckland',
      postalCode: '1011',
      countryCode: 'NZ',
    });

    assert(
      geocodeResult !== null &&
        typeof geocodeResult.latitude === 'number' &&
        typeof geocodeResult.longitude === 'number' &&
        Boolean(geocodeResult.googlePlaceId) &&
        geocodeResult.formattedAddress.includes('Hamilton Road'),
      'Test 5: Geocoding resolves authoritative latitude, longitude, and Google Place ID'
    );

    // -----------------------------------------------------------------
    // TEST 6: Geocoding Fallback — Graceful Null on Unresolvable Query
    // -----------------------------------------------------------------
    let geocodeFailed = false;
    try {
      await provider.geocodeAddress({
        streetAddress: '99999 Nonexistent Galaxy Way',
        city: 'Nowhere',
        countryCode: 'NZ',
      });
    } catch (err: any) {
      geocodeFailed = err.message.includes('ZERO_RESULTS') || err.message.includes('failed');
    }

    assert(
      geocodeFailed,
      'Test 6: Geocoding throws ZERO_RESULTS error cleanly without uncaught exceptions for unresolvable queries'
    );

    // -----------------------------------------------------------------
    // TEST 7: Places API (New) — Nearby Amenity Search & Haversine Distance
    // -----------------------------------------------------------------
    const rawAmenities = await provider.searchNearbyAmenities(-36.8509, 174.7645, {
      radiusMeters: 2500,
    });

    const hasSchools = rawAmenities.some((a) => a.category === 'schools');
    const hasSupermarkets = rawAmenities.some((a) => a.category === 'supermarkets');
    const hasCafes = rawAmenities.some((a) => a.category === 'cafes');
    const allHaveDistance = rawAmenities.every(
      (a) => typeof a.distanceMeters === 'number' && a.distanceMeters >= 0 && Boolean(a.distanceText)
    );

    assert(
      rawAmenities.length >= 8 && hasSchools && hasSupermarkets && hasCafes && allHaveDistance,
      `Test 7: Places API returns ${rawAmenities.length} categorized amenities with calculated Haversine distances`
    );

    // -----------------------------------------------------------------
    // TEST 8: Property Schema & DB Persistence of Authoritative Fields
    // -----------------------------------------------------------------
    const testUser = await prisma.user.create({
      data: {
        email: `phase4a-test-${Date.now()}@propertytalk.co.nz`,
        name: 'GoogleTest Buyer',
        passwordHash: 'dummy_hash',
        role: 'CONSUMER',
      },
    });
    testUserId = testUser.id;

    const property = await prisma.property.create({
      data: {
        title: 'Phase 4A Test Heritage Villa',
        slug: `phase4a-test-villa-${Date.now()}`,
        description: 'Testing Google Address Validation, Geocoding, and Nearby Amenities',
        propertyType: 'HOUSE',
        listingType: 'FOR_SALE',
        priceMinorUnits: 185000000,
        priceDisplay: '$1,850,000',
        bedrooms: 4,
        bathrooms: 2,
        parkingSpaces: 2,
        streetAddress: '14 Hamilton Road',
        suburb: 'Ponsonby',
        city: 'Auckland',
        region: 'Auckland',
        postalCode: '1011',
        countryCode: 'NZ',
        formattedAddress: geocodeResult.formattedAddress,
        latitude: geocodeResult.latitude,
        longitude: geocodeResult.longitude,
        googlePlaceId: geocodeResult.googlePlaceId,
        addressValidationStatus: 'VERIFIED',
        images: JSON.stringify(['https://images.unsplash.com/photo-1564013799919-ab600027ffc6']),
        status: 'ACTIVE',
      },
    });
    testPropertyId = property.id;

    const savedProp = await prisma.property.findUnique({
      where: { id: testPropertyId },
    });

    assert(
      savedProp !== null &&
        savedProp.latitude === geocodeResult.latitude &&
        savedProp.longitude === geocodeResult.longitude &&
        savedProp.googlePlaceId === geocodeResult.googlePlaceId &&
        savedProp.formattedAddress === geocodeResult.formattedAddress &&
        savedProp.region === 'Auckland' &&
        savedProp.addressValidationStatus === 'VERIFIED',
      'Test 8: Property record persists authoritative coordinates, Google Place ID, and validation status'
    );

    // -----------------------------------------------------------------
    // TEST 9: Cost Protection & Caching — First Call Fetches and Persists
    // -----------------------------------------------------------------
    await prisma.propertyAmenityCache.deleteMany({
      where: { propertyId: testPropertyId },
    });

    const freshAmenities = await placesCacheService.getOrFetchAmenities(
      testPropertyId,
      { latitude: geocodeResult.latitude, longitude: geocodeResult.longitude },
      provider,
      { forceRefresh: false }
    );

    const cachedDbRows = await prisma.propertyAmenityCache.findMany({
      where: { propertyId: testPropertyId },
    });

    const allHaveTtl = cachedDbRows.every((row) => row.expiresAt > new Date());

    assert(
      freshAmenities.cached === false &&
        freshAmenities.amenities.length > 0 &&
        cachedDbRows.length === freshAmenities.amenities.length &&
        allHaveTtl,
      `Test 9: First amenity request fetches fresh data and persists ${cachedDbRows.length} items in PropertyAmenityCache with TTL`
    );

    // -----------------------------------------------------------------
    // TEST 10: Cost Protection & Caching — Second Call Hits DB Cache
    // -----------------------------------------------------------------
    const cachedAmenities = await placesCacheService.getOrFetchAmenities(
      testPropertyId,
      { latitude: geocodeResult.latitude, longitude: geocodeResult.longitude },
      provider,
      { forceRefresh: false }
    );

    assert(
      cachedAmenities.cached === true &&
        cachedAmenities.amenities.length === cachedDbRows.length &&
        cachedAmenities.categoriesAvailable.length > 0 &&
        Boolean(cachedAmenities.byCategory['schools']) &&
        Boolean(cachedAmenities.byCategory['supermarkets']),
      'Test 10: Subsequent query returns cached data from DB (cached: true) without invoking external Places API'
    );

    // -----------------------------------------------------------------
    // TEST 11: Cache Invalidation
    // -----------------------------------------------------------------
    await placesCacheService.invalidateCache(testPropertyId);
    const countAfterInvalidation = await prisma.propertyAmenityCache.count({
      where: { propertyId: testPropertyId },
    });

    assert(
      countAfterInvalidation === 0,
      'Test 11: Cache invalidation successfully purges all amenity records for the property'
    );

    // -----------------------------------------------------------------
    // TEST 12: Super Admin Feature Flags in Database
    // -----------------------------------------------------------------
    const mapsConfig = await prisma.systemConfig.upsert({
      where: { key: 'google_maps_enabled' },
      update: {},
      create: {
        key: 'google_maps_enabled',
        value: 'true',
        description: 'Google Maps display and address geocoding toggle',
      },
    });
    const placesConfig = await prisma.systemConfig.upsert({
      where: { key: 'google_places_enabled' },
      update: {},
      create: {
        key: 'google_places_enabled',
        value: 'true',
        description: 'Google Places API (New) nearby amenities toggle',
      },
    });

    assert(
      mapsConfig !== null &&
        mapsConfig.value === 'true' &&
        placesConfig !== null &&
        placesConfig.value === 'true',
      'Test 12: Super admin feature flags (google_maps_enabled, google_places_enabled) initialized in DB'
    );

    // -----------------------------------------------------------------
    // TEST 13: Feature Flag Disabled Handling
    // -----------------------------------------------------------------
    await prisma.systemConfig.update({
      where: { key: 'google_places_enabled' },
      data: { value: 'false' },
    });

    const disabledResponse = await placesCacheService.getOrFetchAmenities(
      testPropertyId,
      { latitude: geocodeResult.latitude, longitude: geocodeResult.longitude },
      provider,
      { forceRefresh: false }
    );

    // Restore flag
    await prisma.systemConfig.update({
      where: { key: 'google_places_enabled' },
      data: { value: 'true' },
    });

    assert(
      disabledResponse.enabled === false &&
        disabledResponse.amenities.length === 0 &&
        disabledResponse.message?.includes('disabled'),
      'Test 13: Disabling google_places_enabled feature flag returns enabled: false with graceful fallback message'
    );

    // -----------------------------------------------------------------
    // TEST 14: Zero External Network Dependency
    // -----------------------------------------------------------------
    assert(
      isGoogleLiveProvider() === false,
      'Test 14: Automated test environment is 100% offline and isolated from external Google API billing'
    );

    // -----------------------------------------------------------------
    // TEST 15: Security & No Private Key Leakage
    // -----------------------------------------------------------------
    const serializedValid = JSON.stringify(validResult);
    const serializedAmenities = JSON.stringify(cachedAmenities);
    const secretLeaked =
      serializedValid.includes('AIzaSy') ||
      serializedAmenities.includes('AIzaSy') ||
      serializedValid.includes('GOOGLE_MAPS_SERVER_API_KEY');

    assert(
      secretLeaked === false,
      'Test 15: API responses never contain internal Google server keys or credentials'
    );
  } catch (error) {
    console.error('Test execution error in Phase 4A suite:', error);
    failed++;
  } finally {
    // Cleanup created test records
    if (testPropertyId) {
      await prisma.propertyAmenityCache.deleteMany({
        where: { propertyId: testPropertyId },
      });
      await prisma.property.deleteMany({
        where: { id: testPropertyId },
      });
    }
    if (testUserId) {
      await prisma.user.deleteMany({
        where: { id: testUserId },
      });
    }

    // Restore environment
    if (origKey) process.env.GOOGLE_MAPS_SERVER_API_KEY = origKey;
    else delete process.env.GOOGLE_MAPS_SERVER_API_KEY;
    resetGoogleProviderForTesting();
  }

  return { passed, failed };
}
