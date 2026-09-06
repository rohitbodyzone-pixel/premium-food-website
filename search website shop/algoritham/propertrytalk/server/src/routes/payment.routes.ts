import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth } from '../middleware/auth.middleware';
import { getPaymentProvider } from '../services/payment/payment-provider.factory';
import { billingService } from '../services/billing.service';

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
      expertName: tx.expert.user.name,
      expertCategory: tx.expert.category.name,
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
      expertName: tx.expert.user.name,
      expertCategory: tx.expert.category.name,
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
