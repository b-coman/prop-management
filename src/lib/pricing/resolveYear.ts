/**
 * Resolve canonical season RULES into the concrete `PricingPeriod` rows for one year.
 *
 * The periods table is a set of dates. Dates cannot be canonical: Ziua Unirii is a Saturday in 2026
 * and a Sunday in 2027, Easter moves by weeks, and the school calendar is published late and
 * sometimes not at all (each county picks its own *vacanta mobila* week). What IS stable is the
 * rule — "the stay around the national day", "the five nights before Christmas", "summer" — so the
 * rule is what gets stored and the dates are what gets computed, every year, against that year's
 * real calendar.
 *
 * Three anchor kinds cover every period the property actually sells:
 *
 *   - `calendar`  — a month-day range. Backgrounds (Summer, Fall) and anything the calendar alone
 *                   decides.
 *   - `holiday`   — a row in the seeded `holidays` collection, by slug. Public holidays, school
 *                   breaks and bridge days all live there. Never derived; Easter and the ministerial
 *                   breaks are FETCHED facts, and computing them is how you get them wrong.
 *   - `span`      — from one edge to another, where an edge is a rule or a holiday plus an offset.
 *                   This is what expresses "the five nights before Christmas" and "the tail of the
 *                   winter break after New Year" without hard-coding either date.
 *
 * **Resolving to nothing is a legal outcome.** Ziua Unirii 2027 falls on a Sunday and produces no
 * window worth pricing; a rule whose holiday is not seeded for the year produces nothing and says
 * so. Both are reported in `unresolved`, never silently dropped — a missing period is how 444 days
 * of the calendar came to have no price at all.
 *
 * Pure. No Firestore, no network. The caller supplies the holidays.
 */
import { travelWindow, suggestedMinStay, type OfficialDay } from './travelWindow';
import { addDaysYmd, type PricingPeriod, type Tier } from './periods';

/** A seeded holiday row, as `scripts/seed-holidays.ts` writes it. */
export interface HolidayRow {
  slug: string;
  name: string;
  startDate: string;
  endDate: string;
  year: number;
  type: 'major' | 'minor' | 'school-break' | 'bridge-day';
  official?: boolean;
  notes?: string;
}

/** One end of a `span`, named by the rule or holiday it hangs off, plus a day offset. */
export type SpanEdge =
  | { rule: string; edge: 'start' | 'end'; offset?: number }
  /**
   * `yearOffset: 1` reaches the NEXT calendar year's instance. A pricing year runs past 31 December
   * — New Year's Eve is the 2026 season's product but Anul Nou is a 2027 row — so without this the
   * span would grab January's holiday from the wrong end of the year and resolve backwards.
   */
  | { holiday: string; edge: 'start' | 'end'; offset?: number; yearOffset?: number };

export type Anchor =
  /** `from`/`to` are MM-DD. `to` before `from` means the range wraps into the next year. */
  | { kind: 'calendar'; from: string; to: string }
  /**
   * `window: 'travel'` runs the holiday through `travelWindow`, so the period starts on the
   * departure evening and ends on the last day off. `'exact'` takes the seeded dates as they are,
   * which is what a school break needs — a break is not a run of days the country is off work, and
   * feeding one to `travelWindow` invents a departure evening it does not have.
   */
  | { kind: 'holiday'; slug: string; window: 'travel' | 'exact'; shiftStart?: number; shiftEnd?: number; yearOffset?: number }
  | { kind: 'span'; from: SpanEdge; to: SpanEdge };

export interface SeasonRule {
  slug: string;
  name: string;
  anchor: Anchor;
  /** Higher wins where rules overlap. Occasions carve into backgrounds at priority 0. */
  priority?: number;
  tier?: Tier;
  weekdayRate?: number | null;
  fixedNightPrice?: number | null;
  /** `'auto'` asks `suggestedMinStay` — only meaningful on a holiday-anchored rule. */
  minStay?: number | 'auto';
  flatRate?: boolean;
  available?: boolean;
  /**
   * Ministerial anchors are published late and sometimes stay undecided. A rule marked
   * `provisional` still resolves; it is flagged so a draft never reads as settled fact.
   */
  certainty?: 'resolved' | 'provisional';
  /**
   * A price premium on named nights inside the period, expressed against an anchor rather than as
   * dates. New Year's Eve is the case: the two nights around 31 December carry a party premium and
   * the shoulder nights do not. Writing that as three separate periods is what made the property's
   * most valuable rate unmeasurable — `apply-band-pricing` only solves over stays contained in one
   * period, and a two-day period with a three-night minimum can never contain a bookable stay.
   */
  premiumNights?: { anchor: SpanEdge; offsets: number[]; price: number };
  /** Why this rule exists, in the owner's terms. Carried onto the period for the admin UI. */
  note?: string;
}

/**
 * A deliberate departure from the rules for one year.
 *
 * These exist so the rules stay canonical instead of being bent until they round-trip. A hand
 * decision — a start date moved after reading last year's arrivals, a rate derived from an OTA
 * parity probe — is not a rule and must not be written as one. `reason` is required: an exception
 * without one is a hack wearing a schema.
 */
export interface YearException {
  year: number;
  slug: string;
  reason: string;
  /** Fields to override on the resolved period. */
  patch?: Partial<PricingPeriod>;
  /** This rule produced no period that year, by decision rather than by calendar. */
  drop?: boolean;
  /** A period with no rule behind it. Use sparingly; a recurring one belongs in the rules. */
  add?: Omit<PricingPeriod, 'id' | 'propertyId' | 'year' | 'status'>;
}

export interface ResolveOptions {
  propertyId: string;
  /** Defaults to `'active'`. A generated future year should be `'draft'`. */
  status?: PricingPeriod['status'];
  exceptions?: YearException[];
}

export interface ResolveResult {
  periods: PricingPeriod[];
  /** Rules that produced nothing, each with the reason. Never silent. */
  unresolved: Array<{ slug: string; reason: string }>;
  notes: string[];
}

const MMDD = /^\d{2}-\d{2}$/;

/** Days the country is actually off work. School breaks are not; bridge days are. */
export function officialDaysFrom(holidays: HolidayRow[]): OfficialDay[] {
  const out: OfficialDay[] = [];
  for (const h of holidays) {
    if (h.type === 'school-break') continue;
    for (let d = h.startDate; d <= h.endDate; d = addDaysYmd(d, 1)) out.push({ date: d, name: h.name });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Pick the instance of a holiday that belongs to pricing year `year`.
 *
 * Prefers the row tagged with that year, then any row whose stretch touches it — the winter break
 * starts in December and ends in January, and both years have a legitimate claim on it.
 */
function findHoliday(holidays: HolidayRow[], slug: string, year: number): HolidayRow | null {
  const bySlug = holidays.filter((h) => h.slug === slug);
  return (
    bySlug.find((h) => h.year === year) ??
    bySlug.find((h) => h.startDate.slice(0, 4) === String(year)) ??
    null
  );
}

type Resolved = { start: string; end: string; minStayAuto: number | null };

/** Resolve one span edge to a date, or say why it could not. Shared by `span` and `premiumNights`. */
function resolveEdge(
  e: SpanEdge, year: number, holidays: HolidayRow[], done: Map<string, Resolved>
): string | { error: string } {
  const off = e.offset ?? 0;
  if ('rule' in e) {
    const r = done.get(e.rule);
    if (!r) return { error: `references rule "${e.rule}", which did not resolve` };
    return addDaysYmd(e.edge === 'start' ? r.start : r.end, off);
  }
  const hy = year + (e.yearOffset ?? 0);
  const h = findHoliday(holidays, e.holiday, hy);
  if (!h) return { error: `references holiday "${e.holiday}", not seeded for ${hy}` };
  return addDaysYmd(e.edge === 'start' ? h.startDate : h.endDate, off);
}

function resolveAnchor(
  rule: SeasonRule,
  year: number,
  holidays: HolidayRow[],
  officialDays: OfficialDay[],
  done: Map<string, Resolved>
): Resolved | { error: string } {
  const a = rule.anchor;

  if (a.kind === 'calendar') {
    if (!MMDD.test(a.from) || !MMDD.test(a.to)) return { error: `calendar anchor needs MM-DD, got ${a.from}..${a.to}` };
    const start = `${year}-${a.from}`;
    // A range whose end reads earlier than its start wraps the year boundary (a festive season).
    const end = a.to < a.from ? `${year + 1}-${a.to}` : `${year}-${a.to}`;
    return { start, end, minStayAuto: null };
  }

  if (a.kind === 'holiday') {
    const hy = year + (a.yearOffset ?? 0);
    const h = findHoliday(holidays, a.slug, hy);
    if (!h) return { error: `no holiday "${a.slug}" seeded for ${hy} — fetch it, never derive it` };
    if (a.window === 'exact') {
      return {
        start: addDaysYmd(h.startDate, a.shiftStart ?? 0),
        end: addDaysYmd(h.endDate, a.shiftEnd ?? 0),
        minStayAuto: null,
      };
    }
    const w = travelWindow(h.startDate, h.endDate, officialDays);
    // `checkOut` is exclusive everywhere in the system; a period's `endDate` is the last NIGHT.
    return {
      start: addDaysYmd(w.checkIn, a.shiftStart ?? 0),
      end: addDaysYmd(addDaysYmd(w.checkOut, -1), a.shiftEnd ?? 0),
      minStayAuto: suggestedMinStay(w),
    };
  }

  const edge = (e: SpanEdge) => resolveEdge(e, year, holidays, done);

  const from = edge(a.from);
  if (typeof from !== 'string') return from;
  const to = edge(a.to);
  if (typeof to !== 'string') return to;
  if (to < from) return { error: `span resolved backwards (${from} → ${to}) — it produces no nights this year` };
  return { start: from, end: to, minStayAuto: null };
}

/**
 * Resolve every rule for one pricing year.
 *
 * A period belongs to the year its FIRST NIGHT falls in, which is how the live table already reads:
 * New Year runs 28 Dec → 2 Jan and is tagged 2026, because it is the 2026 season's product.
 */
export function resolveYear(
  rules: SeasonRule[],
  holidays: HolidayRow[],
  year: number,
  opts: ResolveOptions
): ResolveResult {
  const officialDays = officialDaysFrom(holidays);
  const exceptions = (opts.exceptions ?? []).filter((e) => e.year === year);
  const status = opts.status ?? 'active';
  const unresolved: ResolveResult['unresolved'] = [];
  const notes: string[] = [];
  const done = new Map<string, Resolved>();

  // Spans hang off other rules, so resolve in passes until nothing more moves. A cycle simply stops
  // making progress and every rule left over is reported by name.
  const pending = [...rules];
  for (let pass = 0; pass < rules.length + 1 && pending.length; pass++) {
    const stuck: SeasonRule[] = [];
    let moved = false;
    for (const rule of pending) {
      const r = resolveAnchor(rule, year, holidays, officialDays, done);
      if ('error' in r) {
        // A span waiting on a rule that has not resolved YET is not an error until the passes stop.
        if (r.error.includes('did not resolve')) { stuck.push(rule); continue; }
        unresolved.push({ slug: rule.slug, reason: r.error });
        moved = true;
        continue;
      }
      done.set(rule.slug, r);
      moved = true;
    }
    pending.length = 0;
    pending.push(...stuck);
    if (!moved) break;
  }
  for (const rule of pending) {
    unresolved.push({ slug: rule.slug, reason: 'span could not resolve — its reference is missing or circular' });
  }

  const periods: PricingPeriod[] = [];
  for (const rule of rules) {
    const r = done.get(rule.slug);
    if (!r) continue;
    const ex = exceptions.find((e) => e.slug === rule.slug);
    if (ex?.drop) {
      unresolved.push({ slug: rule.slug, reason: `dropped by exception: ${ex.reason}` });
      continue;
    }
    const minStay =
      rule.minStay === 'auto'
        ? r.minStayAuto ?? null
        : rule.minStay ?? null;
    if (rule.minStay === 'auto' && r.minStayAuto == null) {
      notes.push(`${rule.slug}: minStay 'auto' needs a holiday window; this anchor has none, so it is unset`);
    }

    const startYear = Number(r.start.slice(0, 4));
    const base: PricingPeriod = {
      id: `${opts.propertyId}_${rule.slug}_${startYear}`,
      propertyId: opts.propertyId,
      year: startYear,
      slug: rule.slug,
      name: rule.name,
      startDate: r.start,
      endDate: r.end,
      tier: rule.tier ?? 'base',
      priority: rule.priority ?? 0,
      fixedNightPrice: rule.fixedNightPrice ?? null,
      weekdayRate: rule.weekdayRate ?? null,
      minStay,
      status,
      ...(rule.flatRate != null ? { flatRate: rule.flatRate } : {}),
      ...(rule.available != null ? { available: rule.available } : {}),
    };

    if (rule.premiumNights) {
      const at = resolveEdge(rule.premiumNights.anchor, year, holidays, done);
      if (typeof at !== 'string') {
        notes.push(`${rule.slug}: premium nights ${at.error} — the period is priced flat this year`);
      } else {
        const profile = rule.premiumNights.offsets
          .map((o) => ({ date: addDaysYmd(at, o), price: rule.premiumNights!.price }))
          .filter((n) => n.date >= r.start && n.date <= r.end);
        const outside = rule.premiumNights.offsets.length - profile.length;
        if (outside) notes.push(`${rule.slug}: ${outside} premium night(s) fall outside the period and were dropped`);
        if (profile.length) base.nightProfile = profile;
      }
    }
    periods.push(ex?.patch ? { ...base, ...ex.patch } : base);
    if (ex?.patch) notes.push(`${rule.slug}: patched by exception — ${ex.reason}`);
    if (rule.certainty === 'provisional') {
      notes.push(`${rule.slug}: PROVISIONAL — the anchor is not final for ${year}; re-resolve when it is published`);
    }
  }

  for (const ex of exceptions) {
    if (!ex.add) continue;
    const startYear = Number(ex.add.startDate.slice(0, 4));
    periods.push({
      ...ex.add,
      id: `${opts.propertyId}_${ex.slug}_${startYear}`,
      propertyId: opts.propertyId,
      year: startYear,
      status,
    } as PricingPeriod);
    notes.push(`${ex.slug}: added by exception — ${ex.reason}`);
  }

  periods.sort((a, b) => a.startDate.localeCompare(b.startDate));
  return { periods, unresolved, notes };
}
