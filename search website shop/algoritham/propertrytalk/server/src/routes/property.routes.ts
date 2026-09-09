import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware';

const router = Router();

// Helper to generate URL-safe slugs
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// 1. GET /api/properties - Filterable property list with pagination
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const {
      listingType, // FOR_SALE, FOR_RENT
      city,
      suburb,
      propertyType, // HOUSE, APARTMENT, TOWNHOUSE, LAND, COMMERCIAL, LIFESTYLE
      minPrice,
      maxPrice,
      minBedrooms,
      minBathrooms,
      isPrivateListing,
      remoteViewingAvailable,
      search,
      page = '1',
      limit = '20',
      sortBy = 'newest',
    } = req.query;

    const where: any = {
      status: 'ACTIVE',
      isModerated: true,
    };

    if (listingType && (listingType === 'FOR_SALE' || listingType === 'FOR_RENT')) {
      where.listingType = String(listingType);
    }

    if (city) {
      where.city = { contains: String(city) };
    }

    if (suburb) {
      where.suburb = { contains: String(suburb) };
    }

    if (propertyType) {
      where.propertyType = String(propertyType).toUpperCase();
    }

    if (minPrice || maxPrice) {
      where.priceMinorUnits = {};
      if (minPrice) where.priceMinorUnits.gte = parseInt(String(minPrice), 10);
      if (maxPrice) where.priceMinorUnits.lte = parseInt(String(maxPrice), 10);
    }

    if (minBedrooms) {
      where.bedrooms = { gte: parseInt(String(minBedrooms), 10) };
    }

    if (minBathrooms) {
      where.bathrooms = { gte: parseInt(String(minBathrooms), 10) };
    }

    if (isPrivateListing === 'true') {
      where.isPrivateListing = true;
    } else if (isPrivateListing === 'false') {
      where.isPrivateListing = false;
    }

    if (remoteViewingAvailable === 'true') {
      where.remoteViewingAvailable = true;
    }

    if (search) {
      const q = String(search).toLowerCase();
      where.OR = [
        { title: { contains: q } },
        { description: { contains: q } },
        { streetAddress: { contains: q } },
        { suburb: { contains: q } },
        { city: { contains: q } },
      ];
    }

    let orderBy: any = { createdAt: 'desc' };
    if (sortBy === 'price_asc') orderBy = { priceMinorUnits: 'asc' };
    if (sortBy === 'price_desc') orderBy = { priceMinorUnits: 'desc' };
    if (sortBy === 'views') orderBy = { viewsCount: 'desc' };

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const take = Math.min(50, Math.max(1, parseInt(String(limit), 10) || 20));
    const skip = (pageNum - 1) * take;

    const [total, properties] = await Promise.all([
      prisma.property.count({ where }),
      prisma.property.findMany({
        where,
        include: {
          agentProfile: {
            include: {
              user: { select: { id: true, name: true, email: true } },
              category: true,
              miniWebsite: { select: { slug: true, agencyName: true } },
            },
          },
          liveViewingSessions: {
            where: { status: { in: ['SCHEDULED', 'LIVE'] } },
            select: {
              id: true,
              viewingType: true,
              scheduledAt: true,
              durationMinutes: true,
              ticketPriceMinorUnits: true,
              status: true,
              minAttendees: true,
              maxCapacity: true,
              _count: { select: { participants: true } },
            },
            take: 2,
          },
        },
        orderBy,
        skip,
        take,
      }),
    ]);

    // Check saved status for current user if logged in
    let savedPropertyIds = new Set<string>();
    if (req.user) {
      const saved = await prisma.savedProperty.findMany({
        where: { consumerId: req.user.id },
        select: { propertyId: true },
      });
      savedPropertyIds = new Set(saved.map((s) => s.propertyId));
    }

    const formatted = properties.map((p) => {
      let parsedImages: string[] = [];
      try {
        parsedImages = JSON.parse(p.images || '[]');
      } catch {
        parsedImages = [];
      }

      return {
        ...p,
        images: parsedImages,
        isSaved: savedPropertyIds.has(p.id),
      };
    });

    res.json({
      properties: formatted,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// 2. GET /api/properties/featured - Featured properties for Home screen
router.get('/featured', async (_req: Request, res: Response) => {
  try {
    const properties = await prisma.property.findMany({
      where: {
        status: 'ACTIVE',
        isModerated: true,
        isFeatured: true,
      },
      include: {
        agentProfile: {
          include: {
            user: { select: { id: true, name: true } },
            category: true,
            miniWebsite: { select: { slug: true, agencyName: true } },
          },
        },
        liveViewingSessions: {
          where: { status: 'SCHEDULED' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    const formatted = properties.map((p) => {
      let parsedImages: string[] = [];
      try {
        parsedImages = JSON.parse(p.images || '[]');
      } catch {
        parsedImages = [];
      }
      return { ...p, images: parsedImages };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching featured properties:', error);
    res.status(500).json({ error: 'Failed to fetch featured properties' });
  }
});

// 3. GET /api/properties/saved - Consumer saved properties
router.get('/saved', requireAuth, async (req: Request, res: Response) => {
  try {
    const saved = await prisma.savedProperty.findMany({
      where: { consumerId: req.user!.id },
      include: {
        property: {
          include: {
            agentProfile: {
              include: {
                user: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = saved.map((s) => {
      let parsedImages: string[] = [];
      try {
        parsedImages = JSON.parse(s.property.images || '[]');
      } catch {
        parsedImages = [];
      }
      return {
        ...s.property,
        images: parsedImages,
        savedAt: s.createdAt,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching saved properties:', error);
    res.status(500).json({ error: 'Failed to fetch saved properties' });
  }
});

// 4. GET /api/properties/:idOrSlug - Single property detail
router.get('/:idOrSlug', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { idOrSlug } = req.params;

    const property = await prisma.property.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        agentProfile: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
            category: true,
            miniWebsite: {
              select: {
                id: true,
                slug: true,
                agencyName: true,
                agencyLogoUrl: true,
                customHeadline: true,
              },
            },
          },
        },
        privateOwner: {
          select: { id: true, name: true, email: true },
        },
        liveViewingSessions: {
          where: { status: { in: ['SCHEDULED', 'LIVE'] } },
          include: {
            _count: { select: { participants: true } },
          },
          orderBy: { scheduledAt: 'asc' },
        },
      },
    });

    if (!property) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    // Increment views count asynchronously
    prisma.property
      .update({
        where: { id: property.id },
        data: { viewsCount: { increment: 1 } },
      })
      .catch(() => {});

    let parsedImages: string[] = [];
    let parsedDocs: any[] = [];
    try {
      parsedImages = JSON.parse(property.images || '[]');
    } catch {
      parsedImages = [];
    }
    try {
      parsedDocs = JSON.parse(property.documents || '[]');
    } catch {
      parsedDocs = [];
    }

    let isSaved = false;
    if (req.user) {
      const saved = await prisma.savedProperty.findUnique({
        where: {
          propertyId_consumerId: {
            propertyId: property.id,
            consumerId: req.user.id,
          },
        },
      });
      isSaved = !!saved;
    }

    res.json({
      ...property,
      images: parsedImages,
      documents: parsedDocs,
      isSaved,
    });
  } catch (error) {
    console.error('Error fetching property detail:', error);
    res.status(500).json({ error: 'Failed to fetch property details' });
  }
});

// 5. POST /api/properties - Create property listing
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const {
      title,
      description,
      propertyType,
      listingType = 'FOR_SALE',
      priceMinorUnits,
      priceDisplay,
      bedrooms = 0,
      bathrooms = 0,
      parkingSpaces = 0,
      floorAreaM2,
      landAreaM2,
      streetAddress,
      suburb,
      city,
      countryCode = 'NZ',
      postalCode,
      latitude,
      longitude,
      images = [],
      videoUrl,
      documents = [],
      isPrivateListing = false,
      remoteViewingAvailable = true,
    } = req.body;

    if (!title || !description || !propertyType || !streetAddress || !suburb || !city) {
      res.status(400).json({ error: 'Missing required listing fields' });
      return;
    }

    let agentProfileId: string | null = null;
    let privateOwnerId: string | null = null;

    if (user.role === 'EXPERT') {
      const expert = await prisma.expertProfile.findUnique({
        where: { userId: user.id },
        include: { category: true },
      });

      if (!expert) {
        res.status(403).json({ error: 'Expert profile not found' });
        return;
      }

      // Check category: Real Estate Agent or Property Manager
      const allowedCategories = ['real-estate-agent', 'property-manager'];
      if (!allowedCategories.includes(expert.category.slug)) {
        res.status(403).json({
          error: 'Only verified Real Estate Agents and Property Managers can list agency properties',
        });
        return;
      }

      agentProfileId = expert.id;
    } else {
      // Consumer private listing
      privateOwnerId = user.id;
    }

    const baseSlug = slugify(`${streetAddress}-${suburb}-${city}`);
    const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;

    const property = await prisma.property.create({
      data: {
        title: title.trim(),
        slug: uniqueSlug,
        description: description.trim(),
        propertyType: String(propertyType).toUpperCase(),
        listingType: String(listingType).toUpperCase(),
        priceMinorUnits: priceMinorUnits ? parseInt(String(priceMinorUnits), 10) : null,
        priceDisplay: priceDisplay ? priceDisplay.trim() : 'Price on Application',
        bedrooms: parseInt(String(bedrooms), 10) || 0,
        bathrooms: parseInt(String(bathrooms), 10) || 0,
        parkingSpaces: parseInt(String(parkingSpaces), 10) || 0,
        floorAreaM2: floorAreaM2 ? parseFloat(String(floorAreaM2)) : null,
        landAreaM2: landAreaM2 ? parseFloat(String(landAreaM2)) : null,
        streetAddress: streetAddress.trim(),
        suburb: suburb.trim(),
        city: city.trim(),
        countryCode: countryCode.toUpperCase(),
        postalCode: postalCode ? postalCode.trim() : null,
        latitude: latitude ? parseFloat(String(latitude)) : null,
        longitude: longitude ? parseFloat(String(longitude)) : null,
        images: JSON.stringify(images),
        videoUrl: videoUrl ? videoUrl.trim() : null,
        documents: JSON.stringify(documents),
        isPrivateListing: !!isPrivateListing,
        agentProfileId,
        privateOwnerId,
        status: 'ACTIVE',
        isFeatured: false,
        isModerated: true,
        remoteViewingAvailable: !!remoteViewingAvailable,
      },
    });

    res.status(201).json(property);
  } catch (error) {
    console.error('Error creating property:', error);
    res.status(500).json({ error: 'Failed to create property listing' });
  }
});

// 6. PUT /api/properties/:id - Update property listing
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const property = await prisma.property.findUnique({
      where: { id },
      include: { agentProfile: true },
    });

    if (!property) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    // IDOR Protection: Must be agent owner, private owner, or SUPER_ADMIN
    const isOwner =
      (property.agentProfile && property.agentProfile.userId === user.id) ||
      property.privateOwnerId === user.id ||
      user.role === 'SUPER_ADMIN';

    if (!isOwner) {
      res.status(403).json({ error: 'Unauthorized to edit this property listing' });
      return;
    }

    const {
      title,
      description,
      propertyType,
      listingType,
      priceMinorUnits,
      priceDisplay,
      bedrooms,
      bathrooms,
      parkingSpaces,
      floorAreaM2,
      landAreaM2,
      streetAddress,
      suburb,
      city,
      images,
      videoUrl,
      documents,
      status,
      remoteViewingAvailable,
    } = req.body;

    const data: any = {};
    if (title) data.title = title.trim();
    if (description) data.description = description.trim();
    if (propertyType) data.propertyType = String(propertyType).toUpperCase();
    if (listingType) data.listingType = String(listingType).toUpperCase();
    if (priceMinorUnits !== undefined) data.priceMinorUnits = parseInt(String(priceMinorUnits), 10);
    if (priceDisplay !== undefined) data.priceDisplay = priceDisplay.trim();
    if (bedrooms !== undefined) data.bedrooms = parseInt(String(bedrooms), 10);
    if (bathrooms !== undefined) data.bathrooms = parseInt(String(bathrooms), 10);
    if (parkingSpaces !== undefined) data.parkingSpaces = parseInt(String(parkingSpaces), 10);
    if (floorAreaM2 !== undefined) data.floorAreaM2 = parseFloat(String(floorAreaM2));
    if (landAreaM2 !== undefined) data.landAreaM2 = parseFloat(String(landAreaM2));
    if (streetAddress) data.streetAddress = streetAddress.trim();
    if (suburb) data.suburb = suburb.trim();
    if (city) data.city = city.trim();
    if (images !== undefined) data.images = JSON.stringify(images);
    if (videoUrl !== undefined) data.videoUrl = videoUrl ? videoUrl.trim() : null;
    if (documents !== undefined) data.documents = JSON.stringify(documents);
    if (status) data.status = status;
    if (remoteViewingAvailable !== undefined) data.remoteViewingAvailable = !!remoteViewingAvailable;

    const updated = await prisma.property.update({
      where: { id },
      data,
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ error: 'Failed to update property listing' });
  }
});

// 7. POST /api/properties/:id/inquire - Free enquiry submission
router.post('/:id/inquire', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, phone, message } = req.body;

    if (!name || !email || !message) {
      res.status(400).json({ error: 'Name, email, and message are required' });
      return;
    }

    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        agentProfile: { include: { user: true } },
      },
    });

    if (!property) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    const inquiry = await prisma.propertyInquiry.create({
      data: {
        propertyId: property.id,
        consumerId: req.user ? req.user.id : null,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone ? phone.trim() : null,
        message: message.trim(),
        status: 'NEW',
      },
    });

    // Notify agent if property has listing agent
    if (property.agentProfile?.user) {
      await prisma.notification.create({
        data: {
          userId: property.agentProfile.user.id,
          type: 'SYSTEM_ALERT',
          title: 'New Property Enquiry',
          body: `${name} enquired about ${property.title}`,
          dataJson: JSON.stringify({ propertyId: property.id, inquiryId: inquiry.id }),
        },
      });
    }

    res.status(201).json({ success: true, inquiryId: inquiry.id });
  } catch (error) {
    console.error('Error submitting property inquiry:', error);
    res.status(500).json({ error: 'Failed to submit inquiry' });
  }
});

// 8. POST /api/properties/:id/book-physical-viewing - Physical inspection booking
router.post('/:id/book-physical-viewing', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { preferredDate, preferredTime, notes } = req.body;

    if (!preferredDate || !preferredTime) {
      res.status(400).json({ error: 'Preferred date and time are required' });
      return;
    }

    const property = await prisma.property.findUnique({
      where: { id },
      include: { agentProfile: { include: { user: true } } },
    });

    if (!property) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    const booking = await prisma.physicalViewingBooking.create({
      data: {
        propertyId: property.id,
        consumerId: req.user!.id,
        preferredDate: String(preferredDate).trim(),
        preferredTime: String(preferredTime).trim(),
        notes: notes ? notes.trim() : null,
        status: 'PENDING',
      },
    });

    // Alert agent
    if (property.agentProfile?.user) {
      await prisma.notification.create({
        data: {
          userId: property.agentProfile.user.id,
          type: 'APPOINTMENT_BOOKED',
          title: 'Physical Viewing Request',
          body: `Viewing requested for ${property.streetAddress} on ${preferredDate} at ${preferredTime}`,
          dataJson: JSON.stringify({ propertyId: property.id, bookingId: booking.id }),
        },
      });
    }

    res.status(201).json({ success: true, booking });
  } catch (error) {
    console.error('Error booking physical viewing:', error);
    res.status(500).json({ error: 'Failed to book physical viewing' });
  }
});

// 9. POST /api/properties/:id/save - Toggle bookmark
router.post('/:id/save', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const consumerId = req.user!.id;

    const existing = await prisma.savedProperty.findUnique({
      where: {
        propertyId_consumerId: {
          propertyId: id,
          consumerId,
        },
      },
    });

    if (existing) {
      await prisma.savedProperty.delete({
        where: { id: existing.id },
      });
      res.json({ saved: false });
    } else {
      await prisma.savedProperty.create({
        data: { propertyId: id, consumerId },
      });
      res.json({ saved: true });
    }
  } catch (error) {
    console.error('Error toggling saved property:', error);
    res.status(500).json({ error: 'Failed to update saved property' });
  }
});

export default router;
