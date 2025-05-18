import { getMonthsBetweenDates, generatePriceCalendar, savePriceCalendar } from './price-calendar-generator';

/**
 * Updates price calendars in response to pricing rule changes
 * This is used when property pricing, seasonal pricing, or date overrides change
 */
export async function handlePricingRuleChange(
  propertyId: string,
  startDate: Date,
  endDate: Date
): Promise<void> {
  console.log(`Updating price calendars for ${propertyId} from ${startDate.toISOString()} to ${endDate.toISOString()}`);
  
  // 1. Identify affected months
  const months = getMonthsBetweenDates(startDate, endDate);
  
  console.log(`Identified ${months.length} months to update`);
  
  // 2. Update each affected month
  for (const { year, month } of months) {
    try {
      const calendar = await generatePriceCalendar(propertyId, year, month);
      await savePriceCalendar(calendar);
      console.log(`Updated calendar for ${propertyId} - ${year}-${month} due to rule change`);
    } catch (error) {
      console.error(`Failed to update calendar for ${propertyId} - ${year}-${month}:`, error);
      // Continue with other months even if one fails
    }
  }
  
  console.log(`Completed updating calendars for ${propertyId}`);
}

/**
 * Updates price calendars in response to property pricing changes
 * This is used when base price, weekend adjustment, etc. change
 */
export async function handlePropertyPricingChange(
  propertyId: string,
  monthsToUpdate: number = 12
): Promise<void> {
  console.log(`Updating price calendars for ${propertyId} due to property pricing change`);
  
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setMonth(startDate.getMonth() + monthsToUpdate - 1);
  
  await handlePricingRuleChange(propertyId, startDate, endDate);
}

/**
 * Updates price calendars in response to booking status changes
 * This is used when bookings are created, modified, or cancelled
 */
export async function handleBookingStatusChange(
  propertyId: string,
  checkInDate: Date,
  checkOutDate: Date
): Promise<void> {
  console.log(`Updating price calendars for ${propertyId} due to booking change from ${checkInDate.toISOString()} to ${checkOutDate.toISOString()}`);
  
  await handlePricingRuleChange(propertyId, checkInDate, checkOutDate);
}

/**
 * Updates price calendars in response to seasonal pricing changes
 * This is used when seasons are created, modified, or deleted
 */
export async function handleSeasonalPricingChange(
  propertyId: string,
  seasonStartDate: Date,
  seasonEndDate: Date
): Promise<void> {
  console.log(`Updating price calendars for ${propertyId} due to seasonal pricing change from ${seasonStartDate.toISOString()} to ${seasonEndDate.toISOString()}`);
  
  await handlePricingRuleChange(propertyId, seasonStartDate, seasonEndDate);
}

/**
 * Updates price calendar for a specific date override
 * This is used when a date override is created, modified, or deleted
 */
export async function handleDateOverrideChange(
  propertyId: string,
  date: Date
): Promise<void> {
  console.log(`Updating price calendar for ${propertyId} due to date override change on ${date.toISOString()}`);
  
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  
  try {
    const calendar = await generatePriceCalendar(propertyId, year, month);
    await savePriceCalendar(calendar);
    console.log(`Updated calendar for ${propertyId} - ${year}-${month} due to date override change`);
  } catch (error) {
    console.error(`Failed to update calendar for ${propertyId} - ${year}-${month}:`, error);
    throw error;
  }
}