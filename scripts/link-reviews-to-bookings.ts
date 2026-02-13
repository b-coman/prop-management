#!/usr/bin/env node

/**
 * Link imported reviews to existing bookings and guests for prahova-mountain-chalet.
 *
 * Matching strategy:
 *   Airbnb:     parse stayDates → match booking checkIn/checkOut (±1 day) + source + firstName
 *   Booking.com: match firstName + source + closest booking checkOut before review date
 *
 * Updates:
 *   - review: sets `bookingId` and `guestId`
 *   - guest:  sets `reviewSubmitted: true`
 *
 * Usage:
 *   npx tsx scripts/link-reviews-to-bookings.ts [--dry-run]
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');
const propertyArg = process.argv.find(a => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1]);
const PROPERTY_ID = propertyArg === 'coltei' ? 'coltei-apartment-bucharest' : 'prahova-mountain-chalet';

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

// ─── Date helpers ───

/** Convert Firestore timestamp ({_seconds}) to days since epoch for easy comparison */
function tsDaysSinceEpoch(ts: { _seconds: number }): number {
  return Math.round(ts._seconds / 86400);
}

const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/** Parse "Aug 5" or "Aug 5, 2025" into days since epoch (UTC) */
function parseMonthDay(monthStr: string, dayStr: string, yearStr: string): number {
  const d = new Date(Date.UTC(Number(yearStr), MONTH_MAP[monthStr] ?? 0, Number(dayStr)));
  return Math.round(d.getTime() / 86400000);
}

interface ParsedStayDates {
  checkInDays: number;
  checkOutDays: number;
}

/** Parse Airbnb stayDates like "Nov 14 – 16, 2025" or "Jun 7 – Oct 9, 2021" */
function parseStayDates(dateStr: string): ParsedStayDates | null {
  if (!dateStr || dateStr.trim() === '') return null;
  const normalized = dateStr.replace(/\s*[–-]\s*/g, ' – ');

  // "Nov 14 – 16, 2025" (same month)
  const sameMonth = normalized.match(/^(\w+)\s+(\d+)\s+–\s+(\d+),?\s+(\d{4})$/);
  if (sameMonth) {
    const [, month, startDay, endDay, year] = sameMonth;
    return {
      checkInDays: parseMonthDay(month, startDay, year),
      checkOutDays: parseMonthDay(month, endDay, year),
    };
  }

  // "Dec 29, 2025 – Jan 3, 2026" (different months AND different years)
  const crossYear = normalized.match(/^(\w+)\s+(\d+),?\s+(\d{4})\s+–\s+(\w+)\s+(\d+),?\s+(\d{4})$/);
  if (crossYear) {
    const [, startMonth, startDay, startYear, endMonth, endDay, endYear] = crossYear;
    return {
      checkInDays: parseMonthDay(startMonth, startDay, startYear),
      checkOutDays: parseMonthDay(endMonth, endDay, endYear),
    };
  }

  // "Jun 7 – Oct 9, 2021" (different months, same year)
  const diffMonth = normalized.match(/^(\w+)\s+(\d+)\s+–\s+(\w+)\s+(\d+),?\s+(\d{4})$/);
  if (diffMonth) {
    const [, startMonth, startDay, endMonth, endDay, year] = diffMonth;
    return {
      checkInDays: parseMonthDay(startMonth, startDay, year),
      checkOutDays: parseMonthDay(endMonth, endDay, year),
    };
  }

  return null;
}

// ─── Main ───

async function main() {
  console.log(`\n🔗 Link Reviews to Bookings ${DRY_RUN ? '(DRY RUN)' : ''}\n`);
  console.log(`  Property: ${PROPERTY_ID}\n`);

  const db = getDb();

  // 1. Load all reviews for this property that don't already have a bookingId
  const reviewSnap = await db.collection('reviews')
    .where('propertyId', '==', PROPERTY_ID)
    .get();

  const reviews = reviewSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const unlinkedReviews = reviews.filter((r: any) => !r.bookingId);
  console.log(`  Reviews: ${reviews.length} total, ${unlinkedReviews.length} unlinked`);

  // 2. Load all bookings for this property
  const bookingSnap = await db.collection('bookings')
    .where('propertyId', '==', PROPERTY_ID)
    .get();

  interface BookingRecord {
    id: string;
    firstName: string;
    lastName: string;
    checkInDays: number;
    checkOutDays: number;
    source: string;
  }

  const bookings: BookingRecord[] = bookingSnap.docs.map(doc => {
    const d = doc.data();
    const ci = d.checkInDate ? tsDaysSinceEpoch(d.checkInDate) : 0;
    const co = d.checkOutDate ? tsDaysSinceEpoch(d.checkOutDate) : 0;
    return {
      id: doc.id,
      firstName: (d.guestInfo?.firstName || '').trim(),
      lastName: (d.guestInfo?.lastName || '').trim(),
      checkInDays: ci,
      checkOutDays: co,
      source: d.source || '',
    };
  });
  console.log(`  Bookings: ${bookings.length}`);

  // 3. Load all guests and build bookingId → guestId lookup
  const guestSnap = await db.collection('guests')
    .where('propertyIds', 'array-contains', PROPERTY_ID)
    .get();

  const bookingToGuest = new Map<string, string>();
  for (const doc of guestSnap.docs) {
    const data = doc.data();
    for (const bid of (data.bookingIds || [])) {
      bookingToGuest.set(bid, doc.id);
    }
  }
  console.log(`  Guests: ${guestSnap.size} (${bookingToGuest.size} booking→guest mappings)\n`);

  // 4. Match each unlinked review to a booking
  let matched = 0;
  let unmatched = 0;
  const reviewUpdates: Array<{ reviewId: string; bookingId: string; guestId: string | null }> = [];
  const guestIdsToMarkReviewed = new Set<string>();

  for (const review of unlinkedReviews) {
    const r = review as any;
    const reviewName = (r.guestName || '').trim().toLowerCase();
    const reviewSource = r.source || '';

    let matchedBooking: BookingRecord | null = null;

    if (reviewSource === 'airbnb' && r.stayDates) {
      // Airbnb: match by parsed dates (±1 day tolerance) + firstName + source
      const parsed = parseStayDates(r.stayDates);
      if (parsed) {
        const candidates = bookings.filter(b => {
          if (b.source !== 'airbnb') return false;
          const nameMatch = b.firstName.toLowerCase() === reviewName ||
            reviewName.startsWith(b.firstName.toLowerCase()) ||
            b.firstName.toLowerCase().startsWith(reviewName);
          const checkInClose = Math.abs(b.checkInDays - parsed.checkInDays) <= 1;
          const checkOutClose = Math.abs(b.checkOutDays - parsed.checkOutDays) <= 1;
          return nameMatch && checkInClose && checkOutClose;
        });

        if (candidates.length === 1) {
          matchedBooking = candidates[0];
        } else if (candidates.length > 1) {
          // Multiple matches — try exact name
          const exact = candidates.find(c => c.firstName.toLowerCase() === reviewName);
          matchedBooking = exact || candidates[0];
        }
      }

      // Fallback: try name-only match if no date match (for reviews with no parseable dates)
      if (!matchedBooking && !r.stayDates) {
        const nameMatches = bookings.filter(b =>
          b.source === 'airbnb' && b.firstName.toLowerCase() === reviewName
        );
        if (nameMatches.length === 1) {
          matchedBooking = nameMatches[0];
        }
      }
    } else if (reviewSource === 'booking.com') {
      // Booking.com: match by firstName + source, pick closest checkout before review date
      const reviewDays = r.date?._seconds ? tsDaysSinceEpoch(r.date) : 0;

      const candidates = bookings.filter(b => {
        if (b.source !== 'booking.com') return false;
        const nameMatch = b.firstName.toLowerCase() === reviewName ||
          reviewName.startsWith(b.firstName.toLowerCase()) ||
          b.firstName.toLowerCase().startsWith(reviewName);
        return nameMatch;
      });

      if (candidates.length === 1) {
        matchedBooking = candidates[0];
      } else if (candidates.length > 1 && reviewDays > 0) {
        // Pick the one with checkOut closest to (and before) the review date
        let best: BookingRecord | null = null;
        let bestDiff = Infinity;
        for (const c of candidates) {
          const diff = reviewDays - c.checkOutDays;
          if (diff >= 0 && diff < bestDiff) {
            bestDiff = diff;
            best = c;
          }
        }
        matchedBooking = best || candidates[0];
      }
    }

    if (matchedBooking) {
      const guestId = bookingToGuest.get(matchedBooking.id) || null;
      reviewUpdates.push({ reviewId: r.id, bookingId: matchedBooking.id, guestId });
      if (guestId) guestIdsToMarkReviewed.add(guestId);
      matched++;
    } else {
      unmatched++;
      console.log(`  ❌ No match: ${r.guestName} (${reviewSource}) — ${r.stayDates || 'no dates'}`);
    }
  }

  console.log(`\n  Matched: ${matched}/${unlinkedReviews.length}`);
  console.log(`  Unmatched: ${unmatched}`);
  console.log(`  Guests to update: ${guestIdsToMarkReviewed.size}\n`);

  if (DRY_RUN) {
    console.log('  DRY RUN — sample matches:');
    for (const u of reviewUpdates.slice(0, 10)) {
      const rev = unlinkedReviews.find((r: any) => r.id === u.reviewId) as any;
      console.log(`    ${rev?.guestName} → booking:${u.bookingId.slice(0, 8)}… guest:${u.guestId?.slice(0, 8) || 'none'}…`);
    }
    if (reviewUpdates.length > 10) console.log(`    ... and ${reviewUpdates.length - 10} more`);
    console.log(`\n  Run without --dry-run to apply.\n`);
    return;
  }

  // 5. Apply updates in batches
  const BATCH_SIZE = 400;

  // Update reviews
  for (let i = 0; i < reviewUpdates.length; i += BATCH_SIZE) {
    const chunk = reviewUpdates.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const u of chunk) {
      const ref = db.collection('reviews').doc(u.reviewId);
      const update: Record<string, any> = {
        bookingId: u.bookingId,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (u.guestId) update.guestId = u.guestId;
      batch.update(ref, update);
    }
    await batch.commit();
    console.log(`  ✅ Reviews updated: ${Math.min(i + BATCH_SIZE, reviewUpdates.length)}/${reviewUpdates.length}`);
  }

  // Update guests
  const guestIds = Array.from(guestIdsToMarkReviewed);
  for (let i = 0; i < guestIds.length; i += BATCH_SIZE) {
    const chunk = guestIds.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const gid of chunk) {
      const ref = db.collection('guests').doc(gid);
      batch.update(ref, {
        reviewSubmitted: true,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    console.log(`  ✅ Guests updated: ${Math.min(i + BATCH_SIZE, guestIds.length)}/${guestIds.length}`);
  }

  console.log('\n  Done! 🎉\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
