/**
 * The acceptance test for the canonical season rules: **resolve(2026) + exceptions = live 2026**.
 *
 *   npx tsx scripts/verify-canonical.ts [propertySlug] [--year 2026] [--verbose] [--selftest]
 *
 * READ-ONLY. It never writes to Firestore, never regenerates a calendar, never moves a price.
 *
 * Why it must exist before the rules are allowed to generate a year: `compileAndWrite` DELETES every
 * compiler-owned row it does not re-emit. That is not theoretical — a missing `basePrice` in the
 * property config silently skipped six periods and deleted seven seasons on 2026-09-06. Step 2 of
 * the pricing organ shipped safely only because `compile ∘ migrate = identity` existed to catch
 * exactly that class of mistake. The canonical table inserts `resolveYear` UPSTREAM of the compiler,
 * so it needs its own proof or it has none.
 *
 * The comparison is on PRICED NIGHTS, not on rows. A layered rule set legitimately produces a
 * different number of periods than the hand-tiled table it replaces while pricing every night the
 * same — that is the whole point of layering. What a guest pays is the only thing that must not
 * move, so that is what is compared, through the same `calculateDayPrice` the booking engine uses.
 *
 * Differences are classified, never hidden:
 *
 *   RULE-GAP   the rules disagree with a date the live table prices. Either the rule is wrong, or
 *              the live row was a hand decision that belongs in the exceptions layer. A person
 *              decides which; this script will not guess.
 *   UNPRICED   the live table prices nothing here and the rules do. Almost always a hole the tiled
 *              table left, and the reason the canonical model exists.
 *   DROPPED    the live table prices a night the rules leave bare. Always a defect in the rules.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { calculateDayPrice, type PropertyPricing, type SeasonalPricing, type DateOverride } from '@/lib/pricing/price-calculation';
import { compilePeriods, DEFAULT_TIER_MULTIPLIERS, type PricingPeriod, type TierMultipliers } from '@/lib/pricing/periods';
import { resolveYear, type HolidayRow } from '@/lib/pricing/resolveYear';
import { SEASON_RULES, SEASON_EXCEPTIONS } from '@/config/pricing-seasons';

const argAt = (flag: string) => { const i = process.argv.indexOf(flag); return i > -1 ? process.argv[i + 1] : undefined; };
const SLUG = process.argv[2]?.startsWith('--') ? 'prahova-mountain-chalet' : (process.argv[2] ?? 'prahova-mountain-chalet');
const YEAR = Number(argAt('--year') ?? 2026);
const VERBOSE = process.argv.includes('--verbose');

/** Fields a guest can feel. `seasonId` is deliberately NOT compared: a layered rule set renames every
 *  season by design, and an id change moves no money. */
const COMPARED = ['adjustedPrice', 'available', 'minimumStay', 'priceSource'] as const;

(async () => {
  const db = await getAdminDb();
  const propDoc = await db.collection('properties').doc(SLUG).get();
  if (!propDoc.exists) throw new Error(`property ${SLUG} not found`);
  const property: any = propDoc.data();
  const tierMultipliers: TierMultipliers = property.pricingConfig?.tierMultipliers ?? DEFAULT_TIER_MULTIPLIERS;
  const basePrice = property.pricePerNight ?? property.pricing?.pricePerNight;
  if (!basePrice) throw new Error(`property ${SLUG} has no pricePerNight — the compiler cannot resolve tiers without it`);

  const propertyPricing: PropertyPricing = {
    pricePerNight: basePrice,
    baseOccupancy: property.baseOccupancy ?? 2,
    extraGuestFee: property.extraGuestFee ?? 0,
    maxGuests: property.maxGuests ?? 8,
    pricingConfig: property.pricingConfig,
    pricing: property.pricing,
  } as PropertyPricing;

  const [holidaySnap, periodSnap] = await Promise.all([
    db.collection('holidays').get(),
    db.collection('pricingPeriods').where('propertyId', '==', SLUG).get(),
  ]);
  // The seeded docs carry no `slug` field — it is the middle segment of the id, `{cc}_{slug}_{year}`
  // (see scripts/seed-holidays.ts). Reading it back off the id is what makes the rules' slug
  // references resolve; without it every holiday anchor silently found nothing.
  const holidays = holidaySnap.docs.map((d) => {
    const x = d.data() as HolidayRow;
    return { ...x, slug: x.slug ?? d.id.split('_')[1] ?? '' };
  });
  const livePeriods = periodSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as object) }) as PricingPeriod)
    .filter((p) => p.status === 'active');

  // ---- resolve ----
  // A season year runs 1 Sep -> 31 Aug, so the live table's calendar span straddles two of them:
  // resolving only one would leave half the table with no rule and report it as DROPPED.
  const a = resolveYear(SEASON_RULES, holidays, YEAR - 1, { propertyId: SLUG, exceptions: SEASON_EXCEPTIONS });
  const b = resolveYear(SEASON_RULES, holidays, YEAR, { propertyId: SLUG, exceptions: SEASON_EXCEPTIONS });
  const resolved = [...a.periods, ...b.periods];

  console.log(`\n=== resolve(${YEAR}) + exceptions = live — ${SLUG} ===`);
  console.log(`rules: ${SEASON_RULES.length}   exceptions: ${SEASON_EXCEPTIONS.length}`);
  console.log(`resolved: ${a.periods.length} period(s) for season ${YEAR - 1}-${String(YEAR % 100).padStart(2, '0')}, ${b.periods.length} for ${YEAR}-${String((YEAR + 1) % 100).padStart(2, '0')}`);
  console.log(`live:     ${livePeriods.length} active period(s)`);

  for (const u of [...a.unresolved, ...b.unresolved]) console.log(`  unresolved  ${u.slug}: ${u.reason}`);
  for (const n of [...a.notes, ...b.notes]) console.log(`  note        ${n}`);

  if (process.argv.includes('--selftest')) {
    // A passing check is only meaningful if the check can fail. Perturb one resolved period and the
    // run below must report differences.
    const victim = resolved.find((p) => p.fixedNightPrice == null && p.priority === 0);
    if (victim) { victim.tier = victim.tier === 'high' ? 'low' : 'high'; console.log(`\n[selftest] perturbed "${victim.slug}" → tier ${victim.tier}. Expect DIFFERENCES.`); }
  }

  // ---- compile both ways ----
  const opts = { tierMultipliers, defaultMinimumStay: property.defaultMinimumStay ?? 1, basePrice };
  const liveC = compilePeriods(livePeriods, opts);
  const ruleC = compilePeriods(resolved, opts);
  for (const w of ruleC.warnings) console.log(`  compiler    [${w.kind}] ${w.message}`);

  const asSeasons = (x: typeof liveC) => x.seasons.map((s) => ({ ...s, enabled: true })) as unknown as SeasonalPricing[];
  const liveSeasons = asSeasons(liveC), ruleSeasons = asSeasons(ruleC);
  const liveOv = liveC.overrides as unknown as DateOverride[], ruleOv = ruleC.overrides as unknown as DateOverride[];

  // The span the live table claims — the only range where "does this match" is a fair question.
  const from = livePeriods.reduce((m, p) => (p.startDate < m ? p.startDate : m), '9999-12-31');
  const to = livePeriods.reduce((m, p) => (p.endDate > m ? p.endDate : m), '0000-01-01');

  // A period-level side-by-side, printed first: it is how a person actually reads a difference, and
  // a night-by-night list of 45 dates does not say "Easter starts a day earlier".
  console.log('\n--- periods: rules vs live ---');
  // Keyed on slug AND year: resolve() is run for two years, and one slug has an instance in each.
  // Keying on slug alone let 2027's Easter overwrite 2026's and compared the wrong pair.
  const key = (p: PricingPeriod) => `${p.slug}_${p.year}`;
  const inRange = (p: PricingPeriod) => p.startDate <= to && p.endDate >= from;
  const liveBySlug = new Map(livePeriods.map((p) => [key(p), p]));
  const ruleBySlug = new Map(resolved.filter(inRange).map((p) => [key(p), p]));
  const shape = (p: PricingPeriod | undefined) =>
    p ? `${p.startDate}→${p.endDate} ${String(p.tier).padEnd(6)} pri${String(p.priority).padStart(4)} min${p.minStay ?? '-'}${p.fixedNightPrice ? ' fixed' + p.fixedNightPrice : ''}${p.weekdayRate ? ' wr' + p.weekdayRate : ''}` : '—';
  for (const k of [...new Set([...ruleBySlug.keys(), ...liveBySlug.keys()])].sort()) {
    const r = ruleBySlug.get(k), l = liveBySlug.get(k);
    const same = r && l && r.startDate === l.startDate && r.endDate === l.endDate;
    console.log(`  ${same ? ' ' : '!'} ${k.padEnd(26)} rules ${shape(r).padEnd(52)} live ${shape(l)}`);
  }

  console.log(`\ncomparing every night ${from} → ${to}`);

  type Diff = { date: string; kind: 'RULE-GAP' | 'UNPRICED' | 'DROPPED'; field: string; live: unknown; rules: unknown };
  const diffs: Diff[] = [];
  let compared = 0;

  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const ds = d.toISOString().slice(0, 10);
    const [y, m, day] = ds.split('-').map(Number);
    // LOCAL construction, exactly as generatePriceCalendar does — the engine reads local components.
    const local = new Date(y, m - 1, day);
    const L: any = calculateDayPrice(propertyPricing, local, liveSeasons, liveOv, []);
    const R: any = calculateDayPrice(propertyPricing, local, ruleSeasons, ruleOv, []);
    compared++;
    // 'weekend' means the uplift fired with NO season behind it — an unpriced day, not a priced one.
    // Reading it as priced put 35 nights of the tiled table's holes into RULE-GAP instead of UNPRICED.
    const priced = (src: string) => src === 'season' || src === 'override';
    const liveHas = priced(L.priceSource), ruleHas = priced(R.priceSource);
    for (const f of COMPARED) {
      if (JSON.stringify(L[f]) === JSON.stringify(R[f])) continue;
      const kind: Diff['kind'] = !liveHas && ruleHas ? 'UNPRICED' : liveHas && !ruleHas ? 'DROPPED' : 'RULE-GAP';
      diffs.push({ date: ds, kind, field: f, live: L[f], rules: R[f] });
    }
  }

  // ---- report ----
  const byKind = (k: Diff['kind']) => diffs.filter((x) => x.kind === k);
  const runs = (list: Diff[]) => {
    // Collapse consecutive dates on the same field into a run — 44 identical lines say less than one.
    const out: string[] = [];
    const byField = new Map<string, Diff[]>();
    for (const x of list) (byField.get(x.field) ?? byField.set(x.field, []).get(x.field)!).push(x);
    for (const [field, xs] of byField) {
      xs.sort((p, q) => p.date.localeCompare(q.date));
      let i = 0;
      while (i < xs.length) {
        let j = i;
        while (j + 1 < xs.length
          && JSON.stringify(xs[j + 1].live) === JSON.stringify(xs[i].live)
          && JSON.stringify(xs[j + 1].rules) === JSON.stringify(xs[i].rules)
          && new Date(`${xs[j + 1].date}T00:00:00Z`).getTime() - new Date(`${xs[j].date}T00:00:00Z`).getTime() === 86_400_000) j++;
        const span = i === j ? xs[i].date : `${xs[i].date}→${xs[j].date}`;
        out.push(`    ${span.padEnd(24)} ${field.padEnd(14)} live ${JSON.stringify(xs[i].live)}  ·  rules ${JSON.stringify(xs[i].rules)}`);
        i = j + 1;
      }
    }
    return out;
  };

  console.log(`\ncompared ${compared} night(s)`);
  for (const k of ['DROPPED', 'RULE-GAP', 'UNPRICED'] as const) {
    const list = byKind(k);
    if (!list.length) continue;
    const dates = new Set(list.map((x) => x.date)).size;
    console.log(`\n--- ${k}  (${dates} night(s), ${list.length} field difference(s)) ---`);
    const lines = runs(list);
    (VERBOSE ? lines : lines.slice(0, 25)).forEach((l) => console.log(l));
    if (!VERBOSE && lines.length > 25) console.log(`    ... ${lines.length - 25} more run(s) — re-run with --verbose`);
  }

  const blocking = byKind('DROPPED').length + byKind('RULE-GAP').length;
  console.log('');
  if (!diffs.length) {
    console.log('IDENTICAL. The rules price every night exactly as the live table does.');
  } else if (!blocking) {
    console.log(`The rules match the live table everywhere it prices, and price ${new Set(byKind('UNPRICED').map((x) => x.date)).size} night(s) it left bare.`);
  } else {
    console.log(`${blocking} field difference(s) need a decision: is the rule wrong, or is the live row a hand decision that belongs in SEASON_EXCEPTIONS?`);
  }
  process.exit(blocking ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
