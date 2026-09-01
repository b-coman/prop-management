#!/usr/bin/env npx tsx
/**
 * set-holiday-window — move a period's bounds to the stay the holiday actually sells.
 *
 * A holiday period that starts inside its own travel window charges the ordinary rate for a night
 * of a holiday stay. Widening it means moving the neighbouring period's edge too, or the two
 * overlap and the engine has to break a tie that should never have existed.
 *
 * So this does both edges in one write, then compiles and regenerates - the same one-write-path rule
 * as apply-band-pricing, for the same reason: a half-applied pricing change is worse than none, and
 * this system has produced one before.
 *
 * Always dry-run unless --write.
 *
 *   npx tsx scripts/set-holiday-window.ts <slug> --period <slug> --start <date> [--min <n>] [--write]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { getPeriods, upsertPeriods, compileAndWrite } from '@/services/periodService';
import { DEFAULT_TIER_MULTIPLIERS, type TierMultipliers } from '@/lib/pricing/periods';

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : undefined;
};
const SLUG = process.argv[2]?.startsWith('--') ? 'prahova-mountain-chalet' : (process.argv[2] ?? 'prahova-mountain-chalet');
const TARGET = arg('period');
const NEW_START = arg('start');
const NEW_MIN = arg('min') ? Number(arg('min')) : undefined;
const WRITE = process.argv.includes('--write');

const shift = (s: string, n: number) => {
  const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

(async () => {
  if (!TARGET || !NEW_START) {
    console.error('need --period <slug> and --start <YYYY-MM-DD>');
    process.exit(1);
  }
  const periods = await getPeriods(SLUG);
  const target = periods.find((p) => p.slug === TARGET || p.id.endsWith(TARGET));
  if (!target) { console.error(`no period matching "${TARGET}"`); process.exit(1); }
  if (NEW_START >= target.endDate) { console.error('the new start is not before the period end'); process.exit(1); }

  // Whatever period currently owns the day before the new start has to give it up.
  const neighbour = periods.find((p) =>
    p.id !== target.id && p.status === 'active' && NEW_START >= p.startDate && NEW_START <= p.endDate);

  console.log(`\n${SLUG}\n`);
  console.log(`  ${target.name}:  ${target.startDate} → ${target.endDate}   ==>   ${NEW_START} → ${target.endDate}`);
  if (NEW_MIN !== undefined) console.log(`  ${target.name} min stay:  ${target.minStay ?? 1}  ==>  ${NEW_MIN}`);
  if (neighbour) {
    const newEnd = shift(NEW_START, -1);
    if (newEnd < neighbour.startDate) { console.error(`  ${neighbour.name} would end before it starts`); process.exit(1); }
    console.log(`  ${neighbour.name}:  ${neighbour.startDate} → ${neighbour.endDate}   ==>   ${neighbour.startDate} → ${newEnd}`);
  } else {
    console.log(`  (no neighbouring period owns ${NEW_START} — nothing to shrink)`);
  }

  if (!WRITE) { console.log('\nDry run. Re-run with --write.\n'); process.exit(0); }

  const updated = [
    { ...target, startDate: NEW_START, ...(NEW_MIN !== undefined ? { minStay: NEW_MIN } : {}) },
    ...(neighbour ? [{ ...neighbour, endDate: shift(NEW_START, -1) }] : []),
  ];
  await upsertPeriods(updated, 'scripts/set-holiday-window.ts');
  console.log(`\n  wrote ${updated.length} period(s)`);

  const db = await getAdminDb();
  const prop = (await db.collection('properties').doc(SLUG).get()).data() as
    { pricingConfig?: { tierMultipliers?: TierMultipliers }; defaultMinimumStay?: number;
      pricePerNight?: number } | undefined;
  const res = await compileAndWrite(SLUG, {
    tierMultipliers: prop?.pricingConfig?.tierMultipliers ?? DEFAULT_TIER_MULTIPLIERS,
    defaultMinimumStay: prop?.defaultMinimumStay ?? 1,
    basePrice: prop?.pricePerNight,
    dryRun: false,
  });
  // Print the counts, never the payload: the full result is every season, every override and every
  // covered date, which is thousands of characters of noise around the four numbers that matter.
  const r = res as unknown as { seasonsWritten?: number; overridesWritten?: number; warnings?: unknown[] };
  console.log(`  compiled: ${r.seasonsWritten ?? 0} season(s), ${r.overridesWritten ?? 0} override(s), ` +
              `${(r.warnings ?? []).length} warning(s)`);
  console.log('\n  NOW REGENERATE THE CALENDARS:  npx tsx scripts/regenerate-calendars-new-engine.ts\n');
  process.exit(0);
})();
