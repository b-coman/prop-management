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
 * It also checks the derived window against WHAT ACTUALLY SOLD. A derivation can be
 * confidently wrong: on 2026-09-07 this script reported "ok" for Anul Nou with a stay
 * of 31 Dec → 3 Jan, while the last two Revelion bookings had both checked in on the
 * 30th. travelWindow reasons from public holidays, and Revelion is not a bridge
 * holiday — people arrive early for the party. Only the bookings knew.
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

  // What actually sold, so a derived window can be checked against reality rather
  // than only against the periods that price it.
  const bookings = (await db.collection('bookings').where('propertyId', '==', SLUG).get()).docs
    .map((d) => d.data() as Record<string, unknown>)
    .filter((b) => b.status !== 'cancelled')
    .map((b) => {
      const toYmd = (v: unknown): string | null => {
        const x = v as { toDate?: () => Date; _seconds?: number } | string | undefined;
        if (!x) return null;
        if (typeof x === 'string') return x.slice(0, 10);
        if (typeof (x as { toDate?: unknown }).toDate === 'function') return (x as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
        if (typeof (x as { _seconds?: number })._seconds === 'number') return new Date((x as { _seconds: number })._seconds * 1000).toISOString().slice(0, 10);
        return null;
      };
      return { checkIn: toYmd(b.checkInDate), checkOut: toYmd(b.checkOutDate), source: (b.source as string) ?? 'direct' };
    })
    .filter((b): b is { checkIn: string; checkOut: string; source: string } => !!b.checkIn && !!b.checkOut);

  /** Past stays that covered this holiday's calendar days, in ANY year. */
  const soldOn = (h: { startDate: string; endDate: string }) => {
    const md = (s: string) => s.slice(5);
    const from = md(h.startDate), to = md(h.endDate);
    const inAnchor = (ymd: string) => { const m = md(ymd); return from <= to ? m >= from && m <= to : m >= from || m <= to; };
    return bookings.filter((b) => {
      for (let s = b.checkIn; s < b.checkOut; ) {
        if (inAnchor(s)) return true;
        const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); s = d.toISOString().slice(0, 10);
      }
      return false;
    }).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  };

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

    // ── the reality check: does the derived check-in match what people booked? ──
    //
    // Only EARLIER arrivals are a defect. Arriving later just means a guest booked a
    // shorter slice of the window, which is fine. Arriving earlier means the window
    // starts before we think it does, so its first night is being priced as an
    // ordinary one — the exact failure that hid the 30 Dec Revelion arrivals behind
    // a derived 31 Dec.
    //
    // Long stays are excluded: a 28-night booking spans every holiday it passes
    // through and says nothing about when that holiday's guests arrive.
    // A month-day comparison is year-blind. That is fine for Craciun or Revelion,
    // whose dates are stable, and MEANINGLESS for a moveable feast: Easter moved
    // five weeks between 2026 and 2027, so "arrived earlier than 04-29" compares
    // two different holidays. It produced false hits on the first run. For those,
    // report UNVERIFIED rather than an ISSUE.
    const MOVEABLE = /past|rusalii|inaltarea/i;
    const moveable = MOVEABLE.test(h.name);
    const MAX_INCIDENTAL_NIGHTS = 14;
    const nightsOf = (b: { checkIn: string; checkOut: string }) =>
      Math.round((Date.parse(b.checkOut) - Date.parse(b.checkIn)) / 86_400_000);
    /** Days between two dates ignoring the year, signed, nearest way round the calendar. */
    const dayOffset = (from: string, to: string) => {
      const md = (x: string) => (Number(x.slice(5, 7)) - 1) * 31 + Number(x.slice(8, 10));
      let diff = md(to) - md(from);
      if (diff > 186) diff -= 372;
      if (diff < -186) diff += 372;
      return diff;
    };

    const sold = soldOn(h).filter((b) => nightsOf(b) <= MAX_INCIDENTAL_NIGHTS);
    if (moveable) {
      console.log(
        `  sold:   ${sold.length} past stay(s) near this date, but ${h.name} MOVES between years — ` +
        'a month-day comparison would compare two different holidays. UNVERIFIED against real demand.'
      );
    } else if (!sold.length) {
      console.log(`  sold:   no comparable past stay — this window is UNVERIFIED against real demand.`);
    } else {
      const shown = sold.slice(-4);
      console.log(`  sold:   ${sold.length} past stay(s) — ${shown.map((b) => `${b.checkIn}→${b.checkOut} (${b.source})`).join(', ')}`);
      const early = sold.filter((b) => dayOffset(w.checkIn, b.checkIn) < 0);
      if (early.length) {
        problems++;
        const days = Math.max(...early.map((b) => -dayOffset(w.checkIn, b.checkIn)));
        console.log(
          `  ISSUE:  ${early.length} past guest(s) arrived up to ${days} day(s) EARLIER than the derived ` +
          `check-in ${w.checkIn} (${early.map((b) => b.checkIn).join(', ')}). The derivation reasons from ` +
          `public holidays; when people arrive before it, the window's first night is priced as ordinary.`
        );
      }
    }
    console.log('');
  }

  // ── the TAIL: does a period stop owning the night people drive home? ────────
  //
  // The mirror of the departure-evening rule. `travelWindow` says people go home ON
  // the last day off, so the last night SOLD is the night before it. A period that
  // runs through the last day off therefore (a) charges the holiday rate for an
  // ordinary night and (b) — because the engine takes the max minimum across every
  // night — refuses a short stay arriving that day.
  //
  // Live until 2026-09-07: 1 Nov cost 578/min3 beside 405/min2, and 1 Dec cost
  // 587/min3 beside 384/min2. Both refused a 2-night arrival. Across all 175 past
  // bookings, year-corrected, NOBODY has ever slept the last day off of either.
  console.log('holiday tails — does a period stop owning the night people drive home?\n');
  const tailChecks: Array<{ label: string; lastDayOff: string }> = [
    ...holidays.filter((h) => h.type !== 'school-break' && h.type !== 'minor').map((h) => ({ label: h.name, lastDayOff: h.endDate })),
    ...holidays.filter((h) => h.type === 'school-break' && h.startDate !== h.endDate
      && Math.round((Date.parse(h.endDate) - Date.parse(h.startDate)) / 86_400_000) + 1 <= 21)
      .map((h) => ({ label: h.name, lastDayOff: h.endDate })),
  ];
  const seenTail = new Set<string>();
  for (const t of tailChecks) {
    if (seenTail.has(t.lastDayOff)) continue;
    seenTail.add(t.lastDayOff);
    const owner = periods.find((p) => t.lastDayOff >= p.startDate && t.lastDayOff <= p.endDate);
    if (!owner) continue;                        // no period owns it; the coverage check reports that
    if (owner.endDate < t.lastDayOff) continue;  // already ends before — correct

    const dayAfter = (() => { const d = new Date(`${t.lastDayOff}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();
    const next = periods.find((p) => dayAfter >= p.startDate && dayAfter <= p.endDate);
    const ownMin = owner.minStay ?? 1;
    const nextMin = next?.minStay ?? 1;

    if (next && next.id !== owner.id && nextMin < ownMin) {
      problems++;
      console.log(`${t.label}  last day off ${t.lastDayOff}`);
      console.log(`  ISSUE:  ${t.lastDayOff} is still ${owner.name} (min ${ownMin}) though people drive home that day, ` +
        `while ${dayAfter} is ${next.name} (min ${nextMin}). A short arrival on ${t.lastDayOff} is REFUSED and pays the ` +
        `holiday rate. Fix: npx tsx scripts/set-holiday-window.ts ${SLUG} --period ${next.slug} --start ${t.lastDayOff}\n`);
    } else if (!next && owner.endDate === t.lastDayOff) {
      console.log(`${t.label}  last day off ${t.lastDayOff}`);
      console.log(`  note:   ${owner.name} ends on the last day off and NOTHING follows it — shortening it would leave ` +
        `${t.lastDayOff} unpriced. Add the next period first.\n`);
    }
  }

  // ── school breaks: does a period start on the DEPARTURE EVENING? ────────────
  //
  // School-break rows are deliberately kept out of travelWindow above, because the
  // run-walk would swallow a 19-day winter break into one absurd window. But the
  // fence hid a real defect: every Romanian ministerial break starts on a SATURDAY,
  // families leave on the Friday evening, and a period that starts on the Saturday
  // both underprices that Friday AND — because the engine takes the max minimum
  // across every night — refuses a Friday->Sunday stay using the break's minimum.
  // That was live on Autumn Break 2026 until 2026-09-07.
  //
  // Only SHORT breaks. A departure evening on a ten-week summer holiday is meaningless.
  const SHORT_BREAK_MAX_DAYS = 21;
  console.log('school breaks — does a period start on the departure evening?\n');
  for (const h of holidays) {
    if (h.type !== 'school-break') continue;
    if (h.startDate === h.endDate) continue; // a marker, not a break
    const days = Math.round((Date.parse(h.endDate) - Date.parse(h.startDate)) / 86_400_000) + 1;
    if (days > SHORT_BREAK_MAX_DAYS) continue;

    const eveBefore = (() => { const d = new Date(`${h.startDate}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })();
    const startDow = new Date(`${h.startDate}T00:00:00Z`).getUTCDay();
    const owner = periods.find((p) => h.startDate >= p.startDate && h.startDate <= p.endDate);
    const evePeriod = periods.find((p) => eveBefore >= p.startDate && eveBefore <= p.endDate);

    console.log(`${h.name}  ${h.startDate}(${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][startDow]}) → ${h.endDate}  [${days}d]`);
    if (!owner) { problems++; console.log('  ISSUE:  no period covers the break at all.\n'); continue; }
    console.log(`  period: ${owner.name}  ${owner.startDate}→${owner.endDate}  min ${owner.minStay ?? '—'}`);

    if (owner.startDate === h.startDate && evePeriod && evePeriod.id !== owner.id) {
      const eveMin = evePeriod.minStay ?? 1;
      const ownMin = owner.minStay ?? 1;
      problems++;
      console.log(
        `  ISSUE:  the period starts ON the first day off, so ${eveBefore} — the evening families ` +
        `travel — is priced as ${evePeriod.name}` +
        (ownMin > eveMin
          ? `, AND a ${eveBefore} arrival is refused anyway because ${h.startDate} carries min ${ownMin}. ` +
            'Move the period start back a day (set-holiday-window.ts) or lower the minimum.'
          : '. Move the period start back a day so the departure evening is priced as the break.')
      );
    } else if (owner.startDate < h.startDate) {
      console.log(`  ok:     starts ${owner.startDate}, before the break — the departure evening is included.`);
    } else {
      console.log('  ok:     no separate period owns the evening before.');
    }
    console.log('');
  }

  console.log(problems ? `${problems} window(s) not fully priced as a holiday, or contradicted by what sold.\n`
                       : 'Every holiday window is covered by its period and matches what sold.\n');
  process.exit(0);
})();
