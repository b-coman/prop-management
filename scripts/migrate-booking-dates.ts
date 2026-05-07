// Migrate booking checkInDate / checkOutDate Timestamps to real check-in / check-out times
// (Phase 2 of the plans/booking-date-migration.md).
//
// What it does:
//   - For every non-cancelled booking, rewrite checkInDate and checkOutDate so they encode
//     the property's checkInTime / checkOutTime in Europe/Bucharest, on the same calendar day
//     they currently mean. Nothing else is touched.
//   - Optionally (--cleanup-orphan-holds) deletes availability.holds[d] entries pointing to
//     bookings that no longer exist.
//
// What it does NOT do:
//   - Does NOT rebuild the availability.available[d] map. Existing blocks stay as-is.
//   - Does NOT touch cancelled bookings, pricing, payments, guest info, or anything else.
//   - Does NOT trigger any side-effect writes (no updatePropertyAvailability, no email, no cron).
//
// Modes:
//   --dry-run                 (default) Writes CSV preview; NO Firestore writes.
//   --apply                   Performs writes (requires --yes too).
//   --yes                     Confirmation flag required by --apply.
//   --backup-only             Writes the snapshot JSON only, then exits.
//   --restore-from=<path>     Reads the snapshot and restores original timestamps.
//   --upcoming-only           Limit scope to bookings with checkOut >= today.
//   --property=<slug>         Limit scope to one property.
//   --cleanup-orphan-holds    Also delete the orphan availability.holds[d] entries.
//
// Outputs:
//   scripts/migration-changes.csv             — every booking with before/after preview
//   scripts/migration-backup-YYYYMMDDHHMM.json — full pre-migration snapshot (--apply only)
//
// Examples:
//   npx tsx scripts/migrate-booking-dates.ts                     # dry-run, full scope
//   npx tsx scripts/migrate-booking-dates.ts --upcoming-only     # dry-run, future + active
//   npx tsx scripts/migrate-booking-dates.ts --apply --yes --upcoming-only
//   npx tsx scripts/migrate-booking-dates.ts --apply --yes
//   npx tsx scripts/migrate-booking-dates.ts --restore-from=scripts/migration-backup-202605082130.json --yes
//
// Safety: idempotent. Re-running on already-migrated bookings is a no-op (skipped).

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as admin from 'firebase-admin';
import {
  propertyDateAt,
  formatBucharestDate,
  resolvePropertyTime,
} from '../src/lib/dates/property-times';

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

// ---- Args ----

const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const hasYes = args.includes('--yes');
const isBackupOnly = args.includes('--backup-only');
const restoreFrom = args.find(a => a.startsWith('--restore-from='))?.split('=')[1];
const upcomingOnly = args.includes('--upcoming-only');
const propertyFilter = args.find(a => a.startsWith('--property='))?.split('=')[1];
const cleanupOrphanHolds = args.includes('--cleanup-orphan-holds');

if (isApply && !hasYes && !restoreFrom) {
  console.error('--apply requires --yes for confirmation. Aborting.');
  process.exit(1);
}
if (restoreFrom && !hasYes) {
  console.error('--restore-from requires --yes for confirmation. Aborting.');
  process.exit(1);
}

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

const escape = (v: unknown) => {
  const s = v == null ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

interface PropertyData {
  checkInTime?: string;
  checkOutTime?: string;
  [key: string]: unknown;
}

// ---- Restore mode ----

interface BackupEntry {
  id: string;
  propertyId: string;
  checkInDateIso: string;
  checkOutDateIso: string;
}

async function runRestore(snapshotPath: string) {
  console.log(`Restoring from ${snapshotPath}...`);
  const raw = fs.readFileSync(snapshotPath, 'utf-8');
  const entries = JSON.parse(raw) as BackupEntry[];
  console.log(`  ${entries.length} bookings in snapshot.`);

  let restored = 0;
  let skipped = 0;
  for (const entry of entries) {
    const ref = db.collection('bookings').doc(entry.id);
    const doc = await ref.get();
    if (!doc.exists) {
      console.warn(`  Skipping missing doc ${entry.id}`);
      skipped++;
      continue;
    }
    await ref.update({
      checkInDate: admin.firestore.Timestamp.fromDate(new Date(entry.checkInDateIso)),
      checkOutDate: admin.firestore.Timestamp.fromDate(new Date(entry.checkOutDateIso)),
    });
    restored++;
  }
  console.log(`Done. Restored ${restored}, skipped ${skipped}.`);
}

// ---- Migration ----

interface BookingRow {
  id: string;
  propertyId: string;
  status: string;
  source: string;
  guestName: string;
  isFuture: boolean;
  isActive: boolean;
  isPast: boolean;
  checkInBefore: Date;
  checkOutBefore: Date;
  checkInAfter: Date;
  checkOutAfter: Date;
  action: 'migrate' | 'skip-already-migrated' | 'skip-no-property' | 'skip-cancelled' | 'skip-no-dates';
  reason: string;
}

async function loadProperties(): Promise<Map<string, PropertyData>> {
  const snap = await db.collection('properties').get();
  const map = new Map<string, PropertyData>();
  for (const doc of snap.docs) map.set(doc.id, doc.data() as PropertyData);
  return map;
}

function timestampsEqual(a: Date, b: Date): boolean {
  // Within 1 second tolerance to absorb rounding
  return Math.abs(a.getTime() - b.getTime()) < 1000;
}

async function classifyBooking(
  doc: FirebaseFirestore.QueryDocumentSnapshot,
  properties: Map<string, PropertyData>,
  now: Date,
): Promise<BookingRow | null> {
  const data = doc.data();
  const propertyId = (data.propertyId as string) || '';
  const status = (data.status as string) || '';
  const source = (data.source as string) || '';
  const guestName =
    [data.guestInfo?.firstName, data.guestInfo?.lastName].filter(Boolean).join(' ') ||
    '(no name)';

  const checkInBefore = toDate(data.checkInDate);
  const checkOutBefore = toDate(data.checkOutDate);

  if (status === 'cancelled') {
    return mkRow(doc.id, propertyId, status, source, guestName, checkInBefore, checkOutBefore, now,
      checkInBefore, checkOutBefore, 'skip-cancelled', 'cancelled bookings are out of scope');
  }
  if (!checkInBefore || !checkOutBefore) {
    return mkRow(doc.id, propertyId, status, source, guestName, checkInBefore, checkOutBefore, now,
      checkInBefore, checkOutBefore, 'skip-no-dates', 'missing or invalid checkInDate/checkOutDate');
  }
  const property = properties.get(propertyId);
  if (!property) {
    return mkRow(doc.id, propertyId, status, source, guestName, checkInBefore, checkOutBefore, now,
      checkInBefore, checkOutBefore, 'skip-no-property', `property ${propertyId} not found`);
  }

  // Compute new timestamps
  const checkInDateStr = formatBucharestDate(checkInBefore);
  const checkOutDateStr = formatBucharestDate(checkOutBefore);
  const checkInAfter = propertyDateAt(property, checkInDateStr, 'checkin');
  const checkOutAfter = propertyDateAt(property, checkOutDateStr, 'checkout');

  // Idempotency
  if (timestampsEqual(checkInBefore, checkInAfter) && timestampsEqual(checkOutBefore, checkOutAfter)) {
    return mkRow(doc.id, propertyId, status, source, guestName, checkInBefore, checkOutBefore, now,
      checkInAfter, checkOutAfter, 'skip-already-migrated', 'timestamps already at target hours');
  }

  return mkRow(doc.id, propertyId, status, source, guestName, checkInBefore, checkOutBefore, now,
    checkInAfter, checkOutAfter, 'migrate', '');
}

function mkRow(
  id: string,
  propertyId: string,
  status: string,
  source: string,
  guestName: string,
  ciBefore: Date | null,
  coBefore: Date | null,
  now: Date,
  ciAfter: Date | null,
  coAfter: Date | null,
  action: BookingRow['action'],
  reason: string,
): BookingRow {
  const isFuture = !!(ciBefore && ciBefore.getTime() > now.getTime());
  const isActive = !!(ciBefore && coBefore &&
    ciBefore.getTime() <= now.getTime() && coBefore.getTime() > now.getTime());
  const isPast = !!(coBefore && coBefore.getTime() <= now.getTime());
  return {
    id, propertyId, status, source, guestName,
    isFuture, isActive, isPast,
    checkInBefore: ciBefore || new Date(0),
    checkOutBefore: coBefore || new Date(0),
    checkInAfter: ciAfter || new Date(0),
    checkOutAfter: coAfter || new Date(0),
    action, reason,
  };
}

async function runMigration() {
  const now = new Date();

  console.log('Loading properties...');
  const properties = await loadProperties();
  console.log(`  ${properties.size} properties`);
  for (const [id, p] of properties) {
    const ci = resolvePropertyTime(p, 'checkin');
    const co = resolvePropertyTime(p, 'checkout');
    console.log(`    ${id}: checkIn=${String(ci.hours).padStart(2, '0')}:${String(ci.minutes).padStart(2, '0')}` +
      ` checkOut=${String(co.hours).padStart(2, '0')}:${String(co.minutes).padStart(2, '0')}`);
  }

  console.log('\nLoading bookings...');
  let bookingsQuery: FirebaseFirestore.Query = db.collection('bookings');
  if (propertyFilter) bookingsQuery = bookingsQuery.where('propertyId', '==', propertyFilter);
  const snapshot = await bookingsQuery.get();
  console.log(`  ${snapshot.size} bookings`);

  // Classify each
  const rows: BookingRow[] = [];
  for (const doc of snapshot.docs) {
    const row = await classifyBooking(doc, properties, now);
    if (!row) continue;
    if (upcomingOnly && row.isPast) continue;
    rows.push(row);
  }

  // Tally
  const tally: Record<string, number> = {};
  for (const r of rows) tally[r.action] = (tally[r.action] || 0) + 1;
  console.log('\n--- Action tally ---');
  for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(28)} ${v}`);
  }

  // Write CSV
  const csvPath = path.resolve(process.cwd(), 'scripts', 'migration-changes.csv');
  const header = [
    'id', 'propertyId', 'status', 'source', 'guestName',
    'isFuture', 'isActive', 'isPast',
    'checkIn_before_utc', 'checkIn_before_bucharest', 'checkIn_after_utc', 'checkIn_after_bucharest', 'checkIn_delta_seconds',
    'checkOut_before_utc', 'checkOut_before_bucharest', 'checkOut_after_utc', 'checkOut_after_bucharest', 'checkOut_delta_seconds',
    'action', 'reason',
  ].join(',');
  const lines = [header];
  for (const r of rows) {
    const ciDelta = Math.round((r.checkInAfter.getTime() - r.checkInBefore.getTime()) / 1000);
    const coDelta = Math.round((r.checkOutAfter.getTime() - r.checkOutBefore.getTime()) / 1000);
    lines.push([
      r.id, r.propertyId, r.status, r.source, r.guestName,
      r.isFuture, r.isActive, r.isPast,
      r.checkInBefore.toISOString(), formatBucharestDate(r.checkInBefore),
      r.checkInAfter.toISOString(), formatBucharestDate(r.checkInAfter), ciDelta,
      r.checkOutBefore.toISOString(), formatBucharestDate(r.checkOutBefore),
      r.checkOutAfter.toISOString(), formatBucharestDate(r.checkOutAfter), coDelta,
      r.action, r.reason,
    ].map(escape).join(','));
  }
  fs.writeFileSync(csvPath, lines.join('\n'));
  console.log(`\nCSV written: ${csvPath}`);

  const toMigrate = rows.filter(r => r.action === 'migrate');
  console.log(`\nWould migrate: ${toMigrate.length}`);

  // Spot-check the 5 nearest-future migrations
  const upcomingMigrations = toMigrate
    .filter(r => r.isFuture || r.isActive)
    .sort((a, b) => a.checkInBefore.getTime() - b.checkInBefore.getTime())
    .slice(0, 5);
  if (upcomingMigrations.length > 0) {
    console.log('\nNearest-future migrations (review carefully):');
    for (const r of upcomingMigrations) {
      console.log(`  ${r.id}  ${r.guestName.padEnd(28)} ${r.propertyId}`);
      console.log(`    checkIn  : ${r.checkInBefore.toISOString()} → ${r.checkInAfter.toISOString()}` +
        `   (${formatBucharestDate(r.checkInBefore)} → ${formatBucharestDate(r.checkInAfter)} Bucharest)`);
      console.log(`    checkOut : ${r.checkOutBefore.toISOString()} → ${r.checkOutAfter.toISOString()}` +
        `   (${formatBucharestDate(r.checkOutBefore)} → ${formatBucharestDate(r.checkOutAfter)} Bucharest)`);
    }
  }

  if (!isApply && !isBackupOnly) {
    console.log(`\n[DRY RUN] No writes performed. Re-run with --apply --yes to execute.`);
    return;
  }

  // Backup
  const backupTs = new Date().toISOString().replace(/[:.]/g, '').slice(0, 12);
  const backupPath = path.resolve(process.cwd(), 'scripts', `migration-backup-${backupTs}.json`);
  const backup: BackupEntry[] = [];
  for (const r of rows) {
    if (r.action === 'migrate') {
      backup.push({
        id: r.id,
        propertyId: r.propertyId,
        checkInDateIso: r.checkInBefore.toISOString(),
        checkOutDateIso: r.checkOutBefore.toISOString(),
      });
    }
  }
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`\nBackup written: ${backupPath} (${backup.length} entries)`);

  if (isBackupOnly) {
    console.log('[BACKUP ONLY] No writes performed.');
    return;
  }

  // Verify backup parseable
  try {
    JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
  } catch (e) {
    console.error('Backup file failed to re-parse — aborting before any writes.');
    process.exit(1);
  }

  // Apply
  console.log(`\nApplying ${toMigrate.length} updates...`);
  let written = 0;
  let failed = 0;
  // Firestore Admin SDK doesn't have native commitInBatches; use sequential updates with progress.
  for (let i = 0; i < toMigrate.length; i++) {
    const r = toMigrate[i];
    try {
      await db.collection('bookings').doc(r.id).update({
        checkInDate: admin.firestore.Timestamp.fromDate(r.checkInAfter),
        checkOutDate: admin.firestore.Timestamp.fromDate(r.checkOutAfter),
      });
      written++;
      if ((i + 1) % 25 === 0 || i === toMigrate.length - 1) {
        console.log(`  ${i + 1}/${toMigrate.length} written`);
      }
    } catch (err) {
      failed++;
      console.error(`  FAILED: ${r.id} (${r.guestName})`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`\nDone. Written: ${written}. Failed: ${failed}.`);
  if (failed > 0) {
    console.error(`Some updates failed. Review above. Backup is at ${backupPath} for restore.`);
  }

  // Optional orphan-holds cleanup
  if (cleanupOrphanHolds) {
    console.log('\nCleaning up orphan holds...');
    await cleanupOrphanHoldsFn();
  }
}

async function cleanupOrphanHoldsFn() {
  const availSnapshot = await db.collection('availability').get();
  const referenced = new Set<string>();
  for (const doc of availSnapshot.docs) {
    const data = doc.data();
    for (const v of Object.values(data.holds || {})) {
      if (typeof v === 'string' && v) referenced.add(v);
    }
  }
  if (referenced.size === 0) {
    console.log('  No holds[d] entries found. Nothing to clean.');
    return;
  }

  // Check which referenced bookingIds actually exist
  const existing = new Set<string>();
  const ids = [...referenced];
  for (let i = 0; i < ids.length; i += 30) {
    const batch = ids.slice(i, i + 30);
    if (batch.length === 0) continue;
    const snap = await db.collection('bookings')
      .where(admin.firestore.FieldPath.documentId(), 'in', batch)
      .get();
    for (const d of snap.docs) existing.add(d.id);
  }

  let cleaned = 0;
  for (const doc of availSnapshot.docs) {
    const data = doc.data();
    const holds = data.holds || {};
    const toDelete: Record<string, FirebaseFirestore.FieldValue> = {};
    let touched = false;
    for (const [day, bookingId] of Object.entries(holds)) {
      if (typeof bookingId === 'string' && !existing.has(bookingId)) {
        toDelete[`holds.${day}`] = admin.firestore.FieldValue.delete();
        touched = true;
        cleaned++;
      }
    }
    if (touched) {
      await doc.ref.update(toDelete);
      console.log(`  ${doc.id}: cleared ${Object.keys(toDelete).length} orphan holds`);
    }
  }
  console.log(`Done. Cleaned ${cleaned} orphan holds entries.`);
}

// ---- Entry ----

(async () => {
  try {
    if (restoreFrom) {
      await runRestore(restoreFrom);
    } else {
      await runMigration();
    }
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
