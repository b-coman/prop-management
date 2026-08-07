/**
 * Prices built the way the owner actually builds them: **from the Airbnb price outward.**
 *
 * The first version of this got the direction wrong. It treated the website price as the starting
 * point and computed each OTA from it, so whenever the numbers disagreed the only answer it could
 * express was "change the OTA price". That was an assumption baked into the tool, presented as if it
 * were a finding.
 *
 * The owner's spreadsheet does the opposite, and has for five years:
 *
 *     airbnb  = airbnb_base × tier × 1.10      (airbnb_correction)
 *     booking = airbnb_base × tier × 1.33      (bk_factor — commission + Genius + margin)
 *     vrbo    = airbnb ÷ 4.5                   (USD)
 *     website = a bit under the cheapest of them
 *
 * So Airbnb is the anchor. Everything else is a factor away from it, and the website is LAST — set
 * below the cheapest channel, which is the owner's actual rule ("my own channel should be a bit less").
 *
 * Weekday and weekend are separate anchors because the sheet has separate columns for them. The
 * booking engine applies its own weekend multiplier, so these two numbers are what a human types into
 * a dashboard, not what the engine computes.
 *
 * PURE. No I/O.
 */
import { applyRounding, type Rounding } from '@/lib/growth/parityMath';
import { DEFAULT_TIER_MULTIPLIERS, type Tier, type TierMultipliers } from './periods';

export interface AnchorChannelSetting {
  channelId: string;
  /** Multiple of the anchor price. Airbnb's own factor is usually 1.10, Booking's 1.33. */
  factor: number;
  currency: string;
  /** Units of the channel currency per 1 RON — VRBO's sheet divisor of 4.5. */
  fxDivisor?: number;
  rounding?: Rounding | null;
  cleaningFee?: number | null;
}

export interface AnchorConfig {
  /** Which channel the whole sheet is built from. */
  anchorChannelId: string;
  /** The two base prices the sheet starts from, before any tier. */
  weekdayPrice: number;
  weekendPrice: number;
  channels: AnchorChannelSetting[];
  /** How far under the cheapest channel the website should sit. 0.075 = 7.5%. */
  directDiscountPct: number;
  directRounding?: Rounding | null;
}

export const DEFAULT_ROUNDING: Rounding = { nearest: 5, mode: 'nearest' };

export interface AnchoredPrice {
  channelId: string;
  weekday: number;
  weekend: number;
  currency: string;
  /** Set instead of a price when something needed is missing. */
  problem?: string;
}

export interface AnchoredPeriodRow {
  periodId: string;
  periodName: string;
  startDate: string;
  endDate: string;
  nights: number;
  tier: Tier;
  tierMultiplier: number;
  /** Hand-set nightly price, when the period has one. Overrides the whole calculation. */
  fixedNightPrice: number | null;
  channels: AnchoredPrice[];
  /** What the website should be, per the owner's own "a bit under the cheapest" rule. */
  suggestedDirect: { weekday: number; weekend: number };
  /** What the booking engine quotes today, for comparison. Never changed by this module. */
  currentDirect: { weekday: number; weekend: number } | null;
}

export interface AnchoredPeriodInput {
  periodId: string;
  periodName: string;
  startDate: string;
  endDate: string;
  nights: number;
  tier: Tier;
  fixedNightPrice: number | null;
  /** The direct price the engine quotes today: base × tier, and with the weekend multiplier applied. */
  currentDirectWeekday?: number;
  currentDirectWeekend?: number;
}

/**
 * Build one row per period.
 *
 * `suggestedDirect` is a SUGGESTION and nothing writes it anywhere. It says where the website price
 * would sit if the owner's stated rule were applied to today's channel prices. Comparing it against
 * `currentDirect` is the whole point: it shows, per period, whether the website is actually the
 * cheapest place to book — without anything changing on its own.
 */
export function buildAnchoredRows(
  periods: AnchoredPeriodInput[],
  config: AnchorConfig,
  tierMultipliers: TierMultipliers = DEFAULT_TIER_MULTIPLIERS,
): AnchoredPeriodRow[] {
  return periods.map((p) => {
    const tierMultiplier = tierMultipliers[p.tier] ?? 1;

    // A hand-set peak price replaces the tier entirely — that is what "I set this night myself" means.
    // The anchor still scales it, so the channels keep their usual relationship to each other.
    const baseWeekday = p.fixedNightPrice != null ? p.fixedNightPrice : config.weekdayPrice * tierMultiplier;
    const baseWeekend = p.fixedNightPrice != null ? p.fixedNightPrice : config.weekendPrice * tierMultiplier;

    const channels: AnchoredPrice[] = config.channels.map((c) => {
      const rounding = c.rounding ?? DEFAULT_ROUNDING;
      const rawWeekday = baseWeekday * c.factor;
      const rawWeekend = baseWeekend * c.factor;

      if (c.currency !== 'RON') {
        if (!c.fxDivisor) {
          return {
            channelId: c.channelId, weekday: 0, weekend: 0, currency: c.currency,
            problem: `Prices in ${c.currency} but no conversion rate is set.`,
          };
        }
        return {
          channelId: c.channelId,
          weekday: applyRounding(rawWeekday / c.fxDivisor, rounding),
          weekend: applyRounding(rawWeekend / c.fxDivisor, rounding),
          currency: c.currency,
        };
      }
      return {
        channelId: c.channelId,
        weekday: applyRounding(rawWeekday, rounding),
        weekend: applyRounding(rawWeekend, rounding),
        currency: c.currency,
      };
    });

    // "A bit under the cheapest" — compared in RON only, because a USD price is not comparable to a
    // RON one without the same conversion, and guessing there would produce a confident wrong number.
    const ronChannels = channels.filter((c) => c.currency === 'RON' && !c.problem);
    const cheapestWeekday = ronChannels.length ? Math.min(...ronChannels.map((c) => c.weekday)) : baseWeekday;
    const cheapestWeekend = ronChannels.length ? Math.min(...ronChannels.map((c) => c.weekend)) : baseWeekend;
    const dr = config.directRounding ?? DEFAULT_ROUNDING;

    return {
      periodId: p.periodId,
      periodName: p.periodName,
      startDate: p.startDate,
      endDate: p.endDate,
      nights: p.nights,
      tier: p.tier,
      tierMultiplier,
      fixedNightPrice: p.fixedNightPrice,
      channels,
      suggestedDirect: {
        weekday: applyRounding(cheapestWeekday * (1 - config.directDiscountPct), dr),
        weekend: applyRounding(cheapestWeekend * (1 - config.directDiscountPct), dr),
      },
      currentDirect: p.currentDirectWeekday != null
        ? { weekday: p.currentDirectWeekday, weekend: p.currentDirectWeekend ?? p.currentDirectWeekday }
        : null,
    };
  });
}

/**
 * Where the website is NOT the cheapest place to book — the owner's own rule, checked.
 *
 * This is a comparison, not a verdict about what should change. A period appearing here means the
 * website costs a guest more than some channel does; whether to move the website price, the channel
 * price, or neither is a demand decision.
 */
export function periodsWhereDirectIsNotCheapest(rows: AnchoredPeriodRow[]): Array<{
  periodId: string;
  periodName: string;
  startDate: string;
  endDate: string;
  directWeekday: number;
  cheapestChannelId: string;
  cheapestWeekday: number;
  differencePct: number;
}> {
  const out = [];
  for (const r of rows) {
    if (!r.currentDirect) continue;
    const ron = r.channels.filter((c) => c.currency === 'RON' && !c.problem && c.weekday > 0);
    if (!ron.length) continue;
    const cheapest = ron.reduce((a, b) => (b.weekday < a.weekday ? b : a));
    if (r.currentDirect.weekday <= cheapest.weekday) continue;
    out.push({
      periodId: r.periodId,
      periodName: r.periodName,
      startDate: r.startDate,
      endDate: r.endDate,
      directWeekday: r.currentDirect.weekday,
      cheapestChannelId: cheapest.channelId,
      cheapestWeekday: cheapest.weekday,
      differencePct: r.currentDirect.weekday / cheapest.weekday - 1,
    });
  }
  return out;
}
