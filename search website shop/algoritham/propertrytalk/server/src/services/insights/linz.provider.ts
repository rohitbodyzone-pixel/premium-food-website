/**
 * PropertyTalk — LINZ (Land Information New Zealand) Property & Parcel Provider
 * 
 * Uses the official LINZ Data Service (LDS) APIs:
 * - Layer 50772: NZ Primary Parcels (Koordinates Vector Query API & WFS 2.0.0 GetFeature)
 * 
 * Security & Privacy:
 * - Strictly protects private title-holder and individual owner information.
 *   Layer 50772 contains NO owner names, personal identifiers, or mortgages.
 * - Queries strictly by authoritative coordinates using spatial containment:
 *   Koordinates Vector Query (point-in-parcel) or WFS CQL Intersects(shape, POINT(lng lat)).
 * - When LINZ_API_KEY is unconfigured in production, safely returns WAITING_FOR_CREDENTIALS
 *   without fabricating data or leaking keys.
 */

import { PropertyLegalDetails } from './insights.interface';

export interface ILinzPropertyProvider {
  getLegalAndParcelDetails(property: {
    id: string;
    streetAddress: string;
    suburb: string;
    city: string;
    latitude?: number | null;
    longitude?: number | null;
    legalDescription?: string | null;
    titleReference?: string | null;
    estateType?: string | null;
    landAreaM2?: number | null;
    floorAreaM2?: number | null;
    councilName?: string | null;
    districtZoning?: string | null;
  }): Promise<{
    available: boolean;
    status: 'LIVE' | 'CACHED' | 'WAITING_FOR_CREDENTIALS' | 'UNAVAILABLE';
    data: PropertyLegalDetails;
    message?: string;
  }>;
  getPropertyLegalDetails(property: {
    id: string;
    streetAddress: string;
    suburb: string;
    city: string;
    latitude?: number | null;
    longitude?: number | null;
    legalDescription?: string | null;
    titleReference?: string | null;
    estateType?: string | null;
    landAreaM2?: number | null;
    floorAreaM2?: number | null;
    councilName?: string | null;
    districtZoning?: string | null;
  }): Promise<{
    available: boolean;
    status: 'LIVE' | 'CACHED' | 'WAITING_FOR_CREDENTIALS' | 'UNAVAILABLE';
    data: PropertyLegalDetails;
    message?: string;
  }>;
}

export class LiveLinzPropertyProvider implements ILinzPropertyProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, customBaseUrl?: string) {
    this.apiKey = apiKey.trim();
    this.baseUrl = customBaseUrl || 'https://data.linz.govt.nz/services';
  }

  async getLegalAndParcelDetails(property: {
    id: string;
    streetAddress: string;
    suburb: string;
    city: string;
    latitude?: number | null;
    longitude?: number | null;
    legalDescription?: string | null;
    titleReference?: string | null;
    estateType?: string | null;
    landAreaM2?: number | null;
    floorAreaM2?: number | null;
    councilName?: string | null;
    districtZoning?: string | null;
  }) {
    if (!property.latitude || !property.longitude) {
      return {
        available: false,
        status: 'UNAVAILABLE' as const,
        data: {
          available: false,
          legalDescription: property.legalDescription || null,
          titleReference: property.titleReference || null,
          estateType: property.estateType || null,
          landAreaM2: property.landAreaM2 || null,
          floorAreaM2: property.floorAreaM2 || null,
          councilName: property.councilName || null,
          districtZoning: property.districtZoning || null,
        },
        message: 'Coordinates required for LINZ parcel spatial lookup',
      };
    }

    const lat = property.latitude;
    const lng = property.longitude;

    try {
      // 1. Primary Query: Koordinates Vector Query API (Point-in-Parcel containment)
      // Radius of 15 meters safely matches parcel centroid / coordinate pin
      const vectorUrl = `${this.baseUrl}/query/v1/vector.json?key=${encodeURIComponent(
        this.apiKey
      )}&layer=50772&x=${lng}&y=${lat}&max_results=1&radius=15`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      let feature: any = null;

      try {
        const res = await fetch(vectorUrl, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });

        if (res.status === 401 || res.status === 403) {
          clearTimeout(timeoutId);
          return {
            available: false,
            status: 'UNAVAILABLE' as const,
            data: { available: false },
            message: 'LINZ API authentication failed. Please verify LINZ_API_KEY.',
          };
        }

        if (res.status === 429) {
          clearTimeout(timeoutId);
          return {
            available: false,
            status: 'UNAVAILABLE' as const,
            data: { available: false },
            message: 'LINZ Data Service rate limit reached. Please try again shortly.',
          };
        }

        if (res.ok) {
          const json = await res.json();
          const layerFeatures = json?.vectorQuery?.layers?.['50772']?.features;
          if (Array.isArray(layerFeatures) && layerFeatures.length > 0) {
            feature = layerFeatures[0];
          }
        }
      } catch (e: any) {
        if (e.name === 'AbortError') {
          clearTimeout(timeoutId);
          return {
            available: false,
            status: 'UNAVAILABLE' as const,
            data: { available: false },
            message: 'LINZ Data Service request timed out.',
          };
        }
        // If vector query fails, attempt WFS fallback below
      }

      // 2. Fallback: WFS 2.0.0 GetFeature with spatial CQL filter
      if (!feature) {
        const wfsUrl = `${this.baseUrl};key=${encodeURIComponent(
          this.apiKey
        )}/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=layer-50772&outputFormat=application/json&count=1&srsName=EPSG:4326&cql_filter=Intersects(shape,POINT(${lng} ${lat}))`;

        try {
          const wfsRes = await fetch(wfsUrl, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
          });
          clearTimeout(timeoutId);

          if (wfsRes.status === 401 || wfsRes.status === 403) {
            return {
              available: false,
              status: 'UNAVAILABLE' as const,
              data: { available: false },
              message: 'LINZ API authentication failed. Please verify LINZ_API_KEY.',
            };
          }

          if (wfsRes.status === 429) {
            return {
              available: false,
              status: 'UNAVAILABLE' as const,
              data: { available: false },
              message: 'LINZ Data Service rate limit reached. Please try again shortly.',
            };
          }

          if (wfsRes.ok) {
            const wfsJson = await wfsRes.json();
            if (Array.isArray(wfsJson.features) && wfsJson.features.length > 0) {
              feature = wfsJson.features[0];
            }
          }
        } catch (e: any) {
          clearTimeout(timeoutId);
          if (e.name === 'AbortError') {
            return {
              available: false,
              status: 'UNAVAILABLE' as const,
              data: { available: false },
              message: 'LINZ Data Service request timed out.',
            };
          }
        }
      } else {
        clearTimeout(timeoutId);
      }

      // If neither returned a feature, no parcel found at coordinates
      if (!feature || !feature.properties) {
        return {
          available: false,
          status: 'UNAVAILABLE' as const,
          data: {
            available: false,
            parcelId: null,
            legalDescription: property.legalDescription || null,
            titleReference: property.titleReference || null,
            estateType: property.estateType || null,
            landAreaM2: property.landAreaM2 || null,
            floorAreaM2: property.floorAreaM2 || null,
            councilName: property.councilName || null,
            districtZoning: property.districtZoning || null,
          },
          message: 'No intersecting LINZ primary parcel found at coordinates',
        };
      }

      // Normalize genuine returned fields only - do NOT fabricate values
      const p = feature.properties;
      const parcelId = String(p.id || feature.id || '');
      const legalDescription = p.appellation || p.legal_description || null;
      const landAreaM2 = p.calc_area
        ? Math.round(Number(p.calc_area))
        : p.survey_area
        ? Math.round(Number(p.survey_area))
        : property.landAreaM2 || null;
      const councilName = p.territorial_authority || property.councilName || null;
      const estateType = p.parcel_intent || p.status || property.estateType || null;
      const titleReference = p.titles || property.titleReference || null;
      const now = new Date().toISOString();

      return {
        available: true,
        status: 'LIVE' as const,
        data: {
          available: true,
          parcelId,
          legalDescription,
          titleReference,
          estateType,
          landAreaM2,
          floorAreaM2: property.floorAreaM2 || null,
          councilName,
          districtZoning: property.districtZoning || null,
          parcelGeometry: feature.geometry || null,
          source: 'Land Information New Zealand (LINZ)',
          sourceRecordId: parcelId,
          fetchedAt: now,
          lastUpdated: now,
        },
      };
    } catch (error: any) {
      console.warn('LINZ parcel query error:', error.message);
      return {
        available: false,
        status: 'UNAVAILABLE' as const,
        data: {
          available: false,
          legalDescription: property.legalDescription || null,
          titleReference: property.titleReference || null,
          estateType: property.estateType || null,
          landAreaM2: property.landAreaM2 || null,
          floorAreaM2: property.floorAreaM2 || null,
          councilName: property.councilName || null,
          districtZoning: property.districtZoning || null,
        },
        message: error.message?.includes('timeout')
          ? 'LINZ Data Service request timed out.'
          : 'LINZ Data Service temporarily unavailable',
      };
    }
  }

  getPropertyLegalDetails(property: any) {
    return this.getLegalAndParcelDetails(property);
  }
}

export class UnconfiguredLinzProvider implements ILinzPropertyProvider {
  async getLegalAndParcelDetails(property: {
    id: string;
    streetAddress: string;
    suburb: string;
    city: string;
    latitude?: number | null;
    longitude?: number | null;
    legalDescription?: string | null;
    titleReference?: string | null;
    estateType?: string | null;
    landAreaM2?: number | null;
    floorAreaM2?: number | null;
    councilName?: string | null;
    districtZoning?: string | null;
  }) {
    const isProduction = process.env.NODE_ENV === 'production';
    const hasDbData = !!(property.legalDescription || property.titleReference);

    return {
      available: hasDbData && !isProduction,
      status: isProduction ? ('WAITING_FOR_CREDENTIALS' as const) : ('CACHED' as const),
      data: {
        available: hasDbData && !isProduction,
        parcelId: null, // Zero fake PRCL-... identifiers in production
        legalDescription: property.legalDescription || null,
        titleReference: property.titleReference || null,
        estateType: property.estateType || null,
        landAreaM2: property.landAreaM2 || null,
        floorAreaM2: property.floorAreaM2 || null,
        councilName: property.councilName || null,
        districtZoning: property.districtZoning || null,
        source: hasDbData ? 'Listing Specification' : undefined,
        unavailabilityReason: isProduction
          ? 'Architecture ready — LINZ API key required.'
          : undefined,
      },
      message: isProduction
        ? 'Architecture ready — LINZ API key required.'
        : undefined,
    };
  }

  getPropertyLegalDetails(property: any) {
    return this.getLegalAndParcelDetails(property);
  }
}

let activeLinzProvider: ILinzPropertyProvider | null = null;

export function getLinzPropertyProvider(): ILinzPropertyProvider {
  if (activeLinzProvider) return activeLinzProvider;

  const apiKey = process.env.LINZ_API_KEY;
  if (apiKey && apiKey.trim().length > 0) {
    activeLinzProvider = new LiveLinzPropertyProvider(apiKey.trim());
    return activeLinzProvider;
  }

  activeLinzProvider = new UnconfiguredLinzProvider();
  return activeLinzProvider;
}

export function setLinzPropertyProviderForTesting(provider: ILinzPropertyProvider | null): void {
  activeLinzProvider = provider;
}
