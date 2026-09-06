import {
  IPaymentProvider,
  CreateCustomerParams,
  SetupIntentResult,
  PaymentMethodDetails,
  AuthorizePaymentParams,
  CapturePaymentParams,
  RefundPaymentParams,
  ConnectedAccountResult,
} from './payment.interface';

export class StripePaymentProvider implements IPaymentProvider {
  readonly name = 'StripePaymentProvider';
  readonly isMock = false;

  private stripeClient: any = null;

  constructor() {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (apiKey) {
      try {
        // Safe lazy import of Stripe package if installed
        const StripeConstructor = require('stripe');
        this.stripeClient = new StripeConstructor(apiKey, {
          apiVersion: '2024-11-20.acacia',
        });
      } catch (err) {
        console.warn(
          '[StripePaymentProvider] Stripe library not found or failed to initialize. Falling back to safe handling.'
        );
      }
    }
  }

  private ensureStripe() {
    if (!this.stripeClient) {
      throw new Error(
        'Stripe is not configured. Please supply STRIPE_SECRET_KEY or switch to MockPaymentProvider.'
      );
    }
    return this.stripeClient;
  }

  async createCustomer(params: CreateCustomerParams): Promise<{ customerId: string }> {
    const stripe = this.ensureStripe();
    const customer = await stripe.customers.create({
      email: params.email,
      name: params.name,
      phone: params.phone,
      metadata: {
        userId: params.userId,
        countryCode: params.countryCode || 'NZ',
      },
    });
    return { customerId: customer.id };
  }

  async createSetupIntent(customerId: string): Promise<SetupIntentResult> {
    const stripe = this.ensureStripe();
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });
    return {
      setupIntentId: setupIntent.id,
      clientSecret: setupIntent.client_secret,
      customerId,
    };
  }

  async createPaymentMethod(
    customerId: string,
    params: {
      type?: string;
      cardNumber?: string;
      cardBrand?: string;
      cardLast4?: string;
      expMonth?: number;
      expYear?: number;
      token?: string;
    }
  ): Promise<PaymentMethodDetails> {
    const stripe = this.ensureStripe();

    if (params.token) {
      // Create payment method from client token/id
      const pm = await stripe.paymentMethods.retrieve(params.token);
      await stripe.paymentMethods.attach(pm.id, { customer: customerId });
      return {
        paymentMethodId: pm.id,
        type: pm.type,
        brand: pm.card?.brand || 'card',
        last4: pm.card?.last4 || '4242',
        expMonth: pm.card?.exp_month || 12,
        expYear: pm.card?.exp_year || 2028,
      };
    }

    throw new Error(
      'Raw card entry is not permitted via direct API in Stripe mode. Use Stripe Elements / token flow.'
    );
  }

  async attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    const stripe = this.ensureStripe();
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<void> {
    const stripe = this.ensureStripe();
    await stripe.paymentMethods.detach(paymentMethodId);
  }

  async authorizePayment(
    params: AuthorizePaymentParams
  ): Promise<{ paymentIntentId: string; status: string; clientSecret?: string }> {
    const stripe = this.ensureStripe();
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: params.amountMinorUnits,
        currency: params.currency.toLowerCase(),
        customer: params.customerId,
        payment_method: params.paymentMethodId,
        capture_method: 'manual', // Authorize only
        confirm: true,
        off_session: true,
        description: params.description || 'PropertyTalk Consultation',
        metadata: params.metadata || {},
      },
      { idempotencyKey: params.idempotencyKey }
    );

    return {
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      clientSecret: paymentIntent.client_secret,
    };
  }

  async capturePayment(
    params: CapturePaymentParams
  ): Promise<{ paymentIntentId: string; chargeId: string; status: string }> {
    const stripe = this.ensureStripe();
    const captureOptions: any = {};
    if (params.amountMinorUnits) {
      captureOptions.amount_to_capture = params.amountMinorUnits;
    }

    const pi = await stripe.paymentIntents.capture(
      params.paymentIntentId,
      captureOptions,
      { idempotencyKey: params.idempotencyKey }
    );

    const chargeId =
      typeof pi.latest_charge === 'string'
        ? pi.latest_charge
        : pi.latest_charge?.id || pi.id;

    return {
      paymentIntentId: pi.id,
      chargeId,
      status: pi.status,
    };
  }

  async cancelAuthorization(paymentIntentId: string): Promise<{ status: string }> {
    const stripe = this.ensureStripe();
    const pi = await stripe.paymentIntents.cancel(paymentIntentId);
    return { status: pi.status };
  }

  async refundPayment(
    params: RefundPaymentParams
  ): Promise<{ refundId: string; status: string; amountRefundedMinorUnits: number }> {
    const stripe = this.ensureStripe();
    const refund = await stripe.refunds.create(
      {
        payment_intent: params.paymentIntentId,
        amount: params.amountMinorUnits,
        reason: 'requested_by_customer',
      },
      { idempotencyKey: params.idempotencyKey }
    );

    return {
      refundId: refund.id,
      status: refund.status,
      amountRefundedMinorUnits: refund.amount,
    };
  }

  async createConnectedAccount(
    expertId: string,
    email: string,
    countryCode: string
  ): Promise<ConnectedAccountResult> {
    const stripe = this.ensureStripe();
    const account = await stripe.accounts.create({
      type: 'express',
      country: countryCode.toUpperCase() === 'AU' ? 'AU' : 'NZ',
      email,
      capabilities: {
        transfers: { requested: true },
      },
      metadata: { expertId },
    });

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: 'http://localhost:5174/earnings?connect_refresh=1',
      return_url: 'http://localhost:5174/earnings?connect_return=1',
      type: 'account_onboarding',
    });

    return {
      accountId: account.id,
      onboardingUrl: accountLink.url,
      status: 'PENDING',
    };
  }

  async getConnectedAccountStatus(
    accountId: string
  ): Promise<{ status: 'NOT_STARTED' | 'PENDING' | 'RESTRICTED' | 'ACTIVE' }> {
    const stripe = this.ensureStripe();
    const account = await stripe.accounts.retrieve(accountId);

    if (account.charges_enabled && account.payouts_enabled) {
      return { status: 'ACTIVE' };
    }
    if (account.requirements?.currently_due?.length) {
      return { status: 'RESTRICTED' };
    }
    return { status: 'PENDING' };
  }
}
