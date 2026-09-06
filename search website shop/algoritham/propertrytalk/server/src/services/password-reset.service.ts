import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma';
import { getEmailProvider } from './email/email-provider.factory';

export interface RequestResetResult {
  success: boolean;
  message: string;
  rawToken?: string;
  devResetUrl?: string; // Only populated in non-production environments
}

export class PasswordResetService {
  private static readonly RESET_EXPIRY_MINUTES = 15;
  private static readonly COOLDOWN_SECONDS = 60;

  /**
   * Generates a secure, short-lived password reset token, stores its SHA-256 hash in DB,
   * sends email via provider, and returns a privacy-safe response.
   */
  async requestPasswordReset(email: string, portalOverride?: string): Promise<RequestResetResult> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Always return privacy-safe response to prevent user enumeration
    const safeResponse: RequestResetResult = {
      success: true,
      message: 'If an account exists with this email address, password reset instructions have been dispatched.',
    };

    if (!user || !user.email) {
      return safeResponse;
    }

    // Rate limiting: 60-second cooldown per account
    const now = new Date();
    if (user.lastPasswordResetRequestedAt) {
      const elapsedSeconds = Math.floor((now.getTime() - user.lastPasswordResetRequestedAt.getTime()) / 1000);
      if (elapsedSeconds < PasswordResetService.COOLDOWN_SECONDS) {
        // Return safe message without generating a new token to prevent spam
        return safeResponse;
      }
    }

    // 32-byte crypto-random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(now.getTime() + PasswordResetService.RESET_EXPIRY_MINUTES * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: expiresAt,
        lastPasswordResetRequestedAt: now,
      },
    });

    // Determine correct portal entry URL based on user role or override
    let baseUrl = 'http://localhost:5173';
    let portalName = 'Customer Portal';

    if (portalOverride) {
      baseUrl = portalOverride;
      if (baseUrl.includes('5175')) portalName = 'Super Admin';
      else if (baseUrl.includes('5174')) portalName = 'Expert Portal';
    } else if (user.role === 'SUPER_ADMIN') {
      baseUrl = process.env.APP_ADMIN_URL || 'http://localhost:5175';
      portalName = 'Super Admin';
    } else if (user.role === 'EXPERT') {
      baseUrl = process.env.APP_EXPERT_URL || 'http://localhost:5174';
      portalName = 'Expert Portal';
    } else {
      baseUrl = process.env.APP_CUSTOMER_URL || 'http://localhost:5173';
      portalName = 'Customer Portal';
    }

    const resetPath = user.role === 'CONSUMER' ? '/auth?mode=reset-password' : '/login?mode=reset-password';
    const resetLink = `${baseUrl}${resetPath}&token=${rawToken}&email=${encodeURIComponent(user.email)}`;

    const emailProvider = getEmailProvider();
    await emailProvider.sendPasswordReset({
      to: user.email,
      name: user.name,
      resetLink,
      portalName,
    });

    // Record delivery log
    await prisma.notificationLog.create({
      data: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        channel: 'EMAIL',
        status: emailProvider.isDevelopment ? 'SENT_CONSOLE' : 'DELIVERED',
        provider: emailProvider.name,
      },
    }).catch(() => {});

    return {
      ...safeResponse,
      rawToken: emailProvider.isDevelopment ? rawToken : undefined,
      devResetUrl: emailProvider.isDevelopment ? resetLink : undefined,
    };
  }

  /**
   * Validates a password reset token and securely updates the user's password.
   * Single-use: invalidates token immediately.
   */
  async resetPassword(rawToken: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    if (!rawToken || !newPassword || newPassword.length < 6) {
      return { success: false, message: 'Invalid token or password does not meet requirements (minimum 6 characters).' };
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return {
        success: false,
        message: 'Password reset link is invalid or has expired. Please request a new link.',
      };
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Invalidate token immediately upon use (single-use guarantee)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        failedLoginAttempts: 0,
        lockoutUntil: null,
      },
    });

    return {
      success: true,
      message: 'Your password has been successfully reset. You may now sign in with your new credentials.',
    };
  }
}

export const passwordResetService = new PasswordResetService();
