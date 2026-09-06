import { ISmsProvider } from './sms.interface';
import { DevelopmentSmsProvider } from './dev-sms.provider';
import { TwilioSmsProvider } from './twilio-sms.provider';

let cachedProvider: ISmsProvider | null = null;
let devProviderInstance: DevelopmentSmsProvider | null = null;

export function getSmsProvider(): ISmsProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

  if (twilioSid && twilioToken && twilioPhone) {
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
