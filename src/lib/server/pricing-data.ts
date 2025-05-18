/**
 * Server-side data fetching utilities for pricing management
 * 
 * This module provides functions to fetch pricing-related data from Firestore
 * using the Firebase Admin SDK.
 * 
 * IMPORTANT: Only use these functions in server components or server actions!
 */

import { dbAdmin } from '@/lib/firebaseAdminNew';
// Use the unstable_cache function which is more compatible with Edge Runtime
import { unstable_cache } from 'next/cache';

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
    // Import and use the function to ensure Firebase Admin is initialized
    const { isFirestoreAdminAvailable, getAdminProperties } = await import('@/lib/firebaseAdminNew');
    const available = await isFirestoreAdminAvailable();

    if (!available) {
      console.error('Firebase Admin is not initialized');
      return [];
    }

    try {
      console.log('[Server] Fetching properties from Firestore');
      const properties = await getAdminProperties();

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
    // Import and use the functions to ensure Firebase Admin is initialized
    const { isFirestoreAdminAvailable } = await import('@/lib/firebaseAdminNew');
    const available = await isFirestoreAdminAvailable();

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
  [(propertyId) => `property-${propertyId}`],
  { tags: ['property', `property-${propertyId}`] }
);

/**
 * Fetch seasonal pricing rules for a property
 *
 * This function is cached to reduce database queries for repeated calls
 */
export const getSeasonalPricing = unstable_cache(
  async (propertyId: string): Promise<SeasonalPricing[]> => {
    // Import and use the functions to ensure Firebase Admin is initialized
    const { isFirestoreAdminAvailable, getAdminSeasonalPricing } = await import('@/lib/firebaseAdminNew');
    const available = await isFirestoreAdminAvailable();

    if (!available) {
      console.error('Firebase Admin is not initialized');
      return [];
    }

    try {
      console.log(`[Server] Fetching seasonal pricing for property ${propertyId}`);
      const seasonalPricing = await getAdminSeasonalPricing(propertyId);

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
  [(propertyId) => `seasonalPricing-${propertyId}`],
  { tags: ['seasonalPricing', `property-${propertyId}`] }
);

/**
 * Fetch date overrides for a property
 *
 * This function is cached to reduce database queries for repeated calls
 */
export const getDateOverrides = unstable_cache(
  async (propertyId: string): Promise<DateOverride[]> => {
    // Import and use the functions to ensure Firebase Admin is initialized
    const { isFirestoreAdminAvailable, getAdminDateOverrides } = await import('@/lib/firebaseAdminNew');
    const available = await isFirestoreAdminAvailable();

    if (!available) {
      console.error('Firebase Admin is not initialized');
      return [];
    }

    try {
      console.log(`[Server] Fetching date overrides for property ${propertyId}`);
      const dateOverrides = await getAdminDateOverrides(propertyId);

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
  [(propertyId) => `dateOverrides-${propertyId}`],
  { tags: ['dateOverrides', `property-${propertyId}`] }
);

/**
 * Fetch price calendar for a property and year
 *
 * This function is cached to reduce database queries for repeated calls
 */
export const getPriceCalendars = unstable_cache(
  async (propertyId: string, year: number): Promise<PriceCalendarMonth[]> => {
    // Import and use the functions to ensure Firebase Admin is initialized
    const { isFirestoreAdminAvailable } = await import('@/lib/firebaseAdminNew');
    const available = await isFirestoreAdminAvailable();

    if (!available) {
      console.error('Firebase Admin is not initialized');
      return [];
    }

    try {
      console.log(`[Server] Fetching price calendars for property ${propertyId} and year ${year}`);

      // This is a mock implementation until we can refactor the calendar fetching
      // to use our new helpers in firebaseAdminNew.ts
      return [];
    } catch (error) {
      console.error(`[Server] Error fetching price calendars for property ${propertyId} and year ${year}:`, error);
      return [];
    }
  },
  [(propertyId, year) => `priceCalendars-${propertyId}-${year}`],
  { tags: ['priceCalendars', `property-${propertyId}`] }
);

/**
 * Helper function to check if Firestore Admin is available
 * 
 * Useful for providing fallback data in development environments
 */
export const isFirestoreAdminAvailable = async (): Promise<boolean> => {
  // Import and use the function from our new implementation
  const { isFirestoreAdminAvailable: checkFirestore } = await import('@/lib/firebaseAdminNew');
  return checkFirestore();
};