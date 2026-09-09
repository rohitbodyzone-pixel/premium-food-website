import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import Stripe from 'stripe';

const router = Router();

/**
 * Stripe Webhook Handler (Endpoint: /api/webhooks/stripe)
 */
router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: any = req.body;

  if (webhookSecret) {
    if (!sig) {
      res.status(400).send('Webhook Error: Missing stripe-signature header');
      return;
    }
    try {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) {
        res.status(500).json({ error: 'Stripe secret key not configured' });
        return;
      }
      const stripe = new Stripe(stripeKey, { apiVersion: '2024-11-20.acacia' as any });
      const rawBody = (req as any).rawBody || (typeof req.body === 'string' ? Buffer.from(req.body) : Buffer.from(JSON.stringify(req.body)));
      event = stripe.webhooks.constructEvent(rawBody, sig as string, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }
  }

  // Process event idempotently
  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data?.object;
        if (paymentIntent?.id) {
          const tx = await prisma.paymentTransaction.findFirst({
            where: { providerPaymentIntentId: paymentIntent.id },
            include: { billingSession: true },
          });
          if (tx && tx.status !== 'CAPTURED') {
            await prisma.paymentTransaction.update({
              where: { id: tx.id },
              data: {
                status: 'CAPTURED',
                providerChargeId:
                  typeof paymentIntent.latest_charge === 'string'
                    ? paymentIntent.latest_charge
                    : paymentIntent.latest_charge?.id || tx.providerChargeId,
              },
            });
            if (tx.billingSession && tx.billingSession.status !== 'COMPLETED') {
              await prisma.consultationBillingSession.update({
                where: { id: tx.billingSession.id },
                data: { status: 'COMPLETED' },
              });
            }
          }
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data?.object;
        if (paymentIntent?.id) {
          const tx = await prisma.paymentTransaction.findFirst({
            where: { providerPaymentIntentId: paymentIntent.id },
            include: { billingSession: true },
          });
          if (tx && tx.status !== 'FAILED') {
            await prisma.paymentTransaction.update({
              where: { id: tx.id },
              data: {
                status: 'FAILED',
                failureReason: paymentIntent.last_payment_error?.message || 'Payment intent failed',
              },
            });
            if (tx.billingSession && tx.billingSession.status !== 'FAILED') {
              await prisma.consultationBillingSession.update({
                where: { id: tx.billingSession.id },
                data: { status: 'FAILED' },
              });
            }
          }
        }
        break;
      }
      case 'charge.refunded': {
        const charge = event.data?.object;
        const piId = charge?.payment_intent;
        if (piId) {
          const tx = await prisma.paymentTransaction.findFirst({
            where: { providerPaymentIntentId: piId },
            include: { refunds: true },
          });
          if (tx) {
            const isFullRefund = charge.amount_refunded >= charge.amount;
            const targetStatus = isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
            if (tx.status !== targetStatus) {
              await prisma.paymentTransaction.update({
                where: { id: tx.id },
                data: { status: targetStatus },
              });
              if (isFullRefund) {
                await prisma.expertEarning.updateMany({
                  where: { billingSessionId: tx.billingSessionId },
                  data: { status: 'REFUNDED' as any },
                });
              }
            }
          }
        }
        break;
      }
      default:
        break;
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing error' });
  }
});

export default router;
