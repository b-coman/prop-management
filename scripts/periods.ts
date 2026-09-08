/**
 * The period model's command line.
 *
 *   npx tsx scripts/periods.ts list     [slug]
 *   npx tsx scripts/periods.ts migrate  [slug] [--write]   # seasons+overrides -> pricingPeriods
 *   npx tsx scripts/periods.ts compile  [slug] [--write]   # pricingPeriods -> seasons+overrides
 *   npx tsx scripts/periods.ts worklist [slug] [--year 2027]
 *   npx tsx scripts/periods.ts promote  [slug] [--season 2026] [--write]  # draft -> active
 *   npx tsx scripts/periods.ts add      [slug] --name "..." --start D --end D
 *                                       [--tier base] [--min 2] [--fixed 940]
 *                                       [--trim-previous] [--write]
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
import { DEFAULT_TIER_MULTIPLIERS, compilePeriods, datesInRange, type TierMultipliers, type PricingPeriod } from '@/lib/pricing/periods';
import { calculateDayPrice, type PropertyPricing, type SeasonalPricing, type DateOverride } from '@/lib/pricing/price-calculation';
import { seasonWindow } from '@/lib/pricing/resolveYear';

const CMD = process.argv[2] ?? 'list';
const SLUG = process.argv[3]?.startsWith('--') || !process.argv[3] ? 'prahova-mountain-chalet' : process.argv[3];
const WRITE = process.argv.includes('--write');
const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const YEAR = (() => { const i = process.argv.indexOf('--year'); return i > -1 ? Number(process.argv[i + 1]) : null; })();

async function propertyConfig(slug: string) {
  const db = await getAdminDb();
  const p = (await db.collection('properties').doc(slug).get()).data() as any;
  if (!p) throw new Error(`property ${slug} not found`);
  return {
    tierMultipliers: (p.pricingConfig?.tierMultipliers ?? DEFAULT_TIER_MULTIPLIERS) as TierMultipliers,
    defaultMinimumStay: p.defaultMinimumStay ?? 1,
    // WITHOUT THIS, six periods that state an explicit weekday rate compile to
    // nothing ("cannot be expressed as a multiplier — skipped"), and
    // `compileAndWrite` then DELETES their previously-emitted seasons because they
    // were not re-emitted. Skip-on-warning plus delete-not-emitted is data loss:
    // on 2026-09-07 one `--write` removed Early September, Fall, Vacanta Toamna,
    // Late Fall, 1 Decembrie and Early Winter from `seasonalPricing` in a single
    // batch. The guard now also lives in `compileAndWrite`, which refuses to
    // delete anything when it had to skip a period.
    basePrice: p.pricePerNight ?? p.pricingConfig?.baseRate,
  };
}

const fmt = (p: PricingPeriod) =>
  `  ${p.startDate}→${p.endDate}  ${(p.fixedNightPrice != null ? `FIXED ${p.fixedNightPrice}` : `tier ${p.tier}`).padEnd(12)} ` +
  `pri ${String(p.priority).padStart(3)}  min ${p.minStay ?? '—'}  ${p.status.padEnd(8)} ${p.name}`;

(async () => {
  const db = await getAdminDb();

  // ---- promote: draft -> active, but never without showing what it does to the money first ----
  //
  // A draft prices nothing: both `compilePeriods` and `compileAndWrite` filter to `active`. Promotion
  // is therefore the moment a generated season becomes real, and it is the one step in the whole
  // canonical chain that a person has to agree to. So the dry run prints the PRICE DIFF — every
  // night whose rate or minimum stay changes — rather than a list of row names, which says nothing
  // about what a guest would pay.
  if (CMD === 'promote') {
    const season = arg('season') ? Number(arg('season')) : null;
    const cfg = await propertyConfig(SLUG);
    const all = await getPeriods(SLUG);
    const win = season != null ? seasonWindow(season) : null;
    const drafts = all.filter((p) => p.status === 'draft' && (!win || (p.startDate >= win.from && p.startDate <= win.to)));

    console.log(`\n=== promote — ${SLUG}${season != null ? ` season ${season}-${String((season + 1) % 100).padStart(2, '0')}` : ''} ===`);
    if (!drafts.length) { console.log('no draft periods match.'); return; }
    drafts.forEach((p) => console.log(fmt(p)));

    const prop = (await db.collection('properties').doc(SLUG).get()).data() as any;
    const pp = {
      pricePerNight: prop.pricePerNight, baseOccupancy: prop.baseOccupancy ?? 2,
      extraGuestFee: prop.extraGuestFee ?? 0, maxGuests: prop.maxGuests ?? 8,
      pricingConfig: prop.pricingConfig, pricing: prop.pricing,
    } as PropertyPricing;
    const ids = new Set(drafts.map((d) => d.id));
    const compile = (list: PricingPeriod[]) => {
      const c = compilePeriods(list, cfg);
      return { seasons: c.seasons.map((x) => ({ ...x, enabled: true })) as unknown as SeasonalPricing[],
               overrides: c.overrides as unknown as DateOverride[], warnings: c.warnings };
    };
    const before = compile(all);
    const after = compile(all.map((p) => (ids.has(p.id) ? { ...p, status: 'active' as const } : p)));
    after.warnings.forEach((w) => console.log(`  compiler [${w.kind}] ${w.message}`));

    // Compare across the promoted span only — everything else is untouched by definition.
    const from = drafts.reduce((m, p) => (p.startDate < m ? p.startDate : m), '9999-12-31');
    const to = drafts.reduce((m, p) => (p.endDate > m ? p.endDate : m), '0000-01-01');
    const changes: string[] = [];
    let priced = 0;
    for (const ds of datesInRange(from, to)) {
      const [y, m, d] = ds.split('-').map(Number);
      const at = new Date(y, m - 1, d);
      const a: any = calculateDayPrice(pp, at, before.seasons, before.overrides, []);
      const b: any = calculateDayPrice(pp, at, after.seasons, after.overrides, []);
      if (b.priceSource !== 'base' && b.priceSource !== 'weekend') priced++;
      if (a.adjustedPrice !== b.adjustedPrice || a.minimumStay !== b.minimumStay) {
        changes.push(`    ${ds}  ${String(a.adjustedPrice).padStart(8)} → ${String(b.adjustedPrice).padStart(8)}   min ${a.minimumStay} → ${b.minimumStay}   ${b.seasonName ?? '-'}`);
      }
    }
    const span = datesInRange(from, to).length;
    console.log(`\n${from} → ${to}: ${span} night(s), ${priced} priced by a period after promotion, ${changes.length} night(s) change`);
    changes.slice(0, 20).forEach((c) => console.log(c));
    if (changes.length > 20) console.log(`    ... ${changes.length - 20} more`);

    if (!WRITE) { console.log(`\n${drafts.length} draft(s) would become active. Re-run with --write, then \`compile --write\`.`); return; }
    const batch = db.batch();
    for (const d of drafts) batch.update(db.collection('pricingPeriods').doc(d.id), {
      status: 'active', updatedAt: new Date().toISOString(), updatedBy: 'scripts/periods.ts promote',
    });
    await batch.commit();
    console.log(`\npromoted ${drafts.length} period(s). They price nothing until \`compile --write\` and a calendar regeneration.`);
    return;
  }

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

  if (CMD === 'add') {
    // Create ONE period, then compile — the same one-write-path rule as
    // apply-band-pricing and set-holiday-window, for the same reason: a period
    // written without a compile leaves the calendars disagreeing with the model.
    const name = arg('name');
    const start = arg('start');
    const end = arg('end');
    if (!name || !start || !end) {
      console.error('required: --name "..." --start YYYY-MM-DD --end YYYY-MM-DD [--tier base] [--min 2] [--fixed N] [--trim-previous]');
      process.exit(2);
    }
    const tier = (arg('tier') ?? 'base') as PricingPeriod['tier'];
    const minStay = arg('min') ? Number(arg('min')) : null;
    const fixed = arg('fixed') ? Number(arg('fixed')) : null;
    const existing = (await getPeriods(SLUG)).filter((p) => p.status === 'active');

    // Overlap is not a tie for the engine to break — it is a bug. Refuse, unless
    // the caller explicitly asks to trim the period that is in the way.
    const clash = existing.filter((p) => start <= p.endDate && p.startDate <= end);
    const toTrim: PricingPeriod[] = [];
    if (clash.length) {
      if (!process.argv.includes('--trim-previous')) {
        console.error(`\nrefusing: ${clash.length} active period(s) already cover these dates:`);
        clash.forEach((p) => console.error(fmt(p)));
        console.error('\nPass --trim-previous to pull the earlier period back to the day before this one starts.');
        process.exit(1);
      }
      for (const c of clash) {
        if (c.startDate < start) {
          const d = new Date(`${start}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1);
          toTrim.push({ ...c, endDate: d.toISOString().slice(0, 10) });
        } else {
          console.error(`refusing: ${c.name} (${c.startDate}→${c.endDate}) starts inside the new period; trim it by hand.`);
          process.exit(1);
        }
      }
    }

    // `slug` and `year` are NOT decoration: the compiler builds every emitted season
    // id as `${propertyId}_${year}_${slug}`. Omitting them produced
    // `prahova-mountain-chalet_undefined_undefined` on 2026-09-07 — one id shared by
    // every new period, so the second would have silently overwritten the first.
    const slug = name.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const year = Number(start.slice(0, 4));
    const period = {
      id: `${SLUG}_${slug}_${year}`, propertyId: SLUG, year, slug, name,
      startDate: start, endDate: end, tier,
      priority: fixed != null ? 100 : 0, minStay, fixedNightPrice: fixed,
      status: 'active' as const,
    } as PricingPeriod;

    console.log(`\n=== add — ${SLUG} ${WRITE ? '(WRITING)' : '(dry run)'} ===`);
    toTrim.forEach((t) => console.log(`  trim:  ${t.name} → ends ${t.endDate}`));
    console.log(`  new:   ${fmt(period).trim()}`);
    if (WRITE) {
      await upsertPeriods([...toTrim, period], 'scripts/periods.ts add');
      const cfg = await propertyConfig(SLUG);
      const r = await compileAndWrite(SLUG, { ...cfg, dryRun: false });
      console.log(`\nwritten + compiled (${r.seasons?.length ?? 0} seasons, ${r.overrides?.length ?? 0} overrides).`);
    } else {
      console.log('\nDry run. Re-run with --write.');
    }
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
