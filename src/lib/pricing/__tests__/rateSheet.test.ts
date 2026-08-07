/** @jest-environment node */

import { buildRateSheet, diffAgainstApplied, verifyPush, pushId, type ChannelPush, type RateSheetChannelInput } from '../rateSheet';
import { DEFAULT_TIER_MULTIPLIERS, type PricingPeriod } from '../periods';
import type { DirectEconomics } from '@/lib/growth/parityMath';

const P = 'prahova-mountain-chalet';
const AT = '2026-08-07T00:00:00.000Z';
const DIRECT: DirectEconomics = { paymentCostPct: 0.029 };

const CHANNELS: RateSheetChannelInput[] = [
  { channelId: 'airbnb', economics: { channel: 'airbnb', commissionPct: 0.18755 }, currency: 'RON', rounding: { nearest: 5, mode: 'nearest' }, cleaningFee: 200 },
  { channelId: 'booking.com', economics: { channel: 'booking.com', commissionPct: 0.23 }, currency: 'RON', rounding: { nearest: 5, mode: 'nearest' }, cleaningFee: 200, extraAdjustmentPct: 0.052 },
];

const period = (o: Partial<PricingPeriod> & { slug: string; startDate: string; endDate: string }): PricingPeriod => ({
  id: `${P}_2026_${o.slug}`, propertyId: P, year: 2026, name: o.slug,
  tier: 'base', priority: 0, fixedNightPrice: null, minStay: 2, status: 'active', ...o,
});

const build = (periods: PricingPeriod[], channels = CHANNELS, extra: Partial<Parameters<typeof buildRateSheet>[0]> = {}) =>
  buildRateSheet({
    propertyId: P, version: 1, computedAt: AT, periods,
    tierMultipliers: DEFAULT_TIER_MULTIPLIERS, basePrice: 525, direct: DIRECT, channels,
    defaultMinimumStay: 1, ...extra,
  });

describe('the sheet is periods × channels', () => {
  const sheet = build([
    period({ slug: 'summer', startDate: '2026-06-20', endDate: '2026-08-31', tier: 'high' }),
    period({ slug: 'fall', startDate: '2026-09-09', endDate: '2026-10-23', tier: 'low' }),
  ]);

  it('emits a direct row plus one row per channel, per period', () => {
    expect(sheet.rows).toHaveLength(2 * 3);
    expect(new Set(sheet.rows.map((r) => r.channelId))).toEqual(new Set(['direct', 'airbnb', 'booking.com']));
  });

  it('anchors every channel to the compiled direct price, not a re-derivation', () => {
    // 525 × 1.2 (high) = 630. If the sheet recomputed the tier itself it could drift from the engine.
    const summer = sheet.rows.filter((r) => r.periodName === 'summer');
    summer.forEach((r) => expect(r.directNightly).toBe(630));
    expect(summer.find((r) => r.channelId === 'direct')!.nightly).toBe(630);
  });

  it('grosses each channel above direct, and Booking above Airbnb', () => {
    const s = sheet.rows.filter((r) => r.periodName === 'summer');
    const direct = s.find((r) => r.channelId === 'direct')!.nightly;
    const abb = s.find((r) => r.channelId === 'airbnb')!.nightly;
    const bk = s.find((r) => r.channelId === 'booking.com')!.nightly;
    expect(abb).toBeGreaterThan(direct);
    expect(bk).toBeGreaterThan(abb);
  });

  it('rounds channel prices to the nearest 5, as the sheet does', () => {
    sheet.rows.filter((r) => r.channelId !== 'direct').forEach((r) => expect(r.nightly % 5).toBe(0));
  });

  it('carries the period window and night count', () => {
    const fall = sheet.rows.find((r) => r.periodName === 'fall')!;
    expect([fall.startDate, fall.endDate, fall.nights]).toEqual(['2026-09-09', '2026-10-23', 45]);
  });
});

describe('hand-set peak prices stay whole', () => {
  const sheet = build([
    period({ slug: 'iarna', startDate: '2026-12-20', endDate: '2026-12-31', tier: 'min' }),
    period({ slug: 'craciun', startDate: '2026-12-24', endDate: '2026-12-27', fixedNightPrice: 1175, minStay: 3, priority: 100 }),
  ]);

  it('shows the four-night decision as ONE row per channel, not four', () => {
    const xmas = sheet.rows.filter((r) => r.periodName === 'craciun');
    expect(xmas).toHaveLength(3);
    expect([xmas[0].startDate, xmas[0].endDate, xmas[0].nights]).toEqual(['2026-12-24', '2026-12-27', 4]);
  });

  it('grosses the fixed price up rather than passing it through', () => {
    const xmas = sheet.rows.filter((r) => r.periodName === 'craciun');
    expect(xmas.find((r) => r.channelId === 'direct')!.nightly).toBe(1175);
    expect(xmas.find((r) => r.channelId === 'airbnb')!.nightly).toBeGreaterThan(1175);
  });

  it('splits the surrounding tier period around it', () => {
    const winter = sheet.rows.filter((r) => r.periodName === 'iarna' && r.channelId === 'direct');
    expect(winter.map((r) => [r.startDate, r.endDate])).toEqual([
      ['2026-12-20', '2026-12-23'],
      ['2026-12-28', '2026-12-31'],
    ]);
  });
});

describe('a channel in another currency', () => {
  const VRBO: RateSheetChannelInput = {
    channelId: 'vrbo', economics: { channel: 'vrbo', commissionPct: 0.20 },
    currency: 'USD', rounding: { nearest: 5, mode: 'up' },
  };

  it('refuses to invent a price when no FX rate is recorded', () => {
    const sheet = build([period({ slug: 's', startDate: '2026-07-01', endDate: '2026-07-05', tier: 'high' })], [VRBO]);
    const row = sheet.rows.find((r) => r.channelId === 'vrbo')!;
    expect(row.problem).toMatch(/no FX rate/);
    expect(row.nightly).toBe(0);
  });

  it('converts when the rate is present', () => {
    const sheet = build(
      [period({ slug: 's', startDate: '2026-07-01', endDate: '2026-07-05', tier: 'high' })],
      [{ ...VRBO, fxRateToChannelCurrency: 4.54 }],
    );
    const row = sheet.rows.find((r) => r.channelId === 'vrbo')!;
    expect(row.problem).toBeUndefined();
    expect(row.currency).toBe('USD');
    expect(row.nightly).toBeGreaterThan(100);
    expect(row.nightly).toBeLessThan(200);
  });
});

describe('push tracking — the system cannot type into three dashboards, so it tracks', () => {
  const sheet = build([period({ slug: 'summer', startDate: '2026-06-20', endDate: '2026-08-31', tier: 'high' })]);

  it('never asks anyone to type the direct price', () => {
    const pushes = diffAgainstApplied(sheet, []);
    expect(pushes.some((p) => p.channelId === 'direct')).toBe(false);
  });

  it('starts everything pending', () => {
    const pushes = diffAgainstApplied(sheet, []);
    expect(pushes).toHaveLength(2);
    pushes.forEach((p) => expect(p.status).toBe('pending'));
  });

  it('does NOT reset an unchanged cell that was already verified', () => {
    const first = diffAgainstApplied(sheet, []);
    const verified: ChannelPush[] = first.map((p) => ({
      ...p, status: 'verified', appliedBy: 'owner', appliedAt: AT, verificationObservationId: 'obs1',
    }));
    const second = diffAgainstApplied(sheet, verified);
    second.forEach((p) => {
      expect(p.status).toBe('verified');
      expect(p.verificationObservationId).toBe('obs1');
    });
  });

  it('reopens a cell whose target actually moved', () => {
    const applied = diffAgainstApplied(sheet, []).map((p) => ({ ...p, status: 'verified' as const, verificationObservationId: 'obs1' }));
    const dearer = build([period({ slug: 'summer', startDate: '2026-06-20', endDate: '2026-08-31', tier: 'max' })]);
    const next = diffAgainstApplied(dearer, applied);
    next.forEach((p) => {
      expect(p.status).toBe('pending');
      expect(p.verificationObservationId).toBeUndefined();
    });
  });

  it('builds a stable id so the same cell is trackable across versions', () => {
    expect(pushId(P, 'airbnb', `${P}_2026_summer`)).toBe(`${P}__airbnb__${P}_2026_summer`);
    const a = diffAgainstApplied(sheet, [])[0];
    const b = diffAgainstApplied({ ...sheet, version: 9 }, [])[0];
    expect(b.id).toBe(a.id);
    expect(b.rateSheetVersion).toBe(9);
  });
});

describe('verification against a real observation', () => {
  const push: ChannelPush = {
    id: 'x', propertyId: P, channelId: 'airbnb', periodId: 'p', rateSheetVersion: 1,
    target: { nightly: 700, currency: 'RON', minStay: 2, cleaningFee: 200 }, status: 'applied',
  };

  it('verifies within tolerance — 2-3% is noise, not a discrepancy', () => {
    expect(verifyPush(push, { nightlyEquivalent: 714, observationId: 'o', capturedAt: AT }).status).toBe('verified');
  });

  it('flags drift when the channel is cheaper than intended — a promotion or a typo', () => {
    const r = verifyPush(push, { nightlyEquivalent: 610, observationId: 'o', capturedAt: AT });
    expect(r.status).toBe('drifted');
    expect(r.note).toMatch(/-12\.9%/);
  });

  it('flags drift upward too', () => {
    expect(verifyPush(push, { nightlyEquivalent: 850, observationId: 'o', capturedAt: AT }).status).toBe('drifted');
  });

  it('does not divide by a zero target', () => {
    const zero = { ...push, target: { ...push.target, nightly: 0 } };
    expect(verifyPush(zero, { nightlyEquivalent: 100, observationId: 'o', capturedAt: AT }).status).toBe('applied');
  });
});
