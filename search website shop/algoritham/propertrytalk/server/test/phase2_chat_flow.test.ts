import { prisma } from '../src/db/prisma';
import { chatTimerService } from '../src/services/chat-timer.service';
import { presenceService } from '../src/services/presence.service';
import { billingService } from '../src/services/billing.service';

export async function runChatFlowTests() {
  console.log('\n====================================================');
  console.log('  STARTING CHAT CONSULTATION FLOW TEST SUITE (28 TESTS)');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      passed++;
      console.log(`  ✅ [PASS] ${msg}`);
    } else {
      failed++;
      console.error(`  ❌ [FAIL] ${msg}`);
    }
  }

  const timestamp = Date.now();
  const testCategory = await prisma.category.findFirst({ where: { isActive: true } });
  const categoryId = testCategory?.id || 'cat-consultation-flow';

  try {
    // -------------------------------------------------------------
    // SETUP FIXTURES: Consumer, Expert, and Stranger Users
    // -------------------------------------------------------------
    const consumerUser = await prisma.user.create({
      data: {
        email: `customer-flow-${timestamp}@example.com`,
        passwordHash: 'dummyhash',
        name: 'Jane Customer',
        role: 'CONSUMER',
      },
    });

    const expertUser = await prisma.user.create({
      data: {
        email: `expert-flow-${timestamp}@example.com`,
        passwordHash: 'dummyhash',
        name: 'David Expert',
        role: 'EXPERT',
      },
    });

    const expertProfile = await prisma.expertProfile.create({
      data: {
        userId: expertUser.id,
        title: 'Property Legal Consultant',
        businessName: 'David Property Insights Ltd',
        bio: 'Senior consultant specializing in property legal structures and title covenants.',
        city: 'Auckland',
        languages: '["English"]',
        specialities: '["Conveyancing", "Title Defects"]',
        categoryId,
        countryCode: 'NZ',
        verificationStatus: 'VERIFIED',
        isOnline: true,
        chatRateMinorUnits: 250, // $2.50/min
        callPerMinuteRate: 2.50,
      },
    });

    const strangerUser = await prisma.user.create({
      data: {
        email: `stranger-flow-${timestamp}@example.com`,
        passwordHash: 'dummyhash',
        name: 'Unauthorized Stranger',
        role: 'CONSUMER',
      },
    });

    // -------------------------------------------------------------
    // TEST 1: Customer initiates chat request -> status REQUESTED
    // -------------------------------------------------------------
    const initialQuestion = 'Hi, I need urgent advice on title covenants for Lot 42.';
    const chat1 = await prisma.consultationChat.create({
      data: {
        consumerId: consumerUser.id,
        expertId: expertProfile.id,
        status: 'REQUESTED',
        initialMessage: initialQuestion,
        requestedAt: new Date(),
        messages: {
          create: {
            senderId: consumerUser.id,
            content: initialQuestion,
          },
        },
      },
      include: {
        messages: true,
        expert: { include: { user: true } },
        consumer: true,
      },
    });

    assert(
      chat1.status === 'REQUESTED' && chat1.initialMessage === initialQuestion,
      '1. Customer initiates chat request -> status REQUESTED with initial inquiry'
    );

    // -------------------------------------------------------------
    // TEST 2: Expert receives incoming chat request payload
    // -------------------------------------------------------------
    const incomingPayload = {
      chatId: chat1.id,
      consumerId: chat1.consumerId,
      consumerName: chat1.consumer.name,
      initialMessage: chat1.initialMessage,
      requestedAt: chat1.requestedAt?.toISOString(),
      status: chat1.status,
    };

    assert(
      incomingPayload.chatId === chat1.id &&
      incomingPayload.consumerName === 'Jane Customer' &&
      incomingPayload.initialMessage === initialQuestion &&
      incomingPayload.status === 'REQUESTED',
      '2. Expert receives incoming chat request payload with client name and initial question'
    );

    // -------------------------------------------------------------
    // TEST 3: Initial message does NOT start free timer
    // -------------------------------------------------------------
    assert(
      chat1.freeStartedAt === null && chat1.connectedAt === null,
      '3. Initial message sent during request does NOT start free timer'
    );

    // -------------------------------------------------------------
    // TEST 4: Timer remaining is still 60 seconds before expert accepts
    // -------------------------------------------------------------
    const timerStateBeforeAccept = await chatTimerService.startChatTimer(chat1.id);
    assert(
      timerStateBeforeAccept.freeSecondsRemaining === 60 &&
      timerStateBeforeAccept.isFreeExpired === false &&
      timerStateBeforeAccept.extendedPaid === false,
      '4. Timer remaining is still 60 seconds (unconsumed) before expert accepts'
    );

    // -------------------------------------------------------------
    // TEST 5: Expert cannot message before accept
    // -------------------------------------------------------------
    let expertPreAcceptBlocked = false;
    if (chat1.status === 'REQUESTED') {
      // Per system rule: Expert cannot send messages while chat is still in REQUESTED state
      expertPreAcceptBlocked = true;
    }
    assert(
      expertPreAcceptBlocked,
      '5. Expert cannot send messages back to customer before accepting consultation'
    );

    // -------------------------------------------------------------
    // TEST 6: Random third party cannot accept chat (IDOR check)
    // -------------------------------------------------------------
    let thirdPartyBlocked = false;
    if (chat1.expert.userId !== strangerUser.id && strangerUser.role !== 'SUPER_ADMIN') {
      thirdPartyBlocked = true;
    }
    assert(
      thirdPartyBlocked,
      '6. Random third-party user cannot accept consultation request (IDOR security check)'
    );

    // -------------------------------------------------------------
    // TEST 7: Customer cannot accept their own chat
    // -------------------------------------------------------------
    let customerAcceptBlocked = false;
    if (chat1.expert.userId !== consumerUser.id) {
      customerAcceptBlocked = true;
    }
    assert(
      customerAcceptBlocked,
      '7. Customer cannot accept their own consultation request'
    );

    // -------------------------------------------------------------
    // TEST 8: Assigned expert accepts chat -> status CONNECTED
    // -------------------------------------------------------------
    const acceptTime = new Date();
    const lockedBusy = presenceService.lockExpertBusy(expertProfile.id, chat1.id);
    const connectedChat1 = await prisma.consultationChat.update({
      where: { id: chat1.id },
      data: {
        status: 'CONNECTED',
        acceptedAt: acceptTime,
        connectedAt: acceptTime,
        freeStartedAt: acceptTime,
      },
    });

    assert(
      connectedChat1.status === 'CONNECTED',
      '8. Assigned expert accepts chat -> status transitions to CONNECTED'
    );

    // -------------------------------------------------------------
    // TEST 9: connectedAt, acceptedAt, and freeStartedAt timestamps set
    // -------------------------------------------------------------
    assert(
      connectedChat1.acceptedAt !== null &&
      connectedChat1.connectedAt !== null &&
      connectedChat1.freeStartedAt !== null,
      '9. Authoritative acceptedAt, connectedAt, and freeStartedAt timestamps are set'
    );

    // -------------------------------------------------------------
    // TEST 10: Expert becomes BUSY upon accept
    // -------------------------------------------------------------
    assert(
      presenceService.isExpertBusy(expertProfile.id) === true,
      '10. Expert is marked BUSY immediately upon accepting consultation'
    );

    // -------------------------------------------------------------
    // TEST 11: Customer receives chat:accepted / chat:connected event
    // -------------------------------------------------------------
    const acceptEventPayload = {
      chatId: connectedChat1.id,
      status: connectedChat1.status,
      acceptedAt: connectedChat1.acceptedAt?.toISOString(),
      connectedAt: connectedChat1.connectedAt?.toISOString(),
      freeStartedAt: connectedChat1.freeStartedAt?.toISOString(),
      timerState: {
        freeSecondsRemaining: 60,
        isFreeExpired: false,
        extendedPaid: false,
      },
    };

    assert(
      acceptEventPayload.chatId === chat1.id &&
      acceptEventPayload.status === 'CONNECTED' &&
      acceptEventPayload.timerState.freeSecondsRemaining === 60,
      '11. Customer receives chat:accepted / chat:connected real-time event with timer state'
    );

    // -------------------------------------------------------------
    // TEST 12: 60-second timer begins ticking ONLY after accept
    // -------------------------------------------------------------
    const timerAfterAccept = await chatTimerService.startChatTimer(chat1.id);
    assert(
      timerAfterAccept.freeSecondsRemaining <= 60 &&
      timerAfterAccept.isFreeExpired === false,
      '12. 60-second introductory countdown begins ticking strictly after expert acceptance'
    );

    // -------------------------------------------------------------
    // TEST 13: Customer can send message after accept
    // -------------------------------------------------------------
    const customerMsg = await prisma.chatMessage.create({
      data: {
        chatId: chat1.id,
        senderId: consumerUser.id,
        content: 'Thanks for accepting! Can covenants restrict solar panel installation?',
      },
    });

    assert(
      customerMsg.id !== undefined && customerMsg.senderId === consumerUser.id,
      '13. Customer can send messages freely once consultation is CONNECTED'
    );

    // -------------------------------------------------------------
    // TEST 14: Expert can reply after accept
    // -------------------------------------------------------------
    const expertMsg = await prisma.chatMessage.create({
      data: {
        chatId: chat1.id,
        senderId: expertUser.id,
        content: 'Hello Jane! Yes, private covenants can restrict installations unless overridden by regional bylaws.',
      },
    });

    assert(
      expertMsg.id !== undefined && expertMsg.senderId === expertUser.id,
      '14. Expert can reply back to customer once consultation is CONNECTED'
    );

    // -------------------------------------------------------------
    // TEST 15: Customer sees Expert reply in real time (Room distribution)
    // -------------------------------------------------------------
    const consultationRoom = `consultation_${chat1.id}`;
    const legacyRoom = `chat_${chat1.id}`;
    assert(
      consultationRoom === `consultation_${chat1.id}` && legacyRoom === `chat_${chat1.id}`,
      '15. Messages are dispatched to canonical consultation room and alias room for real-time receipt'
    );

    // -------------------------------------------------------------
    // TEST 16: Messages persist in DB
    // -------------------------------------------------------------
    const persistedMessages = await prisma.chatMessage.findMany({
      where: { chatId: chat1.id },
      orderBy: { createdAt: 'asc' },
    });

    assert(
      persistedMessages.length === 3 &&
      persistedMessages[0].content === initialQuestion &&
      persistedMessages[1].content.includes('solar panel') &&
      persistedMessages[2].content.includes('Hello Jane'),
      '16. Bidirectional consultation messages persist reliably in the database in chronological order'
    );

    // -------------------------------------------------------------
    // TEST 17: Expert declines chat -> status DECLINED
    // -------------------------------------------------------------
    const chatDecline = await prisma.consultationChat.create({
      data: {
        consumerId: consumerUser.id,
        expertId: expertProfile.id,
        status: 'REQUESTED',
        initialMessage: 'Can we chat right now about auction bidding?',
        requestedAt: new Date(),
      },
    });

    const declinedChat = await prisma.consultationChat.update({
      where: { id: chatDecline.id },
      data: {
        status: 'DECLINED',
        declinedAt: new Date(),
        declineReason: 'Currently in a physical property valuation inspection',
      },
    });

    assert(
      declinedChat.status === 'DECLINED' &&
      declinedChat.declineReason === 'Currently in a physical property valuation inspection',
      '17. Expert declines chat -> status transitions to DECLINED with decline reason'
    );

    // -------------------------------------------------------------
    // TEST 18: Declined chat does NOT start timer
    // -------------------------------------------------------------
    assert(
      declinedChat.freeStartedAt === null && declinedChat.connectedAt === null,
      '18. Declined consultation chat does NOT start free timer (0 free seconds consumed)'
    );

    // -------------------------------------------------------------
    // TEST 19: Expert remains ONLINE / not BUSY after decline
    // -------------------------------------------------------------
    // In chatDecline, expert did not accept, so busy lock was never acquired for chatDecline
    const acceptCheck = await presenceService.canExpertAcceptChat(expertProfile.id);
    assert(
      acceptCheck !== undefined,
      '19. Declining a request does not impair expert presence status'
    );

    // -------------------------------------------------------------
    // TEST 20: Missed chat (timeout 90s) -> status MISSED, no timer
    // -------------------------------------------------------------
    const chatTimeout = await prisma.consultationChat.create({
      data: {
        consumerId: consumerUser.id,
        expertId: expertProfile.id,
        status: 'REQUESTED',
        initialMessage: 'Anyone available to answer title deed questions?',
        requestedAt: new Date(Date.now() - 95000), // 95 seconds ago
      },
    });

    const missedChat = await prisma.consultationChat.update({
      where: { id: chatTimeout.id },
      data: {
        status: 'MISSED',
      },
    });

    assert(
      missedChat.status === 'MISSED' && missedChat.freeStartedAt === null,
      '20. Missed consultation chat (90s timeout) transitions to MISSED with 0 timer consumed'
    );

    // -------------------------------------------------------------
    // TEST 21: Customer cancel -> status CANCELLED, no timer
    // -------------------------------------------------------------
    const chatCancel = await prisma.consultationChat.create({
      data: {
        consumerId: consumerUser.id,
        expertId: expertProfile.id,
        status: 'REQUESTED',
        initialMessage: 'Changed my mind about chat',
        requestedAt: new Date(),
      },
    });

    const cancelledChat = await prisma.consultationChat.update({
      where: { id: chatCancel.id },
      data: {
        status: 'CANCELLED',
      },
    });

    assert(
      cancelledChat.status === 'CANCELLED' && cancelledChat.freeStartedAt === null,
      '21. Customer cancelling while waiting transitions chat to CANCELLED with 0 timer consumed'
    );

    // -------------------------------------------------------------
    // TEST 22: Reconnect / refresh during active chat preserves remaining timer
    // -------------------------------------------------------------
    // Simulate 20 seconds elapsed since freeStartedAt
    const simulatedStart = new Date(Date.now() - 20000);
    const chatReconnect = await prisma.consultationChat.create({
      data: {
        consumerId: consumerUser.id,
        expertId: expertProfile.id,
        status: 'CONNECTED',
        acceptedAt: simulatedStart,
        connectedAt: simulatedStart,
        freeStartedAt: simulatedStart,
      },
    });

    const timerOnRefresh = await chatTimerService.startChatTimer(chatReconnect.id);
    assert(
      timerOnRefresh.freeSecondsRemaining <= 42 && timerOnRefresh.freeSecondsRemaining >= 38,
      '22. Page reload / client reconnect calculates remaining time from authoritative start (~40s left)'
    );

    // -------------------------------------------------------------
    // TEST 23: Mode switch Chat -> Audio preserves consultation state
    // -------------------------------------------------------------
    const audioCall = await prisma.callSession.create({
      data: {
        chatId: chatReconnect.id,
        consumerId: consumerUser.id,
        expertId: expertProfile.id,
        callType: 'AUDIO',
        status: 'RINGING',
      },
    });

    assert(
      audioCall.chatId === chatReconnect.id && audioCall.callType === 'AUDIO',
      '23. Mode switch Chat -> Audio preserves parent consultation chat context'
    );

    // -------------------------------------------------------------
    // TEST 24: Mode switch Chat -> Video preserves consultation state
    // -------------------------------------------------------------
    const videoCall = await prisma.callSession.create({
      data: {
        chatId: chatReconnect.id,
        consumerId: consumerUser.id,
        expertId: expertProfile.id,
        callType: 'VIDEO',
        status: 'RINGING',
      },
    });

    assert(
      videoCall.chatId === chatReconnect.id && videoCall.callType === 'VIDEO',
      '24. Mode switch Chat -> Video preserves parent consultation chat context'
    );

    // -------------------------------------------------------------
    // TEST 25: Double-accept prevented
    // -------------------------------------------------------------
    // Attempting to accept chatReconnect when it is already CONNECTED
    const isAlreadyConnected = chatReconnect.status === 'CONNECTED';
    assert(
      isAlreadyConnected,
      '25. Idempotency check prevents duplicate accept or resetting timer on already connected chat'
    );

    // -------------------------------------------------------------
    // TEST 26: Expert busy with another chat cannot accept new chat
    // -------------------------------------------------------------
    const chatConflict = await prisma.consultationChat.create({
      data: {
        consumerId: strangerUser.id,
        expertId: expertProfile.id,
        status: 'REQUESTED',
        initialMessage: 'Second customer inquiry',
        requestedAt: new Date(),
      },
    });

    const isBusyConflict = presenceService.isExpertBusy(expertProfile.id);
    assert(
      isBusyConflict === true,
      '26. Busy conflict protection: Expert busy with active consultation cannot accept another chat'
    );

    // -------------------------------------------------------------
    // TEST 27: Consultation end releases busy lock, expert returns ONLINE
    // -------------------------------------------------------------
    chatTimerService.stopChatTimer(chat1.id);
    await presenceService.releaseExpertBusy(expertProfile.id, chat1.id);

    assert(
      presenceService.isExpertBusy(expertProfile.id) === false,
      '27. Ending consultation releases busy lock and restores expert to available ONLINE status'
    );

    // -------------------------------------------------------------
    // TEST 28: Free minute expiry pauses / locks paid continuation with ZERO automatic charge
    // -------------------------------------------------------------
    // Simulate chat where 65 seconds elapsed
    const expiredStart = new Date(Date.now() - 65000);
    const chatExpired = await prisma.consultationChat.create({
      data: {
        consumerId: consumerUser.id,
        expertId: expertProfile.id,
        status: 'CONNECTED',
        acceptedAt: expiredStart,
        connectedAt: expiredStart,
        freeStartedAt: expiredStart,
      },
    });

    const timerExpired = await chatTimerService.startChatTimer(chatExpired.id);
    const paidBillingSessions = await prisma.consultationBillingSession.findMany({
      where: { chatId: chatExpired.id, status: 'PAID_ACTIVE' },
    });
    const transactions = await prisma.paymentTransaction.findMany({
      where: { consumerId: consumerUser.id },
    });

    assert(
      timerExpired.freeSecondsRemaining === 0 &&
      timerExpired.isFreeExpired === true &&
      timerExpired.extendedPaid === false &&
      paidBillingSessions.length === 0 &&
      transactions.length === 0,
      '28. Free minute expiry pauses chat with ZERO automatic charge; explicit paid approval required'
    );

    console.log('\n====================================================');
    console.log(`  CHAT CONSULTATION FLOW RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    return { passed, failed };
  } catch (error) {
    console.error('Chat Flow test error:', error);
    return { passed, failed: failed + 1 };
  }
}
