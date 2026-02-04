'use server';

/**
 * Server actions for the pricing management interface using Firebase Client SDK.
 *
 * This file contains all the server actions needed for the pricing management interface,
 * implementing data fetching and mutations using the Firebase Client SDK instead of Admin SDK.
 *
 * This approach matches the pattern used in other admin sections like coupons,
 * providing a consistent architecture throughout the admin interface.
 *
 * Functions:
 * - fetchProperties: Get all properties
 * - fetchSeasonalPricing: Get seasonal pricing for a property
 * - fetchDateOverrides: Get date overrides for a property
 * - toggleSeasonalPricingStatus: Toggle a seasonal pricing rule on/off
 * - toggleDateOverrideAvailability: Toggle a date override available/unavailable
 * - generatePriceCalendar: Generate price calendars for a property
 */
import { revalidatePath } from 'next/cache';
import { collection, getDocs, doc, updateDoc, getDoc, query, where, orderBy, setDoc, limit, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase"; // Import the client SDK
import { convertTimestampsToISOStrings } from "@/lib/utils"; // Import the timestamp converter
import { format, parse } from "date-fns"; // Import date-fns
import { loggers } from '@/lib/logger';

const logger = loggers.adminPricing;

/**
 * Fetch a single property by ID
 */
export async function fetchProperty(propertyId: string) {
  try {
    const propertyRef = doc(db, 'properties', propertyId);
    const propertyDoc = await getDoc(propertyRef);

    if (!propertyDoc.exists()) {
      logger.debug('Property not found', { propertyId });
      return null;
    }

    const data = propertyDoc.data();
    const serializedData = convertTimestampsToISOStrings(data);

    logger.debug('Fetched property', { propertyId });
    return {
      id: propertyDoc.id,
      name: serializedData.name || propertyDoc.id,
      location: serializedData.location || '',
      status: serializedData.status || 'active',
      pricePerNight: serializedData.pricePerNight,
      ...serializedData
    };
  } catch (error) {
    logger.error('Error fetching property', error as Error, { propertyId });
    return null;
  }
}

/**
 * Fetch all properties - server action using client SDK
 * This matches the pattern used in the coupons section
 */
export async function fetchProperties() {
  try {
    const propertiesRef = collection(db, 'properties');
    const snapshot = await getDocs(propertiesRef);

    const properties = snapshot.docs.map(doc => {
      const data = doc.data();
      // Use our utility function to convert all timestamps to ISO strings
      const serializedData = convertTimestampsToISOStrings(data);

      return {
        id: doc.id,
        name: serializedData.name || doc.id,
        location: serializedData.location || '',
        status: serializedData.status || 'active',
        pricePerNight: serializedData.pricePerNight,
        ...serializedData
      };
    });

    logger.debug('Fetched properties', { count: properties.length });
    return properties;
  } catch (error) {
    logger.error('Error fetching properties', error as Error);
    return [];
  }
}

/**
 * Fetch seasonal pricing for a property
 */
export async function fetchSeasonalPricing(propertyId: string) {
  try {
    const seasonalPricingRef = collection(db, 'seasonalPricing');
    const q = query(seasonalPricingRef, where('propertyId', '==', propertyId));
    const snapshot = await getDocs(q);

    const seasonalPricing = snapshot.docs.map(doc => {
      const data = doc.data();
      // Use our utility function to convert all timestamps to ISO strings
      const serializedData = convertTimestampsToISOStrings(data);

      return {
        id: doc.id,
        ...serializedData
      };
    });

    logger.debug('Fetched seasonal pricing rules', { propertyId, count: seasonalPricing.length });
    return seasonalPricing;
  } catch (error) {
    logger.error('Error fetching seasonal pricing', error as Error, { propertyId });
    return [];
  }
}

/**
 * Fetch date overrides for a property
 */
export async function fetchDateOverrides(propertyId: string) {
  try {
    const dateOverridesRef = collection(db, 'dateOverrides');
    const q = query(dateOverridesRef, where('propertyId', '==', propertyId));
    const snapshot = await getDocs(q);

    const dateOverrides = snapshot.docs.map(doc => {
      const data = doc.data();
      // Use our utility function to convert all timestamps to ISO strings
      const serializedData = convertTimestampsToISOStrings(data);

      return {
        id: doc.id,
        ...serializedData
      };
    });

    logger.debug('Fetched date overrides', { propertyId, count: dateOverrides.length });
    return dateOverrides;
  } catch (error) {
    logger.error('Error fetching date overrides', error as Error, { propertyId });
    return [];
  }
}

/**
 * Toggle seasonal pricing status
 */
export async function toggleSeasonalPricingStatus(seasonId: string, enabled: boolean) {
  try {
    const seasonRef = doc(db, 'seasonalPricing', seasonId);
    
    await updateDoc(seasonRef, { enabled });
    
    // Get property ID to revalidate paths
    const seasonDoc = await getDoc(seasonRef);
    const propertyId = seasonDoc.data()?.propertyId;
    
    revalidatePath('/admin/pricing');
    if (propertyId) {
      revalidatePath(`/admin/pricing?propertyId=${propertyId}`);
    }
    
    return { success: true };
  } catch (error) {
    logger.error('Error updating seasonal pricing', error as Error, { seasonId, enabled });
    return { success: false, error: `Failed to update seasonal pricing: ${error}` };
  }
}

/**
 * Toggle date override availability
 */
export async function toggleDateOverrideAvailability(dateOverrideId: string, available: boolean) {
  try {
    const overrideRef = doc(db, 'dateOverrides', dateOverrideId);

    await updateDoc(overrideRef, { available });

    // Get property ID to revalidate paths
    const overrideDoc = await getDoc(overrideRef);
    const propertyId = overrideDoc.data()?.propertyId;

    revalidatePath('/admin/pricing');
    if (propertyId) {
      revalidatePath(`/admin/pricing?propertyId=${propertyId}`);
    }

    return { success: true };
  } catch (error) {
    logger.error('Error updating date override', error as Error, { dateOverrideId, available });
    return { success: false, error: `Failed to update date override: ${error}` };
  }
}

/**
 * Update or create a date override
 */
export async function updateDay(dayData: any) {
  try {
    logger.debug('Updating day', { date: dayData.date, propertyId: dayData.propertyId });
    let overrideId = dayData.id;

    // If we have an ID, it means we're updating an existing override
    if (overrideId) {
      const overrideRef = doc(db, 'dateOverrides', overrideId);
      await updateDoc(overrideRef, {
        customPrice: dayData.customPrice,
        available: dayData.available,
        minimumStay: dayData.minimumStay,
        reason: dayData.reason,
        updatedAt: new Date().toISOString()
      });
    } else {
      // Otherwise, we're creating a new override
      const docRef = await addDoc(collection(db, 'dateOverrides'), {
        propertyId: dayData.propertyId,
        date: dayData.date,
        customPrice: dayData.customPrice,
        available: dayData.available,
        minimumStay: dayData.minimumStay,
        reason: dayData.reason,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      overrideId = docRef.id;
    }

    // Extract year, month, and day from the date string
    const [year, month, day] = dayData.date.split('-').map((part: string) => parseInt(part, 10));

    // Format the calendar ID (propertyId_YYYY-MM)
    const calendarId = `${dayData.propertyId}_${year}-${month.toString().padStart(2, '0')}`;
    logger.debug('Updating price calendar', { calendarId, day });

    // Update the availability collection (NEW - for availability deduplication)
    const availabilityDocId = `${dayData.propertyId}_${year}-${month.toString().padStart(2, '0')}`;
    try {
      const availabilityRef = doc(db, 'availability', availabilityDocId);

      // Update the availability status for the specific day
      await setDoc(availabilityRef, {
        [`available.${day}`]: dayData.available,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      logger.debug('Updated availability collection', { availabilityDocId, day });
    } catch (availabilityError) {
      logger.error('Error updating availability collection', availabilityError as Error, { availabilityDocId, day });
      // Don't fail the operation if availability update fails
    }

    // Update the corresponding price calendar
    try {
      const calendarRef = doc(db, 'priceCalendars', calendarId);
      const calendarDoc = await getDoc(calendarRef);

      if (calendarDoc.exists()) {
        // Update the specific day in the calendar (availability now handled by availability collection only)
        await updateDoc(calendarRef, {
          [`days.${day}.adjustedPrice`]: dayData.customPrice,
          [`days.${day}.minimumStay`]: dayData.minimumStay,
          [`days.${day}.reason`]: dayData.reason,
          [`days.${day}.priceSource`]: 'override',
          [`days.${day}.overrideId`]: overrideId,
          // Also update prices for different guest counts if present
          ...(calendarDoc.data().days[day]?.prices ? {
            [`days.${day}.prices`]: Object.keys(calendarDoc.data().days[day].prices).reduce((acc: any, guestCount) => {
              acc[guestCount] = dayData.customPrice;
              return acc;
            }, {})
          } : {}),
          updatedAt: new Date().toISOString()
        });

        logger.debug('Updated price calendar', { calendarId, day });
      } else {
        logger.debug('Price calendar does not exist, skipping direct update', { calendarId });
      }
    } catch (calendarError) {
      // Don't fail the entire operation if calendar update fails
      logger.error('Error updating price calendar', calendarError as Error, { calendarId });
    }

    revalidatePath('/admin/pricing');
    revalidatePath(`/admin/pricing?propertyId=${dayData.propertyId}`);

    return { success: true };
  } catch (error) {
    logger.error('Error updating day', error as Error, { date: dayData.date });
    return { success: false, error: `Failed to update day: ${error}` };
  }
}

/**
 * Fetch price calendars for a property with optional date range filtering
 *
 * @param propertyId - The ID of the property to fetch calendars for
 * @param monthsToFetch - The maximum number of months to fetch
 * @param startYear - Optional start year for filtering
 * @param startMonth - Optional start month for filtering
 * @param endYear - Optional end year for filtering
 * @param endMonth - Optional end month for filtering
 */
export async function fetchPriceCalendars(
  propertyId: string,
  monthsToFetch: number = 6,
  startYear?: number,
  startMonth?: number,
  endYear?: number,
  endMonth?: number
) {
  try {
    logger.debug('Fetching price calendars', { propertyId, monthsToFetch });

    const priceCalendarsRef = collection(db, 'priceCalendars');

    // Build query conditions
    const queryConditions: any[] = [
      where('propertyId', '==', propertyId)
    ];

    // Apply date range filters if provided
    let useCustomFiltering = false;
    if (startYear !== undefined) {
      // For simplicity in Firestore query, we just filter by year first
      // then post-process for specific months
      queryConditions.push(where('year', '>=', startYear));
      useCustomFiltering = true;
    }

    if (endYear !== undefined) {
      queryConditions.push(where('year', '<=', endYear));
      useCustomFiltering = true;
    }

    // Build the query
    const q = query(
      priceCalendarsRef,
      ...queryConditions,
      orderBy('year'),
      orderBy('month'),
      limit(monthsToFetch * 2) // Fetch extra in case we need to filter out months
    );

    const snapshot = await getDocs(q);

    // Map and filter the results
    let calendars = snapshot.docs.map(doc => {
      const data = doc.data();
      // Use our utility function to convert all timestamps to ISO strings
      const serializedData = convertTimestampsToISOStrings(data);

      // Parse the monthStr to a Date object for sorting
      let monthDate = null;
      try {
        if (serializedData.monthStr) {
          monthDate = parse(serializedData.monthStr, 'MMMM yyyy', new Date());
        }
      } catch (error) {
        logger.warn('Error parsing month string', { error, monthStr: serializedData.monthStr });
      }

      return {
        id: doc.id,
        monthDate,
        ...serializedData
      };
    });

    // Apply month-specific filtering if needed
    if (useCustomFiltering) {
      calendars = calendars.filter(calendar => {
        // Filter by start month+year if provided
        if (startYear !== undefined && startMonth !== undefined) {
          if (calendar.year < startYear) return false;
          if (calendar.year === startYear && calendar.month < startMonth) return false;
        }

        // Filter by end month+year if provided
        if (endYear !== undefined && endMonth !== undefined) {
          if (calendar.year > endYear) return false;
          if (calendar.year === endYear && calendar.month > endMonth) return false;
        }

        return true;
      });

      // Limit to requested number of months after filtering
      calendars = calendars.slice(0, monthsToFetch);
    }

    // Sort by date (most recent first)
    calendars.sort((a, b) => {
      if (!a.monthDate || !b.monthDate) return 0;
      return a.monthDate.getTime() - b.monthDate.getTime();
    });

    logger.debug('Fetched price calendars', { propertyId, count: calendars.length });
    return calendars;
  } catch (error) {
    logger.error('Error fetching price calendars', error as Error, { propertyId });
    return [];
  }
}

/**
 * Generate price calendars for a property
 */
export async function generatePriceCalendar(propertyId: string) {
  try {
    logger.info('Generating price calendars', { propertyId });

    // Get current date
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-based month

    // Generate calendars for the next 12 months
    const months = 12;
    const generatedCalendars = [];

    for (let i = 0; i < months; i++) {
      const targetDate = new Date(currentYear, currentMonth - 1 + i, 1);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth() + 1; // 1-based month

      // Get property data
      const propertyRef = doc(db, 'properties', propertyId);
      const propertyDoc = await getDoc(propertyRef);

      if (!propertyDoc.exists()) {
        logger.error('Property not found during calendar generation', undefined, { propertyId });
        continue;
      }

      // Use the utility function to handle any Timestamp objects
      const property = convertTimestampsToISOStrings(propertyDoc.data());

      // Get seasonal pricing
      const seasonalPricingRef = collection(db, 'seasonalPricing');
      const seasonalPricingQuery = query(
        seasonalPricingRef,
        where('propertyId', '==', propertyId),
        where('enabled', '==', true)
      );
      const seasonalPricingSnapshot = await getDocs(seasonalPricingQuery);

      const seasons = seasonalPricingSnapshot.docs.map(doc => ({
        id: doc.id,
        ...convertTimestampsToISOStrings(doc.data())
      }));

      // Get date overrides
      const monthStr = month.toString().padStart(2, '0');
      const firstDay = `${year}-${monthStr}-01`;
      const lastDay = `${year}-${monthStr}-${new Date(year, month, 0).getDate()}`;

      // Use a simpler query that doesn't require a composite index
      const dateOverridesRef = collection(db, 'dateOverrides');
      const dateOverridesQuery = query(
        dateOverridesRef,
        where('propertyId', '==', propertyId)
      );
      const dateOverridesSnapshot = await getDocs(dateOverridesQuery);

      // Filter the results in memory
      const dateOverrides = dateOverridesSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...convertTimestampsToISOStrings(doc.data())
        }))
        .filter(override =>
          override.date >= firstDay && override.date <= lastDay
        );

      // Get booked dates
      const bookingsRef = collection(db, 'bookings');
      const bookingsQuery = query(
        bookingsRef,
        where('propertyId', '==', propertyId),
        where('status', 'in', ['confirmed', 'on-hold'])
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);

      const bookedDates = new Set<string>();
      bookingsSnapshot.docs.forEach(doc => {
        const booking = doc.data();
        if (booking.checkInDate && booking.checkOutDate) {
          // Convert dates to JS Date objects if they're Firestore Timestamps
          const checkIn = booking.checkInDate instanceof Date ?
            booking.checkInDate :
            booking.checkInDate.toDate ? booking.checkInDate.toDate() : new Date(booking.checkInDate);

          const checkOut = booking.checkOutDate instanceof Date ?
            booking.checkOutDate :
            booking.checkOutDate.toDate ? booking.checkOutDate.toDate() : new Date(booking.checkOutDate);

          // Generate all dates in the range (excluding checkout day)
          const currentDate = new Date(checkIn);
          while (currentDate < checkOut) {
            bookedDates.add(format(currentDate, 'yyyy-MM-dd'));
            currentDate.setDate(currentDate.getDate() + 1);
          }
        }
      });

      // Generate days data
      const daysInMonth = new Date(year, month, 0).getDate();
      const days: Record<string, any> = {};

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOfWeek = format(date, 'EEEE').toLowerCase();

        // Start with base price
        let basePrice = property.pricePerNight || 100;
        let adjustedPrice = basePrice;
        let available = true;
        let minimumStay = 1;
        let priceSource = 'base';
        let seasonId = undefined;
        let seasonName = undefined;
        let overrideId = undefined;
        let reason = undefined;
        let flatRate = false;

        // Check if date is booked
        if (bookedDates.has(dateStr)) {
          available = false;
        }

        // Check for date override
        const override = dateOverrides.find(o => o.date === dateStr);
        if (override) {
          adjustedPrice = override.customPrice;
          available = override.available !== false; // Default to true
          minimumStay = override.minimumStay || minimumStay;
          priceSource = 'override';
          overrideId = override.id;
          reason = override.reason;
          flatRate = override.flatRate || false;
        } else {
          // Check for seasonal pricing
          const activeSeason = seasons.find(season => {
            const seasonStart = new Date(season.startDate);
            const seasonEnd = new Date(season.endDate);
            return date >= seasonStart && date <= seasonEnd;
          });

          if (activeSeason) {
            adjustedPrice = basePrice * activeSeason.priceMultiplier;
            minimumStay = activeSeason.minimumStay || minimumStay;
            priceSource = 'season';
            seasonId = activeSeason.id;
            seasonName = activeSeason.name;
          } else {
            // Check for weekend pricing
            const weekendDays = property.pricing?.weekendPricing?.weekendDays || ['friday', 'saturday'];
            const isWeekendDay = weekendDays.includes(dayOfWeek);
            const weekendMultiplier = property.pricing?.weekendPricing?.priceMultiplier || 1.0;

            if (isWeekendDay && property.pricing?.weekendPricing?.enabled) {
              adjustedPrice = basePrice * weekendMultiplier;
              priceSource = 'weekend';
            }
          }
        }

        // Calculate prices for different occupancy levels
        const baseOccupancy = property.baseOccupancy || 2;
        const maxGuests = property.maxGuests || 6;
        const extraGuestFee = property.extraGuestFee || 0;

        const prices: Record<string, number> = {};
        for (let guests = baseOccupancy; guests <= maxGuests; guests++) {
          if (flatRate) {
            prices[guests.toString()] = adjustedPrice;
          } else {
            const extraGuests = Math.max(0, guests - baseOccupancy);
            prices[guests.toString()] = adjustedPrice + (extraGuests * extraGuestFee);
          }
        }

        // Add the day to our calendar with null checks for undefined values
        days[day.toString()] = {
          basePrice,
          adjustedPrice,
          prices,
          available,
          minimumStay,
          isWeekend: ['friday', 'saturday', 'sunday'].includes(dayOfWeek),
          seasonId: seasonId || null,
          seasonName: seasonName || null,
          overrideId: overrideId || null,
          reason: reason || null,
          priceSource
        };
      }

      // Calculate summary statistics
      const availableDays = Object.values(days).filter(day => day.available);
      const defaultBasePrice = property.pricePerNight || 100;

      const minPrice = availableDays.length > 0
        ? Math.min(...availableDays.map(day => day.adjustedPrice))
        : defaultBasePrice;

      const maxPrice = availableDays.length > 0
        ? Math.max(...availableDays.map(day => day.adjustedPrice))
        : defaultBasePrice;

      const avgPrice = availableDays.length > 0
        ? availableDays.reduce((sum, day) => sum + day.adjustedPrice, 0) / availableDays.length
        : defaultBasePrice;

      const unavailableDays = Object.values(days).filter(day => !day.available).length;
      const modifiedDays = Object.values(days).filter(day => day.priceSource !== 'base').length;
      const hasCustomPrices = Object.values(days).some(day => day.priceSource === 'override');
      const hasSeasonalRates = Object.values(days).some(day => day.priceSource === 'season');

      // Create the calendar document
      const calendarId = `${propertyId}_${year}-${monthStr}`;
      const calendar = {
        id: calendarId,
        propertyId,
        year,
        month,
        monthStr: format(new Date(year, month - 1, 1), 'MMMM yyyy'),
        days,
        summary: {
          minPrice,
          maxPrice,
          avgPrice,
          unavailableDays,
          modifiedDays,
          hasCustomPrices,
          hasSeasonalRates
        },
        // Use ISO string for timestamp to avoid serialization issues
        generatedAt: new Date().toISOString()
      };

      // Save to Firestore
      const calendarRef = doc(db, 'priceCalendars', calendarId);
      await setDoc(calendarRef, calendar);

      generatedCalendars.push(calendarId);
      logger.debug('Generated price calendar', { calendarId });
    }

    revalidatePath('/admin/pricing');
    revalidatePath(`/admin/pricing?propertyId=${propertyId}`);

    return {
      success: true,
      months,
      generatedCalendars
    };
  } catch (error) {
    logger.error('Error generating price calendars', error as Error, { propertyId });
    return { success: false, error: `Failed to generate price calendars: ${error}` };
  }
}