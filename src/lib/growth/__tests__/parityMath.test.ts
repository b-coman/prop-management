/** @jest-environment node */

import {
  evaluateParity, indifferencePrice, headroomPct, netFromDirect, netFromOta,
  bestOffer, channelSpreadPct, type ChannelEconomics, type DirectEconomics,
} from '../parityMath';

// The owner's stated rates (2026-08): ~18.5% Airbnb, ~23% Booking.com, card fees ~2.9%.
const AIRBNB: ChannelEconomics = { channel: 'airbnb', commissionPct: 0.185 };
const BOOKING: ChannelEconomics = { channel: 'booking.com', commissionPct: 0.23 };
const DIRECT: DirectEconomics = { paymentCostPct: 0.029 };

describe('the structural advantage of booking direct', () => {
  it('is ~16% on Airbnb and ~21% on Booking.com, independent of price', () => {
    expect(headroomPct(AIRBNB, DIRECT)).toBeCloseTo(0.1610, 3);
    expect(headroomPct(BOOKING, DIRECT)).toBeCloseTo(0.2070, 3);
  });

  it('means a 10% target uses only about two-thirds of the available room', () => {
    expect(headroomPct(AIRBNB, DIRECT)).toBeGreaterThan(0.10);
  });
});

describe('indifference price', () => {
  it('is where the owner earns the same either way (real Aug 28-30 numbers)', () => {
    // Airbnb showed 1,476 for those nights.
    const p = indifferencePrice(1476, AIRBNB, DIRECT);
    expect(Math.round(p)).toBe(1239);
    expect(netFromDirect(p, DIRECT)).toBeCloseTo(netFromOta(1476, AIRBNB), 6);
  });

  it('is lower on the higher-commission channel — more room against Booking.com', () => {
    expect(indifferencePrice(1000, BOOKING, DIRECT)).toBeLessThan(indifferencePrice(1000, AIRBNB, DIRECT));
  });
});

describe('evaluateParity — the states that matter', () => {
  const base = { channel: AIRBNB, direct: DIRECT, targetDiscountPct: 0.05 };

  it('flags LOSING when direct costs the guest more (the real Aug 28-30 case)', () => {
    const v = evaluateParity({ ...base, directTotal: 1838, otaTotal: 1476, otaListTotal: 1940 });
    expect(v.status).toBe('losing');
    expect(v.guestGapPct).toBeCloseTo(0.245, 2);
    expect(v.netAdvantage).toBeGreaterThan(0); // NB: it would pay more IF anyone booked it — nobody will
    expect(v.promoDriven).toBe(true);
  });

  it('confirms the owner\'s point: undercutting a promo still earns more net', () => {
    // Price direct 5% under Airbnb's promo price.
    const v = evaluateParity({ ...base, directTotal: 1476 * 0.95, otaTotal: 1476, otaListTotal: 1940 });
    expect(v.status).toBe('healthy');
    expect(v.netAdvantage).toBeGreaterThan(0);
    // The guest saves ~74 lei and the owner still keeps ~158 more than the Airbnb booking.
    expect(Math.round(v.netAdvantage)).toBeGreaterThan(140);
  });

  it('flags OVERSHOOT below indifference — cheaper than it needs to be', () => {
    const v = evaluateParity({ ...base, directTotal: 1100, otaTotal: 1476 });
    expect(v.status).toBe('overshoot');
    expect(v.netAdvantage).toBeLessThan(0);
    expect(v.notes.join(' ')).toMatch(/indifference/i);
  });

  it('flags THIN when cheaper but not by the target', () => {
    const v = evaluateParity({ ...base, directTotal: 1450, otaTotal: 1476, targetDiscountPct: 0.10 });
    expect(v.status).toBe('thin');
  });

  it('says so when a target would price below indifference (deep promo)', () => {
    // A 25% target against an already-promoted price undercuts the owner's own economics.
    const v = evaluateParity({ ...base, directTotal: 1200, otaTotal: 1476, targetDiscountPct: 0.25 });
    expect(v.recommendedBand).toBeNull();
    expect(v.notes.join(' ')).toMatch(/too low to undercut profitably/i);
  });

  it('reports parity against the list price separately from the promo price', () => {
    const v = evaluateParity({ ...base, directTotal: 1838, otaTotal: 1476, otaListTotal: 1940 });
    expect(v.vsListGapPct).toBeCloseTo(-0.0526, 3); // 5.3% under list, while 24.5% over the promo
  });

  it('recommends a band that is both attractive and profitable', () => {
    const v = evaluateParity({ ...base, directTotal: 1400, otaTotal: 1476, targetDiscountPct: 0.05 });
    expect(v.recommendedBand).not.toBeNull();
    expect(Math.round(v.recommendedBand!.min)).toBe(1239);
    expect(Math.round(v.recommendedBand!.max)).toBe(1402);
    expect(v.status).toBe('healthy');
  });
});

describe('across channels', () => {
  it('takes the CHEAPEST channel as the one to beat, never the average', () => {
    const offers = [
      { channel: 'airbnb', otaTotal: 1476 },
      { channel: 'booking.com', otaTotal: 1907 },
    ];
    expect(bestOffer(offers)!.channel).toBe('airbnb');
  });

  it('measures the spread between channels — the "OTAs disagree" problem', () => {
    // Real Aug 28-30: Airbnb 1,476 vs Booking 1,907 on the same nights.
    expect(channelSpreadPct([{ otaTotal: 1476 }, { otaTotal: 1907 }])).toBeCloseTo(0.292, 2);
  });

  it('has no spread to report for a single channel', () => {
    expect(channelSpreadPct([{ otaTotal: 1476 }])).toBeNull();
  });
});
