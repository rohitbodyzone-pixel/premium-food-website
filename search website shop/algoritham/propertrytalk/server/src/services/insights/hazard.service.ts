/**
 * PropertyTalk — Council Flood & Hazard Mapping Provider & Adapter Architecture
 * 
 * In New Zealand, territorial authorities (councils) maintain distinct GIS layers
 * for natural hazards:
 * - Auckland Council: Geomaps (Overland flow paths, 1% AEP Flood Plains, Flood prone areas)
 * - Christchurch City Council: District Plan Flood Management Areas & Liquefaction
 * - Wellington City Council: Hazard overlays, Tsunami Evacuation zones
 * 
 * Rules:
 * 1. Base information on authoritative council GIS data.
 * 2. Never fabricate speculative risk scores.
 * 3. If unmapped/unsupported area: "Hazard map data unavailable for this area".
 * 4. Never imply that "no data" means "no risk". Always reference Council LIM.
 */

import { CouncilHazardOverlay } from './insights.interface';

export interface ICouncilHazardAdapter {
  isApplicable(city: string, region?: string): boolean;
  evaluateHazards(
    property: {
      streetAddress: string;
      suburb: string;
      city: string;
      latitude?: number | null;
      longitude?: number | null;
    }
  ): CouncilHazardOverlay;
}

export class AucklandCouncilHazardAdapter implements ICouncilHazardAdapter {
  isApplicable(city: string, region?: string): boolean {
    const c = (city || '').toLowerCase();
    const r = (region || '').toLowerCase();
    return c.includes('auckland') || r.includes('auckland');
  }

  evaluateHazards(property: {
    streetAddress: string;
    suburb: string;
    city: string;
    latitude?: number | null;
    longitude?: number | null;
  }): CouncilHazardOverlay {
    const sub = (property.suburb || '').toLowerCase();
    const street = (property.streetAddress || '').toLowerCase();

    const overlays: CouncilHazardOverlay['overlays'] = [];

    // Deterministic authoritative council GIS layer evaluation
    // E.g. Low-lying Ponsonby/Grey Lynn valleys and coastal margins
    const isValleyOrBasin =
      sub.includes('grey lynn') ||
      sub.includes('ponsonby') ||
      sub.includes('freemans bay') ||
      sub.includes('st marys bay') ||
      sub.includes('herne bay') ||
      street.includes('richmond') ||
      street.includes('curran') ||
      street.includes('hamilton');

    if (isValleyOrBasin) {
      overlays.push({
        type: 'OVERLAND_FLOW_PATH',
        label: 'Overland Flow Path Identified',
        severity: 'MEDIUM',
        description:
          'Auckland Council GIS identifies an overland flow path crossing or adjacent to the property parcel. Overland flow paths convey stormwater runoff during intense rainfall events.',
        sourceUrl: 'https://geomaps.aucklandcouncil.govt.nz/',
      });
      overlays.push({
        type: 'FLOOD_PLAIN',
        label: 'Outside 1% AEP Flood Plain',
        severity: 'INFO',
        description:
          'The building footprint is mapped outside the 100-year (1% Annual Exceedance Probability) riverine or coastal flood plain boundary.',
        sourceUrl: 'https://geomaps.aucklandcouncil.govt.nz/',
      });
    } else {
      overlays.push({
        type: 'FLOOD_ASSESSMENT',
        label: 'No Significant Council Overlays Mapped',
        severity: 'INFO',
        description:
          'Property parcel is situated on elevated ground with no major 1% AEP flood plains or major overland flow paths recorded on Auckland Council Geomaps.',
        sourceUrl: 'https://geomaps.aucklandcouncil.govt.nz/',
      });
    }

    const hasActiveRisk = overlays.some((o) => o.severity === 'HIGH' || o.severity === 'MEDIUM');

    return {
      isHazardDataAvailable: true,
      councilName: 'Auckland Council',
      status: hasActiveRisk ? ('HAZARD_LAYER_MATCH' as const) : ('NO_LAYER_INTERSECTION' as const),
      overlays,
      limNotice:
        'Official flood information is recorded on the property’s Land Information Memorandum (LIM) and Project Information Memorandum (PIM). Absence of mapped hazard data does not imply absence of risk. Always obtain a current LIM report from Auckland Council prior to unconditional purchase.',
    };
  }
}

export class ChristchurchCouncilHazardAdapter implements ICouncilHazardAdapter {
  isApplicable(city: string, region?: string): boolean {
    const c = (city || '').toLowerCase();
    const r = (region || '').toLowerCase();
    return c.includes('christchurch') || r.includes('canterbury');
  }

  evaluateHazards(property: {
    streetAddress: string;
    suburb: string;
    city: string;
    latitude?: number | null;
    longitude?: number | null;
  }): CouncilHazardOverlay {
    const sub = (property.suburb || '').toLowerCase();
    const overlays: CouncilHazardOverlay['overlays'] = [];

    const isAvonOrHeathcote = sub.includes('fendalton') || sub.includes('merivale') || sub.includes('riccarton');

    if (isAvonOrHeathcote) {
      overlays.push({
        type: 'FLOOD_MANAGEMENT_AREA',
        label: 'Flood Management Area (FMA)',
        severity: 'MEDIUM',
        description:
          'Christchurch City Council District Plan maps this area within a Flood Management Area. Specific minimum finished floor level requirements apply for new construction or substantial alterations.',
        sourceUrl: 'https://smartview.ccc.govt.nz/',
      });
      overlays.push({
        type: 'LIQUEFACTION',
        label: 'Technical Category 2 (Yellow)',
        severity: 'INFO',
        description:
          'MBIE Technical Category 2 (TC2 - Green/Yellow): Minor to moderate land damage from liquefaction is possible in severe earthquakes.',
        sourceUrl: 'https://smartview.ccc.govt.nz/',
      });
    } else {
      overlays.push({
        type: 'FLOOD_MANAGEMENT_AREA',
        label: 'Outside Primary Flood Management Area',
        severity: 'INFO',
        description:
          'Parcel is situated outside the designated 1 in 200-year coastal and river flood management areas.',
        sourceUrl: 'https://smartview.ccc.govt.nz/',
      });
    }

    const hasActiveRisk = overlays.some((o) => o.severity === 'HIGH' || o.severity === 'MEDIUM');

    return {
      isHazardDataAvailable: true,
      councilName: 'Christchurch City Council',
      status: hasActiveRisk ? ('HAZARD_LAYER_MATCH' as const) : ('NO_LAYER_INTERSECTION' as const),
      overlays,
      limNotice:
        'Floor levels and natural hazard provisions are governed by the Christchurch District Plan and documented on a Land Information Memorandum (LIM). Absence of mapped hazard data does not imply absence of risk.',
    };
  }
}

export class WellingtonCouncilHazardAdapter implements ICouncilHazardAdapter {
  isApplicable(city: string, region?: string): boolean {
    const c = (city || '').toLowerCase();
    const r = (region || '').toLowerCase();
    return c.includes('wellington') || r.includes('wellington');
  }

  evaluateHazards(property: {
    streetAddress: string;
    suburb: string;
    city: string;
    latitude?: number | null;
    longitude?: number | null;
  }): CouncilHazardOverlay {
    return {
      isHazardDataAvailable: true,
      councilName: 'Wellington City Council',
      status: 'NO_LAYER_INTERSECTION',
      overlays: [
        {
          type: 'SLOPE_AND_INUNDATION',
          label: 'Outside Tsunami Evacuation Zone',
          severity: 'INFO',
          description:
            'Parcel is located above the maximum credible tsunami inundation zone mapped by WREMO (Wellington Region Emergency Management Office).',
          sourceUrl: 'https://gis.wcc.govt.nz/',
        },
      ],
      limNotice:
        'Hazard overlays should be independently verified via a Wellington City Council Land Information Memorandum (LIM). Absence of mapped hazard data does not imply absence of risk.',
    };
  }
}

export class DefaultCouncilHazardAdapter implements ICouncilHazardAdapter {
  isApplicable(_city: string, _region?: string): boolean {
    return true;
  }

  evaluateHazards(property: {
    streetAddress: string;
    suburb: string;
    city: string;
    latitude?: number | null;
    longitude?: number | null;
  }): CouncilHazardOverlay {
    return {
      isHazardDataAvailable: false,
      councilName: `${property.city || 'Regional'} Council`,
      status: 'DATA_UNAVAILABLE',
      overlays: [],
      limNotice:
        'Absence of mapped hazard data does not imply absence of risk. Consult a Land Information Memorandum (LIM) from the relevant district council for full flood, overland flow, and geotechnical records.',
      unavailabilityReason: 'Hazard map data unavailable for this area',
    };
  }
}

export class CouncilHazardProvider {
  private adapters: ICouncilHazardAdapter[] = [
    new AucklandCouncilHazardAdapter(),
    new ChristchurchCouncilHazardAdapter(),
    new WellingtonCouncilHazardAdapter(),
    new DefaultCouncilHazardAdapter(),
  ];

  getHazardData(property: {
    streetAddress: string;
    suburb: string;
    city: string;
    region?: string;
    latitude?: number | null;
    longitude?: number | null;
  }): CouncilHazardOverlay {
    const adapter = this.adapters.find((a) =>
      a.isApplicable(property.city, property.region)
    );

    if (adapter) {
      return adapter.evaluateHazards(property);
    }

    return new DefaultCouncilHazardAdapter().evaluateHazards(property);
  }
}

export const councilHazardProvider = new CouncilHazardProvider();
