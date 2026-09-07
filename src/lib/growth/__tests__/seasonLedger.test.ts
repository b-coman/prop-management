/** @jest-environment node */

import { computeSeasonLedger, type SeasonLedgerInput } from '../seasonLedger';
import { adYearFor } from '@/config/growth-ads';

const AD_YEAR = adYearFor('2026-09-07');
const ASOF = '2026-09-07T12:00:00Z';

const base = (over: Partial<SeasonLedgerInput> = {}): SeasonLedgerInput => ({
  adYear: AD_YEAR,
  annualMinor: 400_000,
  reservePct: 0.2,
  accountSpend: {
    spendMinor: 7_651, // 76.51 RON — the real Sep 1-7 figure
    byCampaign: [
      { campaignId: 'meta-cold', name: 'toamna cold', spendMinor: 5_000 },
      { campaignId: 'meta-boost', name: 'Post: Vine toamna', spendMinor: 2_651 },
    ],
    fetchedAt: '2026-09-07T11:00:00Z',
  },
  trackedMetaCampaignIds: ['meta-cold'],
  reservedInFlightMinor: 0,
  asOf: ASOF,
  ...over,
});

describe('computeSeasonLedger — the manual-boost split', () => {
  it('counts hand-made boosts against the envelope and names them', () => {
    const l = computeSeasonLedger(base());
    expect(l.spentMinor).toBe(7_651);
    expect(l.spentTrackedMinor).toBe(5_000);
    expect(l.spentUnplannedMinor).toBe(2_651);
    expect(l.warnings.some((w) => w.startsWith('ledger:unplanned-spend'))).toBe(true);
  });

  it('reserves 20% and reports what a season may actually allocate', () => {
    const l = computeSeasonLedger(base());
    expect(l.reserveMinor).toBe(80_000);
    expect(l.committedMinor).toBe(7_651);
    expect(l.remainingMinor).toBe(400_000 - 7_651 - 80_000);
  });
});

describe('computeSeasonLedger — forward commitment', () => {
  it('counts remaining days on live campaigns, not just billed spend', () => {
    // 12 days left at 30 RON/day = 360 RON still to be spent, invisible in actuals.
    const l = computeSeasonLedger(base({ reservedInFlightMinor: 36_000 }));
    expect(l.reservedInFlightMinor).toBe(36_000);
    expect(l.committedMinor).toBe(7_651 + 36_000);
  });
});

describe('computeSeasonLedger — honesty', () => {
  it('reports unavailable rather than zeros when Meta could not be read', () => {
    const l = computeSeasonLedger(base({ accountSpend: null }));
    expect(l.available).toBe(false);
    expect(l.warnings.some((w) => w.startsWith('ledger:unavailable'))).toBe(true);
  });

  it('flags a stale cache past the age threshold', () => {
    const l = computeSeasonLedger(
      base({ accountSpend: { spendMinor: 100, byCampaign: [], fetchedAt: '2026-09-05T00:00:00Z' } })
    );
    expect(l.freshness.stale).toBe(true);
    expect(l.warnings.some((w) => w.startsWith('ledger:stale'))).toBe(true);
  });

  it('does NOT clamp a negative remaining — overspend is a true state', () => {
    const l = computeSeasonLedger(base({ reservedInFlightMinor: 400_000 }));
    expect(l.remainingMinor).toBeLessThan(0);
    expect(l.warnings.some((w) => w.startsWith('ledger:over-envelope'))).toBe(true);
  });

  it('flags a plan that proposes more than the year has left', () => {
    const l = computeSeasonLedger(base({ plannedMinor: 400_000 }));
    expect(l.uncommittedAfterPlanMinor).toBeLessThan(0);
    expect(l.warnings.some((w) => w.startsWith('ledger:plan-overspends'))).toBe(true);
  });

  it('clamps and warns when the breakdown exceeds the account total (a unit error)', () => {
    const l = computeSeasonLedger(
      base({
        accountSpend: {
          spendMinor: 1_000,
          byCampaign: [{ campaignId: 'meta-cold', name: 'x', spendMinor: 5_000 }],
          fetchedAt: '2026-09-07T11:00:00Z',
        },
      })
    );
    expect(l.spentUnplannedMinor).toBe(0);
    expect(l.spentTrackedMinor).toBeLessThanOrEqual(l.spentMinor);
  });

  it('carries off-account spend the ad account cannot see', () => {
    const l = computeSeasonLedger(base({ spentOffAccountMinor: 5_000 }));
    expect(l.committedMinor).toBe(7_651 + 5_000);
    expect(l.coverage.note).toMatch(/personal card|different ad account/i);
  });
});
