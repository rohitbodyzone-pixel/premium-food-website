import { prisma } from '../src/db/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { callTimerService } from '../src/services/call-timer.service';
import { chatTimerService } from '../src/services/chat-timer.service';

const JWT_SECRET = process.env.JWT_SECRET || 'propertytalk_super_secret_jwt_key_2026';

export async function runCoreTests() {
  console.log('🧪 Starting PropertyTalk Automated Core Flow Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Test Countries & Initial Categories
    const countries = await prisma.country.findMany({ where: { isActive: true } });
    assert(countries.length >= 2, `Expected at least 2 active countries, got ${countries.length}`);
    const hasNZ = countries.some(c => c.code === 'NZ');
    const hasAU = countries.some(c => c.code === 'AU');
    assert(hasNZ && hasAU, 'Both New Zealand (NZ) and Australia (AU) are active');

    const categories = await prisma.category.findMany({ where: { isActive: true } });
    assert(categories.length === 10, `Expected exactly 10 categories, got ${categories.length}`);

    // 2. Test Official Register Links
    const registers = await prisma.officialRegisterLink.findMany();
    assert(registers.length >= 10, `Expected at least 10 official register links, got ${registers.length}`);
    const reaRegister = registers.find(r => r.urlPattern.includes('rea.govt.nz'));
    assert(!!reaRegister, 'NZ REA Public Register link is present');

    // 3. Test Verified Experts Directory Filtering
    const verifiedExperts = await prisma.expertProfile.findMany({
      where: { verificationStatus: 'VERIFIED' },
      include: { user: true, country: true, category: true }
    });
    assert(verifiedExperts.length >= 20, `Expected at least 20 verified demo experts, got ${verifiedExperts.length}`);

    let pendingExpert = await prisma.expertProfile.findFirst({
      where: { verificationStatus: 'PENDING_VERIFICATION' },
      include: { user: true }
    });
    if (!pendingExpert) {
      const pendingUser = await prisma.user.upsert({
        where: { email: 'pending-test-expert@example.com' },
        update: {},
        create: {
          email: 'pending-test-expert@example.com',
          name: 'Pending Test Expert',
          passwordHash: 'dummyhash',
          role: 'EXPERT',
        },
      });
      pendingExpert = await prisma.expertProfile.create({
        data: {
          userId: pendingUser.id,
          title: 'Registered Property Consultant',
          businessName: 'Pending Test Expert Business',
          bio: 'Experienced property advisor pending verification.',
          city: 'Auckland',
          languages: '["English"]',
          specialities: '["Residential"]',
          categoryId: categories[0].id,
          countryCode: 'NZ',
          verificationStatus: 'PENDING_VERIFICATION',
          isOnline: false,
        },
        include: { user: true },
      });
    }
    assert(!!pendingExpert, 'Pending expert exists for verification testing');
    assert(pendingExpert?.isOnline === false, 'Pending expert is initially offline');

    // 5. Test Talk Now Private Chat Flow
    const consumer = await prisma.user.findFirst({ where: { role: 'CONSUMER' } });
    const expert = verifiedExperts[0];
    assert(!!consumer && !!expert, 'Consumer and verified expert exist for chat test');

    const chat = await prisma.consultationChat.upsert({
      where: { id: 'test-chat-1' },
      update: {
        freeStartedAt: null,
        isFreeExpired: false,
        freeSecondsRemaining: 60,
        extendedPaid: false,
      },
      create: {
        id: 'test-chat-1',
        consumerId: consumer!.id,
        expertId: expert.id,
        status: 'ACTIVE',
      },
    });
    chatTimerService.stopChatTimer(chat.id);
    assert(!!chat, 'Talk Now chat created successfully');

    // Add chat message
    const msg = await prisma.chatMessage.create({
      data: {
        chatId: chat.id,
        senderId: consumer!.id,
        content: 'Hi, I need help reviewing a sale agreement for an Auckland property.',
      },
    });
    assert(msg.content.includes('Auckland'), 'Private message persisted');

    // 6. Test Call Session & Server-Authoritative Timer
    const callSession = await prisma.callSession.create({
      data: {
        chatId: chat.id,
        consumerId: consumer!.id,
        expertId: expert.id,
        callType: 'VIDEO',
        status: 'REQUESTED',
      },
    });
    assert(callSession.status === 'REQUESTED', 'Call request created in REQUESTED status');

    // Expert accepts
    const acceptedCall = await prisma.callSession.update({
      where: { id: callSession.id },
      data: { status: 'ACCEPTED', startedAt: new Date() },
    });
    assert(acceptedCall.status === 'ACCEPTED', 'Call marked as ACCEPTED by expert');

    // Start server-authoritative timer (60 seconds / 1 minute free)
    const timer = await callTimerService.startCallTimer(callSession.id, 60);
    assert(timer.freeSecondsRemaining === 60, 'Server timer initialized to 60 seconds (1 minute)');
    assert(timer.isFreeExpired === false, 'Free consultation timer not yet expired');

    // Test Server-Authoritative Chat Timer Service
    const chatTimer = await chatTimerService.startChatTimer(chat.id, 60);
    assert(chatTimer.freeSecondsRemaining === 60, 'Server chat timer initialized to 60 seconds (1 minute)');
    assert(chatTimer.isFreeExpired === false, 'Free chat timer not yet expired');
    chatTimerService.stopChatTimer(chat.id);

    // Stop call timer
    await callTimerService.stopCallTimer(callSession.id);
    const finalizedCall = await prisma.callSession.findUnique({ where: { id: callSession.id } });
    assert(finalizedCall?.status === 'COMPLETED', 'Call session finalized as COMPLETED');

    // 7. Test Anti-Duplicate Review Rule
    // First review
    const review = await prisma.review.upsert({
      where: {
        expertId_consumerId: {
          expertId: expert.id,
          consumerId: consumer!.id,
        },
      },
      update: { rating: 5, comment: 'Outstanding consultation!' },
      create: {
        expertId: expert.id,
        consumerId: consumer!.id,
        rating: 5,
        comment: 'Outstanding consultation!',
      },
    });
    assert(review.rating === 5, 'Review saved successfully');

    // Try creating duplicate review directly - should fail unique constraint
    let duplicateRejected = false;
    try {
      await prisma.review.create({
        data: {
          expertId: expert.id,
          consumerId: consumer!.id,
          rating: 4,
          comment: 'Duplicate review attempt',
        },
      });
    } catch {
      duplicateRejected = true;
    }
    assert(duplicateRejected, 'Duplicate review prevented by unique constraint');

    // 8. Test Super Admin Verification Queue Action
    const auditLog = await prisma.verificationAuditLog.create({
      data: {
        expertProfileId: pendingExpert!.id,
        action: 'APPROVE',
        notes: 'Verified against official public register',
        source: 'REA Register Lookup',
      },
    });
    assert(auditLog.action === 'APPROVE', 'Admin audit log recorded');

    console.log(`\n📊 Tests complete: ${passed} passed, ${failed} failed.\n`);
    return { passed, failed };
  } catch (err) {
    console.error('Test execution error:', err);
    throw err;
  }
}

if (process.argv[1]?.endsWith('api.test.ts')) {
  runCoreTests()
    .then(({ failed }) => {
      if (failed > 0) process.exit(1);
    })
    .catch(() => process.exit(1));
}
