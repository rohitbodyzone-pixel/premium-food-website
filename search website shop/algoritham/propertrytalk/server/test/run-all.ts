import { prisma } from '../src/db/prisma';
import { runCoreTests } from './api.test';
import { runAuthTests } from './auth.test';
import { runWebRTCPresenceTests } from './webrtc-presence.test';
import { runPaymentBillingTests } from './payment-billing.test';
import { runPhase2CTests } from './phase2c.test';
import { runPhase2DTests } from './phase2d.test';
import { runChatFlowTests } from './phase2_chat_flow.test';

async function main() {
  console.log('====================================================');
  console.log('  PROPERTYTALK MASTER TEST SUITE (CORE + 2A + 2B + 2C + 2D + CHAT FLOW)');
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

    const res4 = await runPaymentBillingTests();
    totalPassed += res4.passed;
    totalFailed += res4.failed;

    const res5 = await runPhase2CTests();
    totalPassed += res5.passed;
    totalFailed += res5.failed;

    const res6 = await runPhase2DTests();
    totalPassed += res6.passed;
    totalFailed += res6.failed;

    const res7 = await runChatFlowTests();
    totalPassed += res7.passed;
    totalFailed += res7.failed;

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
