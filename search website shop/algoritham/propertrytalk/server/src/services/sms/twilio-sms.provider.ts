import { ISmsProvider, SmsOtpDetails, SmsSecurityAlertDetails } from './sms.interface';

export class TwilioSmsProvider implements ISmsProvider {
  readonly name = 'TwilioSmsProvider';
  readonly isDevelopment = false;

  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';
  }

  isConfigured(): boolean {
    return Boolean(this.accountSid && this.authToken && this.fromNumber);
  }

  async sendOtp(details: SmsOtpDetails): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('[TwilioSmsProvider] Twilio credentials missing. Falling back to console preview.');
      return false;
    }

    const body = `Your PropertyTalk verification code is ${details.otp}. Valid for ${details.expiresMinutes} minutes. Never share this code.`;
    return this.dispatchTwilioMessage(details.to, body);
  }

  async sendSecurityAlert(details: SmsSecurityAlertDetails): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('[TwilioSmsProvider] Twilio credentials missing.');
      return false;
    }

    return this.dispatchTwilioMessage(details.to, details.message);
  }

  private async dispatchTwilioMessage(to: string, body: string): Promise<boolean> {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const authHeader = 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

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

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[TwilioSmsProvider] Failed to dispatch SMS to ${to}:`, errText);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`[TwilioSmsProvider] Network error sending SMS to ${to}:`, error);
      return false;
    }
  }
}
