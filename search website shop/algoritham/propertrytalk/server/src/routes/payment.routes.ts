import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth } from '../middleware/auth.middleware';
import { getPaymentProvider } from '../services/payment/payment-provider.factory';
import { billingService } from '../services/billing.service';
import { chatTimerService } from '../services/chat-timer.service';

const router = Router();

/**
 * Public payment configuration & mode
 */
router.get('/config', async (_req: Request, res: Response) => {
  const provider = getPaymentProvider();
  const commissionPct = await billingService.getPlatformCommissionPct();

  res.json({
    isMock: provider.isMock,
    providerName: provider.name,
    supportedCurrencies: ['NZD', 'AUD'],
    platformCommissionPct: commissionPct,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
  });
});

// All following routes require authentication
router.use(requireAuth);

/**
 * Create SetupIntent for client-side card attachment
 */
router.post('/setup-intent', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const customer = await billingService.ensurePaymentCustomer(userId);
    const provider = getPaymentProvider();
    const result = await provider.createSetupIntent(customer.providerCustomerId);
    res.json(result);
  } catch (error: any) {
    console.error('Error creating setup intent:', error);
    res.status(500).json({ error: error.message || 'Failed to create setup intent' });
  }
});

/**
 * Get customer's saved payment methods (masked summaries only)
 */
router.get('/methods', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const customer = await billingService.ensurePaymentCustomer(userId);

    const methods = customer.paymentMethods.map((m: any) => ({
      id: m.id,
      brand: m.cardBrand,
      last4: m.cardLast4,
      expMonth: m.cardExpMonth,
      expYear: m.cardExpYear,
      isDefault: m.isDefault,
      createdAt: m.createdAt,
    }));

    res.json(methods);
  } catch (error: any) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch payment methods' });
  }
});

/**
 * Add a payment method (In mock mode, test card details; In Stripe mode, token or setup intent)
 * STRICT SECURITY: Never store raw card numbers or CVVs in DB!
 */
router.post('/methods', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { cardNumber, cardBrand, cardLast4, expMonth, expYear, token, setAsDefault } = req.body;

    const customer = await billingService.ensurePaymentCustomer(userId);
    const provider = getPaymentProvider();

    // Create payment method with provider
    const pmDetails = await provider.createPaymentMethod(customer.providerCustomerId, {
      cardNumber,
      cardBrand,
      cardLast4,
      expMonth: expMonth ? parseInt(expMonth, 10) : 12,
      expYear: expYear ? parseInt(expYear, 10) : 2028,
      token,
    });

    const isFirstMethod = customer.paymentMethods.length === 0;
    const makeDefault = Boolean(setAsDefault || isFirstMethod);

    if (makeDefault) {
      await prisma.paymentMethodReference.updateMany({
        where: { paymentCustomerId: customer.id },
        data: { isDefault: false },
      });
    }

    const saved = await prisma.paymentMethodReference.create({
      data: {
        paymentCustomerId: customer.id,
        providerMethodId: pmDetails.paymentMethodId,
        cardBrand: pmDetails.brand,
        cardLast4: pmDetails.last4,
        cardExpMonth: pmDetails.expMonth,
        cardExpYear: pmDetails.expYear,
        isDefault: makeDefault,
      },
    });

    if (makeDefault) {
      await prisma.paymentCustomer.update({
        where: { id: customer.id },
        data: { defaultPaymentMethodId: saved.id },
      });
    }

    res.status(201).json({
      id: saved.id,
      brand: saved.cardBrand,
      last4: saved.cardLast4,
      expMonth: saved.cardExpMonth,
      expYear: saved.cardExpYear,
      isDefault: saved.isDefault,
    });
  } catch (error: any) {
    console.error('Error saving payment method:', error);
    res.status(500).json({ error: error.message || 'Failed to save payment method' });
  }
});

/**
 * Set a payment method as default
 */
router.patch('/methods/:id/default', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const customer = await prisma.paymentCustomer.findUnique({
      where: { userId },
      include: { paymentMethods: true },
    });

    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const method = customer.paymentMethods.find((m) => m.id === id);
    if (!method) {
      res.status(404).json({ error: 'Payment method not found' });
      return;
    }

    await prisma.paymentMethodReference.updateMany({
      where: { paymentCustomerId: customer.id },
      data: { isDefault: false },
    });

    const updated = await prisma.paymentMethodReference.update({
      where: { id },
      data: { isDefault: true },
    });

    await prisma.paymentCustomer.update({
      where: { id: customer.id },
      data: { defaultPaymentMethodId: id },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to set default payment method' });
  }
});

/**
 * Remove a payment method
 */
router.delete('/methods/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const customer = await prisma.paymentCustomer.findUnique({
      where: { userId },
      include: { paymentMethods: true },
    });

    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const method = customer.paymentMethods.find((m) => m.id === id);
    if (!method) {
      res.status(404).json({ error: 'Payment method not found' });
      return;
    }

    const provider = getPaymentProvider();
    await provider.detachPaymentMethod(method.providerMethodId).catch(() => {});

    await prisma.paymentMethodReference.delete({ where: { id } });

    // If default was deleted, set next available as default
    if (method.isDefault) {
      const remaining = await prisma.paymentMethodReference.findFirst({
        where: { paymentCustomerId: customer.id },
        orderBy: { createdAt: 'desc' },
      });
      if (remaining) {
        await prisma.paymentMethodReference.update({
          where: { id: remaining.id },
          data: { isDefault: true },
        });
        await prisma.paymentCustomer.update({
          where: { id: customer.id },
          data: { defaultPaymentMethodId: remaining.id },
        });
      }
    }

    res.json({ success: true, message: 'Payment method removed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete payment method' });
  }
});

/**
 * Pre-continuation quote: Customer sees exact rate, currency, billing rule, and selected card
 */
router.post('/consultations/:id/prepare-paid', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type } = req.body; // 'CHAT', 'AUDIO', 'VIDEO'
    const consumerId = req.user!.id;

    const quote = await billingService.preparePaidQuote({
      consultationId: id,
      consultationType: (type || 'VIDEO').toUpperCase() as any,
      consumerId,
    });

    res.json(quote);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to prepare paid quote' });
  }
});

/**
 * Customer explicit confirmation to initiate paid continuation
 */
router.post('/consultations/:id/confirm-paid', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type, paymentMethodId } = req.body;
    const consumerId = req.user!.id;

    const result = await billingService.confirmPaidContinuation({
      consultationId: id,
      consultationType: (type || 'VIDEO').toUpperCase() as any,
      consumerId,
      paymentMethodId,
    });

    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to confirm paid continuation' });
  }
});

/**
 * Customer explicit confirmation to create a PaymentIntent for paid consultation
 * Preserves 60 seconds free. Charges nothing automatically. Only created upon explicit customer confirmation.
 */
router.post('/consultations/:id/create-payment-intent', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type = 'CHAT', confirmed } = req.body;
    const consumerId = req.user!.id;

    if (!confirmed) {
      res.status(400).json({ error: 'Explicit customer confirmation is required to initiate a paid consultation PaymentIntent' });
      return;
    }

    // 1. Check if chat is already paid/active
    if (type === 'CHAT') {
      const chat = await prisma.consultationChat.findUnique({ where: { id } });
      if (chat && chat.extendedPaid && chat.status === 'PAID_ACTIVE') {
        res.status(200).json({
          success: true,
          alreadyPaid: true,
          status: 'PAID_ACTIVE',
          message: 'Consultation is already in active paid status',
        });
        return;
      }
    }

    // 2. Fetch server-calculated quote based on expert rates
    const quote = await billingService.preparePaidQuote({
      consultationId: id,
      consultationType: (type || 'CHAT').toUpperCase() as any,
      consumerId,
    });

    // 3. Duplicate protection: Check if there's an existing PENDING PaymentTransaction created in the last 15 minutes
    const existingPendingTx = await prisma.paymentTransaction.findFirst({
      where: {
        consumerId,
        paymentType: 'CONSULTATION_PAID_CONTINUATION',
        status: 'PENDING',
        providerPaymentIntentId: { not: null },
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingPendingTx && existingPendingTx.providerPaymentIntentId) {
      try {
        const paymentProvider = getPaymentProvider();
        const existingPi = await paymentProvider.retrievePaymentIntent(existingPendingTx.providerPaymentIntentId);
        if (
          existingPi &&
          (existingPi.status === 'requires_payment_method' ||
            existingPi.status === 'requires_confirmation' ||
            existingPi.status === 'requires_action')
        ) {
          res.json({
            success: true,
            paymentIntentId: existingPendingTx.providerPaymentIntentId,
            clientSecret: (existingPi as any).clientSecret || '',
            amountMinorUnits: existingPendingTx.amountMinorUnits,
            currency: existingPendingTx.currency,
            rateMinorUnitsPerMinute: quote.rateMinorUnitsPerMinute,
            freeSecondsPreserved: 60,
            autoChargedAtExpiry: false,
            message: 'Existing pending PaymentIntent reused',
          });
          return;
        }
      } catch (e) {
        // If retrieving failed, proceed to create fresh intent
      }
    }

    // 4. Initial paid increment: 5-minute pre-authorized deposit
    const amountMinorUnits = quote.rateMinorUnitsPerMinute * 5;
    const idempotencyKey = `pi_consult_${id}_${consumerId}_${Date.now()}`;
    const paymentProvider = getPaymentProvider();

    // 5. Create PaymentIntent via payment provider
    const piResult = await paymentProvider.createPaymentIntent({
      amountMinorUnits,
      currency: quote.currency.toLowerCase(),
      description: `PropertyTalk Paid Consultation (${type}): with ${quote.expertName}`,
      metadata: {
        type: 'CONSULTATION_PAID_CONTINUATION',
        consultationId: id,
        consultationType: type,
        consumerId,
        expertId: quote.expertId,
        rateMinorUnitsPerMinute: String(quote.rateMinorUnitsPerMinute),
        currency: quote.currency,
      },
      idempotencyKey,
    });

    // 6. Record PaymentTransaction with status PENDING so webhook & confirmation endpoints can track it!
    await prisma.paymentTransaction.create({
      data: {
        idempotencyKey: `tx_${piResult.paymentIntentId}`,
        consumerId,
        expertId: quote.expertId,
        paymentType: 'CONSULTATION_PAID_CONTINUATION',
        amountMinorUnits,
        currency: quote.currency,
        provider: paymentProvider.isMock ? 'MOCK' : 'STRIPE',
        providerPaymentIntentId: piResult.paymentIntentId,
        status: 'PENDING',
      },
    });

    // 7. Broadcast payment pending to consultation room
    const io = req.app.get('io');
    if (io) {
      io.to(`consultation_${id}`).to(`chat_${id}`).emit('chat:payment_pending', {
        chatId: id,
        consultationId: id,
        status: 'PAYMENT_PENDING',
      });
    }

    res.json({
      success: true,
      clientSecret: piResult.clientSecret,
      paymentIntentId: piResult.paymentIntentId,
      amountMinorUnits,
      currency: quote.currency,
      rateMinorUnitsPerMinute: quote.rateMinorUnitsPerMinute,
      freeSecondsPreserved: 60,
      autoChargedAtExpiry: false,
      message: 'Consultation PaymentIntent created successfully following explicit customer confirmation',
    });
  } catch (error: any) {
    console.error('Error creating consultation payment intent:', error);
    res.status(400).json({ error: error.message || 'Failed to create consultation payment intent' });
  }
});

/**
 * Customer confirms successful payment intent and activates paid continuation
 */
router.post('/consultations/:id/confirm-payment', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { paymentIntentId, type = 'CHAT' } = req.body;
    const consumerId = req.user!.id;

    if (!paymentIntentId) {
      res.status(400).json({ error: 'paymentIntentId is required' });
      return;
    }

    const provider = getPaymentProvider();
    let isSucceeded = false;

    if (provider.isMock) {
      isSucceeded = true;
    } else {
      const pi = await provider.retrievePaymentIntent(paymentIntentId);
      if (pi.status === 'succeeded' || pi.status === 'requires_confirmation' || pi.status === 'requires_capture') {
        isSucceeded = true;
      } else {
        res.status(400).json({
          error: `PaymentIntent status is ${pi.status}, not succeeded.`,
          status: pi.status,
        });
        return;
      }
    }

    // Update PaymentTransaction to CAPTURED
    const tx = await prisma.paymentTransaction.findFirst({
      where: { providerPaymentIntentId: paymentIntentId },
    });

    if (tx) {
      await prisma.paymentTransaction.update({
        where: { id: tx.id },
        data: { status: 'CAPTURED' },
      });
    }

    // Fetch quote to get rate
    const quote = await billingService.preparePaidQuote({
      consultationId: id,
      consultationType: (type || 'CHAT').toUpperCase() as any,
      consumerId,
    });

    const commissionPct = await billingService.getPlatformCommissionPct();
    const billingIdempotencyKey = `bill_sess_${type.toLowerCase()}_${id}`;
    const now = new Date();

    await prisma.consultationBillingSession.upsert({
      where: { idempotencyKey: billingIdempotencyKey },
      update: {
        status: 'PAID_ACTIVE',
        paidConfirmedAt: now,
        paidStartedAt: now,
        rateMinorUnitsPerMinute: quote.rateMinorUnitsPerMinute,
        currency: quote.currency,
        commissionPct,
      },
      create: {
        idempotencyKey: billingIdempotencyKey,
        consultationType: type.toUpperCase() as any,
        chatId: type === 'CHAT' ? id : undefined,
        callSessionId: type !== 'CHAT' ? id : undefined,
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

    // Update ConsultationChat
    if (type === 'CHAT') {
      await prisma.consultationChat.update({
        where: { id },
        data: {
          extendedPaid: true,
          isFreeExpired: false,
          status: 'PAID_ACTIVE',
        },
      });

      const timer = chatTimerService.getTimerState(id);
      if (timer) {
        timer.extendedPaid = true;
        timer.isFreeExpired = false;
      }
    }

    // Broadcast socket event to both rooms
    const io = req.app.get('io');
    if (io) {
      io.to(`consultation_${id}`).to(`chat_${id}`).emit('chat:paid_continuation_activated', {
        chatId: id,
        consultationId: id,
        consultationType: type,
        status: 'PAID_ACTIVE',
        rateMinorUnitsPerMinute: quote.rateMinorUnitsPerMinute,
        currency: quote.currency,
        currencySymbol: quote.currencySymbol,
        paidStartedAt: now.toISOString(),
      });
    }

    res.json({
      success: true,
      status: 'PAID_ACTIVE',
      rateMinorUnitsPerMinute: quote.rateMinorUnitsPerMinute,
      currency: quote.currency,
      message: 'Paid consultation continuation activated successfully',
    });
  } catch (error: any) {
    console.error('Error confirming payment:', error);
    res.status(400).json({ error: error.message || 'Failed to confirm consultation payment' });
  }
});

/**
 * Customer's consultation transaction history
 */
router.get('/transactions/my', async (req: Request, res: Response) => {
  try {
    const consumerId = req.user!.id;
    const transactions = await prisma.paymentTransaction.findMany({
      where: { consumerId },
      include: {
        expert: {
          include: {
            user: { select: { name: true, email: true } },
            category: true,
          },
        },
        billingSession: true,
        refunds: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = transactions.map((tx) => ({
      id: tx.id,
      amount: tx.amountMinorUnits / 100,
      currency: tx.currency,
      currencySymbol: tx.currency === 'AUD' ? 'A$' : 'NZ$',
      status: tx.status,
      consultationType: tx.billingSession?.consultationType || 'CONSULTATION',
      freeSeconds: tx.billingSession?.freeSecondsUsed || 60,
      paidSeconds: tx.billingSession?.paidSecondsUsed || 0,
      ratePerMinute: tx.billingSession ? tx.billingSession.rateMinorUnitsPerMinute / 100 : 0,
      expertName: tx.expert ? tx.expert.user.name : 'PropertyTalk Live Viewing',
      expertCategory: tx.expert ? tx.expert.category.name : 'Live Viewing',
      createdAt: tx.createdAt,
      refundedAmount: tx.refunds.reduce((acc, r) => acc + r.amountMinorUnits, 0) / 100,
    }));

    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch transaction history' });
  }
});

/**
 * Detailed single receipt
 */
router.get('/receipt/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const consumerId = req.user!.id;

    const tx = await prisma.paymentTransaction.findUnique({
      where: { id },
      include: {
        expert: {
          include: {
            user: { select: { name: true, email: true } },
            category: true,
          },
        },
        billingSession: true,
        refunds: true,
      },
    });

    if (!tx || (tx.consumerId !== consumerId && req.user!.role !== 'SUPER_ADMIN')) {
      res.status(404).json({ error: 'Receipt not found' });
      return;
    }

    res.json({
      receiptNumber: `REC-${tx.id.substring(0, 8).toUpperCase()}`,
      transactionId: tx.id,
      date: tx.createdAt,
      expertName: tx.expert ? tx.expert.user.name : 'PropertyTalk Live Viewing',
      expertCategory: tx.expert ? tx.expert.category.name : 'Live Viewing',
      consultationType: tx.billingSession?.consultationType || 'CONSULTATION',
      freeDurationSeconds: tx.billingSession?.freeSecondsUsed || 60,
      paidDurationSeconds: tx.billingSession?.paidSecondsUsed || 0,
      ratePerMinute: tx.billingSession ? tx.billingSession.rateMinorUnitsPerMinute / 100 : 0,
      grossAmount: tx.amountMinorUnits / 100,
      currency: tx.currency,
      currencySymbol: tx.currency === 'AUD' ? 'A$' : 'NZ$',
      status: tx.status,
      paymentProvider: tx.provider,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load receipt' });
  }
});

export default router;
