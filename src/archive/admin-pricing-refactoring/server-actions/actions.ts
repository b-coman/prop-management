'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
// Import functions directly to avoid undefined dbAdmin issues
import {
  isFirestoreAdminAvailable,
  getAdminProperties,
  getAdminSeasonalPricing,
  getAdminDateOverrides,
  toggleSeasonalPricingStatus,
  toggleDateOverrideAvailability
} from '@/lib/firebaseAdminNew';
import {
  isFirestoreAdminAvailable,
  SeasonalPricing,
  DateOverride,
  Property,
  PriceCalendarMonth as PriceCalendar
} from '@/lib/server/pricing-data';
import { updatePriceCalendarsForProperty } from '@/lib/pricing/price-calendar-generator';

/**
 * Toggle a seasonal pricing rule's enabled status
 *
 * @param seasonId The ID of the seasonal pricing rule
 * @param enabled The new enabled status
 */
export async function toggleSeasonalPricingStatus(seasonId: string, enabled: boolean) {
  if (!isFirestoreAdminAvailable()) {
    console.error('[Server] Firebase Admin is not initialized');
    throw new Error('Firebase Admin is not initialized');
  }

  try {
    await dbAdmin.collection('seasonalPricing').doc(seasonId).update({
      enabled: enabled
    });

    console.log(`[Server] Updated seasonal pricing ${seasonId} status to ${enabled}`);

    // Get the season data to find the property ID
    const seasonDoc = await dbAdmin.collection('seasonalPricing').doc(seasonId).get();
    const seasonData = seasonDoc.data();

    // After updating a season, regenerate price calendars if needed
    if (seasonData && seasonData.propertyId) {
      try {
        await updatePriceCalendarsForProperty(seasonData.propertyId, 3);
      } catch (calendarError) {
        console.error('[Server] Error updating price calendar:', calendarError);
        // Continue anyway since the status was updated successfully
      }
    }

    // Invalidate cached data
    revalidatePath('/admin/pricing');
    revalidatePath('/manage-pricing'); // Also revalidate non-admin path

    return { success: true };
  } catch (error) {
    console.error(`[Server] Error updating seasonal pricing ${seasonId}:`, error);
    throw new Error(`Failed to update seasonal pricing: ${error}`);
  }
}

/**
 * Create a new seasonal pricing rule
 *
 * @param formData The form data containing the seasonal pricing information
 */
export async function createSeasonalPricing(formData: FormData) {
  if (!isFirestoreAdminAvailable()) {
    console.error('[Server] Firebase Admin is not initialized');
    throw new Error('Firebase Admin is not initialized');
  }

  try {
    const propertyId = formData.get('propertyId') as string;
    const name = formData.get('name') as string;
    const seasonType = formData.get('seasonType') as 'minimum' | 'low' | 'standard' | 'medium' | 'high';
    const startDate = formData.get('startDate') as string;
    const endDate = formData.get('endDate') as string;
    const priceMultiplier = parseFloat(formData.get('priceMultiplier') as string);
    const minimumStay = parseInt(formData.get('minimumStay') as string, 10) || 1;

    const newSeason: Omit<SeasonalPricing, 'id'> = {
      propertyId,
      name,
      seasonType,
      startDate,
      endDate,
      priceMultiplier,
      minimumStay,
      enabled: true
    };

    const docRef = await dbAdmin.collection('seasonalPricing').add(newSeason);

    console.log(`[Server] Created new seasonal pricing ${docRef.id} for property ${propertyId}`);

    // After creating a new season, regenerate price calendars for the next few months
    try {
      await updatePriceCalendarsForProperty(propertyId, 3);
    } catch (calendarError) {
      console.error('[Server] Error updating price calendar:', calendarError);
      // Continue anyway since the season was created successfully
    }

    // Invalidate cached data
    revalidatePath('/admin/pricing');
    revalidatePath('/manage-pricing'); // Also revalidate non-admin path

    // Redirect back to the pricing page
    redirect(`/admin/pricing?propertyId=${propertyId}`);
  } catch (error) {
    console.error('[Server] Error creating seasonal pricing:', error);
    throw new Error(`Failed to create seasonal pricing: ${error}`);
  }
}

// Update a seasonal pricing rule
export async function updateSeasonalPricing(id: string, season: Partial<SeasonalPricing>) {
  if (!isFirestoreAdminAvailable()) {
    console.error('[Server] Firebase Admin is not initialized');
    return { success: false, error: 'Firebase Admin is not initialized' };
  }

  try {
    await dbAdmin.collection('seasonalPricing').doc(id).update(season);

    // Get the full season data to find the property ID
    const seasonDoc = await dbAdmin.collection('seasonalPricing').doc(id).get();
    const seasonData = seasonDoc.data();

    // After updating a season, regenerate price calendars
    if (seasonData && seasonData.propertyId) {
      try {
        await updatePriceCalendarsForProperty(seasonData.propertyId, 3);
      } catch (calendarError) {
        console.error('[Server] Error updating price calendar:', calendarError);
        // Continue anyway since the status was updated successfully
      }
    }

    revalidatePath(`/admin/pricing`);
    revalidatePath(`/manage-pricing`); // Also revalidate non-admin path

    return {
      success: true
    };
  } catch (error) {
    console.error('[Server] Error updating seasonal pricing:', error);
    return {
      success: false,
      error: 'Failed to update seasonal pricing'
    };
  }
}

// Delete a seasonal pricing rule
export async function deleteSeasonalPricing(id: string) {
  if (!isFirestoreAdminAvailable()) {
    console.error('[Server] Firebase Admin is not initialized');
    return { success: false, error: 'Firebase Admin is not initialized' };
  }

  try {
    // Get the season data to find the property ID before deleting
    const seasonDoc = await dbAdmin.collection('seasonalPricing').doc(id).get();
    const seasonData = seasonDoc.data();

    await dbAdmin.collection('seasonalPricing').doc(id).delete();

    // After deleting a season, regenerate price calendars
    if (seasonData && seasonData.propertyId) {
      try {
        await updatePriceCalendarsForProperty(seasonData.propertyId, 3);
      } catch (calendarError) {
        console.error('[Server] Error updating price calendar:', calendarError);
        // Continue anyway since the season was deleted successfully
      }
    }

    revalidatePath(`/admin/pricing`);
    revalidatePath(`/manage-pricing`); // Also revalidate non-admin path

    return {
      success: true
    };
  } catch (error) {
    console.error('[Server] Error deleting seasonal pricing:', error);
    return {
      success: false,
      error: 'Failed to delete seasonal pricing'
    };
  }
}

// Get date overrides for a property
export async function getDateOverrides(propertyId: string) {
  if (!isFirestoreAdminAvailable()) {
    console.error('[Server] Firebase Admin is not initialized');
    return { success: false, error: 'Firebase Admin is not initialized' };
  }

  try {
    const snapshot = await dbAdmin.collection('dateOverrides')
      .where('propertyId', '==', propertyId)
      .orderBy('date')
      .get();

    return {
      success: true,
      overrides: snapshot.docs.map(doc => {
        return { id: doc.id, ...doc.data() } as DateOverride;
      })
    };
  } catch (error) {
    console.error('[Server] Error fetching date overrides:', error);
    return {
      success: false,
      error: 'Failed to fetch date overrides'
    };
  }
}

// Create a new date override
export async function createDateOverride(override: Omit<DateOverride, 'id'>) {
  if (!isFirestoreAdminAvailable()) {
    console.error('[Server] Firebase Admin is not initialized');
    return { success: false, error: 'Firebase Admin is not initialized' };
  }

  try {
    const newOverride = {
      ...override,
      available: override.available !== false, // Default to true
      flatRate: override.flatRate || false
    };

    const docRef = await dbAdmin.collection('dateOverrides').add(newOverride);

    // After creating a date override, regenerate price calendar for that month
    const date = new Date(override.date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    // Get the price calendar document ID
    const monthStr = month.toString().padStart(2, '0');
    const calendarId = `${override.propertyId}_${year}-${monthStr}`;

    // Check if calendar exists first
    const calendarDoc = await dbAdmin.collection('priceCalendar').doc(calendarId).get();

    if (calendarDoc.exists) {
      // Update just this one calendar instead of all months
      try {
        await updatePriceCalendarsForProperty(override.propertyId, 1);
      } catch (calendarError) {
        console.error('[Server] Error updating price calendar:', calendarError);
        // Continue anyway since the override was created successfully
      }
    }

    revalidatePath(`/admin/pricing`);
    revalidatePath(`/manage-pricing`); // Also revalidate non-admin path

    return {
      success: true,
      id: docRef.id
    };
  } catch (error) {
    console.error('[Server] Error creating date override:', error);
    return {
      success: false,
      error: 'Failed to create date override'
    };
  }
}

// Update a date override
export async function updateDateOverride(id: string, override: Partial<DateOverride>) {
  if (!isFirestoreAdminAvailable()) {
    console.error('[Server] Firebase Admin is not initialized');
    return { success: false, error: 'Firebase Admin is not initialized' };
  }

  try {
    await dbAdmin.collection('dateOverrides').doc(id).update(override);

    // Get the full override data to find property and date info
    const overrideDoc = await dbAdmin.collection('dateOverrides').doc(id).get();
    const overrideData = overrideDoc.data();

    // Update affected calendar
    if (overrideData && overrideData.propertyId && overrideData.date) {
      const date = new Date(overrideData.date);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      // Get the price calendar document ID
      const monthStr = month.toString().padStart(2, '0');
      const calendarId = `${overrideData.propertyId}_${year}-${monthStr}`;

      // Check if calendar exists first
      const calendarDoc = await dbAdmin.collection('priceCalendar').doc(calendarId).get();

      if (calendarDoc.exists) {
        // Update just this one calendar instead of all months
        try {
          await updatePriceCalendarsForProperty(overrideData.propertyId, 1);
        } catch (calendarError) {
          console.error('[Server] Error updating price calendar:', calendarError);
          // Continue anyway since the override was updated successfully
        }
      }
    }

    revalidatePath(`/admin/pricing`);
    revalidatePath(`/manage-pricing`); // Also revalidate non-admin path

    return {
      success: true
    };
  } catch (error) {
    console.error('[Server] Error updating date override:', error);
    return {
      success: false,
      error: 'Failed to update date override'
    };
  }
}

// Delete a date override
export async function deleteDateOverride(id: string) {
  if (!isFirestoreAdminAvailable()) {
    console.error('[Server] Firebase Admin is not initialized');
    return { success: false, error: 'Firebase Admin is not initialized' };
  }

  try {
    // Get the override data to find property and date info before deleting
    const overrideDoc = await dbAdmin.collection('dateOverrides').doc(id).get();
    const overrideData = overrideDoc.data();

    await dbAdmin.collection('dateOverrides').doc(id).delete();

    // Update affected calendar
    if (overrideData && overrideData.propertyId && overrideData.date) {
      const date = new Date(overrideData.date);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      // Get the price calendar document ID
      const monthStr = month.toString().padStart(2, '0');
      const calendarId = `${overrideData.propertyId}_${year}-${monthStr}`;

      // Check if calendar exists first
      const calendarDoc = await dbAdmin.collection('priceCalendar').doc(calendarId).get();

      if (calendarDoc.exists) {
        // Update just this one calendar instead of all months
        try {
          await updatePriceCalendarsForProperty(overrideData.propertyId, 1);
        } catch (calendarError) {
          console.error('[Server] Error updating price calendar:', calendarError);
          // Continue anyway since the override was deleted successfully
        }
      }
    }

    revalidatePath(`/admin/pricing`);
    revalidatePath(`/manage-pricing`); // Also revalidate non-admin path

    return {
      success: true
    };
  } catch (error) {
    console.error('[Server] Error deleting date override:', error);
    return {
      success: false,
      error: 'Failed to delete date override'
    };
  }
}

// Get price calendars for a property
export async function getPriceCalendars(propertyId: string) {
  if (!isFirestoreAdminAvailable()) {
    console.error('[Server] Firebase Admin is not initialized');
    return { success: false, error: 'Firebase Admin is not initialized' };
  }

  try {
    const snapshot = await dbAdmin.collection('priceCalendar')
      .where('propertyId', '==', propertyId)
      .orderBy('month')
      .limit(12) // Get up to 12 months
      .get();

    return {
      success: true,
      calendars: snapshot.docs.map(doc => {
        return doc.data() as PriceCalendar;
      })
    };
  } catch (error) {
    console.error('[Server] Error fetching price calendars:', error);
    return {
      success: false,
      error: 'Failed to fetch price calendars'
    };
  }
}

/**
 * Generate price calendars for a property
 *
 * @param propertyId The ID of the property
 */
export async function generatePriceCalendar(propertyId: string) {
  if (!isFirestoreAdminAvailable()) {
    console.error('[Server] Firebase Admin is not initialized');
    return { success: false, error: 'Firebase Admin is not initialized' };
  }

  try {
    console.log(`[Server] Generating price calendars for property ${propertyId}`);

    const months = 12; // Generate 12 months by default
    await updatePriceCalendarsForProperty(propertyId, months);

    // Invalidate cached data
    revalidatePath('/admin/pricing');
    revalidatePath('/manage-pricing'); // Also revalidate non-admin path

    return { success: true, months };
  } catch (error) {
    console.error(`[Server] Error generating price calendars for property ${propertyId}:`, error);
    return { success: false, error: `Failed to generate price calendars: ${error}` };
  }
}

/**
 * Toggle a date override's availability status
 *
 * @param dateOverrideId The ID of the date override
 * @param available The new availability status
 */
export async function toggleDateOverrideAvailability(dateOverrideId: string, available: boolean) {
  if (!isFirestoreAdminAvailable()) {
    console.error('[Server] Firebase Admin is not initialized');
    throw new Error('Firebase Admin is not initialized');
  }

  try {
    await dbAdmin.collection('dateOverrides').doc(dateOverrideId).update({
      available: available
    });

    console.log(`[Server] Updated date override ${dateOverrideId} availability to ${available}`);

    // Get the override data to find property info
    const overrideDoc = await dbAdmin.collection('dateOverrides').doc(dateOverrideId).get();
    const overrideData = overrideDoc.data();

    // After updating an override, regenerate price calendar if needed
    if (overrideData && overrideData.propertyId && overrideData.date) {
      const date = new Date(overrideData.date);

      try {
        await updatePriceCalendarsForProperty(overrideData.propertyId, 1);
      } catch (calendarError) {
        console.error('[Server] Error updating price calendar:', calendarError);
        // Continue anyway since the override was updated successfully
      }
    }

    // Invalidate cached data
    revalidatePath('/admin/pricing');
    revalidatePath('/manage-pricing'); // Also revalidate non-admin path

    return { success: true };
  } catch (error) {
    console.error(`[Server] Error updating date override ${dateOverrideId}:`, error);
    throw new Error(`Failed to update date override: ${error}`);
  }
}