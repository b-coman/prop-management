#!/usr/bin/env npx tsx
/**
 * Regenerate price calendars using the new canonical pricing engine.
 *
 * This script:
 * 1. Connects to Firestore via Admin SDK
 * 2. Fetches property, seasons, overrides, min-stay rules, bookings
 * 3. Uses calculateDayPrice() from src/lib/pricing/price-calculation.ts
 * 4. Compares a sample of old vs new prices (dry-run)
 * 5. If --write flag is passed, saves new calendars to Firestore
 *
 * Usage:
 *   npx tsx -r tsconfig-paths/register scripts/regenerate-calendars-new-engine.ts          # dry-run
 *   npx tsx -r tsconfig-paths/register scripts/regenerate-calendars-new-engine.ts --write  # write to Firestore
 */

import { register } from 'tsconfig-paths';
import * as path from 'path';
import * as fs from 'fs';

// Register tsconfig paths so @/ imports work
register({
  baseUrl: path.resolve(__dirname, '..'),
  paths: { '@/*': ['./src/*'] }
});

import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import { format } from 'date-fns';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Initialize Firebase Admin
const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
let serviceAccount: any;

if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
  serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  console.error('No Firebase service account credentials found');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

// Import canonical pricing engine (after tsconfig-paths registration)
import { calculateDayPrice } from '@/lib/pricing/price-calculation';
import type { PropertyPricing, SeasonalPricing, DateOverride, MinimumStayRule } from '@/lib/pricing/price-calculation';

const PROPERTY_ID = process.argv.find(a => a.startsWith('--property='))?.split('=')[1] || 'prahova-mountain-chalet';
const WRITE_MODE = process.argv.includes('--write');
const MONTHS = 12;

function convertTimestamps(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj.toDate && typeof obj.toDate === 'function') return obj.toDate().toISOString();
  if (obj._seconds !== undefined) return new Date(obj._seconds * 1000).toISOString();
  if (Array.isArray(obj)) return obj.map(convertTimestamps);
  const result: any = {};
  for (const key of Object.keys(obj)) {
    result[key] = convertTimestamps(obj[key]);
  }
  return result;
}

async function run() {
  console.log('===========================================');
  console.log('  Price Calendar Regeneration');
  console.log(`  Property: ${PROPERTY_ID}`);
  console.log(`  Mode: ${WRITE_MODE ? 'WRITE (will save to Firestore)' : 'DRY RUN (compare only)'}`);
  console.log(`  Months: ${MONTHS}`);
  console.log('===========================================\n');

  // 1. Fetch property
  const propertyDoc = await db.collection('properties').doc(PROPERTY_ID).get();
  if (!propertyDoc.exists) {
    console.error(`Property ${PROPERTY_ID} not found`);
    process.exit(1);
  }
  const property = convertTimestamps(propertyDoc.data()!);

  const propertyPricing: PropertyPricing = {
    id: PROPERTY_ID,
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

  console.log('Property pricing config:');
  console.log(`  Base price: ${propertyPricing.pricePerNight} ${propertyPricing.baseCurrency}`);
  console.log(`  Base occupancy: ${propertyPricing.baseOccupancy}`);
  console.log(`  Extra guest fee: ${propertyPricing.extraGuestFee}`);
  console.log(`  Weekend adjustment: ${propertyPricing.pricingConfig?.weekendAdjustment}`);
  console.log(`  Weekend days: ${propertyPricing.pricingConfig?.weekendDays?.join(', ')}`);
  console.log(`  Used fallback: ${!property.pricingConfig}`);
  console.log('');

  // 2. Fetch seasonal pricing
  const seasonalSnapshot = await db.collection('seasonalPricing')
    .where('propertyId', '==', PROPERTY_ID)
    .where('enabled', '==', true)
    .get();
  const seasons: SeasonalPricing[] = seasonalSnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  })) as SeasonalPricing[];
  console.log(`  Active seasons: ${seasons.length}`);
  seasons.forEach(s => console.log(`    - ${s.name || s.id}: ${s.startDate} to ${s.endDate}, multiplier=${s.priceMultiplier}`));

  // 3. Fetch date overrides
  const overridesSnapshot = await db.collection('dateOverrides')
    .where('propertyId', '==', PROPERTY_ID)
    .get();
  const overrides: DateOverride[] = overridesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  })) as DateOverride[];
  console.log(`  Date overrides: ${overrides.length}`);
  overrides.forEach(o => console.log(`    - ${o.date}: price=${o.customPrice}, available=${o.available}`));

  // 4. Fetch minimum stay rules
  const minStaySnapshot = await db.collection('minimumStayRules')
    .where('propertyId', '==', PROPERTY_ID)
    .where('enabled', '==', true)
    .get();
  const minStayRules: MinimumStayRule[] = minStaySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  })) as MinimumStayRule[];
  console.log(`  Minimum stay rules: ${minStayRules.length}`);

  // 5. Fetch booked dates
  const bookingsSnapshot = await db.collection('bookings')
    .where('propertyId', '==', PROPERTY_ID)
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
      const cur = new Date(checkIn);
      while (cur < checkOut) {
        bookedDates.add(format(cur, 'yyyy-MM-dd'));
        cur.setDate(cur.getDate() + 1);
      }
    }
  });
  console.log(`  Booked dates: ${bookedDates.size}`);
  console.log('');

  // =========================================================================
  // DRY RUN: Compare old vs new for existing calendar months
  // =========================================================================
  console.log('--- Comparing old vs new calendars ---\n');

  let totalDifferences = 0;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  for (let i = 0; i < MONTHS; i++) {
    const targetDate = new Date(currentYear, currentMonth - 1 + i, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const monthStr = month.toString().padStart(2, '0');
    const calendarId = `${PROPERTY_ID}_${year}-${monthStr}`;

    // Fetch existing calendar
    const existingDoc = await db.collection('priceCalendars').doc(calendarId).get();
    const existing = existingDoc.exists ? existingDoc.data() : null;

    const daysInMonth = new Date(year, month, 0).getDate();
    const newDays: Record<string, any> = {};
    let monthDiffs = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayPrice = calculateDayPrice(propertyPricing, date, seasons, overrides, minStayRules);

      if (bookedDates.has(dateStr)) {
        dayPrice.available = false;
      }

      newDays[day.toString()] = dayPrice;

      // Compare with existing
      if (existing?.days?.[day.toString()]) {
        const old = existing.days[day.toString()];
        if (Math.abs((old.adjustedPrice || old.basePrice) - dayPrice.adjustedPrice) > 0.01) {
          if (monthDiffs < 5) { // Only show first 5 diffs per month
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            console.log(`  ${dateStr} (${dayNames[date.getDay()]}): OLD=${old.adjustedPrice || old.basePrice} -> NEW=${dayPrice.adjustedPrice} [${dayPrice.priceSource}]`);
          }
          monthDiffs++;
          totalDifferences++;
        }
      }
    }

    // Summary stats
    const dayValues = Object.values(newDays);
    const availableDays = dayValues.filter((d: any) => d.available);
    const defaultBasePrice = propertyPricing.pricePerNight;

    const minPrice = availableDays.length > 0
      ? Math.min(...availableDays.map((d: any) => d.adjustedPrice))
      : defaultBasePrice;
    const maxPrice = availableDays.length > 0
      ? Math.max(...availableDays.map((d: any) => d.adjustedPrice))
      : defaultBasePrice;

    const status = existing ? (monthDiffs > 0 ? `${monthDiffs} differences` : 'identical') : 'NEW';
    console.log(`  ${year}-${monthStr}: min=${minPrice}, max=${maxPrice} [${status}]`);
  }

  console.log(`\nTotal price differences: ${totalDifferences}`);

  // =========================================================================
  // WRITE MODE: Save new calendars to Firestore
  // =========================================================================
  if (!WRITE_MODE) {
    console.log('\nDry run complete. To write calendars, run with --write flag.\n');
    return;
  }

  console.log('\n--- Writing new calendars to Firestore ---\n');

  for (let i = 0; i < MONTHS; i++) {
    const targetDate = new Date(currentYear, currentMonth - 1 + i, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const monthStr = month.toString().padStart(2, '0');
    const daysInMonth = new Date(year, month, 0).getDate();
    const days: Record<string, any> = {};

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayPrice = calculateDayPrice(propertyPricing, date, seasons, overrides, minStayRules);

      if (bookedDates.has(dateStr)) {
        dayPrice.available = false;
      }

      days[day.toString()] = dayPrice;
    }

    // Calculate summary statistics
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

    const calendarId = `${PROPERTY_ID}_${year}-${monthStr}`;
    const calendar = {
      id: calendarId,
      propertyId: PROPERTY_ID,
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
    console.log(`  Saved ${calendarId} (min=${minPrice}, max=${maxPrice})`);
  }

  console.log('\nCalendar regeneration complete!\n');
}

run().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
