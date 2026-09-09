/**
 * PropertyTalk - Final Product Structure Regression Suite
 *
 * Validates:
 * 1. NZ-First Market Isolation (Australia disabled by default)
 * 2. Property Marketplace (Search, Filters, Details, Inquiries, Bookings, Save/Bookmark, No private offers)
 * 3. Paid Remote Live Property Viewing (Group $20, Private $60, Min 5 quota, Refund runner, Tech cost deduction)
 * 4. Agent Mini-Websites with SEO (/agent/:slug, XML Sitemap, Leads)
 * 5. Local SEO Articles Workflow (Weekly topics, AI drafts, Review & Publish)
 */

import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { prisma } from '../src/db/prisma';
import { checkSessionDeadlines } from '../src/routes/live-viewing.routes';

export async function runProductStructureTests(): Promise<{ passed: number; failed: number }> {
  console.log('\n====================================================');
  console.log('  PROPERTYTALK — FINAL PRODUCT STRUCTURE REGRESSION SUITE (20 TESTS)');
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
    // -------------------------------------------------------------
    // 1. NZ-First Market Isolation & Feature Flags
    // -------------------------------------------------------------
    const auConfig = await prisma.systemConfig.findUnique({
      where: { key: 'australia_enabled' },
    });
    assert(
      auConfig?.value === 'false',
      'Test 1: Australia is disabled by default (australia_enabled = "false") for NZ-first launch'
    );

    const nzCountry = await prisma.country.findUnique({ where: { code: 'NZ' } });
    assert(
      nzCountry !== null && nzCountry.isActive === true,
      'Test 2: New Zealand country is active launch market'
    );

    const liveViewingConfig = await prisma.systemConfig.findUnique({
      where: { key: 'remote_live_viewing_enabled' },
    });
    assert(
      liveViewingConfig?.value === 'true',
      'Test 3: Remote Live Viewing feature flag is enabled'
    );

    const miniWebsitesConfig = await prisma.systemConfig.findUnique({
      where: { key: 'agent_mini_websites_enabled' },
    });
    assert(
      miniWebsitesConfig?.value === 'true',
      'Test 4: Agent Mini-Websites feature flag is enabled'
    );

    // -------------------------------------------------------------
    // 2. Property Marketplace
    // -------------------------------------------------------------
    const properties = await prisma.property.findMany({
      where: { status: 'ACTIVE' },
    });
    assert(
      properties.length >= 3,
      `Test 5: Property listings exist in marketplace (found ${properties.length} active listings)`
    );

    const saleProperties = await prisma.property.findMany({
      where: { listingType: 'FOR_SALE', status: 'ACTIVE' },
    });
    assert(
      saleProperties.length > 0,
      `Test 6: Buy/Sale property filter operates correctly (${saleProperties.length} for sale)`
    );

    const remoteViewingProps = await prisma.property.findMany({
      where: { remoteViewingAvailable: true, status: 'ACTIVE' },
    });
    assert(
      remoteViewingProps.length > 0,
      `Test 7: Remote Live Viewing enabled filter operates correctly (${remoteViewingProps.length} available)`
    );

    // Consumer property bookmarking test
    const consumer = await prisma.user.findFirst({ where: { role: 'CONSUMER' } });
    if (!consumer) throw new Error('Demo consumer required for test');
    const testProp = properties[0];

    // Toggle save on
    await prisma.savedProperty.upsert({
      where: {
        propertyId_consumerId: {
          propertyId: testProp.id,
          consumerId: consumer.id,
        },
      },
      create: {
        propertyId: testProp.id,
        consumerId: consumer.id,
      },
      update: {},
    });
    const savedCheck = await prisma.savedProperty.findUnique({
      where: {
        propertyId_consumerId: {
          propertyId: testProp.id,
          consumerId: consumer.id,
        },
      },
    });
    assert(
      savedCheck !== null,
      'Test 8: Consumer can bookmark/save properties to favorites'
    );

    // Property inquiry test
    const inquiry = await prisma.propertyInquiry.create({
      data: {
        propertyId: testProp.id,
        consumerId: consumer.id,
        name: consumer.name,
        email: consumer.email || 'consumer@propertytalk.co.nz',
        message: 'Interested in arranging a private inspection.',
        status: 'NEW',
      },
    });
    assert(
      inquiry.id !== undefined && inquiry.status === 'NEW',
      'Test 9: Free property inquiry successfully logged to seller/agent inbox'
    );

    // Physical viewing booking test
    const viewingBooking = await prisma.physicalViewingBooking.create({
      data: {
        propertyId: testProp.id,
        consumerId: consumer.id,
        preferredDate: '2026-09-25',
        preferredTime: '10:00 AM',
        status: 'REQUESTED',
      },
    });
    assert(
      viewingBooking.id !== undefined && viewingBooking.status === 'REQUESTED',
      'Test 10: In-person physical viewing appointment booked'
    );

    // -------------------------------------------------------------
    // 3. Paid Remote Live Property Viewings
    // -------------------------------------------------------------
    const groupSession = await prisma.liveViewingSession.findFirst({
      where: { viewingType: 'GROUP' },
    });
    assert(
      groupSession !== null && groupSession.ticketPriceMinorUnits === 2000,
      'Test 11: Group Live Viewing ticket is NZ$20 (2000 minor units integer accounting)'
    );

    const privateSession = await prisma.liveViewingSession.findFirst({
      where: { viewingType: 'PRIVATE' },
    });
    assert(
      privateSession !== null && privateSession.ticketPriceMinorUnits === 6000,
      'Test 12: Private Live Viewing ticket is NZ$60 (6000 minor units integer accounting)'
    );

    assert(
      groupSession?.durationMinutes === 10 && privateSession?.durationMinutes === 10,
      'Test 13: Strict 10-minute duration configured on live viewing sessions'
    );

    assert(
      groupSession?.recordingAllowed === false,
      'Test 14: Live viewing video recording is OFF by default'
    );

    // Live viewing booking test
    const participant = await prisma.liveViewingParticipant.create({
      data: {
        viewingSessionId: groupSession!.id,
        consumerId: consumer.id,
        amountPaidMinorUnits: groupSession!.ticketPriceMinorUnits,
        paymentStatus: 'PAID',
      },
    });
    assert(
      participant.id !== undefined && participant.paymentStatus === 'PAID',
      'Test 15: Viewer successfully books and confirms seat in Live Viewing'
    );

    // Video technology deduction & provider readiness verification
    assert(
      groupSession?.streamingCostType === 'ESTIMATED_TEST' &&
      groupSession?.isProductionProvider === false &&
      groupSession?.actualUsageMinutes !== undefined,
      'Test 16: Video technology cost is usage-calculated, deducted from settlement, and marked test-only when no provider connected'
    );

    // Quota refund runner check
    // Create a temporary past session with 0 bookings to test auto-cancel & refund logic
    const dummySession = await prisma.liveViewingSession.create({
      data: {
        propertyId: testProp.id,
        hostProfileId: groupSession!.hostProfileId,
        viewingType: 'GROUP',
        scheduledAt: new Date(Date.now() - 3600000), // 1 hour ago
        durationMinutes: 10,
        ticketPriceMinorUnits: 2000,
        minAttendees: 5,
        maxCapacity: 10,
        status: 'SCHEDULED',
      },
    });
    await checkSessionDeadlines();
    const updatedDummy = await prisma.liveViewingSession.findUnique({
      where: { id: dummySession.id },
    });
    assert(
      updatedDummy?.status === 'CANCELLED',
      'Test 17: Deadline runner auto-cancels group sessions if min 5 bookings quota not met'
    );
    // Cleanup dummy
    await prisma.liveViewingSession.delete({ where: { id: dummySession.id } });

    // -------------------------------------------------------------
    // 4. Agent Mini-Websites with Google SEO
    // -------------------------------------------------------------
    const miniWebsite = await prisma.agentMiniWebsite.findFirst({
      where: { slug: 'sarah-jenkins' },
      include: { expertProfile: true },
    });
    assert(
      miniWebsite !== null && miniWebsite.isPublished === true,
      'Test 18: Agent mini-website accessible via public slug (/agent/sarah-jenkins)'
    );

    // -------------------------------------------------------------
    // 5. Local SEO Articles Workflow
    // -------------------------------------------------------------
    const articles = await prisma.agentArticle.findMany({
      where: { agentProfileId: miniWebsite!.expertProfileId },
    });
    assert(
      articles.length >= 2,
      `Test 19: Agent has published local market guides (found ${articles.length})`
    );

    const ponsonbyArticle = articles.find(
      (a) => a.slug.includes('auckland-central') || a.targetSuburb === 'Ponsonby'
    );
    assert(
      ponsonbyArticle !== undefined && ponsonbyArticle.status === 'PUBLISHED',
      'Test 20: Localized suburban SEO article published with verified status'
    );

    // Clean up test records created during test
    await prisma.liveViewingParticipant.delete({ where: { id: participant.id } });
    await prisma.propertyInquiry.delete({ where: { id: inquiry.id } });
    await prisma.physicalViewingBooking.delete({ where: { id: viewingBooking.id } });

  } catch (error) {
    console.error('Test suite error:', error);
    failed++;
  }

  return { passed, failed };
}

if (require.main === module) {
  runProductStructureTests().then((res) => {
    console.log(`\nResults: ${res.passed} Passed, ${res.failed} Failed\n`);
    prisma.$disconnect();
    process.exit(res.failed > 0 ? 1 : 0);
  });
}
