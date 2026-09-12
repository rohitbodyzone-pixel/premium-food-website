/**
 * PropertyTalk — Property Insights Caching Service
 * 
 * Persists and retrieves fetched authoritative NZ property insights modules
 * into `PropertyInsightsCache` with provider-specific TTLs.
 */

import { prisma } from '../../db/prisma';

export const MODULE_TTLS_DAYS: Record<string, number> = {
  SCHOOLS: 30,             // MoE updates school lists & zones periodically
  LINZ_LEGAL: 30,          // LINZ Primary Parcels / Titles
  COUNCIL_VALUATION: 90,   // Council Rating Valuations (triennial updates)
  VALUATION_ESTIMATE: 14,  // CoreLogic / QV AVM monthly estimates
  RENT_ESTIMATE: 14,       // MBIE Tenancy Services lodged bond statistics
  HAZARDS: 30,             // Council GIS hazard overlays
  NEARBY_SALES: 7,         // Recent comparable settled sales
};

export interface CacheMetadata {
  source?: string;
  sourceDate?: string;
  status?: string;
  customTtlDays?: number;
}

export interface CachedResult<T> {
  data: T;
  source?: string | null;
  sourceDate?: string | null;
  status?: string | null;
  cachedAt: Date;
  expiresAt: Date;
}

export class InsightsCacheService {
  /**
   * Retrieve cached module payload if not expired
   */
  async get<T>(propertyId: string, module: string): Promise<CachedResult<T> | null> {
    try {
      const cached = await prisma.propertyInsightsCache.findUnique({
        where: {
          propertyId_module: {
            propertyId,
            module,
          },
        },
      });

      if (!cached) {
        return null;
      }

      // Check expiry
      if (new Date() > cached.expiresAt) {
        // Expired, return null so it gets re-fetched
        return null;
      }

      const data = JSON.parse(cached.payloadJson) as T;
      return {
        data,
        source: cached.source,
        sourceDate: cached.sourceDate,
        status: cached.status,
        cachedAt: cached.fetchedAt,
        expiresAt: cached.expiresAt,
      };
    } catch (err) {
      console.warn(`[InsightsCache] Error reading cache for property ${propertyId} module ${module}:`, err);
      return null;
    }
  }

  /**
   * Upsert module payload into cache with module-appropriate TTL
   */
  async set(propertyId: string, module: string, payload: any, meta?: CacheMetadata): Promise<void> {
    try {
      const ttlDays = meta?.customTtlDays ?? MODULE_TTLS_DAYS[module] ?? 14;
      const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
      const payloadJson = JSON.stringify(payload);

      await prisma.propertyInsightsCache.upsert({
        where: {
          propertyId_module: {
            propertyId,
            module,
          },
        },
        create: {
          propertyId,
          module,
          payloadJson,
          source: meta?.source || 'Public Record',
          sourceDate: meta?.sourceDate ?? null,
          status: meta?.status || 'AVAILABLE',
          expiresAt,
        },
        update: {
          payloadJson,
          source: meta?.source || 'Public Record',
          sourceDate: meta?.sourceDate ?? null,
          status: meta?.status || 'AVAILABLE',
          fetchedAt: new Date(),
          expiresAt,
        },
      });
    } catch (err) {
      console.warn(`[InsightsCache] Error setting cache for property ${propertyId} module ${module}:`, err);
    }
  }

  /**
   * Invalidate cache for a property
   */
  async invalidate(propertyId: string, module?: string): Promise<void> {
    try {
      if (module) {
        await prisma.propertyInsightsCache.deleteMany({
          where: { propertyId, module },
        });
      } else {
        await prisma.propertyInsightsCache.deleteMany({
          where: { propertyId },
        });
      }
    } catch (err) {
      console.warn(`[InsightsCache] Error invalidating cache for property ${propertyId}:`, err);
    }
  }

  /**
   * Purge expired cache entries
   */
  async purgeExpired(): Promise<number> {
    try {
      const result = await prisma.propertyInsightsCache.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });
      return result.count;
    } catch (err) {
      console.warn('[InsightsCache] Error purging expired cache:', err);
      return 0;
    }
  }
}

export const insightsCacheService = new InsightsCacheService();
