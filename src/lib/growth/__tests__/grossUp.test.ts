/** @jest-environment node */

import {
  grossUpFactor, channelNightly, applyRounding, impliedExtraAdjustmentPct,
  headroomPct, netFromDirect, netFromOta,
  type ChannelEconomics, type DirectEconomics,
} from '../parityMath';

// The owner's rates, as persisted in the `channels` collection on 2026-08-07.
const AIRBNB: ChannelEconomics = { channel: 'airbnb', commissionPct: 0.18755 };
const BOOKING: ChannelEconomics = { channel: 'booking.com', commissionPct: 0.23 };
const VRBO: ChannelEconomics = { channel: 'vrbo', commissionPct: 0.20 };
const DIRECT: DirectEconomics = { paymentCostPct: 0.029 };

describe('gross-up is the exact inverse of headroom', () => {
  it.each([[AIRBNB], [BOOKING], [VRBO]])('%o round-trips', (ch) => {
    expect(grossUpFactor(ch, DIRECT)).toBeCloseTo(1 / (1 - headroomPct(ch, DIRECT)), 12);
  });

  // The whole point: list at the gross-up factor and the owner keeps the same money either way.
  it.each([[AIRBNB], [BOOKING], [VRBO]])('preserves net exactly for %o', (ch) => {
    const direct = 525;
    const listed = direct * grossUpFactor(ch, DIRECT);
    expect(netFromOta(listed, ch)).toBeCloseTo(netFromDirect(direct, DIRECT), 9);
  });

  it('scales the factor by the deliberate adjustment', () => {
    const base = grossUpFactor(BOOKING, DIRECT);
    expect(grossUpFactor(BOOKING, DIRECT, 0.05)).toBeCloseTo(base * 1.05, 12);
    expect(grossUpFactor(BOOKING, DIRECT, -0.04)).toBeCloseTo(base * 0.96, 12);
  });
});

describe('rounding — the sheet rounds to the nearest 5, and VRBO weekdays up', () => {
  it('rounds to nearest', () => {
    expect(applyRounding(632.4, { nearest: 5, mode: 'nearest' })).toBe(630);
    expect(applyRounding(633.0, { nearest: 5, mode: 'nearest' })).toBe(635);
  });

  it('rounds up and down on demand', () => {
    expect(applyRounding(631.1, { nearest: 5, mode: 'up' })).toBe(635);
    expect(applyRounding(634.9, { nearest: 5, mode: 'down' })).toBe(630);
  });

  it('is a no-op when unset — never silently rounds', () => {
    expect(applyRounding(632.4)).toBe(632.4);
    expect(applyRounding(632.4, { nearest: 0, mode: 'nearest' })).toBe(632.4);
  });

  it('applies AFTER the gross-up, as the sheet does', () => {
    // 525 grossed up for Booking then rounded — not rounded first.
    const exact = 525 * grossUpFactor(BOOKING, DIRECT);
    expect(channelNightly(525, BOOKING, DIRECT, { rounding: { nearest: 5, mode: 'nearest' } }))
      .toBe(applyRounding(exact, { nearest: 5, mode: 'nearest' }));
  });
});

/**
 * DECOMPOSING THE SPREADSHEET.
 *
 * The sheet's constants (`bk_factor = 1.33`, `airbnb_correction = 10%`, `genius discount = 10%`,
 * VRBO = airbnb / 4.5) are the accumulated result of five years of hand-maintenance. None of them
 * says how much is commission, how much is a discount being priced for, and how much is margin.
 * These tests recover that split — which is the single most useful thing this module does.
 */
describe('what the owner’s sheet actually encodes', () => {
  /**
   * THE ANCHOR IS THE DIRECT PRICE, and getting this wrong is easy: the sheet's `airbnb_w_price = 475`
   * looks like a base rate but is the base the AIRBNB column is derived from. The direct price is
   * `property.pricePerNight` = 525. Measuring a channel against 475 describes a relationship that
   * does not exist and understates every gap.
   */
  const DIRECT_BASE = 525;          // property.pricePerNight
  const SHEET_AIRBNB_BASE = 475;    // airbnb_w_price — NOT the direct price
  const LISTED_AIRBNB = SHEET_AIRBNB_BASE * 1.10;
  const LISTED_BOOKING = SHEET_AIRBNB_BASE * 1.33;

  it('Booking sits slightly UNDER net parity once measured against direct', () => {
    expect(grossUpFactor(BOOKING, DIRECT)).toBeCloseTo(1.261, 3);
    const implied = impliedExtraAdjustmentPct(DIRECT_BASE, LISTED_BOOKING, BOOKING, DIRECT);
    expect(implied).toBeLessThan(0);
    expect(implied).toBeGreaterThan(-0.08);   // mildly under, ~-4.6%
  });

  it('Airbnb sits far under, because it is listed at essentially the direct price', () => {
    expect(grossUpFactor(AIRBNB, DIRECT)).toBeCloseTo(1.195, 3);
    // 475 × 1.10 = 522.5 against a direct price of 525 — the same money to the guest, minus 18.755%.
    expect(LISTED_AIRBNB / DIRECT_BASE).toBeCloseTo(0.995, 3);
    expect(impliedExtraAdjustmentPct(DIRECT_BASE, LISTED_AIRBNB, AIRBNB, DIRECT)).toBeLessThan(-0.15);
  });

  it('so a night sold on Airbnb pays less than the same night sold direct', () => {
    // The consequence, stated as arithmetic rather than as advice. What SHOULD move — the channel
    // price, the direct price, or nothing — is a demand judgement this file does not make.
    expect(netFromOta(LISTED_AIRBNB, AIRBNB)).toBeLessThan(netFromDirect(DIRECT_BASE, DIRECT));
  });

  it('VRBO carries the second-highest commission but the sheet grosses it up least', () => {
    // The sheet computes VRBO as airbnb_price / 4.5 (a stale FX constant), so VRBO inherits Airbnb's
    // shortfall AND adds currency drift. Its structural requirement is HIGHER than Airbnb's.
    expect(grossUpFactor(VRBO, DIRECT)).toBeGreaterThan(grossUpFactor(AIRBNB, DIRECT));
  });

  it('ranks the required gross-ups by commission, as it must', () => {
    const factors = [
      ['airbnb', grossUpFactor(AIRBNB, DIRECT)],
      ['vrbo', grossUpFactor(VRBO, DIRECT)],
      ['booking.com', grossUpFactor(BOOKING, DIRECT)],
    ] as const;
    expect([...factors].sort((a, b) => a[1] - b[1]).map((f) => f[0]))
      .toEqual(['airbnb', 'vrbo', 'booking.com']);
  });
});

describe('foreign-currency channels', () => {
  it('converts after gross-up and rounds in the channel currency', () => {
    // VRBO lists in USD. 1 USD = 4.54 RON (owner-stated 2026-08-06).
    const usd = channelNightly(525, VRBO, DIRECT, {
      fxRateToChannelCurrency: 4.54,
      rounding: { nearest: 5, mode: 'up' },
    });
    expect(usd % 5).toBe(0);
    // Sanity: 525 × ~1.214 ÷ 4.54 ≈ 140
    expect(usd).toBeGreaterThan(130);
    expect(usd).toBeLessThan(150);
  });
});

describe('impliedExtraAdjustmentPct', () => {
  it('returns zero when the listing sits exactly at net parity', () => {
    const listed = 525 * grossUpFactor(AIRBNB, DIRECT);
    expect(impliedExtraAdjustmentPct(525, listed, AIRBNB, DIRECT)).toBeCloseTo(0, 12);
  });

  it('round-trips against channelNightly', () => {
    const listed = channelNightly(525, BOOKING, DIRECT, { extraAdjustmentPct: 0.052 });
    expect(impliedExtraAdjustmentPct(525, listed, BOOKING, DIRECT)).toBeCloseTo(0.052, 12);
  });

  it('does not divide by zero on a free night', () => {
    expect(impliedExtraAdjustmentPct(0, 100, AIRBNB, DIRECT)).toBe(0);
  });
});
