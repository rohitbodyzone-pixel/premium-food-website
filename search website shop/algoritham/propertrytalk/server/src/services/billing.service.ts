import { prisma } from '../db/prisma';
import { getPaymentProvider } from './payment/payment-provider.factory';
import { Server } from 'socket.io';

export class BillingService {
  private io?: Server;

  public setSocketServer(io: Server) {
    this.io = io;
  }

  /**
   * Retrieves current platform commission percentage snapshot from SystemConfig (default 20%)
   */
  async getPlatformCommissionPct(): Promise<number> {
    try {
      const config = await prisma.systemConfig.findUnique({
        where: { key: 'platform_commission_pct' },
      });
      if (config && !isNaN(parseFloat(config.value))) {
        return parseFloat(config.value);
      }
    } catch (e) {
      console.error('Error fetching platform commission config:', e);
    }
    return 20.0;
  }

  /**
   * Ensures customer exists in payment provider and local PaymentCustomer table
   */
  async ensurePaymentCustomer(userId: string): Promise<any> {
    const existing = await prisma.paymentCustomer.findUnique({
      where: { userId },
      include: { paymentMethods: true },
    });
    if (existing) return existing;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error(`User ${userId} not found`);

    const provider = getPaymentProvider();
    const created = await provider.createCustomer({
      userId: user.id,
      email: user.email || `${user.phoneNumber?.replace('+', '') || user.id}@phone.propertytalk.internal`,
      name: user.name,
      phone: user.phone || undefined,
      countryCode: user.countryCode || 'NZ',
    });

    return prisma.paymentCustomer.create({
      data: {
        userId: user.id,
        provider: provider.isMock ? 'MOCK' : 'STRIPE',
        providerCustomerId: created.customerId,
      },
      include: { paymentMethods: true },
    });
  }

  /**
   * Generates a pre-continuation pricing quote for customer review before any paid metering begins
   */
  async preparePaidQuote(params: {
    consultationId: string;
    consultationType: 'CHAT' | 'AUDIO' | 'VIDEO';
    consumerId: string;
  }) {
    const { consultationId, consultationType, consumerId } = params;

    let expertId: string;
    let expertCountryCode: string;
    let rateMinorUnitsPerMinute: number;
    let expertName: string;

    if (consultationType === 'CHAT') {
      const chat = await prisma.consultationChat.findUnique({
        where: { id: consultationId },
        include: { expert: { include: { user: true } } },
      });
      if (!chat) throw new Error('Consultation chat not found');
      if (chat.consumerId !== consumerId) throw new Error('Unauthorized consultation quote request');
      expertId = chat.expertId;
      expertCountryCode = chat.expert.countryCode;
      rateMinorUnitsPerMinute = chat.expert.chatRateMinorUnits || 250;
      expertName = chat.expert.user.name;
    } else {
      const call = await prisma.callSession.findUnique({
        where: { id: consultationId },
        include: { expert: { include: { user: true } } },
      });
      if (!call) throw new Error('Consultation call session not found');
      if (call.consumerId !== consumerId) throw new Error('Unauthorized consultation quote request');
      expertId = call.expertId;
      expertCountryCode = call.expert.countryCode;
      rateMinorUnitsPerMinute =
        call.callType === 'VIDEO'
          ? call.expert.videoRateMinorUnits || 300
          : call.expert.audioRateMinorUnits || 250;
      expertName = call.expert.user.name;
    }

    const currency = expertCountryCode.toUpperCase() === 'AU' ? 'AUD' : 'NZD';
    const currencySymbol = currency === 'AUD' ? 'A$' : 'NZ$';

    // Get customer's saved payment methods
    const customer = await prisma.paymentCustomer.findUnique({
      where: { userId: consumerId },
      include: { paymentMethods: true },
    });

    const defaultMethod = customer?.paymentMethods.find((pm) => pm.isDefault) ||
      customer?.paymentMethods[0] ||
      null;

    return {
      consultationId,
      consultationType,
      expertName,
      expertId,
      currency,
      currencySymbol,
      rateMinorUnitsPerMinute,
      rateFormatted: `${currencySymbol}${(rateMinorUnitsPerMinute / 100).toFixed(2)}/min`,
      billingRule: 'Per-second prorated billing based on actual paid consultation time.',
      hasPaymentMethod: !!defaultMethod,
      defaultPaymentMethod: defaultMethod
        ? {
            id: defaultMethod.id,
            brand: defaultMethod.cardBrand,
            last4: defaultMethod.cardLast4,
            expMonth: defaultMethod.cardExpMonth,
            expYear: defaultMethod.cardExpYear,
          }
        : null,
      providerMode: getPaymentProvider().isMock ? 'MOCK' : 'STRIPE',
    };
  }

  /**
   * Explicit customer confirmation to initiate paid continuation.
   * Validates authorization and begins server-side paid metering.
   */
  async confirmPaidContinuation(params: {
    consultationId: string;
    consultationType: 'CHAT' | 'AUDIO' | 'VIDEO';
    consumerId: string;
    paymentMethodId?: string;
  }) {
    const { consultationId, consultationType, consumerId } = params;

    // Fetch or prepare billing quote
    const quote = await this.preparePaidQuote({
      consultationId,
      consultationType,
      consumerId,
    });

    // Check payment method existence
    const customer = await prisma.paymentCustomer.findUnique({
      where: { userId: consumerId },
      include: { paymentMethods: true },
    });

    const targetMethod =
      (params.paymentMethodId
        ? customer?.paymentMethods.find((m) => m.id === params.paymentMethodId)
        : null) ||
      customer?.paymentMethods.find((m) => m.isDefault) ||
      customer?.paymentMethods[0];

    if (!targetMethod) {
      throw new Error(
        'A valid payment method is required before paid consultation can begin. Please add a payment card.'
      );
    }

    const commissionPct = await this.getPlatformCommissionPct();
    const idempotencyKey = `bill_sess_${consultationType.toLowerCase()}_${consultationId}`;
    const now = new Date();

    // Upsert ConsultationBillingSession
    const billingSession = await prisma.consultationBillingSession.upsert({
      where: { idempotencyKey },
      update: {
        status: 'PAID_ACTIVE',
        paidConfirmedAt: now,
        paidStartedAt: now,
        rateMinorUnitsPerMinute: quote.rateMinorUnitsPerMinute,
        currency: quote.currency,
        commissionPct,
      },
      create: {
        idempotencyKey,
        consultationType,
        chatId: consultationType === 'CHAT' ? consultationId : undefined,
        callSessionId: consultationType !== 'CHAT' ? consultationId : undefined,
        consumerId,
        expertId: quote.expertId,
        currency: quote.currency,
        rateMinorUnitsPerMinute: quote.rateMinorUnitsPerMinute,
        status: 'PAID_ACTIVE',
        freeSecondsUsed: 60,
        paidConfirmedAt: now,
        paidStartedAt: now,
        commissionPct,
      },
    });

    // Update parent consultation records
    if (consultationType === 'CHAT') {
      await prisma.consultationChat.update({
        where: { id: consultationId },
        data: {
          extendedPaid: true,
          isFreeExpired: false,
        },
      });
    } else {
      await prisma.callSession.update({
        where: { id: consultationId },
        data: {
          extendedPaid: true,
        },
      });
    }

    // Broadcast paid continuation activation via Socket
    const room = consultationType === 'CHAT' ? `chat_${consultationId}` : `call_${consultationId}`;
    const event =
      consultationType === 'CHAT'
        ? 'chat:paid_continuation_activated'
        : 'call:paid_continuation_activated';

    if (this.io) {
      this.io.to(room).emit(event, {
        consultationId,
        consultationType,
        status: 'PAID_ACTIVE',
        rateMinorUnitsPerMinute: quote.rateMinorUnitsPerMinute,
        currency: quote.currency,
        currencySymbol: quote.currencySymbol,
        rateFormatted: quote.rateFormatted,
        paidStartedAt: now.toISOString(),
      });
    }

    return {
      success: true,
      billingSessionId: billingSession.id,
      status: 'PAID_ACTIVE',
      rateMinorUnitsPerMinute: quote.rateMinorUnitsPerMinute,
      currency: quote.currency,
    };
  }

  /**
   * Finalizes paid consultation session, computes prorated amount using integer arithmetic,
   * captures payment via provider, and creates transaction records.
   */
  async finalizePaidSession(params: {
    consultationId: string;
    consultationType: 'CHAT' | 'AUDIO' | 'VIDEO';
    paidSecondsUsed?: number;
    forcedPaidSeconds?: number;
  }) {
    const { consultationId, consultationType } = params;
    const idempotencyKey = `bill_sess_${consultationType.toLowerCase()}_${consultationId}`;

    const session = await prisma.consultationBillingSession.findUnique({
      where: { idempotencyKey },
      include: {
        consumer: true,
        expert: { include: { user: true } },
        transaction: true,
      },
    });

    if (!session || session.status === 'COMPLETED') {
      return session;
    }

    // If session was never paid (free time only or never confirmed)
    if (!session.paidConfirmedAt || !session.paidStartedAt) {
      await prisma.consultationBillingSession.update({
        where: { id: session.id },
        data: { status: 'COMPLETED', paidEndedAt: new Date() },
      });
      return session;
    }

    // Prevent duplicate billing if already charged
    if (session.transaction && session.transaction.status === 'CAPTURED') {
      return session;
    }

    const now = new Date();
    const paidEndedAt = now;
    const elapsedSeconds = params.paidSecondsUsed !== undefined
      ? params.paidSecondsUsed
      : (params.forcedPaidSeconds !== undefined
        ? params.forcedPaidSeconds
        : Math.max(0, Math.round((paidEndedAt.getTime() - session.paidStartedAt.getTime()) / 1000)));

    // Integer arithmetic per-second prorated billing: round((rateMinorUnitsPerMinute * paidSeconds) / 60)
    const grossAmountMinorUnits = Math.round(
      (session.rateMinorUnitsPerMinute * elapsedSeconds) / 60
    );

    // Platform commission breakdown using integer arithmetic
    const platformFeeMinorUnits = Math.round(
      (grossAmountMinorUnits * session.commissionPct) / 100
    );
    const expertEarningMinorUnits = grossAmountMinorUnits - platformFeeMinorUnits;

    // Look up consumer payment method
    const customer = await prisma.paymentCustomer.findUnique({
      where: { userId: session.consumerId },
      include: { paymentMethods: true },
    });

    const defaultMethod = customer?.paymentMethods.find((m) => m.isDefault) ||
      customer?.paymentMethods[0];

    const provider = getPaymentProvider();
    let transactionStatus = 'CAPTURED';
    let providerPaymentIntentId: string | null = null;
    let providerChargeId: string | null = null;
    let failureReason: string | null = null;

    // If gross amount > 0, process payment with provider
    if (grossAmountMinorUnits > 0 && defaultMethod && customer) {
      const paymentIdempotency = `tx_${session.id}`;
      try {
        const authRes = await provider.authorizePayment({
          customerId: customer.providerCustomerId,
          paymentMethodId: defaultMethod.providerMethodId,
          amountMinorUnits: grossAmountMinorUnits,
          currency: session.currency,
          idempotencyKey: paymentIdempotency,
          description: `PropertyTalk ${session.consultationType} Consultation with ${session.expert.user.name}`,
        });

        const captureRes = await provider.capturePayment({
          paymentIntentId: authRes.paymentIntentId,
          amountMinorUnits: grossAmountMinorUnits,
          idempotencyKey: `cap_${paymentIdempotency}`,
        });

        providerPaymentIntentId = authRes.paymentIntentId;
        providerChargeId = captureRes.chargeId;
      } catch (err: any) {
        console.error('Payment capture error:', err);
        transactionStatus = 'FAILED';
        failureReason = err.message || 'Payment capture failed';
      }
    }

    // Update Billing Session in DB
    const updatedSession = await prisma.consultationBillingSession.update({
      where: { id: session.id },
      data: {
        status: transactionStatus === 'CAPTURED' ? 'COMPLETED' : 'FAILED',
        paidEndedAt,
        paidSecondsUsed: elapsedSeconds,
        grossAmountMinorUnits,
        platformFeeMinorUnits,
        expertEarningMinorUnits,
      },
    });

    // Create Payment Transaction Record
    const txIdempotency = `tx_rec_${session.id}`;
    const transaction = await prisma.paymentTransaction.upsert({
      where: { idempotencyKey: txIdempotency },
      update: {
        status: transactionStatus,
        amountMinorUnits: grossAmountMinorUnits,
        providerPaymentIntentId,
        providerChargeId,
        failureReason,
      },
      create: {
        idempotencyKey: txIdempotency,
        billingSessionId: session.id,
        consumerId: session.consumerId,
        expertId: session.expertId,
        amountMinorUnits: grossAmountMinorUnits,
        currency: session.currency,
        provider: provider.isMock ? 'MOCK' : 'STRIPE',
        providerPaymentIntentId,
        providerChargeId,
        status: transactionStatus,
        failureReason,
      },
    });

    // Create Expert Earning Record if captured and amount > 0
    if (transactionStatus === 'CAPTURED' && grossAmountMinorUnits > 0) {
      await prisma.expertEarning.upsert({
        where: { billingSessionId: session.id },
        update: {
          grossMinorUnits: grossAmountMinorUnits,
          platformFeeMinorUnits,
          netEarningMinorUnits: expertEarningMinorUnits,
          status: 'AVAILABLE',
        },
        create: {
          expertId: session.expertId,
          billingSessionId: session.id,
          grossMinorUnits: grossAmountMinorUnits,
          platformFeeMinorUnits,
          netEarningMinorUnits: expertEarningMinorUnits,
          currency: session.currency,
          status: 'AVAILABLE',
        },
      });
    }

    // Also synchronize legacy costCharged field on parent model
    const costChargedFloat = grossAmountMinorUnits / 100;
    if (consultationType === 'CHAT') {
      await prisma.consultationChat.update({
        where: { id: consultationId },
        data: { costCharged: costChargedFloat },
      }).catch(() => {});
    } else {
      await prisma.callSession.update({
        where: { id: consultationId },
        data: { costCharged: costChargedFloat },
      }).catch(() => {});
    }

    // Notify room of completion and final receipt
    const room = consultationType === 'CHAT' ? `chat_${consultationId}` : `call_${consultationId}`;
    const event = consultationType === 'CHAT' ? 'chat:receipt_ready' : 'call:receipt_ready';

    if (this.io) {
      this.io.to(room).emit(event, {
        consultationId,
        consultationType,
        expertName: session.expert.user.name,
        freeSeconds: 60,
        paidSeconds: elapsedSeconds,
        grossAmount: costChargedFloat,
        currency: session.currency,
        currencySymbol: session.currency === 'AUD' ? 'A$' : 'NZ$',
        transactionId: transaction.id,
        status: transactionStatus,
      });
    }

    return updatedSession;
  }

  /**
   * Processes a full or partial refund for a captured payment transaction.
   */
  async processRefund(params: {
    transactionId: string;
    amountMinorUnits?: number;
    reason: string;
    adminUserId?: string;
  }) {
    const { transactionId, amountMinorUnits, reason, adminUserId } = params;

    const tx = await prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
      include: { billingSession: true, refunds: true },
    });

    if (!tx) {
      throw new Error('Transaction not found');
    }

    if (tx.status !== 'CAPTURED' && tx.status !== 'PARTIALLY_REFUNDED') {
      throw new Error(`Cannot refund transaction in '${tx.status}' status`);
    }

    const alreadyRefundedMinor = tx.refunds.reduce((acc, r) => acc + r.amountMinorUnits, 0);
    const availableToRefundMinor = tx.amountMinorUnits - alreadyRefundedMinor;

    const refundAmount = amountMinorUnits !== undefined ? amountMinorUnits : availableToRefundMinor;

    if (refundAmount <= 0) {
      throw new Error('Refund amount must be greater than zero');
    }
    if (refundAmount > availableToRefundMinor) {
      throw new Error(
        `Refund amount exceeds remaining refundable balance of $${(availableToRefundMinor / 100).toFixed(2)} ${tx.currency}`
      );
    }

    const provider = getPaymentProvider();
    const refundRes = await provider.refundPayment({
      paymentIntentId: tx.providerPaymentIntentId || tx.id,
      amountMinorUnits: refundAmount,
      currency: tx.currency,
      reason,
      idempotencyKey: `ref_${tx.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    });

    const refund = await prisma.refund.create({
      data: {
        transaction: { connect: { id: tx.id } },
        amountMinorUnits: refundAmount,
        currency: tx.currency,
        reason,
        ...(adminUserId ? { initiatedBy: { connect: { id: adminUserId } } } : {}),
        providerRefundId: refundRes.refundId,
        status: refundRes.status === 'succeeded' ? 'SUCCEEDED' : 'FAILED',
      },
    });

    const isFullRefund = alreadyRefundedMinor + refundAmount >= tx.amountMinorUnits;
    const nextStatus = isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    const updatedTx = await prisma.paymentTransaction.update({
      where: { id: tx.id },
      data: { status: nextStatus },
      include: { refunds: true, billingSession: true },
    });

    if (isFullRefund) {
      await prisma.expertEarning.updateMany({
        where: { billingSessionId: tx.billingSessionId },
        data: { status: 'REFUNDED' as any },
      });
    }

    if (adminUserId) {
      await prisma.verificationAuditLog.create({
        data: {
          expertProfileId: tx.expertId,
          adminUserId,
          action: 'REFUND',
          notes: `Issued ${isFullRefund ? 'full' : 'partial'} refund of $${(refundAmount / 100).toFixed(2)} ${tx.currency}. Reason: ${reason}`,
          source: 'Payment Administration',
        },
      }).catch(() => {});
    }

    return {
      success: true,
      refund,
      transaction: updatedTx,
      amountRefunded: refundAmount / 100,
    };
  }
}

export const billingService = new BillingService();
