import crypto from 'crypto';
import parsePhoneNumberFromString, { CountryCode } from 'libphonenumber-js';
import { prisma } from '../db/prisma';
import { getSmsProvider } from './sms/sms-provider.factory';

export interface NormalizedPhoneResult {
  isValid: boolean;
  e164?: string;
  country?: string;
  nationalFormat?: string;
  internationalFormat?: string;
  error?: string;
}

/**
 * Normalizes an international phone number to canonical E.164 using libphonenumber-js.
 */
export function normalizePhoneNumber(
  rawNumber: string,
  defaultCountry: string = 'NZ'
): NormalizedPhoneResult {
  if (!rawNumber || typeof rawNumber !== 'string' || !rawNumber.trim()) {
    return { isValid: false, error: 'Phone number is required.' };
  }

  const cleaned = rawNumber.trim();
  const countryUpper = (defaultCountry || 'NZ').toUpperCase() as CountryCode;

  try {
    const parsed = parsePhoneNumberFromString(cleaned, countryUpper);

    if (!parsed || !parsed.isValid()) {
      return {
        isValid: false,
        error: `Invalid phone number format for ${countryUpper}. Please enter a valid mobile number.`,
      };
    }

    return {
      isValid: true,
      e164: parsed.number, // e.g. +64211234567
      country: parsed.country, // e.g. NZ
      nationalFormat: parsed.formatNational(), // e.g. 021 123 4567
      internationalFormat: parsed.formatInternational(), // e.g. +64 21 123 4567
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: err.message || 'Failed to parse phone number.',
    };
  }
}

/**
 * Privacy-safe phone number masking:
 * Formats: "+64211234567" -> "+64 ••• ••• 4567"
 */
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone || typeof phone !== 'string') return '—';
  const cleaned = phone.trim();
  if (cleaned.length < 8) return cleaned;

  // Extract country prefix (e.g. +64, +61, +1, +44)
  const plusIdx = cleaned.indexOf('+');
  let prefix = '+64';
  let rest = cleaned;
  if (plusIdx === 0) {
    // If it starts with '+', keep the first 3 chars as prefix (or 2 for +1)
    if (cleaned.startsWith('+1')) {
      prefix = '+1';
      rest = cleaned.substring(2);
    } else {
      prefix = cleaned.substring(0, 3);
      rest = cleaned.substring(3);
    }
  }

  const last4 = rest.slice(-4);
  return `${prefix} ••• ••• ${last4}`;
}

export class PhoneService {
  public static readonly OTP_LENGTH = 6;
  public static readonly DEFAULT_EXPIRY_MINUTES = 10;
  public static readonly MAX_ATTEMPTS = 3;
  public static readonly RESEND_COOLDOWN_SECONDS = 60;

  /**
   * Generates a 6-digit cryptographically secure numerical OTP.
   */
  generateNumericOtp(): string {
    const randomBytes = crypto.randomBytes(4);
    const num = randomBytes.readUInt32BE(0) % 1000000;
    return num.toString().padStart(PhoneService.OTP_LENGTH, '0');
  }

  /**
   * Hashes the raw OTP string using SHA-256 (plaintext is never stored).
   */
  hashOtp(rawOtp: string): string {
    return crypto.createHash('sha256').update(rawOtp.trim()).digest('hex');
  }

  /**
   * Requests and dispatches a 6-digit phone OTP via SMS.
   * Enforces 60s cooldown, max attempts, and 10-minute expiry.
   */
  async requestPhoneOtp(params: {
    phoneNumber: string;
    countryCode?: string;
    reason: 'SIGNUP' | 'LOGIN' | 'PHONE_CHANGE';
    userId?: string;
    userName?: string;
  }): Promise<{
    success: boolean;
    message: string;
    expiresInMinutes: number;
    normalizedPhone: string;
    devOtpPreview?: string;
  }> {
    const norm = normalizePhoneNumber(params.phoneNumber, params.countryCode || 'NZ');
    if (!norm.isValid || !norm.e164) {
      throw new Error(norm.error || 'Invalid phone number format.');
    }

    const e164 = norm.e164;
    const now = new Date();

    // Check recent verification attempt for cooldown
    const existing = await prisma.phoneVerification.findFirst({
      where: {
        phoneNumber: e164,
        reason: params.reason,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      const secondsSinceLast = Math.floor((now.getTime() - existing.lastSentAt.getTime()) / 1000);
      if (secondsSinceLast < PhoneService.RESEND_COOLDOWN_SECONDS) {
        const waitSecs = PhoneService.RESEND_COOLDOWN_SECONDS - secondsSinceLast;
        throw new Error(`Please wait ${waitSecs} seconds before requesting a new code.`);
      }
    }

    const rawOtp = this.generateNumericOtp();
    const otpHash = this.hashOtp(rawOtp);
    const expiresAt = new Date(now.getTime() + PhoneService.DEFAULT_EXPIRY_MINUTES * 60 * 1000);

    // Save or update active verification in PhoneVerification table
    if (existing) {
      await prisma.phoneVerification.update({
        where: { id: existing.id },
        data: {
          otpHash,
          expiresAt,
          attempts: 0,
          verified: false,
          lastSentAt: now,
          userId: params.userId || existing.userId,
        },
      });
    } else {
      await prisma.phoneVerification.create({
        data: {
          phoneNumber: e164,
          otpHash,
          expiresAt,
          attempts: 0,
          verified: false,
          reason: params.reason,
          userId: params.userId,
        },
      });
    }

    // Dispatch SMS via configured SMS Provider
    const smsProvider = getSmsProvider();
    const sent = await smsProvider.sendOtp({
      to: e164,
      otp: rawOtp,
      expiresMinutes: PhoneService.DEFAULT_EXPIRY_MINUTES,
      countryCode: norm.country,
      name: params.userName,
    });

    // Record privacy-safe delivery audit log
    await prisma.notificationLog.create({
      data: {
        userId: params.userId || null,
        type: `PHONE_OTP_${params.reason}`,
        channel: 'SMS',
        status: smsProvider.isDevelopment ? 'SENT_CONSOLE' : (sent ? 'DELIVERED' : 'FAILED'),
        provider: smsProvider.name,
        referenceId: maskPhoneNumber(e164),
      },
    }).catch(() => {});

    if (!sent && !smsProvider.isDevelopment) {
      const lastError = (smsProvider as any).getLastError?.();
      const safeMsg =
        lastError?.safeMessage ||
        'Failed to dispatch SMS verification code. Please check your number or try again later.';
      throw new Error(safeMsg);
    }

    return {
      success: true,
      message: `A 6-digit verification code has been dispatched to ${maskPhoneNumber(e164)}`,
      expiresInMinutes: PhoneService.DEFAULT_EXPIRY_MINUTES,
      normalizedPhone: e164,
      devOtpPreview: smsProvider.isDevelopment ? rawOtp : undefined,
    };
  }

  /**
   * Verifies the submitted OTP against the SHA-256 hash.
   * Single-use invalidation: verified code cannot be used again.
   * Max 3 attempts enforcement.
   */
  async verifyPhoneOtp(params: {
    phoneNumber: string;
    countryCode?: string;
    otp: string;
    reason: 'SIGNUP' | 'LOGIN' | 'PHONE_CHANGE';
    userId?: string;
  }): Promise<{
    success: boolean;
    message: string;
    normalizedPhone: string;
  }> {
    const { otp, reason } = params;

    const cleanOtp = (otp || '').replace(/\D/g, '');
    if (!cleanOtp || cleanOtp.length !== PhoneService.OTP_LENGTH) {
      return { success: false, message: 'Verification code must be 6 digits.', normalizedPhone: '' };
    }

    const norm = normalizePhoneNumber(params.phoneNumber, params.countryCode || 'NZ');
    if (!norm.isValid || !norm.e164) {
      return { success: false, message: norm.error || 'Invalid phone number format.', normalizedPhone: '' };
    }

    const e164 = norm.e164;
    const now = new Date();

    const record = await prisma.phoneVerification.findFirst({
      where: {
        phoneNumber: e164,
        reason,
        verified: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return {
        success: false,
        message: 'No active verification code found for this phone number. Please request a new code.',
        normalizedPhone: e164,
      };
    }

    // Expiry check (strictly 10 minutes)
    if (now > record.expiresAt) {
      await prisma.phoneVerification.delete({ where: { id: record.id } }).catch(() => {});
      return {
        success: false,
        message: 'Verification code has expired. Please request a new code.',
        normalizedPhone: e164,
      };
    }

    // Attempts check (strictly max 3 attempts)
    if (record.attempts >= PhoneService.MAX_ATTEMPTS) {
      await prisma.phoneVerification.delete({ where: { id: record.id } }).catch(() => {});
      return {
        success: false,
        message: 'Maximum attempts exceeded. This code has been invalidated. Please request a new code.',
        normalizedPhone: e164,
      };
    }

    // Verification check:
    // If the active SMS provider provides its own verification (e.g. Twilio Verify v2),
    // delegate verification to it. Otherwise, use PropertyTalk's secure SHA-256 hash comparison.
    const smsProvider = getSmsProvider();
    let isCodeValid = false;

    if (typeof (smsProvider as any).verifyOtp === 'function') {
      const providerCheck = await (smsProvider as any).verifyOtp(e164, cleanOtp);
      if (providerCheck.error === 'NO_VERIFY_SERVICE') {
        const submittedHash = this.hashOtp(cleanOtp);
        isCodeValid = (submittedHash === record.otpHash);
      } else if (providerCheck.error === 'EXPIRED') {
        await prisma.phoneVerification.delete({ where: { id: record.id } }).catch(() => {});
        return {
          success: false,
          message: 'Verification code has expired. Please request a new code.',
          normalizedPhone: e164,
        };
      } else {
        isCodeValid = Boolean(providerCheck.success);
      }
    } else {
      const submittedHash = this.hashOtp(cleanOtp);
      isCodeValid = (submittedHash === record.otpHash);
    }

    if (!isCodeValid) {
      const nextAttempts = record.attempts + 1;
      const remainingAttempts = PhoneService.MAX_ATTEMPTS - nextAttempts;

      if (remainingAttempts <= 0) {
        await prisma.phoneVerification.delete({ where: { id: record.id } }).catch(() => {});
        return {
          success: false,
          message: 'Maximum attempts exceeded. This code has been invalidated. Please request a new code.',
          normalizedPhone: e164,
        };
      }

      await prisma.phoneVerification.update({
        where: { id: record.id },
        data: { attempts: nextAttempts },
      });

      return {
        success: false,
        message: `Invalid verification code. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`,
        normalizedPhone: e164,
      };
    }

    // Mark verified / single-use invalidation
    await prisma.phoneVerification.update({
      where: { id: record.id },
      data: { verified: true },
    });

    return {
      success: true,
      message: 'Phone number verified successfully.',
      normalizedPhone: e164,
    };
  }
}

export const phoneService = new PhoneService();
