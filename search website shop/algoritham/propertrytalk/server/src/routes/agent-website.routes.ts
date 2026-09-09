import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware';

const router = Router();

// 1. GET /api/agent-websites/mine - Current expert's mini website settings
router.get('/mine', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const expert = await prisma.expertProfile.findUnique({
      where: { userId: user.id },
      include: {
        user: true,
        category: true,
        miniWebsite: {
          include: {
            articles: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!expert) {
      res.status(404).json({ error: 'Expert profile not found' });
      return;
    }

    // Auto-create mini website draft if not yet initialized for verified agent
    let website = expert.miniWebsite;
    if (!website && ['real-estate-agent', 'property-manager'].includes(expert.category.slug)) {
      const slugBase = user.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      website = await prisma.agentMiniWebsite.create({
        data: {
          expertProfileId: expert.id,
          slug: slugBase,
          customHeadline: `${expert.title} in ${expert.city}`,
          customAbout: expert.bio,
          agencyName: expert.businessName,
          serviceAreas: expert.specialities || '[]',
          socialLinks: JSON.stringify({}),
          contactEmail: user.email || '',
          contactPhone: expert.user?.phone || null,
          isPublished: true,
          isModerated: true,
          metaTitle: `${user.name} | Licensed Property Professional ${expert.city}`,
          metaDescription: expert.bio.substring(0, 160),
        },
        include: { articles: true },
      });
    }

    res.json(website);
  } catch (error) {
    console.error('Error fetching agent mini website:', error);
    res.status(500).json({ error: 'Failed to fetch mini website' });
  }
});

// 2. PUT /api/agent-websites/mine - Update current expert's mini website
router.put('/mine', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const expert = await prisma.expertProfile.findUnique({
      where: { userId: user.id },
      include: { miniWebsite: true },
    });

    if (!expert || !expert.miniWebsite) {
      res.status(404).json({ error: 'Mini website not found' });
      return;
    }

    const {
      slug,
      customHeadline,
      customAbout,
      coverImageUrl,
      agencyName,
      agencyLogoUrl,
      serviceAreas,
      socialLinks,
      contactPhone,
      contactEmail,
      metaTitle,
      metaDescription,
      isPublished,
    } = req.body;

    const data: any = {};
    if (slug) {
      const cleaned = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
      // Check collision
      const existing = await prisma.agentMiniWebsite.findFirst({
        where: { slug: cleaned, id: { not: expert.miniWebsite.id } },
      });
      if (existing) {
        res.status(409).json({ error: 'Website URL slug is already taken by another agent' });
        return;
      }
      data.slug = cleaned;
    }

    if (customHeadline !== undefined) data.customHeadline = customHeadline;
    if (customAbout !== undefined) data.customAbout = customAbout;
    if (coverImageUrl !== undefined) data.coverImageUrl = coverImageUrl;
    if (agencyName !== undefined) data.agencyName = agencyName;
    if (agencyLogoUrl !== undefined) data.agencyLogoUrl = agencyLogoUrl;
    if (serviceAreas !== undefined) data.serviceAreas = JSON.stringify(serviceAreas);
    if (socialLinks !== undefined) data.socialLinks = JSON.stringify(socialLinks);
    if (contactPhone !== undefined) data.contactPhone = contactPhone;
    if (contactEmail !== undefined) data.contactEmail = contactEmail;
    if (metaTitle !== undefined) data.metaTitle = metaTitle;
    if (metaDescription !== undefined) data.metaDescription = metaDescription;
    if (isPublished !== undefined) data.isPublished = !!isPublished;

    const updated = await prisma.agentMiniWebsite.update({
      where: { id: expert.miniWebsite.id },
      data,
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating mini website:', error);
    res.status(500).json({ error: 'Failed to update mini website' });
  }
});

// 3. GET /api/agent-websites/:slug - Public mini website landing page data
router.get('/:slug', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const website = await prisma.agentMiniWebsite.findUnique({
      where: { slug: slug.toLowerCase() },
      include: {
        expertProfile: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
            category: true,
            country: true,
            reviewsReceived: {
              include: { consumer: { select: { name: true } } },
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
            properties: {
              where: { status: 'ACTIVE', isModerated: true },
              include: {
                liveViewingSessions: {
                  where: { status: 'SCHEDULED' },
                  take: 1,
                },
              },
              orderBy: { createdAt: 'desc' },
            },
            liveViewingSessions: {
              where: { status: { in: ['SCHEDULED', 'LIVE'] } },
              include: {
                property: {
                  select: { id: true, title: true, streetAddress: true, suburb: true, city: true, images: true },
                },
              },
              orderBy: { scheduledAt: 'asc' },
              take: 3,
            },
          },
        },
        articles: {
          where: { status: 'PUBLISHED', isModerated: true },
          orderBy: { publishedAt: 'desc' },
          take: 4,
        },
      },
    });

    if (!website || (!website.isPublished && req.user?.id !== website.expertProfile.userId)) {
      res.status(404).json({ error: 'Agent mini website not found or not published' });
      return;
    }

    // Increment visitor count asynchronously
    prisma.agentMiniWebsite
      .update({
        where: { id: website.id },
        data: { visitorCount: { increment: 1 } },
      })
      .catch(() => {});

    // Parse JSON strings
    let serviceAreas: string[] = [];
    let socialLinks: any = {};
    try {
      serviceAreas = JSON.parse(website.serviceAreas || '[]');
    } catch {
      serviceAreas = [];
    }
    try {
      socialLinks = JSON.parse(website.socialLinks || '{}');
    } catch {
      socialLinks = {};
    }

    const formattedProperties = website.expertProfile.properties.map((p) => {
      let parsedImages: string[] = [];
      try {
        parsedImages = JSON.parse(p.images || '[]');
      } catch {
        parsedImages = [];
      }
      return { ...p, images: parsedImages };
    });

    res.json({
      ...website,
      serviceAreas,
      socialLinks,
      expertProfile: {
        ...website.expertProfile,
        properties: formattedProperties,
      },
      // Schema.org RealEstateAgent structured data
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'RealEstateAgent',
        name: website.expertProfile.user.name,
        image: website.expertProfile.photoUrl,
        telephone: website.contactPhone || website.expertProfile.user.phone,
        email: website.contactEmail || website.expertProfile.user.email,
        description: website.customAbout || website.expertProfile.bio,
        address: {
          '@type': 'PostalAddress',
          addressLocality: website.expertProfile.city,
          addressCountry: 'NZ',
        },
        priceRange: '$$$$',
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: website.expertProfile.ratingAvg || 5.0,
          reviewCount: website.expertProfile.ratingCount || 1,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching agent mini website:', error);
    res.status(500).json({ error: 'Failed to load agent mini website' });
  }
});

// 4. POST /api/agent-websites/:slug/lead - Public inquiry / lead capture
router.post('/:slug/lead', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { name, email, phone, message, preferredContactMethod = 'EMAIL' } = req.body;

    if (!name || !email || !message) {
      res.status(400).json({ error: 'Name, email, and message are required' });
      return;
    }

    const website = await prisma.agentMiniWebsite.findUnique({
      where: { slug: slug.toLowerCase() },
      include: {
        expertProfile: {
          include: { user: true },
        },
      },
    });

    if (!website) {
      res.status(404).json({ error: 'Agent mini website not found' });
      return;
    }

    // Increment lead counter
    await prisma.agentMiniWebsite.update({
      where: { id: website.id },
      data: { enquiryCount: { increment: 1 } },
    });

    // Notify agent via In-App Notification
    await prisma.notification.create({
      data: {
        userId: website.expertProfile.user.id,
        type: 'SYSTEM_ALERT',
        title: 'New Mini-Website Lead',
        body: `${name} (${email}) sent an inquiry from your mini website: "${message.substring(0, 80)}..."`,
        priority: 'HIGH',
        dataJson: JSON.stringify({
          source: 'MINI_WEBSITE',
          name,
          email,
          phone,
          preferredContactMethod,
        }),
      },
    });

    res.status(201).json({ success: true, message: 'Your enquiry has been delivered directly to the agent.' });
  } catch (error) {
    console.error('Error submitting lead:', error);
    res.status(500).json({ error: 'Failed to submit enquiry' });
  }
});

// 5. GET /api/agent-websites/:slug/sitemap.xml - XML sitemap
router.get('/:slug/sitemap.xml', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const website = await prisma.agentMiniWebsite.findUnique({
      where: { slug: slug.toLowerCase() },
      include: {
        articles: { where: { status: 'PUBLISHED' } },
        expertProfile: {
          include: {
            properties: { where: { status: 'ACTIVE' } },
          },
        },
      },
    });

    if (!website) {
      res.status(404).send('Sitemap not found');
      return;
    }

    const baseUrl = process.env.CLIENT_URL || 'https://propertytalk.co.nz';
    const urls = [
      `<url><loc>${baseUrl}/agent/${website.slug}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
      ...website.expertProfile.properties.map(
        (p) => `<url><loc>${baseUrl}/properties/${p.slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`
      ),
      ...website.articles.map(
        (a) => `<url><loc>${baseUrl}/articles/${a.slug}</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>`
      ),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls.join('\n  ')}
</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

export default router;
