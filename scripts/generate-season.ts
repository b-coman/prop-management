/**
 * Generate a season year's pricing periods from the canonical rules, as DRAFTS.
 *
 *   npx tsx scripts/generate-season.ts [propertySlug] --season 2026 [--write] [--verbose]
 *
 * A season year runs 1 September to 31 August (`SEASON_YEAR_START`). Dry run by default; `--write`
 * lands the periods with `status: 'draft'`, which both `compilePeriods` and `compileAndWrite`
 * exclude — so nothing prices, and no calendar moves, until a person promotes them to `active`.
 *
 * It refuses to touch anything that already exists:
 *
 *   - a doc id already in `pricingPeriods` is SKIPPED, never overwritten. Ids are
 *     `{property}_{slug}_{year}` and the live table already uses that shape, so a regenerated
 *     Fall would otherwise land straight on top of the Fall people are booking.
 *   - a period overlapping an ACTIVE row AT THE SAME PRIORITY is skipped too. Only same-priority is
 *     a collision: a background at priority 0 running under an active occasion at 100 is the whole
 *     point of layering, and treating that as a clash left 87 nights of the horizon bare because
 *     Winter Low happens to overlap New Year by two days.
 *
 * Both skips are reported by name. The point of this script is to fill the horizon, and a silent
 * skip would leave a hole looking like a success.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { resolveYear, seasonWindow, type HolidayRow } from '@/lib/pricing/resolveYear';
import { SEASON_RULES, SEASON_EXCEPTIONS } from '@/config/pricing-seasons';
import type { PricingPeriod } from '@/lib/pricing/periods';

const argAt = (f: string) => { const i = process.argv.indexOf(f); return i > -1 ? process.argv[i + 1] : undefined; };
const SLUG = process.argv[2]?.startsWith('--') ? 'prahova-mountain-chalet' : (process.argv[2] ?? 'prahova-mountain-chalet');
const SEASON = Number(argAt('--season') ?? new Date().getFullYear());
const WRITE = process.argv.includes('--write');

(async () => {
  const db = await getAdminDb();
  const [holidaySnap, periodSnap] = await Promise.all([
    db.collection('holidays').get(),
    db.collection('pricingPeriods').where('propertyId', '==', SLUG).get(),
  ]);
  // The seeded docs carry no `slug` field — it is the middle segment of the id.
  const holidays = holidaySnap.docs.map((d) => {
    const x = d.data() as HolidayRow;
    return { ...x, slug: x.slug ?? d.id.split('_')[1] ?? '' };
  });
  const existing = periodSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as PricingPeriod);
  const existingIds = new Set(existing.map((p) => p.id));
  const active = existing.filter((p) => p.status === 'active');

  const win = seasonWindow(SEASON);
  const { periods, unresolved, notes } = resolveYear(SEASON_RULES, holidays, SEASON, {
    propertyId: SLUG, status: 'draft', exceptions: SEASON_EXCEPTIONS,
  });

  console.log(`\n=== season ${SEASON}-${String((SEASON + 1) % 100).padStart(2, '0')} — ${SLUG} ===`);
  console.log(`window: ${win.from} → ${win.to}`);
  console.log(`resolved ${periods.length} period(s) from ${SEASON_RULES.length} rule(s)\n`);

  const toWrite: PricingPeriod[] = [];
  for (const p of periods) {
    const clash = active.find((a) => a.startDate <= p.endDate && a.endDate >= p.startDate && a.priority === p.priority);
    const line = `  ${p.startDate}→${p.endDate}  ${String(p.tier).padEnd(6)} pri${String(p.priority).padStart(4)} min${p.minStay ?? '-'}` +
      `${p.fixedNightPrice ? ` fixed${p.fixedNightPrice}` : ''}${p.weekdayRate ? ` wr${p.weekdayRate}` : ''}  ${p.slug}`;
    if (existingIds.has(p.id)) { console.log(`${line}   SKIP — ${p.id} already exists`); continue; }
    if (clash) { console.log(`${line}   SKIP — collides with active "${clash.slug}" (${clash.startDate}→${clash.endDate}) at the same priority ${p.priority}`); continue; }
    console.log(line);
    toWrite.push(p);
  }

  for (const u of unresolved) console.log(`  UNRESOLVED  ${u.slug}: ${u.reason}`);
  for (const n of notes.filter((x) => /PROVISIONAL|exception/.test(x))) console.log(`  note        ${n}`);

  // Coverage, judged over the part of the season the live table does not already own.
  const covered = new Set<string>();
  for (const p of [...toWrite, ...active]) {
    for (let d = p.startDate; d <= p.endDate; d = new Date(new Date(`${d}T00:00:00Z`).getTime() + 864e5).toISOString().slice(0, 10)) {
      if (d >= win.from && d <= win.to) covered.add(d);
    }
  }
  const total = Math.round((Date.parse(win.to) - Date.parse(win.from)) / 864e5) + 1;
  const bare = total - covered.size;
  console.log(`\ncoverage: ${covered.size}/${total} night(s)${bare ? ` — ${bare} STILL BARE` : ' — complete'}`);

  if (!toWrite.length) { console.log('\nnothing new to write.'); return; }
  if (!WRITE) { console.log(`\n${toWrite.length} period(s) would be written as drafts. Re-run with --write.`); return; }

  const batch = db.batch();
  for (const p of toWrite) batch.set(db.collection('pricingPeriods').doc(p.id), { ...p, createdBy: 'scripts/generate-season.ts' });
  await batch.commit();
  console.log(`\nwrote ${toWrite.length} draft period(s). Nothing prices until they are promoted to active.`);
})().catch((e) => { console.error(e); process.exit(1); });
