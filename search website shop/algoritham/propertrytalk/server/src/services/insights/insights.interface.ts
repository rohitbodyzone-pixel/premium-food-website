/**
 * PropertyTalk — Trade Me Property Insights Interfaces
 * 
 * Strict scope matching Trade Me Property / Property Insights:
 * 1. Location & Map
 * 2. School Information
 * 3. Official School Zones
 * 4. Property Value Estimate
 * 5. Weekly Rent Estimate
 * 6. Estimated Gross Rental Yield
 * 7. Sales History
 * 8. Capital / Rateable Value (Council Valuation)
 * 9. Nearby Recent Sales (Comparables)
 * 10. Legal & Property Details
 * 11. Council Flood & Hazard Mapping
 */

export interface NZSchoolItem {
  id: string; // Official Ministry of Education School Identifier / Institution ID
  name: string;
  schoolType: string; // 'Contributing' | 'Full Primary' | 'Intermediate' | 'Secondary (Year 9-15)' | 'Composite' | 'Special School'
  distanceMeters: number;
  distanceText: string;
  yearLevels: string; // e.g. 'Years 1–6', 'Years 7–8', 'Years 9–13'
  gender: 'Co-educational' | 'Boys School' | 'Girls School';
  authority: 'State' | 'State-Integrated' | 'Private';
  zoneStatus: 'IN_ZONE' | 'OUT_OF_ZONE' | 'NOT_ZONED' | 'UNKNOWN' | 'UNAVAILABLE';
  decile?: number | null;
  enrolmentRoll?: number | null;
  latitude?: number;
  longitude?: number;
  source?: string;
  sourceUpdateDate?: string;
}

export interface PropertyValuationEstimate {
  available: boolean;
  estimatedValueMinorUnits?: number | null;
  estimatedValueDisplay?: string;
  estimatedLowerMinorUnits?: number | null;
  estimatedLowerDisplay?: string;
  estimatedUpperMinorUnits?: number | null;
  estimatedUpperDisplay?: string;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  lastUpdated?: string;
  source?: string;
  unavailabilityReason?: string;
}

export interface RentalEstimate {
  available: boolean;
  weeklyRentEstimatedMinorUnits?: number | null;
  weeklyRentDisplay?: string;
  weeklyLowerMinorUnits?: number | null;
  weeklyUpperMinorUnits?: number | null;
  weeklyRangeDisplay?: string;
  lastUpdated?: string;
  source?: string;
  label?: 'Property Rent Estimate' | 'Area Market Rent';
}

export interface RentalYieldResult {
  available: boolean;
  grossYieldPercentage?: number | null;
  grossYieldDisplay?: string;
  annualRentDisplay?: string;
  formula?: string;
  disclaimer?: string;
}

export interface PropertySalesHistoryItem {
  id: string;
  saleDate: string;
  saleYear: number;
  priceMinorUnits: number;
  priceDisplay: string;
  saleType: string;
}

export interface NearbySoldPropertyItem {
  id: string;
  address: string;
  suburb: string;
  city: string;
  soldPriceMinorUnits: number;
  soldPriceDisplay: string;
  soldDate: string;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  floorAreaM2?: number | null;
  propertyType: string;
  distanceMeters: number;
  distanceText: string;
  imageUrl?: string;
}

export interface PropertyLegalDetails {
  available?: boolean;
  parcelId?: string | null;
  legalDescription?: string | null;
  titleReference?: string | null;
  estateType?: string | null;
  landAreaM2?: number | null;
  floorAreaM2?: number | null;
  councilName?: string | null;
  districtZoning?: string | null;
  parcelGeometry?: any | null;
  source?: string;
  sourceRecordId?: string;
  status?: 'LIVE' | 'WAITING_FOR_PROVIDER_CREDENTIALS' | 'UNAVAILABLE';
  unavailabilityReason?: string;
  fetchedAt?: string | null;
  lastUpdated?: string | null;
}

export interface CouncilHazardOverlay {
  isHazardDataAvailable: boolean;
  councilName: string;
  status?: 'HAZARD_LAYER_MATCH' | 'NO_LAYER_INTERSECTION' | 'DATA_UNAVAILABLE' | 'PROVIDER_UNAVAILABLE';
  overlays: {
    type: string;
    label: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'INFO';
    description: string;
    sourceUrl?: string;
  }[];
  limNotice: string;
  unavailabilityReason?: string;
}

export interface DataSourceInfo {
  module: string;
  source: string;
  sourceRecordId?: string;
  sourceDate?: string;
  status: 'LIVE' | 'CACHED' | 'UNAVAILABLE' | 'WAITING_FOR_CREDENTIALS' | 'DISABLED';
  message?: string;
}

export interface TradeMePropertyInsightsResponse {
  propertyId: string;
  valuation: PropertyValuationEstimate;
  rental: RentalEstimate;
  rentalYield: RentalYieldResult;
  councilValuation: {
    capitalValueMinorUnits?: number | null;
    capitalValueDisplay?: string;
    landValueMinorUnits?: number | null;
    landValueDisplay?: string;
    improvementsValueMinorUnits?: number | null;
    improvementsValueDisplay?: string;
    valuationDate?: string | null;
    valuationSource?: string | null;
  };
  schools: {
    totalCount: number;
    inZoneCount: number;
    schools: NZSchoolItem[];
  };
  salesHistory: PropertySalesHistoryItem[];
  nearbySales: NearbySoldPropertyItem[];
  legalDetails: PropertyLegalDetails;
  hazards: CouncilHazardOverlay;
  dataSources?: DataSourceInfo[];
}
