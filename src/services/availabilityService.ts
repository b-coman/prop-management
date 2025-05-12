"use client";

import { format, startOfDay } from 'date-fns';

/**
 * Get unavailable dates for a property using the server-side API endpoint
 * Simplified version with better error handling
 */
export async function getUnavailableDatesForProperty(propertySlug: string, monthsToFetch: number = 12): Promise<Date[]> {
  console.log(`[availabilityService] Fetching unavailable dates for ${propertySlug}`);
  
  try {
    // Only run in browser environment
    if (typeof window === 'undefined') {
      console.log('[availabilityService] Running in server environment, returning empty array');
      return [];
    }

    // Build the API URL
    const baseUrl = window.location.origin;
    const apiUrl = `${baseUrl}/api/check-availability?propertySlug=${encodeURIComponent(propertySlug)}&months=${monthsToFetch}&_t=${Date.now()}`;
    
    try {
      // Simpler fetch without AbortController to avoid AbortError issues
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

/**
 * Check if a specific date range is available for a property
 * Simplified version with better error handling
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