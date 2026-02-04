/**
 * Server-side data fetching utilities for pricing management
 * 
 * This module provides functions to fetch pricing-related data from Firestore
 * using the Firebase Admin SDK.
 * 
 * IMPORTANT: Only use these functions in server components or server actions!
 */

// Use the unstable_cache function which is more compatible with Edge Runtime
import { unstable_cache } from 'next/cache';

/**
 * Stub implementations for Firebase Admin functions
 *
 * NOTE: These are placeholder stubs that maintain backward compatibility.
 * The actual Firebase Admin integration for this module was never completed.
 * All functions return empty/false values, causing callers to use fallback data.
 *
 * TODO: Implement proper Firebase Admin integration or remove this module if unused.
 */
const isFirestoreAdminAvailableStub = (): boolean => false;
const getAdminPropertiesStub = async (): Promise<any[]> => [];
const getAdminSeasonalPricingStub = async (_propertyId: string): Promise<any[]> => [];
const getAdminDateOverridesStub = async (_propertyId: string): Promise<any[]> => [];

// Define types for the different data models
export interface Property {
  id: string;
  name: string;
  location: string | {
    city?: string;
    country?: string;
    [key: string]: any;
  };
  status: string;
  pricePerNight?: number;
  baseCurrency?: string;
  baseOccupancy?: number;
  extraGuestFee?: number;
  maxGuests?: number;
  pricingConfig?: {
    weekendAdjustment?: number;
    weekendDays?: string[];
    lengthOfStayDiscounts?: Array<{
      nightsThreshold: number;
      discountPercentage: number;
    }>;
  };
}

export interface SeasonalPricing {
  id: string;
  propertyId: string;
  name: string;
  seasonType: 'minimum' | 'low' | 'standard' | 'medium' | 'high';
  startDate: string;
  endDate: string;
  priceMultiplier: number;
  minimumStay?: number;
  enabled: boolean;
}

export interface DateOverride {
  id: string;
  propertyId: string;
  date: string;
  customPrice: number;
  reason?: string;
  minimumStay?: number;
  available: boolean;
  flatRate: boolean;
}

export interface PriceCalendarMonth {
  id: string;
  propertyId: string;
  month: string; // YYYY-MM format
  year: number;
  days: Record<string, any>;
  summary: {
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    unavailableDays: number;
    modifiedDays: number;
    hasCustomPrices: boolean;
    hasSeasonalRates: boolean;
  };
  generatedAt: any; // Firestore timestamp
}

/**
 * Fetch all active properties
 *
 * This function is cached to reduce database queries for repeated calls
 */
export const getProperties = unstable_cache(
  async (): Promise<Property[]> => {
    // Check if Firebase Admin is available (currently stubbed to return false)
    const available = isFirestoreAdminAvailableStub();

    if (!available) {
      console.error('Firebase Admin is not initialized');
      return [];
    }

    try {
      console.log('[Server] Fetching properties from Firestore');
      const properties = await getAdminPropertiesStub();

      if (properties.length === 0) {
        console.log('[Server] No properties found in Firestore');
        return [];
      }

      return properties.map(data => {
        // Process location data to string format
        let locationStr = '';
        if (data.location) {
          if (typeof data.location === 'string') {
            locationStr = data.location;
          } else if (data.location.city) {
            locationStr = `${data.location.city}${data.location.country ? ', ' + data.location.country : ''}`;
          }
        }

        return {
          id: data.id,
          name: data.name || data.id,
          location: locationStr || data.location,
          status: data.status || 'active',
          pricePerNight: data.pricePerNight,
          baseCurrency: data.baseCurrency,
          baseOccupancy: data.baseOccupancy,
          extraGuestFee: data.extraGuestFee,
          maxGuests: data.maxGuests,
          pricingConfig: data.pricingConfig
        };
      });
    } catch (error) {
      console.error('[Server] Error fetching properties:', error);
      return [];
    }
  },
  ['properties'],
  { tags: ['properties'] }
);

/**
 * Fetch a single property by ID
 *
 * This function is cached to reduce database queries for repeated calls
 */
export const getProperty = unstable_cache(
  async (propertyId: string): Promise<Property | null> => {
    // Check if Firebase Admin is available (currently stubbed to return false)
    const available = isFirestoreAdminAvailableStub();

    if (!available) {
      console.error('Firebase Admin is not initialized');
      return null;
    }

    try {
      // Get all properties and find the one we want
      // This is less efficient but avoids direct Firestore access
      const allProperties = await getProperties();
      const property = allProperties.find(p => p.id === propertyId);

      if (!property) {
        console.log(`[Server] Property ${propertyId} not found`);
        return null;
      }

      return property;
    } catch (error) {
      console.error(`[Server] Error fetching property ${propertyId}:`, error);
      return null;
    }
  },
  ['get-property'],
  { tags: ['property'] }
);

/**
 * Fetch seasonal pricing rules for a property
 *
 * This function is cached to reduce database queries for repeated calls
 */
export const getSeasonalPricing = unstable_cache(
  async (propertyId: string): Promise<SeasonalPricing[]> => {
    // Check if Firebase Admin is available (currently stubbed to return false)
    const available = isFirestoreAdminAvailableStub();

    if (!available) {
      console.error('Firebase Admin is not initialized');
      return [];
    }

    try {
      console.log(`[Server] Fetching seasonal pricing for property ${propertyId}`);
      const seasonalPricing = await getAdminSeasonalPricingStub(propertyId);

      if (seasonalPricing.length === 0) {
        console.log(`[Server] No seasonal pricing found for property ${propertyId}`);
        return [];
      }

      return seasonalPricing.map(data => ({
        id: data.id,
        propertyId: data.propertyId,
        name: data.name,
        seasonType: data.seasonType,
        startDate: data.startDate,
        endDate: data.endDate,
        priceMultiplier: data.priceMultiplier,
        minimumStay: data.minimumStay,
        enabled: data.enabled
      }));
    } catch (error) {
      console.error(`[Server] Error fetching seasonal pricing for property ${propertyId}:`, error);
      return [];
    }
  },
  ['get-seasonal-pricing'],
  { tags: ['seasonalPricing'] }
);

/**
 * Fetch date overrides for a property
 *
 * This function is cached to reduce database queries for repeated calls
 */
export const getDateOverrides = unstable_cache(
  async (propertyId: string): Promise<DateOverride[]> => {
    // Check if Firebase Admin is available (currently stubbed to return false)
    const available = isFirestoreAdminAvailableStub();

    if (!available) {
      console.error('Firebase Admin is not initialized');
      return [];
    }

    try {
      console.log(`[Server] Fetching date overrides for property ${propertyId}`);
      const dateOverrides = await getAdminDateOverridesStub(propertyId);

      if (dateOverrides.length === 0) {
        console.log(`[Server] No date overrides found for property ${propertyId}`);
        return [];
      }

      return dateOverrides.map(data => ({
        id: data.id,
        propertyId: data.propertyId,
        date: data.date,
        customPrice: data.customPrice,
        reason: data.reason,
        minimumStay: data.minimumStay,
        available: data.available !== false, // Default to true if not specified
        flatRate: data.flatRate || false
      }));
    } catch (error) {
      console.error(`[Server] Error fetching date overrides for property ${propertyId}:`, error);
      return [];
    }
  },
  ['get-date-overrides'],
  { tags: ['dateOverrides'] }
);

/**
 * Fetch price calendar for a property and year
 *
 * This function is cached to reduce database queries for repeated calls
 */
export const getPriceCalendars = unstable_cache(
  async (propertyId: string, year: number): Promise<PriceCalendarMonth[]> => {
    // Check if Firebase Admin is available (currently stubbed to return false)
    const available = isFirestoreAdminAvailableStub();

    if (!available) {
      console.error('Firebase Admin is not initialized');
      return [];
    }

    try {
      console.log(`[Server] Fetching price calendars for property ${propertyId} and year ${year}`);

      // This is a stub implementation - Firebase Admin integration was never completed
      return [];
    } catch (error) {
      console.error(`[Server] Error fetching price calendars for property ${propertyId} and year ${year}:`, error);
      return [];
    }
  },
  ['get-price-calendars'],
  { tags: ['priceCalendars'] }
);

/**
 * Helper function to check if Firestore Admin is available
 *
 * NOTE: Currently stubbed to return false. The Firebase Admin integration
 * for this module was never completed. Callers should use fallback data.
 */
export const isFirestoreAdminAvailable = async (): Promise<boolean> => {
  return isFirestoreAdminAvailableStub();
};