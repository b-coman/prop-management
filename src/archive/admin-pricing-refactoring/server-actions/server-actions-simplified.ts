'use server';

import { revalidatePath } from 'next/cache';
import {
  isFirestoreAdminAvailable as checkFirestore,
  toggleSeasonalPricingStatus as toggleSeason,
  toggleDateOverrideAvailability as toggleOverride,
  generatePriceCalendar as generateCalendar
} from '@/lib/firebaseAdminBasic';

/**
 * Toggle seasonal pricing status - simplified implementation
 * that uses our new Firebase Admin functions
 */
export async function toggleSeasonalPricingStatus(seasonId: string, enabled: boolean) {
  try {
    const available = await checkFirestore();
    if (!available) {
      console.error('[Server] Firebase Admin is not initialized');
      return { success: false, error: 'Firebase Admin is not initialized' };
    }

    const result = await toggleSeason(seasonId, enabled);
    
    // Revalidate paths to refresh data
    if (result.success) {
      revalidatePath('/admin/pricing');
      revalidatePath('/manage-pricing');
    }
    
    return result;
  } catch (error) {
    console.error(`[Server] Error toggling seasonal pricing ${seasonId}:`, error);
    return { success: false, error: `Failed to toggle seasonal pricing: ${error}` };
  }
}

/**
 * Toggle date override availability - simplified implementation
 * that uses our new Firebase Admin functions
 */
export async function toggleDateOverrideAvailability(dateOverrideId: string, available: boolean) {
  try {
    const isAvailable = await checkFirestore();
    if (!isAvailable) {
      console.error('[Server] Firebase Admin is not initialized');
      return { success: false, error: 'Firebase Admin is not initialized' };
    }

    const result = await toggleOverride(dateOverrideId, available);
    
    // Revalidate paths to refresh data
    if (result.success) {
      revalidatePath('/admin/pricing');
      revalidatePath('/manage-pricing');
    }
    
    return result;
  } catch (error) {
    console.error(`[Server] Error toggling date override ${dateOverrideId}:`, error);
    return { success: false, error: `Failed to toggle date override: ${error}` };
  }
}

/**
 * Generate price calendar - simplified implementation
 * that uses our new Firebase Admin functions
 */
export async function generatePriceCalendar(propertyId: string) {
  try {
    const available = await checkFirestore();
    if (!available) {
      console.error('[Server] Firebase Admin is not initialized');
      return { success: false, error: 'Firebase Admin is not initialized' };
    }

    const result = await generateCalendar(propertyId);
    
    // Revalidate paths to refresh data
    if (result.success) {
      revalidatePath('/admin/pricing');
      revalidatePath('/manage-pricing');
    }
    
    return result;
  } catch (error) {
    console.error(`[Server] Error generating price calendar for ${propertyId}:`, error);
    return { success: false, error: `Failed to generate price calendar: ${error}` };
  }
}