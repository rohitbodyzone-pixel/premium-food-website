import { prisma } from '../src/db/prisma';
import { runCoreTests } from './api.test';
import { runAuthTests } from './auth.test';
import { runWebRTCPresenceTests } from './webrtc-presence.test';
import { runPaymentBillingTests } from './payment-billing.test';
import { runPhase2CTests } from './phase2c.test';
import { runPhase2DTests } from './phase2d.test';
import { runChatFlowTests } from './phase2_chat_flow.test';
import { runPhase3ATests } from './phase3a.test';
import { runPhase3ATwilioTests } from './phase3a_twilio.test';
import { runStripeRegressionTests } from './stripe-regression.test';
import { runPushRegressionTests } from './push-regression.test';
import { runProductStructureTests } from './product-structure.test';
import { runPhase4aGooglePropertyTests } from './phase4a-google-property.test';
import { runTradeMeInsightsTests } from './trade-me-insights.test';
import { runAuthoritativeDataTests } from './authoritative-data.test';
import { runLinzAuthoritativeTests } from './linz-authoritative.test';
import { resetEmailProviderForTesting } from '../src/services/email/email-provider.factory';
import { resetSmsProviderForTesting } from '../src/services/sms/sms-provider.factory';
import { resetPaymentProviderForTesting } from '../src/services/payment/payment-provider.factory';

async function main() {
  console.log('====================================================');
  console.log('  PROPERTYTALK MASTER TEST SUITE (CORE + 2A-2D + CHAT + PHASE 3A + TWILIO)');
  console.log('====================================================');

  let totalPassed = 0;
  let totalFailed = 0;

  try {
    const res1 = await runCoreTests();
    totalPassed += res1.passed;
    totalFailed += res1.failed;

    const res2 = await runAuthTests();
    totalPassed += res2.passed;
    totalFailed += res2.failed;

    const res3 = await runWebRTCPresenceTests();
    totalPassed += res3.passed;
    totalFailed += res3.failed;

    const origPaymentProvider = process.env.PAYMENT_PROVIDER;
    process.env.PAYMENT_PROVIDER = 'mock';
    resetPaymentProviderForTesting();

    const res4 = await runPaymentBillingTests();
    totalPassed += res4.passed;
    totalFailed += res4.failed;

    const origSmsProvider = process.env.SMS_PROVIDER;
    const origEmailProvider = process.env.EMAIL_PROVIDER;

    // Phase 2C tests dev email preview URLs
    process.env.EMAIL_PROVIDER = 'dev';
    resetEmailProviderForTesting();

    const res5 = await runPhase2CTests();
    totalPassed += res5.passed;
    totalFailed += res5.failed;

    // Phase 2D tests dev SMS console OTP preview
    process.env.SMS_PROVIDER = 'dev';
    resetSmsProviderForTesting();

    const res6 = await runPhase2DTests();
    totalPassed += res6.passed;
    totalFailed += res6.failed;

    // Restore configured environment
    if (origEmailProvider) process.env.EMAIL_PROVIDER = origEmailProvider; else delete process.env.EMAIL_PROVIDER;
    resetEmailProviderForTesting();
    if (origSmsProvider) process.env.SMS_PROVIDER = origSmsProvider; else delete process.env.SMS_PROVIDER;
    resetSmsProviderForTesting();

    const res7 = await runChatFlowTests();
    totalPassed += res7.passed;
    totalFailed += res7.failed;

    const res8 = await runPhase3ATests();
    totalPassed += res8.passed;
    totalFailed += res8.failed;

    const res9 = await runPhase3ATwilioTests();
    totalPassed += res9.passed;
    totalFailed += res9.failed;

    const res10 = await runStripeRegressionTests();
    totalPassed += res10.passed;
    totalFailed += res10.failed;

    if (origPaymentProvider) process.env.PAYMENT_PROVIDER = origPaymentProvider;
    else delete process.env.PAYMENT_PROVIDER;
    resetPaymentProviderForTesting();

    const res11 = await runPushRegressionTests();
    totalPassed += res11.passed;
    totalFailed += res11.failed;

    const res12 = await runProductStructureTests();
    totalPassed += res12.passed;
    totalFailed += res12.failed;

    const res13 = await runPhase4aGooglePropertyTests();
    totalPassed += res13.passed;
    totalFailed += res13.failed;

    const res14 = await runTradeMeInsightsTests();
    totalPassed += res14.passed;
    totalFailed += res14.failed;

    const res15 = await runAuthoritativeDataTests();
    totalPassed += res15.passed;
    totalFailed += res15.failed;

    const res16 = await runLinzAuthoritativeTests();
    totalPassed += res16.passed;
    totalFailed += res16.failed;

    console.log('====================================================');
    console.log(`  ALL TEST SUITES FINISHED`);
    console.log(`  TOTAL PASSED: ${totalPassed}`);
    console.log(`  TOTAL FAILED: ${totalFailed}`);
    console.log('====================================================');

    if (totalFailed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal test error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
