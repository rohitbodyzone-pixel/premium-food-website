import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { getPaymentProvider } from '../services/payment/payment-provider.factory';

const router = Router();

// Protect ALL routes with requireAuth and EXPERT role
router.use(requireAuth, requireRole('EXPERT'));

/**
 * Get expert earnings overview & ledger breakdown
 */
router.get('/earnings', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const expert = await prisma.expertProfile.findUnique({
      where: { userId },
    });

    if (!expert) {
      res.status(404).json({ error: 'Expert profile not found' });
      return;
    }

    const earnings = await prisma.expertEarning.findMany({
      where: { expertId: expert.id },
      include: {
        billingSession: {
          include: {
            consumer: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let todayGross = 0;
    let todayNet = 0;
    let weekGross = 0;
    let weekNet = 0;
    let monthGross = 0;
    let monthNet = 0;
    let availableNet = 0;

    for (const e of earnings) {
      const date = new Date(e.createdAt);
      if (date >= startOfToday) {
        todayGross += e.grossMinorUnits;
        todayNet += e.netEarningMinorUnits;
      }
      if (date >= startOfWeek) {
        weekGross += e.grossMinorUnits;
        weekNet += e.netEarningMinorUnits;
      }
      if (date >= startOfMonth) {
        monthGross += e.grossMinorUnits;
        monthNet += e.netEarningMinorUnits;
      }
      if (e.status === 'AVAILABLE') {
        availableNet += e.netEarningMinorUnits;
      }
    }

    const currency = expert.countryCode.toUpperCase() === 'AU' ? 'AUD' : 'NZD';
    const currencySymbol = currency === 'AUD' ? 'A$' : 'NZ$';

    const transactions = earnings.map((e) => {
      const consumerName = e.billingSession.consumer.name || 'Client';
      const firstName = consumerName.split(' ')[0] + ' ' + (consumerName.split(' ')[1]?.charAt(0) || '') + '.';

      return {
        id: e.id,
        date: e.createdAt,
        clientIdentifier: firstName,
        consultationType: e.billingSession.consultationType,
        paidSeconds: e.billingSession.paidSecondsUsed,
        grossAmount: e.grossMinorUnits / 100,
        platformFee: e.platformFeeMinorUnits / 100,
        netEarning: e.netEarningMinorUnits / 100,
        currency: e.currency,
        currencySymbol,
        status: e.status,
      };
    });

    res.json({
      currency,
      currencySymbol,
      summary: {
        today: todayNet / 100,
        thisWeek: weekNet / 100,
        thisMonth: monthNet / 100,
        available: availableNet / 100,
        totalConsultations: earnings.length,
      },
      payoutStatus: expert.payoutStatus,
      transactions,
    });
  } catch (error: any) {
    console.error('Error fetching expert earnings:', error);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

/**
 * Get expert rates
 */
router.get('/rates', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const expert = await prisma.expertProfile.findUnique({
      where: { userId },
    });

    if (!expert) {
      res.status(404).json({ error: 'Expert profile not found' });
      return;
    }

    const currency = expert.countryCode.toUpperCase() === 'AU' ? 'AUD' : 'NZD';

    res.json({
      currency,
      currencySymbol: currency === 'AUD' ? 'A$' : 'NZ$',
      chatRatePerMinute: (expert.chatRateMinorUnits || 250) / 100,
      audioRatePerMinute: (expert.audioRateMinorUnits || 250) / 100,
      videoRatePerMinute: (expert.videoRateMinorUnits || 300) / 100,
      chatRateMinorUnits: expert.chatRateMinorUnits || 250,
      audioRateMinorUnits: expert.audioRateMinorUnits || 250,
      videoRateMinorUnits: expert.videoRateMinorUnits || 300,
      paidConsultationsEnabled: expert.paidConsultationsEnabled,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch expert rates' });
  }
});

/**
 * Update expert consultation rates
 */
router.patch('/rates', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { chatRatePerMinute, audioRatePerMinute, videoRatePerMinute, paidConsultationsEnabled } = req.body;

    const expert = await prisma.expertProfile.findUnique({
      where: { userId },
    });

    if (!expert) {
      res.status(404).json({ error: 'Expert profile not found' });
      return;
    }

    const chatMinor = chatRatePerMinute ? Math.round(Number(chatRatePerMinute) * 100) : expert.chatRateMinorUnits;
    const audioMinor = audioRatePerMinute ? Math.round(Number(audioRatePerMinute) * 100) : expert.audioRateMinorUnits;
    const videoMinor = videoRatePerMinute ? Math.round(Number(videoRatePerMinute) * 100) : expert.videoRateMinorUnits;

    // Bounds checking (e.g., $1.00 to $20.00 / minute)
    const minMinor = 100;
    const maxMinor = 2000;

    if (chatMinor < minMinor || chatMinor > maxMinor ||
        audioMinor < minMinor || audioMinor > maxMinor ||
        videoMinor < minMinor || videoMinor > maxMinor) {
      res.status(400).json({ error: 'Consultation rates must be between $1.00/min and $20.00/min.' });
      return;
    }

    const updated = await prisma.expertProfile.update({
      where: { id: expert.id },
      data: {
        chatRateMinorUnits: chatMinor,
        audioRateMinorUnits: audioMinor,
        videoRateMinorUnits: videoMinor,
        callPerMinuteRate: videoMinor / 100, // keep legacy field in sync
        ...(paidConsultationsEnabled !== undefined ? { paidConsultationsEnabled: Boolean(paidConsultationsEnabled) } : {}),
      },
    });

    res.json({
      success: true,
      chatRatePerMinute: updated.chatRateMinorUnits / 100,
      audioRatePerMinute: updated.audioRateMinorUnits / 100,
      videoRatePerMinute: updated.videoRateMinorUnits / 100,
      paidConsultationsEnabled: updated.paidConsultationsEnabled,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update rates' });
  }
});

/**
 * Payout account onboarding status
 */
router.get('/payout-status', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const expert = await prisma.expertProfile.findUnique({
      where: { userId },
    });

    if (!expert) {
      res.status(404).json({ error: 'Expert profile not found' });
      return;
    }

    const provider = getPaymentProvider();
    let status = expert.payoutStatus;

    if (expert.stripeAccountId && !provider.isMock) {
      const remoteStatus = await provider.getConnectedAccountStatus(expert.stripeAccountId);
      status = remoteStatus.status;
      if (status !== expert.payoutStatus) {
        await prisma.expertProfile.update({
          where: { id: expert.id },
          data: { payoutStatus: status },
        });
      }
    }

    res.json({
      payoutStatus: status,
      isMock: provider.isMock,
      hasConnectedAccount: Boolean(expert.stripeAccountId),
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch payout status' });
  }
});

/**
 * Initiate payout account onboarding
 */
router.post('/payout-onboarding', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = req.user!;
    const expert = await prisma.expertProfile.findUnique({
      where: { userId },
    });

    if (!expert) {
      res.status(404).json({ error: 'Expert profile not found' });
      return;
    }

    const provider = getPaymentProvider();
    const result = await provider.createConnectedAccount(expert.id, user.email, expert.countryCode);

    await prisma.expertProfile.update({
      where: { id: expert.id },
      data: {
        stripeAccountId: result.accountId,
        payoutStatus: result.status,
      },
    });

    res.json({
      success: true,
      onboardingUrl: result.onboardingUrl,
      payoutStatus: result.status,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to start payout onboarding' });
  }
});

export default router;
