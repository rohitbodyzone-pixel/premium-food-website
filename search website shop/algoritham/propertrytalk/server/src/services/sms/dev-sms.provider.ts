import { ISmsProvider, SmsOtpDetails, SmsSecurityAlertDetails } from './sms.interface';

export interface DispatchedSmsRecord {
  to: string;
  otp?: string;
  message?: string;
  type: 'OTP' | 'SECURITY_ALERT';
  dispatchedAt: Date;
}

export class DevelopmentSmsProvider implements ISmsProvider {
  readonly name = 'DevelopmentSmsProvider (Console Preview)';
  readonly isDevelopment = true;

  // In-memory log of dispatched SMS messages for test assertions and dev inspection
  public dispatchedMessages: DispatchedSmsRecord[] = [];

  async sendOtp(details: SmsOtpDetails): Promise<boolean> {
    const record: DispatchedSmsRecord = {
      to: details.to,
      otp: details.otp,
      type: 'OTP',
      dispatchedAt: new Date(),
    };
    this.dispatchedMessages.push(record);

    if (process.env.NODE_ENV === 'production') {
      const maskedPhone = details.to.length > 5 
        ? `${details.to.slice(0, 3)}***${details.to.slice(-2)}` 
        : '***';
      console.log(`📱 [PROD SMS FALLBACK] OTP dispatched to ${maskedPhone} (plaintext OTP suppressed for production security)`);
    } else {
      console.log('\n======================================================');
      console.log('📱 [DEV SMS MODE] Phone Verification OTP Dispatched');
      console.log(`To: ${details.to}`);
      if (details.name) {
        console.log(`User: ${details.name}`);
      }
      console.log(`🔑 6-Digit OTP: ${details.otp}`);
      console.log(`⏳ Code expires in ${details.expiresMinutes} minutes. Single-use only. Max 3 attempts.`);
      console.log('======================================================\n');
    }

    return true;
  }

  async sendSecurityAlert(details: SmsSecurityAlertDetails): Promise<boolean> {
    const record: DispatchedSmsRecord = {
      to: details.to,
      message: details.message,
      type: 'SECURITY_ALERT',
      dispatchedAt: new Date(),
    };
    this.dispatchedMessages.push(record);

    console.log('\n======================================================');
    console.log('🛡️ [DEV SMS MODE] Security Alert SMS Dispatched');
    console.log(`To: ${details.to}`);
    console.log(`Message: ${details.message}`);
    console.log('======================================================\n');

    return true;
  }

  /**
   * Helper for automated test suites to inspect the last dispatched OTP.
   */
  getLastDispatchedOtp(phoneNumber?: string): string | undefined {
    if (phoneNumber) {
      const match = [...this.dispatchedMessages]
        .reverse()
        .find((m) => m.to === phoneNumber && m.type === 'OTP');
      return match?.otp;
    }
    const last = [...this.dispatchedMessages].reverse().find((m) => m.type === 'OTP');
    return last?.otp;
  }

  clearHistory(): void {
    this.dispatchedMessages = [];
  }
}
