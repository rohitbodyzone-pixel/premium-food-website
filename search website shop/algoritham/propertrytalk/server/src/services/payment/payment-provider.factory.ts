import { IPaymentProvider } from './payment.interface';
import { MockPaymentProvider } from './mock-payment.provider';
import { StripePaymentProvider } from './stripe-payment.provider';

let cachedProvider: IPaymentProvider | null = null;

export function getPaymentProvider(): IPaymentProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const explicitProvider = process.env.PAYMENT_PROVIDER?.trim().toLowerCase();

  // If explicitly forced to mock mode, use MockPaymentProvider
  if (explicitProvider === 'mock') {
    cachedProvider = new MockPaymentProvider();
    return cachedProvider;
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;

  // STRICT PHASE 3A PRODUCTION SAFETY GUARD: Reject Stripe live mode keys
  if (stripeKey && stripeKey.startsWith('sk_live_')) {
    throw new Error(
      'Stripe live mode is disabled during Phase 3A. Only test credentials (sk_test_) are permitted.'
    );
  }

  if (explicitProvider === 'stripe' || (stripeKey && stripeKey.startsWith('sk_test_'))) {
    try {
      cachedProvider = new StripePaymentProvider();
      console.log('💳 [Payment] Initialized StripePaymentProvider with test key.');
      return cachedProvider;
    } catch (e: any) {
      if (e.message?.includes('Stripe live mode is disabled')) {
        throw e;
      }
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
