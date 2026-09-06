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

interface MockPaymentIntent {
  id: string;
  customerId: string;
  paymentMethodId: string;
  amount: number;
  currency: string;
  status: 'requires_capture' | 'succeeded' | 'canceled';
  chargeId: string;
}

export class MockPaymentProvider implements IPaymentProvider {
  readonly name = 'MockPaymentProvider (Development)';
  readonly isMock = true;

  private customers = new Map<string, any>();
  private paymentMethods = new Map<string, PaymentMethodDetails>();
  private paymentIntents = new Map<string, MockPaymentIntent>();
  private idempotencyCache = new Map<string, any>();
  private connectedAccounts = new Map<string, ConnectedAccountResult>();

  async createCustomer(params: CreateCustomerParams): Promise<{ customerId: string }> {
    const customerId = `mock_cus_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.customers.set(customerId, { ...params, id: customerId, createdAt: new Date() });
    return { customerId };
  }

  async createSetupIntent(customerId: string): Promise<SetupIntentResult> {
    const setupIntentId = `mock_seti_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      setupIntentId,
      clientSecret: `${setupIntentId}_secret_${Math.random().toString(36).substring(2, 9)}`,
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
    const paymentMethodId = `mock_pm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Determine brand and last4 from input or default to Visa 4242
    let brand = (params.cardBrand || 'visa').toLowerCase();
    let last4 = params.cardLast4 || '4242';

    if (params.cardNumber) {
      const cleanNum = params.cardNumber.replace(/\s+/g, '');
      last4 = cleanNum.slice(-4) || '4242';
      if (cleanNum.startsWith('4')) brand = 'visa';
      else if (cleanNum.startsWith('5')) brand = 'mastercard';
      else if (cleanNum.startsWith('3')) brand = 'amex';
    }

    const details: PaymentMethodDetails = {
      paymentMethodId,
      type: params.type || 'card',
      brand,
      last4,
      expMonth: params.expMonth || 12,
      expYear: params.expYear || 2028,
    };

    this.paymentMethods.set(paymentMethodId, details);
    return details;
  }

  async attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    const customer = this.customers.get(customerId);
    if (customer) {
      customer.defaultPaymentMethodId = paymentMethodId;
    }
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<void> {
    this.paymentMethods.delete(paymentMethodId);
  }

  async authorizePayment(
    params: AuthorizePaymentParams
  ): Promise<{ paymentIntentId: string; status: string; clientSecret?: string }> {
    // Check idempotency
    if (this.idempotencyCache.has(params.idempotencyKey)) {
      return this.idempotencyCache.get(params.idempotencyKey);
    }

    // Inspect payment method for simulated decline
    const pm = this.paymentMethods.get(params.paymentMethodId);
    if (pm && (pm.last4 === '0002' || pm.last4 === '0003')) {
      throw new Error(
        `Mock Payment Declined: Card ending in ${pm.last4} was declined by the simulated issuing bank.`
      );
    }

    const paymentIntentId = `mock_pi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const chargeId = `mock_ch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const mockPi: MockPaymentIntent = {
      id: paymentIntentId,
      customerId: params.customerId,
      paymentMethodId: params.paymentMethodId,
      amount: params.amountMinorUnits,
      currency: params.currency,
      status: 'requires_capture',
      chargeId,
    };

    this.paymentIntents.set(paymentIntentId, mockPi);

    const result = {
      paymentIntentId,
      status: 'requires_capture',
      clientSecret: `${paymentIntentId}_secret_mock`,
    };

    this.idempotencyCache.set(params.idempotencyKey, result);
    return result;
  }

  async capturePayment(
    params: CapturePaymentParams
  ): Promise<{ paymentIntentId: string; chargeId: string; status: string }> {
    if (this.idempotencyCache.has(params.idempotencyKey)) {
      return this.idempotencyCache.get(params.idempotencyKey);
    }

    const pi = this.paymentIntents.get(params.paymentIntentId);
    if (!pi) {
      // If authorized in a previous run or simulated
      const chargeId = `mock_ch_${Date.now()}`;
      const result = {
        paymentIntentId: params.paymentIntentId,
        chargeId,
        status: 'succeeded',
      };
      this.idempotencyCache.set(params.idempotencyKey, result);
      return result;
    }

    pi.status = 'succeeded';
    if (params.amountMinorUnits) {
      pi.amount = params.amountMinorUnits;
    }

    const result = {
      paymentIntentId: pi.id,
      chargeId: pi.chargeId,
      status: 'succeeded',
    };

    this.idempotencyCache.set(params.idempotencyKey, result);
    return result;
  }

  async cancelAuthorization(paymentIntentId: string): Promise<{ status: string }> {
    const pi = this.paymentIntents.get(paymentIntentId);
    if (pi) {
      pi.status = 'canceled';
    }
    return { status: 'canceled' };
  }

  async refundPayment(
    params: RefundPaymentParams
  ): Promise<{ refundId: string; status: string; amountRefundedMinorUnits: number }> {
    if (this.idempotencyCache.has(params.idempotencyKey)) {
      return this.idempotencyCache.get(params.idempotencyKey);
    }

    const refundId = `mock_re_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const result = {
      refundId,
      status: 'succeeded',
      amountRefundedMinorUnits: params.amountMinorUnits,
    };

    this.idempotencyCache.set(params.idempotencyKey, result);
    return result;
  }

  async createConnectedAccount(
    expertId: string,
    email: string,
    countryCode: string
  ): Promise<ConnectedAccountResult> {
    const existing = this.connectedAccounts.get(expertId);
    if (existing) return existing;

    const accountId = `mock_acct_${expertId.substring(0, 8)}_${countryCode.toLowerCase()}`;
    const result: ConnectedAccountResult = {
      accountId,
      onboardingUrl: `http://localhost:5174/onboarding?mock_connect=1&expertId=${expertId}`,
      status: 'PENDING',
    };

    this.connectedAccounts.set(expertId, result);
    return result;
  }

  async getConnectedAccountStatus(
    accountId: string
  ): Promise<{ status: 'NOT_STARTED' | 'PENDING' | 'RESTRICTED' | 'ACTIVE' }> {
    // In mock mode, if account starts with mock_acct it is marked ACTIVE for development
    return { status: 'ACTIVE' };
  }
}
