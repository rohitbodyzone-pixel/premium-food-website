import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { getPaymentProvider } from '../services/payment/payment-provider.factory';
import { billingService } from '../services/billing.service';
import { maskPhoneNumber } from '../services/phone.service';
import { getSmsProvider } from '../services/sms/sms-provider.factory';

const router = Router();

// Protect ALL admin routes with SUPER_ADMIN role authoritative enforcement
router.use(requireAuth, requireRole('SUPER_ADMIN'));

// 1. Platform Overview Statistics & Live Dashboard Data
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const totalConsumers = await prisma.user.count({ where: { role: 'CONSUMER' } });
    const totalExperts = await prisma.expertProfile.count();
    const verifiedExperts = await prisma.expertProfile.count({ where: { verificationStatus: 'VERIFIED' } });
    const pendingVerificationCount = await prisma.expertProfile.count({ where: { verificationStatus: 'PENDING_VERIFICATION' } });
    const onlineExperts = await prisma.expertProfile.count({ where: { isOnline: true } });
    const suspendedExperts = await prisma.expertProfile.count({ where: { verificationStatus: 'SUSPENDED' } });
    const totalCalls = await prisma.callSession.count();
    const totalAppointments = await prisma.appointment.count();
    const totalReviews = await prisma.review.count();

    // Call duration and revenue
    const calls = await prisma.callSession.findMany({
      select: { durationSeconds: true, costCharged: true },
    });
    const totalCallMinutes = Math.round(calls.reduce((acc, c) => acc + (c.durationSeconds || 0), 0) / 60);
    const totalPlatformRevenue = calls.reduce((acc, c) => acc + (c.costCharged || 0), 0);

    // Current free call duration config
    const freeCallConfig = await prisma.systemConfig.findUnique({
      where: { key: 'free_call_duration_seconds' },
    });

    // Busy experts (in an active call)
    const activeCalls = await prisma.callSession.findMany({
      where: { status: 'CONNECTED' },
      select: { expertId: true },
    });
    const busyExpertIds = new Set(activeCalls.map((c) => c.expertId));
    const busyExperts = busyExpertIds.size;

    // Recent 5 pending verifications
    const pendingExperts = await prisma.expertProfile.findMany({
      where: { verificationStatus: 'PENDING_VERIFICATION' },
      include: {
        user: { select: { name: true, email: true } },
        category: true,
        country: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Live Experts (online or busy)
    const liveExperts = await prisma.expertProfile.findMany({
      where: { isOnline: true },
      include: {
        user: { select: { name: true, email: true } },
        category: true,
        country: true,
      },
      take: 10,
    });

    // Recent 5 Consultations
    const recentConsultations = await prisma.callSession.findMany({
      include: {
        consumer: { select: { name: true, email: true } },
        expert: {
          include: {
            user: { select: { name: true } },
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Recent 5 Appointments
    const recentAppointments = await prisma.appointment.findMany({
      include: {
        consumer: { select: { name: true, email: true } },
        expert: {
          include: {
            user: { select: { name: true } },
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Dynamic Platform Alerts
    const platformAlerts = [];
    if (pendingVerificationCount > 0) {
      platformAlerts.push({
        id: 'backlog',
        type: 'WARNING',
        title: 'Verification Queue Attention',
        message: `${pendingVerificationCount} property professional${pendingVerificationCount > 1 ? 's are' : ' is'} awaiting credential verification.`,
        link: '/verification',
      });
    }
    if (suspendedExperts > 0) {
      platformAlerts.push({
        id: 'suspended',
        type: 'INFO',
        title: 'Suspended Accounts',
        message: `${suspendedExperts} expert account${suspendedExperts > 1 ? 's are' : ' is'} currently suspended.`,
        link: '/experts?status=SUSPENDED',
      });
    }
    platformAlerts.push({
      id: 'system-ok',
      type: 'SUCCESS',
      title: 'Platform Operational',
      message: 'Realtime Socket.io and WebRTC signalling nodes operating nominally.',
      link: '/system',
    });

    res.json({
      totalConsumers,
      totalExperts,
      verifiedExperts,
      pendingVerificationCount,
      onlineExperts,
      busyExperts,
      totalCalls,
      totalCallMinutes,
      totalPlatformRevenue,
      totalAppointments,
      totalReviews,
      freeCallDurationSeconds: freeCallConfig ? parseInt(freeCallConfig.value, 10) : 60,
      pendingExperts,
      liveExperts: liveExperts.map((e) => ({
        ...e,
        presence: busyExpertIds.has(e.id) ? 'BUSY' : 'ONLINE',
      })),
      recentConsultations,
      recentAppointments,
      platformAlerts,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// 2. Expert Verification Queue & Multi-Status Filtering
router.get('/verification-queue', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const where: any = {};
    if (status && status !== 'ALL') {
      where.verificationStatus = String(status);
    }

    const experts = await prisma.expertProfile.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, accountStatus: true } },
        category: true,
        country: true,
        documents: true,
        auditLogs: {
          include: { adminUser: { select: { name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Match official register link for each expert
    const registerLinks = await prisma.officialRegisterLink.findMany();

    const formatted = experts.map((exp) => {
      const matchingRegister = registerLinks.find(
        (r) => r.countryCode === exp.countryCode && r.categoryId === exp.categoryId
      );
      return {
        ...exp,
        officialRegister: matchingRegister || null,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching verification queue:', error);
    res.status(500).json({ error: 'Failed to fetch verification queue' });
  }
});

// 3. Admin Verification Action (APPROVE, REJECT, REQUEST_INFO, SUSPEND, REQUIRE_REVERIFICATION)
router.post('/verify/:expertId', async (req: Request, res: Response) => {
  try {
    const { expertId } = req.params;
    const { action, notes, source } = req.body;
    const adminId = req.user!.id;

    if (!['APPROVE', 'REJECT', 'REQUEST_INFO', 'SUSPEND', 'REQUIRE_REVERIFICATION'].includes(action)) {
      res.status(400).json({ error: 'Invalid verification action' });
      return;
    }

    let nextStatus: string;
    switch (action) {
      case 'APPROVE':
        nextStatus = 'VERIFIED';
        break;
      case 'REJECT':
        nextStatus = 'REJECTED';
        break;
      case 'REQUEST_INFO':
      case 'REQUIRE_REVERIFICATION':
        nextStatus = 'PENDING_VERIFICATION';
        break;
      case 'SUSPEND':
        nextStatus = 'SUSPENDED';
        break;
      default:
        nextStatus = 'PENDING_VERIFICATION';
    }

    // Force offline if status is not verified
    const shouldForceOffline = nextStatus !== 'VERIFIED';

    const updatedProfile = await prisma.expertProfile.update({
      where: { id: expertId },
      data: {
        verificationStatus: nextStatus,
        ...(shouldForceOffline ? { isOnline: false } : {}),
      },
      include: {
        user: true,
        category: true,
        country: true,
      },
    });

    // Create Verification Audit Log
    const auditLog = await prisma.verificationAuditLog.create({
      data: {
        expertProfileId: expertId,
        adminUserId: adminId,
        action,
        notes: notes || `Admin manual verification action: ${action}`,
        source: source || 'Super Admin Console',
      },
      include: {
        adminUser: { select: { name: true, email: true } },
      },
    });

    res.json({
      success: true,
      expert: updatedProfile,
      auditLog,
    });
  } catch (error) {
    console.error('Error updating verification:', error);
    res.status(500).json({ error: 'Failed to update verification status' });
  }
});

// 4. Expert Directory Management (All Experts with rich filters)
router.get('/experts', async (req: Request, res: Response) => {
  try {
    const { search, country, category, verificationStatus, isOnline, accountStatus } = req.query;
    const where: any = {};

    if (country) where.countryCode = String(country).toUpperCase();
    if (category) where.categoryId = String(category);
    if (verificationStatus) where.verificationStatus = String(verificationStatus);
    if (isOnline !== undefined) where.isOnline = isOnline === 'true';

    if (accountStatus) {
      where.user = { accountStatus: String(accountStatus) };
    }

    if (search) {
      const q = String(search).toLowerCase();
      where.OR = [
        { title: { contains: q } },
        { businessName: { contains: q } },
        { user: { name: { contains: q } } },
        { user: { email: { contains: q } } },
      ];
    }

    const experts = await prisma.expertProfile.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, accountStatus: true, createdAt: true } },
        category: true,
        country: true,
        _count: {
          select: {
            reviewsReceived: true,
            callSessions: true,
            appointments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const maskedExperts = experts.map((e) => ({
      ...e,
      user: e.user
        ? {
            ...e.user,
            phone: e.user.phone ? maskPhoneNumber(e.user.phone) : null,
          }
        : null,
    }));

    res.json(maskedExperts);
  } catch (error) {
    console.error('Error fetching experts:', error);
    res.status(500).json({ error: 'Failed to fetch experts' });
  }
});

// Update expert status / suspension
router.patch('/experts/:expertId/status', async (req: Request, res: Response) => {
  try {
    const { expertId } = req.params;
    const { accountStatus, verificationStatus, notes } = req.body;
    const adminId = req.user!.id;

    const expert = await prisma.expertProfile.findUnique({
      where: { id: expertId },
      include: { user: true },
    });

    if (!expert) {
      res.status(404).json({ error: 'Expert not found' });
      return;
    }

    if (accountStatus) {
      await prisma.user.update({
        where: { id: expert.userId },
        data: { accountStatus },
      });
    }

    if (verificationStatus) {
      await prisma.expertProfile.update({
        where: { id: expertId },
        data: {
          verificationStatus,
          ...(verificationStatus !== 'VERIFIED' ? { isOnline: false } : {}),
        },
      });

      await prisma.verificationAuditLog.create({
        data: {
          expertProfileId: expertId,
          adminUserId: adminId,
          action: verificationStatus === 'SUSPENDED' ? 'SUSPEND' : 'STATUS_CHANGE',
          notes: notes || `Expert status changed to ${verificationStatus}`,
          source: 'Super Admin Management',
        },
      });
    }

    res.json({ success: true, message: 'Expert status updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update expert status' });
  }
});

// 5. Customer Management
router.get('/customers', async (req: Request, res: Response) => {
  try {
    const { search, country, accountStatus } = req.query;
    const where: any = { role: 'CONSUMER' };

    if (country) where.countryCode = String(country).toUpperCase();
    if (accountStatus) where.accountStatus = String(accountStatus);

    if (search) {
      const q = String(search).toLowerCase();
      where.OR = [
        { name: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
      ];
    }

    const customers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        countryCode: true,
        accountStatus: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            callsInitiated: true,
            appointments: true,
            chatsInitiated: true,
            reviewsGiven: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const maskedCustomers = customers.map((c) => ({
      ...c,
      phone: c.phone ? maskPhoneNumber(c.phone) : null,
    }));

    res.json(maskedCustomers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Suspend or Reactivate customer
router.patch('/customers/:userId/status', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { accountStatus } = req.body;

    if (!['ACTIVE', 'SUSPENDED'].includes(accountStatus)) {
      res.status(400).json({ error: 'Invalid account status' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { accountStatus },
      select: { id: true, name: true, email: true, accountStatus: true },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update customer account status' });
  }
});

// 6. Categories Management
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: { select: { expertProfiles: true } },
      },
      orderBy: { displayOrder: 'asc' },
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.post('/categories', async (req: Request, res: Response) => {
  try {
    const { name, slug, icon, description, displayOrder } = req.body;
    const category = await prisma.category.create({
      data: {
        name,
        slug,
        icon: icon || 'Briefcase',
        description: description || '',
        displayOrder: displayOrder || 0,
      },
    });
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.patch('/categories/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, icon, description, displayOrder, isActive } = req.body;

    const updated = await prisma.category.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(icon !== undefined ? { icon } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(displayOrder !== undefined ? { displayOrder: Number(displayOrder) } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// 7. Locations & Cities Management
router.get('/locations', async (req: Request, res: Response) => {
  try {
    const countries = await prisma.country.findMany({
      include: {
        _count: { select: { expertProfiles: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Pre-configured official cities per country
    const citiesByCountry: Record<string, string[]> = {
      NZ: ['Auckland', 'Wellington', 'Christchurch', 'Hamilton', 'Tauranga', 'Dunedin', 'Queenstown', 'Napier'],
      AU: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Canberra', 'Gold Coast', 'Hobart'],
    };

    res.json({
      countries,
      cities: citiesByCountry,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

router.patch('/locations/country/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const { isActive } = req.body;

    const updated = await prisma.country.update({
      where: { code: code.toUpperCase() },
      data: { isActive: Boolean(isActive) },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update country' });
  }
});

// 8. Consultations Management (Privacy-safe: Metadata only)
router.get('/consultations', async (req: Request, res: Response) => {
  try {
    const { type, status } = req.query;
    const where: any = {};

    if (type && type !== 'ALL') where.callType = String(type);
    if (status && status !== 'ALL') where.status = String(status);

    const calls = await prisma.callSession.findMany({
      where,
      include: {
        consumer: { select: { id: true, name: true, email: true } },
        expert: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            category: true,
            country: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(calls);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch consultations' });
  }
});

// 9. Appointments Management
router.get('/appointments', async (req: Request, res: Response) => {
  try {
    const { status, country } = req.query;
    const where: any = {};

    if (status && status !== 'ALL') where.status = String(status);
    if (country) where.expert = { countryCode: String(country).toUpperCase() };

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        consumer: { select: { id: true, name: true, email: true, phone: true } },
        expert: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
            category: true,
            country: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(appointments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// 10. Reviews & Moderation
router.get('/reviews', async (req: Request, res: Response) => {
  try {
    const reviews = await prisma.review.findMany({
      include: {
        consumer: { select: { id: true, name: true, email: true } },
        expert: {
          include: {
            user: { select: { id: true, name: true } },
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

router.delete('/reviews/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.review.delete({ where: { id } });
    res.json({ success: true, message: 'Review removed by administrator' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to moderate review' });
  }
});

// 11. Official Register Links
router.get('/registers', async (req: Request, res: Response) => {
  try {
    const registers = await prisma.officialRegisterLink.findMany({
      include: {
        country: true,
        category: true,
      },
      orderBy: [{ countryCode: 'asc' }, { category: { name: 'asc' } }],
    });

    res.json(registers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch official register links' });
  }
});

router.post('/official-registers', async (req: Request, res: Response) => {
  try {
    const { countryCode, categoryId, title, urlPattern, notes } = req.body;
    const register = await prisma.officialRegisterLink.create({
      data: {
        countryCode: countryCode.toUpperCase(),
        categoryId,
        title,
        urlPattern,
        notes,
      },
      include: {
        country: true,
        category: true,
      },
    });
    res.status(201).json(register);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create official register link' });
  }
});

// 12. System Status & Node Health
router.get('/system-status', async (req: Request, res: Response) => {
  try {
    // Check Database connection
    const dbCheckStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - dbCheckStart;

    const onlineExperts = await prisma.expertProfile.count({ where: { isOnline: true } });
    const totalConsumers = await prisma.user.count({ where: { role: 'CONSUMER' } });
    const totalExperts = await prisma.expertProfile.count();
    const activeCalls = await prisma.callSession.count({ where: { status: 'CONNECTED' } });

    res.json({
      backend: {
        status: 'Online',
        port: 5000,
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      database: {
        status: 'Connected',
        provider: 'SQLite / Prisma ORM',
        latencyMs: dbLatencyMs,
      },
      realtimeSocket: {
        status: 'Operational',
        transports: ['websocket', 'polling'],
        activeNodes: 1,
      },
      webrtc: {
        stunServers: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
        turnConfigured: false,
        signallingState: 'Active via Socket.io',
      },
      metrics: {
        onlineExperts,
        totalConsumers,
        totalExperts,
        activeCalls,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      backend: { status: 'Error' },
      database: { status: 'Error', error: error.message },
    });
  }
});

// 13. Audit Logs Chronological History
router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const logs = await prisma.verificationAuditLog.findMany({
      include: {
        adminUser: { select: { id: true, name: true, email: true } },
        expertProfile: {
          select: {
            id: true,
            title: true,
            businessName: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// 14. System Configuration Management (e.g. Free consultation duration, marketplace toggles)
router.get('/config', async (req: Request, res: Response) => {
  try {
    const configs = await prisma.systemConfig.findMany();
    res.json(configs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch system configs' });
  }
});

router.put('/config/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;

    const updated = await prisma.systemConfig.upsert({
      where: { key },
      update: {
        value: String(value),
        ...(description ? { description } : {}),
      },
      create: {
        key,
        value: String(value),
        description,
      },
    });

    // Record audit log for critical config changes
    if (key === 'free_call_duration_seconds') {
      await prisma.verificationAuditLog.create({
        data: {
          expertProfileId: null as any,
          adminUserId: req.user!.id,
          action: 'CONFIG_UPDATE',
          notes: `Free consultation duration updated to ${value} seconds`,
          source: 'System Settings',
        },
      }).catch(() => {});
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update system config' });
  }
});

// Legacy Call Records route
router.get('/calls', async (req: Request, res: Response) => {
  try {
    const calls = await prisma.callSession.findMany({
      include: {
        expert: {
          include: {
            user: { select: { name: true, email: true } },
            category: true,
            country: true,
          },
        },
        consumer: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(calls);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch call audit records' });
  }
});

// 15. Super Admin Payments & Billing Management
router.get('/payments/overview', async (req: Request, res: Response) => {
  try {
    const transactions = await prisma.paymentTransaction.findMany({
      include: { refunds: true, billingSession: true },
    });

    let grossVolumeMinor = 0;
    let platformFeeMinor = 0;
    let expertEarningMinor = 0;
    let failedCount = 0;
    let capturedCount = 0;
    let refundCount = 0;
    let totalRefundedMinor = 0;

    for (const tx of transactions) {
      if (tx.status === 'CAPTURED') {
        grossVolumeMinor += tx.amountMinorUnits;
        capturedCount += 1;
        if (tx.billingSession) {
          platformFeeMinor += tx.billingSession.platformFeeMinorUnits;
          expertEarningMinor += tx.billingSession.expertEarningMinorUnits;
        }
      } else if (tx.status === 'FAILED') {
        failedCount += 1;
      }

      if (tx.refunds && tx.refunds.length > 0) {
        refundCount += tx.refunds.length;
        for (const r of tx.refunds) {
          totalRefundedMinor += r.amountMinorUnits;
        }
      }
    }

    const provider = getPaymentProvider();
    const commissionPct = await billingService.getPlatformCommissionPct();

    res.json({
      grossVolume: grossVolumeMinor / 100,
      platformFeeRevenue: platformFeeMinor / 100,
      expertEarnings: expertEarningMinor / 100,
      capturedCount,
      failedCount,
      refundCount,
      totalRefunded: totalRefundedMinor / 100,
      totalTransactions: transactions.length,
      provider: provider.name,
      isMockMode: provider.isMock,

      // Complementary fields matching PaymentsView interface
      totalGrossVolumeMinorUnits: grossVolumeMinor,
      totalPlatformFeesMinorUnits: platformFeeMinor,
      totalExpertEarningsMinorUnits: expertEarningMinor,
      totalRefundsMinorUnits: totalRefundedMinor,
      totalTransactionsCount: transactions.length,
      platformCommissionPct: commissionPct,
      paymentProvider: provider.name,
      isMock: provider.isMock,
    });
  } catch (error) {
    console.error('Error fetching admin payments overview:', error);
    res.status(500).json({ error: 'Failed to fetch payments overview' });
  }
});

router.get('/payments/transactions', async (req: Request, res: Response) => {
  try {
    const { country, status, type, search } = req.query;
    const where: any = {};

    if (status && status !== 'ALL') {
      where.status = String(status);
    }
    if (country && country !== 'ALL') {
      where.currency = country === 'AU' ? 'AUD' : 'NZD';
    }

    const transactions = await prisma.paymentTransaction.findMany({
      where,
      include: {
        consumer: { select: { id: true, name: true, email: true } },
        expert: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            category: true,
          },
        },
        billingSession: true,
        refunds: {
          include: {
            initiatedBy: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    let filtered = transactions;
    if (type && type !== 'ALL') {
      filtered = filtered.filter((t) => t.billingSession?.consultationType === type);
    }
    if (search) {
      const q = String(search).toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.consumer.name.toLowerCase().includes(q) ||
          (t.consumer.email && t.consumer.email.toLowerCase().includes(q)) ||
          t.expert.user.name.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q)
      );
    }

    const formatted = filtered.map((tx) => ({
      id: tx.id,
      consumer: tx.consumer,
      expert: {
        id: tx.expert.id,
        name: tx.expert.user.name,
        email: tx.expert.user.email,
        category: tx.expert.category.name,
        countryCode: tx.expert.countryCode,
      },
      amount: tx.amountMinorUnits / 100,
      currency: tx.currency,
      currencySymbol: tx.currency === 'AUD' ? 'A$' : 'NZ$',
      consultationType: tx.billingSession?.consultationType || 'CONSULTATION',
      freeSeconds: tx.billingSession?.freeSecondsUsed || 60,
      paidSeconds: tx.billingSession?.paidSecondsUsed || 0,
      platformFee: tx.billingSession ? tx.billingSession.platformFeeMinorUnits / 100 : 0,
      expertEarning: tx.billingSession ? tx.billingSession.expertEarningMinorUnits / 100 : 0,
      expertNet: tx.billingSession ? tx.billingSession.expertEarningMinorUnits / 100 : 0,
      commissionPct: tx.billingSession?.commissionPct ?? 20,
      status: tx.status,
      provider: tx.provider,
      providerPaymentIntentId: tx.providerPaymentIntentId,
      failureReason: tx.failureReason,
      refunds: tx.refunds.map((r) => ({
        id: r.id,
        amount: r.amountMinorUnits / 100,
        reason: r.reason,
        status: r.status,
        date: r.createdAt,
        adminName: r.initiatedBy?.name || 'System Admin',
      })),
      createdAt: tx.createdAt,
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching admin transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Admin Refund Action (Full or Partial)
router.post('/payments/transactions/:id/refund', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;
    const adminId = req.user!.id;

    if (!reason || !reason.trim()) {
      res.status(400).json({ error: 'A valid refund reason is required for administrative audit.' });
      return;
    }

    const tx = await prisma.paymentTransaction.findUnique({
      where: { id },
      include: { billingSession: true, refunds: true },
    });

    if (!tx) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    if (tx.status !== 'CAPTURED' && tx.status !== 'PARTIALLY_REFUNDED') {
      res.status(400).json({ error: `Cannot refund transaction in '${tx.status}' status.` });
      return;
    }

    const alreadyRefundedMinor = tx.refunds.reduce((acc, r) => acc + r.amountMinorUnits, 0);
    const availableToRefundMinor = tx.amountMinorUnits - alreadyRefundedMinor;

    const refundAmountMinor = amount ? Math.round(Number(amount) * 100) : availableToRefundMinor;

    if (refundAmountMinor <= 0 || refundAmountMinor > availableToRefundMinor) {
      res.status(400).json({
        error: `Invalid refund amount. Available for refund: $${(availableToRefundMinor / 100).toFixed(2)}`,
      });
      return;
    }

    const result = await billingService.processRefund({
      transactionId: tx.id,
      amountMinorUnits: refundAmountMinor,
      reason,
      adminUserId: adminId,
    });

    res.json({
      success: true,
      refund: result.refund,
      nextStatus: result.transaction.status,
      amountRefunded: result.amountRefunded,
    });
  } catch (error: any) {
    console.error('Error processing refund:', error);
    res.status(500).json({ error: error.message || 'Failed to process refund' });
  }
});

// Admin Payment Settings
router.get('/payments/settings', async (_req: Request, res: Response) => {
  try {
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: [
            'paid_consultations_enabled',
            'platform_commission_pct',
            'min_rate_minor_units',
            'max_rate_minor_units',
            'currency_nzd_enabled',
            'currency_aud_enabled',
            'free_call_duration_seconds',
          ],
        },
      },
    });

    const map = new Map(configs.map((c) => [c.key, c.value]));

    res.json({
      paidConsultationsEnabled: map.get('paid_consultations_enabled') !== 'false',
      platformCommissionPct: parseFloat(map.get('platform_commission_pct') || '20'),
      minRatePerMinute: parseInt(map.get('min_rate_minor_units') || '100', 10) / 100,
      maxRatePerMinute: parseInt(map.get('max_rate_minor_units') || '2000', 10) / 100,
      currencyNzdEnabled: map.get('currency_nzd_enabled') !== 'false',
      currencyAudEnabled: map.get('currency_aud_enabled') !== 'false',
      freeCallDurationSeconds: parseInt(map.get('free_call_duration_seconds') || '60', 10),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payment settings' });
  }
});

router.put('/payments/settings', async (req: Request, res: Response) => {
  try {
    const {
      paidConsultationsEnabled,
      platformCommissionPct,
      minRatePerMinute,
      maxRatePerMinute,
      currencyNzdEnabled,
      currencyAudEnabled,
    } = req.body;
    const adminId = req.user!.id;

    if (platformCommissionPct !== undefined) {
      const pct = Number(platformCommissionPct);
      if (pct < 0 || pct > 50) {
        res.status(400).json({ error: 'Platform commission must be between 0% and 50%.' });
        return;
      }
      await prisma.systemConfig.upsert({
        where: { key: 'platform_commission_pct' },
        update: { value: String(pct) },
        create: { key: 'platform_commission_pct', value: String(pct), description: 'Platform commission %' },
      });
    }

    if (paidConsultationsEnabled !== undefined) {
      await prisma.systemConfig.upsert({
        where: { key: 'paid_consultations_enabled' },
        update: { value: String(paidConsultationsEnabled) },
        create: { key: 'paid_consultations_enabled', value: String(paidConsultationsEnabled), description: 'Paid consultations toggle' },
      });
    }

    if (minRatePerMinute !== undefined) {
      const minMinor = Math.round(Number(minRatePerMinute) * 100);
      await prisma.systemConfig.upsert({
        where: { key: 'min_rate_minor_units' },
        update: { value: String(minMinor) },
        create: { key: 'min_rate_minor_units', value: String(minMinor), description: 'Minimum allowed rate' },
      });
    }

    if (maxRatePerMinute !== undefined) {
      const maxMinor = Math.round(Number(maxRatePerMinute) * 100);
      await prisma.systemConfig.upsert({
        where: { key: 'max_rate_minor_units' },
        update: { value: String(maxMinor) },
        create: { key: 'max_rate_minor_units', value: String(maxMinor), description: 'Maximum allowed rate' },
      });
    }

    if (currencyNzdEnabled !== undefined) {
      await prisma.systemConfig.upsert({
        where: { key: 'currency_nzd_enabled' },
        update: { value: String(currencyNzdEnabled) },
        create: { key: 'currency_nzd_enabled', value: String(currencyNzdEnabled) },
      });
    }

    if (currencyAudEnabled !== undefined) {
      await prisma.systemConfig.upsert({
        where: { key: 'currency_aud_enabled' },
        update: { value: String(currencyAudEnabled) },
        create: { key: 'currency_aud_enabled', value: String(currencyAudEnabled) },
      });
    }

    // Record audit log
    await prisma.verificationAuditLog.create({
      data: {
        expertProfileId: null as any,
        adminUserId: adminId,
        action: 'PAYMENT_CONFIG_UPDATE',
        notes: `Platform financial settings updated (Commission: ${platformCommissionPct}%).`,
        source: 'Payment Governance',
      },
    }).catch(() => {});

    res.json({ success: true, message: 'Payment settings updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update payment settings' });
  }
});

// 21. SMS Delivery & Phone Authentication Governance
router.get('/sms-config', async (req: Request, res: Response) => {
  try {
    const smsProvider = getSmsProvider();
    const totalSmsDispatched = await prisma.notificationLog.count({ where: { channel: 'SMS' } });
    const totalPhoneVerifications = await prisma.phoneVerification.count();
    const successfulPhoneVerifications = await prisma.phoneVerification.count({ where: { verified: true } });

    res.json({
      smsProvider: {
        name: smsProvider.name,
        isDevelopment: smsProvider.isDevelopment,
      },
      metrics: {
        totalSmsDispatched,
        totalPhoneVerifications,
        successfulPhoneVerifications,
      },
      parameters: {
        otpLength: 6,
        expiryMinutes: 10,
        cooldownSeconds: 60,
        maxAttempts: 3,
      },
      policies: {
        customerPhoneSignup: true,
        expertPhoneSignup: true,
        phoneOtpLogin: true,
        adminPhoneLogin: false, // Strict governance: Super Admin phone login disabled
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch SMS governance configuration' });
  }
});

export default router;
