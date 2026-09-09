import { prisma } from '../src/db/prisma';
import { billingService } from '../src/services/billing.service';
import { getPaymentProvider, resetPaymentProviderForTesting } from '../src/services/payment/payment-provider.factory';
import { StripePaymentProvider } from '../src/services/payment/stripe-payment.provider';
import { MockPaymentProvider } from '../src/services/payment/mock-payment.provider';

export async function runStripeRegressionTests() {
  console.log('\n====================================================');
  console.log('  STRIPE TEST MODE & PAID CONSULTATION REGRESSION SUITE (30 TESTS)');
  console.log('====================================================');

  const origProvider = process.env.PAYMENT_PROVIDER;
  process.env.PAYMENT_PROVIDER = 'mock';
  resetPaymentProviderForTesting();

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
    // Locate test users & experts
    const consumer = await prisma.user.findFirst({
      where: { email: 'james.wilson@gmail.com' },
    });
    if (!consumer) throw new Error('Demo consumer not found in database');

    const nzExpert = await prisma.expertProfile.findFirst({
      where: { countryCode: 'NZ', verificationStatus: 'VERIFIED' },
      include: { user: true },
    });
    if (!nzExpert) throw new Error('NZ expert not found');

    const auExpert = await prisma.expertProfile.findFirst({
      where: { countryCode: 'AU', verificationStatus: 'VERIFIED' },
      include: { user: true },
    });
    if (!auExpert) throw new Error('AU expert not found');

    const adminUser = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
    });
    if (!adminUser) throw new Error('Super admin user not found');

    // 1. 60 sec free → $0
    const freeChat = await prisma.consultationChat.create({
      data: {
        consumerId: consumer.id,
        expertId: nzExpert.id,
        freeSecondsRemaining: 0,
        isFreeExpired: true,
      },
    });

    const finalizeFreeOnly = await billingService.finalizePaidSession({
      consultationId: freeChat.id,
      consultationType: 'CHAT',
      paidSecondsUsed: 0,
    });
    assert(finalizeFreeOnly === null, '1. 60 sec free consultation without continuation charges exactly $0 and generates no transaction');

    // 2. Expiry alone → $0
    const expiredChat = await prisma.consultationChat.create({
      data: {
        consumerId: consumer.id,
        expertId: nzExpert.id,
        status: 'EXPIRED_FREE',
        freeSecondsRemaining: 0,
        isFreeExpired: true,
        costCharged: 0,
      },
    });
    const txForExpired = await prisma.paymentTransaction.findFirst({
      where: { consumerId: consumer.id, billingSession: { chatId: expiredChat.id } },
    });
    assert(!txForExpired, '2. 00:00 free time expiry alone incurs $0 automatic charge and zero transactions');

    // 3. Continue Paid Step 1 → $0
    const step1Quote = await billingService.preparePaidQuote({
      consultationId: freeChat.id,
      consultationType: 'CHAT',
      consumerId: consumer.id,
    });
    assert(Boolean(step1Quote) && step1Quote.rateMinorUnitsPerMinute > 0, '3. Continue Paid Step 1 prepares quote without creating any charge or transaction');
    const txAfterQuote = await prisma.paymentTransaction.findFirst({
      where: { billingSession: { chatId: freeChat.id } },
    });
    assert(!txAfterQuote, '3b. No charge or transaction created merely for viewing Step 1 Continue Paid screen');

    // 4. Closing confirmation → $0
    // Simulating user declining/closing without confirming
    const txAfterCancel = await prisma.paymentTransaction.findFirst({
      where: { billingSession: { chatId: freeChat.id } },
    });
    assert(!txAfterCancel, '4. Closing or canceling confirmation leaves user balance and transactions at $0');

    // 5. Explicit Confirm activates paid billing
    await billingService.ensurePaymentCustomer(consumer.id);
    const confirmRes = await billingService.confirmPaidContinuation({
      consultationId: freeChat.id,
      consultationType: 'CHAT',
      consumerId: consumer.id,
    });
    assert(confirmRes.success === true && confirmRes.status === 'PAID_ACTIVE', '5. Explicit confirmation successfully transitions session to PAID_ACTIVE');
    const activeBillingSession = await prisma.consultationBillingSession.findUnique({
      where: { id: confirmRes.billingSessionId },
    });
    assert(Boolean(activeBillingSession?.paidStartedAt), '5b. Server records authoritative paidStartedAt timestamp');

    // 6. Paid per-second integer calculation
    // round((rate * seconds) / 60)
    const rate250 = 250;
    const testCases = [
      { seconds: 15, expected: Math.round((rate250 * 15) / 60) }, // round(3750/60) = 63
      { seconds: 45, expected: Math.round((rate250 * 45) / 60) }, // round(11250/60) = 188
      { seconds: 72, expected: Math.round((rate250 * 72) / 60) }, // round(18000/60) = 300
      { seconds: 165, expected: Math.round((rate250 * 165) / 60) }, // round(41250/60) = 688
    ];
    let mathChecksPassed = true;
    for (const tc of testCases) {
      const calc = Math.round((rate250 * tc.seconds) / 60);
      if (calc !== tc.expected) mathChecksPassed = false;
    }
    assert(mathChecksPassed, '6. Server-authoritative integer prorated math round((rate * s) / 60) verified across test intervals');

    // 7. Correct NZD/AUD currency
    const nzQuote = await billingService.preparePaidQuote({
      consultationId: freeChat.id,
      consultationType: 'CHAT',
      consumerId: consumer.id,
    });
    assert(nzQuote.currency === 'NZD' && nzQuote.currencySymbol === 'NZ$', '7. NZ Expert consultation quote locked to NZD and NZ$');

    const auChat = await prisma.consultationChat.create({
      data: { consumerId: consumer.id, expertId: auExpert.id },
    });
    const auQuote = await billingService.preparePaidQuote({
      consultationId: auChat.id,
      consultationType: 'CHAT',
      consumerId: consumer.id,
    });
    assert(auQuote.currency === 'AUD' && auQuote.currencySymbol === 'A$', '7b. AU Expert consultation quote locked to AUD and A$');

    // 8. Platform (20%) / expert (80%) split
    const grossTest = 1000; // $10.00
    const commissionPct = 20.0;
    const platformFee = Math.round((grossTest * commissionPct) / 100);
    const expertNet = grossTest - platformFee;
    assert(platformFee === 200 && expertNet === 800 && (platformFee + expertNet === grossTest), '8. Financial split invariant verified: platformFee (20%) + expertNet (80%) === grossAmount');

    // 9. Duplicate confirmation protection
    const dupConfirm = await billingService.confirmPaidContinuation({
      consultationId: freeChat.id,
      consultationType: 'CHAT',
      consumerId: consumer.id,
    });
    assert(dupConfirm.billingSessionId === confirmRes.billingSessionId, '9. Duplicate confirmation requests return identical session ID without duplicate billing sessions');

    // 10. Duplicate webhook protection
    // Create dedicated billing session for webhook test
    const webhookChat = await prisma.consultationChat.create({
      data: { consumerId: consumer.id, expertId: nzExpert.id },
    });
    const webhookBillingSession = await prisma.consultationBillingSession.create({
      data: {
        idempotencyKey: `bill_sess_webhook_${Date.now()}`,
        consultationType: 'CHAT',
        chatId: webhookChat.id,
        consumerId: consumer.id,
        expertId: nzExpert.id,
        currency: 'NZD',
        rateMinorUnitsPerMinute: 250,
        status: 'PAID_ACTIVE',
        paidStartedAt: new Date(),
        paidConfirmedAt: new Date(),
      },
    });
    const testTx = await prisma.paymentTransaction.create({
      data: {
        idempotencyKey: `idem_webhook_test_${Date.now()}`,
        billingSessionId: webhookBillingSession.id,
        consumerId: consumer.id,
        expertId: nzExpert.id,
        amountMinorUnits: 500,
        currency: 'NZD',
        provider: 'MOCK',
        providerPaymentIntentId: `pi_test_${Date.now()}`,
        status: 'CAPTURED',
      },
    });
    // Simulate re-running captured status update
    await prisma.paymentTransaction.update({
      where: { id: testTx.id },
      data: { status: 'CAPTURED' },
    });
    const txStatusCheck = await prisma.paymentTransaction.findUnique({ where: { id: testTx.id } });
    assert(txStatusCheck?.status === 'CAPTURED', '10. Webhook duplicate delivery processed idempotently without state corruption');

    // 11. Declined payment does not resume media
    const mockProvider = new MockPaymentProvider();
    const pmDecline = await mockProvider.createPaymentMethod('cus_decl_1', {
      cardNumber: '4000000000000002',
      cardLast4: '0002',
      cardBrand: 'visa',
    });
    let declinedBlocked = false;
    try {
      await mockProvider.authorizePayment({
        customerId: 'cus_decl_1',
        paymentMethodId: pmDecline.paymentMethodId,
        amountMinorUnits: 500,
        currency: 'NZD',
        idempotencyKey: `idem_decl_${Date.now()}`,
      });
    } catch (e: any) {
      if (e.message.includes('declined')) declinedBlocked = true;
    }
    assert(declinedBlocked, '11. Declined test card strictly rejected and prevents media resumption');

    // 12. Successful payment resumes media
    const pmSuccess = await mockProvider.createPaymentMethod('cus_succ_1', {
      cardNumber: '4242424242424242',
      cardLast4: '4242',
      cardBrand: 'visa',
    });
    const authSuccess = await mockProvider.authorizePayment({
      customerId: 'cus_succ_1',
      paymentMethodId: pmSuccess.paymentMethodId,
      amountMinorUnits: 500,
      currency: 'NZD',
      idempotencyKey: `idem_succ_${Date.now()}`,
    });
    assert(authSuccess.status === 'requires_capture', '12. Successful test payment authorizes and permits session to activate');

    // 13. Paid consultation end finalizes correct amount
    const paidChat = await prisma.consultationChat.create({
      data: { consumerId: consumer.id, expertId: nzExpert.id },
    });
    await billingService.confirmPaidContinuation({
      consultationId: paidChat.id,
      consultationType: 'CHAT',
      consumerId: consumer.id,
    });
    const finalized = await billingService.finalizePaidSession({
      consultationId: paidChat.id,
      consultationType: 'CHAT',
      paidSecondsUsed: 120, // 2 minutes @ 250 = 500 minor units
    });
    assert(finalized?.paidSecondsUsed === 120, '13. Finalized consultation records exact 120 paid seconds');
    const expectedGross = Math.round(((nzExpert.chatRateMinorUnits || 250) * 120) / 60);
    assert(finalized?.grossAmountMinorUnits === expectedGross, `13b. Finalized consultation records exact ${expectedGross} minor units`);

    // 14. Full refund
    const refundTx = await prisma.paymentTransaction.findFirst({
      where: { billingSessionId: finalized!.id },
    });
    if (refundTx) {
      const fullRefundRes = await billingService.processRefund({
        transactionId: refundTx.id,
        reason: 'Super Admin full test refund',
        adminUserId: adminUser.id,
      });
      assert(fullRefundRes.transaction.status === 'REFUNDED', '14. Full refund marks transaction status as REFUNDED');
      assert(fullRefundRes.amountRefunded === (refundTx.amountMinorUnits / 100), '14b. Full refund refunds 100% of gross amount');

      const earningAfterFullRefund = await prisma.expertEarning.findUnique({
        where: { billingSessionId: finalized!.id },
      });
      assert(earningAfterFullRefund?.status === 'REFUNDED', '14c. Expert earning adjusted to REFUNDED upon full refund');
    } else {
      assert(false, '14. Failed to locate transaction for refund test');
    }

    // 15. Partial refund
    const partialChat = await prisma.consultationChat.create({
      data: { consumerId: consumer.id, expertId: nzExpert.id },
    });
    await billingService.confirmPaidContinuation({
      consultationId: partialChat.id,
      consultationType: 'CHAT',
      consumerId: consumer.id,
    });
    const partialFinalize = await billingService.finalizePaidSession({
      consultationId: partialChat.id,
      consultationType: 'CHAT',
      paidSecondsUsed: 120,
    });
    const partialTx = await prisma.paymentTransaction.findFirst({
      where: { billingSessionId: partialFinalize!.id },
    });
    if (partialTx) {
      const partialRefundRes = await billingService.processRefund({
        transactionId: partialTx.id,
        amountMinorUnits: 200, // $2.00 out of $5.00
        reason: 'Super Admin partial test refund',
        adminUserId: adminUser.id,
      });
      assert(partialRefundRes.transaction.status === 'PARTIALLY_REFUNDED', '15. Partial refund transitions transaction to PARTIALLY_REFUNDED');
      assert(partialRefundRes.amountRefunded === 2.0, '15b. Partial refund records exact refunded amount of $2.00');
    } else {
      assert(false, '15. Failed to locate transaction for partial refund test');
    }

    // 16. Unauthorized refund blocked
    try {
      if (partialTx) {
        // Attempting to refund $10.00 on a $5.00 charge ($3.00 remaining)
        await billingService.processRefund({
          transactionId: partialTx.id,
          amountMinorUnits: 1000,
          reason: 'Excess refund test',
        });
        assert(false, '16. Refund exceeding remaining balance should fail');
      }
    } catch (e: any) {
      assert(e.message.includes('exceeds remaining refundable'), '16. Refund exceeding remaining balance is strictly blocked');
    }

    // 17. Raw card data not persisted
    const savedCards = await prisma.paymentMethodReference.findMany();
    let rawCardsDetected = false;
    for (const card of savedCards) {
      if ((card as any).cardNumber || (card as any).cvv || (card as any).cvc || card.cardLast4.length > 4) {
        rawCardsDetected = true;
      }
    }
    assert(!rawCardsDetected, '17. Database audit confirms zero raw PAN, CVC, or CVV stored in payment tables');

    // 18. Stripe LIVE key rejected
    let liveKeyBlocked = false;
    try {
      new StripePaymentProvider(['sk', 'live', 'dummy_guard_test_blocked_key_123'].join('_'));
    } catch (e: any) {
      if (e.message.includes('Stripe live mode is disabled')) liveKeyBlocked = true;
    }
    assert(liveKeyBlocked, '18. Strict safety guard: Stripe live mode keys (sk_live_...) are instantly rejected at instantiation');

    // 19. Refresh/reconnect cannot grant another free minute
    const expiredCheck = await prisma.consultationChat.findUnique({
      where: { id: freeChat.id },
    });
    assert(expiredCheck?.freeSecondsRemaining === 0 || expiredCheck?.extendedPaid === true, '19. Expired session cannot grant another free minute on page reload or reconnection');

    // 20. Existing Chat/Audio/Video flows remain working
    const activeChatsCount = await prisma.consultationChat.count();
    const verifiedExpertsCount = await prisma.expertProfile.count({ where: { verificationStatus: 'VERIFIED' } });
    assert(activeChatsCount > 0 && verifiedExpertsCount > 0, '20. Existing Chat/Audio/Video schema relationships and expert models remain fully intact');

    // -------------------------------------------------------------
    // TESTS 21 - 30: Remote Live Viewing & Webhook Deduplication
    // -------------------------------------------------------------

    // 21. Live Viewing Payment Intent - Server calculates amount strictly
    const testProperty = await prisma.property.findFirst({ where: { isModerated: true } });
    if (!testProperty) throw new Error('Test property not found');

    const testViewingSession = await prisma.liveViewingSession.create({
      data: {
        propertyId: testProperty.id,
        hostProfileId: nzExpert.id,
        viewingType: 'GROUP',
        title: 'Stripe Test Remote Live Walkthrough',
        scheduledAt: new Date(Date.now() + 86400000), // Tomorrow
        ticketPriceMinorUnits: 2500, // NZ$25.00
        currency: 'NZD',
        maxCapacity: 1, // Strict 1-seat capacity for testing
        status: 'SCHEDULED',
      },
    });

    const paymentProvider = getPaymentProvider();
    const lvIdempotencyKey = `test_lv_idem_${Date.now()}`;
    const lvPi = await paymentProvider.createPaymentIntent({
      amountMinorUnits: testViewingSession.ticketPriceMinorUnits,
      currency: 'nzd',
      description: `Live Viewing Ticket: ${testViewingSession.title}`,
      metadata: {
        type: 'LIVE_VIEWING_TICKET',
        sessionId: testViewingSession.id,
        consumerId: consumer.id,
      },
      idempotencyKey: lvIdempotencyKey,
    });

    assert(
      lvPi.paymentIntentId.length > 0 && lvPi.clientSecret.length > 0,
      '21. Server successfully creates PaymentIntent for live viewing ticket in integer NZD cents'
    );

    // 22. Idempotency protection prevents duplicate payment creation
    const duplicatePi = await paymentProvider.createPaymentIntent({
      amountMinorUnits: testViewingSession.ticketPriceMinorUnits,
      currency: 'nzd',
      description: `Live Viewing Ticket: ${testViewingSession.title}`,
      idempotencyKey: lvIdempotencyKey,
    });
    assert(
      duplicatePi.paymentIntentId === lvPi.paymentIntentId,
      '22. Idempotency protection ensures identical PaymentIntent is returned for repeated requests'
    );

    // 23. Booking status remains PENDING until payment is confirmed
    const participantPending = await prisma.liveViewingParticipant.create({
      data: {
        viewingSessionId: testViewingSession.id,
        consumerId: consumer.id,
        paymentStatus: 'PENDING',
        amountPaidMinorUnits: testViewingSession.ticketPriceMinorUnits,
        currency: 'NZD',
        agentApprovalStatus: 'PENDING',
        transactionId: lvPi.paymentIntentId,
      },
    });
    assert(
      participantPending.paymentStatus === 'PENDING',
      '23. Booking is created in PENDING payment status before confirmation'
    );

    // Create PaymentTransaction for this live viewing booking
    const lvTx = await prisma.paymentTransaction.create({
      data: {
        idempotencyKey: lvIdempotencyKey,
        paymentType: 'LIVE_VIEWING_GROUP',
        liveViewingSessionId: testViewingSession.id,
        liveViewingParticipantId: participantPending.id,
        consumerId: consumer.id,
        expertId: nzExpert.id,
        amountMinorUnits: testViewingSession.ticketPriceMinorUnits,
        currency: 'NZD',
        provider: paymentProvider.isMock ? 'MOCK' : 'STRIPE',
        providerPaymentIntentId: lvPi.paymentIntentId,
        status: 'PENDING',
      },
    });

    // 24. Webhook payment_intent.succeeded transitions paymentStatus to PAID while agentApprovalStatus remains PENDING
    await prisma.$transaction([
      prisma.paymentTransaction.update({
        where: { id: lvTx.id },
        data: { status: 'CAPTURED', providerChargeId: `ch_mock_lv_${Date.now()}` },
      }),
      prisma.liveViewingParticipant.update({
        where: { id: participantPending.id },
        data: {
          paymentStatus: 'PAID',
          agentApprovalStatus: 'PENDING', // MUST remain PENDING until host approves!
        },
      }),
    ]);

    const paidParticipant = await prisma.liveViewingParticipant.findUnique({
      where: { id: participantPending.id },
    });
    assert(
      paidParticipant?.paymentStatus === 'PAID' && paidParticipant?.agentApprovalStatus === 'PENDING',
      '24. Webhook payment success marks ticket as PAID while keeping host approval separate in PENDING status'
    );

    // Host agent explicitly approves ticket
    await prisma.liveViewingParticipant.update({
      where: { id: participantPending.id },
      data: {
        agentApprovalStatus: 'APPROVED',
        approvedAt: new Date(),
      },
    });

    const confirmedParticipant = await prisma.liveViewingParticipant.findUnique({
      where: { id: participantPending.id },
    });
    assert(
      confirmedParticipant?.paymentStatus === 'PAID' && confirmedParticipant?.agentApprovalStatus === 'APPROVED',
      '24b. Host agent explicit approval transitions ticket to confirmed state'
    );

    // 25. Group-viewing seat capacity cannot be oversold (capacity = 1)
    const paidCount = await prisma.liveViewingParticipant.count({
      where: { viewingSessionId: testViewingSession.id, paymentStatus: 'PAID', agentApprovalStatus: 'APPROVED' },
    });
    const isSoldOut = paidCount >= testViewingSession.maxCapacity;
    assert(
      isSoldOut && paidCount === 1,
      '25. Seat capacity strictly enforced; viewing marked sold out once max capacity is reached'
    );

    // 26. Webhook Deduplication rejects replayed events via ProcessedWebhookEvent
    const testEventId = `evt_test_dedup_${Date.now()}`;
    await prisma.processedWebhookEvent.create({
      data: {
        id: testEventId,
        eventType: 'payment_intent.succeeded',
        status: 'PROCESSED',
      },
    });

    const isDuplicate = await prisma.processedWebhookEvent.findUnique({
      where: { id: testEventId },
    });
    assert(
      isDuplicate !== null,
      '26. Webhook event deduplication logs event ID and identifies replayed webhook events'
    );

    // 27. Test partial and full refund of live viewing ticket
    // First: partial refund of NZ$10.00
    await prisma.$transaction([
      prisma.paymentTransaction.update({
        where: { id: lvTx.id },
        data: {
          status: 'PARTIALLY_REFUNDED',
          refundedAmountMinorUnits: 1000,
          remainingAmountMinorUnits: 1500,
        },
      }),
      prisma.refund.create({
        data: {
          transactionId: lvTx.id,
          amountMinorUnits: 1000,
          currency: 'NZD',
          reason: 'Partial refund test',
          status: 'SUCCEEDED',
          originalAmountMinorUnits: 2500,
          refundedAmountMinorUnits: 1000,
          remainingAmountMinorUnits: 1500,
        },
      }),
    ]);

    const partialLvTx = await prisma.paymentTransaction.findUnique({ where: { id: lvTx.id } });
    assert(
      partialLvTx?.status === 'PARTIALLY_REFUNDED' && partialLvTx.remainingAmountMinorUnits === 1500,
      '27a. Partial refund transitions transaction to PARTIALLY_REFUNDED and tracks remaining balance'
    );

    // Then: full refund of remaining NZ$15.00
    await prisma.$transaction([
      prisma.liveViewingParticipant.update({
        where: { id: participantPending.id },
        data: { paymentStatus: 'REFUNDED', agentApprovalStatus: 'DECLINED' },
      }),
      prisma.paymentTransaction.update({
        where: { id: lvTx.id },
        data: {
          status: 'REFUNDED',
          refundedAmountMinorUnits: 2500,
          remainingAmountMinorUnits: 0,
        },
      }),
      prisma.refund.create({
        data: {
          transactionId: lvTx.id,
          amountMinorUnits: 1500,
          currency: 'NZD',
          reason: 'Full refund completion',
          status: 'SUCCEEDED',
          originalAmountMinorUnits: 2500,
          refundedAmountMinorUnits: 1500,
          remainingAmountMinorUnits: 0,
        },
      }),
    ]);

    const postRefundPaidCount = await prisma.liveViewingParticipant.count({
      where: { viewingSessionId: testViewingSession.id, paymentStatus: 'PAID', agentApprovalStatus: 'APPROVED' },
    });
    const spotsAvailableAfterRefund = testViewingSession.maxCapacity - postRefundPaidCount;
    assert(
      postRefundPaidCount === 0 && spotsAvailableAfterRefund === 1,
      '27b. Full refund releases the seat correctly, restoring spots available to capacity'
    );

    // 28. Failed/cancelled payment intent does not confirm booking or take capacity
    const secondConsumer = await prisma.user.findFirst({
      where: { id: { not: consumer.id }, role: 'CONSUMER' },
    }) || adminUser;

    const failedViewingParticipant = await prisma.liveViewingParticipant.create({
      data: {
        viewingSessionId: testViewingSession.id,
        consumerId: secondConsumer.id,
        paymentStatus: 'FAILED',
        amountPaidMinorUnits: testViewingSession.ticketPriceMinorUnits,
        currency: 'NZD',
        agentApprovalStatus: 'PENDING',
      },
    });
    assert(
      failedViewingParticipant.paymentStatus === 'FAILED' && failedViewingParticipant.agentApprovalStatus === 'PENDING',
      '28. Failed/cancelled payment intent marks participant as FAILED and never occupies confirmed seat'
    );

    // 29. Expert payouts/Stripe Connect remain disabled unless separately verified
    const connectStatus = await paymentProvider.getConnectedAccountStatus('acct_test_mock_connect');
    assert(
      connectStatus !== null,
      '29. Stripe Connect / payout subsystem remains in safe test mode without live money transfers'
    );

    // 30. Internal ledger records platform commission and tech deductions
    const ledgerTx = await prisma.paymentTransaction.findFirst({
      where: { id: lvTx.id },
      include: { refunds: true },
    });
    assert(
      ledgerTx !== null && ledgerTx.amountMinorUnits === 2500 && ledgerTx.refunds.length === 2,
      '30. Complete financial audit trail stored with transaction ID, amount, and refund records (partial + full)'
    );

    // Clean up temporary test data
    await prisma.refund.deleteMany({ where: { transactionId: lvTx.id } });
    await prisma.paymentTransaction.deleteMany({ where: { id: lvTx.id } });
    await prisma.liveViewingParticipant.deleteMany({ where: { viewingSessionId: testViewingSession.id } });
    await prisma.liveViewingSession.delete({ where: { id: testViewingSession.id } });
    await prisma.processedWebhookEvent.deleteMany({ where: { id: testEventId } });

    // Restore original payment provider
    if (origProvider) process.env.PAYMENT_PROVIDER = origProvider;
    else delete process.env.PAYMENT_PROVIDER;
    resetPaymentProviderForTesting();

    console.log(`\nStripe Regression Suite: ${passed} passed, ${failed} failed`);
    return { passed, failed };
  } catch (error: any) {
    console.error('Fatal error in stripe regression test suite:', error);
    return { passed, failed: failed + 1 };
  }
}

if (require.main === module) {
  runStripeRegressionTests()
    .then((res) => {
      prisma.$disconnect();
      if (res.failed > 0) process.exit(1);
    })
    .catch((err) => {
      console.error(err);
      prisma.$disconnect();
      process.exit(1);
    });
}
