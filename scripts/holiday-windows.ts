#!/usr/bin/env npx tsx
/**
 * holiday-windows — do the pricing periods cover the nights each holiday actually sells?
 *
 * A holiday is a date; the stay it produces is a window, set by where that date falls in the week.
 * People leave the city the evening before and drive home on the last day off, and they take a lone
 * working day off to join a holiday to a weekend. So the sellable window is routinely wider than the
 * holiday, and a period that starts inside it charges the ordinary rate for a holiday night.
 *
 * That was live on 1 Decembrie 2026: the period began Saturday 28 Nov, while the stay begins Friday
 * evening 27 Nov. Nobody would find that by reading either collection on its own.
 *
 * Read-only. Reports; changes nothing.
 *
 *   npx tsx scripts/holiday-windows.ts [slug]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { getPeriods } from '@/services/periodService';
import { travelWindow, comparePeriodToWindow, suggestedMinStay } from '@/lib/pricing/travelWindow';

const SLUG = process.argv[2] ?? 'prahova-mountain-chalet';

(async () => {
  const today = new Date().toISOString().slice(0, 10);
  const db = await getAdminDb();
  const holidays = (await db.collection('holidays').get()).docs
    .map((d) => d.data() as { name: string; startDate: string; endDate: string; type: string; official?: boolean })
    .filter((h) => h.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  // Every official day off, so a run can be built from all of them at once — 30 Nov and 1 Dec are one
  // break, not two, and Christmas runs into the weekend beside it.
  const officialDays: Array<{ date: string; name: string }> = [];
  for (const h of holidays) {
    if (h.type === 'school-break') continue;   // a break is not a day the country is off work
    for (let s = h.startDate; s <= h.endDate; ) {
      officialDays.push({ date: s, name: h.name });
      const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); s = d.toISOString().slice(0, 10);
    }
  }

  const periods = (await getPeriods(SLUG)).filter((p) => p.status === 'active');
  let problems = 0;

  console.log(`\n${SLUG} — the stay each holiday actually sells, against the period that prices it\n`);
  for (const h of holidays) {
    if (h.type === 'school-break' || h.type === 'minor') continue;
    const w = travelWindow(h.startDate, h.endDate, officialDays);
    const covering = periods.filter((p) => w.checkIn <= p.endDate && p.startDate < w.checkOut)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    console.log(`${h.name}  (${h.startDate}${h.endDate !== h.startDate ? `→${h.endDate}` : ''})`);
    console.log(`  stay:   ${w.checkIn} → ${w.checkOut}  ${w.nights} night(s)`);
    console.log(`  why:    ${w.why}`);
    if (!covering.length) {
      problems++;
      console.log(`  ISSUE:  no pricing period covers this window at all.\n`);
      continue;
    }
    const cmp = comparePeriodToWindow(covering, w);
    for (const p of covering) {
      console.log(`  period: ${p.name}  ${p.startDate}→${p.endDate}  min ${p.minStay ?? '—'}`);
    }
    if (!cmp.aligned) { problems++; console.log(`  ISSUE:  ${cmp.note}`); }
    else console.log(`  ok:     ${cmp.note}`);
    // The minimum is a property of the WINDOW, so it is judged on the period the guest checks into.
    const entry = covering.find((p) => w.checkIn >= p.startDate && w.checkIn <= p.endDate);
    const wantMin = suggestedMinStay(w);
    if (entry && (entry.minStay ?? 1) < wantMin) {
      console.log(`  note:   ${entry.name} min stay is ${entry.minStay ?? 1}; ${wantMin} fits this window without turning shorter breaks away.`);
    }
    console.log('');
  }

  console.log(problems ? `${problems} window(s) not fully priced as a holiday.\n`
                       : 'Every holiday window is covered by its period.\n');
  process.exit(0);
})();
