import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware';
import { presenceService } from '../services/presence.service';

const router = Router();

// List experts with filters
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const {
      countryCode,
      category, // category slug or id
      onlineOnly,
      city,
      minRating,
      search,
    } = req.query;

    const whereClause: any = {
      // Phase 1 rule: Only verified experts appear in the public customer directory
      verificationStatus: 'VERIFIED',
    };

    if (countryCode) {
      whereClause.countryCode = String(countryCode).toUpperCase();
    }

    if (category) {
      whereClause.category = {
        OR: [
          { slug: String(category) },
          { id: String(category) },
        ],
      };
    }

    if (onlineOnly === 'true') {
      whereClause.isOnline = true;
    }

    if (city) {
      whereClause.city = {
        contains: String(city),
      };
    }

    if (minRating) {
      whereClause.ratingAvg = {
        gte: parseFloat(String(minRating)),
      };
    }

    if (search) {
      const searchStr = String(search).toLowerCase();
      whereClause.OR = [
        { title: { contains: searchStr } },
        { bio: { contains: searchStr } },
        { user: { name: { contains: searchStr } } },
        { city: { contains: searchStr } },
        { specialities: { contains: searchStr } },
      ];
    }

    const experts = await prisma.expertProfile.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            countryCode: true,
          },
        },
        category: true,
        country: true,
        _count: {
          select: { reviewsReceived: true },
        },
      },
      orderBy: [
        { isOnline: 'desc' },
        { ratingAvg: 'desc' },
      ],
    });

    // Check if saved by requesting user
    let savedExpertIds = new Set<string>();
    if (req.user) {
      const saved = await prisma.savedExpert.findMany({
        where: { consumerId: req.user.id },
        select: { expertId: true },
      });
      savedExpertIds = new Set(saved.map((s) => s.expertId));
    }

    const formatted = experts.map((e) => {
      let languages: string[] = [];
      let specialities: string[] = [];
      try {
        languages = JSON.parse(e.languages || '[]');
      } catch {
        languages = [e.languages];
      }
      try {
        specialities = JSON.parse(e.specialities || '[]');
      } catch {
        specialities = [e.specialities];
      }

      return {
        id: e.id,
        userId: e.user.id,
        name: e.user.name,
        photoUrl: e.photoUrl || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80`,
        title: e.title,
        category: e.category,
        country: e.country,
        city: e.city,
        yearsOfExperience: e.yearsOfExperience,
        languages,
        specialities,
        ratingAvg: e.ratingAvg,
        reviewCount: e._count.reviewsReceived || e.ratingCount,
        isOnline: e.isOnline,
        verificationStatus: e.verificationStatus,
        hourlyRate: e.hourlyRate,
        callPerMinuteRate: e.callPerMinuteRate,
        freeCallMinutes: e.freeCallMinutes,
        businessName: e.businessName,
        licenseNumber: e.licenseNumber,
        isSaved: savedExpertIds.has(e.id),
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching experts:', error);
    res.status(500).json({ error: 'Failed to fetch experts' });
  }
});

// Get single expert profile
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const expert = await prisma.expertProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        category: true,
        country: true,
        reviewsReceived: {
          include: {
            consumer: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        availabilitySlots: {
          where: { isAvailable: true },
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    });

    if (!expert) {
      res.status(404).json({ error: 'Expert not found' });
      return;
    }

    let isSaved = false;
    if (req.user) {
      const saved = await prisma.savedExpert.findUnique({
        where: {
          consumerId_expertId: {
            consumerId: req.user.id,
            expertId: expert.id,
          },
        },
      });
      isSaved = !!saved;
    }

    let languages: string[] = [];
    let specialities: string[] = [];
    try {
      languages = JSON.parse(expert.languages || '[]');
    } catch {
      languages = [expert.languages];
    }
    try {
      specialities = JSON.parse(expert.specialities || '[]');
    } catch {
      specialities = [expert.specialities];
    }

    res.json({
      id: expert.id,
      userId: expert.user.id,
      name: expert.user.name,
      photoUrl: expert.photoUrl || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80`,
      title: expert.title,
      bio: expert.bio,
      category: expert.category,
      country: expert.country,
      city: expert.city,
      yearsOfExperience: expert.yearsOfExperience,
      languages,
      specialities,
      ratingAvg: expert.ratingAvg,
      reviewCount: expert.reviewsReceived.length || expert.ratingCount,
      isOnline: expert.isOnline,
      verificationStatus: expert.verificationStatus,
      hourlyRate: expert.hourlyRate,
      callPerMinuteRate: expert.callPerMinuteRate,
      freeCallMinutes: expert.freeCallMinutes,
      businessName: expert.businessName,
      businessRegNumber: expert.businessRegNumber,
      licenseNumber: expert.licenseNumber,
      isSaved,
      reviews: expert.reviewsReceived,
      availabilitySlots: expert.availabilitySlots,
    });
  } catch (error) {
    console.error('Error fetching expert details:', error);
    res.status(500).json({ error: 'Failed to fetch expert profile' });
  }
});

// Toggle Online / Offline presence (For Expert role)
router.patch('/me/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { expertProfile: true },
    });

    if (!user || !user.expertProfile) {
      res.status(403).json({ error: 'Only registered experts have online status' });
      return;
    }

    const { isOnline } = req.body;
    const result = await presenceService.setManualOnlineStatus(user.expertProfile.id, Boolean(isOnline));

    if (!result.success) {
      res.status(403).json({ error: result.error || 'Failed to update online status' });
      return;
    }

    res.json({
      success: true,
      isOnline: result.status === 'ONLINE' || result.status === 'BUSY',
      status: result.status,
      verificationStatus: user.expertProfile.verificationStatus,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update online status' });
  }
});

// Save or Unsave Expert
router.post('/:id/save', requireAuth, async (req: Request, res: Response) => {
  try {
    const expertId = req.params.id;
    const consumerId = req.user!.id;

    const existing = await prisma.savedExpert.findUnique({
      where: {
        consumerId_expertId: { consumerId, expertId },
      },
    });

    if (existing) {
      await prisma.savedExpert.delete({
        where: { id: existing.id },
      });
      res.json({ saved: false });
    } else {
      await prisma.savedExpert.create({
        data: { consumerId, expertId },
      });
      res.json({ saved: true });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle save expert' });
  }
});

export default router;
