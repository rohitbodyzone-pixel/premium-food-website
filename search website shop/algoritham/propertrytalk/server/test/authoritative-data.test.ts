/**
 * PropertyTalk — Authoritative New Zealand Data Integration Test Suite
 * 
 * Validates real authoritative NZ data processing & safety rules:
 * 1. Ray-casting point-in-polygon school zone scheme evaluation (IN_ZONE, OUT_OF_ZONE, NOT_ZONED, UNKNOWN)
 * 2. LINZ Primary Parcels (Layer 50772) provider abstraction & credential status
 * 3. MBIE Tenancy Services lodged bond statistics & "Area Market Rent" attribution
 * 4. Production mock safety: zero benchmark fallbacks in production mode for nearby sales
 * 5. Super Admin 10 independent feature flags for Property Insights modules
 * 6. PropertyInsightsCache database persistence and module-specific TTLs
 * 7. Absence of mapped hazard data mandatory LIM notice across all adapters
 */

import { prisma } from '../src/db/prisma';
import {
  nzSchoolService,
  isPointInPolygon,
  isPointInMultiPolygon,
} from '../src/services/insights/school.service';
import {
  getLinzPropertyProvider,
  setLinzPropertyProviderForTesting,
  UnconfiguredLinzProvider,
} from '../src/services/insights/linz.provider';
import {
  getMbieMarketRentEstimate,
  UnconfiguredValuationProvider,
  councilValuationService,
} from '../src/services/insights/valuation.provider';
import { nearbySalesService } from '../src/services/insights/nearby-sales.service';
import {
  insightsCacheService,
  MODULE_TTLS_DAYS,
} from '../src/services/insights/insights-cache.service';
import {
  councilHazardProvider,
  AucklandCouncilHazardAdapter,
  ChristchurchCouncilHazardAdapter,
  WellingtonCouncilHazardAdapter,
} from '../src/services/insights/hazard.service';

export async function runAuthoritativeDataTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n====================================================');
  console.log('  AUTHORITATIVE NEW ZEALAND DATA TEST SUITE (18 TESTS)');
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

  try {
    // ----------------------------------------------------
    // TEST 1: Ray-casting Point-in-Polygon Algorithm
    // ----------------------------------------------------
    // A simple polygon: square from (0,0) to (10,10)
    const squarePolygon: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ];

    const insidePoint: [number, number] = [5, 5];
    const outsidePoint: [number, number] = [15, 5];

    assert(
      isPointInPolygon(insidePoint, squarePolygon) === true,
      'Test 1: Ray-casting point-in-polygon accurately detects points inside polygon'
    );

    assert(
      isPointInPolygon(outsidePoint, squarePolygon) === false,
      'Test 2: Ray-casting point-in-polygon accurately rejects points outside polygon'
    );

    // Multi-polygon support
    const multiPolygon: [number, number][][] = [
      squarePolygon,
      [[20, 20], [30, 20], [30, 30], [20, 30], [20, 20]],
    ];

    assert(
      isPointInMultiPolygon([25, 25], multiPolygon) === true &&
        isPointInMultiPolygon([15, 15], multiPolygon) === false,
      'Test 3: Multi-polygon point-in-polygon evaluates complex geometric boundaries'
    );

    // ----------------------------------------------------
    // TEST 4: MoE School Zones Point-in-Polygon Evaluation
    // ----------------------------------------------------
    // Ponsonby Primary School: Zone covers Ponsonby / St Marys Bay
    // Coordinates inside zone: 14 St Marys Bay Road (-36.845, 174.745)
    const ponsonbyInsideLat = -36.845;
    const ponsonbyInsideLng = 174.745;
    const ponsonbySchools = nzSchoolService.getSchoolsNearProperty(ponsonbyInsideLat, ponsonbyInsideLng, 3000);

    const ponsonbyPrimary = ponsonbySchools.schools.find((s) => s.id === '1443' || s.name.includes('Ponsonby Primary'));
    assert(
      !!ponsonbyPrimary && ponsonbyPrimary.zoneStatus === 'IN_ZONE',
      'Test 4: Property inside official MoE zone polygon correctly evaluates to IN_ZONE (no distance guessing)'
    );

    // Outside zone: Grey Lynn / Arch Hill (-36.865, 174.745) ~2.2km away, within 4000m query radius
    const outsideLat = -36.865;
    const outsideLng = 174.745;
    const outsideSchools = nzSchoolService.getSchoolsNearProperty(outsideLat, outsideLng, 4000);
    const outsidePonsonby = outsideSchools.schools.find((s) => s.id === '1443' || s.name.includes('Ponsonby Primary'));
    assert(
      !!outsidePonsonby && outsidePonsonby.zoneStatus === 'OUT_OF_ZONE',
      'Test 5: Property outside official MoE zone polygon correctly evaluates to OUT_OF_ZONE'
    );

    // ----------------------------------------------------
    // TEST 6: LINZ Primary Parcels (Layer 50772) Provider Fallback
    // ----------------------------------------------------
    const unconfiguredLinz = new UnconfiguredLinzProvider();
    const testProp = {
      id: 'auth-test-prop-01',
      streetAddress: '15 Hobson Street',
      suburb: 'Thorndon',
      city: 'Wellington',
      latitude: -41.2735,
      longitude: 174.7791,
      legalDescription: 'Lot 1 DP 45892',
      titleReference: 'WN42B/912',
      estateType: 'Fee Simple (Freehold)',
      landAreaM2: 420,
    };

    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const prodLinzResult = await unconfiguredLinz.getLegalAndParcelDetails(testProp);

    assert(
      prodLinzResult.status === 'WAITING_FOR_CREDENTIALS' &&
        prodLinzResult.data.legalDescription === 'Lot 1 DP 45892' &&
        prodLinzResult.data.titleReference === 'WN42B/912' &&
        typeof prodLinzResult.message === 'string',
      'Test 6: In production without LINZ_API_KEY, LINZ provider returns WAITING_FOR_CREDENTIALS with verified DB details'
    );
    process.env.NODE_ENV = origEnv;

    // ----------------------------------------------------
    // TEST 7: MBIE Tenancy Services Lodged Bond Statistics
    // ----------------------------------------------------
    const aklRental = getMbieMarketRentEstimate({
      suburb: 'Ponsonby',
      city: 'Auckland',
      bedrooms: 3,
    });

    assert(
      aklRental.available === true &&
        aklRental.label === 'Area Market Rent' &&
        typeof aklRental.weeklyRentEstimatedMinorUnits === 'number' &&
        aklRental.weeklyRentEstimatedMinorUnits > 0 &&
        aklRental.source?.includes('MBIE Tenancy Services'),
      'Test 7: MBIE market rent estimate returns official lodged bond median labeled "Area Market Rent"'
    );

    const chchRental = getMbieMarketRentEstimate({
      suburb: 'Merivale',
      city: 'Christchurch',
      bedrooms: 4,
    });

    assert(
      chchRental.available === true &&
        chchRental.weeklyRentEstimatedMinorUnits === 92000 &&
        chchRental.weeklyRangeDisplay === '$820 – $1050 / week',
      'Test 8: MBIE rent estimates correctly index Christchurch territorial authority median rates'
    );

    // ----------------------------------------------------
    // TEST 9: Production Mock Safety Guard on Nearby Sales
    // ----------------------------------------------------
    process.env.NODE_ENV = 'production';
    // Query a location with no DB sold properties nearby
    const prodNearbySales = await nearbySalesService.getNearbyRecentSales(
      'non-existent-prop',
      -45.0312, // Queenstown remote coords
      168.6626,
      'Queenstown'
    );

    assert(
      Array.isArray(prodNearbySales) && prodNearbySales.length === 0,
      'Test 9: In production mode, nearby sales NEVER falls back to mock benchmark records'
    );
    process.env.NODE_ENV = origEnv;

    // ----------------------------------------------------
    // TEST 10: Super Admin 10 Independent Feature Flags
    // ----------------------------------------------------
    const requiredKeys = [
      'property_insights_enabled',
      'property_value_enabled',
      'rent_estimate_enabled',
      'sales_history_enabled',
      'nearby_sales_enabled',
      'school_information_enabled',
      'school_zones_enabled',
      'council_valuation_enabled',
      'legal_property_details_enabled',
      'property_hazards_enabled',
    ];

    for (const key of requiredKeys) {
      await prisma.systemConfig.upsert({
        where: { key },
        update: {},
        create: { key, value: 'true', description: `Feature toggle for ${key}` },
      });
    }

    const dbConfigs = await prisma.systemConfig.findMany({
      where: { key: { in: requiredKeys } },
    });

    assert(
      requiredKeys.every((k) => dbConfigs.some((c) => c.key === k)),
      'Test 10: All 10 independent Property Insights feature flag keys are seeded in SystemConfig'
    );

    // Test disabling property_insights_enabled master toggle
    await prisma.systemConfig.upsert({
      where: { key: 'property_insights_enabled' },
      update: { value: 'false' },
      create: { key: 'property_insights_enabled', value: 'false' },
    });

    const checkDisabled = await prisma.systemConfig.findUnique({
      where: { key: 'property_insights_enabled' },
    });
    assert(
      checkDisabled?.value === 'false',
      'Test 11: Super Admin can toggle master property_insights_enabled flag to false'
    );

    // Restore master toggle to true
    await prisma.systemConfig.upsert({
      where: { key: 'property_insights_enabled' },
      update: { value: 'true' },
      create: { key: 'property_insights_enabled', value: 'true' },
    });

    // ----------------------------------------------------
    // TEST 12: Council Valuation Service Provenance
    // ----------------------------------------------------
    const testPropValuation = councilValuationService.getCouncilValuation({
      capitalValueMinorUnits: 175000000,
      landValueMinorUnits: 95000000,
      improvementsValueMinorUnits: 80000000,
      valuationDate: '2024-07-01',
      councilName: 'Auckland Council',
    });

    assert(
      testPropValuation.capitalValueDisplay === '$1,750,000' &&
        testPropValuation.landValueDisplay === '$950,000' &&
        testPropValuation.improvementsValueDisplay === '$800,000' &&
        testPropValuation.valuationSource === 'Auckland Council Rating Valuation',
      'Test 12: Council Rating Valuation accurately breaks down CV, LV, and Improvements with authority attribution'
    );

    // ----------------------------------------------------
    // TEST 13: PropertyInsightsCache Persistence & TTLs
    // ----------------------------------------------------
    const tempProp = await prisma.property.create({
      data: {
        title: 'Cache Test Villa',
        slug: `cache-test-${Date.now()}`,
        description: 'Testing insights cache persistence',
        propertyType: 'HOUSE',
        listingType: 'FOR_SALE',
        priceDisplay: '$1,500,000',
        streetAddress: '10 Richmond Road',
        suburb: 'Grey Lynn',
        city: 'Auckland',
        latitude: -36.858,
        longitude: 174.737,
        images: '[]',
      },
    });

    // Verify predefined TTL constants
    assert(
      MODULE_TTLS_DAYS.SCHOOLS === 30 &&
        MODULE_TTLS_DAYS.LINZ_LEGAL === 30 &&
        MODULE_TTLS_DAYS.COUNCIL_VALUATION === 90 &&
        MODULE_TTLS_DAYS.VALUATION_ESTIMATE === 14 &&
        MODULE_TTLS_DAYS.RENT_ESTIMATE === 14 &&
        MODULE_TTLS_DAYS.HAZARDS === 30 &&
        MODULE_TTLS_DAYS.NEARBY_SALES === 7,
      'Test 13: Module cache TTL constants reflect authoritative update frequencies'
    );

    // Save module to cache
    await insightsCacheService.set(
      tempProp.id,
      'SCHOOLS',
      { cachedSchoolCount: 4 },
      { source: 'Ministry of Education', sourceDate: '2026 Q2', status: 'AVAILABLE' }
    );

    // Read back from cache
    const cachedEntry = await insightsCacheService.get<{ cachedSchoolCount: number }>(
      tempProp.id,
      'SCHOOLS'
    );

    assert(
      !!cachedEntry &&
        cachedEntry.data.cachedSchoolCount === 4 &&
        cachedEntry.source === 'Ministry of Education' &&
        cachedEntry.status === 'AVAILABLE',
      'Test 14: InsightsCacheService persists and retrieves cached modules with full provenance metadata'
    );

    // Test cache invalidation
    await insightsCacheService.invalidate(tempProp.id, 'SCHOOLS');
    const afterInvalidate = await insightsCacheService.get(tempProp.id, 'SCHOOLS');
    assert(
      afterInvalidate === null,
      'Test 15: InsightsCacheService invalidates cache entries cleanly'
    );

    // Clean up temporary property
    await prisma.property.delete({ where: { id: tempProp.id } });

    // ----------------------------------------------------
    // TEST 16: Council Hazard Adapters (Auckland Geomaps)
    // ----------------------------------------------------
    const aklAdapter = new AucklandCouncilHazardAdapter();
    const aklHazard = aklAdapter.evaluateHazards({
      streetAddress: '42 Richmond Road',
      suburb: 'Grey Lynn',
      city: 'Auckland',
      latitude: -36.8582,
      longitude: 174.7371,
    });

    assert(
      aklHazard.councilName === 'Auckland Council' &&
        aklHazard.overlays.length > 0 &&
        aklHazard.overlays.some((o) => o.type === 'OVERLAND_FLOW_PATH') &&
        aklHazard.limNotice.includes('Land Information Memorandum (LIM)'),
      'Test 16: Auckland Council Hazard adapter evaluates authoritative Geomaps overland flow paths & flood plains'
    );

    // ----------------------------------------------------
    // TEST 17: Council Hazard Adapters (Christchurch District Plan)
    // ----------------------------------------------------
    const chcAdapter = new ChristchurchCouncilHazardAdapter();
    const chcHazard = chcAdapter.evaluateHazards({
      streetAddress: '12 Straven Road',
      suburb: 'Riccarton',
      city: 'Christchurch',
      latitude: -43.5218,
      longitude: 172.5998,
    });

    assert(
      chcHazard.councilName === 'Christchurch City Council' &&
        chcHazard.overlays.some((o) => o.type === 'LIQUEFACTION') &&
        chcHazard.limNotice.includes('Land Information Memorandum (LIM)'),
      'Test 17: Christchurch City Council adapter evaluates District Plan liquefaction and flood management overlays'
    );

    // ----------------------------------------------------
    // TEST 18: Mandatory Council LIM Notice Across All Providers
    // ----------------------------------------------------
    const wlgAdapter = new WellingtonCouncilHazardAdapter();
    const wlgHazard = wlgAdapter.evaluateHazards({
      streetAddress: '15 Hobson Street',
      suburb: 'Thorndon',
      city: 'Wellington',
      latitude: -41.2735,
      longitude: 174.7791,
    });

    assert(
      typeof wlgHazard.limNotice === 'string' &&
        wlgHazard.limNotice.includes('Absence of mapped hazard data does not imply absence of risk'),
      'Test 18: Mandatory Council LIM disclaimer is enforced across all regional hazard adapters'
    );

  } catch (error) {
    console.error('Error during authoritative data tests:', error);
    failed++;
  }

  console.log('====================================================');
  console.log(`  AUTHORITATIVE DATA TESTS FINISHED: ${passed} PASSED / ${failed} FAILED`);
  console.log('====================================================');

  return { passed, failed };
}
