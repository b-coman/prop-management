'use server';

/**
 * Server actions for the pricing management interface using Firebase Admin SDK.
 *
 * This file contains all the server actions needed for the pricing management interface,
 * implementing data fetching and mutations using the Firebase Admin SDK.
 *
 * Functions:
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
import { requirePropertyAccess, AuthorizationError } from '@/lib/authorization';
import { calculateDayPrice } from '@/lib/pricing/price-calculation';
import type { PropertyPricing, SeasonalPricing, DateOverride, MinimumStayRule } from '@/lib/pricing/price-calculation';

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

    // Regenerate calendars to reflect the change
    if (propertyId) {
      await regenerateCalendarsAfterChange(propertyId);
    }

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

    // Regenerate calendars to reflect the change
    if (propertyId) {
      await regenerateCalendarsAfterChange(propertyId);
    }

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
 * Auto-regenerate calendars after a pricing config change.
 * Logs errors but never throws — the CRUD operation should still succeed
 * even if regeneration fails.
 */
export async function regenerateCalendarsAfterChange(propertyId: string): Promise<void> {
  try {
    logger.info('Auto-regenerating calendars after pricing change', { propertyId });
    const result = await generatePriceCalendar(propertyId);
    if (result.success) {
      logger.info('Calendars regenerated successfully', { propertyId, months: result.months });
    } else {
      logger.warn('Calendar regeneration returned error', { propertyId, error: result.error });
    }
  } catch (error) {
    logger.error('Failed to auto-regenerate calendars', error as Error, { propertyId });
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

    // --- Fetch all data once (not per-month) ---

    // 1. Property data
    const propertyDoc = await db.collection('properties').doc(propertyId).get();
    if (!propertyDoc.exists) {
      logger.error('Property not found during calendar generation', undefined, { propertyId });
      return { success: false, error: 'Property not found' };
    }
    const property = convertTimestampsToISOStrings(propertyDoc.data()!);

    // Build PropertyPricing with backward-compat fallback (pricingConfig vs legacy pricing.weekendPricing)
    const propertyPricing: PropertyPricing = {
      id: propertyId,
      pricePerNight: property.pricePerNight || 100,
      baseCurrency: property.baseCurrency || 'EUR',
      baseOccupancy: property.baseOccupancy || 2,
      extraGuestFee: property.extraGuestFee || 0,
      maxGuests: property.maxGuests || 6,
      pricingConfig: property.pricingConfig || {
        weekendAdjustment: (property.pricing?.weekendPricing?.enabled
          ? property.pricing.weekendPricing.priceMultiplier
          : 1.0) || 1.0,
        weekendDays: property.pricing?.weekendPricing?.weekendDays || ['friday', 'saturday'],
      }
    };

    logger.debug('Built PropertyPricing', {
      id: propertyPricing.id,
      pricePerNight: propertyPricing.pricePerNight,
      baseOccupancy: propertyPricing.baseOccupancy,
      weekendAdjustment: propertyPricing.pricingConfig?.weekendAdjustment,
      weekendDays: propertyPricing.pricingConfig?.weekendDays,
      usedFallback: !property.pricingConfig
    });

    // 2. Seasonal pricing (enabled only)
    const seasonalSnapshot = await db.collection('seasonalPricing')
      .where('propertyId', '==', propertyId)
      .where('enabled', '==', true)
      .get();
    const seasons: SeasonalPricing[] = seasonalSnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestampsToISOStrings(doc.data())
    })) as SeasonalPricing[];

    // 3. Date overrides (all — calculateDayPrice will match by date)
    const overridesSnapshot = await db.collection('dateOverrides')
      .where('propertyId', '==', propertyId)
      .get();
    const overrides: DateOverride[] = overridesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestampsToISOStrings(doc.data())
    })) as DateOverride[];

    // 4. Minimum stay rules
    const minStaySnapshot = await db.collection('minimumStayRules')
      .where('propertyId', '==', propertyId)
      .where('enabled', '==', true)
      .get();
    const minStayRules: MinimumStayRule[] = minStaySnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestampsToISOStrings(doc.data())
    })) as MinimumStayRule[];

    // 5. Booked dates (confirmed and on-hold bookings)
    const bookingsSnapshot = await db.collection('bookings')
      .where('propertyId', '==', propertyId)
      .where('status', 'in', ['confirmed', 'on-hold'])
      .get();
    const bookedDates = new Set<string>();
    bookingsSnapshot.docs.forEach(docSnap => {
      const booking = docSnap.data();
      if (booking.checkInDate && booking.checkOutDate) {
        const checkIn = booking.checkInDate instanceof Date
          ? booking.checkInDate
          : booking.checkInDate.toDate ? booking.checkInDate.toDate()
          : booking.checkInDate._seconds ? new Date(booking.checkInDate._seconds * 1000)
          : new Date(booking.checkInDate);
        const checkOut = booking.checkOutDate instanceof Date
          ? booking.checkOutDate
          : booking.checkOutDate.toDate ? booking.checkOutDate.toDate()
          : booking.checkOutDate._seconds ? new Date(booking.checkOutDate._seconds * 1000)
          : new Date(booking.checkOutDate);
        const currentDate = new Date(checkIn);
        while (currentDate < checkOut) {
          bookedDates.add(format(currentDate, 'yyyy-MM-dd'));
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    });

    logger.debug('Fetched pricing data', {
      propertyId,
      seasons: seasons.length,
      overrides: overrides.length,
      minStayRules: minStayRules.length,
      bookedDates: bookedDates.size
    });

    // --- Generate calendars for 12 months ---
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const months = 12;
    const generatedCalendars: string[] = [];

    for (let i = 0; i < months; i++) {
      const targetDate = new Date(currentYear, currentMonth - 1 + i, 1);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth() + 1;
      const monthStr = month.toString().padStart(2, '0');
      const daysInMonth = new Date(year, month, 0).getDate();
      const days: Record<string, any> = {};

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dateStr = format(date, 'yyyy-MM-dd');

        // Use the canonical pricing engine
        const dayPrice = calculateDayPrice(propertyPricing, date, seasons, overrides, minStayRules);

        // Overlay booking availability (booked dates are always unavailable)
        if (bookedDates.has(dateStr)) {
          dayPrice.available = false;
        }

        days[day.toString()] = dayPrice;
      }

      // Calculate summary statistics using adjustedPrice
      const dayValues = Object.values(days);
      const availableDays = dayValues.filter((d: any) => d.available);
      const defaultBasePrice = propertyPricing.pricePerNight;

      const minPrice = availableDays.length > 0
        ? Math.min(...availableDays.map((d: any) => d.adjustedPrice))
        : defaultBasePrice;
      const maxPrice = availableDays.length > 0
        ? Math.max(...availableDays.map((d: any) => d.adjustedPrice))
        : defaultBasePrice;
      const avgPrice = availableDays.length > 0
        ? availableDays.reduce((sum: number, d: any) => sum + d.adjustedPrice, 0) / availableDays.length
        : defaultBasePrice;

      const unavailableDayCount = dayValues.filter((d: any) => !d.available).length;
      const modifiedDays = dayValues.filter((d: any) => d.priceSource !== 'base').length;
      const hasCustomPrices = dayValues.some((d: any) => d.priceSource === 'override');
      const hasSeasonalRates = dayValues.some((d: any) => d.priceSource === 'season');

      // Create and save the calendar document
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
          unavailableDays: unavailableDayCount,
          modifiedDays,
          hasCustomPrices,
          hasSeasonalRates
        },
        generatedAt: new Date().toISOString()
      };

      await db.collection('priceCalendars').doc(calendarId).set(calendar);
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