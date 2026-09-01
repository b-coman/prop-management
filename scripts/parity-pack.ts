/**
 * parity-pack — the deterministic half of the OTA parity check.
 *
 * Builds the PROBE LIST (which windows are worth comparing, and at which occupancies) and attaches a
 * live direct quote to each. It never touches an OTA: capturing those needs a real browser, which is
 * what the `ota-parity` skill is for. Facts here, judgement there — the same split as situation-pack.
 *
 * The probe list is DERIVED, not hardcoded: date overrides, length-of-stay tiers, occupancy bounds and
 * live campaigns all come from the property's own configuration, so it works for any property.
 *
 *   npx tsx scripts/parity-pack.ts [propertySlug] [--json] [--months N] [--only <substring>]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { headroomPct } from '@/lib/growth/parityMath';
import { getParityConfig } from '@/services/channelService';
import { buildWorklist, computeCoverage, outstandingCells } from '@/lib/growth/parityWorklist';
import { latestByCell, recordObservation } from '@/services/growth/parityObservations';
import { cellId } from '@/lib/growth/parityWorklist';
import { partiesFor, partySize, partyLabel } from '@/lib/parity/party';

const SLUG = process.argv[2]?.startsWith('--') ? 'prahova-mountain-chalet' : (process.argv[2] ?? 'prahova-mountain-chalet');
const AS_JSON = process.argv.includes('--json');
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i > -1 ? process.argv[i + 1] : null; })();
const MONTHS = (() => { const i = process.argv.indexOf('--months'); return i > -1 ? Number(process.argv[i + 1]) : 8; })();
/**
 * Explicit window, for when the owner cares about a stretch rather than "the next N months".
 *
 * `--months` only ever moves the far edge, so asking for the autumn meant also probing the following
 * spring - 2027 weekends nobody had a decision waiting on, at the cost of real page loads against a
 * bot-detection budget. `--from`/`--to` scope both ends.
 */
const FROM = (() => { const i = process.argv.indexOf('--from'); return i > -1 ? process.argv[i + 1] : null; })();
const TO = (() => { const i = process.argv.indexOf('--to'); return i > -1 ? process.argv[i + 1] : null; })();
const MAX_PROBES = (() => { const i = process.argv.indexOf('--max'); return i > -1 ? Number(process.argv[i + 1]) : 24; })();
const GUESTS_ARG = (() => {
  const i = process.argv.indexOf('--guests');
  return i > -1 ? process.argv[i + 1].split(',').map(Number).filter((n) => n > 0) : null;
})();
const BASE = process.env.PARITY_BASE_URL ?? 'https://prahova-chalet.ro';

// Rates come from the `channels` collection — see src/services/channelService.ts. There are no
// defaults here on purpose: this file used to carry its own copy of the commissions, as did
// parity-report.ts and set-channel-pricing.ts, and all three still said Airbnb 18.5% long after the
// owner confirmed 18.755%. A rate that lives in three places is a rate nobody owns.

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
const parse = (s: string) => new Date(s + 'T00:00:00Z');
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type ProbeReason =
  | 'peak' | 'long-weekend' | 'school-break' | 'advertised'
  | 'los-threshold' | 'ordinary-weekend' | 'midweek' | 'occupancy-variant';

/** Short / mid / long — the comparison flips across the length-of-stay tier, so all three are covered. */
type LengthClass = 'short' | 'mid' | 'long';

interface Probe {
  label: string;
  /** Why this window is in the list — so a human can tell signal from routine. */
  reason: ProbeReason;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  priority: 'high' | 'normal';
  lengthClass: LengthClass;
  /** Set when the window's dates are a rule of thumb (school breaks) rather than published. */
  approximate?: boolean;
}

async function quoteDirect(propertyId: string, checkIn: string, checkOut: string, guests: number) {
  try {
    const r = await fetch(`${BASE}/api/check-pricing`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId, checkIn, checkOut, guests }),
    });
    const j: any = await r.json();
    const p = j?.pricing ?? j;
    const total = p?.total ?? p?.totalPrice;
    if (typeof total !== 'number') return { ok: false as const, error: String(p?.error ?? p?.reason ?? 'no quote') };
    return {
      ok: true as const,
      total,
      cleaningFee: p?.cleaningFee ?? null,
      losDiscountPct: p?.lengthOfStayDiscount?.discountPercentage ?? 0,
    };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

(async () => {
  const db = await getAdminDb();
  const propDoc = await db.collection('properties').doc(SLUG).get();
  if (!propDoc.exists) throw new Error(`property ${SLUG} not found`);
  const prop: any = propDoc.data();

  const baseOccupancy = prop.baseOccupancy ?? 2;
  const maxGuests = prop.maxGuests ?? baseOccupancy;
  const losTiers: number[] = (prop.pricingConfig?.lengthOfStayDiscounts ?? [])
    .filter((t: any) => t.enabled).map((t: any) => t.nightsThreshold).sort((a: number, b: number) => a - b);

  // Probe SHAPE (which occupancies to compare, published school-break dates) is a property-level
  // setting and stays here. Channel ECONOMICS moved to the `channels` collection.
  const configured = prop.channelPricing ?? null;

  // Channel economics + listing URLs, from live config. Throws with instructions if unconfigured.
  const parityConfig = await getParityConfig(SLUG);
  const { channels, direct, listingUrls } = parityConfig;
  if (parityConfig.unstated.length) {
    console.log(`\nNOTE: active but no commission stated, so excluded from parity: ${parityConfig.unstated.join(', ')}`);
  }
  if (parityConfig.inactive.length) {
    if (!AS_JSON) console.log(`NOTE: not selling on: ${parityConfig.inactive.map((c) => `${c.channelId} — ${c.reason ?? 'no reason recorded'}`).join('; ')}`);
  }

  // Airbnb's listing id is recoverable from the iCal feed even when nothing else is configured.
  if (!listingUrls.airbnb) {
    const feeds = await db.collection('icalFeeds').where('propertyId', '==', SLUG).get();
    const ab = feeds.docs.map((d) => d.data() as any).find((f) => /airbnb/i.test(f.name ?? ''));
    const id = ab?.url?.match(/\/ical\/(\d+)\.ics/)?.[1];
    if (id) listingUrls.airbnb = `https://www.airbnb.com/rooms/${id}`;
  }

  const today = parse(iso(new Date()));
  const horizon = addDays(today, MONTHS * 30);
  // Published school-break dates, when the owner has recorded them (they beat the approximations).
  // NOTE: this was annotated `SpecialPeriodOptions`, a type that exists nowhere in the repo, and the
  // value was then never read. It compiled only because tsconfig excludes scripts/ from checking.
  // Kept as a plain typed value and actually consumed below, so the override does what it claims.
  const schoolBreakOverrides: { schoolBreaks: Record<string, { start: string; end: string }> } | undefined =
    prop.channelPricing?.schoolBreaks ? { schoolBreaks: prop.channelPricing.schoolBreaks } : undefined;

  // ---- minimum stay per date, so a probe is never rejected by our own booking rules ----
  const calCache = new Map<string, any>();
  const calDoc = async (ym: string) => {
    if (!calCache.has(ym)) {
      const d = await db.collection('priceCalendars').doc(`${SLUG}_${ym}`).get();
      calCache.set(ym, d.exists ? d.data() : null);
    }
    return calCache.get(ym);
  };
  const minStayOn = async (d: Date): Promise<number> => {
    const c = await calDoc(iso(d).slice(0, 7));
    return Number(c?.days?.[d.getUTCDate()]?.minimumStay ?? 1) || 1;
  };

  // ---- availability, so we never probe a window that cannot be sold anyway ----
  const monthCache = new Map<string, any>();
  const monthDoc = async (ym: string) => {
    if (!monthCache.has(ym)) {
      const d = await db.collection('availability').doc(`${SLUG}_${ym}`).get();
      monthCache.set(ym, d.exists ? d.data() : null);
    }
    return monthCache.get(ym);
  };
  const isFree = async (d: Date) => {
    const a = await monthDoc(iso(d).slice(0, 7));
    if (!a) return true; // no doc = nothing booked that month
    const day = d.getUTCDate();
    return a.available?.[day] !== false && !a.holds?.[day];
  };
  const windowFree = async (ci: Date, nights: number) => {
    for (let i = 0; i < nights; i++) if (!(await isFree(addDays(ci, i)))) return false;
    return true;
  };
  /**
   * First sellable start for `nights` inside [from, until). A period that is partly booked is still
   * worth comparing on the part that can actually be sold — probing nights nobody can book just
   * spends a human's browser time for nothing.
   */
  const firstFreeWithin = async (from: Date, until: Date, nights: number): Promise<Date | null> => {
    for (let d = from; addDays(d, nights) <= until; d = addDays(d, 1)) {
      if (await windowFree(d, nights)) return d;
    }
    return null;
  };

  const soonest = addDays(today, 1); // never probe a date the booking engine will reject
  const probes: Probe[] = [];
  const classify = (nights: number): LengthClass =>
    nights >= (losTiers[0] ?? 7) ? 'long' : nights <= 2 ? 'short' : 'mid';
  const push = (p: Omit<Probe, 'lengthClass'> & { lengthClass?: LengthClass }) => {
    const probe: Probe = { ...p, lengthClass: p.lengthClass ?? classify(p.nights) };
    const existing = probes.find((x) => x.checkIn === probe.checkIn && x.checkOut === probe.checkOut && x.guests === probe.guests);
    if (!existing) { probes.push(probe); return; }
    // Same window reached from two directions (a school break that happens to be the window we are
    // advertising). Keep one probe, but let the higher-signal reason win the label — "ADVERTISED"
    // tells the reader why this row matters far better than "summer break" does.
    if (existing.priority !== 'high' && probe.priority === 'high') {
      existing.label = probe.label;
      existing.reason = probe.reason;
      existing.priority = 'high';
    }
  };
  /**
   * The parties to compare at — a SHAPE, not a headcount.
   *
   * A comparison is only meaningful for a party every channel will actually quote, and the three
   * sides price children differently: the direct engine counts heads and charges `extraGuestFee` per
   * head above `baseOccupancy`, Airbnb takes a separate `children` parameter, Booking prices by child
   * AGE. Deriving "6 guests" into 6 adults asked the platforms for a party this property cannot host
   * (its cap is 5 adults + 2 children) and put 38 wrong prices in the store before it was caught.
   *
   * The owner's mix, stated 2026-08-30: 2 adults + 1 child · 4 adults · 4 adults + 2 children.
   */
  const mix = partiesFor(configured);
  const compareOccupancies: number[] = (GUESTS_ARG ?? mix.parties.map(partySize))
    .filter((n: number) => n >= 1)
    .sort((a: number, b: number) => a - b);
  const occupancyNote = GUESTS_ARG
    ? 'from --guests (headcounts only — the adult/child split is guessed)'
    : `${mix.parties.map(partyLabel).join(' · ')} (${mix.source})`;
  if (mix.warning) console.error(`!! ${mix.warning}`);
  /** Peaks and flat-rate windows get EVERY shape — the gap can differ by 12+ points across them. */
  const occupancies = (all: boolean) => (all ? compareOccupancies : [compareOccupancies[0]]);

  // ---- 1. Special periods, read from the `holidays` collection. ----
  // NOT computed. Romania uses Orthodox (Julian) Easter and the school calendar is set by ministerial
  // order — deriving either in code poisons every downstream decision (see scripts/seed-holidays.ts,
  // which records a source URL per row). This is the SAME source the situation pack reads, so the
  // parity check and the brain cannot disagree about what a "period" is.
  const holSnap = await db.collection('holidays').get();
  const holidays = holSnap.docs
    .map((d) => d.data() as any)
    .filter((h) => h.endDate >= iso(today) && h.startDate <= iso(horizon))
    .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));

  const holidayCoverageEnd = holSnap.docs
    .map((d) => String((d.data() as any).endDate ?? ''))
    .sort()
    .pop() ?? null;

  for (const h of holidays) {
    const rawStart = parse(h.startDate);
    let ci0 = rawStart < soonest ? soonest : rawStart;
    // `endDate` is the last day OFF, so the sellable window runs one night past it.
    let periodEnd = addDays(parse(h.endDate), 1);
    let remaining = Math.round((periodEnd.getTime() - ci0.getTime()) / 86_400_000);
    if (remaining < 2) continue;

    if (h.type === 'major') {
      // A `major` row is a real travel window. Widen to the adjacent weekend where that is free —
      // people take the Friday before a Monday holiday, and that is the window actually sold.
      let ci = ci0;
      for (let back = 0; back <= 4; back++) {
        const cand = addDays(ci0, -back);
        if (cand >= soonest && cand.getUTCDay() === 5) { ci = cand; break; }
      }
      const span = Math.round((periodEnd.getTime() - ci.getTime()) / 86_400_000);
      // Respect our OWN minimum stay: Christmas carries minStay 3, so a 2-night probe is rejected by
      // the booking engine before it ever reaches a price.
      const natural = Math.max(2, await minStayOn(ci), Math.min(span, 7));
      const start = (await windowFree(ci, natural)) ? ci : await firstFreeWithin(ci, periodEnd, natural);
      if (start) {
        for (const g of occupancies(true)) {
          push({ label: h.name, reason: 'peak', checkIn: iso(start), checkOut: iso(addDays(start, natural)),
                 nights: natural, guests: g, priority: 'high', approximate: !h.official });
        }
      }
    } else if (h.type === 'school-break') {
      // Breaks earn two probes: families travel MIDWEEK (otherwise unsellable), and the break is long
      // enough that the length-of-stay tier becomes reachable.
      //
      // If the owner has published the ACTUAL dates for this break, they beat the seeded row. This
      // matters for "Vacanta mobila", which is a three-week WINDOW inside which each county picks one
      // week — probing the whole window would probe three weeks nobody is travelling in. Matched on
      // the holiday's id first, then its name, so either key works.
      const pub = schoolBreakOverrides?.schoolBreaks?.[h.id] ?? schoolBreakOverrides?.schoolBreaks?.[h.name];
      if (pub?.start && pub?.end) {
        ci0 = parse(pub.start);
        periodEnd = parse(pub.end);
        remaining = Math.max(0, Math.round((periodEnd.getTime() - ci0.getTime()) / 86_400_000));
      }
      const firstMonday = (() => { let d = ci0; for (let i = 0; i < 7 && d.getUTCDay() !== 1; i++) d = addDays(d, 1); return d; })();
      const mid = await firstFreeWithin(firstMonday, periodEnd, 3);
      if (mid) {
        push({ label: `${h.name} — midweek`, reason: 'midweek', checkIn: iso(mid), checkOut: iso(addDays(mid, 3)),
               nights: 3, guests: compareOccupancies[0], priority: 'normal', approximate: !h.official });
      }
      const tier = losTiers[0] ?? 7;
      if (remaining >= tier) {
        const wk = await firstFreeWithin(ci0, periodEnd, tier);
        if (wk) {
          push({ label: `${h.name} — full week`, reason: 'school-break', checkIn: iso(wk), checkOut: iso(addDays(wk, tier)),
                 nights: tier, guests: baseOccupancy, priority: 'normal', approximate: !h.official });
        }
      }
    } else if (h.type === 'bridge-day') {
      const natural = Math.max(2, await minStayOn(ci0), Math.min(remaining, 4));
      const start = (await windowFree(ci0, natural)) ? ci0 : await firstFreeWithin(ci0, periodEnd, natural);
      if (start) {
        push({ label: h.name, reason: 'long-weekend', checkIn: iso(start), checkOut: iso(addDays(start, natural)),
               nights: natural, guests: baseOccupancy, priority: 'high', approximate: !h.official });
      }
    }
    // `minor` rows are legal days off that historically do not move leisure demand on their own —
    // seed-holidays.ts classifies them deliberately, so we trust that and skip them.
  }

  // ---- 1b. The property's OWN pricing peaks (dateOverrides). ----
  // The legal calendar says why people travel; the override calendar says what the owner charges a
  // premium for. They are NOT the same set: New Year's Eve (30-31 Dec) is the year's highest rate here
  // but is not a public holiday, so it appears in `dateOverrides` and nowhere in `holidays`. Probing
  // only the legal calendar would skip the single most valuable window of the year.
  const ovSnap2 = await db.collection('dateOverrides').where('propertyId', '==', SLUG).get();
  const ovRows = ovSnap2.docs.map((d) => d.data() as any)
    .filter((o) => o.date && o.date >= iso(today) && o.date <= iso(horizon))
    .sort((a, b) => a.date.localeCompare(b.date));
  const ovClusters: Array<{ reason: string; dates: string[] }> = [];
  for (const o of ovRows) {
    const reason = String(o.reason ?? 'special rate');
    const last = ovClusters[ovClusters.length - 1];
    const contiguous = last && iso(addDays(parse(last.dates[last.dates.length - 1]), 1)) === o.date;
    // Split on reason as well as adjacency — Christmas runs into New Year on the calendar, but they
    // are separate commercial decisions with different prices and different competitors.
    if (contiguous && last.reason === reason) last.dates.push(o.date);
    else ovClusters.push({ reason, dates: [o.date] });
  }
  for (const c of ovClusters) {
    const ci = parse(c.dates[0]);
    if (ci < soonest) continue;
    const span = c.dates.length + 1;
    const nights = Math.max(2, await minStayOn(ci), Math.min(span, 7));
    const end = addDays(ci, nights);
    const start = (await windowFree(ci, nights)) ? ci : await firstFreeWithin(ci, end, nights);
    if (!start) continue;
    for (const g of occupancies(true)) {
      push({ label: `${c.reason} (own rate)`, reason: 'peak', checkIn: iso(start),
             checkOut: iso(addDays(start, nights)), nights, guests: g, priority: 'high' });
    }
  }

  // ---- 2. Windows we are actively paying to advertise. Losing here costs twice. ----
  const adSnap = await db.collection('adCampaigns').where('propertyId', '==', SLUG).get();
  for (const d of adSnap.docs) {
    const x: any = d.data();
    if (!['pushed', 'active', 'approved'].includes(String(x.status))) continue;
    const occ = x.proposal?.occasion;
    if (!occ?.start) continue;
    const ci = parse(occ.start);
    if (iso(ci) < iso(today)) continue;
    const nights = Math.min(3, Math.max(2, Number(occ.nights) || 2));
    push({ label: `ADVERTISED: ${String(occ.name ?? d.id).slice(0, 44)}`, reason: 'advertised',
           checkIn: iso(ci), checkOut: iso(addDays(ci, nights)), nights, guests: baseOccupancy, priority: 'high' });
  }

  // ---- 2b. What the landing pages actually PROMISE. ----
  // adCampaigns carries the campaign's occasion, but the offer a visitor is SHOWN is
  // landingPages.exampleStays: exact dates, exact occupancy, and the "from" price the booking form
  // has to honour. Section 2 probes the occasion at baseOccupancy and caps at 3 nights, so it checks
  // windows nobody was shown — it would probe the friends page at 3 guests when it advertises 4, and
  // would never reach the work page's 7-night stay at all. Losing on a window we are paying to
  // advertise costs twice: the click and then the commission.
  const lpSnap = await db.collection('landingPages').where('propertyId', '==', SLUG).get();
  for (const d of lpSnap.docs) {
    const x: any = d.data();
    if (x.status !== 'published') continue;
    for (const s of (x.exampleStays ?? [])) {
      if (!s?.start || !s?.end || s.start < iso(today)) continue;
      const nights = Number(s.nights)
        || Math.round((parse(s.end).getTime() - parse(s.start).getTime()) / 86_400_000);
      if (nights < 1) continue;
      push({ label: `ADVERTISED /lp/${d.id}`, reason: 'advertised',
             checkIn: s.start, checkOut: s.end, nights,
             guests: Number(s.guests) || baseOccupancy, priority: 'high' });
    }
  }

  // ---- 3. Either side of the first length-of-stay tier: the discount flips the comparison. ----
  if (losTiers.length) {
    const tier = losTiers[0];
    let ci = addDays(today, 21);
    for (let tries = 0; tries < 90 && !(await windowFree(ci, tier)); tries++) ci = addDays(ci, 1);
    if (await windowFree(ci, tier)) {
      push({ label: `just under the ${tier}-night discount`, reason: 'los-threshold', checkIn: iso(ci),
             checkOut: iso(addDays(ci, tier - 1)), nights: tier - 1, guests: baseOccupancy, priority: 'normal' });
      push({ label: `at the ${tier}-night discount`, reason: 'los-threshold', checkIn: iso(ci),
             checkOut: iso(addDays(ci, tier)), nights: tier, guests: baseOccupancy, priority: 'normal' });
    }
  }

  // ---- 4. Ordinary months must not be blind spots. One open weekend per month with no special
  //         period, ROTATED by run so consecutive runs sample different weekends. ----
  const monthsCovered = new Set(probes.map((p) => p.checkIn.slice(0, 7)));
  for (let m = 0; m < MONTHS; m++) {
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + m, 1));
    const ym = iso(monthStart).slice(0, 7);
    if (monthsCovered.has(ym)) continue;
    const fridays: Date[] = [];
    for (let d = monthStart; iso(d).slice(0, 7) === ym; d = addDays(d, 1)) if (d.getUTCDay() === 5 && d > today) fridays.push(d);
    if (!fridays.length) continue;
    // Deterministic rotation: the run's week number picks which Friday, so a 4-6 week cadence walks
    // across the month instead of re-measuring the same weekend forever.
    const weekOfYear = Math.floor((today.getTime() - Date.UTC(today.getUTCFullYear(), 0, 1)) / (7 * 86_400_000));
    for (const f of [fridays[(weekOfYear + m) % fridays.length], ...fridays]) {
      if (await windowFree(f, 2)) {
        push({ label: `ordinary weekend ${iso(f)}`, reason: 'ordinary-weekend', checkIn: iso(f),
               checkOut: iso(addDays(f, 2)), nights: 2, guests: compareOccupancies[0], priority: 'normal' });
        break;
      }
    }
  }

  // ---- 4b. Ordinary MIDWEEK. The hardest inventory to sell, and where an OTA promo does the most
  //          damage because there is no weekend demand to fall back on. Sampled every other month so
  //          it earns coverage without doubling the run. ----
  for (let m = 0; m < MONTHS; m += 2) {
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + m, 1));
    const ym = iso(monthStart).slice(0, 7);
    const mondays: Date[] = [];
    for (let d = monthStart; iso(d).slice(0, 7) === ym; d = addDays(d, 1)) if (d.getUTCDay() === 1 && d > soonest) mondays.push(d);
    if (!mondays.length) continue;
    const weekOfYear = Math.floor((today.getTime() - Date.UTC(today.getUTCFullYear(), 0, 1)) / (7 * 86_400_000));
    for (const mo of [mondays[(weekOfYear + m) % mondays.length], ...mondays]) {
      if (await windowFree(mo, 3)) {
        push({ label: `ordinary midweek ${iso(mo)}`, reason: 'midweek', checkIn: iso(mo),
               checkOut: iso(addDays(mo, 3)), nights: 3, guests: compareOccupancies[0], priority: 'normal' });
        break;
      }
    }
  }

  // ---- 5. Guarantee every length class is represented, whatever the calendar happened to yield. ----
  for (const cls of ['short', 'mid', 'long'] as LengthClass[]) {
    if (probes.some((p) => p.lengthClass === cls)) continue;
    const nights = cls === 'short' ? 2 : cls === 'mid' ? 4 : (losTiers[0] ?? 7);
    let ci = addDays(today, 14);
    for (let tries = 0; tries < 120 && !(await windowFree(ci, nights)); tries++) ci = addDays(ci, 1);
    if (await windowFree(ci, nights)) {
      push({ label: `${cls}-stay coverage`, reason: 'los-threshold', checkIn: iso(ci),
             checkOut: iso(addDays(ci, nights)), nights, guests: baseOccupancy, priority: 'normal' });
    }
  }

  // ---- 6. Occupancy variant on the longest non-peak window — flat-rate nights make this decisive. ----
  const upper = compareOccupancies[compareOccupancies.length - 1];
  const biggest = probes.filter((p) => p.reason !== 'peak' && p.guests === compareOccupancies[0]).sort((a, b) => b.nights - a.nights)[0];
  if (biggest && upper > compareOccupancies[0]) {
    push({ ...biggest, label: `${biggest.label} @ ${upper} guests`, reason: 'occupancy-variant', guests: upper });
  }

  const byLabel = ONLY ? probes.filter((p) => p.label.toLowerCase().includes(ONLY.toLowerCase())) : probes;
  const scoped = byLabel.filter((p) => (!FROM || p.checkIn >= FROM) && (!TO || p.checkIn <= TO));
  // Never to stdout in JSON mode: a human-readable line here makes the output unparseable, which is
  // exactly what it did the first time.
  if ((FROM || TO) && !AS_JSON) {
    console.log(`SCOPE: check-in ${FROM ?? 'any'} to ${TO ?? 'any'} — ${scoped.length} of ${byLabel.length} probes\n`);
  }
  // Each probe costs a human a couple of page loads in the browser, so cap the run — high
  // priority (peaks, bridged holidays, advertised windows) survives the cut first.
  const ordered = [...scoped].sort((a, b) =>
    (a.priority === b.priority ? 0 : a.priority === 'high' ? -1 : 1) || a.checkIn.localeCompare(b.checkIn));
  const selected = ordered.slice(0, MAX_PROBES);
  const dropped = ordered.length - selected.length;

  // ---- attach live direct quotes ----
  const rows = [];
  // `/api/check-pricing` is rate limited to 60 requests a minute. Fired back to back, a 41-window
  // pack burns the budget in seconds and the rest come back "Too many requests" - which then get
  // RECORDED as engine errors, so the run manufactures its own missing data. One request per 1.1s
  // keeps a full pack inside the limit.
  for (let i = 0; i < selected.length; i++) {
    const p = selected[i];
    const q = await quoteDirect(SLUG, p.checkIn, p.checkOut, p.guests);
    const free = await windowFree(parse(p.checkIn), p.nights);
    rows.push({ ...p, bookableDirect: free, direct: q });
    if (i < selected.length - 1) await new Promise((r) => setTimeout(r, 1100));
  }

  // ---- the worklist: one cell per window × occupancy × channel, each owed an outcome ----
  const channelNames = channels.map((c) => c.channel);
  const worklist = buildWorklist(SLUG, rows.map((r) => ({
    label: r.label, checkIn: r.checkIn, checkOut: r.checkOut, nights: r.nights, guests: r.guests, priority: r.priority,
  })), channelNames);

  // The direct price comes from OUR engine, so record it here rather than making a human retype it.
  // `source: 'api'` is deliberate provenance: it is what the engine computes, which is not automatically
  // what a browser renders (this site once showed USD while the engine returned RON).
  if (!process.argv.includes('--no-record')) {
    const stamp = new Date().toISOString();
    for (const r of rows) {
      const id = cellId(SLUG, r.checkIn, r.checkOut, r.guests, 'direct');
      await recordObservation({
        propertyId: SLUG, cellId: id, checkIn: r.checkIn, checkOut: r.checkOut,
        nights: r.nights, guests: r.guests, channel: 'direct',
        status: r.direct.ok ? 'captured' : (r.bookableDirect ? 'error' : 'unavailable'),
        guestTotal: r.direct.ok ? Math.round(r.direct.total) : null,
        reason: r.direct.ok ? undefined : (r.bookableDirect ? `engine: ${r.direct.error}` : 'dates not bookable direct'),
        source: 'api', url: `${BASE}/api/check-pricing`, capturedBy: 'parity-pack', capturedAt: stamp,
        // The direct price has a session too, and naming it keeps the report honest: this is the
        // engine's own quote, not a rendered page, and it carries no member discount by definition.
        sessionState: 'direct engine quote (/api/check-pricing), RON',
      });
    }
  }

  const observed = [...(await latestByCell(SLUG)).values()];
  const coverage = computeCoverage(worklist, observed, { freshnessDays: 42 });
  const todo = outstandingCells(worklist, observed, { freshnessDays: 42 });

  const pack = {
    meta: { propertySlug: SLUG, generatedAt: new Date().toISOString(), baseUrl: BASE, monthsAhead: MONTHS },
    economics: {
      direct,
      channels: channels.map((c) => ({ ...c, headroomPct: Number(headroomPct(c, direct).toFixed(4)) })),
      source: 'channels collection (channelService.getParityConfig)',
      // `getParityConfig` THROWS when a channel has no stated economics — it never falls back to a
      // default. So reaching this line proves the rates are real. This flag was read by the banner
      // below but never set, so the pack has always announced "DEFAULTS (not yet persisted)": the
      // exact opposite of the truth, on every run since it was written.
      configured: true,
      note: 'Owner-stated rates. There are no fallback defaults — if this pack exists, the rates are real.',
      unstated: parityConfig.unstated,
      inactive: parityConfig.inactive,
    },
    listingUrls,
    property: { baseOccupancy, maxGuests, compareOccupancies, occupancyNote, cleaningFee: prop.cleaningFee ?? null, extraGuestFee: prop.extraGuestFee ?? null, losTiers },
    probes: rows,
    worklist,
    coverage,
    outstanding: todo,
    holidayData: {
      source: '`holidays` collection (scripts/seed-holidays.ts — fetched facts, per-row source URLs)',
      rowsInHorizon: holidays.length,
      coverageEnds: holidayCoverageEnd,
      stale: holidayCoverageEnd ? holidayCoverageEnd < iso(horizon) : true,
    },
  };

  if (AS_JSON) { console.log(JSON.stringify(pack, null, 2)); return; }

  console.log(`\nPARITY PACK — ${SLUG}   (${rows.length} probes, ${MONTHS}mo horizon)`);
  console.log(`economics: ${pack.economics.configured ? 'configured' : 'DEFAULTS (not yet persisted)'}  ·  direct card cost ${(direct.paymentCostPct * 100).toFixed(1)}%`);
  for (const c of pack.economics.channels) {
    console.log(`  ${c.channel.padEnd(12)} commission ${(c.commissionPct * 100).toFixed(1)}%  → you can go ${(c.headroomPct * 100).toFixed(1)}% under its guest price and still net the same`);
  }
  if (pack.holidayData.stale) {
    console.log(`\n!! holidays data ends ${pack.holidayData.coverageEnds ?? 'nowhere — collection empty'}, before the ${MONTHS}-month horizon.`);
    console.log('   Periods past that date are NOT probed. Re-seed: npx tsx scripts/seed-holidays.ts');
  }
  console.log(`comparing at ${compareOccupancies.join(' and ')} guests (${occupancyNote})`);
  console.log(`listing urls: ${Object.entries(listingUrls).map(([k, v]) => `${k}=${v}`).join('  ') || '(none configured)'}`);
  console.log('\n' + 'window'.padEnd(46) + 'dates'.padEnd(26) + 'n  g   direct');
  console.log('-'.repeat(104));
  for (const r of [...rows].sort((a, b) => a.checkIn.localeCompare(b.checkIn))) {
    const d = r.direct.ok
      ? `${String(Math.round(r.direct.total)).padStart(6)} RON${r.direct.losDiscountPct ? ` (LoS -${r.direct.losDiscountPct}%)` : ''}`
      : `— ${r.direct.error}`;
    const flag = r.priority === 'high' ? '*' : ' ';
    console.log(
      `${flag}${r.label.slice(0, 44).padEnd(45)}` +
      `${r.checkIn} ${DOW[parse(r.checkIn).getUTCDay()]} → ${r.checkOut}`.padEnd(26) +
      `${String(r.nights).padStart(2)} ${String(r.guests).padStart(2)}   ${d}` +
      (r.bookableDirect ? '' : '   [BLOCKED direct]')
    );
  }
  console.log(`\nWORKLIST: ${worklist.length} cells (${rows.length} windows × ${channelNames.length + 1} sources)`);
  console.log(`COVERAGE: ${coverage.captured} captured · ${coverage.refused} refused · ${coverage.unavailable} unavailable · ` +
              `${coverage.errored} error · ${coverage.missing} MISSING  →  ${(coverage.resolvedPct * 100).toFixed(0)}% resolved` +
              (coverage.oldestAgeDays !== null ? `, oldest ${coverage.oldestAgeDays}d` : ''));
  console.log(coverage.complete ? 'STATUS: complete' : `STATUS: INCOMPLETE — ${todo.length} cell(s) still owed. Run the ota-parity skill to capture them.`);
  if (todo.length) {
    console.log('\nOutstanding (first 20):');
    todo.slice(0, 20).forEach((c) => console.log(`  ${c.channel.padEnd(12)} ${c.checkIn}→${c.checkOut}  ${c.guests}g  ${c.window.slice(0, 40)}`));
    if (todo.length > 20) console.log(`  … and ${todo.length - 20} more`);
  }
  if (dropped > 0) console.log(`\nNOTE: ${dropped} lower-priority probe(s) dropped by --max ${MAX_PROBES} — raise it for fuller coverage.`);
  console.log('\n* = high priority (a peak, bridged holiday, or a window you are advertising)');
  console.log('Next: the `ota-parity` skill captures the OTA side in Chrome and evaluates each row.');
})().catch((e) => { console.error(e); process.exit(1); });
