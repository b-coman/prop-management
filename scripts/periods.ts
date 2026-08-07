/**
 * The period model's command line.
 *
 *   npx tsx scripts/periods.ts list     [slug]
 *   npx tsx scripts/periods.ts migrate  [slug] [--write]   # seasons+overrides -> pricingPeriods
 *   npx tsx scripts/periods.ts compile  [slug] [--write]   # pricingPeriods -> seasons+overrides
 *   npx tsx scripts/periods.ts worklist [slug] [--year 2027]
 *
 * Always dry-run unless --write. Run `verify-period-identity.ts` before any --write on a property
 * whose prices are live.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { migrateToPeriods, type LegacySeasonRow, type LegacyOverrideRow } from '@/lib/pricing/periodMigration';
import { getPeriods, upsertPeriods, compileAndWrite, horizonFor } from '@/services/periodService';
import { DEFAULT_TIER_MULTIPLIERS, datesInRange, type TierMultipliers, type PricingPeriod } from '@/lib/pricing/periods';

const CMD = process.argv[2] ?? 'list';
const SLUG = process.argv[3]?.startsWith('--') || !process.argv[3] ? 'prahova-mountain-chalet' : process.argv[3];
const WRITE = process.argv.includes('--write');
const YEAR = (() => { const i = process.argv.indexOf('--year'); return i > -1 ? Number(process.argv[i + 1]) : null; })();

async function propertyConfig(slug: string) {
  const db = await getAdminDb();
  const p = (await db.collection('properties').doc(slug).get()).data() as any;
  if (!p) throw new Error(`property ${slug} not found`);
  return {
    tierMultipliers: (p.pricingConfig?.tierMultipliers ?? DEFAULT_TIER_MULTIPLIERS) as TierMultipliers,
    defaultMinimumStay: p.defaultMinimumStay ?? 1,
  };
}

const fmt = (p: PricingPeriod) =>
  `  ${p.startDate}→${p.endDate}  ${(p.fixedNightPrice != null ? `FIXED ${p.fixedNightPrice}` : `tier ${p.tier}`).padEnd(12)} ` +
  `pri ${String(p.priority).padStart(3)}  min ${p.minStay ?? '—'}  ${p.status.padEnd(8)} ${p.name}`;

(async () => {
  const db = await getAdminDb();

  if (CMD === 'list') {
    const periods = await getPeriods(SLUG);
    console.log(`\n=== pricingPeriods — ${SLUG} (${periods.length}) ===`);
    periods.forEach((p) => console.log(fmt(p)));
    if (periods.length) console.log(`\nhorizon: prices needed through ${horizonFor(periods)}`);
    return;
  }

  if (CMD === 'migrate') {
    const { tierMultipliers } = await propertyConfig(SLUG);
    const [s, o] = await Promise.all([
      db.collection('seasonalPricing').where('propertyId', '==', SLUG).get(),
      db.collection('dateOverrides').where('propertyId', '==', SLUG).get(),
    ]);
    const { periods, issues } = migrateToPeriods(
      SLUG,
      s.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as LegacySeasonRow[],
      o.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as LegacyOverrideRow[],
      { tierMultipliers },
    );
    console.log(`\n=== migrate — ${SLUG} ===`);
    console.log(`${WRITE ? 'writing' : 'would write'} ${periods.length} periods:`);
    periods.forEach((p) => console.log(fmt(p)));
    issues.forEach((i) => console.log(`  [${i.kind}] ${i.message}`));
    if (WRITE) { await upsertPeriods(periods, 'scripts/periods.ts migrate'); console.log('\nwritten.'); }
    else console.log('\nDry run. Re-run with --write.');
    return;
  }

  if (CMD === 'compile') {
    const cfg = await propertyConfig(SLUG);
    const r = await compileAndWrite(SLUG, { ...cfg, dryRun: !WRITE });
    console.log(`\n=== compile — ${SLUG} ${r.dryRun ? '(dry run)' : '(WRITTEN)'} ===`);
    console.log(`seasons: ${r.seasonsWritten}   overrides: ${r.overridesWritten}`);
    if (r.seasonsDeleted.length) console.log(`  deleting stale compiler-owned seasons: ${r.seasonsDeleted.join(', ')}`);
    if (r.overridesDeleted.length) console.log(`  deleting stale compiler-owned overrides: ${r.overridesDeleted.length}`);
    if (r.seasonsPreserved.length) console.log(`  preserved (not compiler-owned): ${r.seasonsPreserved.join(', ')}`);
    if (r.overridesPreserved.length) console.log(`  preserved overrides: ${r.overridesPreserved.length}`);
    r.warnings.forEach((w) => console.log(`  [${w.kind}] ${w.message}`));
    if (r.dryRun) console.log('\nDry run. Verify identity first, then re-run with --write.');
    return;
  }

  /**
   * The 2027 problem, as a checklist rather than a computation.
   *
   * Romanian holidays move — Easter 2026 is 10–13 Apr, Easter 2027 is 30 Apr–3 May — so last year's
   * period dates cannot simply be shifted by 365 days. The `holidays` collection holds FETCHED dates
   * (seed-holidays.ts's doctrine: never computed), and this reads them as ANCHORS: for each period
   * that lines up with a holiday, it reports where that holiday actually lands next year. The owner
   * confirms each roll-forward; nothing here writes a price.
   */
  if (CMD === 'worklist') {
    const periods = await getPeriods(SLUG);
    const hSnap = await db.collection('holidays').get();
    const holidays = hSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    const active = periods.filter((p) => p.status === 'active');
    // Default to NEXT calendar year, not max(period.year)+1: a single new-year period spilling into
    // January already makes the max a year ahead, which would skip the year that actually needs pricing.
    const target = YEAR ?? new Date().getFullYear() + 1;
    const sourceYear = target - 1;

    console.log(`\n=== roll-forward worklist: ${sourceYear} → ${target} — ${SLUG} ===`);
    const existing = new Set(active.filter((p) => p.year === target).map((p) => p.slug));
    const src = active.filter((p) => p.year === sourceYear);
    if (!src.length) { console.log(`No active ${sourceYear} periods to roll forward.`); return; }

    let todo = 0;
    for (const p of src) {
      if (existing.has(p.slug)) { console.log(`  OK    ${p.slug} — already exists for ${target}`); continue; }
      todo++;
      const span = new Set(datesInRange(p.startDate, p.endDate));
      const anchors = holidays.filter((h) =>
        String(h.id).endsWith(`_${sourceYear}`) &&
        datesInRange(h.startDate, h.endDate).some((d) => span.has(d)));

      if (!anchors.length) {
        console.log(`  TODO  ${p.slug} (${p.startDate}→${p.endDate}) — no holiday anchor; roll forward by hand.`);
        continue;
      }
      for (const a of anchors) {
        const nextId = String(a.id).replace(`_${sourceYear}`, `_${target}`);
        const next = holidays.find((h) => h.id === nextId);
        if (!next) {
          console.log(`  BLOCK ${p.slug} — anchor "${a.name}" has no ${target} row in \`holidays\`. Seed it first (fetched, never computed).`);
        } else {
          const moved = a.startDate.slice(5) !== next.startDate.slice(5);
          console.log(
            `  ROLL  ${p.slug} (${p.startDate}→${p.endDate})\n` +
            `          anchor "${a.name}": ${sourceYear} ${a.startDate}→${a.endDate}  ⇒  ${target} ${next.startDate}→${next.endDate}` +
            (moved ? '   *** MOVED — do not shift by 365 days ***' : ''),
          );
        }
      }
    }
    console.log(`\n${todo} period(s) need a ${target} row. Nothing was written — each is the owner's confirm.`);
    return;
  }

  console.log('Unknown command. Use: list | migrate | compile | worklist');
  process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
