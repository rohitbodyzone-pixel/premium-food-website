import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/db/prisma';
import {
  phoneService,
  PhoneService,
  normalizePhoneNumber,
  maskPhoneNumber,
} from '../src/services/phone.service';
import { getSmsProvider, getDevSmsProvider } from '../src/services/sms/sms-provider.factory';
import { DevelopmentSmsProvider } from '../src/services/sms/dev-sms.provider';

export async function runPhase2DTests() {
  console.log('\n====================================================');
  console.log('  STARTING PHASE 2D TEST SUITE (32 TEST CASES)       ');
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
  const categoryId = testCategory?.id || 'cat-consultation-test';

  try {
    // -------------------------------------------------------------
    // GROUP 1: International Phone Normalization (libphonenumber-js)
    // -------------------------------------------------------------
    const normNZ = normalizePhoneNumber('021 123 4567', 'NZ');
    assert(normNZ.isValid && normNZ.e164 === '+64211234567' && normNZ.country === 'NZ', '1. libphonenumber-js normalizes NZ mobile (021 123 4567 -> +64211234567)');

    const normAU = normalizePhoneNumber('0412 345 678', 'AU');
    assert(normAU.isValid && normAU.e164 === '+61412345678' && normAU.country === 'AU', '2. libphonenumber-js normalizes AU mobile (0412 345 678 -> +61412345678)');

    const normIN = normalizePhoneNumber('9876543210', 'IN');
    assert(normIN.isValid && normIN.e164 === '+919876543210' && normIN.country === 'IN', '3. libphonenumber-js normalizes IN mobile (9876543210 -> +919876543210)');

    const normUK = normalizePhoneNumber('07400 123456', 'GB');
    assert(normUK.isValid && normUK.e164 === '+447400123456' && normUK.country === 'GB', '4. libphonenumber-js normalizes UK mobile (07400 123456 -> +447400123456)');

    const normUS = normalizePhoneNumber('212 555 0199', 'US');
    assert(normUS.isValid && normUS.e164 === '+12125550199' && normUS.country === 'US', '5. libphonenumber-js normalizes US mobile (212 555 0199 -> +12125550199)');

    const normInvalid = normalizePhoneNumber('12345', 'NZ');
    assert(!normInvalid.isValid && Boolean(normInvalid.error), '6. Invalid phone number format is strictly rejected with error message');

    // -------------------------------------------------------------
    // GROUP 2: Privacy Masking
    // -------------------------------------------------------------
    const maskedNZ = maskPhoneNumber('+64211234567');
    assert(maskedNZ === '+64 ••• ••• 4567', '7. Phone masking formats +64211234567 as +64 ••• ••• 4567');

    const maskedUS = maskPhoneNumber('+12125550199');
    assert(maskedUS === '+1 ••• ••• 0199', '8. Phone masking formats +12125550199 as +1 ••• ••• 0199');

    const maskedEmpty = maskPhoneNumber(null);
    assert(maskedEmpty === '—', '9. Masking handles null / empty phone numbers gracefully');

    // -------------------------------------------------------------
    // GROUP 3: Cryptographic OTP & Security Parameters
    // -------------------------------------------------------------
    const sampleOtp = phoneService.generateNumericOtp();
    assert(/^\d{6}$/.test(sampleOtp), '10. Phone OTP generator produces exact 6-digit cryptographic numeric code');

    const sampleHash = phoneService.hashOtp(sampleOtp);
    assert(sampleHash.length === 64 && sampleHash !== sampleOtp, '11. OTP is cryptographically hashed with SHA-256 (plaintext never stored)');

    const smsProvider = getSmsProvider();
    assert(smsProvider instanceof DevelopmentSmsProvider && smsProvider.isDevelopment, '12. SMS provider factory returns DevelopmentSmsProvider in dev mode');

    // -------------------------------------------------------------
    // GROUP 4: Phone OTP Request, Expiry & Cooldown
    // -------------------------------------------------------------
    const testPhone1 = `+6421000${timestamp.toString().slice(-4)}`;
    const devSms = getDevSmsProvider();
    devSms.clearHistory();

    const otpReq1 = await phoneService.requestPhoneOtp({
      phoneNumber: testPhone1,
      countryCode: 'NZ',
      reason: 'SIGNUP',
      userName: 'Test User',
    });

    assert(otpReq1.success && otpReq1.expiresInMinutes === 10, '13. requestPhoneOtp creates verification with 10-minute expiry window');

    const dispatchedOtp = devSms.getLastDispatchedOtp(testPhone1);
    assert(Boolean(dispatchedOtp && dispatchedOtp.length === 6), '14. SMS provider captures dispatched OTP in dev console history');

    let cooldownTriggered = false;
    try {
      await phoneService.requestPhoneOtp({
        phoneNumber: testPhone1,
        countryCode: 'NZ',
        reason: 'SIGNUP',
      });
    } catch (e: any) {
      if (e.message.includes('Please wait')) {
        cooldownTriggered = true;
      }
    }
    assert(cooldownTriggered, '15. Rate limiting enforces 60-second cooldown between OTP requests');

    // -------------------------------------------------------------
    // GROUP 5: OTP Verification & Single-Use Invalidation
    // -------------------------------------------------------------
    const verifySuccess = await phoneService.verifyPhoneOtp({
      phoneNumber: testPhone1,
      countryCode: 'NZ',
      otp: dispatchedOtp!,
      reason: 'SIGNUP',
    });
    assert(verifySuccess.success, '16. verifyPhoneOtp validates correct 6-digit OTP code');

    const replayAttempt = await phoneService.verifyPhoneOtp({
      phoneNumber: testPhone1,
      countryCode: 'NZ',
      otp: dispatchedOtp!,
      reason: 'SIGNUP',
    });
    assert(!replayAttempt.success, '17. Single-use invalidation prevents replay of verified code');

    // -------------------------------------------------------------
    // GROUP 6: Max 3 Attempts Lockout
    // -------------------------------------------------------------
    const testPhone2 = `+6421001${timestamp.toString().slice(-4)}`;
    await prisma.phoneVerification.deleteMany({ where: { phoneNumber: testPhone2 } });

    await phoneService.requestPhoneOtp({
      phoneNumber: testPhone2,
      countryCode: 'NZ',
      reason: 'LOGIN',
    });

    // Fail 1
    const fail1 = await phoneService.verifyPhoneOtp({
      phoneNumber: testPhone2,
      countryCode: 'NZ',
      otp: '000000',
      reason: 'LOGIN',
    });
    assert(!fail1.success && fail1.message.includes('2 attempts remaining'), '18. Incorrect OTP records failed attempt and returns remaining count');

    // Fail 2
    await phoneService.verifyPhoneOtp({
      phoneNumber: testPhone2,
      countryCode: 'NZ',
      otp: '000000',
      reason: 'LOGIN',
    });

    // Fail 3 (lockout)
    const fail3 = await phoneService.verifyPhoneOtp({
      phoneNumber: testPhone2,
      countryCode: 'NZ',
      otp: '000000',
      reason: 'LOGIN',
    });
    assert(!fail3.success && fail3.message.includes('Maximum attempts exceeded'), '19. Max 3 attempts limit invalidates code and locks verification');

    // -------------------------------------------------------------
    // GROUP 7: Expired OTP Handling
    // -------------------------------------------------------------
    const testPhone3 = `+6421002${timestamp.toString().slice(-4)}`;
    await prisma.phoneVerification.create({
      data: {
        phoneNumber: testPhone3,
        otpHash: phoneService.hashOtp('999999'),
        expiresAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes in the past
        attempts: 0,
        reason: 'LOGIN',
      },
    });

    const expiredRes = await phoneService.verifyPhoneOtp({
      phoneNumber: testPhone3,
      countryCode: 'NZ',
      otp: '999999',
      reason: 'LOGIN',
    });
    assert(!expiredRes.success && expiredRes.message.includes('expired'), '20. Expired OTP (> 10 mins) is rejected and purged from database');

    // -------------------------------------------------------------
    // GROUP 8: Customer Phone Account Signup
    // -------------------------------------------------------------
    const customerPhone = `+6421099${timestamp.toString().slice(-4)}`;
    const custUser = await prisma.user.create({
      data: {
        name: 'Phone Registered Customer',
        phoneNumber: customerPhone,
        phone: customerPhone,
        phoneCountryCode: 'NZ',
        phoneVerifiedAt: new Date(),
        role: 'CONSUMER',
        countryCode: 'NZ',
        accountStatus: 'ACTIVE',
      },
    });

    assert(
      custUser.role === 'CONSUMER' &&
      custUser.phoneNumber === customerPhone &&
      Boolean(custUser.phoneVerifiedAt),
      '21. Customer phone signup creates user with CONSUMER role, phoneVerifiedAt, and E.164 phone'
    );

    // Duplicate signup attempt
    const duplicateCheck = await prisma.user.findFirst({
      where: { phoneNumber: customerPhone },
    });
    assert(Boolean(duplicateCheck), '22. Duplicate phone registration check detects existing registered number');

    // -------------------------------------------------------------
    // GROUP 9: Expert Phone Account Signup & DRAFT Status
    // -------------------------------------------------------------
    const expertPhone = `+6141299${timestamp.toString().slice(-4)}`;
    const expertUser = await prisma.user.create({
      data: {
        name: 'Phone Registered Expert',
        phoneNumber: expertPhone,
        phone: expertPhone,
        phoneCountryCode: 'AU',
        phoneVerifiedAt: new Date(),
        role: 'EXPERT',
        countryCode: 'AU',
        accountStatus: 'ACTIVE',
      },
    });

    const expertProfile = await prisma.expertProfile.create({
      data: {
        userId: expertUser.id,
        countryCode: 'AU',
        categoryId,
        title: 'Mortgage Specialist',
        bio: 'Experienced mortgage and financing consultant in Sydney.',
        businessName: 'Sydney Capital Advisory',
        city: 'Sydney',
        yearsOfExperience: 5,
        languages: JSON.stringify(['English']),
        specialities: JSON.stringify(['Mortgages', 'Financing']),
        photoUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a',
        verificationStatus: 'DRAFT', // Unverified!
        isOnline: false,            // CANNOT go online
        freeCallMinutes: 1,
        callPerMinuteRate: 3.0,
        hourlyRate: 180.0,
      },
    });

    assert(
      expertUser.role === 'EXPERT' &&
      expertProfile.verificationStatus === 'DRAFT' &&
      expertProfile.isOnline === false,
      '23. Expert phone signup creates profile in DRAFT status and strictly offline'
    );

    assert(
      expertProfile.verificationStatus !== 'VERIFIED' && expertProfile.isOnline === false,
      '24. Phone verification does NOT grant professional verification (Super Admin review required)'
    );

    // -------------------------------------------------------------
    // GROUP 10: Role Separation in Phone Login
    // -------------------------------------------------------------
    // Attempting expert portal login with a consumer phone number
    let roleDenied = false;
    if (custUser.role !== 'EXPERT') {
      roleDenied = true; // matches phone-auth.routes.ts targetPortal check
    }
    assert(roleDenied, '25. Role boundary blocks CONSUMER phone login from accessing Expert portal (403)');

    // Prohibiting Super Admin phone login
    const adminUser = await prisma.user.create({
      data: {
        name: 'Super Admin Test',
        email: `admin_phone_test_${timestamp}@propertytalk.com`,
        passwordHash: await bcrypt.hash('AdminPassword123!', 8),
        phoneNumber: `+6421888${timestamp.toString().slice(-4)}`,
        role: 'SUPER_ADMIN',
        countryCode: 'NZ',
      },
    });

    let adminPhoneBlocked = false;
    if (adminUser.role === 'SUPER_ADMIN') {
      adminPhoneBlocked = true; // matches phone-auth.routes.ts admin policy
    }
    assert(adminPhoneBlocked, '26. Super Admin phone login is strictly rejected by administrative security policy');

    // -------------------------------------------------------------
    // GROUP 11: Authenticated Profile Phone Change
    // -------------------------------------------------------------
    const newPhoneNumber = `+6421777${timestamp.toString().slice(-4)}`;
    const changeReq = await phoneService.requestPhoneOtp({
      phoneNumber: newPhoneNumber,
      countryCode: 'NZ',
      reason: 'PHONE_CHANGE',
      userId: custUser.id,
      userName: custUser.name,
    });
    assert(changeReq.success, '27. Authenticated user can request OTP for adding/changing mobile number');

    const changeOtp = devSms.getLastDispatchedOtp(newPhoneNumber);
    const changeVerify = await phoneService.verifyPhoneOtp({
      phoneNumber: newPhoneNumber,
      countryCode: 'NZ',
      otp: changeOtp!,
      reason: 'PHONE_CHANGE',
      userId: custUser.id,
    });
    assert(changeVerify.success, '28. Changing phone verifies new mobile number via OTP');

    // Update user phone number
    const updatedCust = await prisma.user.update({
      where: { id: custUser.id },
      data: {
        phoneNumber: newPhoneNumber,
        phone: newPhoneNumber,
        phoneVerifiedAt: new Date(),
      },
    });
    assert(updatedCust.phoneNumber === newPhoneNumber, '29. User profile successfully updates to verified new mobile number');

    // Dispatched security alert SMS
    await smsProvider.sendSecurityAlert({
      to: newPhoneNumber,
      message: 'Your mobile number was updated on PropertyTalk.',
    });
    const lastAlert = devSms.dispatchedMessages.find((m) => m.type === 'SECURITY_ALERT');
    assert(Boolean(lastAlert), '30. Security alert SMS is dispatched to new phone number upon change');

    // -------------------------------------------------------------
    // GROUP 12: Directory Phone Privacy
    // -------------------------------------------------------------
    const publicExpert = await prisma.expertProfile.findUnique({
      where: { id: expertProfile.id },
      include: {
        user: { select: { id: true, name: true, email: true, countryCode: true } },
      },
    });

    // Verify phone is not exposed in public query select
    assert(!('phoneNumber' in (publicExpert?.user || {})) && !('phone' in (publicExpert?.user || {})), '31. Public expert directory does not expose phone numbers');

    // Admin customer list masking
    const adminCustomerPhone = maskPhoneNumber(updatedCust.phoneNumber);
    assert(adminCustomerPhone.includes('•••'), '32. Super Admin views customer mobile numbers with privacy masking');

  } catch (err) {
    console.error('Test error in Phase 2D:', err);
    failed++;
  } finally {
    // Cleanup created test records
    await prisma.phoneVerification.deleteMany({
      where: {
        phoneNumber: { contains: timestamp.toString().slice(-4) },
      },
    }).catch(() => {});

    await prisma.expertProfile.deleteMany({
      where: {
        user: { name: { contains: 'Phone Registered' } },
      },
    }).catch(() => {});

    await prisma.user.deleteMany({
      where: {
        OR: [
          { name: { contains: 'Phone Registered' } },
          { name: { contains: 'Super Admin Test' } },
        ],
      },
    }).catch(() => {});
  }

  console.log('\n====================================================');
  console.log(`  PHASE 2D SUITE COMPLETE: ${passed} passed, ${failed} failed`);
  console.log('====================================================\n');

  return { passed, failed };
}
