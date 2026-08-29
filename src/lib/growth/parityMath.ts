/**
 * Direct-vs-OTA parity economics.
 *
 * THE POINT: the guest-facing gap is not the decision. What matters is what the owner KEEPS. At an
 * ~18.5% Airbnb commission and ~23% on Booking.com, a direct booking can be meaningfully cheaper for
 * the guest AND still pay the owner more — because the commission never happens. So a flat "be 10%
 * under" rule is arbitrary in both directions: too timid where commission is high, and potentially
 * loss-making if an OTA runs a deep promotion.
 *
 * This module computes the band that actually matters:
 *
 *   indifference ─────────── recommended ─────────── OTA guest price
 *   (net equal)              (guest sees a real      (above this you simply
 *                            saving, owner earns      lose the booking)
 *                            strictly more)
 *
 * Everything is a pure function of prices + configured rates. No clock, no fetch, no I/O — the same
 * maths backs the on-demand skill and (later) the in-app evaluator, so the two cannot disagree.
 */

/** Per-channel take. `commissionPct` is what the platform keeps from the host. */
export interface ChannelEconomics {
  channel: string;
  /**
   * The END-TO-END TAKE RATE, as a fraction: everything that does not reach the owner, over what the
   * guest actually pays.
   *
   *     commissionPct = 1 − (what the owner receives / what the guest pays)
   *
   * Both measured on the WHOLE booking: nightly rate x nights, plus cleaning and any other fee the
   * owner has set, plus extra-guest fees. It is a MEASURED number, taken from a real payout — not a
   * platform's headline rate.
   *
   * Do NOT decompose it and do NOT rebuild it from components. Booking.com's headline is ~15%, but
   * this property runs an always-on Visibility Booster and pays VAT, and the measured rate is 23.02%
   * (booking 6603646057: guest paid 2064.00, owner received 1588.87). Setting this field to a
   * headline rate would understate the take by eight points and put `indifferencePrice` — the floor
   * below which the owner is better off letting the OTA have the booking — badly in the wrong place.
   *
   * Because it folds in optional settings like a booster, it is a CURRENT CONFIGURATION, not a
   * constant. Re-derive it from a fresh payout when the channel's settings change.
   */
  commissionPct: number;
  /**
   * Fraction of the guest-facing total that never reaches the host at all — a separate guest service
   * fee (Airbnb's split-fee model). Leave 0 for host-only-fee listings, where the guest total IS the
   * host's base. Getting this wrong inflates the apparent OTA net, so record which model each listing
   * actually uses rather than assuming.
   */
  guestFeePct?: number;
}

/** What a direct booking costs the owner to take (card fees, mainly). */
export interface DirectEconomics {
  /** Payment processing as a fraction of the total: 0.029 = 2.9%. */
  paymentCostPct: number;
}

export interface ParityInput {
  directTotal: number;
  /** Guest-facing OTA total as displayed right now — possibly promo-reduced. */
  otaTotal: number;
  /** Guest-facing total BEFORE the channel's promotion, when the page shows a struck-through price. */
  otaListTotal?: number;
  channel: ChannelEconomics;
  direct: DirectEconomics;
  /** How much cheaper direct should look to the guest: 0.05 = 5%. */
  targetDiscountPct: number;
}

export type ParityStatus =
  /** Direct costs the guest MORE than the OTA — the worst state: you lose the booking and pay commission. */
  | 'losing'
  /** Cheaper than the OTA, but by less than the target — not a compelling reason to book direct. */
  | 'thin'
  /** Cheaper by at least the target, and still paying the owner more than the OTA would. */
  | 'healthy'
  /** So cheap that the owner nets LESS than simply taking the OTA booking. Money left on the table. */
  | 'overshoot';

export interface ParityVerdict {
  status: ParityStatus;
  /** Guest-facing gap; negative means direct is cheaper. -0.138 = direct is 13.8% cheaper. */
  guestGapPct: number;
  netDirect: number;
  netOta: number;
  /** netDirect − netOta at the CURRENT direct price. Positive = direct booking is worth more. */
  netAdvantage: number;
  /** The direct price at which the owner is exactly indifferent. Never price below this. */
  indifferencePrice: number;
  /** How far under the OTA price you could go before hitting indifference. The real room you have. */
  headroomPct: number;
  /** Where to price: at least a target-sized saving for the guest, never below indifference. */
  recommendedBand: { min: number; max: number } | null;
  /** True when the current OTA price is promotion-driven (a list price was supplied and is higher). */
  promoDriven: boolean;
  /** Parity against the channel's LIST price — "am I fine when the promo ends?" */
  vsListGapPct: number | null;
  notes: string[];
}

/** What the owner keeps from a direct booking. */
export function netFromDirect(directTotal: number, direct: DirectEconomics): number {
  return directTotal * (1 - direct.paymentCostPct);
}

/** What the owner keeps from an OTA booking at a given guest-facing total. */
export function netFromOta(otaTotal: number, channel: ChannelEconomics): number {
  const hostBase = otaTotal * (1 - (channel.guestFeePct ?? 0));
  return hostBase * (1 - channel.commissionPct);
}

/**
 * The direct price whose net exactly equals the net of the same booking taken through the channel.
 * Below this the owner would genuinely be better off letting the OTA have it.
 */
export function indifferencePrice(
  otaTotal: number,
  channel: ChannelEconomics,
  direct: DirectEconomics,
): number {
  return netFromOta(otaTotal, channel) / (1 - direct.paymentCostPct);
}

/**
 * Fraction below the OTA's guest price that the owner could go while still netting at least as much.
 * Depends only on the rates, not on the price — this is the structural advantage of booking direct
 * (~16% against an 18.5% Airbnb commission, ~21% against 23% on Booking.com).
 */
export function headroomPct(channel: ChannelEconomics, direct: DirectEconomics): number {
  return 1 - (1 - (channel.guestFeePct ?? 0)) * (1 - channel.commissionPct) / (1 - direct.paymentCostPct);
}

/**
 * How a channel's guest-facing price is rounded after gross-up. The owner's sheet rounds to the
 * nearest 5 lei and rounds the VRBO weekday leg UP, so it is per-channel, not a constant.
 */
export interface Rounding {
  /** Round to a multiple of this. 0 or undefined means no rounding. */
  nearest: number;
  mode: 'nearest' | 'up' | 'down';
}

export function applyRounding(value: number, rounding?: Rounding | null): number {
  if (!rounding?.nearest) return value;
  const q = value / rounding.nearest;
  const n = rounding.mode === 'up' ? Math.ceil(q) : rounding.mode === 'down' ? Math.floor(q) : Math.round(q);
  return n * rounding.nearest;
}

/**
 * What a channel must be listed at to net the SAME as a given direct price.
 *
 * This is the exact inverse of `headroomPct`: headroom says how far under an OTA price direct can go,
 * so its reciprocal says how far above a direct price the OTA must sit. Deriving it here rather than
 * copying the spreadsheet's magic numbers is what makes those numbers legible — the sheet's Booking
 * factor of ×1.33 is not one decision but three (commission, the Genius discount it prices for, and
 * margin), and only the last is a choice. `extraAdjustmentPct` is where that choice lives.
 *
 * A NEGATIVE extraAdjustmentPct means the channel is listed BELOW net parity — it will show the
 * cheapest guest price and return the lowest net per night. That is not drift to be preserved
 * silently; it is a finding to put in front of the owner.
 */
export function grossUpFactor(
  channel: ChannelEconomics,
  direct: DirectEconomics,
  extraAdjustmentPct = 0,
): number {
  return (1 / (1 - headroomPct(channel, direct))) * (1 + extraAdjustmentPct);
}

/** The listed nightly price for a channel, given the direct nightly price. */
export function channelNightly(
  directNightly: number,
  channel: ChannelEconomics,
  direct: DirectEconomics,
  opts: { extraAdjustmentPct?: number; rounding?: Rounding | null; fxRateToChannelCurrency?: number } = {},
): number {
  const raw = directNightly * grossUpFactor(channel, direct, opts.extraAdjustmentPct ?? 0);
  const converted = opts.fxRateToChannelCurrency ? raw / opts.fxRateToChannelCurrency : raw;
  return applyRounding(converted, opts.rounding);
}

/**
 * Given what a channel is ACTUALLY listed at, recover the deliberate adjustment hiding inside it.
 * This is how an existing spreadsheet gets decomposed instead of enshrined: feed it the real listed
 * price and it says how far from net parity that price sits, and in which direction.
 */
export function impliedExtraAdjustmentPct(
  directNightly: number,
  listedChannelNightly: number,
  channel: ChannelEconomics,
  direct: DirectEconomics,
): number {
  if (directNightly <= 0) return 0;
  const structural = grossUpFactor(channel, direct, 0);
  return (listedChannelNightly / directNightly) / structural - 1;
}

export function evaluateParity(input: ParityInput): ParityVerdict {
  const { directTotal, otaTotal, otaListTotal, channel, direct, targetDiscountPct } = input;
  const notes: string[] = [];

  const guestGapPct = otaTotal > 0 ? directTotal / otaTotal - 1 : 0;
  const netDirect = netFromDirect(directTotal, direct);
  const netOta = netFromOta(otaTotal, channel);
  const indifference = indifferencePrice(otaTotal, channel, direct);
  const room = headroomPct(channel, direct);

  const targetPrice = otaTotal * (1 - targetDiscountPct);
  const recommendedBand = targetPrice >= indifference
    ? { min: indifference, max: targetPrice }
    : null;

  const promoDriven = typeof otaListTotal === 'number' && otaListTotal > otaTotal;
  const vsListGapPct = typeof otaListTotal === 'number' && otaListTotal > 0
    ? directTotal / otaListTotal - 1
    : null;

  let status: ParityStatus;
  if (directTotal >= otaTotal) {
    status = 'losing';
    notes.push(
      `Direct costs the guest ${Math.round((guestGapPct) * 1000) / 10}% MORE than ${channel.channel}. ` +
      `A guest who checks both books there, and the commission comes off the top.`
    );
  } else if (directTotal < indifference) {
    status = 'overshoot';
    notes.push(
      `Direct is below the indifference price (${Math.round(indifference)}). Taking the ${channel.channel} ` +
      `booking would actually pay more — this is cheaper than it needs to be.`
    );
  } else if (directTotal > targetPrice) {
    status = 'thin';
    notes.push(
      `Cheaper than ${channel.channel}, but by under the ${Math.round(targetDiscountPct * 100)}% target — ` +
      `probably not enough for a guest to switch.`
    );
  } else {
    status = 'healthy';
  }

  if (recommendedBand === null) {
    notes.push(
      `A ${Math.round(targetDiscountPct * 100)}% saving would price below indifference — this channel's ` +
      `current price is too low to undercut profitably. Address the price on ${channel.channel} rather ` +
      `than matching it here.`
    );
  }

  if (promoDriven) {
    notes.push(
      `${channel.channel}'s price is promotion-driven (list ${Math.round(otaListTotal!)}). Chasing a promo ` +
      `down is optional — but note the commission still makes a direct booking worth more at any price ` +
      `above ${Math.round(indifference)}.`
    );
  }

  return {
    status,
    guestGapPct,
    netDirect,
    netOta,
    netAdvantage: netDirect - netOta,
    indifferencePrice: indifference,
    headroomPct: room,
    recommendedBand,
    promoDriven,
    vsListGapPct,
    notes,
  };
}

/**
 * Across channels, the binding constraint is the CHEAPEST guest-facing price — averaging hides the one
 * that is actually losing you the booking. Returns the channel to beat.
 */
export function bestOffer<T extends { channel: string; otaTotal: number }>(offers: T[]): T | null {
  if (!offers.length) return null;
  return offers.reduce((best, o) => (o.otaTotal < best.otaTotal ? o : best));
}

/**
 * Spread between the dearest and cheapest channel for the same nights. A wide spread is its own
 * problem: one channel quietly undercuts the others, dragging down the floor direct has to beat and
 * looking incoherent to any guest who checks twice.
 */
export function channelSpreadPct(offers: Array<{ otaTotal: number }>): number | null {
  if (offers.length < 2) return null;
  const totals = offers.map((o) => o.otaTotal);
  const min = Math.min(...totals);
  return min > 0 ? Math.max(...totals) / min - 1 : null;
}
