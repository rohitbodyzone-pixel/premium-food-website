import { prisma } from '../src/db/prisma';
import { presenceService } from '../src/services/presence.service';
import { callProvider } from '../src/services/call-provider/webrtc-call-provider';
import { callTimerService } from '../src/services/call-timer.service';

export async function runWebRTCPresenceTests() {
  console.log('\n📡 Starting PropertyTalk Automated WebRTC & Presence Tests...\n');
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
    // 1. Authoritative Expert Presence Tracking
    const expertInDb = await prisma.expertProfile.findFirst({
      where: { verificationStatus: 'VERIFIED' },
      include: { user: true },
    });
    assert(!!expertInDb, 'Found verified expert in database for presence tests');

    const testExpertId = expertInDb!.id;
    const testUserId = expertInDb!.userId;
    const socket1 = 'socket-client-desktop-1';
    const socket2 = 'socket-client-mobile-2';

    // Set expert online manually via dashboard toggle
    await presenceService.setManualOnlineStatus(testExpertId, true);

    // Initial state check
    let currentPresence = await presenceService.getExpertPresence(testExpertId);
    assert(currentPresence.status === 'ONLINE', 'Expert status is ONLINE when enabled');

    // Socket 1 connects
    presenceService.registerUserSocket(testUserId, socket1, testExpertId);
    currentPresence = await presenceService.getExpertPresence(testExpertId);
    assert(currentPresence.socketCount === 1, 'Socket count is 1 after first device connects');
    assert(presenceService.isExpertSocketConnected(testExpertId) === true, 'isExpertSocketConnected is true');

    // Multi-device socket connection (Socket 2 connects from phone)
    presenceService.registerUserSocket(testUserId, socket2, testExpertId);
    currentPresence = await presenceService.getExpertPresence(testExpertId);
    assert(currentPresence.socketCount === 2, 'Socket count is 2 across multiple devices');

    // Socket 1 disconnects - presence should remain connected because Socket 2 is still active
    await presenceService.handleSocketDisconnect(testUserId, socket1, testExpertId);
    currentPresence = await presenceService.getExpertPresence(testExpertId);
    assert(currentPresence.socketCount === 1, 'Socket count decremented to 1 without dropping presence');
    assert(presenceService.isExpertSocketConnected(testExpertId) === true, 'Expert remains connected on remaining socket');

    // 2. Atomic Busy Locking & Double-Booking Protection
    const callSessionId1 = `call-sess-${Date.now()}-1`;
    const callSessionId2 = `call-sess-${Date.now()}-2`;

    const lockAcquired = presenceService.lockExpertBusy(testExpertId, callSessionId1);
    assert(lockAcquired === true, 'Busy lock successfully acquired for active consultation');

    currentPresence = await presenceService.getExpertPresence(testExpertId);
    assert(currentPresence.status === 'BUSY', 'Expert status transitions authoritatively to BUSY');
    assert(presenceService.isExpertBusy(testExpertId) === true, 'isExpertBusy returns true');

    // Attempt second simultaneous consultation call - must be blocked!
    const secondLockAttempt = presenceService.lockExpertBusy(testExpertId, callSessionId2);
    assert(secondLockAttempt === false, 'Concurrent call request rejected: Expert is already BUSY');

    // Eligibility check rejects call while busy
    const eligibilityWhileBusy = await presenceService.canExpertAcceptCall(testExpertId);
    assert(eligibilityWhileBusy.eligible === false, 'canExpertAcceptCall returns false while busy in call');

    // Release busy lock when consultation ends
    await presenceService.releaseExpertBusy(testExpertId, callSessionId1);
    currentPresence = await presenceService.getExpertPresence(testExpertId);
    assert(currentPresence.status === 'ONLINE', 'Expert status returns to ONLINE upon call completion');
    assert(presenceService.isExpertBusy(testExpertId) === false, 'Expert is no longer busy');

    // Clean up socket 2
    await presenceService.handleSocketDisconnect(testUserId, socket2, testExpertId);

    // 3. WebRTC Call Provider Session & ICE Server Configuration
    const providerSession = await callProvider.createSession({
      callSessionId: `consultation_room_${Date.now()}`,
      callType: 'VIDEO',
      consumerId: 'alice-consumer',
      expertId: 'bob-expert',
    });

    assert(providerSession.provider === 'webrtc', 'Call provider is webrtc');
    assert(Array.isArray(providerSession.iceServers), 'Provider supplies ICE server configurations');
    assert(providerSession.iceServers!.length > 0, 'ICE servers list contains STUN/TURN endpoints');
    assert(
      providerSession.iceServers![0].urls.length > 0,
      'STUN/TURN URLs are properly configured'
    );

    // 4. Server-Authoritative 1-Minute Free Consultation Timer Trigger
    // Verify that timer begins ONLY when connect is called (IN_PROGRESS), not at REQUESTED or ACCEPTED
    const consumer = await prisma.user.findFirst({ where: { role: 'CONSUMER' } });
    assert(!!consumer, 'Consumer found for call timer validation');

    const testChat = await prisma.consultationChat.upsert({
      where: { id: 'test-chat-webrtc-timer' },
      update: {},
      create: {
        id: 'test-chat-webrtc-timer',
        consumerId: consumer!.id,
        expertId: testExpertId,
        status: 'ACTIVE',
      },
    });

    const call = await prisma.callSession.create({
      data: {
        chatId: testChat.id,
        consumerId: consumer!.id,
        expertId: testExpertId,
        callType: 'AUDIO',
        status: 'REQUESTED',
        freeMinutesAllowed: 1, // 1 minute free
      },
    });

    // In REQUESTED status: Timer must NOT be running
    let timerState = callTimerService.getTimerState(call.id);
    assert(!timerState, 'Timer is NOT started while call is in REQUESTED state');

    // In ACCEPTED status: Timer must NOT be running (waiting for WebRTC media connect)
    await prisma.callSession.update({
      where: { id: call.id },
      data: { status: 'ACCEPTED' },
    });
    timerState = callTimerService.getTimerState(call.id);
    assert(!timerState, 'Timer is NOT started while call is in ACCEPTED state');

    // WebRTC connects -> call transitions to IN_PROGRESS -> Timer starts!
    await prisma.callSession.update({
      where: { id: call.id },
      data: { status: 'IN_PROGRESS', connectedAt: new Date() },
    });
    const startedTimer = await callTimerService.startCallTimer(call.id, 60);
    assert(startedTimer.freeSecondsRemaining === 60, 'Timer starts at exactly 60 seconds (1 minute free)');
    assert(startedTimer.isFreeExpired === false, 'Free timer is initially active and unexpired');

    // Clean up timer, presence grace timers, and test call
    presenceService.clearAllTimers();
    await callTimerService.stopCallTimer(call.id);
    await prisma.callSession.delete({ where: { id: call.id } });

    console.log(`\n📊 WebRTC & Presence Tests Complete: ${passed} passed, ${failed} failed.\n`);
    return { passed, failed };
  } catch (err) {
    console.error('WebRTC & Presence test failed with error:', err);
    throw err;
  }
}

if (process.argv[1]?.endsWith('webrtc-presence.test.ts')) {
  runWebRTCPresenceTests()
    .then(({ failed }) => {
      if (failed > 0) process.exit(1);
    })
    .catch(() => process.exit(1));
}
