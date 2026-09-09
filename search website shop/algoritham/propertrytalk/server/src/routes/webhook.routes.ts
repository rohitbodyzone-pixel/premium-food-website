import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import Stripe from 'stripe';

const router = Router();

/**
 * Stripe Webhook Handler (Endpoint: /api/webhooks/stripe)
 */
router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_CLI_WEBHOOK_SECRET,
  ].filter(Boolean) as string[];

  let event: any = req.body;

  if (secrets.length > 0) {
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

      let verified = false;
      let lastErr: any = null;
      for (const secret of secrets) {
        try {
          event = stripe.webhooks.constructEvent(rawBody, sig as string, secret);
          verified = true;
          break;
        } catch (err: any) {
          lastErr = err;
        }
      }

      if (!verified) {
        console.error('Webhook signature verification failed:', lastErr?.message);
        res.status(400).send(`Webhook Error: ${lastErr?.message}`);
        return;
      }
    } catch (err: any) {
      console.error('Webhook error:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }
  }

  const isSynthetic = Boolean(req.headers['x-synthetic-test']);
  const deliveryClassification = isSynthetic ? 'LOCALLY SYNTHETIC SIGNED WEBHOOK' : 'REAL STRIPE-DELIVERED WEBHOOK';
  console.log(`[Webhook Delivery] ${deliveryClassification} | Event: ${event.type} (${event.id})`);

  // Process event idempotently with atomic lifecycle
  if (event.id) {
    try {
      await prisma.processedWebhookEvent.create({
        data: {
          id: event.id,
          eventType: event.type || 'unknown',
          status: 'PROCESSING',
        },
      });
    } catch (createErr: any) {
      const existing = await prisma.processedWebhookEvent.findUnique({
        where: { id: event.id },
      });
      if (existing) {
        if (existing.status === 'PROCESSING' || existing.status === 'PROCESSED') {
          res.status(200).json({ received: true, duplicate: true, status: existing.status });
          return;
        }
        // If previously failed, allow retry
        await prisma.processedWebhookEvent.update({
          where: { id: event.id },
          data: { status: 'PROCESSING', processedAt: new Date() },
        });
      } else {
        throw createErr;
      }
    }
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data?.object;
        if (paymentIntent?.id) {
          const tx = await prisma.paymentTransaction.findFirst({
            where: { providerPaymentIntentId: paymentIntent.id },
            include: { billingSession: true },
          });

          const chargeId =
            typeof paymentIntent.latest_charge === 'string'
              ? paymentIntent.latest_charge
              : paymentIntent.latest_charge?.id || tx?.providerChargeId;

          if (tx && tx.status !== 'CAPTURED') {
            await prisma.paymentTransaction.update({
              where: { id: tx.id },
              data: {
                status: 'CAPTURED',
                providerChargeId: chargeId,
              },
            });

            // 1. If Consultation
            if (tx.billingSession && tx.billingSession.status !== 'COMPLETED') {
              await prisma.consultationBillingSession.update({
                where: { id: tx.billingSession.id },
                data: { status: 'COMPLETED' },
              });
            }

            // 2. If Live Viewing Ticket: payment succeeds, agentApprovalStatus MUST remain PENDING!
            if (tx.liveViewingParticipantId) {
              await prisma.liveViewingParticipant.update({
                where: { id: tx.liveViewingParticipantId },
                data: {
                  paymentStatus: 'PAID',
                  // agentApprovalStatus remains PENDING until host approves or declines!
                },
              });

              await prisma.notification.create({
                data: {
                  userId: tx.consumerId,
                  type: 'PAYMENT_RECEIPT',
                  title: 'Live Viewing Payment Received',
                  body: `Your payment of $${(tx.amountMinorUnits / 100).toFixed(2)} NZD has succeeded. Your ticket is awaiting host agent approval before confirmation.`,
                  dataJson: JSON.stringify({ sessionId: tx.liveViewingSessionId, transactionId: tx.id }),
                },
              }).catch(() => {});
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
          const errorMsg = paymentIntent.last_payment_error?.message || 'Payment intent failed';
          if (tx && tx.status !== 'FAILED') {
            await prisma.paymentTransaction.update({
              where: { id: tx.id },
              data: {
                status: 'FAILED',
                failureReason: errorMsg,
              },
            });
            if (tx.billingSession && tx.billingSession.status !== 'FAILED') {
              await prisma.consultationBillingSession.update({
                where: { id: tx.billingSession.id },
                data: { status: 'FAILED' },
              });
            }
            if (tx.liveViewingParticipantId) {
              await prisma.liveViewingParticipant.update({
                where: { id: tx.liveViewingParticipantId },
                data: { paymentStatus: 'FAILED' },
              });
            }
          }
        }
        break;
      }
      case 'payment_intent.canceled': {
        const paymentIntent = event.data?.object;
        if (paymentIntent?.id) {
          const tx = await prisma.paymentTransaction.findFirst({
            where: { providerPaymentIntentId: paymentIntent.id },
            include: { billingSession: true },
          });
          if (tx && tx.status !== 'CANCELLED') {
            await prisma.paymentTransaction.update({
              where: { id: tx.id },
              data: {
                status: 'CANCELLED',
                failureReason: 'Payment cancelled',
              },
            });
            if (tx.billingSession && tx.billingSession.status !== 'CANCELLED') {
              await prisma.consultationBillingSession.update({
                where: { id: tx.billingSession.id },
                data: { status: 'CANCELLED' },
              });
            }
            if (tx.liveViewingParticipantId) {
              await prisma.liveViewingParticipant.update({
                where: { id: tx.liveViewingParticipantId },
                data: { paymentStatus: 'CANCELLED' },
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
            const refundedAmount = charge.amount_refunded || tx.amountMinorUnits;
            const isFullRefund = refundedAmount >= tx.amountMinorUnits;
            const targetStatus = isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
            const remainingAmount = Math.max(0, tx.amountMinorUnits - refundedAmount);

            await prisma.paymentTransaction.update({
              where: { id: tx.id },
              data: {
                status: targetStatus,
                refundedAmountMinorUnits: refundedAmount,
                remainingAmountMinorUnits: remainingAmount,
              },
            });

            if (isFullRefund && tx.billingSessionId) {
              await prisma.expertEarning.updateMany({
                where: { billingSessionId: tx.billingSessionId },
                data: { status: 'REFUNDED' as any },
              });
            }

            if (tx.liveViewingParticipantId) {
              await prisma.liveViewingParticipant.update({
                where: { id: tx.liveViewingParticipantId },
                data: {
                  paymentStatus: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
                  agentApprovalStatus: isFullRefund ? 'DECLINED' : undefined,
                  refundStatus: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
                },
              });
            }
          }
        }
        break;
      }
      default:
        break;
    }

    if (event.id) {
      await prisma.processedWebhookEvent.update({
        where: { id: event.id },
        data: { status: 'PROCESSED' },
      });
    }

    res.json({ received: true, status: 'PROCESSED' });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    if (event.id) {
      await prisma.processedWebhookEvent.update({
        where: { id: event.id },
        data: { status: 'FAILED' },
      }).catch(() => {});
    }
    res.status(500).json({ error: 'Webhook processing error' });
  }
});

export default router;
