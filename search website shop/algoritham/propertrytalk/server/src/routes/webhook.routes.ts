import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';

const router = Router();

/**
 * Stripe Webhook Handler (Endpoint: /api/webhooks/stripe)
 */
router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: any = req.body;

  if (webhookSecret && sig) {
    try {
      const Stripe = require('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' });
      event = stripe.webhooks.constructEvent((req as any).rawBody || req.body, sig, webhookSecret);
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
        if (paymentIntent) {
          await prisma.paymentTransaction.updateMany({
            where: { providerPaymentIntentId: paymentIntent.id },
            data: { status: 'CAPTURED' },
          });
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data?.object;
        if (paymentIntent) {
          await prisma.paymentTransaction.updateMany({
            where: { providerPaymentIntentId: paymentIntent.id },
            data: {
              status: 'FAILED',
              failureReason: paymentIntent.last_payment_error?.message || 'Payment intent failed',
            },
          });
        }
        break;
      }
      case 'charge.refunded': {
        const charge = event.data?.object;
        if (charge && charge.payment_intent) {
          await prisma.paymentTransaction.updateMany({
            where: { providerPaymentIntentId: charge.payment_intent },
            data: { status: 'REFUNDED' },
          });
        }
        break;
      }
      default:
        // Ignore unhandled event types
        break;
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing error' });
  }
});

export default router;
