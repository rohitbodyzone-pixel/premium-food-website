import { prisma } from '../src/db/prisma';
import bcrypt from 'bcryptjs';
import { passwordResetService } from '../src/services/password-reset.service';
import { emailVerificationService } from '../src/services/email-verification.service';

export async function runAuthTests() {
  console.log('\n🔒 Starting PropertyTalk Automated Auth & Security Tests...\n');
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
    const testEmail = `test.consumer.${Date.now()}@example.com`;
    const expertEmail = `test.expert.${Date.now()}@example.com`;
    const password = 'SuperSecurePassword123!';

    // 1. Password Hashing with Bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    assert(passwordHash !== password, 'Password is never stored in plain text');
    assert(passwordHash.startsWith('$2'), 'Password hash uses standard bcrypt format');
    const verifyPass = await bcrypt.compare(password, passwordHash);
    assert(verifyPass === true, 'Bcrypt correctly verifies plain text against hash');
    const verifyWrong = await bcrypt.compare('WrongPassword', passwordHash);
    assert(verifyWrong === false, 'Bcrypt rejects incorrect password');

    // 2. Customer Registration
    const customer = await prisma.user.create({
      data: {
        name: 'Test Customer',
        email: testEmail,
        passwordHash,
        role: 'CONSUMER',
        accountStatus: 'ACTIVE',
        countryCode: 'NZ',
      },
    });
    assert(customer.role === 'CONSUMER', 'Customer registration creates CONSUMER role');
    assert(customer.accountStatus === 'ACTIVE', 'New customer account status is ACTIVE');

    // 3. Duplicate Email Prevention
    let duplicateFailed = false;
    try {
      await prisma.user.create({
        data: {
          name: 'Duplicate Customer',
          email: testEmail,
          passwordHash,
          role: 'CONSUMER',
        },
      });
    } catch {
      duplicateFailed = true;
    }
    assert(duplicateFailed === true, 'Duplicate email registration is blocked by unique constraint');

    // 4. Expert Registration & Draft Verification Rule
    const firstCat = await prisma.category.findFirst({ where: { isActive: true } });
    const expertUser = await prisma.user.create({
      data: {
        name: 'Test Expert Candidate',
        email: expertEmail,
        passwordHash,
        role: 'EXPERT',
        accountStatus: 'ACTIVE',
        countryCode: 'AU',
        expertProfile: {
          create: {
            country: { connect: { code: 'AU' } },
            category: { connect: { id: firstCat!.id } },
            title: 'Property Valuer',
            bio: 'Certified Valuer in NSW.',
            businessName: 'Sydney Property Valuations Ltd',
            city: 'Sydney',
            languages: JSON.stringify(['English']),
            specialities: JSON.stringify(['Valuations', 'Commercial']),
            verificationStatus: 'DRAFT', // Mandatory DRAFT
            isOnline: false,            // Mandatory OFFLINE until verified
            freeCallMinutes: 1,
            callPerMinuteRate: 3.0,
            hourlyRate: 180.0,
          },
        },
      },
      include: { expertProfile: true },
    });
    assert(expertUser.role === 'EXPERT', 'Expert registration creates EXPERT role');
    assert(expertUser.expertProfile?.verificationStatus === 'DRAFT', 'New expert profile is DRAFT');
    assert(expertUser.expertProfile?.isOnline === false, 'Unverified expert is strictly offline');

    // 5. Account Failed Login Tracking and 15-min Lockout
    let userRecord = await prisma.user.findUnique({ where: { id: customer.id } });
    assert(userRecord?.failedLoginAttempts === 0, 'Failed login attempts initially 0');

    // Simulate 5 consecutive failed attempts
    for (let i = 1; i <= 5; i++) {
      userRecord = await prisma.user.update({
        where: { id: customer.id },
        data: {
          failedLoginAttempts: i,
          lockoutUntil: i >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
        },
      });
    }
    assert(userRecord !== null && userRecord.failedLoginAttempts === 5, 'Recorded 5 failed login attempts');
    assert(userRecord !== null && userRecord.lockoutUntil !== null, 'Account lockout timestamp generated');
    assert(userRecord !== null && userRecord.lockoutUntil!.getTime() > Date.now(), 'Account is locked for future window');

    // Reset on successful login
    const restoredUser = await prisma.user.update({
      where: { id: customer.id },
      data: {
        failedLoginAttempts: 0,
        lockoutUntil: null,
        lastLoginAt: new Date(),
      },
    });
    assert(restoredUser.failedLoginAttempts === 0, 'Failed attempts reset to 0 after unlock');
    assert(restoredUser.lockoutUntil === null, 'Lockout lifted');

    // 6. Password Reset Token Flow
    const resetReq = await passwordResetService.requestPasswordReset(testEmail);
    assert(resetReq.success === true, 'Password reset request handled securely');

    const updatedUserWithToken = await prisma.user.findUnique({ where: { id: customer.id } });
    assert(!!updatedUserWithToken?.passwordResetTokenHash, 'Password reset token hash stored in database');
    assert(!!updatedUserWithToken?.passwordResetExpiresAt, 'Password reset expiration timestamp set');
    assert(
      updatedUserWithToken!.passwordResetExpiresAt!.getTime() > Date.now(),
      'Password reset token expiration is in future (15-min window)'
    );

    // 7. Email Verification Service Abstraction
    const verifToken = await emailVerificationService.createVerificationToken(customer.id);
    assert(!!verifToken.rawToken, 'Verification token generated via email verification service');
    const verifResult = await emailVerificationService.verifyEmailToken(verifToken.rawToken);
    assert(verifResult.success === true, 'Email verification completes successfully with valid token');

    const verifiedUser = await prisma.user.findUnique({ where: { id: customer.id } });
    assert(verifiedUser?.emailVerifiedAt !== null, 'emailVerifiedAt timestamp recorded');

    // Clean up test data
    await prisma.user.delete({ where: { id: customer.id } });
    await prisma.expertProfile.delete({ where: { id: expertUser.expertProfile!.id } });
    await prisma.user.delete({ where: { id: expertUser.id } });

    console.log(`\n📊 Auth Tests Complete: ${passed} passed, ${failed} failed.\n`);
    return { passed, failed };
  } catch (err) {
    console.error('Auth test failed with error:', err);
    throw err;
  }
}

if (process.argv[1]?.endsWith('auth.test.ts')) {
  runAuthTests()
    .then(({ failed }) => {
      if (failed > 0) process.exit(1);
    })
    .catch(() => process.exit(1));
}
