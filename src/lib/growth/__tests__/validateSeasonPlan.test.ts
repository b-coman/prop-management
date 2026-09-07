/** @jest-environment node */

import { validateSeasonPlan, type SeasonPackForValidation } from '../validateSeasonPlan';
import type { SeasonPlan, SeasonSlot, SeasonPhase } from '../contracts';

const ASOF = '2026-09-07T00:00:00Z';

const PACK: SeasonPackForValidation = {
  season: { start: '2026-10-11', end: '2027-04-29' },
  candidates: [
    { id: 'craciun', checkIn: '2026-12-24', checkOut: '2026-12-27', nights: 3 },
    { id: 'dec1', checkIn: '2026-11-27', checkOut: '2026-12-01', nights: 4 },
  ],
  constraints: {
    annualBudgetMinor: 400_000,
    maxDailyBudgetMinor: 20_000,
    absoluteMaxPerCampaignMinor: 50_000,
    minLeadDays: 14,
    adSetDailyFloorMinor: 400,
  },
  ledger: { remainingMinor: 271_771, reserveMinor: 80_000, committedMinor: 48_229 },
  deliverableAudienceIds: ['aud-1'],
};

const phase = (over: Partial<SeasonPhase> = {}): SeasonPhase => ({
  kind: 'cold',
  startDate: '2026-11-19',
  endDate: '2026-12-14',
  days: 25,
  dailyBudgetMinor: 2_000,
  budgetMinor: 50_000,
  objective: 'traffic',
  purpose: 'p',
  ...over,
});

const slot = (over: Partial<SeasonSlot> = {}): SeasonSlot => ({
  candidateId: 'craciun',
  rank: 1,
  baselineRank: 1,
  tier: 1,
  checkIn: '2026-12-24',
  checkOut: '2026-12-27',
  nights: 3,
  kind: 'occasion',
  occasion: 'Craciunul',
  valueAtRiskRon: 5_000,
  priceRon: 2_400,
  advisoryBudgetMinor: 50_000,
  hardCapMinor: 50_000,
  phases: [phase()],
  funded: true,
  fundingNote: 'funded at minimum viable',
  emphasis: 'normal',
  angle: null,
  rationale: null,
  campaignIds: [],
  scoreComponents: [],
  ...over,
});

const plan = (
  over: Partial<Pick<SeasonPlan, 'slots' | 'excluded' | 'season' | 'envelope' | 'asOf'>> = {}
): Pick<SeasonPlan, 'slots' | 'excluded' | 'season' | 'envelope' | 'asOf'> => ({
  slots: [slot()],
  excluded: [{ candidateId: 'dec1', checkIn: '2026-11-27', nights: 4, reason: 'parity losing', by: 'allocator' }],
  season: { start: '2026-10-11', end: '2027-04-29', nights: 201, label: 'Winter 2026-27' },
  envelope: { adYear: '2026-27', annualMinor: 400_000, reserveMinor: 80_000, committedAtLandMinor: 48_229, remainingAtLandMinor: 271_771 },
  asOf: ASOF,
  ...over,
});

const run = (over = {}) => validateSeasonPlan(PACK, plan(over));

describe('validateSeasonPlan — happy path', () => {
  it('accepts a well-formed plan and reports stats', () => {
    const r = run();
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.stats).toMatchObject({ slots: 1, funded: 1, excluded: 1, totalAdvisoryMinor: 50_000 });
  });
});

describe('validateSeasonPlan — narrows-never-widens', () => {
  it('rejects a slot that is not a pack candidate', () => {
    const r = run({ slots: [slot({ candidateId: 'invented' })] });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('invented a window'))).toBe(true);
  });

  it('rejects a slot that quietly moved its own dates', () => {
    const r = run({ slots: [slot({ checkIn: '2026-12-23' })] });
    expect(r.errors.some((e) => e.includes('changed its dates'))).toBe(true);
  });

  it('rejects an exclusion with no reason', () => {
    const r = run({ excluded: [{ candidateId: 'dec1', checkIn: '2026-11-27', nights: 4, reason: '  ', by: 'planner' as const }] });
    expect(r.errors.some((e) => e.includes('carries no reason'))).toBe(true);
  });
});

describe('validateSeasonPlan — coverage: nothing may vanish', () => {
  it('rejects a plan that drops a candidate entirely', () => {
    const r = run({ excluded: [] });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('it vanished'))).toBe(true);
  });

  it('rejects a candidate counted twice', () => {
    const r = run({
      excluded: [
        { candidateId: 'dec1', checkIn: '2026-11-27', nights: 4, reason: 'x', by: 'allocator' as const },
        { candidateId: 'craciun', checkIn: '2026-12-24', nights: 3, reason: 'y', by: 'allocator' as const },
      ],
    });
    expect(r.errors.some((e) => e.includes('exactly once'))).toBe(true);
  });
});

describe('validateSeasonPlan — the money gate', () => {
  it('rejects a plan that spends more than the year has left', () => {
    const r = validateSeasonPlan(
      { ...PACK, ledger: { ...PACK.ledger, remainingMinor: 10_000 } },
      plan()
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('remaining in the ad year'))).toBe(true);
  });

  it('rejects a slot allocating above its own cap', () => {
    const r = run({ slots: [slot({ advisoryBudgetMinor: 60_000, hardCapMinor: 50_000, phases: [phase({ budgetMinor: 60_000, dailyBudgetMinor: 2_400 })] })] });
    expect(r.errors.some((e) => e.includes('above its own cap'))).toBe(true);
  });
});

describe('validateSeasonPlan — phase arithmetic and schedulability', () => {
  it('rejects phases that do not sum to the slot budget', () => {
    const r = run({ slots: [slot({ phases: [phase({ budgetMinor: 40_000, dailyBudgetMinor: 1_600 })] })] });
    expect(r.errors.some((e) => e.includes('phases sum to'))).toBe(true);
  });

  it('rejects a phase whose budget is not daily x days', () => {
    const r = run({ slots: [slot({ advisoryBudgetMinor: 49_000, phases: [phase({ budgetMinor: 49_000 })] })] });
    expect(r.errors.some((e) => e.includes('!='))).toBe(true);
  });

  it('rejects a phase running past check-in', () => {
    const r = run({ slots: [slot({ phases: [phase({ endDate: '2026-12-25' })] })] });
    expect(r.errors.some((e) => e.includes('on or after check-in'))).toBe(true);
  });

  it('rejects a phase starting in the past', () => {
    const r = run({ slots: [slot({ phases: [phase({ startDate: '2026-08-01' })] })] });
    expect(r.errors.some((e) => e.includes('in the past'))).toBe(true);
  });

  it('rejects a daily budget below Meta\'s per-ad-set floor', () => {
    const r = run({ slots: [slot({ advisoryBudgetMinor: 2_500, phases: [phase({ dailyBudgetMinor: 100, budgetMinor: 2_500 })] })] });
    expect(r.errors.some((e) => e.includes('per-ad-set floor'))).toBe(true);
  });
});

describe('validateSeasonPlan — retargeting needs a pool', () => {
  it('rejects a retarget burst before its own cold phase ends', () => {
    const r = run({
      slots: [slot({
        advisoryBudgetMinor: 55_000,
        hardCapMinor: 60_000,
        phases: [phase(), phase({ kind: 'retarget', startDate: '2026-12-01', endDate: '2026-12-21', days: 20, dailyBudgetMinor: 250, budgetMinor: 5_000 })],
      })],
    });
    expect(r.errors.some((e) => e.includes('before the cold phase ends'))).toBe(true);
  });

  it('rejects a lone retarget burst when no audience is deliverable', () => {
    const r = validateSeasonPlan(
      { ...PACK, deliverableAudienceIds: [] },
      plan({ slots: [slot({ phases: [phase({ kind: 'retarget' })] })] })
    );
    expect(r.errors.some((e) => e.includes('empty pool'))).toBe(true);
  });
});

describe('validateSeasonPlan — self-competition', () => {
  it('rejects two funded slots whose flights AND stays overlap', () => {
    const r = validateSeasonPlan(
      {
        ...PACK,
        candidates: [
          { id: 'a', checkIn: '2026-12-24', checkOut: '2026-12-27', nights: 3 },
          { id: 'b', checkIn: '2026-12-25', checkOut: '2026-12-28', nights: 3 },
        ],
      },
      plan({
        slots: [
          slot({ candidateId: 'a' }),
          slot({ candidateId: 'b', checkIn: '2026-12-25', checkOut: '2026-12-28', rank: 2 }),
        ],
        excluded: [],
      })
    );
    expect(r.errors.some((e) => e.includes('same auction'))).toBe(true);
  });

  it('only WARNS when flights overlap but the stays do not', () => {
    const r = validateSeasonPlan(
      {
        ...PACK,
        candidates: [
          { id: 'a', checkIn: '2026-12-24', checkOut: '2026-12-27', nights: 3 },
          { id: 'b', checkIn: '2027-01-15', checkOut: '2027-01-18', nights: 3 },
        ],
      },
      plan({
        slots: [
          slot({ candidateId: 'a' }),
          slot({ candidateId: 'b', checkIn: '2027-01-15', checkOut: '2027-01-18', rank: 2 }),
        ],
        excluded: [],
      })
    );
    expect(r.errors.filter((e) => e.includes('same auction'))).toEqual([]);
    expect(r.warnings.some((w) => w.includes('overlapping flight dates'))).toBe(true);
  });
});

describe('validateSeasonPlan — warnings that do not block', () => {
  it('surfaces an unfunded tier-1 window', () => {
    const r = run({
      slots: [slot({ funded: false, advisoryBudgetMinor: 0, phases: [], fundingNote: 'unfunded — envelope exhausted at rank 3' })],
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.includes('tier-1 window'))).toBe(true);
  });

  it('rejects an unfunded slot that still carries money', () => {
    const r = run({ slots: [slot({ funded: false, phases: [] })] });
    expect(r.errors.some((e) => e.includes('unfunded but carries'))).toBe(true);
  });
});
