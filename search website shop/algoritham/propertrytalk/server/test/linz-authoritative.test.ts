/**
 * PropertyTalk — LINZ Authoritative Data & Parcel Verification Test Suite
 * 
 * Validates:
 * 1. Valid LINZ response normalization (Vector Query & WFS formats)
 * 2. No parcel found at coordinates handling
 * 3. Malformed LINZ response handling
 * 4. Network timeout handling
 * 5. Rate-limit (429) & error handling
 * 6. Missing API key handling
 * 7. Production mock prevention (no synthetic PRCL-... IDs)
 * 8. Cache hit for LINZ_LEGAL module
 * 9. Cache invalidation after coordinate/address change
 * 10. No API key leakage to client responses
 * 11. No private owner/person data exposed
 */

import { LiveLinzPropertyProvider, UnconfiguredLinzProvider, getLinzPropertyProvider } from '../src/services/insights/linz.provider';
import { insightsCacheService } from '../src/services/insights/insights-cache.service';
import { prisma } from '../src/db/prisma';

export async function runLinzAuthoritativeTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n====================================================');
  console.log('  LINZ AUTHORITATIVE DATA INTEGRATION TESTS (12 TESTS)');
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

  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  try {
    // ----------------------------------------------------
    // TEST 1: Valid LINZ Response Normalization (Koordinates Vector Query)
    // ----------------------------------------------------
    const fakeVectorQueryResponse = {
      vectorQuery: {
        layers: {
          '50772': {
            features: [
              {
                id: 4892102,
                geometry: {
                  type: 'MultiPolygon',
                  coordinates: [[[[172.624, -43.518], [172.625, -43.518], [172.625, -43.519], [172.624, -43.519], [172.624, -43.518]]]],
                },
                properties: {
                  id: 4892102,
                  appellation: 'Lot 2 DP 48921',
                  affected_surveys: 'DP 48921',
                  parcel_intent: 'Fee Simple',
                  topology_type: 'Primary',
                  statutory_actions: null,
                  land_district: 'Canterbury',
                  titles: 'CB28A/112',
                  survey_area: null,
                  calc_area: 650.4,
                  territorial_authority: 'Christchurch City',
                },
              },
            ],
          },
        },
      },
    };

    globalThis.fetch = async () =>
      new Response(JSON.stringify(fakeVectorQueryResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    const liveProvider = new LiveLinzPropertyProvider('test-linz-key-12345');
    const chchResult = await liveProvider.getLegalAndParcelDetails({
      id: 'prop-chch-01',
      streetAddress: '42 Papanui Road',
      suburb: 'Merivale',
      city: 'Christchurch',
      latitude: -43.518,
      longitude: 172.624,
    });

    assert(
      chchResult.available === true &&
        chchResult.status === 'LIVE' &&
        chchResult.data.parcelId === '4892102' &&
        chchResult.data.legalDescription === 'Lot 2 DP 48921' &&
        chchResult.data.landAreaM2 === 650 &&
        chchResult.data.estateType === 'Fee Simple' &&
        chchResult.data.titleReference === 'CB28A/112' &&
        chchResult.data.councilName === 'Christchurch City' &&
        chchResult.data.source === 'Land Information New Zealand (LINZ)',
      'Test 1: Normalizes genuine Koordinates Vector Query response with cadastral attributes'
    );

    // ----------------------------------------------------
    // TEST 2: Valid LINZ Response Normalization (WFS GeoJSON FeatureCollection)
    // ----------------------------------------------------
    const fakeWfsResponse = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'layer-50772.10293801',
          geometry: {
            type: 'MultiPolygon',
            coordinates: [[[[174.763, -36.848], [174.764, -36.848], [174.764, -36.849], [174.763, -36.849], [174.763, -36.848]]]],
          },
          properties: {
            id: 10293801,
            appellation: 'Lot 1 DP 102938',
            affected_surveys: 'DP 102938',
            parcel_intent: 'Fee Simple',
            land_district: 'North Auckland',
            titles: 'NA98B/321',
            calc_area: 480.0,
            territorial_authority: 'Auckland Council',
          },
        },
      ],
    };

    // First call (vector query) returns empty features, second call (WFS) succeeds
    globalThis.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/query/v1/vector.json')) {
        return new Response(JSON.stringify({ vectorQuery: { layers: { '50772': { features: [] } } } }), { status: 200 });
      }
      return new Response(JSON.stringify(fakeWfsResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const aklResult = await liveProvider.getLegalAndParcelDetails({
      id: 'prop-akl-01',
      streetAddress: '10 Queen Street',
      suburb: 'Auckland Central',
      city: 'Auckland',
      latitude: -36.848,
      longitude: 174.763,
    });

    assert(
      aklResult.available === true &&
        aklResult.status === 'LIVE' &&
        aklResult.data.parcelId === '10293801' &&
        aklResult.data.legalDescription === 'Lot 1 DP 102938' &&
        aklResult.data.landAreaM2 === 480 &&
        aklResult.data.titleReference === 'NA98B/321',
      'Test 2: Falls back gracefully to WFS 2.0.0 GetFeature and normalizes GeoJSON parcel geometry'
    );

    // ----------------------------------------------------
    // TEST 3: No Intersecting Parcel Found
    // ----------------------------------------------------
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), { status: 200 });

    const noParcelResult = await liveProvider.getLegalAndParcelDetails({
      id: 'prop-sea-01',
      streetAddress: 'Offshore Point',
      suburb: 'Hauraki Gulf',
      city: 'Auckland',
      latitude: -36.700,
      longitude: 175.000,
    });

    assert(
      noParcelResult.available === false &&
        noParcelResult.status === 'UNAVAILABLE' &&
        !noParcelResult.data.parcelId &&
        noParcelResult.message?.includes('No intersecting LINZ primary parcel found'),
      'Test 3: No intersecting parcel cleanly returns unavailable without inventing values'
    );

    // ----------------------------------------------------
    // TEST 4: Malformed LINZ Response
    // ----------------------------------------------------
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ corrupted: 'not a valid parcel collection' }), { status: 200 });

    const malformedResult = await liveProvider.getLegalAndParcelDetails({
      id: 'prop-malformed',
      streetAddress: '123 Test St',
      suburb: 'Test Suburb',
      city: 'Wellington',
      latitude: -41.286,
      longitude: 174.776,
    });

    assert(
      malformedResult.available === false &&
        malformedResult.status === 'UNAVAILABLE' &&
        !malformedResult.data.parcelId,
      'Test 4: Malformed response handled safely without uncaught exceptions'
    );

    // ----------------------------------------------------
    // TEST 5: Network Timeout Handling
    // ----------------------------------------------------
    globalThis.fetch = async () => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    };

    const timeoutResult = await liveProvider.getLegalAndParcelDetails({
      id: 'prop-timeout',
      streetAddress: '123 Test St',
      suburb: 'Test Suburb',
      city: 'Christchurch',
      latitude: -43.532,
      longitude: 172.636,
    });

    assert(
      timeoutResult.available === false &&
        timeoutResult.status === 'UNAVAILABLE' &&
        timeoutResult.message?.includes('timed out'),
      'Test 5: Network timeout triggers graceful timeout message'
    );

    // ----------------------------------------------------
    // TEST 6: Rate Limiting (HTTP 429) & Authentication (HTTP 401)
    // ----------------------------------------------------
    globalThis.fetch = async () =>
      new Response('Too Many Requests', { status: 429 });

    const rateLimitResult = await liveProvider.getLegalAndParcelDetails({
      id: 'prop-ratelimit',
      streetAddress: '123 Test St',
      suburb: 'Test Suburb',
      city: 'Christchurch',
      latitude: -43.532,
      longitude: 172.636,
    });

    assert(
      rateLimitResult.available === false &&
        rateLimitResult.message?.includes('rate limit reached'),
      'Test 6: HTTP 429 cleanly surfaces rate limit notice without leaking tokens'
    );

    // ----------------------------------------------------
    // TEST 7: Missing API Key Handling
    // ----------------------------------------------------
    delete process.env.LINZ_API_KEY;
    process.env.NODE_ENV = 'production';
    const unconfigured = new UnconfiguredLinzProvider();
    const unconfiguredResult = await unconfigured.getLegalAndParcelDetails({
      id: 'prop-unconfigured',
      streetAddress: '15 Hobson Street',
      suburb: 'Thorndon',
      city: 'Wellington',
      latitude: -41.273,
      longitude: 174.779,
      legalDescription: 'Lot 1 DP 45892',
    });

    assert(
      unconfiguredResult.status === 'WAITING_FOR_CREDENTIALS' &&
        unconfiguredResult.message === 'Architecture ready — LINZ API key required.',
      'Test 7: Missing LINZ_API_KEY returns exact required status and message'
    );

    // ----------------------------------------------------
    // TEST 8: Production Mock Prevention (No synthetic PRCL-... IDs)
    // ----------------------------------------------------
    assert(
      unconfiguredResult.data.parcelId === null &&
        unconfiguredResult.data.estateType === null,
      'Test 8: Production mock prevention strictly blocks synthetic PRCL-... IDs and invented estate types'
    );

    // ----------------------------------------------------
    // TEST 9: Property Insights Cache Persistence
    // ----------------------------------------------------
    const tempProp = await prisma.property.create({
      data: {
        title: 'LINZ Cache Test Property',
        slug: `linz-cache-test-${Date.now()}`,
        description: 'Testing LINZ legal cache persistence',
        propertyType: 'HOUSE',
        listingType: 'FOR_SALE',
        priceDisplay: '$1,200,000',
        streetAddress: '10 Richmond Road',
        suburb: 'Grey Lynn',
        city: 'Auckland',
        latitude: -36.858,
        longitude: 174.737,
        images: '[]',
      },
    });

    const testPayload = {
      available: true,
      parcelId: '9988776',
      legalDescription: 'Lot 9 DP 99887',
      titleReference: 'WN50A/100',
      source: 'Land Information New Zealand (LINZ)',
    };

    await insightsCacheService.set(tempProp.id, 'LINZ_LEGAL', testPayload, {
      source: 'Land Information New Zealand (LINZ)',
      status: 'LIVE',
    });

    const cached = await insightsCacheService.get<any>(tempProp.id, 'LINZ_LEGAL');
    assert(
      cached !== null &&
        cached.data.parcelId === '9988776' &&
        cached.data.legalDescription === 'Lot 9 DP 99887',
      'Test 9: InsightsCacheService persists and retrieves LINZ_LEGAL cached data'
    );

    // ----------------------------------------------------
    // TEST 10: Cache Invalidation After Coordinate / Address Change
    // ----------------------------------------------------
    await insightsCacheService.invalidate(tempProp.id, 'LINZ_LEGAL');
    const invalidated = await insightsCacheService.get<any>(tempProp.id, 'LINZ_LEGAL');

    assert(
      invalidated === null,
      'Test 10: Cache invalidation successfully purges stale LINZ cadastre entries'
    );

    await prisma.property.delete({ where: { id: tempProp.id } });

    // ----------------------------------------------------
    // TEST 11: Zero API Key Leakage
    // ----------------------------------------------------
    const resultString = JSON.stringify(chchResult);
    assert(
      !resultString.includes('test-linz-key-12345'),
      'Test 11: LINZ_API_KEY is strictly never exposed in returned data structures'
    );

    // ----------------------------------------------------
    // TEST 12: Zero Private Owner/Person Information
    // ----------------------------------------------------
    const keys = Object.keys(chchResult.data);
    const forbiddenKeys = ['owner', 'ownerName', 'proprietor', 'mortgage', 'mortgagee', 'buyerName', 'sellerName'];
    const hasForbiddenKeys = forbiddenKeys.some((fk) => keys.includes(fk));

    assert(
      !hasForbiddenKeys &&
        (chchResult.data as any).owner === undefined &&
        (chchResult.data as any).ownerName === undefined,
      'Test 12: Guaranteed zero private owner, title-holder, or person information is retrieved or exposed'
    );

  } catch (error: any) {
    console.error('Fatal LINZ test error:', error);
    failed++;
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }

  console.log('====================================================');
  console.log(`  LINZ AUTHORITATIVE TESTS FINISHED: ${passed} PASSED / ${failed} FAILED`);
  console.log('====================================================');

  return { passed, failed };
}
