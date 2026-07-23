#!/usr/bin/env npx tsx
/**
 * situation-pack — assembles the deterministic FACT PACK that the LLM analyst reasons over.
 *
 * Design contract (see plans/engagement-system.md §3):
 *   - This script COMPUTES. The analyst READS. The analyst must never do arithmetic.
 *   - Every number the analyst cites must exist here, addressable by path.
 *   - `--as-of <YYYY-MM-DD>` rewinds the clock so the same pack can be replayed historically
 *     (the backtest). Only stay-date-derived facts are reconstructable — see dataQuality.
 *
 * Usage:
 *   npx tsx scripts/situation-pack.ts                          # today, prahova
 *   npx tsx scripts/situation-pack.ts --as-of 2025-07-22       # backtest
 *   npx tsx scripts/situation-pack.ts --property coltei-apartment-bucharest
 *   npx tsx scripts/situation-pack.ts --out pack.json
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getAdminDb } from '../src/lib/firebaseAdminSafe';

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};

const PROPERTY = arg('property', 'prahova-mountain-chalet')!;
const AS_OF = new Date(`${arg('as-of', new Date().toISOString().slice(0, 10))}T00:00:00Z`);
const OUT = arg('out');

const toD = (v: any): Date | null =>
  v?._seconds ? new Date(v._seconds * 1000) : v?.toDate ? v.toDate() : typeof v === 'string' ? new Date(v) : v instanceof Date ? v : null;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const nightsBetween = (a: Date, b: Date) => Math.round((+b - +a) / 86400000);
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const pct = (a: number[], p: number) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length * p)] : null; };
const round = (n: number, d = 0) => Number(n.toFixed(d));
const MN = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const seasonOf = (d: Date) => { const m = d.getUTCMonth() + 1; return m === 12 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn'; };

async function main() {
  const db = await getAdminDb();
  const [bSnap, gSnap, aSnap, rSnap, tSnap] = await Promise.all([
    db.collection('bookings').get(),
    db.collection('guests').get(),
    db.collection('availability').get(),
    db.collection('reviews').get(),
    db.collection('whatsappThreads').get(),
  ]);

  const price = (b: any) => b.pricing?.total ?? b.pricing?.totalPrice ?? 0;

  const allBookings = bSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
    .filter(b => b.propertyId === PROPERTY)
    .map(b => ({ ...b, ci: toD(b.checkInDate), co: toD(b.checkOutDate), created: toD(b.createdAt) }))
    .filter(b => b.ci && b.co);

  const live = allBookings.filter(b => b.status !== 'cancelled');
  // Stays that had already STARTED as of the pack date — the only thing knowable at that time.
  const completed = live.filter(b => b.ci! < AS_OF);

  // ---------- data quality: what can and cannot be reasoned about ----------
  const withRealBookingDate = live.filter(b => b.imported === false);
  const realDates = withRealBookingDate.map(b => b.created).filter(Boolean).sort((a, b) => +a! - +b!);
  const bookingDateFrom = realDates.length ? ymd(realDates[0]!) : null;

  const dataQuality = {
    asOf: ymd(AS_OF),
    bookingDate: {
      available: false,
      availableFrom: bookingDateFrom,
      bookingsWithRealBookingDate: withRealBookingDate.length,
      bookingsWithoutBookingDate: live.length - withRealBookingDate.length,
      note:
        'Bookings were only entered into this system from ~Feb-Mar 2026. Earlier bookings carry ' +
        'createdAt = the IMPORT timestamp, not the real booking date. Therefore: lead-time, ' +
        'booking-pace and "on the books as of date X" are NOT reconstructable for history. ' +
        'Do NOT compare a partial current-year forward book against a prior year\'s FINAL total — ' +
        'that is apples-to-oranges. Pace analysis is valid PROSPECTIVELY only, from 2026-02 onward.',
    },
    pricing: {
      systemPricingInUse: false,
      note:
        'Real rates are managed on Booking.com / Airbnb / VRBO. The pricing config, price calendars ' +
        'and seasonal rules in this system are NOT yet driving sales, and there is no direct booking ' +
        'engine live. "direct" bookings are phone bookings arranged by the owner personally.',
    },
    constraints: {
      minStayNights: 2,
      note: 'Owner-stated: min-stay is 2 nights year-round, with higher minimums only at Christmas, New Year and school breaks. A free run shorter than the minimum cannot be booked as-is.',
    },
    baselineCaveat:
      'performance.monthOfYearBaseline averages 2022-2026, which include large NON-RECURRING foreign ' +
      'waves (2024 DE/UA, 2025 IL) that have now largely ended. Those waves inflate some months\' ' +
      'baselines above what current (low-foreign) demand can reach — and unevenly: a month can be ' +
      'propped by a foreign year in one year and a domestic year in another. So "behind baseline" is ' +
      'a HYPOTHESIS, not a hole. Before flagging a month as underperforming, read its perYear series ' +
      'against origin.byYear and judge whether the baseline leans on foreign years now absent. There ' +
      'is no reliable "corrected" baseline — the achievable-domestic level cannot be derived from ' +
      'history (we cannot observe whether domestic demand would rise to fill vacated foreign dates).',
    amountsNote: 'booking.pricing.total is NET-TO-OWNER — the amount that actually landed in the owner\'s account (owner-confirmed). OTA figures are post-commission (Booking.com / Airbnb pay out net); direct figures are the full amount the guest paid the owner by phone. Therefore ADR and RevPAR are true take-home, and cross-channel ADR is directly comparable as-is — do NOT subtract commission again, it is already out. Caveat: a direct-vs-OTA ADR gap reflects BOTH saved commission AND booking mix (which stays land on which channel), not commission alone.',
    sampleSize: { totalBookings: live.length, completedAsOf: completed.length, cancelled: allBookings.length - live.length },
  };

  // ---------- night ledger (stay-date based — fully reliable) ----------
  const isRO = (c: string) => c === 'RO';
  type Night = { date: string; year: number; month: number; rate: number; src: string; country: string; foreign: boolean; bid: string };
  const ledger: Night[] = [];
  for (const b of live) {
    const los = Math.max(1, nightsBetween(b.ci!, b.co!));
    const perNight = price(b) / los;
    const country = String(b.guestInfo?.country || 'unknown');
    for (let d = new Date(b.ci!); d < b.co!; d = new Date(+d + 86400000)) {
      ledger.push({
        date: ymd(d), year: d.getUTCFullYear(), month: d.getUTCMonth() + 1,
        rate: perNight, src: b.source || 'unknown',
        country, foreign: country !== 'RO' && country !== 'unknown', bid: b.id,
      });
    }
  }
  const pastNights = ledger.filter(n => n.date < ymd(AS_OF));

  const years = [...new Set(pastNights.map(n => n.year))].sort();
  const yearRow = (y: number, upTo?: Date) => {
    const ns = pastNights.filter(n => n.year === y && (!upTo || n.date < ymd(upTo)));
    if (!ns.length) return null;
    const rev = ns.reduce((a, n) => a + n.rate, 0);
    // available nights = days of that year that have already elapsed as of AS_OF
    const yStart = new Date(Date.UTC(y, 0, 1));
    const yEnd = new Date(Date.UTC(y + 1, 0, 1));
    const elapsedEnd = AS_OF < yEnd ? AS_OF : yEnd;
    const available = Math.max(1, nightsBetween(yStart, elapsedEnd));
    return {
      year: y, nightsSold: ns.length, availableNights: available,
      occupancyPct: round(ns.length / available * 100),
      revenue: round(rev), adr: round(rev / ns.length), revpar: round(rev / available),
      bookings: new Set(ns.map(n => n.bid)).size,
      isPartialYear: elapsedEnd < yEnd,
    };
  };

  const performance = {
    byYear: years.map(y => yearRow(y)).filter(Boolean),
    ytdComparable: {
      note: `Jan 1 → ${ymd(AS_OF).slice(5)} of each year. This IS apples-to-apples (completed stays only).`,
      rows: years.map(y => {
        const cut = new Date(Date.UTC(y, AS_OF.getUTCMonth(), AS_OF.getUTCDate()));
        const ns = pastNights.filter(n => n.year === y && n.date < ymd(cut));
        if (!ns.length) return null;
        const rev = ns.reduce((a, n) => a + n.rate, 0);
        const avail = nightsBetween(new Date(Date.UTC(y, 0, 1)), cut);
        return { year: y, nightsSold: ns.length, occupancyPct: round(ns.length / avail * 100), revenue: round(rev), adr: round(rev / ns.length), revpar: round(rev / avail) };
      }).filter(Boolean),
    },
    monthOfYearBaseline: Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const ns = pastNights.filter(n => n.month === m);
      const ys = [...new Set(ns.map(n => n.year))];
      if (!ys.length) return { month: MN[m], monthNum: m, yearsOfData: 0, avgNightsPerYear: null, baselineOccupancyPct: null, adr: null };
      const rev = ns.reduce((a, n) => a + n.rate, 0);
      return {
        month: MN[m], monthNum: m, yearsOfData: ys.length,
        // The current, in-progress month divides sold nights by the FULL month length → understated.
        isPartialMonth: m === AS_OF.getUTCMonth() + 1 && years.includes(AS_OF.getUTCFullYear()),
        avgNightsPerYear: round(ns.length / ys.length, 1),
        baselineOccupancyPct: round(ns.length / ys.length / 30.4 * 100),
        adr: round(rev / ns.length),
        perYear: ys.sort().map(y => {
          const yn = ns.filter(n => n.year === y);
          return { year: y, nights: yn.length, occupancyPct: round(yn.length / daysInMonth(y, m) * 100) };
        }),
      };
    }),
  };

  // ---------- channels & origin ----------
  // CRITICAL: the current year is PARTIAL (only elapsed nights). Comparing a partial year to a
  // prior FULL year is the apples-to-oranges error. Every row is therefore flagged, and a
  // YTD-comparable view (same Jan 1 → as-of window in every year) is provided alongside.
  const currentYear = AS_OF.getUTCFullYear();
  const ytdCut = (y: number) => new Date(Date.UTC(y, AS_OF.getUTCMonth(), AS_OF.getUTCDate()));

  const channelRows = (ns: Night[]) => {
    if (!ns.length) return [];
    return [...new Set(ns.map(n => n.src))].map(s => {
      const sub = ns.filter(n => n.src === s);
      return { source: s, nights: sub.length, sharePct: round(sub.length / ns.length * 100), adr: round(sub.reduce((a, n) => a + n.rate, 0) / sub.length) };
    }).sort((a, b) => b.nights - a.nights);
  };

  const bySrcYear = {
    fullYearNote: 'Rows with isPartialYear=true cover only Jan 1 → as-of. Do NOT compare them against a complete prior year — use ytdComparable below.',
    byYear: years.map(y => ({
      year: y,
      isPartialYear: y === currentYear,
      channels: channelRows(pastNights.filter(n => n.year === y)),
      revenue: round(pastNights.filter(n => n.year === y).reduce((a, n) => a + n.rate, 0)),
    })),
    ytdComparable: {
      note: `Every row covers Jan 1 → ${ymd(AS_OF).slice(5)} of its own year. Safe to compare directly.`,
      byYear: years.map(y => {
        const ns = pastNights.filter(n => n.year === y && n.date < ymd(ytdCut(y)));
        return {
          year: y,
          channels: channelRows(ns).map(c => ({
            ...c,
            revenue: round(ns.filter(n => n.src === c.source).reduce((a, n) => a + n.rate, 0)),
          })),
        };
      }),
    },
  };

  const originRows = (ns: Night[]) => {
    const cm = new Map<string, number>();
    ns.forEach(n => cm.set(n.country, (cm.get(n.country) || 0) + 1));
    return [...cm.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([country, nights]) => ({ country, nights }));
  };
  const byOriginYear = {
    fullYearNote: 'Same partial-year caveat as channels.',
    byYear: years.map(y => ({ year: y, isPartialYear: y === currentYear, origins: originRows(pastNights.filter(n => n.year === y)) })),
    ytdComparable: {
      note: `Jan 1 → ${ymd(AS_OF).slice(5)} of each year. Safe to compare.`,
      byYear: years.map(y => ({ year: y, origins: originRows(pastNights.filter(n => n.year === y && n.date < ymd(ytdCut(y)))) })),
    },
  };

  // ---------- channel × origin cross-tab (pack gap #1 — the one that decides "why did Airbnb fall") ----------
  // Answers whether a channel's decline is domestic or foreign. On this property Airbnb has always
  // been foreign-tilted, so its collapse tracks the end of the foreign waves, not listing decay.
  const channelOriginXtab = {
    note: 'YTD-comparable (Jan 1 → as-of, per year). Romanian vs foreign nights per channel.',
    byYear: years.map(y => {
      const ns = pastNights.filter(n => n.year === y && n.date < ymd(ytdCut(y)));
      const srcs = [...new Set(ns.map(n => n.src))];
      return {
        year: y,
        channels: srcs.map(s => {
          const sub = ns.filter(n => n.src === s);
          const foreign = sub.filter(n => n.foreign);
          const topForeign = [...foreign.reduce((m, n) => m.set(n.country, (m.get(n.country) || 0) + 1), new Map<string, number>()).entries()]
            .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => `${c}:${n}`);
          return { source: s, nights: sub.length, roNights: sub.filter(n => !n.foreign && n.country === 'RO').length, foreignNights: foreign.length, topForeign };
        }).sort((a, b) => b.nights - a.nights),
      };
    }),
  };

  // ---------- booking pace (pack gap #5 — only valid for the 17 real-booking-date bookings) ----------
  const paced = live.filter(b => b.imported === false && b.created && b.ci!)
    .map(b => ({ leadDays: nightsBetween(b.created!, b.ci!), season: seasonOf(b.ci!), month: b.ci!.getUTCMonth() + 1, ci: ymd(b.ci!) }))
    .filter(b => b.leadDays >= 0 && b.leadDays < 400);
  const bookingPace = {
    note: 'REAL booking-date data only (bookings entered from ~Feb 2026 onward). This is the ONLY reliable lead-time signal; historical bookings carry import dates, not booking dates. Small n — prospective use only.',
    n: paced.length,
    leadDays: paced.length ? { p25: pct(paced.map(b => b.leadDays), 0.25), median: pct(paced.map(b => b.leadDays), 0.5), p75: pct(paced.map(b => b.leadDays), 0.75), max: Math.max(...paced.map(b => b.leadDays)) } : null,
    bySeason: ['winter', 'spring', 'summer', 'autumn'].map(s => {
      const arr = paced.filter(b => b.season === s).map(b => b.leadDays);
      return { season: s, n: arr.length, medianLeadDays: arr.length ? pct(arr, 0.5) : null };
    }).filter(x => x.n > 0),
  };

  // ---------- what we sell ----------
  const losArr = completed.map(b => nightsBetween(b.ci!, b.co!)).filter(n => n > 0 && n < 60);
  const partyArr = completed.map(b => b.numberOfGuests || 0).filter(n => n > 0);
  const dowNights = new Map<string, number>();
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  pastNights.forEach(n => { const d = new Date(`${n.date}T00:00:00Z`); dowNights.set(DOW[d.getUTCDay()], (dowNights.get(DOW[d.getUTCDay()]) || 0) + 1); });
  const product = {
    lengthOfStay: { median: pct(losArr, 0.5), mean: round(losArr.reduce((a, b) => a + b, 0) / losArr.length, 1), twoOrThreeNightSharePct: round(losArr.filter(n => n <= 3).length / losArr.length * 100) },
    partySize: { p25: pct(partyArr, 0.25), median: pct(partyArr, 0.5), p75: pct(partyArr, 0.75) },
    withChildrenPct: round(completed.filter(b => (b.numberOfChildren ?? 0) > 0).length / completed.length * 100),
    nightsByDayOfWeek: Object.fromEntries(DOW.map(d => [d, dowNights.get(d) || 0])),
  };

  // ---------- guests: reachability, repeat behaviour, due list ----------
  const guests = gSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
    .filter(g => (g.propertyIds || []).includes(PROPERTY));
  const bookingById = new Map(allBookings.map(b => [b.id, b]));
  const threads = new Map(tSnap.docs.map(d => [d.id, d.data() as any]));
  const reviewsBy = new Map<string, number>();
  rSnap.docs.forEach(d => { const g = (d.data() as any).guestId; if (g) reviewsBy.set(g, (reviewsBy.get(g) || 0) + 1); });

  const FREQ_CAP_DAYS = 14; // matches GROWTH_ENGINE_LIMITS.frequencyCapDays in executionGateway
  const guestRows = guests.map(g => {
    const stayBookings = (g.bookingIds || []).map((id: string) => bookingById.get(id)).filter(Boolean)
      .filter((b: any) => b.status !== 'cancelled' && b.ci && b.ci < AS_OF)
      .sort((a: any, b: any) => +a.ci - +b.ci);
    const stays = stayBookings.map((b: any) => b.ci as Date);
    const lastBooking = stayBookings.length ? stayBookings[stayBookings.length - 1] : null;
    const last = stays.length ? stays[stays.length - 1] : null;
    const th = threads.get(g.id);
    const msgs = (th?.messages || []) as any[];
    const inbound = msgs.filter(m => m.direction === 'in' && m.ts < ymd(AS_OF)).length;
    const outbound = msgs.filter(m => m.direction === 'out' && m.ts < ymd(AS_OF)).length;
    const lastOut = msgs.filter(m => m.direction === 'out' && m.ts < ymd(AS_OF)).map(m => m.ts).sort().pop();
    const tier = stays.length >= 2 ? 'repeat' : inbound >= 3 ? 'engaged' : inbound >= 1 ? 'responsive' : outbound >= 1 ? 'silent' : 'unknown';
    return {
      guestId: g.id, tier,
      reachable: !!g.normalizedPhone && !g.unsubscribed,
      language: g.language || 'unknown',
      stays: stays.length,
      lastStay: last ? ymd(last) : null,
      daysSinceLastStay: last ? nightsBetween(last, AS_OF) : null,
      lastStaySeason: last ? seasonOf(last) : null,
      lastStayHadChildren: lastBooking ? (lastBooking.numberOfChildren ?? 0) > 0 : null,
      hasReview: (reviewsBy.get(g.id) || 0) > 0,
      inboundMessages: inbound,
      // Romanian = the ONLY audience that returns. Verified: of 146 foreign guests ever, exactly 1
      // came back (14 repeat guests = 13 RO + 1 DE). Reactivation/outreach is Romanian by evidence,
      // not assumption. Foreigners are one-and-done OTA/ads acquisition, never retention.
      // Match on language OR country so RO-diaspora and missing-country guests aren't dropped.
      isRomanian: (g.language || '').toLowerCase() === 'ro' || ['RO', 'ROMANIA'].includes(String(g.country || '').toUpperCase()),
      // relationship depth — neutral INFORMATION for the owner, not a permission gate.
      relationship: stays.length >= 2 ? 'repeat' : inbound >= 1 ? 'replied' : outbound >= 1 ? 'messaged-no-reply' : 'never-contacted',
      // freq-cap: is this guest inside a cooling-off window right now?
      // ts is 'YYYY-MM-DDTHH:MM:SS' — slice to the date before making a Date (appending another
      // 'T..Z' to a string that already has a 'T' yields Invalid Date → NaN → everyone mis-flagged).
      contactableNow: !lastOut || nightsBetween(new Date(`${String(lastOut).slice(0, 10)}T00:00:00Z`), AS_OF) >= FREQ_CAP_DAYS,
      daysSinceLastOutbound: lastOut ? nightsBetween(new Date(`${String(lastOut).slice(0, 10)}T00:00:00Z`), AS_OF) : null,
    };
  });

  const reachable = guestRows.filter(g => g.reachable);
  const dueWindow = (g: typeof guestRows[0]) => g.daysSinceLastStay !== null && g.daysSinceLastStay >= 70 && g.daysSinceLastStay <= 252;
  // Return intervals over ALL repeat guests (2+ stays). Origin is carried as a dimension
  // (repeatGuests.byOrigin) rather than filtered — so the RO/foreign split is visible as data.
  const repeatIntervals: number[] = [];
  const seasonPairs = new Map<string, number>();
  guests.forEach(g => {
    const stays = (g.bookingIds || []).map((id: string) => bookingById.get(id)).filter(Boolean)
      .filter((b: any) => b.status !== 'cancelled' && b.ci && b.ci < AS_OF).map((b: any) => b.ci as Date).sort((a: Date, b: Date) => +a - +b);
    for (let i = 1; i < stays.length; i++) {
      repeatIntervals.push(nightsBetween(stays[i - 1], stays[i]));
      const k = `${seasonOf(stays[i - 1])}->${seasonOf(stays[i])}`;
      seasonPairs.set(k, (seasonPairs.get(k) || 0) + 1);
    }
  });

  const buckets = [
    { key: '0-3mo', min: 0, max: 90 }, { key: '3-6mo', min: 91, max: 182 },
    { key: '6-12mo', min: 183, max: 365 }, { key: '1-2y', min: 366, max: 730 },
    { key: '2y+', min: 731, max: 99999 },
  ];
  // Segment a guest set every way that might matter, split by origin. Presented as data only —
  // the pack does not say which segment is "the audience"; that is the analyst's call each week.
  const segment = (set: typeof reachable) => ({
    total: set.length,
    byOrigin: { romanian: set.filter(g => g.isRomanian).length, foreign: set.filter(g => !g.isRomanian).length },
    byRecency: Object.fromEntries(buckets.map(b => [b.key, set.filter(g => g.daysSinceLastStay !== null && g.daysSinceLastStay >= b.min && g.daysSinceLastStay <= b.max).length])),
    noStayDate: set.filter(g => g.daysSinceLastStay === null).length,
    byRelationship: {
      repeat: set.filter(g => g.relationship === 'repeat').length,
      replied: set.filter(g => g.relationship === 'replied').length,
      'messaged-no-reply': set.filter(g => g.relationship === 'messaged-no-reply').length,
      'never-contacted': set.filter(g => g.relationship === 'never-contacted').length,
    },
    bySeasonOfLastStay: set.reduce((m: any, g) => (g.lastStaySeason ? ((m[g.lastStaySeason] = (m[g.lastStaySeason] || 0) + 1), m) : m), {}),
    familySegment: {
      withChildren: set.filter(g => g.lastStayHadChildren === true).length,
      adultsOnly: set.filter(g => g.lastStayHadChildren === false).length,
      unknown: set.filter(g => g.lastStayHadChildren === null).length,
    },
    contactableNow: set.filter(g => g.contactableNow).length,
    inCoolingWindow: set.filter(g => !g.contactableNow).length,
  });

  // Raw fact behind any origin-based retention judgement: how many foreign vs Romanian guests
  // ever returned. No interpretation — the numbers are here; the conclusion is the reader's.
  const everStayed = guestRows.filter(g => g.stays >= 1);
  const repeatGuestRows = guestRows.filter(g => g.stays >= 2);
  const foreignEver = everStayed.filter(g => !g.isRomanian);

  const audience = {
    definitions: {
      reachable: 'has a phone on file and is not unsubscribed',
      relationship: 'repeat = 2+ stays · replied = answered a message · messaged-no-reply · never-contacted (phone captured at an OTA booking, no exchange)',
      contactableNow: `no outbound message within the last ${FREQ_CAP_DAYS} days`,
      familySegment: 'children present on the guest\'s most recent stay',
      recencyBuckets: 'days since last stay; cumulative-eligible (a 2-year-lapsed guest is still a guest)',
    },
    totalGuests: guests.length,
    reachable: reachable.length,
    // origin retention — the raw counts, no conclusion drawn
    repeatGuests: {
      total: repeatGuestRows.length,
      byOrigin: { romanian: repeatGuestRows.filter(g => g.isRomanian).length, foreign: repeatGuestRows.filter(g => !g.isRomanian).length },
      foreignGuestsEver: foreignEver.length,
      foreignThatReturned: foreignEver.filter(g => g.stays >= 2).length,
    },
    returnClock: {
      note: 'all repeat guests (2+ stays); see repeatGuests.byOrigin for the origin split',
      n: repeatIntervals.length,
      medianDays: pct(repeatIntervals, 0.5), p25: pct(repeatIntervals, 0.25), p75: pct(repeatIntervals, 0.75),
      returnedWithinOneYear: repeatIntervals.filter(d => d <= 365).length,
      seasonTransitions: Object.fromEntries([...seasonPairs.entries()].sort((a, b) => b[1] - a[1])),
    },
    // Reachable guests, segmented. `all` and the RO/foreign subsets are all provided; pick per week.
    segments: {
      all: segment(reachable),
      romanian: segment(reachable.filter(g => g.isRomanian)),
      foreign: segment(reachable.filter(g => !g.isRomanian)),
    },
    dueNow: {
      definition: 'reachable guests whose last stay is 70-252 days ago (the p25-p75 of returnClock). A recency slice, provided for reference.',
      count: reachable.filter(dueWindow).length,
      byOrigin: { romanian: reachable.filter(g => dueWindow(g) && g.isRomanian).length, foreign: reachable.filter(g => dueWindow(g) && !g.isRomanian).length },
      bySeasonOfLastStay: reachable.filter(dueWindow).reduce((m: any, g) => ((m[g.lastStaySeason!] = (m[g.lastStaySeason!] || 0) + 1), m), {}),
    },
    newVsRepeatByYear: years.map(y => {
      const bs = live.filter(b => b.ci!.getUTCFullYear() === y && b.ci! < AS_OF);
      let nw = 0, rp = 0;
      bs.forEach(b => {
        const g = guests.find(x => (x.bookingIds || []).includes(b.id));
        if (!g) return;
        const earlier = (g.bookingIds || []).map((id: string) => bookingById.get(id)).filter(Boolean)
          .some((o: any) => o.ci && o.ci < b.ci!);
        earlier ? rp++ : nw++;
      });
      return { year: y, newGuestBookings: nw, repeatBookings: rp };
    }),
  };

  // ---------- forward inventory ----------
  const availDocs = aSnap.docs.filter(d => d.id.startsWith(PROPERTY));
  const availByDate = new Map<string, boolean>();
  const monthsPresent = new Set<string>();
  availDocs.forEach(d => {
    const data: any = d.data();
    const mo = data.month || d.id.split('_').slice(1).join('_');
    if (!mo) return;
    monthsPresent.add(mo);
    Object.entries(data.available || {}).forEach(([day, free]) => availByDate.set(`${mo}-${String(day).padStart(2, '0')}`, !!free));
  });
  const horizon = new Date(+AS_OF + 240 * 86400000);
  const forwardDates: string[] = [];
  for (let d = new Date(AS_OF); d < horizon; d = new Date(+d + 86400000)) forwardDates.push(ymd(d));

  const runs: { start: string; end: string; nights: number }[] = [];
  let cur: string[] = [];
  for (const k of forwardDates) {
    const known = availByDate.has(k);
    const free = known ? availByDate.get(k)! : true; // missing doc = available (availability-service.ts)
    if (free) cur.push(k); else { if (cur.length) runs.push({ start: cur[0], end: cur[cur.length - 1], nights: cur.length }); cur = []; }
  }
  if (cur.length) runs.push({ start: cur[0], end: cur[cur.length - 1], nights: cur.length });

  // Min-stay is 2 nights year-round (exceptions: Christmas, New Year, school breaks — higher).
  // So a 1-NIGHT gap is UNSELLABLE: no one can book it. It only clears if the adjacent guest
  // extends into it, or the owner drops min-stay to 1 for that night. It is NOT a campaign target.
  // A 2-night gap is the minimum sellable unit — a real, fillable opportunity.
  const MIN_STAY = 2;
  const unsellableRuns = runs.filter(r => r.nights < MIN_STAY);   // 1-night → dead unless neighbour extends
  const orphanRuns = runs.filter(r => r.nights === MIN_STAY);     // exactly at the floor — smallest real opportunity
  const forwardMonths = [...new Set(forwardDates.map(d => d.slice(0, 7)))].map(m => {
    const days = forwardDates.filter(d => d.startsWith(m));
    const booked = days.filter(d => availByDate.has(d) && !availByDate.get(d)).length;
    const base = performance.monthOfYearBaseline[+m.slice(5, 7) - 1];
    return {
      month: m, daysInWindow: days.length, bookedNights: booked,
      bookedPct: round(booked / days.length * 100),
      baselineOccupancyPct: base?.baselineOccupancyPct ?? null,
      hasAvailabilityDoc: monthsPresent.has(m),
    };
  });

  // The `availability` collection reflects state RIGHT NOW, not state as of a historical date.
  // Rewinding --as-of therefore produces a forward book contaminated with reservations made
  // AFTER that date. It is not reconstructable (no historical booking dates), so when the pack
  // is replayed historically the whole block is withheld rather than shipped as a plausible lie.
  // (Caught by the 2025-07-22 blind backtest, which correctly refused to act on it.)
  const isHistorical = nightsBetween(AS_OF, new Date()) > 1;

  // Money per free run, so holes can be ranked by value rather than by nights.
  const baselineAdrFor = (dateStr: string) => {
    const m = +dateStr.slice(5, 7);
    return performance.monthOfYearBaseline[m - 1]?.adr ?? null;
  };
  const priceRun = (r: { start: string; end: string; nights: number }) => {
    const adr = baselineAdrFor(r.start);
    // Every month the run touches (start, end, and all in between). A run that crosses a month
    // with no availability doc is built partly from absent data, so flag it — earlier this only
    // checked start/end and missed no-doc months in the middle of a long run.
    const monthsSpanned = new Set<string>();
    for (let d = new Date(`${r.start}T00:00:00Z`); ymd(d) <= r.end; d = new Date(+d + 86400000)) monthsSpanned.add(ymd(d).slice(0, 7));
    const spansUnknownMonths = [...monthsSpanned].filter(m => !monthsPresent.has(m) && m >= ymd(AS_OF).slice(0, 7));
    return {
      ...r, baselineAdr: adr, nightsXBaselineAdr: adr ? round(adr * r.nights) : null,
      ...(spansUnknownMonths.length ? { trustworthy: false, warning: `spans month(s) with no availability doc (${spansUnknownMonths.join(', ')}); those nights are absent data, not confirmed-empty inventory` } : {}),
    };
  };

  // Occasions the free runs can borrow a reason from. Sourced from the `holidays` collection
  // (docs/implementation/firestore-pricing-structure.md §5). If empty, say so — outreach cannot
  // be justified without something true to say.
  const holidaysSnap = await db.collection('holidays').get();
  const occasions = holidaysSnap.docs
    .map(d => d.data() as any)
    .filter(h => h.endDate >= ymd(AS_OF))
    .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))
    .slice(0, 20)
    .map(h => ({ name: h.name, type: h.type, startDate: h.startDate, endDate: h.endDate, source: h.source ?? null }));

  const inventory = isHistorical
    ? {
        valid: false,
        withheldReason:
          `This pack was generated with --as-of ${ymd(AS_OF)}, but the availability collection only ` +
          `holds CURRENT state. A historical forward book cannot be reconstructed (no booking dates ` +
          `before ~2026-02), so it would mix in reservations made after the as-of date. Withheld ` +
          `deliberately. Do not infer anything about forward inventory from this pack.`,
      }
    : {
        valid: true,
        horizonDays: 240,
        freeRuns: runs.slice(0, 25).map(priceRun),
        orphanNights: {
          definition: `free runs of exactly ${MIN_STAY} nights (equal to the min-stay minimum in dataQuality.constraints)`,
          count: orphanRuns.length,
          runs: orphanRuns.slice(0, 20).map(priceRun),
        },
        unsellableUnderMinStay: {
          definition: `free runs SHORTER than the ${MIN_STAY}-night minimum (dataQuality.constraints.minStayNights) — cannot be booked as-is under that minimum`,
          count: unsellableRuns.length,
          runs: unsellableRuns.slice(0, 20).map(priceRun),
        },
        monthsAhead: forwardMonths,
        monthsWithoutAvailabilityDoc: forwardMonths.filter(m => !m.hasAvailabilityDoc).map(m => m.month),
        occasions: {
          count: occasions.length,
          note: occasions.length ? 'upcoming public holidays and school breaks (from the `holidays` collection)' : 'the `holidays` collection is empty — no occasions available; seed it with scripts/seed-holidays.ts',
          upcoming: occasions,
          // Soft bridges: a public holiday sitting 1-2 working days away from a weekend (or from
          // another holiday) makes those working days likely days-off. This WIDENS the real
          // "people are actually free" window well beyond the legal holiday, and it is often the
          // difference between a 2-night and a 5-night sell. Derived, not stored.
          extendedWindows: (() => {
            const holidayDates = new Set<string>();
            holidaysSnap.docs.map(d => d.data() as any)
              .filter(h => h.type === 'major' || h.type === 'minor' || h.type === 'bridge-day')
              .forEach(h => {
                for (let d = new Date(`${h.startDate}T00:00:00Z`); ymd(d) <= h.endDate; d = new Date(+d + 86400000)) holidayDates.add(ymd(d));
              });
            const isOff = (d: Date) => { const w = d.getUTCDay(); return w === 0 || w === 6 || holidayDates.has(ymd(d)); };
            // walk the horizon, collect runs of off-days
            const offRuns: { start: Date; end: Date }[] = [];
            let run: Date[] = [];
            for (let d = new Date(AS_OF); d < new Date(+AS_OF + 400 * 86400000); d = new Date(+d + 86400000)) {
              if (isOff(d)) run.push(new Date(d));
              else { if (run.length) offRuns.push({ start: run[0], end: run[run.length - 1] }); run = []; }
            }
            if (run.length) offRuns.push({ start: run[0], end: run[run.length - 1] });
            // join runs separated by 1-2 working days → those days are the bridge
            const windows: any[] = [];
            for (let i = 0; i < offRuns.length; i++) {
              let start = offRuns[i].start, end = offRuns[i].end;
              const bridges: string[] = [];
              while (i + 1 < offRuns.length) {
                const gap = nightsBetween(end, offRuns[i + 1].start) - 1;
                if (gap >= 1 && gap <= 2) {
                  for (let k = 1; k <= gap; k++) bridges.push(ymd(new Date(+end + k * 86400000)));
                  end = offRuns[i + 1].end; i++;
                } else break;
              }
              const total = nightsBetween(start, end) + 1;
              // only report windows a guest would actually travel for
              if (total >= 4 && (bridges.length || holidayDates.has(ymd(start)) || holidayDates.has(ymd(end)))) {
                windows.push({
                  start: ymd(start), end: ymd(end), totalDays: total,
                  bridgeDaysRequired: bridges.length, bridgeDays: bridges,
                  holidaysInside: [...holidayDates].filter(h => h >= ymd(start) && h <= ymd(end)).sort(),
                });
              }
            }
            return {
              note: 'A holiday next to a weekend with a 1-2 working-day gap: most people burn leave to bridge it. `bridgeDaysRequired` = leave days needed to take the whole window. 0 means it is already a long weekend.',
              windows: windows.slice(0, 12),
            };
          })(),
        },
      };

  // ---------- outreach history ----------
  const outboundDays = new Map<string, Set<string>>();
  tSnap.docs.forEach(d => {
    const t: any = d.data();
    (t.messages || []).forEach((m: any) => {
      if (m.direction !== 'out' || m.ts >= ymd(AS_OF)) return;
      const day = String(m.ts).slice(0, 10);
      if (!outboundDays.has(day)) outboundDays.set(day, new Set());
      outboundDays.get(day)!.add(d.id);
    });
  });
  const campaigns = [...outboundDays.entries()].filter(([, s]) => s.size >= 8).sort()
    .map(([day, gset]) => {
      const dayD = new Date(`${day}T00:00:00Z`);
      let replied = 0, booked = 0;
      gset.forEach(gid => {
        const msgs = ((threads.get(gid)?.messages || []) as any[]);
        if (msgs.some(m => m.direction === 'in' && new Date(m.ts) > dayD && nightsBetween(dayD, new Date(m.ts)) <= 14)) replied++;
        const g = guests.find(x => x.id === gid);
        const after = (g?.bookingIds || []).map((id: string) => bookingById.get(id)).filter(Boolean)
          .some((b: any) => b.ci && b.ci > dayD && nightsBetween(dayD, b.ci) <= 120);
        if (after) booked++;
      });
      return { date: day, recipients: gset.size, repliedWithin14d: replied, replyRatePct: round(replied / gset.size * 100), stayedWithin120d: booked };
    });

  const pack = {
    meta: { generatedFor: PROPERTY, asOf: ymd(AS_OF), generator: 'scripts/situation-pack.ts' },
    dataQuality,
    performance,
    channels: bySrcYear,
    origin: byOriginYear,
    channelOriginXtab,
    bookingPace,
    product,
    audience,
    inventory,
    outreachHistory: { pastCampaigns: campaigns, note: 'past manual outreach runs, with reply and subsequent-stay counts per run' },
  };

  const json = JSON.stringify(pack, null, 2);
  if (OUT) { fs.writeFileSync(OUT, json); console.error(`wrote ${OUT} (${Math.round(json.length / 1024)} KB)`); }
  else console.log(json);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
