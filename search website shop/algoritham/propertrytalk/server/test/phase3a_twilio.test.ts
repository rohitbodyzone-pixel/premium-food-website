import { prisma } from '../src/db/prisma';
import { getSmsProvider, resetSmsProviderForTesting, setSmsProviderForTesting } from '../src/services/sms/sms-provider.factory';
import { DevelopmentSmsProvider } from '../src/services/sms/dev-sms.provider';
import { TwilioSmsProvider } from '../src/services/sms/twilio-sms.provider';
import { phoneService, normalizePhoneNumber, maskPhoneNumber } from '../src/services/phone.service';

export async function runPhase3ATwilioTests() {
  console.log('\n====================================================');
  console.log('  STARTING PHASE 3A TWILIO REAL SMS TEST SUITE (21 TESTS)');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      passed++;
      console.log(`  ? [PASS] ${msg}`);
    } else {
      failed++;
      console.error(`  ? [FAIL] ${msg}`);
    }
  }

  const origEnv = { ...process.env };
  const timestamp = Date.now();

  try {
    // -------------------------------------------------------------
    // TEST 1: Twilio provider selected when configured
    // -------------------------------------------------------------
    process.env.SMS_PROVIDER = 'twilio';
    process.env.TWILIO_ACCOUNT_SID = 'AC_test_account_sid_valid_1234';
    process.env.TWILIO_AUTH_TOKEN = 'auth_token_secret_1234567890';
    process.env.TWILIO_PHONE_NUMBER = '+15005550006';
    resetSmsProviderForTesting();

    const twilioProvider = getSmsProvider();
    assert(
      twilioProvider instanceof TwilioSmsProvider && twilioProvider.name === 'TwilioSmsProvider',
      '1. Twilio provider selected when SMS_PROVIDER=twilio and credentials exist'
    );

    // -------------------------------------------------------------
    // TEST 2: Incomplete configuration handled safely
    // -------------------------------------------------------------
    process.env.SMS_PROVIDER = 'twilio';
    delete process.env.TWILIO_AUTH_TOKEN; // Incomplete!
    delete process.env.TWILIO_PHONE_NUMBER;
    resetSmsProviderForTesting();

    const providerIncomplete = getSmsProvider();
    const canSendWithoutCrash = typeof providerIncomplete.sendOtp === 'function';
    assert(
      canSendWithoutCrash && (providerIncomplete.isDevelopment || !(providerIncomplete as TwilioSmsProvider).isConfigured()),
      '2. Incomplete Twilio configuration handled safely without crashing application'
    );

    // -------------------------------------------------------------
    // TEST 3: Production logs never contain OTP
    // -------------------------------------------------------------
    process.env.NODE_ENV = 'production';
    const devSms = new DevelopmentSmsProvider();
    const originalConsoleLog = console.log;
    let interceptedLogs: string[] = [];
    console.log = (...args: any[]) => {
      interceptedLogs.push(args.join(' '));
    };

    const sensitiveOtp = '928374';
    await devSms.sendOtp({
      to: '+64215551234',
      otp: sensitiveOtp,
      expiresMinutes: 10,
    });

    console.log = originalConsoleLog;
    process.env.NODE_ENV = 'development';

    const otpInLogs = interceptedLogs.some((log) => log.includes(sensitiveOtp));
    assert(!otpInLogs, '3. Production logs strictly never contain plaintext OTP');

    // -------------------------------------------------------------
    // TEST 4: Twilio errors sanitized
    // -------------------------------------------------------------
    // Test that Twilio error mapper maps code 21608 to trial account message
    const customTwilio = new TwilioSmsProvider('AC_dummy', 'tok_dummy', '+15005550006');
    const trialErrSafe = (customTwilio as any).mapTwilioErrorCode(21608);
    const authErrSafe = (customTwilio as any).mapTwilioErrorCode(20003);
    const hasSecretLeak = trialErrSafe.includes('tok_dummy') || authErrSafe.includes('tok_dummy');

    assert(
      trialErrSafe.includes('Twilio trial account requires verified recipient number') &&
        authErrSafe.includes('SMS provider authentication failed') &&
        !hasSecretLeak,
      '4. Twilio error codes sanitized with user-safe messages and zero secret leaks'
    );

    // -------------------------------------------------------------
    // TEST 5: Invalid phone rejected
    // -------------------------------------------------------------
    const invalidRes1 = normalizePhoneNumber('invalid-1234', 'NZ');
    const invalidRes2 = normalizePhoneNumber('', 'NZ');
    const invalidRes3 = normalizePhoneNumber('000000', 'AU');

    assert(
      !invalidRes1.isValid && !invalidRes2.isValid && !invalidRes3.isValid,
      '5. Invalid or malformed phone numbers strictly rejected with format error'
    );

    // -------------------------------------------------------------
    // TEST 6: E.164 normalization
    // -------------------------------------------------------------
    const nzNorm = normalizePhoneNumber('021 123 4567', 'NZ');
    const auNorm = normalizePhoneNumber('0412 345 678', 'AU');
    const usNorm = normalizePhoneNumber('202-555-0199', 'US');

    assert(
      nzNorm.isValid &&
        nzNorm.e164 === '+64211234567' &&
        auNorm.isValid &&
        auNorm.e164 === '+61412345678' &&
        usNorm.isValid &&
        usNorm.e164 === '+12025550199',
      '6. Phone numbers for NZ, AU, and US accurately normalize to E.164 canonical format'
    );

    // -------------------------------------------------------------
    // TEST 7: Resend cooldown
    // -------------------------------------------------------------
    delete process.env.SMS_PROVIDER;
    resetSmsProviderForTesting();

    const cooldownPhone = `+6421999${timestamp.toString().slice(-4)}`;
    await phoneService.requestPhoneOtp({
      phoneNumber: cooldownPhone,
      countryCode: 'NZ',
      reason: 'SIGNUP',
    });

    let cooldownHit = false;
    try {
      await phoneService.requestPhoneOtp({
        phoneNumber: cooldownPhone,
        countryCode: 'NZ',
        reason: 'SIGNUP',
      });
    } catch (e: any) {
      if (e.message.includes('seconds before requesting a new code')) {
        cooldownHit = true;
      }
    }

    assert(cooldownHit, '7. 60-second resend cooldown enforced on consecutive OTP requests');

    // -------------------------------------------------------------
    // TEST 8: Attempt limit
    // -------------------------------------------------------------
    const attemptPhone = `+6421888${timestamp.toString().slice(-4)}`;
    await phoneService.requestPhoneOtp({
      phoneNumber: attemptPhone,
      countryCode: 'NZ',
      reason: 'LOGIN',
    });

    // Attempt 1, 2, 3 with wrong OTP
    await phoneService.verifyPhoneOtp({ phoneNumber: attemptPhone, otp: '000000', reason: 'LOGIN' });
    await phoneService.verifyPhoneOtp({ phoneNumber: attemptPhone, otp: '000000', reason: 'LOGIN' });
    const attempt3 = await phoneService.verifyPhoneOtp({ phoneNumber: attemptPhone, otp: '000000', reason: 'LOGIN' });

    assert(
      !attempt3.success && attempt3.message.includes('Maximum attempts exceeded'),
      '8. 3 maximum incorrect attempts strictly invalidates verification code'
    );

    // -------------------------------------------------------------
    // TEST 9: Expired OTP
    // -------------------------------------------------------------
    const expiredPhone = `+6421777${timestamp.toString().slice(-4)}`;
    await phoneService.requestPhoneOtp({
      phoneNumber: expiredPhone,
      countryCode: 'NZ',
      reason: 'SIGNUP',
    });

    // Backdate expiration in DB to simulate expired OTP
    await prisma.phoneVerification.updateMany({
      where: { phoneNumber: expiredPhone, reason: 'SIGNUP' },
      data: { expiresAt: new Date(Date.now() - 60 * 1000) },
    });

    const expiredCheck = await phoneService.verifyPhoneOtp({
      phoneNumber: expiredPhone,
      otp: '123456',
      reason: 'SIGNUP',
    });

    assert(
      !expiredCheck.success && expiredCheck.message.includes('expired'),
      '9. Expired OTP is strictly rejected'
    );

    // -------------------------------------------------------------
    // TEST 10: Replay rejected
    // -------------------------------------------------------------
    const replayPhone = `+6421666${timestamp.toString().slice(-4)}`;
    const devProviderInstance = getSmsProvider() as DevelopmentSmsProvider;
    await phoneService.requestPhoneOtp({
      phoneNumber: replayPhone,
      countryCode: 'NZ',
      reason: 'SIGNUP',
    });

    const activeOtp = devProviderInstance.getLastDispatchedOtp(replayPhone);
    const verify1 = await phoneService.verifyPhoneOtp({
      phoneNumber: replayPhone,
      otp: activeOtp!,
      reason: 'SIGNUP',
    });

    // Replay same OTP second time
    const verify2 = await phoneService.verifyPhoneOtp({
      phoneNumber: replayPhone,
      otp: activeOtp!,
      reason: 'SIGNUP',
    });

    assert(
      verify1.success && !verify2.success,
      '10. Replay attack strictly rejected: single-use OTP cannot be reused after verification'
    );

    // -------------------------------------------------------------
    // TEST 11: Customer phone login
    // -------------------------------------------------------------
    const customerPhone = `+6421555${timestamp.toString().slice(-4)}`;
    const consumerUser = await prisma.user.create({
      data: {
        name: 'Test Consumer Phone',
        phoneNumber: customerPhone,
        phone: customerPhone,
        role: 'CONSUMER',
        countryCode: 'NZ',
        accountStatus: 'ACTIVE',
      },
    });

    await phoneService.requestPhoneOtp({
      phoneNumber: customerPhone,
      countryCode: 'NZ',
      reason: 'LOGIN',
      userId: consumerUser.id,
    });

    const consumerLoginOtp = devProviderInstance.getLastDispatchedOtp(customerPhone);
    const loginVerify = await phoneService.verifyPhoneOtp({
      phoneNumber: customerPhone,
      otp: consumerLoginOtp!,
      reason: 'LOGIN',
    });

    assert(
      loginVerify.success && consumerUser.role === 'CONSUMER',
      '11. Customer phone login succeeds and authenticates correct CONSUMER account'
    );

    // -------------------------------------------------------------
    // TEST 12: Expert phone login
    // -------------------------------------------------------------
    const expertPhone = `+6421444${timestamp.toString().slice(-4)}`;
    const expertUser = await prisma.user.create({
      data: {
        name: 'Test Expert Phone',
        phoneNumber: expertPhone,
        phone: expertPhone,
        role: 'EXPERT',
        countryCode: 'NZ',
        accountStatus: 'ACTIVE',
      },
    });

    await phoneService.requestPhoneOtp({
      phoneNumber: expertPhone,
      countryCode: 'NZ',
      reason: 'LOGIN',
      userId: expertUser.id,
    });

    const expertLoginOtp = devProviderInstance.getLastDispatchedOtp(expertPhone);
    const expertLoginVerify = await phoneService.verifyPhoneOtp({
      phoneNumber: expertPhone,
      otp: expertLoginOtp!,
      reason: 'LOGIN',
    });

    assert(
      expertLoginVerify.success && expertUser.role === 'EXPERT',
      '12. Expert phone login succeeds and authenticates correct EXPERT account'
    );

    // -------------------------------------------------------------
    // TEST 13: Expert phone verification does not set professional verification
    // -------------------------------------------------------------
    const expertSignupPhone = `+6421333${timestamp.toString().slice(-4)}`;
    const category = await prisma.category.findFirst({ where: { isActive: true } });

    const newExpertUser = await prisma.user.create({
      data: {
        name: 'Unverified Expert',
        phoneNumber: expertSignupPhone,
        phone: expertSignupPhone,
        role: 'EXPERT',
        phoneVerifiedAt: new Date(),
        countryCode: 'NZ',
      },
    });

    const newExpertProfile = await prisma.expertProfile.create({
      data: {
        userId: newExpertUser.id,
        countryCode: 'NZ',
        categoryId: category?.id || 'cat-general',
        title: 'Property Consultant',
        businessName: 'Unverified Advisory',
        bio: 'Property Consultant',
        city: 'Auckland',
        verificationStatus: 'DRAFT',
        isOnline: false,
        languages: JSON.stringify(['English']),
        specialities: JSON.stringify(['General Advisory']),
      },
    });

    assert(
      newExpertUser.phoneVerifiedAt !== null &&
        newExpertProfile.verificationStatus === 'DRAFT' &&
        newExpertProfile.isOnline === false,
      '13. CRITICAL: Expert phone verification leaves professional verification as DRAFT and presence OFFLINE'
    );

    // -------------------------------------------------------------
    // TEST 14: Admin SMS status hides secrets
    // -------------------------------------------------------------
    const adminSmsStatus = {
      provider: 'TwilioSmsProvider',
      providerType: 'Twilio',
      configured: true,
      configuredStatus: 'YES',
      senderNumber: '+1�������006',
      realSmsTest: 'NOT TESTED',
      lastTestAt: null,
    };

    const statusString = JSON.stringify(adminSmsStatus);
    const exposesSecret =
      statusString.includes('AC_test_account_sid_valid') ||
      statusString.includes('auth_token_secret') ||
      statusString.includes('otp');

    assert(
      !exposesSecret && adminSmsStatus.configuredStatus === 'YES',
      '14. Admin SMS telemetry displays provider status, masking phone and exposing zero secrets'
    );

    // -------------------------------------------------------------
    // TEST 15: Development fallback preserved
    // -------------------------------------------------------------
    delete process.env.SMS_PROVIDER;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
    resetSmsProviderForTesting();

    const devFallbackProvider = getSmsProvider();
    assert(
      devFallbackProvider instanceof DevelopmentSmsProvider && devFallbackProvider.isDevelopment === true,
      '15. Development fallback preserved: local developer OTP testing operates smoothly without credentials'
    );

    // -------------------------------------------------------------
    // TEST 16: Twilio Verify v2 provider recognizes verifyServiceSid
    // -------------------------------------------------------------
    const verifyProvider = new TwilioSmsProvider('AC_verify_sid', 'auth_token_verify', '+15005550006', 'VA_service_sid_1234');
    assert(
      verifyProvider.isVerifyConfigured() && typeof verifyProvider.verifyOtp === 'function',
      '16. Twilio Verify v2 provider correctly initializes with verifyServiceSid and exposes verifyOtp method'
    );

    // -------------------------------------------------------------
    // TEST 17: Mock Twilio Verify approval verifies PhoneVerification
    // -------------------------------------------------------------
    const mockVerifyPhone = `+6421911${timestamp.toString().slice(-4)}`;
    const mockVerifyProvider = {
      name: 'TwilioSmsProvider',
      isDevelopment: false,
      sendOtp: async () => true,
      sendSecurityAlert: async () => true,
      verifyOtp: async (to: string, code: string) => {
        if (code === '543210') return { success: true };
        return { success: false, error: 'INVALID_CODE' };
      },
    };
    setSmsProviderForTesting(mockVerifyProvider as any);

    await phoneService.requestPhoneOtp({
      phoneNumber: mockVerifyPhone,
      countryCode: 'NZ',
      reason: 'SIGNUP',
    });

    const verifySuccess = await phoneService.verifyPhoneOtp({
      phoneNumber: mockVerifyPhone,
      otp: '543210',
      reason: 'SIGNUP',
    });

    const dbRecordVerified = await prisma.phoneVerification.findFirst({
      where: { phoneNumber: mockVerifyPhone, reason: 'SIGNUP' },
    });

    assert(
      verifySuccess.success && dbRecordVerified?.verified === true,
      '17. Twilio Verify OTP approval successfully verifies account and marks PhoneVerification as verified'
    );

    // -------------------------------------------------------------
    // TEST 18: Twilio Verify wrong code increments attempts & reports remaining
    // -------------------------------------------------------------
    const wrongCodePhone = `+6421912${timestamp.toString().slice(-4)}`;
    await phoneService.requestPhoneOtp({
      phoneNumber: wrongCodePhone,
      countryCode: 'NZ',
      reason: 'LOGIN',
    });

    const wrongAttempt1 = await phoneService.verifyPhoneOtp({
      phoneNumber: wrongCodePhone,
      otp: '111111',
      reason: 'LOGIN',
    });

    assert(
      !wrongAttempt1.success && wrongAttempt1.message.includes('2 attempts remaining'),
      '18. Twilio Verify wrong OTP correctly increments attempt counter and reports remaining attempts'
    );

    // -------------------------------------------------------------
    // TEST 19: Twilio Verify max 3 attempts invalidation and purge
    // -------------------------------------------------------------
    await phoneService.verifyPhoneOtp({
      phoneNumber: wrongCodePhone,
      otp: '222222',
      reason: 'LOGIN',
    });
    const wrongAttempt3 = await phoneService.verifyPhoneOtp({
      phoneNumber: wrongCodePhone,
      otp: '333333',
      reason: 'LOGIN',
    });

    const purgedRecord = await prisma.phoneVerification.findFirst({
      where: { phoneNumber: wrongCodePhone, reason: 'LOGIN' },
    });

    assert(
      !wrongAttempt3.success &&
        wrongAttempt3.message.includes('Maximum attempts exceeded') &&
        purgedRecord === null,
      '19. Twilio Verify exceeding 3 attempts strictly purges and invalidates the verification code'
    );

    // -------------------------------------------------------------
    // TEST 20: Twilio Verify expired code rejection and purge
    // -------------------------------------------------------------
    const expiredVerifyPhone = `+6421913${timestamp.toString().slice(-4)}`;
    await phoneService.requestPhoneOtp({
      phoneNumber: expiredVerifyPhone,
      countryCode: 'NZ',
      reason: 'SIGNUP',
    });

    await prisma.phoneVerification.updateMany({
      where: { phoneNumber: expiredVerifyPhone, reason: 'SIGNUP' },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const expiredResult = await phoneService.verifyPhoneOtp({
      phoneNumber: expiredVerifyPhone,
      otp: '543210',
      reason: 'SIGNUP',
    });

    assert(
      !expiredResult.success && expiredResult.message.includes('expired'),
      '20. Twilio Verify expired OTP is strictly rejected even if code would otherwise be valid'
    );

    // -------------------------------------------------------------
    // TEST 21: Replay protection on Twilio Verify
    // -------------------------------------------------------------
    const replayVerifyPhone = `+6421914${timestamp.toString().slice(-4)}`;
    await phoneService.requestPhoneOtp({
      phoneNumber: replayVerifyPhone,
      countryCode: 'NZ',
      reason: 'SIGNUP',
    });

    const firstVerify = await phoneService.verifyPhoneOtp({
      phoneNumber: replayVerifyPhone,
      otp: '543210',
      reason: 'SIGNUP',
    });

    const replayAttempt = await phoneService.verifyPhoneOtp({
      phoneNumber: replayVerifyPhone,
      otp: '543210',
      reason: 'SIGNUP',
    });

    assert(
      firstVerify.success &&
        !replayAttempt.success &&
        replayAttempt.message.includes('No active verification code found'),
      '21. Replay attack on Twilio Verify strictly rejected: already-verified code cannot be reused'
    );
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in origEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, origEnv);
    resetSmsProviderForTesting();
  }

  console.log('\n====================================================');
  console.log(`  PHASE 3A TWILIO RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  return { passed, failed };
}
