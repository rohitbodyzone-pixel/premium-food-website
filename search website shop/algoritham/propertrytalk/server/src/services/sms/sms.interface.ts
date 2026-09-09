export interface SmsOtpDetails {
  to: string; // E.164 phone number e.g. +64211234567
  otp: string; // 6-digit numeric OTP
  expiresMinutes: number;
  countryCode?: string;
  name?: string;
}

export interface SmsSecurityAlertDetails {
  to: string; // E.164 phone number
  message: string;
}

export interface ISmsProvider {
  readonly name: string;
  readonly isDevelopment: boolean;

  /**
   * Dispatches an authentication / verification OTP via SMS.
   */
  sendOtp(details: SmsOtpDetails): Promise<boolean>;

  /**
   * Dispatches a security alert SMS (e.g. phone number updated or account alert).
   */
  sendSecurityAlert(details: SmsSecurityAlertDetails): Promise<boolean>;

  /**
   * Optional provider-level OTP verification (e.g. Twilio Verify v2).
   * If implemented and configured by the active provider, PhoneService delegates to it.
   * If not implemented or not configured, PhoneService falls back to SHA-256 hash comparison.
   */
  verifyOtp?(to: string, code: string): Promise<{ success: boolean; error?: string }>;
}
