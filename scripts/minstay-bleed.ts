#!/usr/bin/env npx tsx
/**
 * minstay-bleed — which bookable weekends does a minimum stay quietly refuse?
 *
 * The booking engine applies minimum stay as the MAX ACROSS EVERY NIGHT of the
 * stay (`src/app/api/check-pricing/route.ts:239-248`), not as a check-in
 * constraint. So a period that starts on a Saturday with min 3 also refuses the
 * FRIDAY before it, which belongs to a different period with a lower minimum.
 * Nobody set that rule; it falls out of the boundary.
 *
 * It cost two real weekends on 2026-09-07: Pre-Christmas starting Sat 19 Dec with
 * min 3 refused Fri 18 → Sun 20 Dec (a plain December weekend), and Autumn Break
 * starting Sat 24 Oct refused Fri 23 → Sun 25 Oct. Both were introduced the same
 * afternoon by raising two minimums, and neither was visible until someone went
 * looking. Hence this script.
 *
 * It separates two classes, and only one is a bug:
 *   DELIBERATE  the check-in night itself carries the high minimum — the period means it.
 *   BLEED-BACK  the check-in night is cheap and low-minimum; a LATER night refuses it.
 *
 * Read-only. Reports; changes nothing.
 *
 *   npx tsx scripts/minstay-bleed.ts [slug] [--months 8] [--nights 2]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getAdminDb } from '@/lib/firebaseAdminSafe';

const SLUG = process.argv[2]?.startsWith('--') || !process.argv[2] ? 'prahova-mountain-chalet' : process.argv[2];
const arg = (n: string, d: number) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? Number(process.argv[i + 1]) : d;
};
const MONTHS = arg('months', 8);
const NIGHTS = arg('nights', 2);

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const add = (s: string, n: number) => new Date(new Date(`${s}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const dow = (s: string) => DOW[new Date(`${s}T00:00:00Z`).getUTCDay()];

interface Cell { min: number; price: number }

(async () => {
  const db = await getAdminDb();
  const today = new Date().toISOString().slice(0, 10);

  const cal: Record<string, Cell> = {};
  for (let i = 0; i < MONTHS; i++) {
    const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + i);
    const ym = d.toISOString().slice(0, 7);
    const doc = await db.collection('priceCalendars').doc(`${SLUG}_${ym}`).get();
    const days = (doc.data() as { days?: Record<string, { minimumStay?: number; adjustedPrice?: number }> } | undefined)?.days ?? {};
    for (const k of Object.keys(days)) {
      cal[`${ym}-${String(k).padStart(2, '0')}`] = {
        min: days[k].minimumStay ?? 1,
        price: days[k].adjustedPrice ?? 0,
      };
    }
  }

  const deliberate: string[] = [];
  const bleed: Array<{ start: string; culprit: string; min: number; value: number }> = [];

  for (const start of Object.keys(cal).sort()) {
    if (start < today) continue;
    if (dow(start) !== 'Fri') continue;          // the weekend is the case that matters
    const nights = Array.from({ length: NIGHTS }, (_, i) => add(start, i));
    if (!nights.every((n) => cal[n])) continue;

    const maxMin = Math.max(...nights.map((n) => cal[n].min));
    if (maxMin <= NIGHTS) continue;              // the stay is allowed

    const value = Math.round(nights.reduce((s, n) => s + cal[n].price, 0));
    if (cal[start].min === maxMin) {
      deliberate.push(`${start}(${dow(start)}) min ${maxMin}`);
    } else {
      const culprit = nights.find((n) => cal[n].min === maxMin)!;
      bleed.push({ start, culprit, min: maxMin, value });
    }
  }

  console.log(`\n${SLUG} — ${NIGHTS}-night weekends refused by a minimum stay, next ${MONTHS} months\n`);

  if (deliberate.length) {
    console.log(`DELIBERATE (${deliberate.length}) — the check-in night itself carries the minimum, as intended:`);
    deliberate.forEach((d) => console.log(`  ${d}`));
    console.log('');
  }

  if (!bleed.length) {
    console.log('BLEED-BACK: none. No weekend is refused by a minimum belonging to a later night.\n');
    process.exit(0);
  }

  console.log(`🔴 BLEED-BACK (${bleed.length}) — a cheap, low-minimum Friday refused by a LATER night:`);
  console.log('   check-in        refused by              lost');
  let lost = 0;
  for (const b of bleed) {
    lost += b.value;
    console.log(`   ${b.start}(${dow(b.start)})   ${b.culprit}(${dow(b.culprit)}) min ${b.min}        ${b.value} lei`);
  }
  console.log(`\n   ~${lost} lei of accommodation value refused by a rule nobody set.`);
  console.log('   Fix: lower the later period\'s minimum, or move its start back to the departure');
  console.log('   evening so the constraint becomes deliberate rather than accidental.\n');
  process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
