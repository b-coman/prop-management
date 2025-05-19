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
    },
    cleaningFee: data.cleaningFee || 0,
    avgOccupancyAdjustments: data.avgOccupancyAdjustments || {},
    pricingTemplate: data.pricingTemplate
  };
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
  
  const doc = await db.collection('priceCalendar').doc(docId).get();
  if (!doc.exists) {
    return null;
  }
  
  return doc.data() as PriceCalendar;
}