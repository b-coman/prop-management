/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * situationPack — assembles the deterministic FACT PACK the LLM analyst reasons over, IN-APP.
 * Extracted verbatim from `scripts/situation-pack.ts` (arch §7 M2/P1) so the in-app analyst service
 * (`src/services/growth/situationAnalyst.ts`) and the CLI/backtest wrapper build the SAME pack.
 *
 * Design contract (see plans/engagement-system.md §3):
 *   - This COMPUTES. The analyst READS. The analyst must never do arithmetic.
 *   - Every number the analyst cites must exist here, addressable by path.
 *   - `asOf` rewinds the clock so the same pack can be replayed historically (the backtest). Only
 *     stay-date-derived facts are reconstructable — see `dataQuality`.
 *
 * Server-only (Admin SDK + read-only Meta GETs). `META_ADS_TOKENS` is read from the runtime env for
 * the currentSignals block; the CLI wrapper loads it from Secret Manager for local dev. A missing
 * token just degrades currentSignals to `available:false` — it never breaks the build.
 */
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { getPageHealth, getAdAccountHealth } from '@/services/growth/metaAds/brandHealth';
import { computeRecentCancellations, computeOutreachLedger } from '@/lib/growth/signals';
import { getNotesByGuest, isTouch } from '@/services/guestNoteService';
import { normalizeChannel } from '@/lib/channels';

const toD = (v: any): Date | null =>
  v?._seconds ? new Date(v._seconds * 1000) : v?.toDate ? v.toDate() : typeof v === 'string' ? new Date(v) : v instanceof Date ? v : null;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const nightsBetween = (a: Date, b: Date) => Math.round((+b - +a) / 86400000);
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const pct = (a: number[], p: number) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length * p)] : null; };
const round = (n: number, d = 0) => Number(n.toFixed(d));
const MN = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const seasonOf = (d: Date) => { const m = d.getUTCMonth() + 1; return m === 12 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn'; };

/** The deterministic fact pack. Top-level keys are typed; the analyst reads by path (validator checks specifics). */
export interface SituationPack {
  meta: { generatedFor: string; asOf: string; generator: string };
  dataQuality: unknown;
  currentSignals: unknown;
  performance: unknown;
  channels: unknown;
  origin: unknown;
  channelOriginXtab: unknown;
  bookingPace: unknown;
  product: unknown;
  audience: unknown;
  inventory: unknown;
  outreachHistory: unknown;
}

/**
 * Build the situation fact pack for a property as of a date. `generator` labels the pack's origin
 * (the CLI passes 'scripts/situation-pack.ts' so its output stays identical; in-app callers get the
 * lib default).
 */
export async function buildSituationPack(
  propertyId: string,
  asOf: Date,
  opts?: { generator?: string },
): Promise<SituationPack> {
  const PROPERTY = propertyId;
  const AS_OF = asOf;
  const generator = opts?.generator ?? 'src/lib/growth/situationPack.ts';

  const db = await getAdminDb();
  const [bSnap, gSnap, aSnap, rSnap, tSnap, notesByGuest, cSnap] = await Promise.all([
    db.collection('bookings').get(),
    db.collection('guests').get(),
    db.collection('availability').get(),
    db.collection('reviews').get(),
    db.collection('whatsappThreads').get(),
    getNotesByGuest(),
    db.collection('priceCalendars').where('propertyId', '==', propertyId).get(),
  ]);

  // ---------- what the property is ASKING, per night ----------
  // The pack used to carry two hardcoded claims about pricing: that in-system pricing was not live,
  // and that the minimum stay was 2 nights everywhere. Both are read from the calendar now. The
  // min-stay one was materially wrong on the year's most valuable dates (24-27 and 30-31 Dec require
  // 3), which made orphanNights and unsellableUnderMinStay wrong exactly there.
  const minStayByDate = new Map<string, number>();
  const askingByDate = new Map<string, number>();
  cSnap.docs.forEach(d => {
    const data: any = d.data();
    const mo = `${data.year}-${String(data.month).padStart(2, '0')}`;
    Object.entries(data.days || {}).forEach(([day, v]: [string, any]) => {
      const key = `${mo}-${String(day).padStart(2, '0')}`;
      if (typeof v?.minimumStay === 'number') minStayByDate.set(key, v.minimumStay);
      if (typeof v?.adjustedPrice === 'number') askingByDate.set(key, v.adjustedPrice);
    });
  });
  const minStayValues = [...minStayByDate.values()];
  const baseMinStay = minStayValues.length ? Math.min(...minStayValues) : 1;
  const maxMinStay = minStayValues.length ? Math.max(...minStayValues) : 1;
  const minStayFor = (dateStr: string) => minStayByDate.get(dateStr) ?? baseMinStay;

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
      // Derived, not asserted: a populated calendar means the direct booking engine quotes from these
      // rules. (This was hardcoded `false` with a note saying no direct engine was live — untrue since
      // the engine went live, and the analyst method tells you to read this block before reasoning
      // about price, so it made the `price` and `ota` instruments unreachable.)
      systemPricingInUse: cSnap.size > 0,
      calendarsLoaded: cSnap.size,
      askingPriceNightsKnown: askingByDate.size,
      note: cSnap.size > 0
        ? 'The direct booking engine quotes from these price calendars — inventory.freeRuns carries ' +
          'askingAdr per run, which is the CURRENT ask, distinct from baselineAdr (historical achieved, ' +
          'net-of-commission). Rates on Booking.com / Airbnb / VRBO are set separately by the owner and ' +
          'are NOT in this pack; do not assume the direct ask equals any channel price.'
        : 'No price calendars found — the direct ask is unknown for this property.',
    },
    constraints: {
      // Read per-date from the price calendars rather than assumed. A run is only sellable if it meets
      // the minimum on ITS OWN dates, which is higher over Christmas and New Year.
      minStayNights: baseMinStay,
      maxMinStayNights: maxMinStay,
      note: `Minimum stay VARIES by date (read from priceCalendars.days[].minimumStay): most nights ` +
        `require ${baseMinStay}, peaks require up to ${maxMinStay}. orphanNights and ` +
        `unsellableUnderMinStay are evaluated against each run's OWN minimum, not a single figure. ` +
        `A free run shorter than its own minimum cannot be booked as-is.`,
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
    currentSignals: {
      isAsOfReproducible: false,
      note:
        'pack.currentSignals holds LIVE Facebook page + ad-account state read from Meta at pack-build ' +
        'time. It has NO history and does NOT correspond to --as-of, so it is WITHHELD on a historical ' +
        'backtest. Use it only for "current brand/acquisition health" (is the page alive, is the website ' +
        'link correct, is an account spend limit set, is there conversion history) — never as a dated ' +
        'fact inside a trend or a like-for-like comparison.',
    },
  };

  // ---------- night ledger (stay-date based — fully reliable) ----------
  type Night = { date: string; year: number; month: number; rate: number; src: string; country: string; foreign: boolean; bid: string };
  const ledger: Night[] = [];
  for (const b of live) {
    const los = Math.max(1, nightsBetween(b.ci!, b.co!));
    const perNight = price(b) / los;
    const country = String(b.guestInfo?.country || 'unknown');
    for (let d = new Date(b.ci!); d < b.co!; d = new Date(+d + 86400000)) {
      ledger.push({
        date: ymd(d), year: d.getUTCFullYear(), month: d.getUTCMonth() + 1,
        // Normalised, so one channel is one row: the live data contains a `travelmint` typo and
        // in-flight direct bookings say `website-pending`. Unmapped values stay VISIBLE rather than
        // being dropped or bucketed — a channel nothing recognises is worth seeing in the report.
        rate: perNight, src: normalizeChannel(b.source) ?? (b.source ? `unmapped:${b.source}` : 'unknown'),
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
    const lastOutMsg = msgs.filter(m => m.direction === 'out' && m.ts < ymd(AS_OF)).map(m => String(m.ts).slice(0, 10)).sort().pop();
    // Logged phone/in-person contact counts as engagement AND as contact (see guestNoteService):
    // without it a phone-first relationship reads as "messaged, never replied".
    const calls = (notesByGuest.get(g.id) || []).filter(n => isTouch(n.kind) && n.occurredAt <= ymd(AS_OF));
    const lastCall = calls.map(n => n.occurredAt).sort().pop();
    const lastOut = [lastOutMsg, lastCall].filter(Boolean).sort().pop();
    const engagements = inbound + calls.length;
    const tier = stays.length >= 2 ? 'repeat' : engagements >= 3 ? 'engaged' : engagements >= 1 ? 'responsive' : outbound >= 1 ? 'silent' : 'unknown';
    return {
      guestId: g.id, tier,
      kind: (g.kind || 'guest') as 'guest' | 'lead',
      nonConversionReason: g.nonConversionReason || null,
      requestedPeriods: (g.requestedPeriods || []) as Array<{ start: string; end: string; askedOn: string; outcome: string; note?: string }>,
      firstContactAt: g.firstContactAt || null,
      reachable: !!g.normalizedPhone && !g.unsubscribed,
      language: g.language || 'unknown',
      stays: stays.length,
      lastStay: last ? ymd(last) : null,
      daysSinceLastStay: last ? nightsBetween(last, AS_OF) : null,
      lastStaySeason: last ? seasonOf(last) : null,
      lastStayHadChildren: lastBooking ? (lastBooking.numberOfChildren ?? 0) > 0 : null,
      hasReview: (reviewsBy.get(g.id) || 0) > 0,
      inboundMessages: inbound,
      loggedCalls: calls.length,
      // Romanian = the ONLY audience that returns. Verified: of 146 foreign guests ever, exactly 1
      // came back (14 repeat guests = 13 RO + 1 DE). Reactivation/outreach is Romanian by evidence,
      // not assumption. Foreigners are one-and-done OTA/ads acquisition, never retention.
      // Match on language OR country so RO-diaspora and missing-country guests aren't dropped.
      isRomanian: (g.language || '').toLowerCase() === 'ro' || ['RO', 'ROMANIA'].includes(String(g.country || '').toUpperCase()),
      // relationship depth — neutral INFORMATION for the owner, not a permission gate.
      relationship: stays.length >= 2 ? 'repeat' : engagements >= 1 ? 'replied' : outbound >= 1 ? 'messaged-no-reply' : 'never-contacted',
      // freq-cap: is this guest inside a cooling-off window right now?
      // ts is 'YYYY-MM-DDTHH:MM:SS' — slice to the date before making a Date (appending another
      // 'T..Z' to a string that already has a 'T' yields Invalid Date → NaN → everyone mis-flagged).
      contactableNow: !lastOut || nightsBetween(new Date(`${String(lastOut).slice(0, 10)}T00:00:00Z`), AS_OF) >= FREQ_CAP_DAYS,
      daysSinceLastOutbound: lastOut ? nightsBetween(new Date(`${String(lastOut).slice(0, 10)}T00:00:00Z`), AS_OF) : null,   // outbound message OR logged call
    };
  });

  // Leads never stayed, so they must not dilute the stay-based audience view — they are reported
  // separately under `audience.leads`.
  const leadRows = guestRows.filter(g => g.kind === 'lead');
  const guestOnlyRows = guestRows.filter(g => g.kind !== 'lead');
  const reachable = guestOnlyRows.filter(g => g.reachable);
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
  const everStayed = guestOnlyRows.filter(g => g.stays >= 1);
  const repeatGuestRows = guestOnlyRows.filter(g => g.stays >= 2);
  const foreignEver = everStayed.filter(g => !g.isRomanian);

  const audience = {
    definitions: {
      reachable: 'has a phone on file and is not unsubscribed',
      relationship: 'repeat = 2+ stays · replied = answered a message · messaged-no-reply · never-contacted (phone captured at an OTA booking, no exchange)',
      contactableNow: `no outbound message within the last ${FREQ_CAP_DAYS} days`,
      familySegment: 'children present on the guest\'s most recent stay',
      recencyBuckets: 'days since last stay; cumulative-eligible (a 2-year-lapsed guest is still a guest)',
    },
    totalGuests: guestOnlyRows.length,
    reachable: reachable.length,
    // People who contacted us directly and never stayed. Kept out of the counts above (they have no
    // stay) but tracked here, because they are the only warm audience acquired at zero commission.
    leads: {
      definition: 'contacted us directly but never booked. No stay to reference — what they have instead is a request and a reason it went unfilled (nonConversionReason: unavailable | declined | unservable | unresolved).',
      total: leadRows.length,
      reachable: leadRows.filter(g => g.reachable).length,
      byReason: leadRows.reduce((m: Record<string, number>, g) => ((m[g.nonConversionReason || 'unset'] = (m[g.nonConversionReason || 'unset'] || 0) + 1), m), {}),
      turnedAwayDemand: {
        note: 'periods people ASKED for that we could not fill. Demand that never becomes a booking record and is therefore invisible to occupancy, pace and revenue alike — but it is evidence about pricing and calendar pressure. Repeated misses on the same window are worth reading as a signal, not as a list of individuals.',
        requests: guestRows
          .flatMap(g => g.requestedPeriods.map(p => ({ guestId: g.guestId, kind: g.kind, ...p })))
          .filter(p => p.outcome === 'unavailable' || p.outcome === 'declined')
          .sort((a, b) => b.askedOn.localeCompare(a.askedOn))
          .slice(0, 40),
      },
    },
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
  // Each run is judged against the minimum that applies on its OWN start date.
  const runMinStay = (r: { start: string }) => minStayFor(r.start);
  const unsellableRuns = runs.filter(r => r.nights < runMinStay(r));  // shorter than its own floor → dead
  const orphanRuns = runs.filter(r => r.nights === runMinStay(r));    // exactly at the floor — smallest real opportunity
  const forwardMonths = [...new Set(forwardDates.map(d => d.slice(0, 7)))].map(m => {
    const days = forwardDates.filter(d => d.startsWith(m));
    const booked = days.filter(d => availByDate.has(d) && !availByDate.get(d)).length;
    const base = (performance.monthOfYearBaseline as any[])[+m.slice(5, 7) - 1];
    return {
      month: m, daysInWindow: days.length, bookedNights: booked,
      bookedPct: round(booked / days.length * 100),
      baselineOccupancyPct: base?.baselineOccupancyPct ?? null,
      hasAvailabilityDoc: monthsPresent.has(m),
      // no doc = no bookings = fully open (empty), not "no data" — treat as a real, high-priority gap
      fullyOpen: !monthsPresent.has(m),
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
    return (performance.monthOfYearBaseline as any[])[m - 1]?.adr ?? null;
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
      // A booking ALWAYS writes an availability doc, so on a LIVE pack "no doc" = NO bookings =
      // fully-open, confirmed-empty inventory — the emptiest, highest-priority to fill, NOT missing
      // data. (This block only runs on a live pack; a backtest withholds inventory entirely.)
      ...(spansUnknownMonths.length ? { fullyOpen: true, openMonths: spansUnknownMonths, note: `covers month(s) with no availability doc (${spansUnknownMonths.join(', ')}) — no doc means no bookings, i.e. FULLY OPEN / confirmed-empty inventory, not absent data. baselineAdr is the historical month average.` } : {}),
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

  // ---------- recent cancellations (re-opened inventory + a demand signal) ----------
  // Logic lives in src/lib/growth/signals.ts so any in-app arm can read the same signal (arch §7 M1).
  const recentCancellations = computeRecentCancellations(allBookings, AS_OF);

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
        recentCancellations,
        orphanNights: {
          definition: `free runs exactly equal to the minimum stay that applies on their own start date (varies by date; see dataQuality.constraints)`,
          count: orphanRuns.length,
          runs: orphanRuns.slice(0, 20).map(priceRun),
        },
        unsellableUnderMinStay: {
          definition: `free runs SHORTER than the minimum stay applying on their own start date — cannot be booked as-is`,
          count: unsellableRuns.length,
          runs: unsellableRuns.slice(0, 20).map(priceRun),
        },
        monthsAhead: forwardMonths,
        fullyOpenMonths: {
          note: 'Forward months with NO availability doc. A booking always writes a doc, so no doc = no bookings = FULLY OPEN, confirmed-empty inventory — the emptiest, highest-priority to fill, NOT missing/absent data. Treat these as real gaps and consider a flag + an opportunity, not "cannot assess".',
          months: forwardMonths.filter(m => !m.hasAvailabilityDoc).map(m => m.month),
        },
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
  // Logic lives in src/lib/growth/signals.ts (arch §7 M1). `threads` + property-filtered `guests` +
  // `bookingById` are the same inputs the inline version used.
  const campaigns = computeOutreachLedger(threads, guests, bookingById, AS_OF);

  // ---------- current brand + acquisition signals (LIVE Meta state — NOT as-of reproducible) ----------
  // Fetched DIRECTLY from Meta at pack-build (promotion-system-architecture.md §3.1). Unlike every
  // other block, this is CURRENT state with no history and no as-of, so it is WITHHELD on a historical
  // backtest — the same discipline `inventory` uses — and flagged in dataQuality.currentSignals so the
  // analyst never treats it as a dated fact. Best-effort: any failure (no token, a Graph hiccup)
  // degrades to available:false; it never breaks the pack build. (META_ADS_TOKENS comes from the
  // runtime env; the CLI wrapper loads it from Secret Manager for local dev.)
  let currentSignals: unknown;
  if (isHistorical) {
    currentSignals = {
      available: false,
      withheldReason:
        `Generated with --as-of ${ymd(AS_OF)} (a backtest). Facebook page + ad-account health is CURRENT ` +
        `state only (no history, no as-of), so it is withheld to avoid mixing today's brand state into a ` +
        `historical view. Do not reason about the page or ad account from this pack.`,
    };
  } else {
    const [pageRes, acctRes] = await Promise.all([getPageHealth(PROPERTY), getAdAccountHealth(PROPERTY)]);
    currentSignals = {
      available: pageRes.ok || acctRes.ok,
      note:
        'LIVE current Facebook/Meta state at pack-build time — NOT as-of-reproducible and NOT part of the ' +
        'historical series. Treat as "how things stand right now". Each block\'s `warnings` are actionable ' +
        'flags (dormant page, OTA website link, no account spend limit, no conversion history). ' +
        'available:false means the ads token was not reachable from this environment, not that all is well.',
      page: pageRes.ok ? pageRes.data : { available: false, error: pageRes.error },
      adAccount: acctRes.ok ? acctRes.data : { available: false, error: acctRes.error },
    };
  }

  const pack: SituationPack = {
    meta: { generatedFor: PROPERTY, asOf: ymd(AS_OF), generator },
    dataQuality,
    currentSignals,
    performance,
    channels: bySrcYear,
    origin: byOriginYear,
    channelOriginXtab,
    bookingPace,
    product,
    audience,
    inventory,
    outreachHistory: {
      pastCampaigns: campaigns,
      note:
        'Past manual outreach runs (WhatsApp), newest-last. Per run: `daysAgo` (recency), `recipients`, ' +
        '`repliedWithin14d`/`replyRatePct`, and `bookedWithin120d` = recipients who MADE a booking (createdAt) ' +
        'in the 120 days AFTER the run — the attributable conversion (it does NOT count a pre-existing ' +
        'reservation whose stay merely falls after the run, and excludes imported rows that lack a real ' +
        'booking date). A recent run with bookedWithin120d ≈ 0 means the warm channel was already fired and ' +
        'did NOT convert — the method reads this before routing a window to it. Attribution is a proxy, not ' +
        'proof of cause; treat it as evidence, not certainty.',
    },
  };

  return pack;
}
