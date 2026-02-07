#!/usr/bin/env npx tsx
/**
 * Set up 2026 pricing for prahova-mountain-chalet based on the owner's Excel pricing plan.
 *
 * This script:
 * 1. Updates the property base config (pricePerNight, weekendAdjustment, cleaningFee)
 * 2. Creates seasonal pricing rules for 2026 (demand tiers mapped to multipliers)
 * 3. Creates date overrides for holiday flat rates (Christmas, NY)
 * 4. Optionally regenerates price calendars
 *
 * Price level: Airbnb net + 10% (middle ground between Airbnb net and Booking.com gross)
 *
 * Usage:
 *   npx tsx -r tsconfig-paths/register scripts/setup-2026-pricing.ts          # dry-run
 *   npx tsx -r tsconfig-paths/register scripts/setup-2026-pricing.ts --write  # write to Firestore
 */

import { register } from 'tsconfig-paths';
import * as path from 'path';
import * as fs from 'fs';

register({
  baseUrl: path.resolve(__dirname, '..'),
  paths: { '@/*': ['./src/*'] }
});

import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import { format } from 'date-fns';

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
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

import { calculateDayPrice } from '@/lib/pricing/price-calculation';
import type { PropertyPricing, SeasonalPricing, DateOverride, MinimumStayRule } from '@/lib/pricing/price-calculation';

const PROPERTY_ID = 'prahova-mountain-chalet';
const WRITE_MODE = process.argv.includes('--write');
const SKIP_CALENDARS = process.argv.includes('--skip-calendars');

// ============================================================================
// PRICING CONFIGURATION
// ============================================================================

// Airbnb net base prices (2026 updated)
const AIRBNB_WEEKDAY_BASE = 475;
const AIRBNB_WEEKEND_BASE = 625;
const RENTALSPOT_MARKUP = 1.10; // +10% over Airbnb net

// RentalSpot prices
const RENTALSPOT_WEEKDAY = Math.round(AIRBNB_WEEKDAY_BASE * RENTALSPOT_MARKUP); // 523
const RENTALSPOT_WEEKEND = Math.round(AIRBNB_WEEKEND_BASE * RENTALSPOT_MARKUP); // 688
const WEEKEND_MULTIPLIER = parseFloat((RENTALSPOT_WEEKEND / RENTALSPOT_WEEKDAY).toFixed(4)); // 1.3155

// Holiday price scale factor (from 2025 Airbnb base 445 to 2026 RentalSpot)
const HOLIDAY_SCALE = RENTALSPOT_WEEKDAY / 445; // ~1.175

const CLEANING_FEE = 200;

// ============================================================================
// 2026 SEASONAL PERIODS
// Based on 2025 CSV pattern with 2026 Romanian holiday calendar:
//   - Orthodox Easter: April 12 (Good Friday Apr 10, Easter Monday Apr 13)
//   - Pentecost (Rusalii): May 31 (Sun) + Jun 1 (Mon)
//   - Jan 24 (Union Day): Saturday → Fri-Mon long weekend
//   - May 1 (Labor Day): Friday
//   - Nov 30 (St. Andrew): Monday
//   - Dec 1 (National Day): Tuesday (bridges with Nov 30)
//   - Dec 25-26 (Christmas): Friday-Saturday
//
// Demand tiers: min=0.8, low=0.9, base=1.0, medium=1.1, high=1.2, max=1.3
// "base" periods don't need seasonal rules (base price applies automatically)
// ============================================================================

interface SeasonDef {
  name: string;
  startDate: string;
  endDate: string;
  priceMultiplier: number;
  minimumStay: number;
  seasonType: string;
}

const SEASONS_2026: SeasonDef[] = [
  // --- JANUARY ---
  // Jan 1-7: school winter break tail → base (no rule needed)
  // Jan 8-22: post-holiday low season
  { name: 'Low Demand Jan', startDate: '2026-01-08', endDate: '2026-01-22',
    priceMultiplier: 0.9, minimumStay: 1, seasonType: 'low' },
  // Jan 23-26: Union Day long weekend (Jan 24 = Saturday)
  { name: 'Ziua Unirii', startDate: '2026-01-23', endDate: '2026-01-26',
    priceMultiplier: 1.1, minimumStay: 2, seasonType: 'medium' },
  // Jan 27 - Feb 6: post-holiday low
  { name: 'Low Demand Late Jan', startDate: '2026-01-27', endDate: '2026-02-06',
    priceMultiplier: 0.9, minimumStay: 1, seasonType: 'low' },

  // --- FEBRUARY / MARCH ---
  // Feb 7 - Mar 1: school mid-term break (ski week varies by county, Feb 9 - Mar 1)
  // → base (no rule needed)
  // Mar 2-8: Women's Day week (Mar 8 = Sunday)
  // → base (no rule needed)
  // Mar 9 - Apr 9: early spring low season
  { name: 'Early Spring', startDate: '2026-03-09', endDate: '2026-04-09',
    priceMultiplier: 0.9, minimumStay: 1, seasonType: 'low' },

  // --- APRIL (EASTER) ---
  // Apr 10-20: Easter school break (Good Friday Apr 10, Easter Apr 12-13)
  { name: 'Vacanta Paste', startDate: '2026-04-10', endDate: '2026-04-20',
    priceMultiplier: 1.1, minimumStay: 2, seasonType: 'medium' },
  // Apr 21-30: post-Easter → base (no rule)

  // --- MAY ---
  // May 1-3: Labor Day (May 1 = Friday, Fri-Sun)
  { name: '1 Mai', startDate: '2026-05-01', endDate: '2026-05-03',
    priceMultiplier: 1.2, minimumStay: 2, seasonType: 'high' },
  // May 4-28: late spring → base (no rule)
  // May 29 - Jun 1: Pentecost + Children's Day (Fri-Mon long weekend)
  { name: 'Rusalii + 1 Iunie', startDate: '2026-05-29', endDate: '2026-06-01',
    priceMultiplier: 1.2, minimumStay: 2, seasonType: 'high' },

  // --- SUMMER ---
  // Jun 2-19: early summer → base (no rule)
  // Jun 20 - Aug 31: main summer season (school summer holiday starts Jun 20)
  { name: 'Summer', startDate: '2026-06-20', endDate: '2026-08-31',
    priceMultiplier: 1.2, minimumStay: 2, seasonType: 'high' },

  // --- FALL ---
  // Sep 1-8: early fall → base (no rule)
  // Sep 9 - Oct 23: autumn low season
  { name: 'Fall', startDate: '2026-09-09', endDate: '2026-10-23',
    priceMultiplier: 0.9, minimumStay: 1, seasonType: 'low' },
  // Oct 24 - Nov 1: autumn school break
  { name: 'Vacanta Toamna', startDate: '2026-10-24', endDate: '2026-11-01',
    priceMultiplier: 1.1, minimumStay: 2, seasonType: 'medium' },
  // Nov 2-27: late fall minimum demand
  { name: 'Late Fall', startDate: '2026-11-02', endDate: '2026-11-27',
    priceMultiplier: 0.8, minimumStay: 1, seasonType: 'minimum' },

  // --- DECEMBER ---
  // Nov 28 - Dec 1: St. Andrew (Mon Nov 30) + National Day (Tue Dec 1) = long weekend
  { name: '1 Decembrie', startDate: '2026-11-28', endDate: '2026-12-01',
    priceMultiplier: 1.1, minimumStay: 2, seasonType: 'medium' },
  // Dec 2-18: early winter minimum demand
  { name: 'Early Winter', startDate: '2026-12-02', endDate: '2026-12-18',
    priceMultiplier: 0.8, minimumStay: 1, seasonType: 'minimum' },
  // Dec 19-23: pre-Christmas → base (no rule)
  // Dec 24-31: handled by date overrides
];

// ============================================================================
// HOLIDAY DATE OVERRIDES (flat rates, scaled from 2025 Airbnb prices)
// ============================================================================

interface OverrideDef {
  date: string;
  customPrice: number;
  minimumStay: number;
  reason: string;
  available: boolean;
  flatRate: boolean;
}

const OVERRIDES_2026: OverrideDef[] = [
  // Christmas (Dec 24-27, 2026) — 2025 Airbnb: 1000/night
  ...[24, 25, 26, 27].map(d => ({
    date: `2026-12-${d}`,
    customPrice: Math.round(1000 * HOLIDAY_SCALE),
    minimumStay: 3,
    reason: 'Christmas',
    available: true,
    flatRate: true,
  })),
  // Pre-NY (Dec 28-29) — 2025 Airbnb: 800/night
  ...[28, 29].map(d => ({
    date: `2026-12-${d}`,
    customPrice: Math.round(800 * HOLIDAY_SCALE),
    minimumStay: 2,
    reason: 'Pre-New Year',
    available: true,
    flatRate: true,
  })),
  // New Year's Eve (Dec 30-31) — 2025 Airbnb: 2000/night
  ...[30, 31].map(d => ({
    date: `2026-12-${d}`,
    customPrice: Math.round(2000 * HOLIDAY_SCALE),
    minimumStay: 3,
    reason: "New Year's Eve",
    available: true,
    flatRate: true,
  })),
  // Post-NY (Jan 1-3, 2027) — 2025 Airbnb: 800/night
  ...[1, 2, 3].map(d => ({
    date: `2027-01-0${d}`,
    customPrice: Math.round(800 * HOLIDAY_SCALE),
    minimumStay: 2,
    reason: 'Post-New Year',
    available: true,
    flatRate: true,
  })),
];

// ============================================================================
// Timestamp converter helper
// ============================================================================
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

// ============================================================================
// MAIN
// ============================================================================
async function run() {
  console.log('===========================================');
  console.log('  2026 Pricing Setup');
  console.log(`  Property: ${PROPERTY_ID}`);
  console.log(`  Mode: ${WRITE_MODE ? 'WRITE' : 'DRY RUN'}`);
  console.log('===========================================\n');

  // --- Show pricing config ---
  console.log('--- Property Config ---');
  console.log(`  Airbnb weekday base: ${AIRBNB_WEEKDAY_BASE} RON`);
  console.log(`  Airbnb weekend base: ${AIRBNB_WEEKEND_BASE} RON`);
  console.log(`  RentalSpot markup: +${(RENTALSPOT_MARKUP - 1) * 100}%`);
  console.log(`  RentalSpot weekday: ${RENTALSPOT_WEEKDAY} RON`);
  console.log(`  RentalSpot weekend: ${RENTALSPOT_WEEKEND} RON`);
  console.log(`  Weekend multiplier: ${WEEKEND_MULTIPLIER}`);
  console.log(`  Cleaning fee: ${CLEANING_FEE} RON`);
  console.log(`  Holiday scale factor: ${HOLIDAY_SCALE.toFixed(4)}x`);
  console.log('');

  // --- Show demand tier prices ---
  console.log('--- Demand Tier Prices (RentalSpot) ---');
  const tiers = [
    { name: 'min demand', mult: 0.8 },
    { name: 'low demand', mult: 0.9 },
    { name: 'base', mult: 1.0 },
    { name: 'medium demand', mult: 1.1 },
    { name: 'high demand', mult: 1.2 },
    { name: 'max demand', mult: 1.3 },
  ];
  for (const t of tiers) {
    const wd = Math.round(RENTALSPOT_WEEKDAY * t.mult);
    const we = Math.round(RENTALSPOT_WEEKDAY * WEEKEND_MULTIPLIER * t.mult);
    console.log(`  ${t.name.padEnd(15)} ${t.mult}x  →  weekday: ${wd} RON, weekend: ${we} RON`);
  }
  console.log('');

  // --- Show seasonal periods ---
  console.log('--- 2026 Seasonal Periods ---');
  for (const s of SEASONS_2026) {
    const wd = Math.round(RENTALSPOT_WEEKDAY * s.priceMultiplier);
    const we = Math.round(RENTALSPOT_WEEKDAY * WEEKEND_MULTIPLIER * s.priceMultiplier);
    console.log(`  ${s.startDate} to ${s.endDate}: ${s.name} (${s.priceMultiplier}x) → ${wd}/${we} RON, minStay=${s.minimumStay}`);
  }
  console.log('');

  // --- Show holiday overrides ---
  console.log('--- Holiday Date Overrides ---');
  for (const o of OVERRIDES_2026) {
    console.log(`  ${o.date}: ${o.customPrice} RON [${o.reason}] minStay=${o.minimumStay}`);
  }
  console.log('');

  // --- Show what exists currently ---
  console.log('--- Current Firestore Data ---');
  const propertyDoc = await db.collection('properties').doc(PROPERTY_ID).get();
  if (!propertyDoc.exists) {
    console.error(`Property ${PROPERTY_ID} not found!`);
    process.exit(1);
  }
  const property = propertyDoc.data()!;
  console.log(`  Current pricePerNight: ${property.pricePerNight}`);
  console.log(`  Current cleaningFee: ${property.cleaningFee}`);
  console.log(`  Current pricingConfig: ${JSON.stringify(property.pricingConfig || 'NOT SET')}`);
  console.log(`  Current pricing.weekendPricing: ${JSON.stringify(property.pricing?.weekendPricing || 'NOT SET')}`);

  const existingSeasons = await db.collection('seasonalPricing')
    .where('propertyId', '==', PROPERTY_ID).get();
  console.log(`  Existing seasonal rules: ${existingSeasons.size}`);
  existingSeasons.docs.forEach(d => {
    const data = d.data();
    console.log(`    - ${d.id}: ${data.name || 'unnamed'} (${data.startDate} to ${data.endDate}, ${data.priceMultiplier}x, enabled=${data.enabled})`);
  });

  const existingOverrides = await db.collection('dateOverrides')
    .where('propertyId', '==', PROPERTY_ID).get();
  console.log(`  Existing date overrides: ${existingOverrides.size}`);
  existingOverrides.docs.forEach(d => {
    const data = d.data();
    console.log(`    - ${d.id}: ${data.date} = ${data.customPrice} RON (${data.reason})`);
  });
  console.log('');

  if (!WRITE_MODE) {
    console.log('===========================================');
    console.log('  DRY RUN COMPLETE');
    console.log('  Run with --write to apply changes');
    console.log('===========================================\n');
    return;
  }

  // =========================================================================
  // WRITE MODE
  // =========================================================================
  console.log('--- Writing changes to Firestore ---\n');

  // 1. Update property document
  console.log('  [1] Updating property config...');
  await db.collection('properties').doc(PROPERTY_ID).update({
    pricePerNight: RENTALSPOT_WEEKDAY,
    cleaningFee: CLEANING_FEE,
    pricingConfig: {
      weekendAdjustment: WEEKEND_MULTIPLIER,
      weekendDays: ['friday', 'saturday'],
    },
    // Keep legacy field in sync for backward compat
    'pricing.weekendPricing.priceMultiplier': WEEKEND_MULTIPLIER,
    'pricing.weekendPricing.enabled': true,
    'pricing.weekendPricing.weekendDays': ['friday', 'saturday'],
  });
  console.log(`    Updated: pricePerNight=${RENTALSPOT_WEEKDAY}, cleaningFee=${CLEANING_FEE}, weekendAdj=${WEEKEND_MULTIPLIER}`);

  // 2. Disable old seasonal pricing (don't delete — keep for reference)
  console.log('  [2] Disabling old seasonal pricing rules...');
  const batch1 = db.batch();
  existingSeasons.docs.forEach(d => {
    batch1.update(d.ref, { enabled: false });
  });
  await batch1.commit();
  console.log(`    Disabled ${existingSeasons.size} old rules`);

  // 3. Create new 2026 seasonal pricing rules
  console.log('  [3] Creating 2026 seasonal pricing rules...');
  for (const s of SEASONS_2026) {
    const docId = `${PROPERTY_ID}-2026-${s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    await db.collection('seasonalPricing').doc(docId).set({
      propertyId: PROPERTY_ID,
      name: s.name,
      startDate: s.startDate,
      endDate: s.endDate,
      priceMultiplier: s.priceMultiplier,
      minimumStay: s.minimumStay,
      seasonType: s.seasonType,
      enabled: true,
      createdAt: new Date().toISOString(),
    });
    console.log(`    Created: ${docId}`);
  }

  // 4. Delete old date overrides for expired dates, create new ones
  console.log('  [4] Managing date overrides...');
  // Delete old overrides (they're all from 2023-2025)
  const batch2 = db.batch();
  existingOverrides.docs.forEach(d => {
    batch2.delete(d.ref);
  });
  await batch2.commit();
  console.log(`    Deleted ${existingOverrides.size} old overrides`);

  // Create new 2026-2027 overrides
  for (const o of OVERRIDES_2026) {
    const docId = `${PROPERTY_ID}-${o.date}-${o.reason.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    await db.collection('dateOverrides').doc(docId).set({
      propertyId: PROPERTY_ID,
      date: o.date,
      customPrice: o.customPrice,
      minimumStay: o.minimumStay,
      reason: o.reason,
      available: o.available,
      flatRate: o.flatRate,
      createdAt: new Date().toISOString(),
    });
    console.log(`    Created: ${docId} (${o.date}: ${o.customPrice} RON)`);
  }

  console.log('\n  Property config and pricing rules updated successfully!\n');

  // 5. Regenerate calendars (unless --skip-calendars)
  if (SKIP_CALENDARS) {
    console.log('  Skipping calendar regeneration (--skip-calendars flag).\n');
    return;
  }

  console.log('  [5] Regenerating price calendars with new engine...\n');

  // Fetch fresh data
  const freshProperty = (await db.collection('properties').doc(PROPERTY_ID).get()).data()!;
  const propertyPricing: PropertyPricing = {
    id: PROPERTY_ID,
    pricePerNight: freshProperty.pricePerNight,
    baseCurrency: freshProperty.baseCurrency || 'RON',
    baseOccupancy: freshProperty.baseOccupancy || 4,
    extraGuestFee: freshProperty.extraGuestFee || 25,
    maxGuests: freshProperty.maxGuests || 6,
    pricingConfig: freshProperty.pricingConfig,
  };

  const seasonalSnapshot = await db.collection('seasonalPricing')
    .where('propertyId', '==', PROPERTY_ID)
    .where('enabled', '==', true)
    .get();
  const seasons: SeasonalPricing[] = seasonalSnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  })) as SeasonalPricing[];

  const overridesSnapshot = await db.collection('dateOverrides')
    .where('propertyId', '==', PROPERTY_ID)
    .get();
  const overrides: DateOverride[] = overridesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  })) as DateOverride[];

  const minStaySnapshot = await db.collection('minimumStayRules')
    .where('propertyId', '==', PROPERTY_ID)
    .where('enabled', '==', true)
    .get();
  const minStayRules: MinimumStayRule[] = minStaySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  })) as MinimumStayRule[];

  // Booked dates
  const bookingsSnapshot = await db.collection('bookings')
    .where('propertyId', '==', PROPERTY_ID)
    .where('status', 'in', ['confirmed', 'on-hold'])
    .get();
  const bookedDates = new Set<string>();
  bookingsSnapshot.docs.forEach(docSnap => {
    const booking = docSnap.data();
    if (booking.checkInDate && booking.checkOutDate) {
      const checkIn = booking.checkInDate.toDate ? booking.checkInDate.toDate()
        : booking.checkInDate._seconds ? new Date(booking.checkInDate._seconds * 1000)
        : new Date(booking.checkInDate);
      const checkOut = booking.checkOutDate.toDate ? booking.checkOutDate.toDate()
        : booking.checkOutDate._seconds ? new Date(booking.checkOutDate._seconds * 1000)
        : new Date(booking.checkOutDate);
      const cur = new Date(checkIn);
      while (cur < checkOut) {
        bookedDates.add(format(cur, 'yyyy-MM-dd'));
        cur.setDate(cur.getDate() + 1);
      }
    }
  });

  console.log(`  Fresh data: ${seasons.length} seasons, ${overrides.length} overrides, ${minStayRules.length} min-stay rules, ${bookedDates.size} booked dates\n`);

  // Generate 12 months of calendars
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const MONTHS = 12;

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

    const dayValues = Object.values(days);
    const availableDays = dayValues.filter((d: any) => d.available);
    const minPrice = availableDays.length > 0
      ? Math.min(...availableDays.map((d: any) => d.adjustedPrice))
      : propertyPricing.pricePerNight;
    const maxPrice = availableDays.length > 0
      ? Math.max(...availableDays.map((d: any) => d.adjustedPrice))
      : propertyPricing.pricePerNight;
    const avgPrice = availableDays.length > 0
      ? availableDays.reduce((sum: number, d: any) => sum + d.adjustedPrice, 0) / availableDays.length
      : propertyPricing.pricePerNight;

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
        unavailableDays: dayValues.filter((d: any) => !d.available).length,
        modifiedDays: dayValues.filter((d: any) => d.priceSource !== 'base').length,
        hasCustomPrices: dayValues.some((d: any) => d.priceSource === 'override'),
        hasSeasonalRates: dayValues.some((d: any) => d.priceSource === 'season'),
      },
      generatedAt: new Date().toISOString()
    };

    await db.collection('priceCalendars').doc(calendarId).set(calendar);
    console.log(`  ${calendarId}: min=${minPrice}, max=${maxPrice}, avg=${Math.round(avgPrice)}`);
  }

  console.log('\n===========================================');
  console.log('  SETUP COMPLETE');
  console.log('===========================================\n');
}

run().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
