// Client-side wrapper for server actions
// This file allows client components to import and use server actions

// Re-export functions from the server-actions file which has 'use server' directive
export {
  toggleSeasonalPricingStatus,
  toggleDateOverrideAvailability,
  generatePriceCalendar
} from './server-actions-client';