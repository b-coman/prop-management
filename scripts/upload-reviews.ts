#!/usr/bin/env node

/**
 * Upload scraped Airbnb and Booking.com reviews to Firestore `reviews` collection.
 *
 * Reads from:
 *   - review-details-final-80.json (80 Airbnb reviews)
 *   - review-details-booking-25.json (25 Booking.com reviews)
 *
 * Stores rich metadata beyond the base Review type:
 *   - sourceReviewId, subRatings, tags, privateNote, profilePicturePath (Airbnb)
 *   - sourceReviewId, sourceRating, subRatings, title, positiveReview, negativeReview, guestCountry (Booking)
 *
 * Deduplication: checks by sourceReviewId to avoid re-uploading.
 * After upload, recalculates property.ratings.
 *
 * Usage:
 *   npx tsx scripts/upload-reviews.ts [--dry-run]
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');

// ─── Firebase Admin init ───
function getDb() {
  if (getApps().length === 0) {
    const saPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
    if (!saPath) {
      console.error('Missing FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH in .env.local');
      process.exit(1);
    }
    const sa = JSON.parse(fs.readFileSync(saPath, 'utf-8'));
    initializeApp({ credential: cert(sa) });
  }
  return getFirestore();
}

// ─── Types for scraped data ───
interface AirbnbReview {
  guestName: string;
  dates: string;
  overallRating: number;
  publicReview: string;
  privateNote: string;
  ratings: Record<string, number>;
  tags: Record<string, string[]>;
  profilePicturePath: string;
  airbnbReviewId: string;
  propertySlug: string;
  source: string;
  listingId: string;
}

interface BookingReview {
  bookingReviewId: string;
  guestName: string;
  guestCountry: string;
  overallRating: number;
  dates: string;
  ratings: Record<string, number>;
  additionalRatings: Record<string, number>;
  title: string;
  positiveReview: string;
  negativeReview: string;
  fullReview: string;
  translatedFrom?: string;
  hasHostReply: boolean;
  propertySlug: string;
  source: string;
  listingId: string;
}

// ─── Date parsing ───

const MONTH_MAP: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

/** Build YYYY-MM-DD from month name, day, year — no Date object to avoid timezone shift. */
function toISODate(monthName: string, day: string, year: string): string {
  const mm = MONTH_MAP[monthName];
  if (!mm) return `${year}-01-01`;
  return `${year}-${mm}-${day.padStart(2, '0')}`;
}

/**
 * Parse Airbnb stay dates like "Nov 14 – 16, 2025" or "Jun 7 – Oct 9, 2021"
 * Returns the END date as YYYY-MM-DD string (checkout date ≈ review date).
 */
function parseAirbnbDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;

  // Normalize dashes
  const normalized = dateStr.replace(/\s*[–-]\s*/g, ' – ');

  // Pattern 1: "Nov 14 – 16, 2025" (same month)
  const sameMonth = normalized.match(/^(\w+)\s+(\d+)\s+–\s+(\d+),?\s+(\d{4})$/);
  if (sameMonth) {
    const [, month, , endDay, year] = sameMonth;
    return toISODate(month, endDay, year);
  }

  // Pattern 2: "Dec 29, 2025 – Jan 3, 2026" (different months AND different years)
  const crossYear = normalized.match(/^\w+\s+\d+,?\s+\d{4}\s+–\s+(\w+)\s+(\d+),?\s+(\d{4})$/);
  if (crossYear) {
    const [, endMonth, endDay, endYear] = crossYear;
    return toISODate(endMonth, endDay, endYear);
  }

  // Pattern 3: "Jun 7 – Oct 9, 2021" or "Aug 31 – Sep 7, 2025" (different months, same year)
  const diffMonth = normalized.match(/^\w+\s+\d+\s+–\s+(\w+)\s+(\d+),?\s+(\d{4})$/);
  if (diffMonth) {
    const [, endMonth, endDay, year] = diffMonth;
    return toISODate(endMonth, endDay, year);
  }

  console.warn(`  Could not parse Airbnb date: "${dateStr}"`);
  return null;
}

/**
 * Parse Booking.com date like "Jan 19, 2026"
 */
function parseBookingDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;
  const m = dateStr.match(/^(\w+)\s+(\d+),?\s+(\d{4})$/);
  if (m) {
    return toISODate(m[1], m[2], m[3]);
  }
  console.warn(`  Could not parse Booking date: "${dateStr}"`);
  return null;
}

/**
 * Convert Booking.com 1-10 rating to 1-5 scale.
 * Round to nearest 0.5.
 */
function convertBookingRating(rating10: number): number {
  const raw = rating10 / 2;
  return Math.round(raw * 2) / 2; // rounds to nearest 0.5
}

// ─── Transform functions ───

function transformAirbnbReview(r: AirbnbReview) {
  const date = parseAirbnbDate(r.dates);

  return {
    propertyId: r.propertySlug,
    guestName: r.guestName,
    rating: r.overallRating,
    comment: r.publicReview || '',
    date: date || '2020-01-01', // fallback for reviews with no dates
    source: 'airbnb' as const,
    isPublished: true,
    // Rich metadata
    sourceReviewId: r.airbnbReviewId,
    sourceListingId: r.listingId,
    stayDates: r.dates || null,
    subRatings: Object.keys(r.ratings).length > 0 ? r.ratings : null,
    tags: Object.keys(r.tags).length > 0 ? r.tags : null,
    privateNote: r.privateNote || null,
    profilePicturePath: r.profilePicturePath || null,
  };
}

function transformBookingReview(r: BookingReview) {
  const date = parseBookingDate(r.dates);

  return {
    propertyId: r.propertySlug,
    guestName: r.guestName,
    rating: convertBookingRating(r.overallRating),
    comment: r.fullReview || '',
    date: date || '2020-01-01',
    source: 'booking.com' as const,
    isPublished: true,
    // Rich metadata
    sourceReviewId: r.bookingReviewId || null,
    sourceListingId: r.listingId,
    sourceRating: r.overallRating, // original 1-10 scale
    subRatings: Object.keys(r.ratings).length > 0 ? r.ratings : null,
    additionalRatings: Object.keys(r.additionalRatings || {}).length > 0 ? r.additionalRatings : null,
    title: r.title || null,
    positiveReview: r.positiveReview || null,
    negativeReview: r.negativeReview || null,
    guestCountry: r.guestCountry || null,
    translatedFrom: r.translatedFrom || null,
    hasHostReply: r.hasHostReply,
  };
}

/** Remove null/undefined values (Firestore rejects undefined, we skip nulls for cleanliness) */
function stripNulls(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined)
  );
}

// ─── File discovery ───

interface ReviewFileSet {
  propertySlug: string;
  airbnbFiles: string[];
  bookingFiles: string[];
}

function discoverReviewFiles(rootDir: string): ReviewFileSet[] {
  const files = fs.readdirSync(rootDir).filter(f => f.endsWith('.json'));
  const sets = new Map<string, ReviewFileSet>();

  // Known file patterns per property
  const fileMap: Array<{ pattern: RegExp; property: string; type: 'airbnb' | 'booking' }> = [
    { pattern: /review-details-final-80\.json/, property: 'prahova-mountain-chalet', type: 'airbnb' },
    { pattern: /review-details-booking-25\.json/, property: 'prahova-mountain-chalet', type: 'booking' },
    { pattern: /review-details-coltei-airbnb.*\.json/, property: 'coltei-apartment-bucharest', type: 'airbnb' },
    { pattern: /review-details-coltei-booking.*\.json/, property: 'coltei-apartment-bucharest', type: 'booking' },
  ];

  for (const fm of fileMap) {
    const match = files.find(f => fm.pattern.test(f));
    if (match) {
      if (!sets.has(fm.property)) {
        sets.set(fm.property, { propertySlug: fm.property, airbnbFiles: [], bookingFiles: [] });
      }
      const set = sets.get(fm.property)!;
      const fullPath = path.join(rootDir, match);
      if (fm.type === 'airbnb') set.airbnbFiles.push(fullPath);
      else set.bookingFiles.push(fullPath);
    }
  }

  return Array.from(sets.values());
}

// ─── Main ───

async function main() {
  console.log(`\n📦 Review Upload Script ${DRY_RUN ? '(DRY RUN)' : ''}\n`);

  const rootDir = path.join(__dirname, '..');
  const propertyFilter = process.argv.find(a => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1]);
  const fileSets = discoverReviewFiles(rootDir);

  const db = getDb();

  for (const fileSet of fileSets) {
    if (propertyFilter && !fileSet.propertySlug.includes(propertyFilter)) continue;

    console.log(`\n  ── ${fileSet.propertySlug} ──\n`);

    // Read source files
    let airbnbReviews: AirbnbReview[] = [];
    let bookingReviews: BookingReview[] = [];

    for (const f of fileSet.airbnbFiles) {
      const data: AirbnbReview[] = JSON.parse(fs.readFileSync(f, 'utf-8'));
      airbnbReviews.push(...data);
      console.log(`  Airbnb file:     ${path.basename(f)} (${data.length} reviews)`);
    }
    for (const f of fileSet.bookingFiles) {
      const data: BookingReview[] = JSON.parse(fs.readFileSync(f, 'utf-8'));
      bookingReviews.push(...data);
      console.log(`  Booking file:    ${path.basename(f)} (${data.length} reviews)`);
    }

    const total = airbnbReviews.length + bookingReviews.length;
    console.log(`  Total:           ${total}\n`);

    if (total === 0) continue;

    // Transform
    const allReviews = [
      ...airbnbReviews.map(transformAirbnbReview),
      ...bookingReviews.map(transformBookingReview),
    ];

    // Show rating distribution
    const ratingDist: Record<number, number> = {};
    for (const r of allReviews) {
      ratingDist[r.rating] = (ratingDist[r.rating] || 0) + 1;
    }
    console.log('  Rating distribution (1-5 scale):');
    for (const [rating, count] of Object.entries(ratingDist).sort((a, b) => Number(b[0]) - Number(a[0]))) {
      console.log(`    ${rating}★: ${count} reviews`);
    }

    // Show date issues
    const noDates = allReviews.filter(r => r.date === '2020-01-01');
    if (noDates.length > 0) {
      console.log(`\n  ⚠️  ${noDates.length} reviews with no parseable date (using fallback 2020-01-01):`);
      for (const r of noDates) {
        console.log(`    - ${r.guestName} (${r.source})`);
      }
    }

    // Check for existing reviews with sourceReviewId to avoid duplicates
    console.log('\n  Checking for existing reviews...');
    const existingSnap = await db
      .collection('reviews')
      .where('propertyId', '==', fileSet.propertySlug)
      .get();

    const existingSourceIds = new Set<string>();
    for (const doc of existingSnap.docs) {
      const data = doc.data();
      if (data.sourceReviewId) {
        existingSourceIds.add(data.sourceReviewId);
      }
    }
    console.log(`  Found ${existingSnap.size} existing reviews (${existingSourceIds.size} with sourceReviewId)`);

    // Filter out duplicates
    const newReviews = allReviews.filter(r => {
      if (!r.sourceReviewId) return true;
      return !existingSourceIds.has(r.sourceReviewId);
    });
    const skipped = allReviews.length - newReviews.length;

    if (skipped > 0) {
      console.log(`  Skipping ${skipped} duplicate reviews`);
    }
    console.log(`  Will upload ${newReviews.length} new reviews\n`);

    if (newReviews.length === 0) continue;

    if (DRY_RUN) {
      console.log('  DRY RUN — sample review:');
      console.log(JSON.stringify(stripNulls(newReviews[0]), null, 2));
      continue;
    }

    // Upload in batches of 400
    const BATCH_SIZE = 400;
    let uploaded = 0;
    const now = FieldValue.serverTimestamp();

    for (let i = 0; i < newReviews.length; i += BATCH_SIZE) {
      const chunk = newReviews.slice(i, i + BATCH_SIZE);
      const batch = db.batch();

      for (const review of chunk) {
        const ref = db.collection('reviews').doc();
        const data = stripNulls({
          ...review,
          date: Timestamp.fromDate(new Date(review.date)),
          createdAt: now,
          updatedAt: now,
        });
        batch.set(ref, data);
      }

      await batch.commit();
      uploaded += chunk.length;
      console.log(`  ✅ Batch uploaded: ${uploaded}/${newReviews.length}`);
    }

    // Recalculate property ratings
    console.log('\n  Recalculating property ratings...');
    const publishedSnap = await db
      .collection('reviews')
      .where('propertyId', '==', fileSet.propertySlug)
      .where('isPublished', '==', true)
      .get();

    const count = publishedSnap.size;
    const totalRating = publishedSnap.docs.reduce((sum, doc) => sum + (doc.data().rating || 0), 0);
    const average = count > 0 ? Math.round((totalRating / count) * 10) / 10 : 0;

    const propertyRef = db.collection('properties').doc(fileSet.propertySlug);
    await propertyRef.update({
      ratings: { average, count },
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`  Property ratings updated: ${average}★ from ${count} reviews`);
  }

  console.log('\n  Done! 🎉\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
