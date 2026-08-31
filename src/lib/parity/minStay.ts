/**
 * Minimum stay, as a measured fact.
 *
 * The owner's rule is **2 nights everywhere**, raised deliberately on a few special windows — the
 * autumn school break, sometimes Christmas, always New Year's Eve. He sets those raises by hand on
 * Airbnb and on Booking, separately from the direct site, which is exactly the kind of three-place
 * manual edit that drifts.
 *
 * It drifts silently, too, because a longer minimum on one channel is invisible until someone probes
 * a shorter stay there. Two live examples on 2026-08-31:
 *
 *   Vacanta Toamna (24 Oct - 1 Nov)  direct 2 · Booking sold 3 · Airbnb refused under 4
 *   Post-New Year  (1 - 3 Jan)       direct 2 · Airbnb refused under 3 · Booking refused under 3
 *
 * Neither is a pricing fault, and neither shows up anywhere in a price comparison. The first means a
 * guest wanting three nights of the school break can book on Booking but not Airbnb; the second means
 * the direct site sells a two-night New Year stay that neither platform will sell at all.
 *
 * Until this module existed the requirement was only ever a sentence inside a refusal `reason`, so
 * nothing could compare it across channels.
 */

/**
 * Every phrasing the two channels actually use, in one place.
 *
 *   Airbnb   "Minimum stay is 4 nights"
 *   Booking  "You need to stay 3+ nights to book your selected dates"
 *   both     "4-night minimum", "minimum of 5 nights"
 *   ours     "min. stay 3 nights" (hand-written reasons)
 *
 * A phrasing this misses is a window silently dropped from the run rather than re-probed, which is
 * how the escalation in parity-next went its whole life without once firing.
 */
export const MIN_STAY_RE =
  /(\d+)\s*-?\s*night\s*minimum|min(?:imum)?\.?\s*(?:stay\s+)?(?:is\s+|of\s+)?(\d+)\s*nights?|need to stay\s+(\d+)\+?\s*nights?/i;

/** The nights a channel says it requires, or null when the text does not name a number. */
export function parseMinStay(text: string | undefined | null): number | null {
  if (!text) return null;
  const m = text.match(MIN_STAY_RE);
  if (!m) return null;
  const n = Number(m[1] ?? m[2] ?? m[3]);
  return Number.isFinite(n) && n > 0 && n <= 30 ? n : null;
}

export interface MinStayReading {
  /** What the channel stated it requires, from a refusal. */
  required: number | null;
  /** The shortest stay it actually sold — an upper bound on the true minimum. */
  soldAt: number | null;
}

export interface ChannelObservationLite {
  channel: string;
  status: string;
  nights: number;
  reason?: string;
}

/**
 * Fold a channel's observations over one window-set into a single reading.
 *
 * `required` takes the LONGEST stated requirement: two refusals naming different numbers means the
 * requirement varies inside the range, and reporting the shorter one would understate the constraint.
 */
export function readMinStay(observations: ChannelObservationLite[]): MinStayReading {
  let required: number | null = null;
  let soldAt: number | null = null;
  for (const o of observations) {
    if (o.status === 'refused') {
      const n = parseMinStay(o.reason);
      if (n !== null && (required === null || n > required)) required = n;
    } else if (o.status === 'captured') {
      if (soldAt === null || o.nights < soldAt) soldAt = o.nights;
    }
  }
  return { required, soldAt };
}

export type AlignmentVerdict = 'aligned' | 'channel-stricter' | 'channel-looser' | 'unknown';

/**
 * Compare one channel's minimum against the direct site's.
 *
 * `channel-stricter` is the one that costs bookings: the platform turns away a stay we would happily
 * sell. `channel-looser` is the reverse and is usually a leftover, not a decision.
 *
 * A reading with no stated requirement can still prove a channel is looser — if it SOLD a stay shorter
 * than our own minimum, its minimum is below ours whatever it claims.
 */
export function compareMinStay(direct: number | null, reading: MinStayReading): AlignmentVerdict {
  if (direct === null) return 'unknown';
  if (reading.required !== null) {
    if (reading.required > direct) return 'channel-stricter';
    if (reading.required < direct) return 'channel-looser';
    return 'aligned';
  }
  if (reading.soldAt !== null && reading.soldAt < direct) return 'channel-looser';
  return 'unknown';
}
