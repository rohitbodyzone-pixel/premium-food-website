import crypto from 'crypto';
import { prisma } from '../db/prisma';
import { getEmailProvider } from './email/email-provider.factory';

export class EmailVerificationService {
  private static readonly TOKEN_EXPIRY_HOURS = 24;
  private static readonly RESEND_COOLDOWN_SECONDS = 60;

  /**
   * Creates a single-use crypto-random verification token, stores its SHA-256 hash,
   * sends verification email via provider, and returns metadata.
   */
  async createAndSendVerificationToken(userId: string): Promise<{
    rawToken: string;
    expiresAt: Date;
    devLink?: string;
  }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.email) {
      throw new Error('User does not have an email address associated with their account.');
    }

    const now = new Date();
    // Rate limit check: 60-second cooldown
    if (user.lastVerificationEmailSentAt) {
      const elapsed = Math.floor((now.getTime() - user.lastVerificationEmailSentAt.getTime()) / 1000);
      if (elapsed < EmailVerificationService.RESEND_COOLDOWN_SECONDS) {
        const wait = EmailVerificationService.RESEND_COOLDOWN_SECONDS - elapsed;
        throw new Error(`Please wait ${wait} seconds before requesting another verification email.`);
      }
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(now.getTime() + EmailVerificationService.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Invalidate any previous token and save new token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationTokenHash: tokenHash,
        verificationExpiresAt: expiresAt,
        lastVerificationEmailSentAt: now,
      },
    });

    const baseUrl = user.role === 'EXPERT'
      ? (process.env.APP_EXPERT_URL || 'http://localhost:5174')
      : (process.env.APP_CUSTOMER_URL || 'http://localhost:5173');

    const path = user.role === 'EXPERT' ? '/login?mode=verify-email' : '/auth?mode=verify-email';
    const verificationLink = `${baseUrl}${path}&token=${rawToken}&email=${encodeURIComponent(user.email)}`;

    const emailProvider = getEmailProvider();
    await emailProvider.sendEmailVerification({
      to: user.email,
      name: user.name,
      verificationLink,
    });

    // Record delivery log
    await prisma.notificationLog.create({
      data: {
        userId: user.id,
        type: 'EMAIL_VERIFICATION',
        channel: 'EMAIL',
        status: emailProvider.isDevelopment ? 'SENT_CONSOLE' : 'DELIVERED',
        provider: emailProvider.name,
      },
    }).catch(() => {});

    return {
      rawToken,
      expiresAt,
      devLink: emailProvider.isDevelopment ? verificationLink : undefined,
    };
  }

  /**
   * Alias for createAndSendVerificationToken
   */
  async createVerificationToken(userId: string) {
    return this.createAndSendVerificationToken(userId);
  }

  /**
   * Validates verification token and saves emailVerifiedAt.
   * Single-use: clears verificationTokenHash.
   */
  async verifyEmailToken(rawToken: string): Promise<{ success: boolean; message: string }> {
    if (!rawToken || !rawToken.trim()) {
      return { success: false, message: 'Missing verification token.' };
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        verificationTokenHash: tokenHash,
        verificationExpiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return { success: false, message: 'Verification link is invalid or has expired. Please request a new link.' };
    }

    // Invalidate token immediately and mark verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        verificationTokenHash: null,
        verificationExpiresAt: null,
      },
    });

    return { success: true, message: 'Email verified successfully! Your account is now confirmed.' };
  }
}

export const emailVerificationService = new EmailVerificationService();
