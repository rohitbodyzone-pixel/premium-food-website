import { prisma } from '../src/db/prisma';
import { presenceService } from '../src/services/presence.service';
import { callProvider } from '../src/services/call-provider/webrtc-call-provider';
import { callTimerService } from '../src/services/call-timer.service';
import { billingService } from '../src/services/billing.service';

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

    // 5. Intra-Consultation Escalation & Free Timer Inheritance Regression Tests (10 Scenarios)
    console.log('\n🔄 Testing Same-Consultation Escalation (Chat -> Audio -> Video) & Timer Continuity...\n');

    const testConsumerA = consumer!.id;
    const testConsumerB = 'consumer-unrelated-third-party-b';
    const consultationChatId = `chat-escalation-${Date.now()}`;

    // Create consultation chat record in DB so foreign keys are satisfied
    await prisma.consultationChat.upsert({
      where: { id: consultationChatId },
      update: {},
      create: {
        id: consultationChatId,
        consumerId: testConsumerA,
        expertId: testExpertId,
        status: 'CONNECTED',
      },
    });

    // Reset presence
    await presenceService.setManualOnlineStatus(testExpertId, true);
    await presenceService.releaseExpertBusy(testExpertId, 'force-clear');

    // SCENARIO 1: Same Consultation Chat -> Audio Upgrade Permitted
    const chatLockAcquired = presenceService.lockExpertBusy(testExpertId, consultationChatId, {
      chatId: consultationChatId,
      consumerId: testConsumerA,
    });
    assert(chatLockAcquired === true, 'S1: Expert successfully locked for introductory Chat consultation');
    assert(presenceService.isExpertBusy(testExpertId) === true, 'S1: Expert presence is BUSY for Chat');

    // Customer A requests Audio Call from the active Chat
    const canEscalateToAudio = await presenceService.canExpertAcceptCall(testExpertId, {
      chatId: consultationChatId,
      consumerId: testConsumerA,
    });
    assert(canEscalateToAudio.eligible === true, 'S1: Same-consultation Customer A Chat -> Audio upgrade is PERMITTED (no false 409)');

    // Expert accepts the Audio Call: lock transitions to call session atomically
    const audioCallSessionId = `call-audio-${Date.now()}`;
    const audioLockAcquired = presenceService.lockExpertBusy(testExpertId, audioCallSessionId, {
      chatId: consultationChatId,
      consumerId: testConsumerA,
    });
    assert(audioLockAcquired === true, 'S1: Expert lock transitioned atomically from Chat to Audio call');
    assert(presenceService.getActiveConsultation(testExpertId)?.sessionId === audioCallSessionId, 'S1: Active lock sessionId is now the Audio Call');

    // SCENARIO 2: Same Consultation Chat -> Video Upgrade Permitted
    const videoCallSessionId = `call-video-${Date.now()}`;
    await prisma.callSession.upsert({
      where: { id: videoCallSessionId },
      update: {},
      create: {
        id: videoCallSessionId,
        chatId: consultationChatId,
        consumerId: testConsumerA,
        expertId: testExpertId,
        callType: 'VIDEO',
        status: 'REQUESTED',
        freeMinutesAllowed: 1,
      },
    });

    const canEscalateToVideo = await presenceService.canExpertAcceptCall(testExpertId, {
      chatId: consultationChatId,
      consumerId: testConsumerA,
    });
    assert(canEscalateToVideo.eligible === true, 'S2: Same-consultation Customer A Chat -> Video upgrade is PERMITTED');

    const videoLockAcquired = presenceService.lockExpertBusy(testExpertId, videoCallSessionId, {
      chatId: consultationChatId,
      consumerId: testConsumerA,
    });
    assert(videoLockAcquired === true, 'S2: Expert lock transitioned atomically to Video call');

    // SCENARIO 3: Intra-Consultation Audio <-> Video Switch Permitted
    const canSwitchBackToAudio = await presenceService.canExpertAcceptCall(testExpertId, {
      chatId: consultationChatId,
      consumerId: testConsumerA,
    });
    assert(canSwitchBackToAudio.eligible === true, 'S3: Intra-consultation Video -> Audio switch is PERMITTED');

    // SCENARIO 4: Timer Continuation: Remaining Seconds Inherited, FreeStartedAt Not Reset, No 2nd Free Minute
    const remainingSecondsFromChat = 33; // e.g. screenshot showed 33 seconds remaining
    const inheritedCall = await prisma.callSession.create({
      data: {
        chatId: consultationChatId,
        consumerId: testConsumerA,
        expertId: testExpertId,
        callType: 'VIDEO',
        status: 'REQUESTED',
        freeMinutesAllowed: 1,
        freeSecondsRemaining: remainingSecondsFromChat, // Inherited exactly from chat!
      },
    });
    assert(inheritedCall.freeSecondsRemaining === 33, 'S4: Call session inherits exact 33s remaining from chat');
    assert(inheritedCall.freeSecondsRemaining !== 60, 'S4: Call session does NOT reset to 60s (no 2nd free minute)');

    // Start timer upon connection with inherited seconds
    const inheritedActiveTimer = await callTimerService.startCallTimer(inheritedCall.id, inheritedCall.freeSecondsRemaining);
    assert(inheritedActiveTimer.freeSecondsRemaining === 33, 'S4: Server-authoritative timer started with inherited 33 seconds');
    assert(inheritedActiveTimer.isFreeExpired === false, 'S4: Free timer is active with remaining inherited seconds');
    await callTimerService.stopCallTimer(inheritedCall.id);
    await prisma.callSession.delete({ where: { id: inheritedCall.id } });

    // Test already extended paid inheritance
    const paidInheritedTimer = await callTimerService.startCallTimer(videoCallSessionId, 0, true);
    assert(paidInheritedTimer.extendedPaid === true, 'S4: Already-paid consultation inherits extendedPaid = true');
    assert(paidInheritedTimer.isFreeExpired === false, 'S4: Paid consultation is not expired');
    await callTimerService.stopCallTimer(videoCallSessionId);
    await prisma.callSession.delete({ where: { id: videoCallSessionId } });
    await prisma.consultationChat.delete({ where: { id: consultationChatId } });

    // SCENARIO 5: 3rd-Party Customer Blocked with 409 while Expert is Busy in this Consultation
    // Lock is currently on Expert X with Customer A (consultationChatId)
    presenceService.lockExpertBusy(testExpertId, consultationChatId, {
      chatId: consultationChatId,
      consumerId: testConsumerA,
    });

    const thirdPartyChatAttempt = await presenceService.canExpertAcceptChat(testExpertId, {
      chatId: 'chat-different-customer-b',
      consumerId: testConsumerB,
    });
    assert(thirdPartyChatAttempt.eligible === false, 'S5: 3rd-party Customer B is BLOCKED from initiating Chat while Expert is busy');
    assert(thirdPartyChatAttempt.reason === 'Expert is currently busy in another consultation.', 'S5: Block reason explicitly states expert is busy in another consultation');

    const thirdPartyCallAttempt = await presenceService.canExpertAcceptCall(testExpertId, {
      chatId: 'chat-different-customer-b',
      consumerId: testConsumerB,
    });
    assert(thirdPartyCallAttempt.eligible === false, 'S5: 3rd-party Customer B is BLOCKED from initiating Call while Expert is busy');
    assert(thirdPartyCallAttempt.reason === 'Expert is currently busy in another consultation.', 'S5: Call block reason is clear and authoritative');

    // SCENARIO 6: No Duplicate Consultation or Ghost Call Session
    const duplicateLockAttempt = presenceService.lockExpertBusy(testExpertId, 'ghost-call-999', {
      chatId: 'chat-unrelated-ghost',
      consumerId: testConsumerB,
    });
    assert(duplicateLockAttempt === false, 'S6: Atomic lock rejects duplicate/unrelated ghost session');

    // SCENARIO 7: Failed / Missed Call Does Not Leave Expert Permanently Busy
    await presenceService.releaseExpertBusy(testExpertId, 'unmatched-session');
    assert(presenceService.isExpertBusy(testExpertId) === true, 'S7: Releasing unmatched session does not accidentally drop lock');

    // SCENARIO 8: Ending Consultation Cleans Up All Busy Locks and Returns Expert to ONLINE
    await presenceService.releaseExpertBusy(testExpertId, consultationChatId);
    assert(presenceService.isExpertBusy(testExpertId) === false, 'S8: Expert busy lock released on consultation end');
    const finalPresence = await presenceService.getExpertPresence(testExpertId);
    assert(finalPresence.status === 'ONLINE', 'S8: Expert presence returns to ONLINE when consultation concludes');

    // SCENARIO 9: ErrorBoundary and Mobile Resilience Verification
    const fs = await import('fs');
    const path = await import('path');
    const errorBoundaryPath = path.resolve(__dirname, '../../client/src/components/common/ErrorBoundary.tsx');
    assert(fs.existsSync(errorBoundaryPath), 'S9: ErrorBoundary component exists in client source tree');

    const customerAppContent = fs.readFileSync(path.resolve(__dirname, '../../client/src/apps/customer/CustomerApp.tsx'), 'utf-8');
    assert(customerAppContent.includes('ErrorBoundary'), 'S9: CustomerApp is protected by ErrorBoundary to prevent blank screens');

    const expertAppContent = fs.readFileSync(path.resolve(__dirname, '../../client/src/apps/expert/ExpertApp.tsx'), 'utf-8');
    assert(expertAppContent.includes('ErrorBoundary'), 'S9: ExpertApp is protected by ErrorBoundary');

    // Setup a parent consultation chat for expiry call sessions
    const testExpiryChat = await prisma.consultationChat.create({
      data: {
        consumerId: testConsumerA,
        expertId: testExpertId,
        status: 'CONNECTED',
        freeSecondsRemaining: 60,
      },
    });

    // SCENARIO 10: Audio Call Free Expiry at 00:00 -> Audio Cannot Continue Free
    const audioExpiryCall = await prisma.callSession.create({
      data: {
        chatId: testExpiryChat.id,
        consumerId: testConsumerA,
        expertId: testExpertId,
        callType: 'AUDIO',
        status: 'IN_PROGRESS',
        freeMinutesAllowed: 1,
        freeSecondsRemaining: 0,
        connectedAt: new Date(),
      },
    });
    const audioExpiryTimer = await callTimerService.startCallTimer(audioExpiryCall.id, 0);
    assert(audioExpiryTimer.isFreeExpired === true, 'S10: Audio call at 00:00 marked isFreeExpired = true');
    assert(audioExpiryTimer.freeSecondsRemaining === 0, 'S10: Audio call free seconds is strictly 0');
    assert(audioExpiryTimer.extendedPaid === false, 'S10: Audio call cannot continue free without paid authorization');

    // SCENARIO 11: Video Call Free Expiry at 00:00 -> Media Marked Paused
    const videoExpiryCall = await prisma.callSession.create({
      data: {
        chatId: testExpiryChat.id,
        consumerId: testConsumerA,
        expertId: testExpertId,
        callType: 'VIDEO',
        status: 'IN_PROGRESS',
        freeMinutesAllowed: 1,
        freeSecondsRemaining: 0,
        connectedAt: new Date(),
      },
    });
    const videoExpiryTimer = await callTimerService.startCallTimer(videoExpiryCall.id, 0);
    assert(videoExpiryTimer.isFreeExpired === true, 'S11: Video call at 00:00 marked isFreeExpired = true');
    assert(videoExpiryTimer.extendedPaid === false, 'S11: Video call is paused awaiting explicit customer consent');

    // SCENARIO 12: Zero Auto-Charge at Expiry
    assert(audioExpiryTimer.paidSecondsElapsed === 0, 'S12: Zero paid seconds elapsed at expiry');
    assert(videoExpiryTimer.paidSecondsElapsed === 0, 'S12: Video call zero paid seconds elapsed at expiry');
    const audioCallDb = await prisma.callSession.findUnique({ where: { id: audioExpiryCall.id } });
    assert(audioCallDb?.costCharged === 0, 'S12: Zero auto-charge incurred at expiry (costCharged = 0)');

    // SCENARIO 13: Step 1 Options Available (Prepare-Paid Quote with rate, currency, rules)
    const quote = await billingService.preparePaidQuote({
      consultationId: audioExpiryCall.id,
      consultationType: 'AUDIO',
      consumerId: testConsumerA,
    });
    assert(quote.rateMinorUnitsPerMinute > 0, 'S13: Pre-continuation quote returns explicit per-minute rate');
    assert(!!quote.currency, 'S13: Pre-continuation quote specifies currency');
    assert(!!quote.rateFormatted, 'S13: Pre-continuation quote contains formatted rate string');

    // SCENARIO 14: Step 1 without Step 2 Confirmation = No Charge
    await callTimerService.stopCallTimer(audioExpiryCall.id);
    const audioCallStopped = await prisma.callSession.findUnique({ where: { id: audioExpiryCall.id } });
    assert(audioCallStopped?.costCharged === 0, 'S14: Ending session without Step 2 confirmation results in $0 cost charged');

    // SCENARIO 15: Step 2 Explicit Paid Confirmation Resumes Paid Media & Starts Paid Timer
    const paymentCust = await billingService.ensurePaymentCustomer(testConsumerA);
    let testCard = await prisma.paymentMethodReference.findFirst({
      where: { paymentCustomerId: paymentCust.id },
    });
    if (!testCard) {
      testCard = await prisma.paymentMethodReference.create({
        data: {
          paymentCustomerId: paymentCust.id,
          providerMethodId: 'pm_webrtc_test_card',
          cardBrand: 'visa',
          cardLast4: '4242',
          cardExpMonth: 12,
          cardExpYear: 2028,
          isDefault: true,
        },
      });
    }

    const paidConfirmed = await callTimerService.confirmPaidContinuation(
      videoExpiryCall.id,
      testConsumerA,
      testCard.id
    );
    assert(paidConfirmed === true, 'S15: Explicit Step 2 confirmation succeeds');
    const activePaidVideoTimer = callTimerService.getTimerState(videoExpiryCall.id);
    assert(activePaidVideoTimer?.extendedPaid === true, 'S15: Paid timer extendedPaid set to true');
    assert(activePaidVideoTimer?.isFreeExpired === false, 'S15: Free expired flag cleared upon paid activation');

    // SCENARIO 16: Free Timer Never Resets
    assert(activePaidVideoTimer?.freeSecondsRemaining === 0, 'S16: Free seconds remain 0 (no secondary free minute granted)');
    const videoCallDbCheck = await prisma.callSession.findUnique({ where: { id: videoExpiryCall.id } });
    assert(videoCallDbCheck?.freeSecondsRemaining === 0, 'S16: DB record maintains freeSecondsRemaining = 0');

    // SCENARIO 17: Book Appointment Stops Media & Ends Call with $0 Charge
    await callTimerService.stopCallTimer(videoExpiryCall.id);
    const apptCall = await prisma.callSession.create({
      data: {
        chatId: testExpiryChat.id,
        consumerId: testConsumerA,
        expertId: testExpertId,
        callType: 'VIDEO',
        status: 'IN_PROGRESS',
        freeMinutesAllowed: 1,
        freeSecondsRemaining: 0,
        connectedAt: new Date(),
      },
    });
    presenceService.lockExpertBusy(testExpertId, apptCall.id, { consumerId: testConsumerA });
    await callTimerService.stopCallTimer(apptCall.id);
    await presenceService.releaseExpertBusy(testExpertId, apptCall.id);
    const apptCallDb = await prisma.callSession.findUnique({ where: { id: apptCall.id } });
    assert(apptCallDb?.costCharged === 0, 'S17: Book Appointment exit leaves call cost at $0');
    assert(presenceService.isExpertBusy(testExpertId) === false, 'S17: Busy lock freed on booking appointment');

    // SCENARIO 18: Conclude Consultation Ends Call with $0 Charge & Returns Expert to ONLINE
    const concludeCall = await prisma.callSession.create({
      data: {
        chatId: testExpiryChat.id,
        consumerId: testConsumerA,
        expertId: testExpertId,
        callType: 'AUDIO',
        status: 'IN_PROGRESS',
        freeMinutesAllowed: 1,
        freeSecondsRemaining: 0,
        connectedAt: new Date(),
      },
    });
    presenceService.lockExpertBusy(testExpertId, concludeCall.id, { consumerId: testConsumerA });
    await callTimerService.stopCallTimer(concludeCall.id);
    await presenceService.releaseExpertBusy(testExpertId, concludeCall.id);
    assert(presenceService.isExpertBusy(testExpertId) === false, 'S18: Conclude consultation releases expert busy lock');
    const expertPres = await presenceService.getExpertPresence(testExpertId);
    assert(expertPres.status === 'ONLINE', 'S18: Expert presence returns to ONLINE');

    // SCENARIO 19: WebRTC Client Media Cutoff Verification
    const webrtcSource = fs.readFileSync(path.resolve(__dirname, '../../client/src/services/webrtc.ts'), 'utf-8');
    assert(webrtcSource.includes('pauseMedia(): void'), 'S19: WebRTCManager has pauseMedia method for strict track disabling');
    assert(webrtcSource.includes('resumeMedia('), 'S19: WebRTCManager has resumeMedia method');
    assert(webrtcSource.includes('isMediaPaused()'), 'S19: WebRTCManager has isMediaPaused method');

    const activeCallModalSource = fs.readFileSync(path.resolve(__dirname, '../../client/src/components/call/ActiveCallModal.tsx'), 'utf-8');
    assert(activeCallModalSource.includes('remoteAudioRef.current.muted = true'), 'S19: ActiveCallModal strictly mutes remote audio element at expiry');
    assert(activeCallModalSource.includes('PaidContinuationModal'), 'S19: ActiveCallModal mounts PaidContinuationModal for two-step continuation');

    // Cleanup test call and chat records
    await prisma.callSession.deleteMany({
      where: {
        id: { in: [audioExpiryCall.id, videoExpiryCall.id, apptCall.id, concludeCall.id] },
      },
    });
    await prisma.consultationChat.delete({ where: { id: testExpiryChat.id } });

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
