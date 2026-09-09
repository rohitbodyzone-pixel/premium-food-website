/**
 * PropertyTalk - Stripe TEST Mode Live Verification Runner
 *
 * Verifies real Stripe TEST mode API calls:
 * 1. Customer creation
 * 2. Test payment method attachment (pm_card_visa)
 * 3. Two-step consultation authorization (capture_method: 'manual')
 * 4. Prorated per-second capture
 * 5. Test refund execution
 * 6. Webhook HMAC signature verification
 *
 * SAFETY GUARDS:
 * - Rejects any key starting with 'sk_live_'
 * - Requires 'sk_test_'
 * - No sensitive PAN or CVC stored
 */

import dotenv from 'dotenv';
import path from 'path';

// Load server/.env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import Stripe from 'stripe';
import { StripePaymentProvider } from '../src/services/payment/stripe-payment.provider';

async function runStripeTestModeVerification() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  console.log('====================================================');
  console.log('  PropertyTalk — Stripe TEST Mode Live Verification');
  console.log('====================================================\n');

  if (!secretKey) {
    console.log('⚠️  STRIPE_SECRET_KEY is not set in server/.env.');
    console.log('   Please add the following to server/.env:\n');
    console.log('   PAYMENT_PROVIDER=stripe');
    console.log('   STRIPE_SECRET_KEY=sk_test_51...');
    console.log('   STRIPE_PUBLISHABLE_KEY=pk_test_51...');
    console.log('   STRIPE_WEBHOOK_SECRET=whsec_...\n');
    console.log('   Then run: npx ts-node test/verify-stripe-testmode.ts\n');
    return { success: false, reason: 'KEYS_NOT_CONFIGURED' };
  }

  if (secretKey.startsWith('sk_live_')) {
    console.error('🛑 CRITICAL SAFETY HALT: sk_live_ key detected! Aborting immediately.');
    process.exit(1);
  }

  if (!secretKey.startsWith('sk_test_')) {
    console.error('🛑 ERROR: STRIPE_SECRET_KEY must start with "sk_test_". Aborting.');
    process.exit(1);
  }

  console.log('✓ Safety check passed: Using Stripe TEST mode key (sk_test_...)');
  if (publishableKey) {
    console.log(`✓ Publishable key configured: ${publishableKey.substring(0, 12)}...`);
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' as any });
  const provider = new StripePaymentProvider(secretKey);

  console.log('\n--- Step 1: Create Stripe Customer ---');
  const testEmail = `test-consumer-${Date.now()}@propertytalk-test.com`;
  const customer = await provider.createCustomer({
    userId: `usr_test_${Date.now()}`,
    email: testEmail,
    name: 'Test Consumer (Stripe Verification)',
  });
  console.log(`✓ Customer created in Stripe Test Mode: ${customer.customerId} (${testEmail})`);

  console.log('\n--- Step 2: Create & Attach Test Payment Method ---');
  const paymentMethod = await provider.createPaymentMethod(customer.customerId, {
    token: 'tok_visa',
  });
  console.log(`✓ Attached test card: ${paymentMethod.paymentMethodId} (Brand: ${paymentMethod.brand}, Last4: ${paymentMethod.last4})`);

  console.log('\n--- Step 3: Authorize Consultation (capture_method: manual) ---');
  const authAmountMinor = 1000; // $10.00 NZD pre-auth hold
  const idempotencyKeyAuth = `pt-test-auth-${Date.now()}`;
  const authResult = await provider.authorizePayment({
    customerId: customer.customerId,
    paymentMethodId: paymentMethod.paymentMethodId,
    amountMinorUnits: authAmountMinor,
    currency: 'NZD',
    idempotencyKey: idempotencyKeyAuth,
    description: 'PropertyTalk Consultation Pre-Authorization (Test)',
    metadata: {
      billingSessionId: `sess-test-${Date.now()}`,
      consultationType: 'VIDEO',
      rateMinorUnitsPerMinute: '150',
    },
  });
  console.log(`✓ Pre-authorization successful!`);
  console.log(`  PaymentIntent ID: ${authResult.paymentIntentId}`);
  console.log(`  Status: ${authResult.status} (expected: requires_capture)`);

  if (authResult.status !== 'requires_capture') {
    throw new Error(`Expected status 'requires_capture', got '${authResult.status}'`);
  }

  console.log('\n--- Step 4: Prorated Capture for Actual Consultation Duration ---');
  // Simulate 120 seconds of paid consultation at $1.50/min ($0.025/sec) = $3.00 = 300 cents NZD
  const actualConsultationCharge = 300; // $3.00 NZD
  const idempotencyKeyCapture = `pt-test-cap-${Date.now()}`;
  const captureResult = await provider.capturePayment({
    paymentIntentId: authResult.paymentIntentId,
    amountMinorUnits: actualConsultationCharge,
    idempotencyKey: idempotencyKeyCapture,
  });
  console.log(`✓ Prorated capture successful!`);
  console.log(`  PaymentIntent ID: ${captureResult.paymentIntentId}`);
  console.log(`  Charge ID: ${captureResult.chargeId}`);
  console.log(`  Status: ${captureResult.status} (expected: succeeded)`);
  console.log(`  Amount captured: $${(actualConsultationCharge / 100).toFixed(2)} NZD of $${(authAmountMinor / 100).toFixed(2)} pre-authorized`);

  if (captureResult.status !== 'succeeded') {
    throw new Error(`Expected status 'succeeded', got '${captureResult.status}'`);
  }

  console.log('\n--- Step 5: Process Test Refund ---');
  // Simulate refunding $1.00 NZD (100 cents)
  const refundAmount = 100;
  const idempotencyKeyRefund = `pt-test-ref-${Date.now()}`;
  const refundResult = await provider.refundPayment({
    paymentIntentId: authResult.paymentIntentId,
    amountMinorUnits: refundAmount,
    currency: 'NZD',
    reason: 'customer_satisfaction_guarantee',
    idempotencyKey: idempotencyKeyRefund,
  });
  console.log(`✓ Test refund successful!`);
  console.log(`  Refund ID: ${refundResult.refundId}`);
  console.log(`  Status: ${refundResult.status} (expected: succeeded)`);
  console.log(`  Amount refunded: $${(refundResult.amountRefundedMinorUnits / 100).toFixed(2)} NZD`);

  if (refundResult.status !== 'succeeded') {
    throw new Error(`Expected status 'succeeded', got '${refundResult.status}'`);
  }

  console.log('\n--- Step 6: Webhook HMAC Signature Verification ---');
  if (webhookSecret) {
    const testPayload = JSON.stringify({
      id: `evt_test_${Date.now()}`,
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: authResult.paymentIntentId,
          amount: actualConsultationCharge,
          currency: 'nzd',
          status: 'succeeded',
        },
      },
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = stripe.webhooks.generateTestHeaderString({
      payload: testPayload,
      secret: webhookSecret,
      timestamp,
    });

    const event = stripe.webhooks.constructEvent(testPayload, signature, webhookSecret);
    console.log(`✓ Webhook HMAC signature verified! Event type: ${event.type}`);
  } else {
    console.log('ℹ️  STRIPE_WEBHOOK_SECRET not provided, skipping live signature header test.');
  }

  console.log('\n====================================================');
  console.log('  🎉 STRIPE TEST MODE VERIFICATION COMPLETE & PASSED');
  console.log('====================================================');
  console.log(`  Customer:      ${customer.customerId}`);
  console.log(`  PaymentIntent: ${authResult.paymentIntentId}`);
  console.log(`  Charge:        ${captureResult.chargeId}`);
  console.log(`  Refund:        ${refundResult.refundId}`);
  console.log('====================================================\n');

  return {
    success: true,
    customerId: customer.customerId,
    paymentIntentId: authResult.paymentIntentId,
    chargeId: captureResult.chargeId,
    refundId: refundResult.refundId,
  };
}

if (require.main === module) {
  runStripeTestModeVerification()
    .then((res) => {
      if (!res.success && res.reason === 'KEYS_NOT_CONFIGURED') {
        process.exit(0);
      }
    })
    .catch((err) => {
      console.error('❌ Verification failed:', err.message);
      process.exit(1);
    });
}

export { runStripeTestModeVerification };
