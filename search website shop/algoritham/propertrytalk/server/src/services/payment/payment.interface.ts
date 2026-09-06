export interface CreateCustomerParams {
  userId: string;
  email: string;
  name: string;
  phone?: string;
  countryCode?: string;
}

export interface SetupIntentResult {
  clientSecret: string;
  setupIntentId: string;
  customerId: string;
}

export interface PaymentMethodDetails {
  paymentMethodId: string;
  type: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface AuthorizePaymentParams {
  customerId: string;
  paymentMethodId: string;
  amountMinorUnits: number;
  currency: string; // 'NZD', 'AUD'
  idempotencyKey: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface CapturePaymentParams {
  paymentIntentId: string;
  amountMinorUnits?: number;
  idempotencyKey: string;
}

export interface RefundPaymentParams {
  paymentIntentId: string;
  amountMinorUnits: number;
  currency: string;
  reason: string;
  idempotencyKey: string;
}

export interface ConnectedAccountResult {
  accountId: string;
  onboardingUrl?: string;
  status: 'NOT_STARTED' | 'PENDING' | 'RESTRICTED' | 'ACTIVE';
}

export interface IPaymentProvider {
  readonly name: string;
  readonly isMock: boolean;

  createCustomer(params: CreateCustomerParams): Promise<{ customerId: string }>;

  createSetupIntent(customerId: string): Promise<SetupIntentResult>;

  createPaymentMethod(
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
  ): Promise<PaymentMethodDetails>;

  attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<void>;

  detachPaymentMethod(paymentMethodId: string): Promise<void>;

  authorizePayment(
    params: AuthorizePaymentParams
  ): Promise<{ paymentIntentId: string; status: string; clientSecret?: string }>;

  capturePayment(
    params: CapturePaymentParams
  ): Promise<{ paymentIntentId: string; chargeId: string; status: string }>;

  cancelAuthorization(paymentIntentId: string): Promise<{ status: string }>;

  refundPayment(
    params: RefundPaymentParams
  ): Promise<{ refundId: string; status: string; amountRefundedMinorUnits: number }>;

  createConnectedAccount(
    expertId: string,
    email: string,
    countryCode: string
  ): Promise<ConnectedAccountResult>;

  getConnectedAccountStatus(
    accountId: string
  ): Promise<{ status: 'NOT_STARTED' | 'PENDING' | 'RESTRICTED' | 'ACTIVE' }>;
}
