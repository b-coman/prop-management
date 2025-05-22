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

// Constants for rate limiting and caching - MODIFIED FOR TESTING
const MAX_API_ERRORS = 100; // Maximum allowed errors before blocking further calls for a property
const MAX_API_CALLS_PER_MINUTE = 100; // Much stricter limit - Maximum allowed calls per minute for a property
const MAX_API_CALLS_PER_SESSION = 1000; // Maximum allowed calls for the entire session - INCREASED FOR TESTING
const ERROR_RESET_TIME = 60000; // Reset error count after 1 minute
const CALL_LIMIT_RESET_TIME = 60000; // Reset call limit after 1 minute
const CACHE_EXPIRATION = 10 * 60 * 1000; // 10 minutes cache expiration

// Helper functions for localStorage-based persistence
// These functions make our caching and rate limiting work across page refreshes and Cloud Run instances
function getFromStorage(key: string, defaultValue: any): any {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = localStorage.getItem(`booking_api_${key}`);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.error(`[availabilityService] Error reading from localStorage: ${e}`);
    return defaultValue;
  }
}

function saveToStorage(key: string, value: any): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`booking_api_${key}`, JSON.stringify(value));
  } catch (e) {
    console.error(`[availabilityService] Error writing to localStorage: ${e}`);
  }
}

// Functions to manage pricing cache (in-memory for performance, with localStorage backup)
const pricingCache: Record<string, Record<string, DailyPrice>> = {};

// Function to get API response cache
function getApiResponseCache(): Record<string, {data: any; timestamp: number; expiresAt: number;}> {
  return getFromStorage('response_cache', {});
}

// Function to save API response to cache
function saveApiResponseCache(cacheKey: string, data: any, expiresAt: number): void {
  const cache = getApiResponseCache();
  cache[cacheKey] = {
    data,
    timestamp: Date.now(),
    expiresAt
  };
  saveToStorage('response_cache', cache);
}

// Function to get error count for a property
function getApiErrorCount(propertySlug: string): number {
  return getFromStorage(`error_count_${propertySlug}`, 0);
}

// Function to save error count for a property
function saveApiErrorCount(propertySlug: string, count: number): void {
  saveToStorage(`error_count_${propertySlug}`, count);
}

// Function to get call count for a property
function getApiCallCount(propertySlug: string): number {
  return getFromStorage(`call_count_${propertySlug}`, 0);
}

// Function to save call count for a property
function saveApiCallCount(propertySlug: string, count: number): void {
  saveToStorage(`call_count_${propertySlug}`, count);
}

// Function to get call timestamps for a property
function getApiCallTimestamps(propertySlug: string): number[] {
  return getFromStorage(`call_timestamps_${propertySlug}`, []);
}

// Function to save call timestamps for a property
function saveApiCallTimestamps(propertySlug: string, timestamps: number[]): void {
  saveToStorage(`call_timestamps_${propertySlug}`, timestamps);
}

// Store pricing data in the cache
function storePricingData(propertySlug: string, pricingMap: Record<string, DailyPrice>): void {
  // Store in memory for fast access
  pricingCache[propertySlug] = pricingMap;
  
  // Also save to localStorage for persistence
  try {
    saveToStorage(`pricing_data_${propertySlug}`, pricingMap);
  } catch (e) {
    // If localStorage fails, just log the error but continue
    console.error(`[availabilityService] Error saving pricing data to localStorage: ${e}`);
  }
  
  console.log(`[availabilityService] Stored pricing data for ${propertySlug} with ${Object.keys(pricingMap).length} dates`);
}

// Get pricing data from cache
export function getPricingData(propertySlug: string): Record<string, DailyPrice> | null {
  // Try in-memory cache first for performance
  if (pricingCache[propertySlug]) {
    return pricingCache[propertySlug];
  }
  
  // Try localStorage as fallback
  const storedData = getFromStorage(`pricing_data_${propertySlug}`, null);
  if (storedData) {
    // Restore to in-memory cache
    pricingCache[propertySlug] = storedData;
  }
  
  return storedData;
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
  
  // Always log this to see when the function is called - should appear in console
  console.log(`======== [availabilityService] [DEBUG] 🚨 getPricingForDateRange called ========`);
  console.log(`[availabilityService] [DEBUG] 👥 Guest count: ${guestCount}`);
  console.log(`[availabilityService] [DEBUG] 📆 Dates: ${startDate.toISOString()} to ${endDate.toISOString()}`);
  console.log(`[availabilityService] [DEBUG] 🏠 Property: ${propertySlug}`);
  console.log(`[availabilityService] [DEBUG] 🆔 Request ID: ${requestId}`);
  console.log(`==================================================================`);
  
  try {
    // Only run in browser environment
    if (typeof window === 'undefined') {
      console.log(`[availabilityService] [${requestId}] Running in server environment, returning null`);
      return null;
    }
    
    // Create a cache key from the request parameters
    const cacheKey = `${propertySlug}_${startDate.toISOString()}_${endDate.toISOString()}_${guestCount}`;
    
    // Get cache from localStorage
    const apiCache = getApiResponseCache();
    
    // Always log cache status
    console.log(`[availabilityService] [${requestId}] 🔍 Checking cache for key: ${cacheKey}`);
    console.log(`[availabilityService] [${requestId}] 📦 Cache entry exists: ${!!apiCache[cacheKey]}`);
    if (apiCache[cacheKey]) {
      const timeRemaining = apiCache[cacheKey].expiresAt - Date.now();
      console.log(`[availabilityService] [${requestId}] ⏱️ Cache expiration: ${timeRemaining > 0 ? `${Math.round(timeRemaining/1000)}s remaining` : 'expired'}`);
    }
    
    // Architecture Decision: API-only pricing - always fetch fresh pricing data
    // Pricing needs to be current and accurate, cache would risk stale pricing
    console.log(`[availabilityService] [${requestId}] 🆕 Not using cache - API-only mode enabled with guestCount=${guestCount}`);
    
    // Get call timestamps from localStorage and update them
    const now = Date.now();
    let timestamps = getApiCallTimestamps(propertySlug);
    timestamps.push(now);
    
    // Clean up timestamps older than 1 minute
    timestamps = timestamps.filter(timestamp => now - timestamp < CALL_LIMIT_RESET_TIME);
    saveApiCallTimestamps(propertySlug, timestamps);
    
    // Count calls in the last minute
    const callsInLastMinute = timestamps.length;
    
    // Get and update total call count for this property
    const propertyTotalCalls = getApiCallCount(propertySlug);
    saveApiCallCount(propertySlug, propertyTotalCalls + 1);
    
    // Get error count
    const propertyErrors = getApiErrorCount(propertySlug);
    
    // Log detailed analytics
    console.log(`[availabilityService] [${requestId}] 📊 API call stats for ${propertySlug}:
      - Calls in last minute: ${callsInLastMinute}/${MAX_API_CALLS_PER_MINUTE}
      - Total session calls: ${propertyTotalCalls + 1}/${MAX_API_CALLS_PER_SESSION}
      - Error count: ${propertyErrors}/${MAX_API_ERRORS}
    `);
    
    // Create a standard fallback response
    const fallbackResponse = {
      available: true,
      pricing: {
        dailyRates: {},
        totalPrice: 200,
        averageNightlyRate: 100,
        subtotal: 200,
        cleaningFee: 0,
        currency: 'EUR',
        accommodationTotal: 200
      },
      unavailableDates: []
    };
    
    // Check all rate limiting conditions
    
    // 1. Error count check
    if (propertyErrors >= MAX_API_ERRORS) {
      console.warn(`[availabilityService] [${requestId}] ⚠️ Blocking request - too many errors (${propertyErrors}/${MAX_API_ERRORS})`);
      
      const response = {
        ...fallbackResponse,
        reason: 'error_limit_exceeded'
      };
      
      // Cache this response for 1 minute
      saveApiResponseCache(cacheKey, response, now + CALL_LIMIT_RESET_TIME);
      
      return response;
    }
    
    // 2. Per-minute rate limit check
    if (callsInLastMinute > MAX_API_CALLS_PER_MINUTE) {
      console.warn(`[availabilityService] [${requestId}] ⚠️ Blocking request - rate limit exceeded (${callsInLastMinute}/${MAX_API_CALLS_PER_MINUTE} calls in last minute)`);
      
      const response = {
        ...fallbackResponse,
        reason: 'rate_limit_exceeded'
      };
      
      // Cache this response for 1 minute
      saveApiResponseCache(cacheKey, response, now + CALL_LIMIT_RESET_TIME);
      
      return response;
    }
    
    // 3. Total session calls limit check
    if (propertyTotalCalls + 1 > MAX_API_CALLS_PER_SESSION) {
      console.warn(`[availabilityService] [${requestId}] ⚠️ Blocking request - session limit exceeded (${propertyTotalCalls + 1}/${MAX_API_CALLS_PER_SESSION} total calls)`);
      
      const response = {
        ...fallbackResponse,
        reason: 'session_limit_exceeded'
      };
      
      // Cache this response indefinitely for this session
      saveApiResponseCache(cacheKey, response, now + (24 * 60 * 60 * 1000)); // 24 hours
      
      return response;
    }

    // Build the API URL for the correct pricing endpoint
    const baseUrl = window.location.origin;
    const apiUrl = `${baseUrl}/api/check-pricing`; // Use the actual pricing endpoint instead of the simplified version
    
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
        guests: Number(guestCount)  // Ensure it's a number
      };
      
      // Log more verbosely to ensure we see this in the console
      console.log(`[availabilityService] [${requestId}] 📝 ==============================`);
      console.log(`[availabilityService] [${requestId}] 📝 API REQUEST DETAILS:`);
      console.log(`[availabilityService] [${requestId}] 📝 URL: ${apiUrl}`);
      console.log(`[availabilityService] [${requestId}] 📝 Property: ${propertySlug}`);
      console.log(`[availabilityService] [${requestId}] 📝 Guests: ${guestCount} (type: ${typeof guestCount})`);
      console.log(`[availabilityService] [${requestId}] 📝 Check-in: ${startDate.toISOString()}`);
      console.log(`[availabilityService] [${requestId}] 📝 Check-out: ${endDate.toISOString()}`);
      console.log(`[availabilityService] [${requestId}] 📝 Full payload: ${JSON.stringify(requestBody)}`);
      console.log(`[availabilityService] [${requestId}] 📝 ==============================`);
      
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
        const currentErrors = getApiErrorCount(propertySlug);
        saveApiErrorCount(propertySlug, currentErrors + 1);
        console.warn(`[availabilityService] [${requestId}] ⚠️ Error count for ${propertySlug}: ${currentErrors + 1}/${MAX_API_ERRORS}`);
        
        return {
          available: false,
          reason: 'service_error',
          unavailableDates: []
        };
      }

      // Reset error count on successful request
      saveApiErrorCount(propertySlug, 0);
      
      // Parse response
      const data = await response.json();
      
      // Log response details more verbosely
      console.log(`[availabilityService] [${requestId}] ✅ ==============================`);
      console.log(`[availabilityService] [${requestId}] ✅ API RESPONSE DETAILS:`);
      console.log(`[availabilityService] [${requestId}] ✅ Available: ${data.available}`);
      
      if (data.pricing) {
        console.log(`[availabilityService] [${requestId}] ✅ Total Price: ${data.pricing.totalPrice}`);
        console.log(`[availabilityService] [${requestId}] ✅ Currency: ${data.pricing.currency}`);
        console.log(`[availabilityService] [${requestId}] ✅ Guest Count Used: ${guestCount}`);
        
        if (data.pricing.dailyRates) {
          const rateCount = Object.keys(data.pricing.dailyRates).length;
          console.log(`[availabilityService] [${requestId}] ✅ Daily Rates Count: ${rateCount}`);
          
          // Log a sample of the daily rates
          if (rateCount > 0) {
            const sampleDate = Object.keys(data.pricing.dailyRates)[0];
            console.log(`[availabilityService] [${requestId}] ✅ Sample Rate (${sampleDate}): ${data.pricing.dailyRates[sampleDate]}`);
          }
        } else {
          console.log(`[availabilityService] [${requestId}] ⚠️ No daily rates in response!`);
        }
      } else {
        console.log(`[availabilityService] [${requestId}] ⚠️ No pricing data in response!`);
      }
      
      console.log(`[availabilityService] [${requestId}] ✅ Complete Response: ${JSON.stringify(data)}`);
      console.log(`[availabilityService] [${requestId}] ✅ ==============================`);
      
      // Store successful response in the cache (expires in 10 minutes)
      saveApiResponseCache(cacheKey, data, now + CACHE_EXPIRATION);
      
      console.log(`[availabilityService] [${requestId}] 💾 Cached response for ${cacheKey} (expires in 10 minutes)`);

      return data;
    } catch (error) {
      console.error(`[availabilityService] [${requestId}] ❌ Error fetching pricing data:`, error);
      
      // Increment error count for this property
      const currentErrors = getApiErrorCount(propertySlug);
      saveApiErrorCount(propertySlug, currentErrors + 1);
      console.warn(`[availabilityService] [${requestId}] ⚠️ Error count for ${propertySlug}: ${currentErrors + 1}/${MAX_API_ERRORS}`);
      
      // Create error response
      const errorResponse = {
        available: false,
        reason: 'service_error',
        unavailableDates: []
      };
      
      // Cache error responses for 30 seconds to prevent immediate retries
      saveApiResponseCache(cacheKey, errorResponse, now + 30000);
      
      return errorResponse;
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
  console.log(`[availabilityService] 📣 Version: 1.3 (Dynamic Price Calendar Support with Persistent Caching)`);
  return true;
}

/**
 * Reset all API caches and limits for a property
 * This can be called if you suspect issues with the caching or rate limiting
 */
export function resetApiCache(propertySlug?: string): void {
  console.log(`[availabilityService] 🧹 Resetting API cache${propertySlug ? ` for ${propertySlug}` : ' for all properties'}`);
  
  if (typeof window === 'undefined') {
    console.log('[availabilityService] Running in server environment, cannot reset cache');
    return;
  }
  
  if (propertySlug) {
    // Reset just for this property
    saveApiErrorCount(propertySlug, 0);
    saveApiCallCount(propertySlug, 0);
    saveApiCallTimestamps(propertySlug, []);
    
    // Remove pricing data for this property
    delete pricingCache[propertySlug];
    localStorage.removeItem(`booking_api_pricing_data_${propertySlug}`);
    
    // Remove cached responses that match this property
    const apiCache = getApiResponseCache();
    const newCache: any = {};
    for (const key in apiCache) {
      if (!key.startsWith(propertySlug + '_')) {
        newCache[key] = apiCache[key];
      }
    }
    saveToStorage('response_cache', newCache);
  } else {
    // Reset all properties
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('booking_api_')) {
        localStorage.removeItem(key);
      }
    }
    // Clear in-memory cache too
    Object.keys(pricingCache).forEach(key => delete pricingCache[key]);
  }
  
  console.log(`[availabilityService] ✅ API cache reset complete`);
}

// Automatically reset the API cache when the service is loaded
// This ensures a fresh start for the current session
if (typeof window !== 'undefined') {
  console.log(`[availabilityService] 🔄 Auto-resetting API cache and rate limits on load`);
  resetApiCache();
  console.log(`[availabilityService] ✅ API cache and rate limits reset. Session counter reset to 0.`);
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