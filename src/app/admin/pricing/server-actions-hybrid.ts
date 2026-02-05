'use server';

/**
 * Server actions for the pricing management interface using Firebase Admin SDK.
 *
 * This file contains all the server actions needed for the pricing management interface,
 * implementing data fetching and mutations using the Firebase Admin SDK.
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
import { getAdminDb, FieldValue } from "@/lib/firebaseAdminSafe";
import { convertTimestampsToISOStrings } from "@/lib/utils"; // Import the timestamp converter
import { format, parse } from "date-fns"; // Import date-fns
import { loggers } from '@/lib/logger';
import { requireAdmin, requirePropertyAccess, filterPropertiesForUser, AuthorizationError } from '@/lib/authorization';

const logger = loggers.adminPricing;

/**
 * Fetch a single property by ID
 * Requires property access
 */
export async function fetchProperty(propertyId: string) {
  try {
    // Check property access
    await requirePropertyAccess(propertyId);

    const db = await getAdminDb();
    const propertyRef = db.collection('properties').doc(propertyId);
    const propertyDoc = await propertyRef.get();

    if (!propertyDoc.exists) {
      logger.debug('Property not found', { propertyId });
      return null;
    }

    const data = propertyDoc.data()!;
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
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchProperty', { propertyId });
      return null;
    }
    logger.error('Error fetching property', error as Error, { propertyId });
    return null;
  }
}

/**
 * Fetch all properties - server action using Admin SDK
 * Filters results based on user access
 */
export async function fetchProperties() {
  try {
    // Check admin access
    const user = await requireAdmin();

    const db = await getAdminDb();
    const propertiesSnapshot = await db.collection('properties').get();

    const allProperties = propertiesSnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      // Use our utility function to convert all timestamps to ISO strings
      const serializedData = convertTimestampsToISOStrings(data);

      return {
        id: docSnap.id,
        slug: docSnap.id,
        name: serializedData.name || docSnap.id,
        location: serializedData.location || '',
        status: serializedData.status || 'active',
        pricePerNight: serializedData.pricePerNight,
        ...serializedData
      };
    });

    // Filter based on user access
    const filteredProperties = filterPropertiesForUser(allProperties, user);
    logger.debug('Fetched properties', { count: filteredProperties.length, total: allProperties.length, role: user.role });
    return filteredProperties;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchProperties');
      return [];
    }
    logger.error('Error fetching properties', error as Error);
    return [];
  }
}

/**
 * Fetch seasonal pricing for a property
 * Requires property access
 */
export async function fetchSeasonalPricing(propertyId: string) {
  try {
    // Check property access
    await requirePropertyAccess(propertyId);

    const db = await getAdminDb();
    const seasonalPricingSnapshot = await db.collection('seasonalPricing')
      .where('propertyId', '==', propertyId)
      .get();

    const seasonalPricing = seasonalPricingSnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      // Use our utility function to convert all timestamps to ISO strings
      const serializedData = convertTimestampsToISOStrings(data);

      return {
        id: docSnap.id,
        ...serializedData
      };
    });

    logger.debug('Fetched seasonal pricing rules', { propertyId, count: seasonalPricing.length });
    return seasonalPricing;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchSeasonalPricing', { propertyId });
      return [];
    }
    logger.error('Error fetching seasonal pricing', error as Error, { propertyId });
    return [];
  }
}

/**
 * Fetch date overrides for a property
 * Requires property access
 */
export async function fetchDateOverrides(propertyId: string) {
  try {
    // Check property access
    await requirePropertyAccess(propertyId);

    const db = await getAdminDb();
    const dateOverridesSnapshot = await db.collection('dateOverrides')
      .where('propertyId', '==', propertyId)
      .get();

    const dateOverrides = dateOverridesSnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      // Use our utility function to convert all timestamps to ISO strings
      const serializedData = convertTimestampsToISOStrings(data);

      return {
        id: docSnap.id,
        ...serializedData
      };
    });

    logger.debug('Fetched date overrides', { propertyId, count: dateOverrides.length });
    return dateOverrides;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchDateOverrides', { propertyId });
      return [];
    }
    logger.error('Error fetching date overrides', error as Error, { propertyId });
    return [];
  }
}

/**
 * Toggle seasonal pricing status
 * Requires property access
 */
export async function toggleSeasonalPricingStatus(seasonId: string, enabled: boolean) {
  try {
    const db = await getAdminDb();
    const seasonRef = db.collection('seasonalPricing').doc(seasonId);

    // Get season first to check property access
    const seasonDoc = await seasonRef.get();
    if (!seasonDoc.exists) {
      return { success: false, error: 'Seasonal pricing rule not found' };
    }

    const propertyId = seasonDoc.data()?.propertyId;

    // Check property access
    await requirePropertyAccess(propertyId);

    await seasonRef.update({ enabled, updatedAt: FieldValue.serverTimestamp() });

    revalidatePath('/admin/pricing');
    if (propertyId) {
      revalidatePath(`/admin/pricing?propertyId=${propertyId}`);
    }

    return { success: true };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for toggleSeasonalPricingStatus', { seasonId });
      return { success: false, error: 'You do not have access to this property' };
    }
    logger.error('Error updating seasonal pricing', error as Error, { seasonId, enabled });
    return { success: false, error: `Failed to update seasonal pricing: ${error}` };
  }
}

/**
 * Toggle date override availability
 * Requires property access
 */
export async function toggleDateOverrideAvailability(dateOverrideId: string, available: boolean) {
  try {
    const db = await getAdminDb();
    const overrideRef = db.collection('dateOverrides').doc(dateOverrideId);

    // Get override first to check property access
    const overrideDoc = await overrideRef.get();
    if (!overrideDoc.exists) {
      return { success: false, error: 'Date override not found' };
    }

    const propertyId = overrideDoc.data()?.propertyId;

    // Check property access
    await requirePropertyAccess(propertyId);

    await overrideRef.update({ available, updatedAt: FieldValue.serverTimestamp() });

    revalidatePath('/admin/pricing');
    if (propertyId) {
      revalidatePath(`/admin/pricing?propertyId=${propertyId}`);
    }

    return { success: true };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for toggleDateOverrideAvailability', { dateOverrideId });
      return { success: false, error: 'You do not have access to this property' };
    }
    logger.error('Error updating date override', error as Error, { dateOverrideId, available });
    return { success: false, error: `Failed to update date override: ${error}` };
  }
}

/**
 * Update or create a date override
 * Requires property access
 */
export async function updateDay(dayData: any) {
  try {
    // Check property access first
    await requirePropertyAccess(dayData.propertyId);

    logger.debug('Updating day', { date: dayData.date, propertyId: dayData.propertyId });
    const db = await getAdminDb();
    let overrideId = dayData.id;

    // If we have an ID, it means we're updating an existing override
    if (overrideId) {
      const overrideRef = db.collection('dateOverrides').doc(overrideId);
      await overrideRef.update({
        customPrice: dayData.customPrice,
        available: dayData.available,
        minimumStay: dayData.minimumStay,
        reason: dayData.reason,
        updatedAt: FieldValue.serverTimestamp()
      });
    } else {
      // Otherwise, we're creating a new override
      const docRef = await db.collection('dateOverrides').add({
        propertyId: dayData.propertyId,
        date: dayData.date,
        customPrice: dayData.customPrice,
        available: dayData.available,
        minimumStay: dayData.minimumStay,
        reason: dayData.reason,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
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
      const availabilityRef = db.collection('availability').doc(availabilityDocId);

      // Update the availability status for the specific day
      await availabilityRef.set({
        [`available.${day}`]: dayData.available,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      logger.debug('Updated availability collection', { availabilityDocId, day });
    } catch (availabilityError) {
      logger.error('Error updating availability collection', availabilityError as Error, { availabilityDocId, day });
      // Don't fail the operation if availability update fails
    }

    // Update the corresponding price calendar
    try {
      const calendarRef = db.collection('priceCalendars').doc(calendarId);
      const calendarDoc = await calendarRef.get();

      if (calendarDoc.exists) {
        const calendarData = calendarDoc.data()!;
        // Update the specific day in the calendar (availability now handled by availability collection only)
        await calendarRef.update({
          [`days.${day}.adjustedPrice`]: dayData.customPrice,
          [`days.${day}.minimumStay`]: dayData.minimumStay,
          [`days.${day}.reason`]: dayData.reason,
          [`days.${day}.priceSource`]: 'override',
          [`days.${day}.overrideId`]: overrideId,
          // Also update prices for different guest counts if present
          ...(calendarData.days?.[day]?.prices ? {
            [`days.${day}.prices`]: Object.keys(calendarData.days[day].prices).reduce((acc: any, guestCount) => {
              acc[guestCount] = dayData.customPrice;
              return acc;
            }, {})
          } : {}),
          updatedAt: FieldValue.serverTimestamp()
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
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for updateDay', { date: dayData.date, propertyId: dayData.propertyId });
      return { success: false, error: 'You do not have access to this property' };
    }
    logger.error('Error updating day', error as Error, { date: dayData.date });
    return { success: false, error: `Failed to update day: ${error}` };
  }
}

/**
 * Fetch price calendars for a property with optional date range filtering
 * Requires property access
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
    // Check property access
    await requirePropertyAccess(propertyId);

    logger.debug('Fetching price calendars', { propertyId, monthsToFetch });

    const db = await getAdminDb();

    // Build base query
    let queryRef = db.collection('priceCalendars')
      .where('propertyId', '==', propertyId);

    // Apply date range filters if provided
    let useCustomFiltering = false;
    if (startYear !== undefined) {
      queryRef = queryRef.where('year', '>=', startYear);
      useCustomFiltering = true;
    }

    if (endYear !== undefined) {
      queryRef = queryRef.where('year', '<=', endYear);
      useCustomFiltering = true;
    }

    // Build the query with ordering and limit
    const snapshot = await queryRef
      .orderBy('year')
      .orderBy('month')
      .limit(monthsToFetch * 2) // Fetch extra in case we need to filter out months
      .get();

    // Map and filter the results
    let calendars = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
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
        id: docSnap.id,
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
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchPriceCalendars', { propertyId });
      return [];
    }
    logger.error('Error fetching price calendars', error as Error, { propertyId });
    return [];
  }
}

/**
 * Generate price calendars for a property
 * Requires property access
 */
export async function generatePriceCalendar(propertyId: string) {
  try {
    // Check property access first
    await requirePropertyAccess(propertyId);

    logger.info('Generating price calendars', { propertyId });

    const db = await getAdminDb();

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
      const propertyRef = db.collection('properties').doc(propertyId);
      const propertyDoc = await propertyRef.get();

      if (!propertyDoc.exists) {
        logger.error('Property not found during calendar generation', undefined, { propertyId });
        continue;
      }

      // Use the utility function to handle any Timestamp objects
      const property = convertTimestampsToISOStrings(propertyDoc.data()!);

      // Get seasonal pricing
      const seasonalPricingSnapshot = await db.collection('seasonalPricing')
        .where('propertyId', '==', propertyId)
        .where('enabled', '==', true)
        .get();

      const seasons = seasonalPricingSnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...convertTimestampsToISOStrings(docSnap.data())
      }));

      // Get date overrides
      const monthStr = month.toString().padStart(2, '0');
      const firstDay = `${year}-${monthStr}-01`;
      const lastDay = `${year}-${monthStr}-${new Date(year, month, 0).getDate()}`;

      // Use a simpler query that doesn't require a composite index
      const dateOverridesSnapshot = await db.collection('dateOverrides')
        .where('propertyId', '==', propertyId)
        .get();

      // Filter the results in memory
      const dateOverrides = dateOverridesSnapshot.docs
        .map(docSnap => ({
          id: docSnap.id,
          ...convertTimestampsToISOStrings(docSnap.data())
        }))
        .filter(override =>
          override.date >= firstDay && override.date <= lastDay
        );

      // Get booked dates
      const bookingsSnapshot = await db.collection('bookings')
        .where('propertyId', '==', propertyId)
        .where('status', 'in', ['confirmed', 'on-hold'])
        .get();

      const bookedDates = new Set<string>();
      bookingsSnapshot.docs.forEach(docSnap => {
        const booking = docSnap.data();
        if (booking.checkInDate && booking.checkOutDate) {
          // Convert dates to JS Date objects if they're Firestore Timestamps
          const checkIn = booking.checkInDate instanceof Date ?
            booking.checkInDate :
            booking.checkInDate.toDate ? booking.checkInDate.toDate() :
            booking.checkInDate._seconds ? new Date(booking.checkInDate._seconds * 1000) : new Date(booking.checkInDate);

          const checkOut = booking.checkOutDate instanceof Date ?
            booking.checkOutDate :
            booking.checkOutDate.toDate ? booking.checkOutDate.toDate() :
            booking.checkOutDate._seconds ? new Date(booking.checkOutDate._seconds * 1000) : new Date(booking.checkOutDate);

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
      const calendarRef = db.collection('priceCalendars').doc(calendarId);
      await calendarRef.set(calendar);

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
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for generatePriceCalendar', { propertyId });
      return { success: false, error: 'You do not have access to this property' };
    }
    logger.error('Error generating price calendars', error as Error, { propertyId });
    return { success: false, error: `Failed to generate price calendars: ${error}` };
  }
}