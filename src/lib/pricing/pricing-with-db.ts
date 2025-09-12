// Wrapper functions for pricing operations that ensure proper DB initialization
import * as admin from 'firebase-admin';
import { getFirestoreForPricing } from '@/lib/firebaseAdminPricing';
import { PropertyPricing } from './price-calculation';
import { PriceCalendar } from './pricing-schemas';

/**
 * Gets a property with proper DB initialization
 */
export async function getPropertyWithDb(propertyId: string): Promise<PropertyPricing> {
  const db = await getFirestoreForPricing();
  if (!db) {
    throw new Error('Database connection unavailable');
  }

  const doc = await db.collection('properties').doc(propertyId).get();
  if (!doc.exists) {
    throw new Error(`Property ${propertyId} not found`);
  }

  const data = doc.data()!;
  
  const property = {
    id: doc.id,
    pricePerNight: data.pricePerNight || 0,
    baseCurrency: data.baseCurrency || 'USD',
    baseOccupancy: data.baseOccupancy || 2,
    extraGuestFee: data.extraGuestFee || 0,
    maxGuests: data.maxGuests || 10,
    defaultMinimumStay: data.defaultMinimumStay || 1,
    pricingConfig: data.pricingConfig || {
      weekendAdjustment: 1.2,
      weekendDays: ['friday', 'saturday'],
      lengthOfStayDiscounts: []
    },
    cleaningFee: data.cleaningFee || 0,
    avgOccupancyAdjustments: data.avgOccupancyAdjustments || {},
    pricingTemplate: data.pricingTemplate
  };
  
  // Add a debug log to see the property data
  console.log(`[pricing-with-db] 🏠 Retrieved property ${propertyId} from Firestore:`, {
    id: property.id,
    pricePerNight: property.pricePerNight,
    baseCurrency: property.baseCurrency,
    baseOccupancy: property.baseOccupancy,
    extraGuestFee: property.extraGuestFee,
    maxGuests: property.maxGuests,
    defaultMinimumStay: property.defaultMinimumStay,
    cleaningFee: property.cleaningFee,
    rawExtraGuestFee: data.extraGuestFee, // Raw value from Firestore
    rawBaseOccupancy: data.baseOccupancy, // Raw value from Firestore
    rawDefaultMinimumStay: data.defaultMinimumStay, // Raw value from Firestore
    pricing: data.pricing // Check if this contains any relevant info
  });
  
  return property;
}

/**
 * Gets a price calendar with proper DB initialization
 */
export async function getPriceCalendarWithDb(propertyId: string, year: number, month: number): Promise<PriceCalendar | null> {
  const db = await getFirestoreForPricing();
  if (!db) {
    throw new Error('Database connection unavailable');
  }

  const monthStr = month.toString().padStart(2, '0');
  const docId = `${propertyId}_${year}-${monthStr}`;
  
  const doc = await db.collection('priceCalendars').doc(docId).get();
  if (!doc.exists) {
    return null;
  }
  
  const calendarData = doc.data() as PriceCalendar;
  
  // Log a sample of the price calendar data
  const dayKeys = Object.keys(calendarData.days || {});
  
  if (dayKeys.length > 0) {
    const sampleDay = calendarData.days[dayKeys[0]];
    console.log(`[pricing-with-db] 📅 Price calendar sample for ${propertyId}, ${year}-${month}:`, {
      id: doc.id,
      year: calendarData.year,
      month: calendarData.month,
      totalDays: dayKeys.length,
      sampleDayNumber: dayKeys[0],
      sampleDay: {
        baseOccupancyPrice: sampleDay.basePrice,
        hasPrices: !!sampleDay.prices,
        prices: sampleDay.prices,
        available: sampleDay.available,
        priceSource: sampleDay.priceSource
      }
    });
  } else {
    console.log(`[pricing-with-db] ⚠️ Price calendar for ${propertyId}, ${year}-${month} has no days defined.`);
  }
  
  return calendarData;
}