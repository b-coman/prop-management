"use client";

// Add a clear debug marker to verify code changes are loading
console.log("[LOAD CHECK] ✅ Loading updated availabilityService.ts with pricing calendar support");

import { format, startOfDay, differenceInDays } from 'date-fns';

// Interface for pricing data
export interface DailyPrice {
  baseOccupancyPrice: number;
  prices: Record<string, number>;
  available: boolean;
  minimumStay: number;
  priceSource?: string;
}

export interface PriceAvailabilityResponse {
  unavailableDates: string[];
  pricing?: {
    dailyRates: Record<string, number>;
    totalPrice: number;
    averageNightlyRate: number;
    subtotal: number;
    cleaningFee: number;
    currency: string;
    minimumStay?: number;
    requiredNights?: number;
  };
  pricingMap?: Record<string, DailyPrice>;
  minimumStay?: number;
}

/**
 * Get unavailable dates for a property using the server-side API endpoint
 * This now fetches both availability and pricing data from the price calendar
 */
export async function getUnavailableDatesForProperty(propertySlug: string, monthsToFetch: number = 12): Promise<Date[]> {
  console.log(`[availabilityService] Fetching unavailable dates for ${propertySlug}`);
  
  try {
    // Only run in browser environment
    if (typeof window === 'undefined') {
      console.log('[availabilityService] Running in server environment, returning empty array');
      return [];
    }

    // Build the API URL - modified to use the new combined endpoint
    const baseUrl = window.location.origin;
    
    // Keep using the same endpoint for now to maintain compatibility
    // We'll process the data differently but the API call remains the same
    const apiUrl = `${baseUrl}/api/check-availability?propertySlug=${encodeURIComponent(propertySlug)}&months=${monthsToFetch}&_t=${Date.now()}`;
    
    try {
      console.log(`[availabilityService] Fetching from: ${apiUrl}`);
      
      // Create a controller for proper cancellation handling
      const controller = new AbortController();
      const signal = controller.signal;

      // Set up timeout that will abort the request after 15 seconds
      const timeoutId = setTimeout(() => {
        console.log('[availabilityService] Request timeout reached, aborting');
        controller.abort('timeout');
      }, 15000);

      try {
        console.log('[availabilityService] Starting fetch with AbortController');

        // Make the fetch request with abort signal
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          signal // Add the abort signal
        });

        // Clear timeout since request completed
        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error(`[availabilityService] API error (${response.status})`);
          return [];
        }

        const data = await response.json();

        if (!data.unavailableDates || !Array.isArray(data.unavailableDates)) {
          console.error('[availabilityService] Invalid API response format');
          return [];
        }

        // Convert ISO strings to Date objects
        const unavailableDates: Date[] = data.unavailableDates.map((dateStr: string) => {
          // Log original string and resulting date for debugging
          const date = new Date(dateStr);
          if (data.unavailableDates.indexOf(dateStr) < 3) {
            console.log(`[availabilityService] Converting date string "${dateStr}" to Date object: ${date.toISOString()}`);
          }
          return date;
        });

        // Sort dates
        unavailableDates.sort((a, b) => a.getTime() - b.getTime());

        // Log date object details for troubleshooting
        console.log(`[availabilityService] Received ${unavailableDates.length} unavailable dates`);

        // Log a few examples
        if (unavailableDates.length > 0) {
          console.log(`[availabilityService] Example unavailable dates (first 3):`,
            unavailableDates.slice(0, 3).map(d => ({
              iso: d.toISOString(),
              local: d.toString(),
              year: d.getFullYear(),
              month: d.getMonth() + 1,
              day: d.getDate()
            }))
          );
        }

        // Store pricing data in the global cache if it was returned
        if (data.pricingMap) {
          storePricingData(propertySlug, data.pricingMap);
        }

        return unavailableDates;
      } catch (error) {
        // Clear timeout to prevent further issues
        clearTimeout(timeoutId);

        // Handle abort errors specifically - these are expected and should be handled gracefully
        if (error instanceof DOMException && error.name === 'AbortError') {
          console.log('[availabilityService] Request was aborted (expected behavior for timeout)');
          return [];
        }

        // Log any other errors
        console.error('[availabilityService] Fetch error:', error);
        return [];
      }
      
    } catch (error) {
      console.error('[availabilityService] Error:', error);
      return [];
    }
  } catch (error) {
    console.error('[availabilityService] Outer error:', error);
    return [];
  }
}

// Cache for pricing data
const pricingCache: Record<string, Record<string, DailyPrice>> = {};

// Track API error count to prevent infinite calls
const apiErrorCounts: Record<string, number> = {};
const MAX_API_ERRORS = 3; // Maximum allowed errors before blocking further calls for a property
const ERROR_RESET_TIME = 60000; // Reset error count after 1 minute

// Store pricing data in the cache
function storePricingData(propertySlug: string, pricingMap: Record<string, DailyPrice>): void {
  pricingCache[propertySlug] = pricingMap;
  console.log(`[availabilityService] Stored pricing data for ${propertySlug} with ${Object.keys(pricingMap).length} dates`);
}

// Get pricing data from cache
export function getPricingData(propertySlug: string): Record<string, DailyPrice> | null {
  return pricingCache[propertySlug] || null;
}

/**
 * Check pricing and availability for a specific date range
 * This now uses the combined pricing and availability data
 */
export async function getPricingForDateRange(
  propertySlug: string,
  startDate: Date,
  endDate: Date,
  guestCount: number = 2
): Promise<PriceAvailabilityResponse | null> {
  // Generate a unique request ID for tracing
  const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
  
  try {
    // Only run in browser environment
    if (typeof window === 'undefined') {
      console.log(`[availabilityService] [${requestId}] Running in server environment, returning null`);
      return null;
    }
    
    // Check if we've exceeded error count for this property
    const propertyErrors = apiErrorCounts[propertySlug] || 0;
    if (propertyErrors >= MAX_API_ERRORS) {
      console.warn(`[availabilityService] [${requestId}] ⚠️ Blocking request - too many errors (${propertyErrors}/${MAX_API_ERRORS})`);
      
      // Schedule error count reset after delay
      setTimeout(() => {
        apiErrorCounts[propertySlug] = 0;
        console.log(`[availabilityService] Reset error count for ${propertySlug}`);
      }, ERROR_RESET_TIME);
      
      // Return empty response to prevent UI errors
      return {
        available: false,
        reason: 'service_unavailable',
        unavailableDates: []
      };
    }

    // Build the API URL for the combined endpoint
    const baseUrl = window.location.origin;
    const apiUrl = `${baseUrl}/api/check-pricing-availability`;
    
    console.log(`[availabilityService] [${requestId}] 🔍 Fetching pricing and availability for ${propertySlug}`, {
      url: apiUrl,
      method: 'POST',
      dates: {
        checkIn: startDate.toISOString(),
        checkOut: endDate.toISOString()
      },
      guests: guestCount
    });
    
    try {
      // Use AbortController for timeout handling just like the original function
      const controller = new AbortController();
      const signal = controller.signal;

      // Set up timeout that will abort the request after 15 seconds
      const timeoutId = setTimeout(() => {
        console.log(`[availabilityService] [${requestId}] ⏱️ Pricing request timeout reached, aborting`);
        controller.abort('timeout');
      }, 15000);
      
      console.log(`[availabilityService] [${requestId}] 🚀 Starting pricing fetch with POST request to ${apiUrl}`);
      
      // Explicitly log the request body for debugging
      const requestBody = {
        propertyId: propertySlug,
        checkIn: startDate.toISOString(),
        checkOut: endDate.toISOString(),
        guests: guestCount
      };
      console.log(`[availabilityService] [${requestId}] 📝 Request payload:`, JSON.stringify(requestBody));
      
      // Make the fetch request
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        },
        body: JSON.stringify(requestBody),
        signal,
        cache: 'no-store'
      });

      // Clear timeout since request completed
      clearTimeout(timeoutId);

      // Check response status
      if (!response.ok) {
        console.error(`[availabilityService] [${requestId}] ❌ API pricing error (${response.status}): ${response.statusText}`);
        
        // Increment error count for this property
        apiErrorCounts[propertySlug] = (apiErrorCounts[propertySlug] || 0) + 1;
        console.warn(`[availabilityService] [${requestId}] ⚠️ Error count for ${propertySlug}: ${apiErrorCounts[propertySlug]}/${MAX_API_ERRORS}`);
        
        return {
          available: false,
          reason: 'service_error',
          unavailableDates: []
        };
      }

      // Reset error count on successful request
      apiErrorCounts[propertySlug] = 0;
      
      // Parse response
      const data = await response.json();
      
      // Log response details
      console.log(`[availabilityService] [${requestId}] ✅ Received pricing and availability data:`, {
        available: data.available,
        pricing: data.pricing ? {
          totalPrice: data.pricing.totalPrice,
          currency: data.pricing.currency,
          hasRates: !!data.pricing.dailyRates,
          rateCount: data.pricing.dailyRates ? Object.keys(data.pricing.dailyRates).length : 0
        } : 'Not present',
        reason: data.reason || 'N/A',
        minimumStay: data.minimumStay
      });

      return data;
    } catch (error) {
      console.error(`[availabilityService] [${requestId}] ❌ Error fetching pricing data:`, error);
      
      // Increment error count for this property
      apiErrorCounts[propertySlug] = (apiErrorCounts[propertySlug] || 0) + 1;
      console.warn(`[availabilityService] [${requestId}] ⚠️ Error count for ${propertySlug}: ${apiErrorCounts[propertySlug]}/${MAX_API_ERRORS}`);
      
      // Return empty response to prevent UI errors
      return {
        available: false,
        reason: 'service_error',
        unavailableDates: []
      };
    }
  } catch (error) {
    console.error(`[availabilityService] [${requestId}] ❌ Error in getPricingForDateRange:`, error);
    
    // Return empty response to prevent UI errors
    return {
      available: false,
      reason: 'client_error',
      unavailableDates: []
    };
  }
}

/**
 * Diagnostic function to test if the pricing API is accessible
 */
export function testPricingApi(): boolean {
  console.log(`[availabilityService] 🧪 Running pricing API test`);
  console.log(`[availabilityService] 📣 Export available: getPricingForDateRange is properly exported`);
  
  // Test service version 
  console.log(`[availabilityService] 📣 Version: 1.2 (Dynamic Price Calendar Support)`);
  return true;
}

/**
 * Check if a specific date range is available for a property
 * Maintains the original interface for backward compatibility
 */
export async function checkAvailability(
  propertySlug: string,
  startDate: Date,
  endDate: Date
): Promise<{ isAvailable: boolean; unavailableDates: Date[] }> {
  try {
    console.log(`[availabilityService] Checking availability for dates:`, {
      propertySlug,
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString()
    });
    
    // Validate inputs
    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.error('[availabilityService] Invalid date inputs');
      return {
        isAvailable: false,
        unavailableDates: []
      };
    }
    
    // Get all unavailable dates for this property
    const unavailableDates = await getUnavailableDatesForProperty(propertySlug);
    
    // Real availability checking enabled
    console.log('[availabilityService] Performing real availability check');
    
    // Check if any day in the range is unavailable
    let current = new Date(startDate.getTime());
    let conflict = false;
    
    while (current < endDate) {
      const dateString = format(startOfDay(current), 'yyyy-MM-dd');
      if (unavailableDates.some(d => format(startOfDay(d), 'yyyy-MM-dd') === dateString)) {
        console.log(`[availabilityService] Found conflict on date: ${dateString}`);
        conflict = true;
        break;
      }
      // Move to next day
      current.setDate(current.getDate() + 1);
    }
    
    const isAvailable = !conflict;
    console.log(`[availabilityService] Availability result: ${isAvailable ? 'Available' : 'Not Available'}`);
    
    return {
      isAvailable,
      unavailableDates
    };
  } catch (error) {
    console.error(`[availabilityService] Error in checkAvailability:`, error);
    return {
      isAvailable: false,
      unavailableDates: []
    };
  }
}