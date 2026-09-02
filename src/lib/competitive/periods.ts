/**
 * Grouping the board by the owner's own pricing periods.
 *
 * WHY THE PERIOD, AND NOT THE WINDOW. The board was built with one row per date-window, which looked
 * right until the December data arrived: 23-26, 23-27, 24-29 and 25-28 Dec are four probes into the
 * same nights. As four rows they read as four decisions. They are one situation — Christmas — and he
 * has a period named exactly that.
 *
 * Two things follow, and the second is the one that actually forced this module:
 *
 *  - **A period is the lever.** He prices `Christmas`, `Vacanta Toamna`, `1 Decembrie`. A window is
 *    only a probe into a period; it is evidence, not a decision.
 *  - **Money is only honest at the period.** Summing "unsold direct money" per window counted the
 *    same nights once per overlapping probe — 14,018 RON of Christmas exposure for about five nights.
 *    Nights exist once, so the money has to be computed once, from the period's own nights.
 *
 * WHAT THIS REFUSES TO DO. A period never gets a verdict of its own. Rolling contests up across
 * channels is one step from pooling them, which C8 forbids — so a period carries counts and money,
 * and the verdicts stay down at the contest where they were measured.
 *
 * PURE. Periods and rows in, grouped rows out. No I/O, no clock.
 */
import type { BoardRow } from './board';

export interface PricingPeriod {
  id: string;
  name: string;
  startDate: string;
  /** Inclusive, as the pricing engine stores it. */
  endDate: string;
  /** What the engine currently charges per night — HIS number, never compared to a competitor's. */
  weekdayRate: number | null;
  weekendRate: number | null;
}

export interface PeriodGroup {
  period: PricingPeriod | null;
  /** Windows that fall mostly inside this period, chronological. */
  windows: Array<{ key: string; checkIn: string; checkOut: string; nights: number; rows: BoardRow[];
                   /** Nights of this window that land inside the period, when it spills. */
                   nightsInside: number }>;
  /** Direct revenue on this period's UNSOLD nights. Counted once — see the module note. */
  unsoldMoney: number;
  openNights: number;
  /** Windows read that sample this period but are filed under a neighbour. */
  alsoSampledBy: Array<{ key: string; checkIn: string; checkOut: string; nightsInside: number }>;
}

/** The nights of a stay, check-out excluded. String arithmetic: this codebase has a UTC-shift scar. */
export function nightsOf(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  const [y, m, d] = checkIn.split('-').map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d));
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  while (cur.getTime() < end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

const inPeriod = (date: string, p: PricingPeriod) => date >= p.startDate && date <= p.endDate;

export interface GroupInput {
  rows: BoardRow[];
  periods: PricingPeriod[];
  /** Nights already booked, so the money is what is genuinely still at stake. */
  soldNights: Set<string>;
  /** Per-night direct rate, by date. From the price calendar — his own number. */
  rateByNight: Map<string, number>;
}

/**
 * Group the board's rows under the period each window mostly falls in.
 *
 * A window that straddles a boundary is filed where the majority of its nights land, and BOTH sides
 * are told: the owning period records how many nights are actually inside, and the neighbour gets an
 * `alsoSampledBy` entry pointing at it. Assigning silently would move evidence without saying so.
 */
export function groupByPeriod(input: GroupInput): PeriodGroup[] {
  const { rows, periods, soldNights, rateByNight } = input;

  const byWindow = new Map<string, BoardRow[]>();
  for (const r of rows) {
    const k = `${r.checkIn}|${r.checkOut}`;
    if (!byWindow.has(k)) byWindow.set(k, []);
    byWindow.get(k)!.push(r);
  }

  const groups = new Map<string, PeriodGroup>();
  const keyFor = (p: PricingPeriod | null) => p?.id ?? '__none';
  for (const p of periods) {
    groups.set(p.id, { period: p, windows: [], unsoldMoney: 0, openNights: 0, alsoSampledBy: [] });
  }
  groups.set('__none', { period: null, windows: [], unsoldMoney: 0, openNights: 0, alsoSampledBy: [] });

  for (const [k, group] of byWindow) {
    const [checkIn, checkOut] = k.split('|');
    const nights = nightsOf(checkIn, checkOut);

    // Where does this window mostly sit? Count nights per period and take the largest.
    const tally = new Map<string, number>();
    for (const n of nights) {
      const p = periods.find((x) => inPeriod(n, x));
      const id = keyFor(p ?? null);
      tally.set(id, (tally.get(id) ?? 0) + 1);
    }
    const owner = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    const ownerId = owner ? owner[0] : '__none';
    groups.get(ownerId)!.windows.push({
      key: `${checkIn}|${checkOut}`, checkIn, checkOut, nights: nights.length,
      rows: group.sort((a, b) => a.channel.localeCompare(b.channel) || a.partyLabel.localeCompare(b.partyLabel)),
      nightsInside: owner ? owner[1] : nights.length,
    });

    // Every OTHER period this window samples hears about it, so evidence is never moved in silence.
    for (const [id, n] of tally) {
      if (id === ownerId) continue;
      groups.get(id)?.alsoSampledBy.push({ key: `${checkIn}|${checkOut}`, checkIn, checkOut, nightsInside: n });
    }
  }

  // Money, once, from the period's own unsold nights.
  for (const [id, g] of groups) {
    if (!g.period) continue;
    for (const n of nightsOf(g.period.startDate, addDay(g.period.endDate))) {
      if (soldNights.has(n)) continue;
      g.openNights++;
      g.unsoldMoney += rateByNight.get(n) ?? 0;
    }
    void id;
  }

  return [...groups.values()]
    .filter((g) => g.period !== null || g.windows.length > 0)
    .sort((a, b) => (a.period?.startDate ?? '9999').localeCompare(b.period?.startDate ?? '9999'));
}

/** Period end dates are inclusive; `nightsOf` is exclusive. One day bridges them. */
function addDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return t.toISOString().slice(0, 10);
}
