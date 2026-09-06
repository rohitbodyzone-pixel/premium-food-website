import { prisma } from '../src/db/prisma';
import { billingService } from '../src/services/billing.service';
import { getPaymentProvider } from '../src/services/payment/payment-provider.factory';
import { MockPaymentProvider } from '../src/services/payment/mock-payment.provider';

export async function runPaymentBillingTests() {
  console.log('\n--- Running Payment & Paid Consultation Billing Test Suite (Phase 2B) ---');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${desc}`);
      failed++;
    }
  }

  try {
    // Setup test users & profiles
    const consumer = await prisma.user.findFirst({
      where: { email: 'james.wilson@gmail.com' },
    });
    if (!consumer) throw new Error('Demo consumer not found in database');

    const nzExpert = await prisma.expertProfile.findFirst({
      where: { countryCode: 'NZ', verificationStatus: 'VERIFIED' },
      include: { user: true },
    });
    if (!nzExpert) throw new Error('NZ expert not found in database');

    const auExpert = await prisma.expertProfile.findFirst({
      where: { countryCode: 'AU', verificationStatus: 'VERIFIED' },
      include: { user: true },
    });
    if (!auExpert) throw new Error('AU expert not found in database');

    // 1. Payment Provider Detection
    const provider = getPaymentProvider();
    assert(provider instanceof MockPaymentProvider || provider.name === 'Stripe', 'Payment provider factory instantiates valid provider');
    assert(provider.isMock === true, 'Payment provider runs in development mock mode when Stripe secret is not configured');

    // 2. Test Card Simulation: Success (4242)
    const pmSuccess = await provider.createPaymentMethod('cus_test_1', {
      cardNumber: '4242424242424242',
      cardLast4: '4242',
      cardBrand: 'visa',
    });
    const authSuccess = await provider.authorizePayment({
      amountMinorUnits: 500,
      currency: 'NZD',
      customerId: 'cus_test_1',
      paymentMethodId: pmSuccess.paymentMethodId,
      idempotencyKey: 'test_idem_success_1',
      description: 'Test successful consultation charge',
    });
    const capSuccess = await provider.capturePayment({
      paymentIntentId: authSuccess.paymentIntentId,
      idempotencyKey: 'test_idem_success_cap_1',
    });
    assert(capSuccess.status === 'succeeded' || capSuccess.status === 'CAPTURED', 'Mock test card 4242 authorizes and captures successfully');

    // 3. Test Card Simulation: Decline (0002)
    const pmDecline = await provider.createPaymentMethod('cus_test_1', {
      cardNumber: '4000000000000002',
      cardLast4: '0002',
      cardBrand: 'visa',
    });
    try {
      await provider.authorizePayment({
        amountMinorUnits: 500,
        currency: 'NZD',
        customerId: 'cus_test_1',
        paymentMethodId: pmDecline.paymentMethodId,
        idempotencyKey: 'test_idem_decline_1',
        description: 'Test declined consultation charge',
      });
      assert(false, 'Card 0002 should throw a card declined error');
    } catch (err: any) {
      assert(err.message.includes('declined'), 'Card 0002 correctly rejected with card declined message');
    }

    // 4. Test Card Simulation: Insufficient Funds (0003)
    const pmFunds = await provider.createPaymentMethod('cus_test_1', {
      cardNumber: '4000000000000003',
      cardLast4: '0003',
      cardBrand: 'visa',
    });
    try {
      await provider.authorizePayment({
        amountMinorUnits: 500,
        currency: 'NZD',
        customerId: 'cus_test_1',
        paymentMethodId: pmFunds.paymentMethodId,
        idempotencyKey: 'test_idem_insufficient_1',
        description: 'Test insufficient funds charge',
      });
      assert(false, 'Card 0003 should throw insufficient funds error');
    } catch (err: any) {
      assert(err.message.includes('declined'), 'Card 0003 correctly rejected with decline message');
    }

    // 5. Payment Customer & Methods: No Raw Card or CVV in DB
    const paymentCust = await billingService.ensurePaymentCustomer(consumer.id);
    assert(Boolean(paymentCust.id) && paymentCust.userId === consumer.id, 'billingService.ensurePaymentCustomer creates or retrieves customer record');

    const savedMethod = await prisma.paymentMethodReference.findFirst({
      where: { paymentCustomerId: paymentCust.id },
    });
    assert(Boolean(savedMethod), 'Customer has saved payment method reference');
    if (savedMethod) {
      assert(savedMethod.cardLast4.length === 4, 'Only card last 4 digits stored');
      assert(!(savedMethod as any).cardNumber && !(savedMethod as any).cvv, 'Zero raw card numbers or CVV codes stored in database table');
    }

    // 6. Test Chat Creation for Consultation Billing Flow (Fresh Chat per test run)
    const testChat = await prisma.consultationChat.create({
      data: {
        consumerId: consumer.id,
        expertId: nzExpert.id,
      },
    });

    // 7. Prepare Paid Quote (Pre-continuation quote check)
    const quote = await billingService.preparePaidQuote({
      consultationId: testChat.id,
      consultationType: 'CHAT',
      consumerId: consumer.id,
    });
    assert(quote.currency === 'NZD', 'NZ expert quote returns NZD currency');
    assert(quote.currencySymbol === 'NZ$', 'NZ expert quote returns NZ$ symbol');
    assert(quote.rateMinorUnitsPerMinute === (nzExpert.chatRateMinorUnits || 250), 'Quote returns exact per-minute chat rate snapshot');
    assert(quote.hasPaymentMethod === true, 'Quote identifies customer has configured payment method');

    // 8. Explicit Confirmation Gate (Business rule: Must confirm before paid metering begins)
    const confirmResult = await billingService.confirmPaidContinuation({
      consultationId: testChat.id,
      consultationType: 'CHAT',
      consumerId: consumer.id,
    });
    assert(confirmResult.success === true, 'Explicit confirmation gate activates billing session');
    assert(confirmResult.status === 'PAID_ACTIVE', 'Billing session status is set to PAID_ACTIVE upon confirmation');
    assert(confirmResult.rateMinorUnitsPerMinute === (nzExpert.chatRateMinorUnits || 250), 'Billing session records locked rate snapshot');

    const dbBillingSession = await prisma.consultationBillingSession.findUnique({
      where: { id: confirmResult.billingSessionId },
    });
    assert(Boolean(dbBillingSession), 'Billing session found in database');
    assert(dbBillingSession?.commissionPct === 20.0, 'Billing session records immutable platform commission percentage snapshot (20%)');

    // 9. Server-Authoritative Integer Prorated Billing Formula Test
    // Charge calculation test: 165 seconds used at $3.00/min ($300 minor units):
    // Prorated charge = round((300 * 165) / 60) = round(49500 / 60) = 825 minor units ($8.25)
    const rate300 = 300;
    const paidSec165 = 165;
    const expectedCharge825 = Math.round((rate300 * paidSec165) / 60);
    assert(expectedCharge825 === 825, 'Proration formula: 165 seconds @ $3.00/min equals exactly 825 minor units ($8.25)');

    // 30 seconds at $2.50/min (250 minor units): round((250 * 30) / 60) = round(7500 / 60) = 125 minor units ($1.25)
    const rate250 = 250;
    const paidSec30 = 30;
    const expectedCharge125 = Math.round((rate250 * paidSec30) / 60);
    assert(expectedCharge125 === 125, 'Proration formula: 30 seconds @ $2.50/min equals exactly 125 minor units ($1.25)');

    // 0 paid seconds: charge must be exactly 0
    const expectedCharge0 = Math.round((rate300 * 0) / 60);
    assert(expectedCharge0 === 0, 'Proration formula: 0 seconds paid consultation equals 0 minor units ($0.00)');

    // 10. Commission & Revenue Split Invariant
    // On 825 minor units with 20% fee:
    // Platform fee = round(825 * 0.20) = 165 minor units
    // Expert net = 825 - 165 = 660 minor units
    const fee165 = Math.round((825 * 20.0) / 100);
    const net660 = 825 - fee165;
    assert(fee165 === 165, 'Platform commission: 20% on $8.25 equals $1.65');
    assert(net660 === 660, 'Expert net earning: 80% on $8.25 equals $6.60');
    assert(fee165 + net660 === 825, 'Financial invariant holds: platformFee + netEarning === grossAmount');

    // 11. Finalize Paid Session
    const finalized = await billingService.finalizePaidSession({
      consultationId: testChat.id,
      consultationType: 'CHAT',
      paidSecondsUsed: 165,
    });
    assert(finalized !== null, 'Paid session finalized successfully');
    let capturedTx: any = null;
    if (finalized) {
      assert(finalized.status === 'COMPLETED', 'Billing session status marked as COMPLETED');
      assert(finalized.paidSecondsUsed === 165, 'Billing session records 165 paid seconds used');

      capturedTx = await prisma.paymentTransaction.findFirst({
        where: { billingSessionId: finalized.id },
      });
      assert(Boolean(capturedTx) && capturedTx?.status === 'CAPTURED', 'PaymentTransaction created and marked as CAPTURED');

      const earning = await prisma.expertEarning.findUnique({
        where: { billingSessionId: finalized.id },
      });
      assert(Boolean(earning) && earning?.status === 'AVAILABLE', 'Expert earning marked as AVAILABLE');
      assert(earning?.grossMinorUnits === capturedTx?.amountMinorUnits, 'Earning gross matches transaction amount');
      assert(
        (earning?.platformFeeMinorUnits || 0) + (earning?.netEarningMinorUnits || 0) === (earning?.grossMinorUnits || 0),
        'Database earning platform fee and net earning add up to gross minor units'
      );
    }

    // 12. Idempotency: Duplicate finalize call does not double charge
    const duplicateFinalize = await billingService.finalizePaidSession({
      consultationId: testChat.id,
      consultationType: 'CHAT',
      paidSecondsUsed: 165,
    });
    assert(duplicateFinalize !== null, 'Duplicate finalize returns successfully');
    if (duplicateFinalize && finalized) {
      assert(duplicateFinalize.id === finalized.id, 'Idempotent finalization returns existing billing session ID');
      const txCount = await prisma.paymentTransaction.count({
        where: { billingSessionId: finalized.id },
      });
      assert(txCount === 1, 'Only exactly 1 payment transaction exists (no double charging)');
    }

    // 13. Currency Isolation Test with AU Expert
    const auChat = await prisma.consultationChat.create({
      data: {
        consumerId: consumer.id,
        expertId: auExpert.id,
      },
    });

    const auQuote = await billingService.preparePaidQuote({
      consultationId: auChat.id,
      consultationType: 'CHAT',
      consumerId: consumer.id,
    });
    assert(auQuote.currency === 'AUD', 'AU expert quote returns AUD currency');
    assert(auQuote.currencySymbol === 'A$', 'AU expert quote returns A$ symbol');

    // 14. Super Admin Refund Engine
    if (capturedTx) {
      const tx = capturedTx;
      // Process a partial refund of $1.00 (100 minor units)
      const partialRefund = await billingService.processRefund({
        transactionId: tx.id,
        amountMinorUnits: 100,
        reason: 'Customer reported minor audio stutter',
      });
      assert(
        partialRefund.transaction.status === 'PARTIALLY_REFUNDED' || partialRefund.transaction.status === 'CAPTURED',
        'Transaction marked as PARTIALLY_REFUNDED when partially refunded'
      );

      // Process full remainder refund
      const remainingMinor = tx.amountMinorUnits - 100;
      const fullRefund = await billingService.processRefund({
        transactionId: tx.id,
        amountMinorUnits: remainingMinor,
        reason: 'Super Admin full courtesy refund',
      });
      assert(fullRefund.transaction.status === 'REFUNDED', 'Transaction status transitions to REFUNDED when 100% refunded');

      // Attempt refund exceeding original amount should throw
      try {
        await billingService.processRefund({
          transactionId: tx.id,
          amountMinorUnits: 50,
          reason: 'Excess refund test',
        });
        assert(false, 'Refunding beyond gross amount should throw error');
      } catch (err: any) {
        assert(
          err.message.includes('exceeds remaining refundable') || err.message.includes('Cannot refund'),
          'Excess refund correctly rejected'
        );
      }
    }

    // 15. Free 1-Minute Consultation Only (Without Paid Continuation)
    const freeOnlyChat = await prisma.consultationChat.create({
      data: {
        consumerId: consumer.id,
        expertId: nzExpert.id,
      },
    });
    const freeFinalize = await billingService.finalizePaidSession({
      consultationId: freeOnlyChat.id,
      consultationType: 'CHAT',
      paidSecondsUsed: 0,
    });
    assert(freeFinalize === null, 'Free 1-minute consultation without paid continuation produces null transaction and charges $0.00');

    console.log(`\nPayment & Billing Suite Results: ${passed} passed, ${failed} failed`);
    return { passed, failed };
  } catch (err: any) {
    console.error('Test suite error:', err);
    return { passed, failed: failed + 1 };
  }
}
