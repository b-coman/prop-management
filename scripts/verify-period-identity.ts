/**
 * The acceptance test for the period model: **compile ∘ migrate = identity**.
 *
 *   npx tsx scripts/verify-period-identity.ts [propertySlug] [--months N] [--verbose]
 *
 * Migrates today's live pricing rows into periods, compiles them back, and proves the compiled rules
 * price every night in the horizon EXACTLY as the live rules do — field for field, including
 * `seasonId` and `overrideId`, which `priceCalendars` stores and which therefore must not change.
 *
 * Why this test and not "does it look right": a replacement architecture can only be argued about. A
 * compiler can be PROVEN not to have moved anything, which is what lets the model go live in front of
 * a running booking engine with no staging environment.
 *
 * It also reports STORED-vs-LIVE drift as a separate result. Those are different questions: whether
 * the compiler is faithful (identity) and whether the published calendars still match the rules
 * (staleness). Conflating them is how a stale calendar gets mistaken for a compiler bug.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { calculateDayPrice, type PropertyPricing, type SeasonalPricing, type DateOverride } from '@/lib/pricing/price-calculation';
import { compilePeriods, DEFAULT_TIER_MULTIPLIERS, type TierMultipliers } from '@/lib/pricing/periods';
import { migrateToPeriods, type LegacySeasonRow, type LegacyOverrideRow } from '@/lib/pricing/periodMigration';

const SLUG = process.argv[2]?.startsWith('--') ? 'prahova-mountain-chalet' : (process.argv[2] ?? 'prahova-mountain-chalet');
const MONTHS = (() => { const i = process.argv.indexOf('--months'); return i > -1 ? Number(process.argv[i + 1]) : 18; })();
const VERBOSE = process.argv.includes('--verbose');

const COMPARED_FIELDS = [
  'basePrice', 'adjustedPrice', 'available', 'minimumStay', 'isWeekend',
  'priceSource', 'seasonId', 'seasonName', 'overrideId', 'reason',
] as const;

(async () => {
  const db = await getAdminDb();
  const propDoc = await db.collection('properties').doc(SLUG).get();
  if (!propDoc.exists) throw new Error(`property ${SLUG} not found`);
  const property: any = propDoc.data();

  // Built exactly as generatePriceCalendar builds it, so the engine sees identical inputs.
  const propertyPricing: PropertyPricing = {
    id: SLUG,
    pricePerNight: property.pricePerNight || 100,
    baseCurrency: property.baseCurrency || 'EUR',
    baseOccupancy: property.baseOccupancy || 2,
    extraGuestFee: property.extraGuestFee || 0,
    maxGuests: property.maxGuests || 6,
    pricingConfig: property.pricingConfig || {
      weekendAdjustment: (property.pricing?.weekendPricing?.enabled ? property.pricing.weekendPricing.priceMultiplier : 1.0) || 1.0,
      weekendDays: property.pricing?.weekendPricing?.weekendDays || ['friday', 'saturday'],
    },
  };
  const tierMultipliers: TierMultipliers = property.pricingConfig?.tierMultipliers ?? DEFAULT_TIER_MULTIPLIERS;

  // ---- live rules, read the way the generator reads them ----
  const [seasonSnap, overrideSnap] = await Promise.all([
    db.collection('seasonalPricing').where('propertyId', '==', SLUG).get(),
    db.collection('dateOverrides').where('propertyId', '==', SLUG).get(),
  ]);
  const allSeasons = seasonSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  const allOverrides = overrideSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  const liveSeasons = allSeasons.filter((s) => s.enabled === true) as SeasonalPricing[];
  const liveOverrides = allOverrides as DateOverride[];

  // ---- migrate → compile ----
  const { periods, issues } = migrateToPeriods(
    SLUG, allSeasons as LegacySeasonRow[], allOverrides as LegacyOverrideRow[], { tierMultipliers },
  );
  // `--selftest` deliberately breaks one period so the harness must report a difference. A passing
  // identity check is only meaningful if the check is capable of failing; run this whenever the
  // comparison logic changes.
  if (process.argv.includes('--selftest')) {
    const victim = periods.find((p) => p.fixedNightPrice == null);
    if (victim) {
      victim.tier = victim.tier === 'high' ? 'low' : 'high';
      console.log(`\n[selftest] perturbed period "${victim.slug}" → tier ${victim.tier}. Expect DIFFERENCES below.`);
    }
  }

  const compiled = compilePeriods(periods, { tierMultipliers, defaultMinimumStay: property.defaultMinimumStay ?? 1 });

  console.log(`\n=== compile ∘ migrate = identity — ${SLUG} ===`);
  console.log(`live: ${allSeasons.length} seasons (${liveSeasons.length} enabled), ${allOverrides.length} overrides`);
  console.log(`migrated: ${periods.length} periods`);
  console.log(`compiled: ${compiled.seasons.length} seasons, ${compiled.overrides.length} overrides`);

  if (issues.length) {
    console.log('\n--- migration notes ---');
    issues.forEach((i) => console.log(`  [${i.kind}] ${i.message}`));
  }
  if (compiled.warnings.length) {
    console.log('\n--- compiler warnings ---');
    compiled.warnings.forEach((w) => console.log(`  [${w.kind}] ${w.message}`));
  }

  // Rows that stay outside the period model keep pricing days the compiler does not own, so they must
  // be included in the comparison set — otherwise the identity test would pass by ignoring them.
  const migratedSeasonIds = new Set(periods.map((p) => p.legacySeasonId).filter(Boolean));
  const untouchedSeasons = liveSeasons.filter((s) => !migratedSeasonIds.has(s.id));
  const migratedOverrideIds = new Set(periods.flatMap((p) => Object.values(p.legacyOverrideIdByDate ?? {})));
  const untouchedOverrides = liveOverrides.filter((o) => !migratedOverrideIds.has(o.id));

  const newSeasons = [...compiled.seasons.map((s) => ({ ...s, enabled: true })), ...untouchedSeasons] as unknown as SeasonalPricing[];
  const newOverrides = [...compiled.overrides, ...untouchedOverrides] as unknown as DateOverride[];

  if (untouchedSeasons.length || untouchedOverrides.length) {
    console.log(`\ncarried through unchanged (outside the period model): ${untouchedSeasons.length} seasons, ${untouchedOverrides.length} overrides`);
  }

  // ---- price every night both ways ----
  // Dates are built with `new Date(y, m-1, d)` — LOCAL, exactly as generatePriceCalendar does. The
  // engine reads local date components, so constructing them any other way would manufacture a diff.
  const start = new Date();
  start.setDate(1);
  const diffs: Array<{ date: string; field: string; live: unknown; compiled: unknown }> = [];
  let compared = 0;

  for (let i = 0; i < MONTHS; i++) {
    const t = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const y = t.getFullYear(), m = t.getMonth() + 1;
    const dim = new Date(y, m, 0).getDate();
    for (let day = 1; day <= dim; day++) {
      const date = new Date(y, m - 1, day);
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const a: any = calculateDayPrice(propertyPricing, date, liveSeasons, liveOverrides, []);
      const b: any = calculateDayPrice(propertyPricing, date, newSeasons, newOverrides, []);
      compared++;
      for (const f of COMPARED_FIELDS) {
        if (JSON.stringify(a[f]) !== JSON.stringify(b[f])) {
          diffs.push({ date: dateStr, field: f, live: a[f], compiled: b[f] });
        }
      }
      if (JSON.stringify(a.prices) !== JSON.stringify(b.prices)) {
        diffs.push({ date: dateStr, field: 'prices', live: a.prices, compiled: b.prices });
      }
    }
  }

  console.log(`\n--- identity: ${compared} nights compared over ${MONTHS} months ---`);
  if (!diffs.length) {
    console.log('IDENTICAL. The compiled rules price every night exactly as the live rules do.');
  } else {
    console.log(`${diffs.length} DIFFERENCE(S) — the compiler is not faithful. Do not proceed.`);
    diffs.slice(0, 40).forEach((d) => console.log(`  ${d.date}  ${d.field}: live=${JSON.stringify(d.live)} compiled=${JSON.stringify(d.compiled)}`));
    if (diffs.length > 40) console.log(`  ... ${diffs.length - 40} more`);
  }

  // ---- separately: are the PUBLISHED calendars still in step with the rules? ----
  const calSnap = await db.collection('priceCalendars').where('propertyId', '==', SLUG).get();
  const stale: string[] = [];
  // Only from the current month forward. A 2025 calendar generated at the old 180 base rate is not
  // "drifted" — it is history, and nobody can book it. Including it would report 300+ phantom problems
  // and bury any real one.
  const now = new Date();
  const firstLiveMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let calendarsChecked = 0;
  for (const doc of calSnap.docs) {
    const cal: any = doc.data();
    const y = cal.year, m = cal.month;
    if (!y || !m) continue;
    if (`${y}-${String(m).padStart(2, '0')}` < firstLiveMonth) continue;
    calendarsChecked++;
    for (const [dayStr, stored] of Object.entries<any>(cal.days ?? {})) {
      const day = Number(dayStr);
      const fresh: any = calculateDayPrice(propertyPricing, new Date(y, m - 1, day), liveSeasons, liveOverrides, []);
      // `available` is skipped: the generator overlays booked dates onto it, so a false here means a
      // booking, not drift.
      for (const f of ['adjustedPrice', 'minimumStay', 'priceSource', 'seasonId', 'overrideId'] as const) {
        if (JSON.stringify(stored[f]) !== JSON.stringify(fresh[f])) {
          stale.push(`${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')} ${f}: stored=${JSON.stringify(stored[f])} rules=${JSON.stringify(fresh[f])}`);
        }
      }
    }
  }
  console.log(`\n--- published calendars vs live rules (${calendarsChecked} bookable calendars, ${calSnap.size - calendarsChecked} past ones skipped) ---`);
  if (!stale.length) console.log('In step — every published night matches what the rules say today.');
  else {
    console.log(`${stale.length} night-field(s) drifted. This is calendar staleness, NOT a compiler problem.`);
    (VERBOSE ? stale : stale.slice(0, 15)).forEach((s) => console.log(`  ${s}`));
    if (!VERBOSE && stale.length > 15) console.log(`  ... ${stale.length - 15} more (--verbose for all)`);
  }

  process.exit(diffs.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
