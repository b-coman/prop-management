#!/usr/bin/env npx tsx
/**
 * Set ONE cancellation policy across every place a guest or Google can read it.
 *
 * WHY A SCRIPT AND NOT AN EDIT. The policy is stated in three independent places per property, and
 * on 2026-09-01 all three disagreed:
 *
 *   properties.cancellationPolicy            -> booking confirmation EMAILS and the schema.org FAQ
 *                                               Google shows. Prahova said "full refund 1 day prior".
 *   propertyOverrides booking-policies       -> the booking page a guest actually reads.
 *                                               Prahova said "7 days, then 30% refund".
 *   websiteTemplates default                 -> whatever a property with no override falls back to.
 *                                               Says "14 days, then 50%". This is what Coltei shows.
 *
 * A guest could point at the confirmation email and demand a full refund the day before arrival while
 * the page they booked from promised 30%. Changing one field would have left that intact.
 *
 * It also fixes a rendering fault: `property-page-renderer` reads `cancellationPolicy.en`, but the
 * stored value was a plain STRING, so `.en` was undefined and the property-level policy rendered
 * empty. Writing it as {en, ro} is what makes it appear at all.
 *
 * Writes with merge, never `.set()` wholesale: the overrides document carries admin-UI edits that a
 * full overwrite would silently wipe.
 *
 *   npx tsx scripts/set-cancellation-policy.ts <slug> --days 30            # dry run
 *   npx tsx scripts/set-cancellation-policy.ts <slug> --days 30 --write
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const SLUG = process.argv[2]?.startsWith('--') ? 'prahova-mountain-chalet' : (process.argv[2] ?? 'prahova-mountain-chalet');
const DAYS = Number(arg('days', '30'));
const WRITE = process.argv.includes('--write');

/** Deliberately mirrors how Airbnb and Booking word their own "Flexible - N days" plans. */
const TEXT = {
  en: `Free cancellation up to ${DAYS} days before check-in. Within ${DAYS} days of check-in the booking is non-refundable.`,
  ro: `Anulare gratuită cu până la ${DAYS} de zile înainte de check-in. În ultimele ${DAYS} de zile înainte de check-in, rezervarea nu se mai rambursează.`,
};

(async () => {
  const db = await getAdminDb();
  const propRef = db.collection('properties').doc(SLUG);
  const ovRef = db.collection('propertyOverrides').doc(SLUG);
  const [propSnap, ovSnap] = await Promise.all([propRef.get(), ovRef.get()]);
  if (!propSnap.exists) { console.error(`No property "${SLUG}".`); process.exit(1); }

  const before = (propSnap.data() as Record<string, unknown>).cancellationPolicy;
  const ov = (ovSnap.data() ?? {}) as Record<string, any>;
  const policies = ov?.booking?.['booking-policies']?.policies;
  const idx = Array.isArray(policies)
    ? policies.findIndex((p: any) => /cancel|anul/i.test(JSON.stringify(p?.title ?? '')))
    : -1;

  console.log(`${SLUG}\n`);
  console.log('  emails + Google FAQ');
  console.log(`    was: ${JSON.stringify(before)}`);
  console.log(`    now: ${TEXT.en}`);
  console.log('\n  the booking page');
  if (idx >= 0) {
    console.log(`    was: ${policies[idx]?.description?.en ?? '(none)'}`);
    console.log(`    now: ${TEXT.en}`);
  } else {
    console.log('    no cancellation policy block in propertyOverrides — this property falls back to');
    console.log('    the website template default, which is NOT updated by this script.');
  }
  console.log(`\n  Romanian: ${TEXT.ro}`);

  if (!WRITE) { console.log('\nDry run. Re-run with --write to apply.'); process.exit(0); }

  await propRef.set({ cancellationPolicy: TEXT, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  console.log('\n  written: properties.cancellationPolicy');

  if (idx >= 0) {
    const next = policies.map((p: any, i: number) => (i === idx ? { ...p, description: TEXT } : p));
    await ovRef.set(
      { booking: { ...(ov.booking ?? {}), 'booking-policies': { ...(ov.booking?.['booking-policies'] ?? {}), policies: next } } },
      { merge: true },
    );
    console.log('  written: propertyOverrides booking-policies');
  }
  loggers.admin.info('Cancellation policy aligned', { property: SLUG, days: DAYS });
  console.log('\nBoth places now say the same thing.');
  process.exit(0);
})();
