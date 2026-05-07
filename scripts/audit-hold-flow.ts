// READ-ONLY audit of the hold flow.
//
// Holds are NOT a separate collection — they're bookings with status='on-hold' plus a
// `holdUntil` Timestamp. The `availability` collection tracks which days are held via the
// `holds[day] = bookingId` field. The hold-cleanup cron at /api/cron/release-holds is
// supposed to flip expired holds back to available.
//
// This script cross-checks for:
//   1. STALE: availability.holds[d] entries pointing to bookings whose status is NOT 'on-hold'
//      (cron should have cleared them)
//   2. EXPIRED: 'on-hold' bookings whose holdUntil is in the past (cron is behind)
//   3. ORPHAN: availability.holds[d] entries pointing to bookings that don't exist
//   4. MISMATCH: 'on-hold' bookings whose truth-days are NOT all reflected in availability.holds
//   5. CONVENTION: storage convention used for hold checkInDate / checkOutDate vs other bookings
//   6. LEFTOVER: bookings with status != 'on-hold' but still carrying a holdUntil field
//
// Outputs:
//   - Summary tables to stdout
//   - Detail CSV: scripts/hold-audit.csv
//
// Usage: npx tsx scripts/audit-hold-flow.ts
//   Optional: --property=<slug>
//
// This script does NOT write to Firestore.

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH not set in .env.local');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(path.resolve(serviceAccountPath)),
});

const db = admin.firestore();

const args = process.argv.slice(2);
const propertyFilter = args.find(a => a.startsWith('--property='))?.split('=')[1];

// ---- Helpers ----

function toDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (value instanceof admin.firestore.Timestamp) return value.toDate();
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && '_seconds' in (value as Record<string, unknown>)) {
    return new Date((value as { _seconds: number })._seconds * 1000);
  }
  return null;
}

const bucharestDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Bucharest',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const bucharestDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Bucharest',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function bucharestDateOnly(d: Date): string {
  return bucharestDateFormatter.format(d);
}

function bucharestDateTime(d: Date): string {
  return bucharestDateTimeFormatter.format(d).replace(', ', ' ');
}

function classifyConvention(d: Date | null): string {
  if (!d) return 'null';
  const utcHour = d.getUTCHours();
  const utcMinute = d.getUTCMinutes();
  if (utcHour === 0 && utcMinute === 0) return 'utc-midnight';
  // Bucharest local midnight: 21:00 UTC summer (EEST), 22:00 UTC winter (EET)
  const parts = bucharestDateTimeFormatter.formatToParts(d);
  let buHour = parseInt(parts.find(p => p.type === 'hour')!.value, 10);
  if (buHour === 24) buHour = 0;
  const buMinute = parseInt(parts.find(p => p.type === 'minute')!.value, 10);
  if (buHour === 0 && buMinute === 0) {
    if (utcHour === 21) return 'bucharest-midnight-eest';
    if (utcHour === 22) return 'bucharest-midnight-eet';
    return 'bucharest-midnight';
  }
  return 'has-time';
}

/** Bucharest-local truth: which day numbers does this booking occupy, by month? */
function truthDays(checkIn: Date, checkOut: Date): Map<string, Set<number>> {
  const result = new Map<string, Set<number>>();
  const startStr = bucharestDateOnly(checkIn);
  const endStr = bucharestDateOnly(checkOut);
  if (startStr >= endStr) return result;
  let cur = new Date(`${startStr}T12:00:00Z`);
  while (true) {
    const curStr = bucharestDateOnly(cur);
    if (curStr >= endStr) break;
    const [y, m, d] = curStr.split('-').map(Number);
    const monthKey = `${y}-${String(m).padStart(2, '0')}`;
    if (!result.has(monthKey)) result.set(monthKey, new Set());
    result.get(monthKey)!.add(d);
    cur = new Date(cur.getTime() + 86400000);
  }
  return result;
}

// ---- Main ----

async function main() {
  const now = new Date();

  console.log('Reading collections...');

  // 1. All availability docs (we need .holds field; can't query for "non-empty map" directly)
  let availSnapshot: FirebaseFirestore.QuerySnapshot;
  if (propertyFilter) {
    const prefix = `${propertyFilter}_`;
    availSnapshot = await db.collection('availability')
      .where(admin.firestore.FieldPath.documentId(), '>=', prefix)
      .where(admin.firestore.FieldPath.documentId(), '<', prefix + '')
      .get();
  } else {
    availSnapshot = await db.collection('availability').get();
  }
  console.log(`  ${availSnapshot.size} availability docs`);

  // 2. Bookings — we need both 'on-hold' status and any booking referenced by availability.holds[d]
  // Two-pass: first collect referenced bookingIds, then fetch each. Plus the on-hold query.
  const onHoldSnapshot = await db.collection('bookings')
    .where('status', '==', 'on-hold')
    .get();
  console.log(`  ${onHoldSnapshot.size} on-hold bookings`);

  // 3. Bookings with holdUntil set (regardless of status) — leftover-field detection
  const withHoldUntilSnapshot = await db.collection('bookings')
    .where('holdUntil', '!=', null)
    .get();
  console.log(`  ${withHoldUntilSnapshot.size} bookings with holdUntil set (any status)`);
  console.log('');

  // ---- Walk availability.holds and collect referenced bookingIds ----

  interface HoldRefRow {
    propertyId: string;
    month: string;
    day: number;
    bookingId: string;
    bookingExists: boolean;
    bookingStatus: string;
    holdUntilUTC: string;
    holdUntilExpired: boolean | null;
    bookingTruthDays: string;       // truth days for this booking that fall in this month
    dayInBookingTruth: boolean;     // does the day number appear in the booking's truth-days for this month
    classification: string;         // 'ok' | 'stale-not-on-hold' | 'expired' | 'orphan' | 'mismatch'
  }

  const holdRows: HoldRefRow[] = [];
  const referencedBookingIds = new Set<string>();

  for (const doc of availSnapshot.docs) {
    const data = doc.data();
    const id = doc.id;
    const lastUnderscore = id.lastIndexOf('_');
    const propertyId = lastUnderscore > 0 ? id.substring(0, lastUnderscore) : (data.propertyId || '');
    const month = lastUnderscore > 0 ? id.substring(lastUnderscore + 1) : (data.month || '');
    const holds = data.holds || {};
    for (const [dayStr, bookingId] of Object.entries(holds)) {
      if (!bookingId) continue;
      referencedBookingIds.add(bookingId as string);
      holdRows.push({
        propertyId,
        month,
        day: parseInt(dayStr, 10),
        bookingId: bookingId as string,
        bookingExists: false,
        bookingStatus: '',
        holdUntilUTC: '',
        holdUntilExpired: null,
        bookingTruthDays: '',
        dayInBookingTruth: false,
        classification: '',
      });
    }
  }

  console.log(`Found ${holdRows.length} holds[d] entries across ${new Set(holdRows.map(r => `${r.propertyId}|${r.month}`)).size} availability docs`);
  console.log(`Referencing ${referencedBookingIds.size} unique bookings\n`);

  // ---- Fetch referenced bookings ----

  const referencedBookings = new Map<string, FirebaseFirestore.DocumentData>();
  const idArr = [...referencedBookingIds];
  for (let i = 0; i < idArr.length; i += 30) {
    const batch = idArr.slice(i, i + 30);
    if (batch.length === 0) continue;
    const snap = await db.collection('bookings')
      .where(admin.firestore.FieldPath.documentId(), 'in', batch)
      .get();
    for (const doc of snap.docs) referencedBookings.set(doc.id, doc.data());
  }

  // Also stash all on-hold bookings + bookings-with-holdUntil for further checks
  const onHoldBookings = new Map<string, FirebaseFirestore.DocumentData>();
  for (const doc of onHoldSnapshot.docs) onHoldBookings.set(doc.id, doc.data());
  const withHoldUntilBookings = new Map<string, FirebaseFirestore.DocumentData>();
  for (const doc of withHoldUntilSnapshot.docs) withHoldUntilBookings.set(doc.id, doc.data());

  // ---- Classify each hold-ref row ----

  for (const row of holdRows) {
    const data = referencedBookings.get(row.bookingId);
    if (!data) {
      row.classification = 'orphan';
      continue;
    }
    row.bookingExists = true;
    row.bookingStatus = data.status || '';
    const holdUntil = toDate(data.holdUntil);
    row.holdUntilUTC = holdUntil ? holdUntil.toISOString() : '';
    row.holdUntilExpired = holdUntil ? holdUntil.getTime() < now.getTime() : null;

    // Compute truth days for this booking and check whether the day appears in this month
    const ci = toDate(data.checkInDate);
    const co = toDate(data.checkOutDate);
    if (ci && co) {
      const truth = truthDays(ci, co);
      const monthSet = truth.get(row.month);
      row.bookingTruthDays = monthSet ? [...monthSet].sort((a, b) => a - b).join(',') : '';
      row.dayInBookingTruth = monthSet ? monthSet.has(row.day) : false;
    }

    if (row.bookingStatus !== 'on-hold') {
      row.classification = 'stale-not-on-hold';
    } else if (row.holdUntilExpired) {
      row.classification = 'expired';
    } else if (!row.dayInBookingTruth) {
      row.classification = 'mismatch';
    } else {
      row.classification = 'ok';
    }
  }

  // ---- On-hold bookings: do they have full coverage in availability.holds? ----

  interface OnHoldCoverageRow {
    bookingId: string;
    propertyId: string;
    guestName: string;
    holdUntilUTC: string;
    holdUntilExpired: boolean;
    convention: string;
    truthDays: string;
    coveredHoldsDays: string;
    missingHoldsDays: string;
    severity: string;
  }

  const availLookup = new Map<string, FirebaseFirestore.DocumentData>();
  for (const doc of availSnapshot.docs) availLookup.set(doc.id, doc.data());

  const onHoldCoverage: OnHoldCoverageRow[] = [];

  for (const [bookingId, data] of onHoldBookings) {
    if (propertyFilter && data.propertyId !== propertyFilter) continue;
    const ci = toDate(data.checkInDate);
    const co = toDate(data.checkOutDate);
    const holdUntil = toDate(data.holdUntil);
    const guestName = [data.guestInfo?.firstName, data.guestInfo?.lastName].filter(Boolean).join(' ') || '(no name)';
    if (!ci || !co) {
      onHoldCoverage.push({
        bookingId,
        propertyId: data.propertyId || '',
        guestName,
        holdUntilUTC: holdUntil ? holdUntil.toISOString() : '',
        holdUntilExpired: holdUntil ? holdUntil.getTime() < now.getTime() : false,
        convention: 'invalid-dates',
        truthDays: '',
        coveredHoldsDays: '',
        missingHoldsDays: '',
        severity: 'invalid',
      });
      continue;
    }
    const truth = truthDays(ci, co);
    const covered: Map<string, Set<number>> = new Map();
    const missing: Map<string, Set<number>> = new Map();
    for (const [m, s] of truth) {
      covered.set(m, new Set());
      missing.set(m, new Set());
      const ad = availLookup.get(`${data.propertyId}_${m}`);
      const holds = (ad?.holds || {}) as Record<string, string | null>;
      for (const d of s) {
        if (holds[String(d)] === bookingId) covered.get(m)!.add(d);
        else missing.get(m)!.add(d);
      }
    }
    const flatten = (mp: Map<string, Set<number>>) =>
      [...mp.entries()].sort().map(([m, s]) => `${m}:${[...s].sort((a, b) => a - b).join(',')}`).join(' ');
    const totalMissing = [...missing.values()].reduce((a, s) => a + s.size, 0);
    const expired = holdUntil ? holdUntil.getTime() < now.getTime() : false;
    let severity: string;
    if (expired) severity = 'expired';
    else if (totalMissing > 0) severity = 'partial-coverage';
    else severity = 'ok';
    onHoldCoverage.push({
      bookingId,
      propertyId: data.propertyId || '',
      guestName,
      holdUntilUTC: holdUntil ? holdUntil.toISOString() : '',
      holdUntilExpired: expired,
      convention: classifyConvention(ci),
      truthDays: flatten(truth),
      coveredHoldsDays: flatten(covered),
      missingHoldsDays: flatten(missing),
      severity,
    });
  }

  // ---- Leftover holdUntil field on non-hold bookings ----

  interface LeftoverRow {
    bookingId: string;
    propertyId: string;
    guestName: string;
    status: string;
    holdUntilUTC: string;
  }
  const leftovers: LeftoverRow[] = [];
  for (const [bookingId, data] of withHoldUntilBookings) {
    if (data.status === 'on-hold') continue; // legitimate
    const holdUntil = toDate(data.holdUntil);
    if (!holdUntil) continue;
    leftovers.push({
      bookingId,
      propertyId: data.propertyId || '',
      guestName: [data.guestInfo?.firstName, data.guestInfo?.lastName].filter(Boolean).join(' ') || '(no name)',
      status: data.status || '',
      holdUntilUTC: holdUntil.toISOString(),
    });
  }

  // ---- Summaries ----

  console.log('===========================================');
  console.log('AVAILABILITY.holds[d] entries');
  console.log('===========================================');
  console.log(`Total entries: ${holdRows.length}`);
  console.log('');

  console.log('--- Classification ---');
  const tally = new Map<string, number>();
  for (const r of holdRows) tally.set(r.classification, (tally.get(r.classification) || 0) + 1);
  for (const [k, v] of [...tally.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(25)} ${v}`);
  console.log('');

  const stale = holdRows.filter(r => r.classification === 'stale-not-on-hold');
  if (stale.length > 0) {
    console.log(`!!! STALE: ${stale.length} availability.holds[d] entries point to bookings that are no longer 'on-hold'`);
    console.log(`    (Cron should have cleared these. Each entry blocks a real day from being available.)`);
    for (const r of stale.slice(0, 20)) {
      console.log(`  ${r.propertyId}_${r.month} day=${r.day}  → booking ${r.bookingId} (status=${r.bookingStatus})`);
    }
    if (stale.length > 20) console.log(`  ... and ${stale.length - 20} more (see CSV)`);
    console.log('');
  }

  const expired = holdRows.filter(r => r.classification === 'expired');
  if (expired.length > 0) {
    console.log(`!!! EXPIRED: ${expired.length} availability.holds[d] entries point to expired holds (holdUntil < now)`);
    for (const r of expired.slice(0, 10)) {
      console.log(`  ${r.propertyId}_${r.month} day=${r.day}  → booking ${r.bookingId} expired ${r.holdUntilUTC}`);
    }
    console.log('');
  }

  const orphans = holdRows.filter(r => r.classification === 'orphan');
  if (orphans.length > 0) {
    console.log(`!!! ORPHAN: ${orphans.length} availability.holds[d] entries reference bookings that don't exist`);
    for (const r of orphans.slice(0, 10)) {
      console.log(`  ${r.propertyId}_${r.month} day=${r.day}  → MISSING booking ${r.bookingId}`);
    }
    console.log('');
  }

  const mismatches = holdRows.filter(r => r.classification === 'mismatch');
  if (mismatches.length > 0) {
    console.log(`!!! MISMATCH: ${mismatches.length} availability.holds[d] entries hold a day that's NOT in the booking's truth-days`);
    console.log(`    (Off-by-one symptom)`);
    for (const r of mismatches.slice(0, 10)) {
      console.log(`  ${r.propertyId}_${r.month} day=${r.day}  → booking ${r.bookingId}  truthDays=${r.bookingTruthDays}`);
    }
    console.log('');
  }

  console.log('===========================================');
  console.log('ON-HOLD BOOKINGS');
  console.log('===========================================');
  console.log(`Total on-hold bookings: ${onHoldCoverage.length}`);
  if (onHoldCoverage.length === 0) {
    console.log('No on-hold bookings to analyze.');
  } else {
    const oTally = new Map<string, number>();
    for (const r of onHoldCoverage) oTally.set(r.severity, (oTally.get(r.severity) || 0) + 1);
    for (const [k, v] of [...oTally.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(25)} ${v}`);
    console.log('');
    const partials = onHoldCoverage.filter(r => r.severity === 'partial-coverage');
    if (partials.length > 0) {
      console.log(`!!! PARTIAL COVERAGE: ${partials.length} on-hold bookings whose truth-days are not all reflected in availability.holds`);
      for (const r of partials.slice(0, 10)) {
        console.log(`  ${r.bookingId}  ${r.guestName.padEnd(28)}  missing=${r.missingHoldsDays}`);
      }
      console.log('');
    }
    const expiredHolds = onHoldCoverage.filter(r => r.severity === 'expired');
    if (expiredHolds.length > 0) {
      console.log(`!!! EXPIRED ON-HOLD: ${expiredHolds.length} bookings still have status='on-hold' but holdUntil < now`);
      for (const r of expiredHolds.slice(0, 10)) {
        console.log(`  ${r.bookingId}  ${r.guestName.padEnd(28)}  holdUntil=${r.holdUntilUTC}`);
      }
      console.log('');
    }
  }

  console.log('--- Convention used by on-hold bookings ---');
  if (onHoldCoverage.length === 0) {
    console.log('  (none)');
  } else {
    const cTally = new Map<string, number>();
    for (const r of onHoldCoverage) cTally.set(r.convention, (cTally.get(r.convention) || 0) + 1);
    for (const [k, v] of [...cTally.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(25)} ${v}`);
  }
  console.log('');

  console.log('===========================================');
  console.log('LEFTOVER holdUntil FIELD');
  console.log('===========================================');
  console.log(`Bookings with holdUntil but status != 'on-hold': ${leftovers.length}`);
  for (const r of leftovers.slice(0, 10)) {
    console.log(`  ${r.bookingId}  ${r.guestName.padEnd(28)}  status=${r.status}  holdUntil=${r.holdUntilUTC}`);
  }
  if (leftovers.length > 10) console.log(`  ... and ${leftovers.length - 10} more (see CSV)`);
  console.log('');

  // ---- CSV ----

  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const csvPath = path.resolve(process.cwd(), 'scripts', 'hold-audit.csv');
  const lines: string[] = [];
  lines.push('# Section: availability.holds[d] entries');
  lines.push(['propertyId', 'month', 'day', 'bookingId', 'bookingExists', 'bookingStatus', 'holdUntilUTC', 'holdUntilExpired', 'bookingTruthDays', 'dayInBookingTruth', 'classification'].join(','));
  for (const r of holdRows) {
    lines.push([r.propertyId, r.month, r.day, r.bookingId, r.bookingExists, r.bookingStatus, r.holdUntilUTC, r.holdUntilExpired, r.bookingTruthDays, r.dayInBookingTruth, r.classification].map(escape).join(','));
  }
  lines.push('');
  lines.push('# Section: on-hold booking coverage');
  lines.push(['bookingId', 'propertyId', 'guestName', 'holdUntilUTC', 'holdUntilExpired', 'convention', 'truthDays', 'coveredHoldsDays', 'missingHoldsDays', 'severity'].join(','));
  for (const r of onHoldCoverage) {
    lines.push([r.bookingId, r.propertyId, r.guestName, r.holdUntilUTC, r.holdUntilExpired, r.convention, r.truthDays, r.coveredHoldsDays, r.missingHoldsDays, r.severity].map(escape).join(','));
  }
  lines.push('');
  lines.push('# Section: leftover holdUntil');
  lines.push(['bookingId', 'propertyId', 'guestName', 'status', 'holdUntilUTC'].join(','));
  for (const r of leftovers) {
    lines.push([r.bookingId, r.propertyId, r.guestName, r.status, r.holdUntilUTC].map(escape).join(','));
  }
  fs.writeFileSync(csvPath, lines.join('\n'));
  console.log(`CSV written: ${csvPath}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
