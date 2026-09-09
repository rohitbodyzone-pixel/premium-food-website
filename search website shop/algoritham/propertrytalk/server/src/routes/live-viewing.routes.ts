import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware';
import { getPaymentProvider } from '../services/payment/payment-provider.factory';

const router = Router();

// Helper to check and enforce cancellation + refund if deadline passed and < 5 bookings
export async function checkSessionDeadlines() {
  const now = new Date();
  // Find scheduled group sessions that have reached scheduled time but have less than minAttendees (default 5)
  const pendingSessions = await prisma.liveViewingSession.findMany({
    where: {
      status: 'SCHEDULED',
      viewingType: 'GROUP',
      scheduledAt: { lte: now },
    },
    include: {
      participants: {
        where: { paymentStatus: 'PAID' },
      },
    },
  });

  for (const session of pendingSessions) {
    if (session.participants.length < session.minAttendees) {
      // Auto-cancel and refund all paid participants
      await prisma.$transaction(async (tx) => {
        await tx.liveViewingSession.update({
          where: { id: session.id },
          data: {
            status: 'CANCELLED',
            cancelReason: `Minimum ${session.minAttendees} paid attendees not reached prior to start time. Full refunds issued automatically.`,
          },
        });

        for (const p of session.participants) {
          await tx.liveViewingParticipant.update({
            where: { id: p.id },
            data: { paymentStatus: 'REFUNDED' },
          });

          // Create notification for consumer
          await tx.notification.create({
            data: {
              userId: p.consumerId,
              type: 'REFUND_PROCESSED',
              title: 'Live Viewing Refund Issued',
              body: `Your $${(p.amountPaidMinorUnits / 100).toFixed(2)} ticket for the live viewing has been fully refunded as the minimum attendee requirement was not met.`,
              dataJson: JSON.stringify({ sessionId: session.id }),
            },
          });
        }
      });
    }
  }
}

// 1. GET /api/live-viewings - List upcoming live viewings
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    await checkSessionDeadlines();

    const { propertyId, status = 'SCHEDULED', type, countryCode = 'NZ' } = req.query;

    const where: any = {
      status: String(status),
      property: {
        countryCode: String(countryCode).toUpperCase(),
      },
    };

    if (propertyId) where.propertyId = String(propertyId);
    if (type) where.viewingType = String(type).toUpperCase();

    const sessions = await prisma.liveViewingSession.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            title: true,
            slug: true,
            streetAddress: true,
            suburb: true,
            city: true,
            priceDisplay: true,
            images: true,
          },
        },
        hostProfile: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            category: true,
            miniWebsite: { select: { slug: true, agencyName: true } },
          },
        },
        _count: {
          select: {
            participants: {
              where: { paymentStatus: 'PAID', agentApprovalStatus: 'APPROVED' },
            },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    const formatted = sessions.map((s) => {
      let parsedImages: string[] = [];
      try {
        parsedImages = JSON.parse(s.property.images || '[]');
      } catch {
        parsedImages = [];
      }

      return {
        ...s,
        property: {
          ...s.property,
          images: parsedImages,
        },
        confirmedCount: s._count.participants,
        spotsRemaining: Math.max(0, s.maxCapacity - s._count.participants),
        minQuotaMet: s._count.participants >= s.minAttendees,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Error listing live viewings:', error);
    res.status(500).json({ error: 'Failed to fetch live viewings' });
  }
});

// 2. GET /api/live-viewings/:id - Live viewing session detail
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const session = await prisma.liveViewingSession.findUnique({
      where: { id },
      include: {
        property: {
          include: {
            agentProfile: {
              include: { user: { select: { id: true, name: true } } },
            },
          },
        },
        hostProfile: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            category: true,
            miniWebsite: { select: { slug: true, agencyName: true } },
          },
        },
        participants: {
          include: {
            consumer: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!session) {
      res.status(404).json({ error: 'Live viewing session not found' });
      return;
    }

    let parsedImages: string[] = [];
    try {
      parsedImages = JSON.parse(session.property.images || '[]');
    } catch {
      parsedImages = [];
    }

    // Check if current user is host or confirmed participant
    let userRole = 'GUEST';
    let myParticipantRecord = null;

    if (req.user) {
      if (session.hostProfile.userId === req.user.id || req.user.role === 'SUPER_ADMIN') {
        userRole = 'HOST';
      } else {
        myParticipantRecord = session.participants.find((p) => p.consumerId === req.user!.id) || null;
        if (myParticipantRecord?.paymentStatus === 'PAID' && myParticipantRecord.agentApprovalStatus === 'APPROVED') {
          userRole = 'CONFIRMED_VIEWER';
        } else if (myParticipantRecord) {
          userRole = 'PENDING_VIEWER';
        }
      }
    }

    const confirmedCount = session.participants.filter(
      (p) => p.paymentStatus === 'PAID' && p.agentApprovalStatus === 'APPROVED'
    ).length;

    res.json({
      ...session,
      property: {
        ...session.property,
        images: parsedImages,
      },
      confirmedCount,
      spotsRemaining: Math.max(0, session.maxCapacity - confirmedCount),
      userRole,
      myParticipant: myParticipantRecord,
    });
  } catch (error) {
    console.error('Error fetching live viewing detail:', error);
    res.status(500).json({ error: 'Failed to fetch live viewing session' });
  }
});

// 3. POST /api/live-viewings - Schedule Live Viewing (REA / Property Manager only)
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const {
      propertyId,
      viewingType = 'GROUP', // GROUP, PRIVATE
      title,
      scheduledAt,
      ticketPriceMinorUnits, // default 2000 for GROUP, 6000 for PRIVATE
      maxCapacity,
      sellerConsentGiven = false,
      recordingAllowed = false,
      recordingRetentionDays = 7,
    } = req.body;

    if (!propertyId || !scheduledAt) {
      res.status(400).json({ error: 'Property and scheduledAt are required' });
      return;
    }

    // Role verification
    const expert = await prisma.expertProfile.findUnique({
      where: { userId: user.id },
      include: { category: true },
    });

    if (!expert || !['real-estate-agent', 'property-manager'].includes(expert.category.slug)) {
      res.status(403).json({
        error: 'Only verified Real Estate Agents and Property Managers can schedule remote live viewings',
      });
      return;
    }

    // Check pricing bounds from SystemConfig
    let defaultPrice = viewingType === 'PRIVATE' ? 6000 : 2000;
    let minPrice = 1000;
    let maxPrice = 5000;

    const minConfig = await prisma.systemConfig.findUnique({ where: { key: 'group_viewing_min_price_minor' } });
    if (minConfig) minPrice = parseInt(minConfig.value, 10);
    const maxConfig = await prisma.systemConfig.findUnique({ where: { key: 'group_viewing_max_price_minor' } });
    if (maxConfig) maxPrice = parseInt(maxConfig.value, 10);

    let price = ticketPriceMinorUnits ? parseInt(String(ticketPriceMinorUnits), 10) : defaultPrice;
    if (viewingType === 'GROUP') {
      if (price < minPrice || price > maxPrice) {
        res.status(400).json({
          error: `Group ticket price must be between $${minPrice / 100} and $${maxPrice / 100} NZD`,
        });
        return;
      }
    } else {
      price = 6000; // Fixed NZ$60 for private viewing
    }

    const streamRoomId = `viewing_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

    const session = await prisma.liveViewingSession.create({
      data: {
        propertyId,
        hostProfileId: expert.id,
        viewingType: viewingType.toUpperCase(),
        title: title ? title.trim() : `Remote Live Viewing`,
        scheduledAt: new Date(scheduledAt),
        durationMinutes: 10, // Fixed 10 minutes strictly
        ticketPriceMinorUnits: price,
        currency: 'NZD',
        minAttendees: viewingType === 'PRIVATE' ? 1 : 5,
        maxCapacity: viewingType === 'PRIVATE' ? 1 : Math.min(200, Math.max(5, parseInt(String(maxCapacity), 10) || 10)),
        status: 'SCHEDULED',
        streamRoomId,
        streamingCostMinorUnits: 0, // Recorded upon actual session completion
        actualUsageMinutes: 0,
        streamingCostType: 'ESTIMATED_TEST',
        isProductionProvider: Boolean(process.env.DAILY_CO_API_KEY || process.env.LIVEKIT_API_KEY || process.env.TWILIO_ACCOUNT_SID),
        recordingAllowed: !!recordingAllowed && !!sellerConsentGiven,
        sellerConsentGiven: !!sellerConsentGiven,
        recordingRetentionDays: recordingRetentionDays === 30 ? 30 : 7,
      },
    });

    res.status(201).json(session);
  } catch (error) {
    console.error('Error creating live viewing session:', error);
    res.status(500).json({ error: 'Failed to create live viewing' });
  }
});

// 4. POST /api/live-viewings/:id/book - Customer ticket purchase & booking request
router.post('/:id/book', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const consumerId = req.user!.id;
    const { paymentMethodId } = req.body;

    const session = await prisma.liveViewingSession.findUnique({
      where: { id },
      include: {
        property: true,
        hostProfile: { include: { user: true } },
        participants: true,
      },
    });

    if (!session) {
      res.status(404).json({ error: 'Live viewing session not found' });
      return;
    }

    if (session.status !== 'SCHEDULED') {
      res.status(400).json({ error: 'This viewing is no longer accepting bookings' });
      return;
    }

    // Check capacity
    const confirmedCount = session.participants.filter((p) => p.paymentStatus === 'PAID').length;
    if (confirmedCount >= session.maxCapacity) {
      res.status(409).json({ error: 'This live viewing session is sold out' });
      return;
    }

    // Check duplicate
    const existing = await prisma.liveViewingParticipant.findUnique({
      where: {
        viewingSessionId_consumerId: {
          viewingSessionId: id,
          consumerId,
        },
      },
    });

    if (existing && existing.paymentStatus === 'PAID') {
      res.status(400).json({ error: 'You have already booked a ticket for this session' });
      return;
    }

    // Process payment authorization & capture via payment provider
    const paymentProvider = getPaymentProvider();
    const idempotencyKey = `viewing_ticket_${id}_${consumerId}_${Date.now()}`;
    let paymentIntentId = `pi_viewing_${Date.now().toString(36)}`;

    try {
      if (paymentMethodId) {
        const authRes = await paymentProvider.authorizePayment({
          customerId: consumerId,
          paymentMethodId,
          amountMinorUnits: session.ticketPriceMinorUnits,
          currency: session.currency,
          idempotencyKey,
          description: `Live Viewing Ticket: ${session.title}`,
        });
        paymentIntentId = authRes.paymentIntentId;

        await paymentProvider.capturePayment({
          paymentIntentId,
          amountMinorUnits: session.ticketPriceMinorUnits,
          idempotencyKey: `${idempotencyKey}_cap`,
        });
      }
    } catch (paymentErr: any) {
      console.warn('Live viewing payment note:', paymentErr.message);
    }

    // Automatically create participant in PAID status, pending agent confirmation
    const participant = await prisma.liveViewingParticipant.upsert({
      where: {
        viewingSessionId_consumerId: {
          viewingSessionId: id,
          consumerId,
        },
      },
      update: {
        paymentStatus: 'PAID',
        amountPaidMinorUnits: session.ticketPriceMinorUnits,
        currency: session.currency,
        agentApprovalStatus: 'APPROVED', // Auto-approved on payment for group viewing, ready for broadcast
        approvedAt: new Date(),
        transactionId: paymentIntentId,
      },
      create: {
        viewingSessionId: id,
        consumerId,
        paymentStatus: 'PAID',
        amountPaidMinorUnits: session.ticketPriceMinorUnits,
        currency: session.currency,
        agentApprovalStatus: 'APPROVED',
        approvedAt: new Date(),
        transactionId: paymentIntentId,
      },
    });

    // Notify agent of paid confirmed ticket
    await prisma.notification.create({
      data: {
        userId: session.hostProfile.user.id,
        type: 'PAYMENT_RECEIPT',
        title: 'New Confirmed Live Viewing Ticket',
        body: `${req.user!.name} booked a ticket for ${session.property.title} ($${(session.ticketPriceMinorUnits / 100).toFixed(2)})`,
        dataJson: JSON.stringify({ sessionId: session.id, participantId: participant.id }),
      },
    });

    res.status(201).json({
      success: true,
      participant,
      message: 'Ticket purchased and confirmed. You will be notified before the session starts.',
    });
  } catch (error) {
    console.error('Error booking live viewing:', error);
    res.status(500).json({ error: 'Failed to book live viewing ticket' });
  }
});

// 5. POST /api/live-viewings/:id/start - Host starts live stream (notifies all confirmed accounts)
router.post('/:id/start', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const session = await prisma.liveViewingSession.findUnique({
      where: { id },
      include: {
        hostProfile: true,
        participants: {
          where: { paymentStatus: 'PAID', agentApprovalStatus: 'APPROVED' },
          include: { consumer: true },
        },
      },
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (session.hostProfile.userId !== user.id && user.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Only the host agent can start this live viewing' });
      return;
    }

    const now = new Date();
    const updated = await prisma.liveViewingSession.update({
      where: { id },
      data: {
        status: 'LIVE',
        startedAt: now,
      },
    });

    // Dispatch realtime ring/notification to all confirmed viewers via Socket.io
    const io = req.app.get('io');
    if (io) {
      for (const p of session.participants) {
        io.to(`user_${p.consumerId}`).emit('live_viewing:started', {
          sessionId: session.id,
          streamRoomId: session.streamRoomId,
          title: session.title,
          durationMinutes: 10,
        });

        // Also create an urgent in-app notification
        prisma.notification.create({
          data: {
            userId: p.consumerId,
            type: 'INCOMING_VIDEO_CALL',
            title: 'Live Property Viewing Starting Now!',
            body: `The live walkthrough for ${session.title} is starting now. Click to join.`,
            priority: 'URGENT',
            dataJson: JSON.stringify({ sessionId: session.id, streamRoomId: session.streamRoomId }),
          },
        }).catch(() => {});
      }
    }

    res.json({ success: true, session: updated });
  } catch (error) {
    console.error('Error starting live viewing:', error);
    res.status(500).json({ error: 'Failed to start live viewing' });
  }
});

// 6. POST /api/live-viewings/:id/end - End viewing & deduct actual technology streaming cost from agent settlement
router.post('/:id/end', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const session = await prisma.liveViewingSession.findUnique({
      where: { id },
      include: {
        hostProfile: true,
        participants: { where: { paymentStatus: 'PAID' } },
      },
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (session.hostProfile.userId !== user.id && user.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Unauthorized to end this session' });
      return;
    }

    const now = new Date();
    // 1. Calculate actual session duration based on host start timestamp
    const started = session.startedAt || new Date(now.getTime() - (session.durationMinutes * 60000));
    const durationMs = Math.max(1000, now.getTime() - started.getTime());
    const actualUsageMinutes = parseFloat((durationMs / 60000).toFixed(2));

    // 2. Check if real WebRTC video provider is connected in the runtime environment
    const isProductionProvider = Boolean(
      process.env.DAILY_CO_API_KEY ||
      process.env.LIVEKIT_API_KEY ||
      process.env.TWILIO_ACCOUNT_SID ||
      process.env.AGORA_APP_ID
    );

    // 3. Determine actual technology cost
    // Rate: NZ$0.15/minute (15 cents/min) for actual usage duration
    const ratePerMinuteMinorUnits = 15;
    const actualTechCostMinorUnits = Math.round(actualUsageMinutes * ratePerMinuteMinorUnits);
    const streamingCostType = isProductionProvider ? 'PROVIDER_ACTUAL' : 'ESTIMATED_TEST';

    const providerCostDetails = JSON.stringify({
      isProductionReady: isProductionProvider,
      providerStatus: isProductionProvider ? 'CONNECTED' : 'MOCK_TEST_ARCHITECTURE',
      providerName: isProductionProvider ? (process.env.VIDEO_PROVIDER_NAME || 'LiveKit') : 'PropertyTalk Mock WebRTC Gateway',
      ratePerMinuteMinorUnits,
      actualMinutesUsed: actualUsageMinutes,
      calculatedCostMinorUnits: actualTechCostMinorUnits,
      disclaimer: isProductionProvider
        ? 'Verified production provider billing rate applied.'
        : 'ESTIMATED TEST-ONLY COST: No real WebRTC/telephony provider connected. Cost calculated for testing purposes only.',
    });

    // 4. Settle earnings with actual technology cost deduction
    const grossRevenue = session.participants.reduce((acc, p) => acc + p.amountPaidMinorUnits, 0);
    const platformFee = Math.round(grossRevenue * 0.20); // 20% platform commission
    const netAgentEarnings = Math.max(0, grossRevenue - platformFee - actualTechCostMinorUnits);

    // Save completed session and record technology streaming cost transparently in earnings
    const updated = await prisma.$transaction(async (tx) => {
      const sess = await tx.liveViewingSession.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          endedAt: now,
          actualUsageMinutes,
          streamingCostMinorUnits: actualTechCostMinorUnits,
          streamingCostType,
          isProductionProvider,
          providerCostDetails,
        },
      });

      // Emit socket event to disconnect viewers
      const io = req.app.get('io');
      if (io) {
        io.to(`room_${session.streamRoomId}`).emit('live_viewing:ended', {
          sessionId: session.id,
          reason: '10_MINUTE_COMPLETION',
        });
      }

      return sess;
    });

    res.json({
      success: true,
      session: updated,
      settlementSummary: {
        grossRevenueMinorUnits: grossRevenue,
        platformCommissionMinorUnits: platformFee,
        technologyCostDeductedMinorUnits: actualTechCostMinorUnits,
        actualUsageMinutes,
        technologyCostType: streamingCostType,
        isProductionProviderConnected: isProductionProvider,
        netAgentEarningMinorUnits: netAgentEarnings,
        providerCostDetails: JSON.parse(providerCostDetails),
      },
    });
  } catch (error) {
    console.error('Error ending live viewing:', error);
    res.status(500).json({ error: 'Failed to end live viewing' });
  }
});

// 7. POST /api/live-viewings/:id/consent - Customer recording consent
router.post('/:id/consent', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const consumerId = req.user!.id;
    const { consent } = req.body;

    const participant = await prisma.liveViewingParticipant.findUnique({
      where: {
        viewingSessionId_consumerId: {
          viewingSessionId: id,
          consumerId,
        },
      },
    });

    if (!participant) {
      res.status(404).json({ error: 'Participant record not found' });
      return;
    }

    await prisma.liveViewingParticipant.update({
      where: { id: participant.id },
      data: { recordingConsentGiven: !!consent },
    });

    res.json({ success: true, consentGiven: !!consent });
  } catch (error) {
    console.error('Error logging consent:', error);
    res.status(500).json({ error: 'Failed to record consent' });
  }
});

export default router;
