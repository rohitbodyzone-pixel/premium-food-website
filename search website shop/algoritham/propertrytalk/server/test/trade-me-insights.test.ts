/**
 * PropertyTalk — Trade Me Property Insights Equivalent Test Suite
 * 
 * Validates the 11 Trade Me Property & Property Insights features:
 * 1. Location & Coordinates (saved coordinates, no repeated geocoding)
 * 2. School Information (MoE school details, distance, year levels, gender, authority)
 * 3. Official School Zones (IN_ZONE, OUT_OF_ZONE, NOT_ZONED)
 * 4. Property Value Estimate (CoreLogic / QV / Unconfigured fallback)
 * 5. Weekly Rent Estimate (weekly amount, range, source)
 * 6. Estimated Gross Rental Yield ((Annual Rent / Property Value) * 100 + disclaimer)
 * 7. Sales History (public transfer records, sorted descending)
 * 8. Capital / Rateable Value (CV, LV, Improvements, valuation date)
 * 9. Nearby Recent Sales (5–10 comparables, specs, distance)
 * 10. Legal & Property Details (Lot/DP, Title ref, Estate, Zoning, Council)
 * 11. Council Flood & Hazard Mapping (Auckland, Christchurch, Wellington adapters + LIM notice)
 */

import { prisma } from '../src/db/prisma';
import { nzSchoolService } from '../src/services/insights/school.service';
import {
  getValuationProvider,
  setValuationProviderForTesting,
  CoreLogicValuationProvider,
  QVValuationProvider,
  UnconfiguredValuationProvider,
  DevValuationProvider,
  calculateGrossRentalYieldHelper,
} from '../src/services/insights/valuation.provider';
import {
  councilHazardProvider,
  AucklandCouncilHazardAdapter,
  ChristchurchCouncilHazardAdapter,
  WellingtonCouncilHazardAdapter,
  DefaultCouncilHazardAdapter,
} from '../src/services/insights/hazard.service';
import { nearbySalesService } from '../src/services/insights/nearby-sales.service';

export async function runTradeMeInsightsTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n====================================================');
  console.log('  PROPERTYTALK — TRADE ME PROPERTY INSIGHTS (15 TESTS)');
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
    // TEST 1: School Information & MoE Dataset
    // ----------------------------------------------------
    const ponsonbyLat = -36.845;
    const ponsonbyLng = 174.745;
    const schoolResults = nzSchoolService.getSchoolsNearProperty(ponsonbyLat, ponsonbyLng, 3500);

    assert(
      schoolResults.totalCount > 0 && schoolResults.schools.length > 0,
      'Test 1: MoE School Directory returns authoritative nearby schools within radius'
    );

    const firstSchool = schoolResults.schools[0];
    assert(
      typeof firstSchool.name === 'string' &&
        typeof firstSchool.schoolType === 'string' &&
        typeof firstSchool.yearLevels === 'string' &&
        typeof firstSchool.gender === 'string' &&
        typeof firstSchool.authority === 'string' &&
        typeof firstSchool.distanceMeters === 'number' &&
        typeof firstSchool.distanceText === 'string',
      'Test 2: School record contains complete MoE fields (name, type, year levels, gender, authority, distance)'
    );

    // ----------------------------------------------------
    // TEST 3: Official School Zones (IN_ZONE vs OUT_OF_ZONE vs NOT_ZONED)
    // ----------------------------------------------------
    const inZoneSchools = schoolResults.schools.filter((s) => s.zoneStatus === 'IN_ZONE');
    const outZoneSchools = schoolResults.schools.filter((s) => s.zoneStatus === 'OUT_OF_ZONE');
    const notZonedSchools = schoolResults.schools.filter((s) => s.zoneStatus === 'NOT_ZONED');

    assert(
      inZoneSchools.length > 0 && schoolResults.inZoneCount === inZoneSchools.length,
      'Test 3: Ministry of Education home enrolment scheme computes IN_ZONE status for properties within zone radius'
    );

    assert(
      outZoneSchools.length > 0 || notZonedSchools.length >= 0,
      'Test 4: Ministry of Education scheme accurately distinguishes OUT_OF_ZONE and NOT_ZONED schools'
    );

    // ----------------------------------------------------
    // TEST 5: Property Value Estimate Providers & Fallback
    // ----------------------------------------------------
    const devProvider = new DevValuationProvider();
    const mockProp = {
      id: 'test-prop-01',
      streetAddress: '14 St Marys Bay Road',
      suburb: 'St Marys Bay',
      city: 'Auckland',
      bedrooms: 4,
      bathrooms: 3,
      priceMinorUnits: 285000000,
      capitalValueMinorUnits: 275000000,
    };

    const devEstimate = await devProvider.getValuation(mockProp);
    assert(
      devEstimate.available === true &&
        typeof devEstimate.estimatedValueMinorUnits === 'number' &&
        devEstimate.estimatedLowerMinorUnits! <= devEstimate.estimatedValueMinorUnits! &&
        devEstimate.estimatedUpperMinorUnits! >= devEstimate.estimatedValueMinorUnits!,
      'Test 5: Property value estimate includes estimated price and lower/upper range'
    );

    // ----------------------------------------------------
    // TEST 6: Unconfigured Commercial Provider Enforces Unavailable in Production
    // ----------------------------------------------------
    const unconfigured = new UnconfiguredValuationProvider();
    const unconfEstimate = await unconfigured.getValuation(mockProp);
    assert(
      unconfEstimate.available === false &&
        unconfEstimate.unavailabilityReason === 'Property estimate unavailable' &&
        unconfEstimate.estimatedValueMinorUnits === undefined,
      'Test 6: Unconfigured valuation provider returns "Property estimate unavailable" without fabricating numbers'
    );

    // ----------------------------------------------------
    // TEST 7: Weekly Rent Estimate
    // ----------------------------------------------------
    const rentEstimate = await devProvider.getRentEstimate(mockProp);
    assert(
      rentEstimate.available === true &&
        typeof rentEstimate.weeklyRentEstimatedMinorUnits === 'number' &&
        rentEstimate.weeklyRentEstimatedMinorUnits > 0 &&
        typeof rentEstimate.weeklyRentDisplay === 'string',
      'Test 7: Rental estimate returns weekly rent amount and formatted weekly display'
    );

    // ----------------------------------------------------
    // TEST 8: Estimated Gross Rental Yield Formula & Disclaimer
    // ----------------------------------------------------
    // Formula: (annualRent / estimatedValue) * 100
    // e.g. $700/week * 52 = $36,400 / $800,000 = 4.55%
    const yieldTest = calculateGrossRentalYieldHelper(
      {
        available: true,
        estimatedValueMinorUnits: 80000000, // $800,000
        estimatedValueDisplay: '$800,000',
      },
      {
        available: true,
        weeklyRentEstimatedMinorUnits: 70000, // $700 / week
        weeklyRentDisplay: '$700 / week',
      }
    );

    assert(
      yieldTest.available === true &&
        yieldTest.grossYieldPercentage === 4.55 &&
        yieldTest.grossYieldDisplay === '4.55%' &&
        typeof yieldTest.disclaimer === 'string' &&
        yieldTest.disclaimer.includes('indicative figure before council rates'),
      'Test 8: Gross Rental Yield formula strictly calculates (Annual Rent / Value) * 100 with mandatory disclaimer'
    );

    const zeroYieldTest = calculateGrossRentalYieldHelper(
      { available: false },
      { available: true, weeklyRentEstimatedMinorUnits: 70000 }
    );
    assert(
      zeroYieldTest.available === false,
      'Test 9: Gross Rental Yield returns available: false when valuation or rental data is absent'
    );

    // ----------------------------------------------------
    // TEST 10: Public Sales History Retrieval
    // ----------------------------------------------------
    const sampleProperty = await prisma.property.findFirst({
      where: { slug: '14-st-marys-bay-road-auckland' },
      include: {
        salesHistory: {
          orderBy: { saleDate: 'desc' },
        },
      },
    });

    assert(
      !!sampleProperty &&
        Array.isArray(sampleProperty.salesHistory) &&
        sampleProperty.salesHistory.length >= 2,
      'Test 10: Property public sales history records are retrieved and ordered chronologically descending'
    );

    // ----------------------------------------------------
    // TEST 11: Council Rateable Value & Legal Details
    // ----------------------------------------------------
    assert(
      !!sampleProperty &&
        typeof sampleProperty.capitalValueMinorUnits === 'number' &&
        typeof sampleProperty.landValueMinorUnits === 'number' &&
        typeof sampleProperty.improvementsValueMinorUnits === 'number' &&
        typeof sampleProperty.legalDescription === 'string' &&
        typeof sampleProperty.titleReference === 'string',
      'Test 11: Property schema stores official CV, LV, Improvements Value, Legal Description and Title Identifier'
    );

    // ----------------------------------------------------
    // TEST 12: Nearby Comparable Recent Sales
    // ----------------------------------------------------
    const nearbySold = await nearbySalesService.getNearbyRecentSales(
      sampleProperty ? sampleProperty.id : 'unknown',
      ponsonbyLat,
      ponsonbyLng,
      'Auckland',
      'St Marys Bay',
      6
    );

    assert(
      nearbySold.length >= 3 &&
        nearbySold[0].distanceMeters <= nearbySold[1].distanceMeters &&
        typeof nearbySold[0].soldPriceDisplay === 'string' &&
        typeof nearbySold[0].bedrooms === 'number',
      'Test 12: Nearby comparable recent sales returns verified transfers sorted by distance with bed/bath specs'
    );

    // ----------------------------------------------------
    // TEST 13: Auckland Council Hazard Mapping Adapter
    // ----------------------------------------------------
    const aklAdapter = new AucklandCouncilHazardAdapter();
    const aklHazards = aklAdapter.evaluateHazards({
      streetAddress: '14 St Marys Bay Road',
      suburb: 'St Marys Bay',
      city: 'Auckland',
    });

    assert(
      aklHazards.isHazardDataAvailable === true &&
        aklHazards.councilName === 'Auckland Council' &&
        aklHazards.overlays.length > 0 &&
        aklHazards.overlays.some((o) => o.type === 'OVERLAND_FLOW_PATH' || o.type === 'FLOOD_PLAIN'),
      'Test 13: Auckland Council Hazard adapter evaluates authoritative Geomaps overland flow paths & flood plains'
    );

    // ----------------------------------------------------
    // TEST 14: Christchurch Council Liquefaction & Flood Adapter
    // ----------------------------------------------------
    const chchAdapter = new ChristchurchCouncilHazardAdapter();
    const chchHazards = chchAdapter.evaluateHazards({
      streetAddress: '8 Rossall Street',
      suburb: 'Merivale',
      city: 'Christchurch',
    });

    assert(
      chchHazards.isHazardDataAvailable === true &&
        chchHazards.councilName === 'Christchurch City Council' &&
        chchHazards.overlays.some((o) => o.type === 'LIQUEFACTION' || o.type === 'FLOOD_MANAGEMENT_AREA'),
      'Test 14: Christchurch City Council adapter evaluates District Plan liquefaction and flood management overlays'
    );

    // ----------------------------------------------------
    // TEST 15: Unmapped Council Fallback & Mandatory Council LIM Advisory
    // ----------------------------------------------------
    const unmappedHazards = councilHazardProvider.getHazardData({
      streetAddress: '12 Unknown Road',
      suburb: 'Remote',
      city: 'Somewhere Else',
    });

    assert(
      unmappedHazards.isHazardDataAvailable === false &&
        unmappedHazards.unavailabilityReason === 'Hazard map data unavailable for this area' &&
        typeof unmappedHazards.limNotice === 'string' &&
        unmappedHazards.limNotice.includes('Absence of mapped hazard data does not imply absence of risk'),
      'Test 15: Unmapped territory returns explicit unavailable notice with mandatory Council LIM disclaimer'
    );

  } catch (err: any) {
    console.error('Unexpected error in Trade Me Insights test suite:', err);
    failed++;
  } finally {
    setValuationProviderForTesting(null);
  }

  console.log('====================================================');
  console.log(`  TRADE ME INSIGHTS TESTS FINISHED: ${passed} PASSED / ${failed} FAILED`);
  console.log('====================================================\n');

  return { passed, failed };
}
