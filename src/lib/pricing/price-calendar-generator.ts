import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// The db instance will be passed as a parameter to functions that need it
import { 
  PropertyPricing, 
  SeasonalPricing, 
  DateOverride, 
  MinimumStayRule, 
  PriceCalendarDay, 
  calculateDayPrice 
} from './price-calculation';

// Import schemas
import {
  PriceCalendar,
  PriceCalendarSummary
} from './pricing-schemas';

/**
 * Fetches a property document by ID
 */
export async function getProperty(propertyId: string, db: admin.firestore.Firestore): Promise<PropertyPricing> {
  // Check if db is provided
  if (!db) {
    console.error('Firestore instance not provided');
    throw new Error('Firestore instance not provided');
  }

  const doc = await db.collection('properties').doc(propertyId).get();

  if (!doc.exists) {
    throw new Error(`Property ${propertyId} not found`);
  }

  const data = doc.data();

  return {
    id: doc.id,
    pricePerNight: data.pricePerNight || 0,
    baseCurrency: data.baseCurrency || 'USD',
    baseOccupancy: data.baseOccupancy || 2,
    extraGuestFee: data.extraGuestFee || 0,
    maxGuests: data.maxGuests || 10,
    pricingConfig: data.pricingConfig || {
      weekendAdjustment: 1.2,
      weekendDays: ['friday', 'saturday'],
      lengthOfStayDiscounts: []
    }
  };
}

/**
 * Fetches seasonal pricing records for a property
 */
export async function getSeasonalPricing(propertyId: string): Promise<SeasonalPricing[]> {
  // Check if Firebase Admin is properly initialized
  if (!db) {
    console.error('Firebase Admin is not properly initialized.');
    throw new Error('Firebase Admin is not properly initialized');
  }

  const snapshot = await db.collection('seasonalPricing')
    .where('propertyId', '==', propertyId)
    .where('enabled', '==', true)
    .get();

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      propertyId: data.propertyId,
      name: data.name,
      seasonType: data.seasonType,
      startDate: data.startDate,
      endDate: data.endDate,
      priceMultiplier: data.priceMultiplier,
      minimumStay: data.minimumStay,
      enabled: data.enabled
    };
  });
}

/**
 * Fetches date overrides for a specific month
 */
export async function getDateOverrides(
  propertyId: string,
  year: number,
  month: number
): Promise<DateOverride[]> {
  // Check if Firebase Admin is properly initialized
  if (!db) {
    console.error('Firebase Admin is not properly initialized.');
    throw new Error('Firebase Admin is not properly initialized');
  }

  // Create date range for the month
  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;

  const snapshot = await db.collection('dateOverrides')
    .where('propertyId', '==', propertyId)
    .where('date', '>=', startDate)
    .where('date', '<', endDate)
    .get();

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      propertyId: data.propertyId,
      date: data.date,
      customPrice: data.customPrice,
      reason: data.reason,
      minimumStay: data.minimumStay,
      available: data.available !== false, // Default to true if not specified
      flatRate: data.flatRate || false
    };
  });
}

/**
 * Fetches minimum stay rules for a property
 */
export async function getMinimumStayRules(propertyId: string): Promise<MinimumStayRule[]> {
  // Check if Firebase Admin is properly initialized
  if (!db) {
    console.error('Firebase Admin is not properly initialized.');
    throw new Error('Firebase Admin is not properly initialized');
  }

  const snapshot = await db.collection('minimumStayRules')
    .where('propertyId', '==', propertyId)
    .where('enabled', '==', true)
    .get();

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      propertyId: data.propertyId,
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      minimumStay: data.minimumStay,
      enabled: data.enabled
    };
  });
}

/**
 * Checks if a date is booked based on existing bookings
 */
export async function getBookedDates(
  propertyId: string,
  year: number,
  month: number
): Promise<string[]> {
  // Check if Firebase Admin is properly initialized
  if (!db) {
    console.error('Firebase Admin is not properly initialized.');
    throw new Error('Firebase Admin is not properly initialized');
  }

  // Create date range for the month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of the month

  // Get bookings that overlap with this month
  const snapshot = await db.collection('bookings')
    .where('propertyId', '==', propertyId)
    .where('status', 'in', ['confirmed', 'on-hold'])
    .where('checkInDate', '<=', Timestamp.fromDate(endDate)) // Starts before or on month end
    .where('checkOutDate', '>=', Timestamp.fromDate(startDate)) // Ends on or after month start
    .get();

  // Collect all booked dates in this month
  const bookedDates = new Set<string>();

  for (const doc of snapshot.docs) {
    const booking = doc.data();

    // Convert Timestamps to Dates
    const checkInDate = booking.checkInDate.toDate();
    const checkOutDate = booking.checkOutDate.toDate();

    // Iterate through each day of the booking (excluding checkout day)
    let currentDate = new Date(Math.max(startDate.getTime(), checkInDate.getTime()));
    const bookingEndDate = new Date(Math.min(endDate.getTime(), checkOutDate.getTime()));

    while (currentDate < bookingEndDate) {
      // Add to booked dates set
      bookedDates.add(currentDate.toISOString().split('T')[0]);
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  return Array.from(bookedDates);
}

/**
 * Generates a price calendar document for a specific property and month
 */
export async function generatePriceCalendar(
  propertyId: string,
  year: number,
  month: number
): Promise<PriceCalendar> {
  // 1. Fetch all required data
  const property = await getProperty(propertyId);
  const seasonalPricing = await getSeasonalPricing(propertyId);
  const dateOverrides = await getDateOverrides(propertyId, year, month);
  const minimumStayRules = await getMinimumStayRules(propertyId);
  const bookedDates = await getBookedDates(propertyId, year, month);
  
  // 2. Calculate the calendar days
  const days: Record<string, PriceCalendarDay> = {};
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // Statistics tracking
  let minPrice = Infinity;
  let maxPrice = 0;
  let totalPrice = 0;
  let unavailableDays = 0;
  let modifiedDays = 0;
  let hasCustomPrices = false;
  let hasSeasonalRates = false;
  
  // Convert booked dates to Set for faster lookups
  const bookedDatesSet = new Set(bookedDates);
  
  // Process each day in the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dateStr = date.toISOString().split('T')[0];
    
    // Calculate price based on all rules
    const dayPrice = calculateDayPrice(
      property,
      date,
      seasonalPricing,
      dateOverrides,
      minimumStayRules
    );
    
    // Override availability if date is booked
    if (bookedDatesSet.has(dateStr)) {
      dayPrice.available = false;
    }
    
    // Update statistics
    if (!dayPrice.available) {
      unavailableDays++;
    }
    
    if (dayPrice.priceSource !== 'base') {
      modifiedDays++;
    }
    
    if (dayPrice.priceSource === 'override') {
      hasCustomPrices = true;
    }
    
    if (dayPrice.priceSource === 'season') {
      hasSeasonalRates = true;
    }
    
    minPrice = Math.min(minPrice, dayPrice.baseOccupancyPrice);
    maxPrice = Math.max(maxPrice, dayPrice.baseOccupancyPrice);
    totalPrice += dayPrice.baseOccupancyPrice;
    
    // Add to days collection
    days[day.toString()] = dayPrice;
  }
  
  // If there are no days (shouldn't happen), fix min/max prices
  if (minPrice === Infinity) {
    minPrice = property.pricePerNight;
  }
  
  if (maxPrice === 0) {
    maxPrice = property.pricePerNight;
  }
  
  // 3. Create summary
  const summary: PriceCalendarSummary = {
    minPrice,
    maxPrice,
    avgPrice: daysInMonth > 0 ? totalPrice / daysInMonth : property.pricePerNight,
    unavailableDays,
    modifiedDays,
    hasCustomPrices,
    hasSeasonalRates
  };
  
  // 4. Create and return the calendar
  const monthStr = month.toString().padStart(2, '0');
  return {
    id: `${propertyId}_${year}-${monthStr}`,
    propertyId,
    month: `${year}-${monthStr}`,
    year,
    days,
    summary,
    generatedAt: Timestamp.now()
  };
}

/**
 * Saves a price calendar to Firestore
 */
export async function savePriceCalendar(calendar: PriceCalendar): Promise<void> {
  // Check if Firebase Admin is properly initialized
  if (!db) {
    console.error('Firebase Admin is not properly initialized.');
    throw new Error('Firebase Admin is not properly initialized');
  }

  await db.collection('priceCalendar').doc(calendar.id).set(calendar);
}

/**
 * Fetches a price calendar from Firestore
 */
export async function getPriceCalendar(
  propertyId: string,
  year: number,
  month: number
): Promise<PriceCalendar | null> {
  // Check if Firebase Admin is properly initialized
  if (!db) {
    console.error('Firebase Admin is not properly initialized.');
    throw new Error('Firebase Admin is not properly initialized');
  }

  const monthStr = month.toString().padStart(2, '0');
  const docId = `${propertyId}_${year}-${monthStr}`;

  const doc = await db.collection('priceCalendar').doc(docId).get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as PriceCalendar;
}

/**
 * Gets months between two dates
 */
export function getMonthsBetweenDates(startDate: Date, endDate: Date): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = [];
  
  const currentDate = new Date(startDate);
  currentDate.setDate(1); // Start at the beginning of the month
  
  const lastDate = new Date(endDate);
  lastDate.setDate(1); // Compare based on month start
  
  while (currentDate <= lastDate) {
    months.push({
      year: currentDate.getFullYear(),
      month: currentDate.getMonth() + 1
    });
    
    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  return months;
}

/**
 * Updates price calendars for a property for the next N months
 */
export async function updatePriceCalendarsForProperty(
  propertyId: string,
  numberOfMonths: number = 12
): Promise<void> {
  console.log(`Updating price calendars for property ${propertyId} for ${numberOfMonths} months`);
  
  const startDate = new Date();
  
  // Generate calendars for the specified number of months
  for (let monthOffset = 0; monthOffset < numberOfMonths; monthOffset++) {
    const targetDate = new Date(startDate);
    targetDate.setMonth(startDate.getMonth() + monthOffset);
    
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth() + 1;
    
    try {
      const calendar = await generatePriceCalendar(propertyId, targetYear, targetMonth);
      await savePriceCalendar(calendar);
      console.log(`Generated calendar for ${propertyId} - ${targetYear}-${targetMonth}`);
    } catch (error) {
      console.error(`Failed to generate calendar for ${propertyId} - ${targetYear}-${targetMonth}:`, error);
    }
  }
  
  console.log(`Completed updating price calendars for property ${propertyId}`);
}

/**
 * Updates price calendars for all active properties
 */
export async function updateAllPriceCalendars(numberOfMonths: number = 12): Promise<void> {
  console.log(`Starting price calendar update for all properties (${numberOfMonths} months)`);
  
  // Get all active properties
  const snapshot = await db.collection('properties')
    .where('status', '==', 'active')
    .get();
  
  console.log(`Found ${snapshot.size} active properties`);
  
  // Process each property
  for (const doc of snapshot.docs) {
    try {
      await updatePriceCalendarsForProperty(doc.id, numberOfMonths);
    } catch (error) {
      console.error(`Failed to update calendars for property ${doc.id}:`, error);
    }
  }
  
  console.log('Price calendar update completed');
}