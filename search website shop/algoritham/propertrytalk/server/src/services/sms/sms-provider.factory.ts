import { ISmsProvider } from './sms.interface';
import { DevelopmentSmsProvider } from './dev-sms.provider';
import { TwilioSmsProvider } from './twilio-sms.provider';

let cachedProvider: ISmsProvider | null = null;
let devProviderInstance: DevelopmentSmsProvider | null = null;

export function getSmsProvider(): ISmsProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const explicitProvider = process.env.SMS_PROVIDER?.trim().toLowerCase();

  // If explicitly forced to development mode, bypass external Twilio check
  if (explicitProvider === 'dev') {
    if (!devProviderInstance) {
      devProviderInstance = new DevelopmentSmsProvider();
    }
    return devProviderInstance;
  }

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

  if (explicitProvider === 'twilio' || (twilioSid && twilioToken && twilioPhone)) {
    cachedProvider = new TwilioSmsProvider();
    return cachedProvider;
  }

  if (!devProviderInstance) {
    devProviderInstance = new DevelopmentSmsProvider();
  }
  return devProviderInstance;
}

export function getDevSmsProvider(): DevelopmentSmsProvider {
  if (!devProviderInstance) {
    devProviderInstance = new DevelopmentSmsProvider();
  }
  return devProviderInstance;
}

export function setSmsProviderForTesting(provider: ISmsProvider | null): void {
  cachedProvider = provider;
}

export function resetSmsProviderForTesting(): void {
  cachedProvider = null;
  devProviderInstance = null;
}

