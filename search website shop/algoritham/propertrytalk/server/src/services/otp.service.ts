import crypto from 'crypto';
import { prisma } from '../db/prisma';
import { getEmailProvider } from './email/email-provider.factory';

export class OtpService {
  private static readonly OTP_LENGTH = 6;
  private static readonly DEFAULT_EXPIRY_MINUTES = 10;
  private static readonly MAX_ATTEMPTS = 3;
  private static readonly RESEND_COOLDOWN_SECONDS = 60;

  /**
   * Generates a 6-digit cryptographically secure numerical OTP.
   */
  generateNumericOtp(): string {
    const randomBytes = crypto.randomBytes(4);
    const num = randomBytes.readUInt32BE(0) % 1000000;
    return num.toString().padStart(OtpService.OTP_LENGTH, '0');
  }

  /**
   * Hashes the raw OTP string using SHA-256.
   */
  hashOtp(rawOtp: string): string {
    return crypto.createHash('sha256').update(rawOtp).digest('hex');
  }

  /**
   * Creates and dispatches an OTP to the user's email with rate limiting and expiry.
   */
  async requestOtp(userId: string, reason?: string): Promise<{
    success: boolean;
    message: string;
    expiresInMinutes: number;
    devOtpPreview?: string;
  }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    if (!user.email) {
      throw new Error('User does not have an email address associated with their account.');
    }

    // Cooldown check (60 seconds)
    const now = new Date();
    if (user.lastLoginOtpSentAt) {
      const secondsSinceLast = Math.floor((now.getTime() - user.lastLoginOtpSentAt.getTime()) / 1000);
      if (secondsSinceLast < OtpService.RESEND_COOLDOWN_SECONDS) {
        const remaining = OtpService.RESEND_COOLDOWN_SECONDS - secondsSinceLast;
        throw new Error(`Please wait ${remaining} seconds before requesting a new code.`);
      }
    }

    const rawOtp = this.generateNumericOtp();
    const otpHash = this.hashOtp(rawOtp);
    const expiresAt = new Date(now.getTime() + OtpService.DEFAULT_EXPIRY_MINUTES * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginOtpHash: otpHash,
        loginOtpExpiresAt: expiresAt,
        loginOtpAttempts: 0,
        lastLoginOtpSentAt: now,
      },
    });

    const emailProvider = getEmailProvider();
    await emailProvider.sendLoginOtp({
      to: user.email,
      name: user.name,
      otp: rawOtp,
      expiresMinutes: OtpService.DEFAULT_EXPIRY_MINUTES,
    });

    // Record privacy-safe delivery log
    await prisma.notificationLog.create({
      data: {
        userId: user.id,
        type: 'LOGIN_OTP',
        channel: 'EMAIL',
        status: emailProvider.isDevelopment ? 'SENT_CONSOLE' : 'DELIVERED',
        provider: emailProvider.name,
      },
    }).catch(() => {});

    return {
      success: true,
      message: `A verification code has been dispatched to ${user.email}`,
      expiresInMinutes: OtpService.DEFAULT_EXPIRY_MINUTES,
      devOtpPreview: emailProvider.isDevelopment ? rawOtp : undefined,
    };
  }

  /**
   * Generates and dispatches OTP, returning rawOtp for tests/dev inspection.
   */
  async generateOtp(userId: string, reason?: string): Promise<{
    success: boolean;
    rawOtp: string;
    expiresInMinutes: number;
  }> {
    const res = await this.requestOtp(userId, reason);
    return {
      success: res.success,
      rawOtp: res.devOtpPreview || '',
      expiresInMinutes: res.expiresInMinutes,
    };
  }

  /**
   * Verifies the provided 6-digit OTP against the stored SHA-256 hash.
   * Single-use: automatically invalidates upon successful verification.
   * Enforces max 3 attempts limit.
   */
  async verifyOtp(userId: string, submittedOtp: string): Promise<{
    success: boolean;
    message: string;
    remainingAttempts?: number;
  }> {
    if (!submittedOtp || submittedOtp.trim().length !== OtpService.OTP_LENGTH) {
      return { success: false, message: 'Verification code must be 6 digits.' };
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.loginOtpHash || !user.loginOtpExpiresAt) {
      return { success: false, message: 'No active verification code found. Please request a new code.' };
    }

    const now = new Date();
    if (now > user.loginOtpExpiresAt) {
      // Clear expired OTP
      await prisma.user.update({
        where: { id: user.id },
        data: { loginOtpHash: null, loginOtpExpiresAt: null, loginOtpAttempts: 0 },
      });
      return { success: false, message: 'Verification code has expired. Please request a new code.' };
    }

    if (user.loginOtpAttempts >= OtpService.MAX_ATTEMPTS) {
      // Invalidate after max attempts
      await prisma.user.update({
        where: { id: user.id },
        data: { loginOtpHash: null, loginOtpExpiresAt: null, loginOtpAttempts: 0 },
      });
      return { success: false, message: 'Maximum attempts exceeded. This code has been invalidated. Please request a new code.' };
    }

    const submittedHash = this.hashOtp(submittedOtp.trim());
    if (submittedHash !== user.loginOtpHash) {
      const nextAttempts = user.loginOtpAttempts + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: { loginOtpAttempts: nextAttempts },
      });
      const attemptsLeft = OtpService.MAX_ATTEMPTS - nextAttempts;
      return {
        success: false,
        message: attemptsLeft > 0
          ? `Invalid code. ${attemptsLeft} attempt(s) remaining.`
          : 'Invalid code. Maximum attempts reached. Code has been invalidated.',
        remainingAttempts: attemptsLeft,
      };
    }

    // Success! Single-use: clear OTP from database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginOtpHash: null,
        loginOtpExpiresAt: null,
        loginOtpAttempts: 0,
      },
    });

    return {
      success: true,
      message: 'Code verified successfully.',
    };
  }
}

export const otpService = new OtpService();
