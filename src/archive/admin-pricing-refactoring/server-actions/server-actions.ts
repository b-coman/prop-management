'use server';

import { revalidatePath } from 'next/cache';
import {
  toggleSeasonalPricingStatus as toggleSeason,
  toggleDateOverrideAvailability as toggleOverride,
  generatePriceCalendar as generateCalendar
} from '@/lib/firebaseAdminNew';

// Server action for toggling seasonal pricing status
export async function toggleSeasonalPricingStatus(seasonId: string, enabled: boolean) {
  const result = await toggleSeason(seasonId, enabled);
  
  // Revalidate paths to refresh data
  if (result.success) {
    revalidatePath('/admin/pricing');
  }
  
  return result;
}

// Server action for toggling date override availability
export async function toggleDateOverrideAvailability(dateOverrideId: string, available: boolean) {
  const result = await toggleOverride(dateOverrideId, available);
  
  // Revalidate paths to refresh data
  if (result.success) {
    revalidatePath('/admin/pricing');
  }
  
  return result;
}

// Server action for generating price calendars
export async function generatePriceCalendar(propertyId: string) {
  const result = await generateCalendar(propertyId);
  
  // Revalidate paths to refresh data
  if (result.success) {
    revalidatePath('/admin/pricing');
  }
  
  return result;
}