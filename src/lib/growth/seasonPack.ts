/**
 * seasonPack — the deterministic fact pack the season-planner skill reads.
 *
 * Facts here, judgement there — the same split as `situationPack` and
 * `planner-pack`. Everything in this file is measured or computed; nothing is
 * argued. The skill that consumes it may exclude a window, shift its emphasis by
 * one named tier, and write the angle. It may not do arithmetic, which is why
 * `baseline` already contains a complete, usable plan before the skill runs at
 * all.
 *
 * Every block degrades rather than throwing: a Meta outage yields
 * `ledger.available:false` and a warning, not a failed pack.
 *
 * Server-only (Admin SDK + Graph).
 */
import { checkAvailabilityWithFlags } from '@/lib/availability-service';
import { getPropertyWithDb, getPriceCalendarWithDb } from '@/lib/pricing/pricing-with-db';
import { priceStay } from '@/lib/landing/exampleStays';
import { computeFreeRuns, getHolidays } from '@/lib/growth/signals';
import { getPeriods } from '@/services/periodService';
import { travelWindow, comparePeriodToWindow, suggestedMinStay } from '@/lib/pricing/travelWindow';
import { buildSeasonCandidates, type HolidayRow } from '@/lib/growth/seasonWindows';
import {
  rankSeasonWindows,
  allocateSeasonBudget,
  minViableDailyMinor,
  AD_SET_DAILY_FLOOR_MINOR,
  DEFAULT_PHASE_POLICY,
  type AllocatorPolicy,
  type RankedWindow,
} from '@/lib/growth/seasonAllocator';
import { AD_DOCTRINE, doctrineHorizon, type AdDoctrine } from '@/config/ad-doctrine';
import { computeSeasonLedger, type SeasonLedger } from '@/lib/growth/seasonLedger';
import { fetchInFlight, fetchTrackedMetaCampaignIds, type InFlightBlock } from '@/lib/growth/inFlight';
import { buildAdLearnings } from '@/lib/growth/adLearnings';
import { getAccountSpend, todayInTimezone } from '@/services/growth/metaAds/accountSpend';
import { getAdAccountHealth } from '@/services/growth/metaAds/brandHealth';
import { audienceCandidates, type AudienceCandidate } from '@/services/growth/metaAds/audiences';
import { loadPeriodPositions, periodVerdictLookup } from '@/services/growth/parityPositions';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import {
  annualBudgetMinorFor,
  AD_RESERVE_PCT,
  ABSOLUTE_MAX_TOTAL_MINOR,
  MAX_SPEND_RATIO_OF_VALUE,
  MIN_LEAD_DAYS,
  MIN_VIABLE_DAILY_MINOR,
  adYearFor,
  getMaxDailyBudgetMinor,
} from '@/config/growth-ads';
import { loggers } from '@/lib/logger';
import type { AdLearnings, PropertyImage } from '@/types';
import type { SeasonCandidate, SeasonPlan, SeasonSlot } from '@/lib/growth/contracts';
import type { PeriodPosition } from '@/lib/parity/pricingPosition';

const logger = loggers.ads;

const DAY = 86_400_000;
const ymd = (x: Date) => x.toISOString().slice(0, 10);
const parseYmd = (s: string) => new Date(`${s}T00:00:00Z`);
const addDays = (s: string, n: number) => ymd(new Date(parseYmd(s).getTime() + n * DAY));

/** Northern-hemisphere seasons, as the gallery's vision captions label them. */
function seasonOf(dateYmd: string): 'winter' | 'spring' | 'summer' | 'autumn' {
  const m = Number(dateYmd.slice(5, 7));
  if (m === 12 || m <= 2) return 'winter';
  if (m <= 5) return 'spring';
  if (m <= 8) return 'summer';
  return 'autumn';
}

export interface SeasonPackOptions {
  propertyId: string;
  start: string;
  end: string;
  label?: string;
  asOf?: Date;
}

export interface SeasonPack {
  meta: { generatedFor: string; asOf: string; generator: string; seasonKey: string };
  season: { start: string; end: string; nights: number; label: string };
  inventory: {
    freeRuns: Array<{ start: string; end: string; nights: number }>;
    openNights: number;
    totalNights: number;
    occupancyPct: number;
    note: string;
  };
  /**
   * How the owner actually sells. A CONSTRAINT on what may be proposed, not background reading:
   * the allocator ranks by value at risk and knows nothing about when people book, so on a
   * full-year run it put its largest slice on Summer 2027 — 284 days out, in a season the owner
   * sells through the OTAs. Read this before reading `baseline`.
   */
  doctrine: AdDoctrine & { horizonToday: { start: string; end: string }; note: string };
  candidates: SeasonCandidate[];
  /** A complete, usable plan BEFORE any reasoning. The skill edits this; it does not build it. */
  baseline: { ranked: RankedWindow[]; slots: SeasonSlot[]; excluded: SeasonPlan['excluded']; method: string[]; warnings: string[] };
  ledger: SeasonLedger;
  inFlight: InFlightBlock;
  account: { available: boolean; hasConversionHistory?: boolean; lifetimeCpc?: number | null; warnings?: string[]; error?: string };
  audiences: AudienceCandidate[];
  learnings: AdLearnings;
  parity: { available: true; periods: PeriodPosition[] } | { available: false; error: string };
  assets: { total: number; bySeason: Record<string, number>; seasonReadiness: Record<string, { ready: boolean; gaps: string[] }> };
  /**
   * The owner's PRICING PERIODS — his own commercial decisions about when a window
   * starts, how long it must be, and what it costs.
   *
   * This block exists because it was missing, and its absence produced a wrong plan
   * on 2026-09-07: candidates were derived from the public-holiday calendar alone,
   * so Revelion came out as 31 Dec - 3 Jan when the period already said
   * `New Year's Eve, 30-31 Dec, minStay 3, 2,351/night` and two past bookings both
   * started on the 30th. A derived window is a guess; a period is a decision.
   * Read this before reasoning about any window.
   */
  periods: Array<{
    id: string; name: string; startDate: string; endDate: string;
    tier: string; minStay: number | null; fixedNightPrice: number | null;
  }>;
  /**
   * Where the periods do NOT cover the stay a holiday actually sells, and where the
   * derived window is contradicted by what sold. The same check as
   * `scripts/holiday-windows.ts`, carried here so it cannot be skipped.
   */
  holidayCoverage: Array<{
    holiday: string;
    window: { checkIn: string; checkOut: string; nights: number };
    why: string;
    suggestedMinStay: number;
    coveringPeriods: string[];
    aligned: boolean;
    note: string;
  }>;
  constraints: {
    annualBudgetMinor: number;
    maxDailyBudgetMinor: number;
    absoluteMaxPerCampaignMinor: number;
    minLeadDays: number;
    adSetDailyFloorMinor: number;
    minViableDailyMinor: number;
    maxSpendRatioOfValue: number;
    note: string;
  };
  deliverableAudienceIds: string[];
  method: string[];
  note: string;
  warnings: string[];
}

const PACK_METHOD: string[] = [
  'You RANK and you WRITE. You never compute. Every number here was produced by tested code; if you find yourself adding, stop.',
  'baseline.slots is already a complete plan. Your job is to improve it by exclusion, emphasis and angle — not to rebuild it.',
  'You may exclude a window (with a reason), shift its emphasis one tier (citing a pack field), and write its angle. There is no field in which to type a budget.',
  'An exclusion is an argument and gets recorded. "This window sells itself on the OTAs, so paid reach buys bookings that would have arrived anyway" is exactly the kind of judgement that belongs to you and not to the allocator.',
  'Read `periods` BEFORE `candidates`. A period is the owner\'s decision about when a window starts, how long it must be and what it costs; a candidate is derived. Where they disagree, the period wins and the candidate is suspect.',
  'Read `holidayCoverage`. A window whose note says the periods do not align is a PRICING defect, not an advertising opportunity — say so and move on.',
  'Read inFlight before anything else. A window already being advertised does not need a second campaign; it needs the running one extended.',
  'creativeReady:false means the gallery cannot dress this window. Say so; do not plan an angle around a photo that does not exist.',
  'parityVerdict "losing" windows are already gated out. Do not argue them back in — that is a price problem, and an ad would amplify it.',
];

const PACK_NOTE =
  'All money is in BANI (minor units). Dates are YYYY-MM-DD; checkOut is EXCLUSIVE. The advisory ' +
  'budget on a slot is ADVISORY — the operator approves or changes it at review, and only the ANNUAL ' +
  'envelope is enforced at approval time.';

/** Which seasons the gallery can actually dress, and what is missing where it cannot. */
function assessAssets(images: PropertyImage[]) {
  const bySeason: Record<string, number> = {};
  for (const i of images) {
    const s = (i as PropertyImage & { aiDescription?: { season?: string } }).aiDescription?.season ?? 'unknown';
    bySeason[s] = (bySeason[s] ?? 0) + 1;
  }
  const neutral = bySeason.indeterminate ?? 0;
  const seasonReadiness: Record<string, { ready: boolean; gaps: string[] }> = {};
  for (const s of ['winter', 'spring', 'summer', 'autumn']) {
    const own = bySeason[s] ?? 0;
    const gaps: string[] = [];
    if (own < 2) gaps.push(`only ${own} photo(s) actually shot in ${s}`);
    if (own === 0 && neutral < 4) gaps.push(`and too few season-neutral interiors (${neutral}) to carry it`);
    // Season-neutral interiors genuinely carry a season — an interior does not
    // date — but they cannot carry one ALONE. A season with zero photos of its
    // own has no exterior, no light, no weather: selling a spring stay on winter
    // interiors and a summer garden is how an ad ends up looking recycled.
    seasonReadiness[s] = { ready: own >= 2 || (own >= 1 && neutral >= 4), gaps };
  }
  return { total: images.length, bySeason, seasonReadiness };
}

/**
 * Build the season pack. `start`/`end` bound the STAY windows being planned, not
 * the campaigns — flights are scheduled backwards from each window by the
 * allocator.
 */
export async function buildSeasonPack(opts: SeasonPackOptions): Promise<SeasonPack> {
  const asOf = opts.asOf ?? new Date();
  const asOfYmd = ymd(asOf);
  const propertyId = opts.propertyId;
  const warnings: string[] = [];
  const seasonKey = `${opts.start.slice(0, 4)}-${opts.end.slice(2, 4)}-${seasonOf(opts.start)}`;

  // ── inventory: hold-aware availability, then the shared free-run walker ──
  const dates: string[] = [];
  for (let s = opts.start; s <= opts.end; s = addDays(s, 1)) dates.push(s);

  let unavailable = new Set<string>();
  try {
    const res = await checkAvailabilityWithFlags(propertyId, parseYmd(opts.start), parseYmd(addDays(opts.end, 1)));
    unavailable = new Set(res.unavailableDates);
  } catch (e) {
    warnings.push(`inventory:unreadable — ${(e as Error).message}. No candidates can be built.`);
  }
  const freeRuns = computeFreeRuns(dates, (k) => !unavailable.has(k));
  const openNights = freeRuns.reduce((s, r) => s + r.nights, 0);

  // ── pricing + min-stay: property and every calendar the season spans ──
  const property = await getPropertyWithDb(propertyId);
  const px = property as typeof property & { cleaningFee?: number; defaultMinimumStay?: number };
  const baseOccupancy = property.baseOccupancy ?? 2;
  const defaultMinStay = px.defaultMinimumStay ?? 1;
  // UTC-safe month enumeration — NOT getMonthsBetweenDates, which drops a month across DST.
  const monthKeys = [...new Set(dates.map((d) => d.slice(0, 7)))];
  const calendars = await Promise.all(
    monthKeys.map((mk) => getPriceCalendarWithDb(propertyId, +mk.slice(0, 4), +mk.slice(5, 7)))
  );
  const dayCell = (dateStr: string) => {
    const [y, mo, da] = dateStr.split('-').map(Number);
    const cal = calendars.find((c) => c && c.year === y && c.month === mo);
    return cal?.days?.[String(da)] ?? null; // priceCalendars use an UNPADDED day key
  };
  const minStayFor = (dateStr: string) => {
    const cell = dayCell(dateStr);
    return cell && typeof cell.minimumStay === 'number' && cell.minimumStay > 0 ? cell.minimumStay : defaultMinStay;
  };
  const priceForNight = (dateStr: string) => {
    const cell = dayCell(dateStr);
    if (!cell) return null;
    return cell.prices?.[String(baseOccupancy)] ?? cell.adjustedPrice ?? null;
  };

  // ── parity: the gate that stops us advertising a price the guest can beat ──
  let parity: SeasonPack['parity'] = { available: false, error: 'not-loaded' };
  let verdictFor: (d: string) => { id: string; name: string; verdict: SeasonCandidate['parityVerdict'] } | null = () => null;
  try {
    const pos = await loadPeriodPositions(propertyId, asOfYmd);
    parity = { available: true, periods: pos.rows };
    verdictFor = periodVerdictLookup(pos.rows);
  } catch (e) {
    warnings.push(`parity:unreadable — ${(e as Error).message}. Every window will read 'unmeasured'.`);
    parity = { available: false, error: (e as Error).message };
  }

  // ── assets: can the gallery dress each season at all ──
  // `getPropertyWithDb` returns the PRICING projection, which carries no images —
  // reading them from it silently yields an empty gallery and marks every season
  // unready. Read the raw property document instead.
  let images: PropertyImage[] = [];
  try {
    const db = await getAdminDb();
    const snap = await db.collection('properties').doc(propertyId).get();
    images = ((snap.data() as { images?: PropertyImage[] } | undefined)?.images ?? []) as PropertyImage[];
  } catch (e) {
    warnings.push(`assets:unreadable — ${(e as Error).message}. Every season will read as not ready.`);
  }
  const assets = assessAssets(images);

  // ── the owner's own commercial windows, and whether they cover the stays that sell ──
  const periodRows = (await getPeriods(propertyId))
    .filter((pp) => pp.status === 'active' && pp.endDate >= opts.start && pp.startDate <= opts.end)
    .map((pp) => ({
      id: pp.id, name: pp.name, startDate: pp.startDate, endDate: pp.endDate,
      tier: String(pp.tier), minStay: pp.minStay ?? null, fixedNightPrice: pp.fixedNightPrice ?? null,
    }))
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1));

  // ── candidates ──
  const holidays = (await getHolidays()) as HolidayRow[];
  const { candidates, skipped } = buildSeasonCandidates({
    season: { start: opts.start, end: opts.end },
    asOf: asOfYmd,
    freeRuns,
    holidays,
    periods: periodRows,
    minStayByDate: minStayFor,
    priceByDate: priceForNight,
    quote: (checkIn, nights) =>
      priceStay(checkIn, nights, baseOccupancy, dayCell, {
        baseOccupancy,
        extraGuestFee: property.extraGuestFee ?? 0,
        cleaningFee: px.cleaningFee ?? 0,
      }, property.pricingConfig?.lengthOfStayDiscounts),
    periodByDate: verdictFor,
    creativeFor: (checkIn) => {
      const r = assets.seasonReadiness[seasonOf(checkIn)];
      return { ready: r?.ready ?? false, gaps: r?.gaps ?? [] };
    },
  });
  if (skipped.length) {
    warnings.push(`candidates:skipped — ${skipped.length} proposal(s) could not be measured; see the reasons in the log.`);
    logger.info('seasonPack: skipped proposals', { propertyId, skipped: skipped.slice(0, 20) });
  }

  // ── holiday coverage: derived stay vs the period that prices it ──
  const officialDays = holidays
    .filter((h) => h.type !== 'school-break')
    .flatMap((h) => {
      const out: Array<{ date: string; name: string }> = [];
      for (let cur = h.startDate; cur <= h.endDate; cur = addDays(cur, 1)) out.push({ date: cur, name: h.name });
      return out;
    });
  const allPeriods = (await getPeriods(propertyId)).filter((pp) => pp.status === 'active');
  const holidayCoverage: SeasonPack['holidayCoverage'] = [];
  for (const h of holidays) {
    if (h.type === 'school-break' || h.type === 'minor') continue;
    if (h.endDate < opts.start || h.startDate > opts.end) continue;
    const w = travelWindow(h.startDate, h.endDate, officialDays);
    const covering = allPeriods
      .filter((pp) => w.checkIn <= pp.endDate && pp.startDate < w.checkOut)
      .sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
    const cmp = covering.length
      ? comparePeriodToWindow(
          covering.map((pp) => ({
            id: pp.id, name: pp.name, startDate: pp.startDate, endDate: pp.endDate,
            tier: pp.tier, minStay: pp.minStay ?? null, fixedNightPrice: pp.fixedNightPrice ?? null,
          })),
          w
        )
      : { aligned: false, note: 'no pricing period covers this window at all' };
    holidayCoverage.push({
      holiday: h.name,
      window: { checkIn: w.checkIn, checkOut: w.checkOut, nights: w.nights },
      why: w.why,
      suggestedMinStay: suggestedMinStay(w),
      coveringPeriods: covering.map((pp) => `${pp.name} ${pp.startDate}..${pp.endDate}`),
      aligned: cmp.aligned,
      note: cmp.note,
    });
  }

  // ── Meta state: account, audiences, in-flight, spend ──
  const [healthRes, auds, inFlight, tracked, learnings] = await Promise.all([
    getAdAccountHealth(propertyId),
    audienceCandidates(propertyId).catch(() => [] as AudienceCandidate[]),
    fetchInFlight(propertyId, asOf.toISOString()),
    fetchTrackedMetaCampaignIds(propertyId),
    buildAdLearnings(propertyId),
  ]);

  const account: SeasonPack['account'] = healthRes.ok
    ? {
        available: true,
        hasConversionHistory: healthRes.data.hasConversionHistory,
        lifetimeCpc: healthRes.data.lifetime?.cpc ?? null,
        warnings: healthRes.data.warnings,
      }
    : { available: false, error: healthRes.error };
  if (!healthRes.ok) warnings.push(`account:unreadable — ${healthRes.error}`);

  const adYear = adYearFor(asOfYmd);
  const accountTz = 'CET';
  const spendRes = await getAccountSpend(propertyId, adYear.start, todayInTimezone(accountTz, asOf));
  if (!spendRes.ok) warnings.push(`ledger:spend-unreadable — ${spendRes.error}`);

  const ledger = computeSeasonLedger({
    adYear,
    annualMinor: annualBudgetMinorFor(propertyId),
    reservePct: AD_RESERVE_PCT,
    accountSpend: spendRes.ok ? spendRes.data : null,
    trackedMetaCampaignIds: tracked,
    reservedInFlightMinor: inFlight.totalProjectedRemainingMinor,
    asOf: asOf.toISOString(),
    adAccountId: spendRes.ok ? spendRes.data.adAccountId : undefined,
  });

  // ── baseline: a complete plan before any reasoning ──
  const deliverableAudienceIds = auds.filter((a) => a.deliverable).map((a) => a.id);
  const policy: AllocatorPolicy = {
    annualMinor: annualBudgetMinorFor(propertyId),
    reservePct: AD_RESERVE_PCT,
    minLeadDays: MIN_LEAD_DAYS,
    minViableDailyMinor: MIN_VIABLE_DAILY_MINOR,
    maxDailyBudgetMinor: getMaxDailyBudgetMinor(),
    absoluteMaxPerCampaignMinor: ABSOLUTE_MAX_TOTAL_MINOR,
    maxSpendRatioOfValue: MAX_SPEND_RATIO_OF_VALUE,
    ...DEFAULT_PHASE_POLICY,
    accountCpc: account.available ? (account.lifetimeCpc ?? null) : null,
    retargetPossible: deliverableAudienceIds.length > 0,
    // Days on air, not an envelope per window: the horizon's own length at the owner's daily rate.
    paceBudgetMinor: Math.round(dates.length * AD_DOCTRINE.budgetModel.dailyRon * 100),
  };
  const ranked = rankSeasonWindows(candidates, policy, asOfYmd);
  const allocation = allocateSeasonBudget(candidates, ranked, ledger, policy, asOfYmd);

  return {
    meta: {
      generatedFor: propertyId,
      asOf: asOf.toISOString(),
      generator: 'src/lib/growth/seasonPack.ts',
      seasonKey,
    },
    season: {
      start: opts.start,
      end: opts.end,
      nights: dates.length,
      label: opts.label ?? `${seasonOf(opts.start)} ${opts.start.slice(0, 4)}-${opts.end.slice(2, 4)}`,
    },
    inventory: {
      freeRuns,
      openNights,
      totalNights: dates.length,
      occupancyPct: dates.length ? Math.round(((dates.length - openNights) / dates.length) * 100) : 0,
      note: 'Free runs are HOLD-AWARE (checkAvailabilityWithFlags). `end` is the LAST FREE NIGHT, not a checkout date.',
    },
    candidates,
    baseline: {
      ranked,
      slots: allocation.slots,
      excluded: allocation.excluded,
      method: allocation.method,
      warnings: allocation.warnings,
    },
    ledger,
    inFlight,
    account,
    audiences: auds,
    learnings,
    parity,
    assets,
    periods: periodRows,
    holidayCoverage,
    constraints: {
      annualBudgetMinor: annualBudgetMinorFor(propertyId),
      maxDailyBudgetMinor: getMaxDailyBudgetMinor(),
      absoluteMaxPerCampaignMinor: ABSOLUTE_MAX_TOTAL_MINOR,
      minLeadDays: MIN_LEAD_DAYS,
      adSetDailyFloorMinor: AD_SET_DAILY_FLOOR_MINOR,
      minViableDailyMinor: minViableDailyMinor(policy),
      maxSpendRatioOfValue: MAX_SPEND_RATIO_OF_VALUE,
      note:
        'minViableDailyMinor is DERIVED from the account\'s own CPC, not chosen. Lowering it to cover ' +
        'more windows buys coverage on paper and delivery nowhere.',
    },
    deliverableAudienceIds,
    doctrine: {
      ...AD_DOCTRINE,
      horizonToday: doctrineHorizon(asOfYmd),
      note:
        'These are the owner\'s own constraints, stated 2026-09-09. A window outside horizonToday ' +
        'is not automatically wrong to propose — but it needs a reason that beats "it has the most ' +
        'value at risk", because that is the reasoning that put summer top of a September plan. ' +
        'Windows nearer than the horizon are a WhatsApp job, not an ad job.',
    },
    method: PACK_METHOD,
    note: PACK_NOTE,
    warnings: [...warnings, ...allocation.warnings, ...ledger.warnings],
  };
}
