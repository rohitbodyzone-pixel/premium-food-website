import { ISmsProvider, SmsOtpDetails, SmsSecurityAlertDetails } from './sms.interface';

export interface TwilioErrorDetails {
  code?: number;
  safeMessage: string;
  rawMessage?: string;
  timestamp: Date;
}

export interface TwilioDispatchResult {
  success: boolean;
  sid?: string;
  status?: string;
  toMasked: string;
  timestamp: Date;
}

export class TwilioSmsProvider implements ISmsProvider {
  readonly name = 'TwilioSmsProvider';
  readonly isDevelopment = false;

  private accountSid: string;
  private authToken: string;
  private fromNumber: string;
  private verifyServiceSid: string;

  private lastError: TwilioErrorDetails | null = null;
  private lastDispatchResult: TwilioDispatchResult | null = null;

  constructor(customSid?: string, customToken?: string, customFrom?: string, customVerifySid?: string) {
    this.accountSid = customSid || process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = customToken || process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = customFrom || process.env.TWILIO_PHONE_NUMBER || '';
    this.verifyServiceSid = customVerifySid || process.env.TWILIO_VERIFY_SERVICE_SID || '';
  }

  isConfigured(): boolean {
    return Boolean(this.accountSid && this.authToken && (this.fromNumber || this.verifyServiceSid));
  }

  isVerifyConfigured(): boolean {
    return Boolean(this.accountSid && this.authToken && this.verifyServiceSid);
  }

  getLastError(): TwilioErrorDetails | null {
    return this.lastError;
  }

  getLastDispatchResult(): TwilioDispatchResult | null {
    return this.lastDispatchResult;
  }

  private maskPhone(phone: string): string {
    if (!phone || phone.length < 6) return '••••••';
    return `${phone.slice(0, 3)}•••••••${phone.slice(-3)}`;
  }

  async sendOtp(details: SmsOtpDetails): Promise<boolean> {
    if (!this.isConfigured()) {
      this.lastError = {
        safeMessage: 'Twilio SMS is not fully configured (missing SID, token, or phone number).',
        timestamp: new Date(),
      };
      console.warn('[TwilioSmsProvider] Twilio credentials missing. Falling back to safe handling.');
      return false;
    }

    // When Twilio Verify Service is configured, use Twilio Verify v2 API
    // This allows Twilio to generate and verify dynamic OTPs securely without trial template restrictions.
    if (this.verifyServiceSid) {
      return this.dispatchTwilioVerify(details.to);
    }

    // Fallback: Standard Programmable SMS
    const body = `Your PropertyTalk verification code is ${details.otp}. Valid for ${details.expiresMinutes} minutes. Never share this code.`;
    return this.dispatchTwilioMessage(details.to, body);
  }

  /**
   * Dispatches a dynamic OTP via Twilio Verify v2 API.
   */
  private async dispatchTwilioVerify(to: string): Promise<boolean> {
    const maskedTo = this.maskPhone(to);
    this.lastError = null;

    try {
      const url = `https://verify.twilio.com/v2/Services/${this.verifyServiceSid}/Verifications`;
      const authHeader =
        'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

      const formData = new URLSearchParams();
      formData.append('To', to);
      formData.append('Channel', 'sms');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const respText = await response.text();
      let respJson: any = null;
      try {
        respJson = JSON.parse(respText);
      } catch {}

      if (!response.ok) {
        const code = respJson?.code;
        const safeMessage = this.mapTwilioErrorCode(code, respJson?.message);

        this.lastError = {
          code,
          safeMessage,
          rawMessage: respJson?.message || respText,
          timestamp: new Date(),
        };

        console.error(
          `[TwilioSmsProvider] Verify dispatch failed to ${maskedTo} [Code: ${code || response.status}]: ${safeMessage}`
        );
        return false;
      }

      this.lastDispatchResult = {
        success: true,
        sid: respJson?.sid,
        status: respJson?.status || 'pending',
        toMasked: maskedTo,
        timestamp: new Date(),
      };

      const maskedSid = respJson?.sid
        ? `${respJson.sid.slice(0, 4)}••••${respJson.sid.slice(-4)}`
        : 'N/A';
      console.log(
        `📱 [TwilioSmsProvider] Twilio Verify OTP dispatched for ${maskedTo}. Status: ${respJson?.status || 'pending'}, SID: ${maskedSid}`
      );

      return true;
    } catch (error: any) {
      this.lastError = {
        safeMessage: 'Twilio network communication failure.',
        rawMessage: error?.message,
        timestamp: new Date(),
      };
      console.error(`[TwilioSmsProvider] Network error dispatching Verify to ${maskedTo}:`, error?.message);
      return false;
    }
  }

  /**
   * Verifies submitted OTP code via Twilio Verify v2 API.
   */
  async verifyOtp(to: string, code: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Twilio SMS provider not configured.' };
    }

    if (!this.verifyServiceSid) {
      return { success: false, error: 'NO_VERIFY_SERVICE' };
    }

    const maskedTo = this.maskPhone(to);

    try {
      const url = `https://verify.twilio.com/v2/Services/${this.verifyServiceSid}/VerificationCheck`;
      const authHeader =
        'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

      const formData = new URLSearchParams();
      formData.append('To', to);
      formData.append('Code', code.trim());

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const respText = await response.text();
      let respJson: any = null;
      try {
        respJson = JSON.parse(respText);
      } catch {}

      if (!response.ok) {
        const twilioCode = respJson?.code;
        if (twilioCode === 20404 || response.status === 404) {
          return { success: false, error: 'EXPIRED' };
        }
        return { success: false, error: this.mapTwilioErrorCode(twilioCode, respJson?.message) };
      }

      if (respJson?.status === 'approved' && respJson?.valid === true) {
        console.log(`📱 [TwilioSmsProvider] Twilio Verify check approved for ${maskedTo}`);
        return { success: true };
      }

      return { success: false, error: 'INVALID_CODE' };
    } catch (err: any) {
      console.error(`[TwilioSmsProvider] Twilio Verify check network error for ${maskedTo}:`, err?.message);
      return { success: false, error: 'NETWORK_ERROR' };
    }
  }

  async sendSecurityAlert(details: SmsSecurityAlertDetails): Promise<boolean> {
    if (!this.isConfigured()) {
      this.lastError = {
        safeMessage: 'Twilio SMS credentials missing.',
        timestamp: new Date(),
      };
      console.warn('[TwilioSmsProvider] Twilio credentials missing.');
      return false;
    }

    return this.dispatchTwilioMessage(details.to, details.message);
  }

  private mapTwilioErrorCode(code?: number, defaultMsg?: string): string {
    switch (code) {
      case 21608:
        return 'Twilio trial account requires verified recipient number.';
      case 20003:
        return 'SMS provider authentication failed. Please verify provider credentials.';
      case 21211:
      case 21614:
        return 'Invalid or unreachable destination mobile number.';
      case 21606:
        return 'SMS provider sender number configuration error.';
      case 20429:
        return 'SMS delivery rate limit exceeded. Please wait a few minutes.';
      case 20005:
        return 'SMS gateway balance depleted or service suspended.';
      case 60200:
      case 60202:
        return 'Invalid verification code submitted.';
      case 60203:
        return 'Maximum verification attempts exceeded on SMS gateway.';
      default:
        return defaultMsg || 'Failed to dispatch SMS through Twilio gateway.';
    }
  }

  private async dispatchTwilioMessage(to: string, body: string): Promise<boolean> {
    const maskedTo = this.maskPhone(to);
    this.lastError = null;

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const authHeader =
        'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

      const formData = new URLSearchParams();
      formData.append('To', to);
      formData.append('From', this.fromNumber);
      formData.append('Body', body);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const respText = await response.text();
      let respJson: any = null;
      try {
        respJson = JSON.parse(respText);
      } catch {}

      if (!response.ok) {
        const code = respJson?.code;
        const safeMessage = this.mapTwilioErrorCode(code, respJson?.message);

        this.lastError = {
          code,
          safeMessage,
          rawMessage: respJson?.message || respText,
          timestamp: new Date(),
        };

        console.error(
          `[TwilioSmsProvider] Delivery failed to ${maskedTo} [Code: ${code || response.status}]: ${safeMessage}`
        );
        return false;
      }

      this.lastDispatchResult = {
        success: true,
        sid: respJson?.sid,
        status: respJson?.status || 'accepted',
        toMasked: maskedTo,
        timestamp: new Date(),
      };

      const maskedSid = respJson?.sid
        ? `${respJson.sid.slice(0, 4)}••••${respJson.sid.slice(-4)}`
        : 'N/A';
      console.log(
        `📱 [TwilioSmsProvider] Message accepted by Twilio for ${maskedTo}. Status: ${respJson?.status || 'queued'}, SID: ${maskedSid}`
      );

      return true;
    } catch (error: any) {
      this.lastError = {
        safeMessage: 'Twilio network communication failure.',
        rawMessage: error?.message,
        timestamp: new Date(),
      };
      console.error(`[TwilioSmsProvider] Network error dispatching to ${maskedTo}:`, error?.message);
      return false;
    }
  }
}

