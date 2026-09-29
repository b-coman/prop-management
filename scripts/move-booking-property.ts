#!/usr/bin/env npx tsx
/**
 * move-booking-property — move a booking from one property to another, and fix BOTH calendars.
 *
 * WHY THIS IS NOT A ONE-FIELD EDIT. `propertyId` is what blocks a calendar. Change it alone and
 * the old property stays blocked for dates nobody is staying, while the new one stays open for
 * dates that are sold. The two calendars have to move with the booking.
 *
 * ORDER IS DELIBERATE: block the destination first, then repoint the booking, then release the
 * source. Every intermediate state is then over-blocked rather than double-sold — if this dies
 * halfway, the worst outcome is a date held twice, which is visible and costs nothing. The
 * reverse order can sell the same night twice.
 *
 * externalBlocks are NEVER touched. They belong to the OTA feeds, not to us: if Airbnb says a
 * date is taken, clearing that would re-open a date the channel has already sold.
 *
 * Dry-run unless --apply.
 *
 *   npx tsx scripts/move-booking-property.ts <bookingId> <toPropertyId> [--apply]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { updateAvailabilityAdmin } from '@/lib/availability-admin';

const [BOOKING, TO] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const APPLY = process.argv.includes('--apply');
if (!BOOKING || !TO) {
  console.error('usage: move-booking-property <bookingId> <toPropertyId> [--apply]');
  process.exit(1);
}

const d = (x: any) => (x?.toDate ? x.toDate() : new Date(x));
const iso = (x: Date) => x.toISOString().slice(0, 10);

(async () => {
  const db = await getAdminDb();
  const ref = db!.collection('bookings').doc(BOOKING);
  const snap = await ref.get();
  if (!snap.exists) { console.error('booking not found'); process.exit(1); }
  const b: any = snap.data();
  const from = b.propertyId;

  if (from === TO) { console.log('already on that property, nothing to do'); process.exit(0); }
  const dest = await db!.collection('properties').doc(TO).get();
  if (!dest.exists) { console.error(`destination property ${TO} does not exist`); process.exit(1); }

  const checkIn = d(b.checkInDate);
  const checkOut = d(b.checkOutDate);

  console.log(`booking   ${BOOKING}`);
  console.log(`guest     ${b.guestInfo?.firstName ?? ''} ${b.guestInfo?.lastName ?? ''} (${b.source}, ${b.status})`);
  console.log(`stay      ${iso(checkIn)} -> ${iso(checkOut)}  (${b.pricing?.numberOfNights}n, ${b.numberOfGuests}g, ${b.pricing?.total} ${b.pricing?.currency})`);
  console.log(`move      ${from}  ->  ${TO}`);

  // Refuse to double-sell: anything else already booked on the destination for these nights.
  const clashes = (await db!.collection('bookings').where('propertyId', '==', TO).get()).docs
    .filter((x) => {
      const o: any = x.data();
      if (x.id === BOOKING) return false;
      if (['cancelled', 'payment_failed'].includes(o.status)) return false;
      const oi = d(o.checkInDate), oo = d(o.checkOutDate);
      return oi < checkOut && oo > checkIn;
    });
  if (clashes.length) {
    console.error(`\nREFUSING: ${TO} already has ${clashes.length} booking(s) over these nights:`);
    for (const c of clashes) {
      const o: any = c.data();
      console.error(`   ${c.id} ${iso(d(o.checkInDate))}->${iso(d(o.checkOutDate))} ${o.source} ${o.status}`);
    }
    process.exit(1);
  }
  console.log(`clash     none on ${TO}`);

  if (!APPLY) {
    console.log('\nWould, in this order:');
    console.log(`   1. block   ${TO} ${iso(checkIn)}..${iso(checkOut)} (exclusive)`);
    console.log(`   2. repoint booking.propertyId -> ${TO}`);
    console.log(`   3. release ${from} for the same nights`);
    console.log('\nDry run. Nothing written. Re-run with --apply.');
    process.exit(0);
  }

  // 1. destination first — an over-blocked night is recoverable, a double-sold one is not
  await updateAvailabilityAdmin(TO, checkIn, checkOut, false);
  console.log(`1. blocked  ${TO}`);

  // 2. the booking itself
  await ref.update({ propertyId: TO, updatedAt: FieldValue.serverTimestamp() });
  console.log(`2. repointed booking -> ${TO}`);

  // 3. source last
  await updateAvailabilityAdmin(from, checkIn, checkOut, true);
  console.log(`3. released ${from}`);

  console.log('\ndone');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
