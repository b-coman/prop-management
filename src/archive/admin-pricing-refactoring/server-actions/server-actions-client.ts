'use server';

import { revalidatePath } from 'next/cache';
import { 
  isFirestoreAvailable, 
  toggleSeasonalPricingStatus as toggleSeason,
  toggleDateOverrideAvailability as toggleOverride,
  generatePriceCalendar as generateCalendar 
} from '@/lib/firebaseClientAdmin';

/**
 * Toggle seasonal pricing status - client SDK implementation
 */
export async function toggleSeasonalPricingStatus(seasonId: string, enabled: boolean) {
  try {
    const available = isFirestoreAvailable();
    if (!available) {
      console.error('[Server] Firebase Client SDK is not initialized');
      return { success: false, error: 'Firebase Client SDK is not initialized' };
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
 * Toggle date override availability - client SDK implementation
 */
export async function toggleDateOverrideAvailability(dateOverrideId: string, available: boolean) {
  try {
    const isAvailable = isFirestoreAvailable();
    if (!isAvailable) {
      console.error('[Server] Firebase Client SDK is not initialized');
      return { success: false, error: 'Firebase Client SDK is not initialized' };
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
 * Generate price calendar - client SDK implementation
 */
export async function generatePriceCalendar(propertyId: string) {
  try {
    const available = isFirestoreAvailable();
    if (!available) {
      console.error('[Server] Firebase Client SDK is not initialized');
      return { success: false, error: 'Firebase Client SDK is not initialized' };
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