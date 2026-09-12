import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware';
import { getGooglePropertyProvider } from '../services/google/google-provider.factory';
import { placesCacheService } from '../services/google/google-places-cache.service';
import { getValuationProvider, councilValuationService } from '../services/insights/valuation.provider';
import { nzSchoolService } from '../services/insights/school.service';
import { councilHazardProvider } from '../services/insights/hazard.service';
import { nearbySalesService } from '../services/insights/nearby-sales.service';
import { getLinzPropertyProvider } from '../services/insights/linz.provider';
import { insightsCacheService } from '../services/insights/insights-cache.service';
import { TradeMePropertyInsightsResponse, DataSourceInfo } from '../services/insights/insights.interface';

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

/**
 * POST /api/properties/validate-address
 * Validates entered address with Google Address Validation
 * Never exposes private Google credentials to frontend
 */
router.post('/validate-address', requireAuth, async (req: Request, res: Response) => {
  try {
    const { streetAddress, suburb, city, region, postalCode, countryCode = 'NZ' } = req.body;

    if (!streetAddress || !city) {
      res.status(400).json({ error: 'Street address and city are required for address validation' });
      return;
    }

    const provider = getGooglePropertyProvider();
    const result = await provider.validateAddress({
      streetAddress: String(streetAddress).trim(),
      suburb: suburb ? String(suburb).trim() : undefined,
      city: String(city).trim(),
      region: region ? String(region).trim() : undefined,
      postalCode: postalCode ? String(postalCode).trim() : undefined,
      countryCode: String(countryCode).trim(),
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error validating property address:', error);
    res.status(500).json({
      error: error.message || 'Failed to validate address',
      status: 'COULD_NOT_VERIFY',
    });
  }
});

/**
 * POST /api/properties/geocode-address
 * Authoritative server-side Geocoding for confirmed address
 */
router.post('/geocode-address', requireAuth, async (req: Request, res: Response) => {
  try {
    const { streetAddress, suburb, city, region, postalCode, countryCode = 'NZ' } = req.body;

    if (!streetAddress || !city) {
      res.status(400).json({ error: 'Street address and city are required for geocoding' });
      return;
    }

    const provider = getGooglePropertyProvider();
    const result = await provider.geocodeAddress({
      streetAddress: String(streetAddress).trim(),
      suburb: suburb ? String(suburb).trim() : undefined,
      city: String(city).trim(),
      region: region ? String(region).trim() : undefined,
      postalCode: postalCode ? String(postalCode).trim() : undefined,
      countryCode: String(countryCode).trim(),
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error geocoding property address:', error);
    res.status(500).json({ error: error.message || 'Failed to geocode address' });
  }
});

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

/**
 * 4b. GET /api/properties/:idOrSlug/nearby-amenities
 * Returns cached or freshly fetched nearby amenities (Schools, Supermarkets, etc.)
 * Protected by database caching with TTL and Super Admin feature flag
 */
router.get('/:idOrSlug/nearby-amenities', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { idOrSlug } = req.params;
    const { forceRefresh } = req.query;

    // 1. Check feature flag
    const placesConfig = await prisma.systemConfig.findUnique({
      where: { key: 'google_places_enabled' },
    });
    const isPlacesEnabled = placesConfig ? placesConfig.value === 'true' : true;

    if (!isPlacesEnabled) {
      res.json({
        enabled: false,
        message: 'Nearby amenities feature is currently disabled by administrator.',
        amenities: [],
        byCategory: {},
        categoriesAvailable: [],
        totalCount: 0,
      });
      return;
    }

    // 2. Find property
    const property = await prisma.property.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        streetAddress: true,
        city: true,
        countryCode: true,
      },
    });

    if (!property) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    // 3. Fallback coordinates if property not geocoded yet
    let lat = property.latitude;
    let lng = property.longitude;

    if (!lat || !lng) {
      try {
        const provider = getGooglePropertyProvider();
        const geo = await provider.geocodeAddress({
          streetAddress: property.streetAddress,
          city: property.city,
          countryCode: property.countryCode,
        });
        lat = geo.latitude;
        lng = geo.longitude;

        await prisma.property.update({
          where: { id: property.id },
          data: {
            latitude: lat,
            longitude: lng,
            googlePlaceId: geo.googlePlaceId,
            formattedAddress: geo.formattedAddress,
          },
        });
      } catch {
        res.json({
          enabled: true,
          message: 'Property has no verified coordinates to query nearby places.',
          amenities: [],
          byCategory: {},
          categoriesAvailable: [],
          totalCount: 0,
        });
        return;
      }
    }

    // 4. Retrieve from cache or query Google Places API
    const provider = getGooglePropertyProvider();
    const result = await placesCacheService.getOrFetchAmenities(
      property.id,
      { latitude: lat, longitude: lng },
      provider,
      { forceRefresh: forceRefresh === 'true' }
    );

    res.json({
      enabled: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Error fetching nearby amenities:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch nearby amenities' });
  }
});

/**
 * 4c. GET /api/properties/:idOrSlug/insights
 * Returns authoritative Trade Me Property Insights equivalent:
 * 1. Location & Map coordinates
 * 2. Property Value Estimate (CoreLogic / QV / Unconfigured fallback)
 * 3. Weekly Rent Estimate
 * 4. Gross Rental Yield
 * 5. Official NZ MoE schools & enrolment zones
 * 6. Public Sales History records
 * 7. Capital Value / Council Rateable Value
 * 8. Nearby Comparable Recent Sales
 * 9. Legal & Property details (Lot/DP, Title Ref, Estate, Zoning, Council)
 * 10. Council Flood & Hazard mapping overlays & LIM advisory
 */
router.get('/:idOrSlug/insights', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { idOrSlug } = req.params;
    const forceRefresh = req.query.forceRefresh === 'true';

    // 0. Super Admin Feature Flag check
    const flagConfigs = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: [
            'property_insights_enabled',
            'property_value_enabled',
            'rent_estimate_enabled',
            'sales_history_enabled',
            'nearby_sales_enabled',
            'school_information_enabled',
            'school_zones_enabled',
            'council_valuation_enabled',
            'legal_property_details_enabled',
            'property_hazards_enabled',
          ],
        },
      },
    });

    const flags: Record<string, boolean> = {
      property_insights_enabled: true,
      property_value_enabled: true,
      rent_estimate_enabled: true,
      sales_history_enabled: true,
      nearby_sales_enabled: true,
      school_information_enabled: true,
      school_zones_enabled: true,
      council_valuation_enabled: true,
      legal_property_details_enabled: true,
      property_hazards_enabled: true,
    };

    for (const c of flagConfigs) {
      flags[c.key] = c.value === 'true';
    }

    if (!flags.property_insights_enabled) {
      res.json({
        enabled: false,
        message: 'Property insights feature is currently disabled by administrator.',
        propertyId: idOrSlug,
      });
      return;
    }

    // 1. Query property with public sales history
    const property = await prisma.property.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        salesHistory: {
          orderBy: { saleDate: 'desc' },
        },
      },
    });

    if (!property) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    // 2. Latitude & Longitude resolution
    let lat = property.latitude;
    let lng = property.longitude;

    if (!lat || !lng) {
      try {
        const provider = getGooglePropertyProvider();
        const geo = await provider.geocodeAddress({
          streetAddress: property.streetAddress,
          suburb: property.suburb,
          city: property.city,
          countryCode: property.countryCode,
        });
        lat = geo.latitude;
        lng = geo.longitude;

        await prisma.property.update({
          where: { id: property.id },
          data: {
            latitude: lat,
            longitude: lng,
            googlePlaceId: geo.googlePlaceId,
            formattedAddress: geo.formattedAddress,
          },
        });
      } catch {
        // Continue with null if geocoding fails
      }
    }

    const dataSources: DataSourceInfo[] = [];

    // 3. Property Valuation Estimate
    let valuation: any;
    if (flags.property_value_enabled) {
      const cachedVal = !forceRefresh ? await insightsCacheService.get<any>(property.id, 'VALUATION_ESTIMATE') : null;
      if (cachedVal) {
        valuation = cachedVal.data;
        dataSources.push({
          module: 'Property Value Estimate',
          source: valuation.source || 'CoreLogic / QV (AVM)',
          sourceDate: valuation.estimateDate,
          status: 'CACHED',
          message: 'Authoritative automated valuation model estimate',
        });
      } else {
        const valuationProvider = getValuationProvider();
        valuation = await valuationProvider.getValuation(property);
        await insightsCacheService.set(property.id, 'VALUATION_ESTIMATE', valuation, {
          source: valuation.source,
          sourceDate: valuation.estimateDate,
          status: valuation.available ? 'AVAILABLE' : 'WAITING_FOR_PROVIDER_CREDENTIALS',
        });
        dataSources.push({
          module: 'Property Value Estimate',
          source: valuation.source || 'CoreLogic / QV (AVM)',
          sourceDate: valuation.estimateDate,
          status: valuation.available ? 'LIVE' : 'WAITING_FOR_CREDENTIALS',
          message: valuation.unavailabilityReason,
        });
      }
    } else {
      valuation = { available: false, unavailabilityReason: 'Disabled by administrator' };
      dataSources.push({ module: 'Property Value Estimate', source: 'CoreLogic / QV (AVM)', status: 'DISABLED' });
    }

    // 4. Weekly Rent Estimate
    let rental: any;
    if (flags.rent_estimate_enabled) {
      const cachedRent = !forceRefresh ? await insightsCacheService.get<any>(property.id, 'RENT_ESTIMATE') : null;
      if (cachedRent) {
        rental = cachedRent.data;
        dataSources.push({
          module: 'Weekly Rent Estimate',
          source: rental.source || 'MBIE Tenancy Services',
          sourceDate: rental.estimateDate,
          status: 'CACHED',
          message: rental.label === 'Area Market Rent' ? 'Official MBIE Tenancy Services lodged bond statistics' : 'Property Rental Appraisal',
        });
      } else {
        const valuationProvider = getValuationProvider();
        rental = await valuationProvider.getRentEstimate(property);
        await insightsCacheService.set(property.id, 'RENT_ESTIMATE', rental, {
          source: rental.source,
          sourceDate: rental.estimateDate,
          status: rental.available ? 'AVAILABLE' : 'UNAVAILABLE',
        });
        dataSources.push({
          module: 'Weekly Rent Estimate',
          source: rental.source || 'MBIE Tenancy Services',
          sourceDate: rental.estimateDate,
          status: rental.available ? 'LIVE' : 'UNAVAILABLE',
          message: rental.label === 'Area Market Rent' ? 'Official MBIE Tenancy Services lodged bond statistics' : 'Property Rental Appraisal',
        });
      }
    } else {
      rental = { available: false, unavailabilityReason: 'Disabled by administrator' };
      dataSources.push({ module: 'Weekly Rent Estimate', source: 'MBIE Tenancy Services', status: 'DISABLED' });
    }

    // 5. Gross Rental Yield
    const valuationProvider = getValuationProvider();
    const rentalYield = valuationProvider.calculateRentalYield(valuation, rental);

    // 6. Official MoE School Directory & Enrolment Zone Evaluation
    let schools: any;
    if (flags.school_information_enabled) {
      const cachedSchools = !forceRefresh ? await insightsCacheService.get<any>(property.id, 'SCHOOLS') : null;
      if (cachedSchools) {
        schools = cachedSchools.data;
        dataSources.push({
          module: 'School Information & Zones',
          source: 'Ministry of Education (MoE)',
          sourceDate: '2026 Directory',
          status: 'CACHED',
          message: 'Official MoE School Directory and zone boundaries',
        });
      } else {
        schools = (lat && lng)
          ? nzSchoolService.getSchoolsNearProperty(lat, lng)
          : { totalCount: 0, inZoneCount: 0, schools: [] };

        if (!flags.school_zones_enabled) {
          schools = {
            ...schools,
            inZoneCount: 0,
            schools: schools.schools.map((s: any) => ({
              ...s,
              hasZone: false,
              zoneStatus: 'NOT_ZONED',
            })),
          };
        }

        await insightsCacheService.set(property.id, 'SCHOOLS', schools, {
          source: 'Ministry of Education (MoE)',
          sourceDate: '2026 Directory',
          status: 'AVAILABLE',
        });
        dataSources.push({
          module: 'School Information & Zones',
          source: 'Ministry of Education (MoE)',
          sourceDate: '2026 Directory',
          status: 'LIVE',
          message: 'Authoritative MoE School Directory & Enrolment Zone Polygons',
        });
      }
    } else {
      schools = { totalCount: 0, inZoneCount: 0, schools: [] };
      dataSources.push({ module: 'School Information & Zones', source: 'Ministry of Education (MoE)', status: 'DISABLED' });
    }

    // 7. Public Sales History Records
    let salesHistory: any[] = [];
    if (flags.sales_history_enabled) {
      salesHistory = (property.salesHistory || []).map((sh) => {
        const d = new Date(sh.saleDate);
        return {
          id: sh.id,
          saleDate: d.toLocaleDateString('en-NZ', { month: 'short', year: 'numeric' }),
          saleYear: d.getFullYear(),
          priceMinorUnits: sh.priceMinorUnits,
          priceDisplay: `$${(sh.priceMinorUnits / 100).toLocaleString('en-NZ')}`,
          saleType: sh.saleType || 'Arms-length sale',
        };
      });
      dataSources.push({
        module: 'Sales History Records',
        source: 'NZ Public Property Transfer Register',
        status: 'LIVE',
        message: 'Authoritative settled property sale records',
      });
    } else {
      dataSources.push({ module: 'Sales History Records', source: 'NZ Public Property Transfer Register', status: 'DISABLED' });
    }

    // 8. Council Rateable Valuation (CV, LV, Improvements)
    let councilValuation: any;
    if (flags.council_valuation_enabled) {
      const cachedCV = !forceRefresh ? await insightsCacheService.get<any>(property.id, 'COUNCIL_VALUATION') : null;
      if (cachedCV) {
        councilValuation = cachedCV.data;
        dataSources.push({
          module: 'Council Rating Valuation',
          source: councilValuation.valuationSource || 'Council Rating Valuation',
          sourceDate: councilValuation.valuationDate || undefined,
          status: 'CACHED',
        });
      } else {
        councilValuation = councilValuationService.getCouncilValuation(property);
        await insightsCacheService.set(property.id, 'COUNCIL_VALUATION', councilValuation, {
          source: councilValuation.valuationSource,
          sourceDate: councilValuation.valuationDate || undefined,
          status: councilValuation.capitalValueMinorUnits ? 'AVAILABLE' : 'UNAVAILABLE',
        });
        dataSources.push({
          module: 'Council Rating Valuation',
          source: councilValuation.valuationSource || 'Council Rating Valuation',
          sourceDate: councilValuation.valuationDate || undefined,
          status: 'LIVE',
        });
      }
    } else {
      councilValuation = { valuationSource: 'Disabled by administrator' };
      dataSources.push({ module: 'Council Rating Valuation', source: 'Council Rating Roll', status: 'DISABLED' });
    }

    // 9. Nearby Comparable Recent Sales
    let nearbySales: any[] = [];
    if (flags.nearby_sales_enabled) {
      const cachedNearby = !forceRefresh ? await insightsCacheService.get<any[]>(property.id, 'NEARBY_SALES') : null;
      if (cachedNearby) {
        nearbySales = cachedNearby.data;
        dataSources.push({
          module: 'Nearby Comparable Sales',
          source: 'Authoritative NZ Public Transfer Records',
          status: 'CACHED',
        });
      } else {
        nearbySales = await nearbySalesService.getNearbyRecentSales(
          property.id,
          lat || -36.85,
          lng || 174.75,
          property.city,
          property.suburb
        );
        await insightsCacheService.set(property.id, 'NEARBY_SALES', nearbySales, {
          source: 'Authoritative NZ Public Transfer Records',
          status: nearbySales.length > 0 ? 'AVAILABLE' : 'NO_DATA',
        });
        dataSources.push({
          module: 'Nearby Comparable Sales',
          source: 'Authoritative NZ Public Transfer Records',
          status: 'LIVE',
        });
      }
    } else {
      dataSources.push({ module: 'Nearby Comparable Sales', source: 'NZ Public Transfer Records', status: 'DISABLED' });
    }

    // 10. Legal & Property Details (LINZ Primary Parcels / Titles)
    let legalDetails: any;
    if (flags.legal_property_details_enabled) {
      const cachedLegal = !forceRefresh ? await insightsCacheService.get<any>(property.id, 'LINZ_LEGAL') : null;
      if (cachedLegal) {
        legalDetails = cachedLegal.data;
        dataSources.push({
          module: 'Legal & Property Details',
          source: legalDetails.source || 'Land Information New Zealand (LINZ)',
          status: 'CACHED',
        });
      } else {
        const linzProvider = getLinzPropertyProvider();
        const linzResult = await linzProvider.getPropertyLegalDetails({
          ...property,
          latitude: lat,
          longitude: lng,
        });
        const isWaiting = linzResult.status === 'WAITING_FOR_CREDENTIALS';
        const isLive = linzResult.status === 'LIVE' || linzResult.status === 'CACHED';
        legalDetails = {
          available: linzResult.available,
          ...linzResult.data,
          status: isLive ? 'LIVE' : isWaiting ? 'WAITING_FOR_PROVIDER_CREDENTIALS' : 'UNAVAILABLE',
          unavailabilityReason: linzResult.message,
        };
        await insightsCacheService.set(property.id, 'LINZ_LEGAL', legalDetails, {
          source: legalDetails.source,
          status: linzResult.status,
        });
        dataSources.push({
          module: 'Legal & Property Details',
          source: legalDetails.source || 'Land Information New Zealand (LINZ)',
          status: isLive ? 'LIVE' : isWaiting ? 'WAITING_FOR_CREDENTIALS' : 'UNAVAILABLE',
          message: linzResult.message,
        });
      }
    } else {
      legalDetails = { source: 'Disabled by administrator' };
      dataSources.push({ module: 'Legal & Property Details', source: 'Land Information New Zealand (LINZ)', status: 'DISABLED' });
    }

    // 11. Council Flood & Hazard Mapping Overlays
    let hazards: any;
    if (flags.property_hazards_enabled) {
      const cachedHazards = !forceRefresh ? await insightsCacheService.get<any>(property.id, 'HAZARDS') : null;
      if (cachedHazards) {
        hazards = cachedHazards.data;
        dataSources.push({
          module: 'Council Hazard & Flood Overlay',
          source: `${hazards.councilName} Open GIS Portal`,
          status: 'CACHED',
        });
      } else {
        hazards = councilHazardProvider.getHazardData({
          streetAddress: property.streetAddress,
          suburb: property.suburb,
          city: property.city,
          region: property.region || undefined,
          latitude: lat,
          longitude: lng,
        });
        await insightsCacheService.set(property.id, 'HAZARDS', hazards, {
          source: `${hazards.councilName} Open GIS Portal`,
          status: hazards.status,
        });
        dataSources.push({
          module: 'Council Hazard & Flood Overlay',
          source: `${hazards.councilName} Open GIS Portal`,
          status: hazards.status === 'PROVIDER_UNAVAILABLE' ? 'UNAVAILABLE' : 'LIVE',
        });
      }
    } else {
      hazards = {
        isHazardDataAvailable: false,
        councilName: property.city,
        overlays: [],
        limNotice: 'Absence of mapped hazard data does not imply absence of risk. Consult a Land Information Memorandum (LIM) or Council GIS.',
      };
      dataSources.push({ module: 'Council Hazard & Flood Overlay', source: 'Council Open GIS', status: 'DISABLED' });
    }

    const responseData: TradeMePropertyInsightsResponse = {
      propertyId: property.id,
      valuation,
      rental,
      rentalYield,
      councilValuation,
      schools,
      salesHistory,
      nearbySales,
      legalDetails,
      hazards,
      dataSources,
    };

    res.json(responseData);
  } catch (error: any) {
    console.error('Error fetching property insights:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch property insights' });
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

    let resolvedLat = latitude ? parseFloat(String(latitude)) : null;
    let resolvedLng = longitude ? parseFloat(String(longitude)) : null;
    let resolvedPlaceId = req.body.googlePlaceId ? String(req.body.googlePlaceId).trim() : null;
    let resolvedFormatted = req.body.formattedAddress ? String(req.body.formattedAddress).trim() : null;
    let resolvedRegion = req.body.region ? String(req.body.region).trim() : null;
    let resolvedValidationStatus = req.body.addressValidationStatus ? String(req.body.addressValidationStatus).trim() : null;

    // Authoritative server-side geocode if coordinates not supplied
    if (resolvedLat === null || resolvedLng === null) {
      try {
        const provider = getGooglePropertyProvider();
        const geo = await provider.geocodeAddress({
          streetAddress: streetAddress.trim(),
          suburb: suburb.trim(),
          city: city.trim(),
          countryCode: countryCode.toUpperCase(),
        });
        resolvedLat = geo.latitude;
        resolvedLng = geo.longitude;
        if (!resolvedPlaceId) resolvedPlaceId = geo.googlePlaceId;
        if (!resolvedFormatted) resolvedFormatted = geo.formattedAddress;
        if (!resolvedRegion) resolvedRegion = geo.region;
        if (!resolvedValidationStatus) resolvedValidationStatus = 'VERIFIED';
      } catch (e: any) {
        console.warn('[PropertyRoutes] Server auto-geocode fallback warning:', e.message);
      }
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
        formattedAddress: resolvedFormatted,
        region: resolvedRegion,
        googlePlaceId: resolvedPlaceId,
        addressValidationStatus: resolvedValidationStatus,
        latitude: resolvedLat,
        longitude: resolvedLng,
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

    // Asynchronously pre-cache nearby places if coordinates are present
    if (property.latitude && property.longitude) {
      const provider = getGooglePropertyProvider();
      placesCacheService
        .getOrFetchAmenities(
          property.id,
          { latitude: property.latitude, longitude: property.longitude },
          provider
        )
        .catch(() => {});
    }

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
    if (req.body.formattedAddress !== undefined) data.formattedAddress = req.body.formattedAddress ? String(req.body.formattedAddress).trim() : null;
    if (req.body.region !== undefined) data.region = req.body.region ? String(req.body.region).trim() : null;
    if (req.body.googlePlaceId !== undefined) data.googlePlaceId = req.body.googlePlaceId ? String(req.body.googlePlaceId).trim() : null;
    if (req.body.addressValidationStatus !== undefined) data.addressValidationStatus = req.body.addressValidationStatus ? String(req.body.addressValidationStatus).trim() : null;
    if (req.body.latitude !== undefined) data.latitude = req.body.latitude ? parseFloat(String(req.body.latitude)) : null;
    if (req.body.longitude !== undefined) data.longitude = req.body.longitude ? parseFloat(String(req.body.longitude)) : null;
    if (images !== undefined) data.images = JSON.stringify(images);
    if (videoUrl !== undefined) data.videoUrl = videoUrl ? videoUrl.trim() : null;
    if (documents !== undefined) data.documents = JSON.stringify(documents);
    if (status) data.status = status;
    if (remoteViewingAvailable !== undefined) data.remoteViewingAvailable = !!remoteViewingAvailable;

    const updated = await prisma.property.update({
      where: { id },
      data,
    });

    // Invalidate cached LINZ / Insights if coordinates or address changed
    if (data.latitude !== undefined || data.longitude !== undefined || data.streetAddress !== undefined) {
      await insightsCacheService.invalidate(id, 'LINZ_LEGAL');
    }

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
