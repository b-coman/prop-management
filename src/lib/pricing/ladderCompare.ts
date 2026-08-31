/**
 * Your long-stay discounts against the platforms' own.
 *
 * WHY THIS DECIDES THE WHOLE PARITY PROBLEM. The machine sets ONE nightly rate per period and
 * compares against whichever platform is cheapest. If the direct length-of-stay ladder differs from
 * that platform's, the gap between them moves with stay length all by itself, and no rate can hold
 * every length inside the band - the rate sets the level, the ladder sets the shape. Matching the
 * shape is what makes the level solvable.
 *
 * Measured on this property's 32 stays: dropping the 3-night discount, which NEITHER platform offers,
 * and bringing 7 nights from 25% to 20% takes stays inside the band from 21 to 25.
 *
 * Everything here comes from `channels/{id}.lengthOfStayDiscounts`, recorded from the platforms' own
 * settings screens. Never inferred from captured prices: that was tried and it mixed channels, party
 * sizes and live promotions together and gave the wrong ladder.
 *
 * PURE. No I/O.
 */
export interface LadderRung { nightsThreshold: number; discountPercentage: number; label?: string; nonRefundable?: boolean }

export interface LadderRow {
  nights: number;
  /** Per channel, the discount that applies at this length. */
  byChannel: Record<string, { pct: number; label?: string; nonRefundable?: boolean }>;
  /** The deepest discount any comparable platform gives at this length. */
  bestPlatformPct: number;
  bestPlatformId: string | null;
  directPct: number;
  /** Positive: you discount more deeply than any platform. Negative: a platform undercuts you. */
  edgePp: number;
}

export const discountAt = (nights: number, ladder: LadderRung[] | undefined): LadderRung | null => {
  if (!ladder?.length) return null;
  return ladder.filter((d) => nights >= d.nightsThreshold)
    .sort((a, b) => b.nightsThreshold - a.nightsThreshold)[0] ?? null;
};

/**
 * One row per length worth showing: every threshold anyone uses, so no rung is invisible.
 *
 * A non-refundable platform rate is reported but never counted as the one to match - it is a
 * different product from a flexible direct booking, and matching its depth would mean discounting
 * against a promise the direct site does not make.
 */
export function compareLadders(
  direct: LadderRung[],
  platforms: Array<{ channelId: string; ladder: LadderRung[] }>,
): LadderRow[] {
  const thresholds = new Set<number>([2, 3]);
  for (const r of direct) thresholds.add(r.nightsThreshold);
  for (const p of platforms) for (const r of p.ladder) thresholds.add(r.nightsThreshold);

  return [...thresholds].sort((a, b) => a - b).map((nights) => {
    const byChannel: LadderRow['byChannel'] = {};
    let bestPlatformPct = 0;
    let bestPlatformId: string | null = null;
    for (const p of platforms) {
      const r = discountAt(nights, p.ladder);
      const pct = r?.discountPercentage ?? 0;
      byChannel[p.channelId] = { pct, label: r?.label, nonRefundable: r?.nonRefundable };
      if (!r?.nonRefundable && pct > bestPlatformPct) { bestPlatformPct = pct; bestPlatformId = p.channelId; }
    }
    const directPct = discountAt(nights, direct)?.discountPercentage ?? 0;
    return { nights, byChannel, bestPlatformPct, bestPlatformId, directPct, edgePp: directPct - bestPlatformPct };
  });
}

/** The rungs worth changing, worst mismatch first. Silent when the ladders already agree. */
export function ladderAdvice(rows: LadderRow[]): Array<{ nights: number; edgePp: number; text: string }> {
  return rows
    .filter((r) => Math.abs(r.edgePp) >= 5)
    .sort((a, b) => Math.abs(b.edgePp) - Math.abs(a.edgePp))
    .map((r) => ({
      nights: r.nights,
      edgePp: r.edgePp,
      text: r.edgePp > 0
        ? r.bestPlatformPct === 0
          ? `At ${r.nights} nights you take ${r.directPct}% off and no platform discounts at all. That is ${r.edgePp} points given away for nothing.`
          : `At ${r.nights} nights you take ${r.directPct}% off against the best platform's ${r.bestPlatformPct}%, so you are ${r.edgePp} points deeper than you need to be.`
        : `At ${r.nights} nights ${r.bestPlatformId} takes ${r.bestPlatformPct}% off and you take ${r.directPct}%, so they undercut you by ${Math.abs(r.edgePp)} points on stays that long.`,
    }));
}
