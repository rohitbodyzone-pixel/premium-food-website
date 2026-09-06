import { IEmailProvider } from './email.interface';
import { DevelopmentEmailProvider } from './dev-email.provider';
import { ResendEmailProvider } from './resend-email.provider';

let emailProviderInstance: IEmailProvider | null = null;

export function getEmailProvider(): IEmailProvider {
  if (emailProviderInstance) {
    return emailProviderInstance;
  }

  const apiKey = process.env.EMAIL_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const fromName = process.env.EMAIL_FROM_NAME;

  if (apiKey && apiKey.trim().length > 0) {
    emailProviderInstance = new ResendEmailProvider(apiKey.trim(), fromAddress, fromName);
  } else {
    emailProviderInstance = new DevelopmentEmailProvider();
  }

  return emailProviderInstance;
}

export function resetEmailProviderForTesting(mockProvider?: IEmailProvider) {
  emailProviderInstance = mockProvider || null;
}
