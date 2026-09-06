import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma';
import { requireAuth } from '../middleware/auth.middleware';
import { loginRateLimiter } from '../middleware/rate-limiter.middleware';
import { phoneService, PhoneService, normalizePhoneNumber, maskPhoneNumber } from '../services/phone.service';
import { getSmsProvider } from '../services/sms/sms-provider.factory';
import { getEmailProvider } from '../services/email/email-provider.factory';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'propertytalk_super_secret_jwt_key_2026';
const IS_PROD = process.env.NODE_ENV === 'production';

function setAuthCookie(res: Response, token: string) {
  res.cookie('pt_token', token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

// 1. Send OTP (Supports SIGNUP, LOGIN, PHONE_CHANGE)
router.post('/send-otp', loginRateLimiter, async (req: Request, res: Response) => {
  try {
    const { phoneNumber, countryCode, reason = 'LOGIN' } = req.body;

    if (!phoneNumber) {
      res.status(400).json({ error: 'Phone number is required.' });
      return;
    }

    const norm = normalizePhoneNumber(phoneNumber, countryCode || 'NZ');
    if (!norm.isValid || !norm.e164) {
      res.status(400).json({ error: norm.error || 'Invalid phone number format.' });
      return;
    }

    const e164 = norm.e164;

    // Reason-specific validations
    if (reason === 'SIGNUP') {
      const existing = await prisma.user.findFirst({
        where: {
          OR: [{ phoneNumber: e164 }, { phone: e164 }],
        },
      });

      if (existing) {
        res.status(409).json({
          error: 'An account with this phone number already exists. Please sign in instead.',
          code: 'PHONE_ALREADY_EXISTS',
        });
        return;
      }
    } else if (reason === 'LOGIN') {
      const existing = await prisma.user.findFirst({
        where: {
          OR: [{ phoneNumber: e164 }, { phone: e164 }],
        },
      });

      if (!existing) {
        res.status(404).json({
          error: 'No registered account found with this phone number. Please create an account.',
          code: 'PHONE_NOT_FOUND',
        });
        return;
      }

      if (existing.accountStatus === 'SUSPENDED') {
        res.status(403).json({ error: 'Account suspended. Please contact customer support.' });
        return;
      }

      // Prohibit Admin phone login by default policy
      if (existing.role === 'SUPER_ADMIN') {
        res.status(403).json({
          error: 'Super Admin phone login is disabled by security policy. Please use your administrative email and password.',
          code: 'ADMIN_PHONE_LOGIN_DISABLED',
        });
        return;
      }
    }

    const result = await phoneService.requestPhoneOtp({
      phoneNumber: e164,
      countryCode: norm.country,
      reason,
    });

    res.json(result);
  } catch (err: any) {
    console.error('Phone send-otp error:', err);
    res.status(400).json({ error: err.message || 'Failed to dispatch phone verification code.' });
  }
});

// 2. Verify Signup (Creates Account with Verified Phone)
router.post('/verify-signup', loginRateLimiter, async (req: Request, res: Response) => {
  try {
    const {
      name,
      phoneNumber,
      countryCode,
      otp,
      role = 'CONSUMER',
      expertDetails,
    } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Full name is required.' });
      return;
    }

    if (!phoneNumber || !otp) {
      res.status(400).json({ error: 'Phone number and 6-digit OTP code are required.' });
      return;
    }

    const norm = normalizePhoneNumber(phoneNumber, countryCode || 'NZ');
    if (!norm.isValid || !norm.e164) {
      res.status(400).json({ error: norm.error || 'Invalid phone number format.' });
      return;
    }

    const e164 = norm.e164;

    // Verify OTP
    const verification = await phoneService.verifyPhoneOtp({
      phoneNumber: e164,
      countryCode: norm.country,
      otp,
      reason: 'SIGNUP',
    });

    if (!verification.success) {
      res.status(400).json({ error: verification.message });
      return;
    }

    // Duplicate check guard
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ phoneNumber: e164 }, { phone: e164 }],
      },
    });

    if (existing) {
      res.status(409).json({ error: 'An account with this phone number already exists.' });
      return;
    }

    const userRole = role === 'EXPERT' ? 'EXPERT' : 'CONSUMER';
    const chosenCountry = norm.country || countryCode || 'NZ';

    // Create User
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        phoneNumber: e164,
        phone: norm.nationalFormat || e164,
        phoneCountryCode: chosenCountry,
        phoneVerifiedAt: new Date(),
        role: userRole,
        countryCode: chosenCountry,
        accountStatus: 'ACTIVE',
        lastLoginAt: new Date(),
      },
    });

    let expertProfile = null;
    let redirectTo = '/';

    // If Expert signup: create DRAFT ExpertProfile (unverified professionally)
    if (userRole === 'EXPERT') {
      let categoryId = expertDetails?.categoryId;
      if (!categoryId) {
        const firstCategory = await prisma.category.findFirst({ where: { isActive: true } });
        categoryId = firstCategory?.id;
      }

      expertProfile = await prisma.expertProfile.create({
        data: {
          userId: user.id,
          countryCode: chosenCountry,
          categoryId: categoryId || '',
          title: expertDetails?.title?.trim() || 'Property Professional',
          bio: expertDetails?.bio?.trim() || 'Professional property consultant providing expert advisory services.',
          businessName: expertDetails?.businessName?.trim() || `${name.trim()} Property Services`,
          city: chosenCountry === 'AU' ? 'Sydney' : 'Auckland',
          yearsOfExperience: 3,
          languages: JSON.stringify(['English']),
          specialities: JSON.stringify(['Property Consultation']),
          photoUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=256',
          verificationStatus: 'DRAFT', // Unverified! Expert CANNOT go online
          isOnline: false,            // Strictly offline until Super Admin verification
          freeCallMinutes: 1,
          callPerMinuteRate: 2.5,
          hourlyRate: 150.0,
        },
      });

      redirectTo = '/expert/onboarding';
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email || null,
        phoneNumber: user.phoneNumber,
        role: user.role,
        name: user.name,
        expertProfileId: expertProfile?.id,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    setAuthCookie(res, token);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        phoneNumber: user.phoneNumber,
        phoneVerifiedAt: user.phoneVerifiedAt,
        role: user.role,
        countryCode: user.countryCode,
        expertProfile,
      },
      redirectTo,
    });
  } catch (err: any) {
    console.error('Phone verify-signup error:', err);
    res.status(500).json({ error: 'Failed to complete phone registration.' });
  }
});

// 3. Phone OTP Login
router.post('/login', loginRateLimiter, async (req: Request, res: Response) => {
  try {
    const { phoneNumber, countryCode, otp, targetPortal } = req.body;

    if (!phoneNumber || !otp) {
      res.status(400).json({ error: 'Phone number and 6-digit OTP code are required.' });
      return;
    }

    const norm = normalizePhoneNumber(phoneNumber, countryCode || 'NZ');
    if (!norm.isValid || !norm.e164) {
      res.status(400).json({ error: norm.error || 'Invalid phone number format.' });
      return;
    }

    const e164 = norm.e164;

    // Verify OTP
    const verification = await phoneService.verifyPhoneOtp({
      phoneNumber: e164,
      countryCode: norm.country,
      otp,
      reason: 'LOGIN',
    });

    if (!verification.success) {
      res.status(400).json({ error: verification.message });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ phoneNumber: e164 }, { phone: e164 }],
      },
      include: { expertProfile: true },
    });

    if (!user) {
      res.status(404).json({ error: 'Account not found with this phone number.' });
      return;
    }

    if (user.accountStatus === 'SUSPENDED') {
      res.status(403).json({ error: 'Account suspended. Please contact customer support.' });
      return;
    }

    // Role Protection
    if (user.role === 'SUPER_ADMIN') {
      res.status(403).json({
        error: 'Admin phone login is disabled by security policy. Please use admin email/password login.',
      });
      return;
    }

    if (targetPortal === 'expert' && user.role !== 'EXPERT') {
      res.status(403).json({
        error: 'Access denied: This portal is reserved for registered property professionals. Please sign in via the Customer portal.',
      });
      return;
    }

    // Update lastLoginAt and ensure phoneVerifiedAt is set
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        phoneVerifiedAt: user.phoneVerifiedAt || new Date(),
        phoneNumber: user.phoneNumber || e164,
      },
    });

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email || null,
        phoneNumber: user.phoneNumber || e164,
        role: user.role,
        name: user.name,
        expertProfileId: user.expertProfile?.id,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    setAuthCookie(res, token);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || e164,
        phoneNumber: user.phoneNumber || e164,
        phoneVerifiedAt: user.phoneVerifiedAt || new Date(),
        role: user.role,
        countryCode: user.countryCode,
        expertProfile: user.expertProfile,
      },
    });
  } catch (err: any) {
    console.error('Phone login error:', err);
    res.status(500).json({ error: 'Failed to authenticate via phone.' });
  }
});

// 4. Request Phone Add / Change (Authenticated)
router.post('/change-request', requireAuth, async (req: Request, res: Response) => {
  try {
    const { newPhoneNumber, countryCode } = req.body;
    const userId = req.user!.id;

    if (!newPhoneNumber) {
      res.status(400).json({ error: 'New phone number is required.' });
      return;
    }

    const norm = normalizePhoneNumber(newPhoneNumber, countryCode || 'NZ');
    if (!norm.isValid || !norm.e164) {
      res.status(400).json({ error: norm.error || 'Invalid phone number format.' });
      return;
    }

    const e164 = norm.e164;

    // Duplicate check: ensure no other user holds this phone number
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ phoneNumber: e164 }, { phone: e164 }],
        NOT: { id: userId },
      },
    });

    if (existing) {
      res.status(409).json({
        error: 'This phone number is already registered to another account. Please provide a different number.',
      });
      return;
    }

    const result = await phoneService.requestPhoneOtp({
      phoneNumber: e164,
      countryCode: norm.country,
      reason: 'PHONE_CHANGE',
      userId,
      userName: req.user!.name,
    });

    res.json(result);
  } catch (err: any) {
    console.error('Phone change request error:', err);
    res.status(400).json({ error: err.message || 'Failed to request phone change verification.' });
  }
});

// 5. Verify Phone Add / Change (Authenticated)
router.post('/change-verify', requireAuth, async (req: Request, res: Response) => {
  try {
    const { newPhoneNumber, countryCode, otp } = req.body;
    const userId = req.user!.id;

    if (!newPhoneNumber || !otp) {
      res.status(400).json({ error: 'New phone number and 6-digit OTP code are required.' });
      return;
    }

    const norm = normalizePhoneNumber(newPhoneNumber, countryCode || 'NZ');
    if (!norm.isValid || !norm.e164) {
      res.status(400).json({ error: norm.error || 'Invalid phone number format.' });
      return;
    }

    const e164 = norm.e164;

    // Verify OTP
    const verification = await phoneService.verifyPhoneOtp({
      phoneNumber: e164,
      countryCode: norm.country,
      otp,
      reason: 'PHONE_CHANGE',
      userId,
    });

    if (!verification.success) {
      res.status(400).json({ error: verification.message });
      return;
    }

    // Ensure no other user registered it concurrently
    const duplicate = await prisma.user.findFirst({
      where: {
        OR: [{ phoneNumber: e164 }, { phone: e164 }],
        NOT: { id: userId },
      },
    });

    if (duplicate) {
      res.status(409).json({ error: 'This phone number is already in use by another user.' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        phoneNumber: e164,
        phone: norm.nationalFormat || e164,
        phoneCountryCode: norm.country || countryCode || 'NZ',
        phoneVerifiedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        phoneNumber: true,
        phoneCountryCode: true,
        phoneVerifiedAt: true,
        role: true,
      },
    });

    // Send security alert email if user has email
    if (updatedUser.email) {
      const emailProvider = getEmailProvider();
      await emailProvider.sendSecurityAlert({
        to: updatedUser.email,
        name: updatedUser.name,
        subject: 'Security Alert: Phone Number Updated on PropertyTalk',
        bodyText: `Hello ${updatedUser.name},\n\nYour PropertyTalk account phone number was successfully updated to ${maskPhoneNumber(e164)}.\n\nIf you did not perform this change, please contact support immediately.`,
      }).catch(() => {});
    }

    // Also send confirmation SMS to the new verified number
    const smsProvider = getSmsProvider();
    await smsProvider.sendSecurityAlert({
      to: e164,
      message: `PropertyTalk Security Notice: Your mobile number has been successfully verified on your account.`,
    }).catch(() => {});

    res.json({
      success: true,
      message: `Phone number successfully updated and verified as ${maskPhoneNumber(e164)}.`,
      user: updatedUser,
    });
  } catch (err: any) {
    console.error('Phone change verify error:', err);
    res.status(500).json({ error: 'Failed to update phone number.' });
  }
});

// 6. Public/Admin Phone Auth Configuration & Status
router.get('/config', (req: Request, res: Response) => {
  const smsProvider = getSmsProvider();
  res.json({
    phoneAuthEnabled: true,
    customerPhoneSignup: true,
    expertPhoneSignup: true,
    phoneOtpLogin: true,
    adminPhoneLoginEnabled: false, // Strict policy: disabled
    otpLength: PhoneService.OTP_LENGTH,
    expiryMinutes: PhoneService.DEFAULT_EXPIRY_MINUTES,
    cooldownSeconds: PhoneService.RESEND_COOLDOWN_SECONDS,
    maxAttempts: PhoneService.MAX_ATTEMPTS,
    smsProvider: {
      name: smsProvider.name,
      isDevelopment: smsProvider.isDevelopment,
    },
  });
});

export default router;
