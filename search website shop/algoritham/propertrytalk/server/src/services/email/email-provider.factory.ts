import { IEmailProvider } from './email.interface';
import { DevelopmentEmailProvider } from './dev-email.provider';
import { ResendEmailProvider } from './resend-email.provider';

let emailProviderInstance: IEmailProvider | null = null;

export function getEmailProvider(): IEmailProvider {
  if (emailProviderInstance) {
    return emailProviderInstance;
  }

  const explicitProvider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();

  // If explicitly configured for dev mode, bypass external API checks
  if (explicitProvider === 'dev') {
    emailProviderInstance = new DevelopmentEmailProvider();
    return emailProviderInstance;
  }

  const apiKey = (process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY || '').trim();
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const fromName = process.env.EMAIL_FROM_NAME;

  if (explicitProvider === 'resend' || (apiKey && apiKey.length > 0)) {
    emailProviderInstance = new ResendEmailProvider(apiKey, fromAddress, fromName);
  } else {
    emailProviderInstance = new DevelopmentEmailProvider();
  }

  return emailProviderInstance;
}

export function resetEmailProviderForTesting(mockProvider?: IEmailProvider) {
  emailProviderInstance = mockProvider || null;
}
