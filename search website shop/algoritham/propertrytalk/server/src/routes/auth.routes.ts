import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma';
import { requireAuth } from '../middleware/auth.middleware';
import { loginRateLimiter, passwordResetRateLimiter } from '../middleware/rate-limiter.middleware';
import { passwordResetService } from '../services/password-reset.service';
import { emailVerificationService } from '../services/email-verification.service';
import { otpService } from '../services/otp.service';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'propertytalk_super_secret_jwt_key_2026';
const IS_PROD = process.env.NODE_ENV === 'production';

// Helper to set secure auth cookie
function setAuthCookie(res: Response, token: string) {
  res.cookie('pt_token', token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

// Helper to clear auth cookie
function clearAuthCookie(res: Response) {
  res.clearCookie('pt_token', {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'strict' : 'lax',
    path: '/',
  });
}

// 1. Customer Signup (Minimal: Name, Email/phone, Password)
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone, countryCode } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        phone: phone ? phone.trim() : null,
        countryCode: countryCode || 'NZ',
        role: 'CONSUMER', // Customer signup creates CONSUMER role only
        accountStatus: 'ACTIVE',
        lastLoginAt: new Date(),
      },
    });

    // Generate verification token and dispatch email in background
    await emailVerificationService.createAndSendVerificationToken(user.id).catch(() => {});

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
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
        role: user.role,
        countryCode: user.countryCode,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create user account' });
  }
});

// 2. Expert Signup ("Join as a Property Professional")
router.post('/register-expert', async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone, countryCode = 'NZ', categoryId, title, businessName } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    // Default to first active category if not specified
    let targetCategoryId = categoryId;
    if (!targetCategoryId) {
      const firstCat = await prisma.category.findFirst({ where: { isActive: true } });
      targetCategoryId = firstCat?.id;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        phone: phone ? phone.trim() : null,
        countryCode: countryCode || 'NZ',
        role: 'EXPERT',
        accountStatus: 'ACTIVE',
        lastLoginAt: new Date(),
        expertProfile: {
          create: {
            country: { connect: { code: countryCode || 'NZ' } },
            category: { connect: { id: targetCategoryId } },
            title: title || 'Property Professional',
            bio: 'Registered property expert on PropertyTalk.',
            businessName: businessName || `${name.trim()} Property Services`,
            city: countryCode === 'AU' ? 'Sydney' : 'Auckland',
            languages: JSON.stringify(['English']),
            specialities: JSON.stringify(['Consultation']),
            verificationStatus: 'DRAFT', // Unverified! Must complete onboarding & admin review
            isOnline: false,            // Unverified expert CANNOT go online
            freeCallMinutes: 1,
            callPerMinuteRate: 2.5,
            hourlyRate: 150.0,
          },
        },
      },
      include: { expertProfile: true },
    });

    // Generate verification token and dispatch email in background
    await emailVerificationService.createAndSendVerificationToken(user.id).catch(() => {});

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        expertProfileId: user.expertProfile?.id,
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
        role: user.role,
        countryCode: user.countryCode,
        expertProfile: user.expertProfile,
      },
      redirectTo: '/expert/onboarding',
    });
  } catch (error: any) {
    console.error('Expert registration error:', error);
    res.status(500).json({ error: 'Failed to create expert account' });
  }
});

// 3. Login (with Rate Limiting, Failed Attempt Tracking & Lockout)
router.post('/login', loginRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { expertProfile: true },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Check account status
    if (user.accountStatus === 'SUSPENDED') {
      res.status(403).json({ error: 'Account suspended. Please contact customer support.' });
      return;
    }

    // Check lockout
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const minsLeft = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / (60 * 1000));
      res.status(423).json({
        error: `Account is temporarily locked due to multiple failed login attempts. Try again in ${minsLeft} minutes.`,
      });
      return;
    }

    if (!user.passwordHash) {
      res.status(401).json({ error: 'This account was created via phone number without a password. Please log in with Phone OTP.' });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      const failedAttempts = user.failedLoginAttempts + 1;
      let lockoutUntil: Date | null = null;

      if (failedAttempts >= 5) {
        lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15-min lockout after 5 fails
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: failedAttempts,
          lockoutUntil,
        },
      });

      res.status(401).json({
        error: failedAttempts >= 5
          ? 'Account locked for 15 minutes due to 5 failed login attempts.'
          : 'Invalid email or password',
      });
      return;
    }

    // Reset failed attempts on success and update lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockoutUntil: null,
        lastLoginAt: new Date(),
      },
    });

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
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
        role: user.role,
        countryCode: user.countryCode,
        expertProfile: user.expertProfile,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// 4. Admin Login (Dedicated protected endpoint verifying SUPER_ADMIN role)
router.post('/admin/login', loginRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid admin credentials' });
      return;
    }

    if (user.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Access denied: Admin credentials required' });
      return;
    }

    if (!user.passwordHash) {
      res.status(401).json({ error: 'Invalid admin credentials' });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      res.status(401).json({ error: 'Invalid admin credentials' });
      return;
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    setAuthCookie(res, token);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Admin login failed' });
  }
});

// 5. Password Reset Request (Forgot Password)
router.post('/forgot-password', passwordResetRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, portal } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email address is required' });
      return;
    }

    const portalOverride = portal || (req.headers.origin as string);
    const result = await passwordResetService.requestPasswordReset(email, portalOverride);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// 6. Complete Password Reset
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400).json({ error: 'Token and new password are required' });
      return;
    }

    const result = await passwordResetService.resetPassword(token, newPassword);
    if (!result.success) {
      res.status(400).json({ error: result.message });
      return;
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// 7. Verify Email Token
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const result = await emailVerificationService.verifyEmailToken(token);
    if (!result.success) {
      res.status(400).json({ error: result.message });
      return;
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

// 7b. Resend Verification Email
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email address is required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      // Privacy-safe response: don't reveal user existence
      res.json({ success: true, message: 'If an account exists, verification instructions have been dispatched.' });
      return;
    }

    if (user.emailVerifiedAt) {
      res.status(400).json({ error: 'This email is already verified.' });
      return;
    }

    const result = await emailVerificationService.createAndSendVerificationToken(user.id);
    res.json({
      success: true,
      message: 'Verification email has been resent.',
      devLink: result.devLink,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to resend verification email' });
  }
});

// 7c. Request Sensitive Action / Login OTP
router.post('/otp/request', async (req: Request, res: Response) => {
  try {
    const { email, reason } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email address is required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      // Privacy-safe
      res.json({ success: true, message: 'If an account exists, a 6-digit verification code has been dispatched.' });
      return;
    }

    const result = await otpService.requestOtp(user.id, reason);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to request verification code' });
  }
});

// 7d. Verify OTP
router.post('/otp/verify', async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      res.status(400).json({ error: 'Email and OTP code are required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { expertProfile: true },
    });

    if (!user) {
      res.status(400).json({ error: 'Invalid verification request' });
      return;
    }

    const result = await otpService.verifyOtp(user.id, otp);
    if (!result.success) {
      res.status(400).json({ error: result.message });
      return;
    }

    // Generate token if user is logging in via OTP
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        expertProfileId: user.expertProfile?.id,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    setAuthCookie(res, token);

    res.json({
      success: true,
      message: result.message,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        countryCode: user.countryCode,
        expertProfile: user.expertProfile,
      },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to verify code' });
  }
});

// 8. Logout
router.post('/logout', (req: Request, res: Response) => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'Signed out successfully' });
});

// 9. Quick Demo Login Switcher (Strictly isolated to non-production environments)
router.post('/demo-login', async (req: Request, res: Response) => {
  if (IS_PROD) {
    res.status(403).json({ error: 'Demo role switcher is strictly disabled in production mode.' });
    return;
  }

  try {
    const { roleType } = req.body; // 'admin' | 'consumer' | 'expert_nz' | 'expert_au'
    let email = '';

    switch (roleType) {
      case 'admin':
        email = 'admin@propertytalk.com';
        break;
      case 'expert_nz':
        email = 'sarah.jenkins@propertytalk.co.nz';
        break;
      case 'expert_au':
        email = 'marcus.vance@propertytalk.com.au';
        break;
      case 'consumer':
      default:
        email = 'james.wilson@gmail.com';
        break;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { expertProfile: { include: { category: true } } },
    });

    if (!user) {
      res.status(404).json({ error: `Demo user for '${roleType}' not found in database. Seed may be required.` });
      return;
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
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
        role: user.role,
        countryCode: user.countryCode,
        expertProfile: user.expertProfile,
      },
    });
  } catch (error: any) {
    console.error('Demo login error:', error);
    res.status(500).json({ error: 'Failed to authenticate demo user' });
  }
});

// 10. Get Current Authenticated User & Session Restore
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        expertProfile: {
          include: { category: true, country: true },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      phoneNumber: user.phoneNumber,
      phoneCountryCode: user.phoneCountryCode,
      phoneVerifiedAt: user.phoneVerifiedAt,
      countryCode: user.countryCode,
      accountStatus: user.accountStatus,
      emailVerifiedAt: user.emailVerifiedAt,
      expertProfile: user.expertProfile,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
