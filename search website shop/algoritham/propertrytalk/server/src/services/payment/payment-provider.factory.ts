import { IPaymentProvider } from './payment.interface';
import { MockPaymentProvider } from './mock-payment.provider';
import { StripePaymentProvider } from './stripe-payment.provider';

let cachedProvider: IPaymentProvider | null = null;

export function getPaymentProvider(): IPaymentProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey && stripeKey.startsWith('sk_')) {
    try {
      cachedProvider = new StripePaymentProvider();
      console.log('💳 [Payment] Initialized StripePaymentProvider with live/test key.');
      return cachedProvider;
    } catch (e) {
      console.warn('⚠️ [Payment] Failed to load Stripe, falling back to MockPaymentProvider:', e);
    }
  }

  console.log(
    '🧪 [Payment] Running in DEVELOPMENT / MOCK PAYMENT MODE (no STRIPE_SECRET_KEY configured).'
  );
  cachedProvider = new MockPaymentProvider();
  return cachedProvider;
}

export function resetPaymentProviderForTesting(): void {
  cachedProvider = null;
}
