/** @jest-environment node */

import {
  buildAnchoredRows, periodsWhereDirectIsNotCheapest,
  type AnchorConfig, type AnchoredPeriodInput,
} from '../anchorPricing';

/** The owner's spreadsheet constants, 2026. */
const SHEET: AnchorConfig = {
  anchorChannelId: 'airbnb',
  weekdayPrice: 475,          // airbnb_w_price
  weekendPrice: 625,          // airbnb_we_price
  directDiscountPct: 0.075,
  channels: [
    { channelId: 'airbnb', factor: 1.10, currency: 'RON' },                      // airbnb_correction
    { channelId: 'booking.com', factor: 1.33, currency: 'RON' },                 // bk_factor
    { channelId: 'vrbo', factor: 1.10, currency: 'USD', fxDivisor: 4.5, rounding: { nearest: 5, mode: 'up' } },
  ],
};

const p = (o: Partial<AnchoredPeriodInput> = {}): AnchoredPeriodInput => ({
  periodId: 'x', periodName: 'Test', startDate: '2026-07-01', endDate: '2026-07-10',
  nights: 10, tier: 'base', fixedNightPrice: null, ...o,
});

describe('it reproduces the owner’s own formulas', () => {
  it('base tier: airbnb = 475 × 1.10 → 525, rounded to 5', () => {
    const [row] = buildAnchoredRows([p()], SHEET);
    const abb = row.channels.find((c) => c.channelId === 'airbnb')!;
    expect(abb.weekday).toBe(525);          // 522.5 → nearest 5
    expect(abb.weekend).toBe(690);          // 625 × 1.10 = 687.5 → 690
  });

  it('base tier: booking = 475 × 1.33 → 630', () => {
    const [row] = buildAnchoredRows([p()], SHEET);
    const bk = row.channels.find((c) => c.channelId === 'booking.com')!;
    expect(bk.weekday).toBe(630);           // 631.75 → 630
    expect(bk.weekend).toBe(830);           // 831.25 → 830
  });

  it('high tier (×1.2) scales everything from the anchor', () => {
    const [row] = buildAnchoredRows([p({ tier: 'high' })], SHEET);
    expect(row.channels.find((c) => c.channelId === 'airbnb')!.weekday).toBe(625);      // 475×1.2×1.10=627 → 625
    expect(row.channels.find((c) => c.channelId === 'booking.com')!.weekday).toBe(760); // 475×1.2×1.33=758.1 → 760
  });

  it('VRBO is the Airbnb price converted, and rounds UP as the sheet does', () => {
    const [row] = buildAnchoredRows([p()], SHEET);
    const v = row.channels.find((c) => c.channelId === 'vrbo')!;
    expect(v.currency).toBe('USD');
    expect(v.weekday).toBe(120);            // 522.5 / 4.5 = 116.1 → up to 120
    expect(v.weekday % 5).toBe(0);
  });

  it('refuses to price a foreign channel with no conversion rate', () => {
    const noFx = { ...SHEET, channels: SHEET.channels.map((c) => (c.channelId === 'vrbo' ? { ...c, fxDivisor: undefined } : c)) };
    const [row] = buildAnchoredRows([p()], noFx);
    const v = row.channels.find((c) => c.channelId === 'vrbo')!;
    expect(v.problem).toMatch(/no conversion rate/);
    expect(v.weekday).toBe(0);
  });
});

describe('the website is set LAST, under the cheapest channel', () => {
  it('suggests 7.5% under the cheapest RON channel', () => {
    const [row] = buildAnchoredRows([p()], SHEET);
    // cheapest RON weekday is airbnb at 525 → 525 × 0.925 = 485.6 → 485
    expect(row.suggestedDirect.weekday).toBe(485);
  });

  it('follows Airbnb down when Airbnb is the cheapest', () => {
    const cheapAirbnb = { ...SHEET, channels: SHEET.channels.map((c) => (c.channelId === 'airbnb' ? { ...c, factor: 0.9 } : c)) };
    const [row] = buildAnchoredRows([p()], cheapAirbnb);
    expect(row.suggestedDirect.weekday).toBeLessThan(425);
  });

  it('ignores a USD channel when picking the cheapest — different units', () => {
    // VRBO's 120 USD must not be read as "cheaper than 525 RON".
    const [row] = buildAnchoredRows([p()], SHEET);
    expect(row.suggestedDirect.weekday).toBeGreaterThan(400);
  });

  it('never writes anything to currentDirect', () => {
    const [row] = buildAnchoredRows([p({ currentDirectWeekday: 525 })], SHEET);
    expect(row.currentDirect).toEqual({ weekday: 525, weekend: 525 });
    expect(row.suggestedDirect.weekday).toBe(485);   // a suggestion sitting beside it, not replacing it
  });
});

describe('hand-set peak prices', () => {
  it('replace the tier but still scale to each channel', () => {
    const [row] = buildAnchoredRows([p({ fixedNightPrice: 1175, periodName: 'Christmas' })], SHEET);
    expect(row.channels.find((c) => c.channelId === 'airbnb')!.weekday).toBe(1295);      // 1175 × 1.10 = 1292.5 → 1295
    expect(row.channels.find((c) => c.channelId === 'booking.com')!.weekday).toBe(1565); // 1175 × 1.33 = 1562.75 → 1565
  });
});

/**
 * The owner's own rule, checked against the owner's own prices: the website should be the cheapest
 * place to book. This reports where it is not — as a comparison, not a verdict about what to change.
 */
describe('where the website is not the cheapest', () => {
  const rows = buildAnchoredRows([
    p({ periodId: 'a', periodName: 'Summer', currentDirectWeekday: 630 }),   // dearer than airbnb 525
    p({ periodId: 'b', periodName: 'Fall', currentDirectWeekday: 480 }),     // cheaper than airbnb 525
  ], SHEET);

  it('flags only the periods where a channel undercuts the website', () => {
    const flagged = periodsWhereDirectIsNotCheapest(rows);
    expect(flagged.map((f) => f.periodId)).toEqual(['a']);
    expect(flagged[0].cheapestChannelId).toBe('airbnb');
    expect(flagged[0].differencePct).toBeCloseTo(0.2, 2);   // website is 20% dearer
  });

  it('says nothing when no current website price is known', () => {
    const noCurrent = buildAnchoredRows([p()], SHEET);
    expect(periodsWhereDirectIsNotCheapest(noCurrent)).toEqual([]);
  });
});
