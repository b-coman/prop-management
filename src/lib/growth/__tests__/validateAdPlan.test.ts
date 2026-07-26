/** @jest-environment node */

import { validateAdPlan, type AdPlannerPackForValidation } from '../validateAdPlan';
import type { AdBrief } from '../contracts';

const NOW = Date.parse('2026-07-26T00:00:00Z');

const PACK: AdPlannerPackForValidation = {
  constraints: { maxDailyBudgetMinor: 20000, maxTotalSpendMinor: 50000 }, // 200 RON/day, 500 RON envelope
  targeting: { candidateCityKeys: ['1910415', '1925836', '1913456'] },    // Bucuresti, Ploiesti, Constanta
};

/** A valid brief: 30 RON/day for 10 days = 300 RON ≤ 500 RON envelope, one candidate city. */
const OK: Pick<AdBrief, 'act' | 'objective' | 'targeting' | 'dailyBudgetMinor' | 'endTime'> = {
  act: true,
  objective: 'sales',
  targeting: { cities: [{ key: '1910415', name: 'Bucuresti', radius: 25 }] },
  dailyBudgetMinor: 3000,
  endTime: '2026-08-05T00:00:00Z', // NOW + 10 days
};

const run = (brief: Partial<typeof OK>) => validateAdPlan(PACK, { ...OK, ...brief } as typeof OK, NOW);

describe('validateAdPlan — happy path', () => {
  it('accepts a well-formed, in-budget, in-geo plan and reports stats', () => {
    const res = run({});
    expect(res.ok).toBe(true);
    expect(res.errors).toEqual([]);
    expect(res.stats).toEqual({ dailyBudgetMinor: 3000, cities: 1, daysToEnd: 10, projectedTotalMinor: 30000 });
  });
});

describe('validateAdPlan — act:false (decline)', () => {
  it('is valid when it targets nobody', () => {
    const res = validateAdPlan(PACK, { ...OK, act: false, targeting: { cities: [] } }, NOW);
    expect(res.ok).toBe(true);
  });
  it('rejects a declined plan that still carries targeting', () => {
    const res = validateAdPlan(PACK, { ...OK, act: false }, NOW);
    expect(res.ok).toBe(false);
    expect(res.errors[0]).toMatch(/act:false but 1 city/);
  });
});

describe('validateAdPlan — budget ceiling', () => {
  it('rejects a daily budget above the ceiling', () => {
    const res = run({ dailyBudgetMinor: 25000 });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('exceeds the ceiling'))).toBe(true);
  });
  it.each([0, -100, Number.NaN])('rejects a non-positive daily budget (%p)', (v) => {
    const res = run({ dailyBudgetMinor: v as number });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('invalid daily budget'))).toBe(true);
  });
});

describe('validateAdPlan — end time', () => {
  it('rejects an end time in the past', () => {
    const res = run({ endTime: '2026-07-20T00:00:00Z' }); // before NOW
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('not in the future'))).toBe(true);
  });
  it('rejects an unparseable end time', () => {
    const res = run({ endTime: 'next tuesday' });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('invalid end time'))).toBe(true);
  });
});

describe('validateAdPlan — geo (narrows-never-widens)', () => {
  it('rejects a plan with no cities', () => {
    const res = run({ targeting: { cities: [] } });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('no city targeting'))).toBe(true);
  });
  it('rejects a city key not in the pack candidates', () => {
    const res = run({ targeting: { cities: [{ key: '9999999', name: 'Nowhere', radius: 25 }] } });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('not in the pack') && e.includes('9999999'))).toBe(true);
  });
  it.each([0, 100])('rejects an out-of-range radius (%p km)', (r) => {
    const res = run({ targeting: { cities: [{ key: '1910415', name: 'Bucuresti', radius: r }] } });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('radius'))).toBe(true);
  });
});

describe('validateAdPlan — objective', () => {
  it('rejects an unsupported objective', () => {
    const res = validateAdPlan(PACK, { ...OK, objective: 'awareness' as never }, NOW);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('unsupported objective'))).toBe(true);
  });
});

describe('validateAdPlan — spend envelope', () => {
  it('rejects a plan whose projected total exceeds the envelope', () => {
    // 6000/day × 10 days = 60000 > 50000 envelope
    const res = run({ dailyBudgetMinor: 6000 });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('exceeds the plan envelope'))).toBe(true);
    expect(res.stats.projectedTotalMinor).toBe(60000);
  });
  it('warns (does not block) when the pack sets no envelope', () => {
    const noEnvelope: AdPlannerPackForValidation = { ...PACK, constraints: { ...PACK.constraints, maxTotalSpendMinor: null } };
    const res = validateAdPlan(noEnvelope, OK, NOW);
    expect(res.ok).toBe(true);
    expect(res.warnings.some((w) => w.includes('no maxTotalSpendMinor'))).toBe(true);
  });
});
