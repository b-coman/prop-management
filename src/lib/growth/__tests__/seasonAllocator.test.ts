/** @jest-environment node */

import {
  rankSeasonWindows,
  applyPlannerEdits,
  allocateSeasonBudget,
  minViableDailyMinor,
  tierFor,
  AD_SET_DAILY_FLOOR_MINOR,
  DEFAULT_PHASE_POLICY,
  type AllocatorPolicy,
} from '../seasonAllocator';
import type { SeasonCandidate, SeasonPlanEdits } from '../contracts';

const ASOF = '2026-09-07';

const POLICY: AllocatorPolicy = {
  annualMinor: 400_000,
  reservePct: 0.2,
  minLeadDays: 14,
  minViableDailyMinor: 2_000,
  maxDailyBudgetMinor: 20_000,
  absoluteMaxPerCampaignMinor: 50_000,
  maxSpendRatioOfValue: 0.15,
  ...DEFAULT_PHASE_POLICY,
  accountCpc: null,
  retargetPossible: true,
};

const cand = (over: Partial<SeasonCandidate> = {}): SeasonCandidate => ({
  id: over.id ?? `${over.checkIn ?? '2026-12-24'}_${over.nights ?? 3}`,
  checkIn: '2026-12-24',
  checkOut: '2026-12-27',
  nights: 3,
  kind: 'occasion',
  occasion: { name: 'Craciunul', type: 'major', startDate: '2026-12-25', endDate: '2026-12-26' },
  why: null,
  bridged: [],
  departureEvening: true,
  minStay: 2,
  priceRon: 2400,
  valueAtRiskRon: 2400,
  openNights: 3,
  daysOut: 108,
  periodId: 'winter',
  periodName: 'Winter',
  parityVerdict: 'healthy',
  includesWeekendNight: true,
  covers: { from: over.checkIn ?? '2026-12-24', to: over.checkOut ? addDays(over.checkOut, -1) : '2026-12-26' },
  creativeReady: true,
  creativeGaps: [],
  ...over,
});

/** Local ymd shift, so a fixture can express what it covers without importing the lib. */
function addDays(ymd: string, n: number): string {
  return new Date(new Date(`${ymd}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

const LEDGER = { remainingMinor: 271_771, reserveMinor: 80_000, committedMinor: 48_229 };

describe('rankSeasonWindows — the gates', () => {
  it('GATES a losing-parity window: fix the price, do not buy reach', () => {
    const r = rankSeasonWindows([cand({ parityVerdict: 'losing' })], POLICY, ASOF);
    expect(r[0].gated).toBe(true);
    expect(r[0].gatedReason).toMatch(/price-not-reach/);
  });

  it('gates an already-sold window', () => {
    const r = rankSeasonWindows([cand({ openNights: 0 })], POLICY, ASOF);
    expect(r[0].gatedReason).toMatch(/already-sold/);
  });

  it('gates a window with no calendar price rather than valuing it at zero', () => {
    const r = rankSeasonWindows([cand({ priceRon: null })], POLICY, ASOF);
    expect(r[0].gatedReason).toMatch(/cannot-quote/);
  });

  it('gates a window too close to leave runway for a cold phase', () => {
    const r = rankSeasonWindows([cand({ checkIn: '2026-09-10', daysOut: 3 })], POLICY, ASOF);
    expect(r[0].gated).toBe(true);
    expect(r[0].gatedReason).toMatch(/too-close/);
  });

  it('never silently drops a gated window — it keeps its reason', () => {
    const r = rankSeasonWindows([cand({ parityVerdict: 'losing' })], POLICY, ASOF);
    expect(r).toHaveLength(1);
    expect(r[0].gatedReason).toBeTruthy();
  });
});

describe('rankSeasonWindows — the ladder', () => {
  it('orders by tier first, then value at risk, then earliest check-in', () => {
    const rows = rankSeasonWindows(
      [
        cand({ id: 'wknd', checkIn: '2026-11-06', kind: 'weekend', valueAtRiskRon: 9999, daysOut: 60 }),
        cand({ id: 'occ-small', checkIn: '2026-11-27', kind: 'occasion', valueAtRiskRon: 1000, daysOut: 81 }),
        cand({ id: 'occ-big', checkIn: '2026-12-24', kind: 'occasion', valueAtRiskRon: 5000, daysOut: 108 }),
      ],
      POLICY,
      ASOF
    );
    const order = rows.filter((r) => !r.gated).sort((a, b) => a.rank - b.rank).map((r) => r.candidateId);
    // Occasions outrank a weekend even when the weekend is worth more money.
    expect(order).toEqual(['occ-big', 'occ-small', 'wknd']);
  });

  it('prints named score components so a rank is auditable', () => {
    const r = rankSeasonWindows([cand()], POLICY, ASOF);
    const names = r[0].scoreComponents.map((s) => s.name);
    expect(names).toEqual(
      expect.arrayContaining(['tier', 'valueAtRiskRon', 'daysOut', 'coldDays', 'creativeReady'])
    );
  });
});

describe('minViableDailyMinor', () => {
  it('derives from the account CPC when known', () => {
    expect(minViableDailyMinor({ ...POLICY, accountCpc: 0.8 })).toBe(3_200); // 40 clicks x 0.8 RON
  });
  it('falls back to the configured floor rather than inventing a CPC', () => {
    expect(minViableDailyMinor({ ...POLICY, accountCpc: null })).toBe(2_000);
  });
  it('never goes below the configured floor', () => {
    expect(minViableDailyMinor({ ...POLICY, accountCpc: 0.05 })).toBe(2_000);
  });
});

describe('applyPlannerEdits — bounded judgement', () => {
  const candidates = [
    cand({ id: 'craciun', checkIn: '2026-12-24', valueAtRiskRon: 5000, daysOut: 108 }),
    cand({ id: 'dec1', checkIn: '2026-11-27', valueAtRiskRon: 3000, daysOut: 81 }),
  ];
  const edits = (over: Partial<SeasonPlanEdits> = {}): SeasonPlanEdits => ({
    exclude: [], emphasis: [], angle: [],
    narrative: { headline: '', approach: '', risks: [] },
    ...over,
  });

  it('lets the skill exclude a window, attributed to the planner', () => {
    const base = rankSeasonWindows(candidates, POLICY, ASOF);
    const out = applyPlannerEdits(base, candidates, edits({
      exclude: [{ candidateId: 'craciun', reason: 'Revelion sells itself on Booking' }],
    }));
    const row = out.find((r) => r.candidateId === 'craciun')!;
    expect(row.gated).toBe(true);
    expect(row.gatedBy).toBe('planner');
    expect(row.gatedReason).toMatch(/sells itself/);
  });

  it('shifts emphasis by exactly ONE tier and records the citation', () => {
    const base = rankSeasonWindows(candidates, POLICY, ASOF);
    const out = applyPlannerEdits(base, candidates, edits({
      emphasis: [{ candidateId: 'dec1', emphasis: 'lead', citing: 'inventory.freeRuns' }],
    }));
    const row = out.find((r) => r.candidateId === 'dec1')!;
    expect(row.tier).toBe(1);
    expect(row.scoreComponents.some((s) => s.name === 'plannerEmphasis')).toBe(true);
  });

  it('keeps baselineRank so the planner\'s influence stays visible', () => {
    // Two weekends: A outranks B on value. A 'lead' on B lifts it a tier, so it overtakes.
    const weekends = [
      cand({ id: 'wA', checkIn: '2026-11-06', kind: 'weekend', valueAtRiskRon: 5000, daysOut: 60 }),
      cand({ id: 'wB', checkIn: '2026-11-13', kind: 'weekend', valueAtRiskRon: 3000, daysOut: 67 }),
    ];
    const base = rankSeasonWindows(weekends, POLICY, ASOF);
    expect(base.find((r) => r.candidateId === 'wB')!.baselineRank).toBe(2);
    const out = applyPlannerEdits(base, weekends, edits({
      emphasis: [{ candidateId: 'wB', emphasis: 'lead', citing: 'inventory.freeRuns' }],
    }));
    const row = out.find((r) => r.candidateId === 'wB')!;
    expect(row.baselineRank).toBe(2);
    expect(row.rank).toBe(1);
    expect(row.tier).toBe(2);
  });

  it('a lead emphasis on an already-top-tier window changes nothing', () => {
    const base = rankSeasonWindows(candidates, POLICY, ASOF);
    const out = applyPlannerEdits(base, candidates, edits({
      emphasis: [{ candidateId: 'dec1', emphasis: 'lead', citing: 'x' }],
    }));
    const row = out.find((r) => r.candidateId === 'dec1')!;
    expect(row.tier).toBe(1);
    expect(row.rank).toBe(row.baselineRank);
  });

  it('cannot lift a window above tier 1 or push it below tier 4', () => {
    const base = rankSeasonWindows(candidates, POLICY, ASOF);
    const lifted = applyPlannerEdits(base, candidates, edits({
      emphasis: [{ candidateId: 'craciun', emphasis: 'lead', citing: 'x' }],
    }));
    expect(lifted.find((r) => r.candidateId === 'craciun')!.tier).toBe(1);
  });
});

describe('allocateSeasonBudget — breadth before depth', () => {
  const many = Array.from({ length: 12 }, (_, i) =>
    cand({
      id: `w${i}`,
      checkIn: `2026-1${i < 5 ? '1' : '2'}-${String(2 + i * 2).padStart(2, '0')}`,
      kind: 'weekend',
      valueAtRiskRon: 1200,
      daysOut: 70 + i * 3,
    })
  );

  it('funds windows in rank order and marks the rest explicitly unfunded', () => {
    const ranked = rankSeasonWindows(many, POLICY, ASOF);
    const out = allocateSeasonBudget(many, ranked, { ...LEDGER, remainingMinor: 100_000 }, POLICY, ASOF);
    expect(out.slots.some((s) => s.funded)).toBe(true);
    const unfunded = out.slots.filter((s) => !s.funded);
    expect(unfunded.every((s) => s.fundingNote.includes('unfunded'))).toBe(true);
  });

  it('never allocates more than the envelope has left', () => {
    const ranked = rankSeasonWindows(many, POLICY, ASOF);
    const out = allocateSeasonBudget(many, ranked, { ...LEDGER, remainingMinor: 60_000 }, POLICY, ASOF);
    const total = out.slots.reduce((s, x) => s + s * 0 + x.advisoryBudgetMinor, 0);
    expect(total).toBeLessThanOrEqual(60_000);
  });

  it('bounds a single window by the share of value at stake', () => {
    const one = [cand({ valueAtRiskRon: 1000 })]; // cap = 1000 x 100 x 0.15 = 15_000 bani
    const ranked = rankSeasonWindows(one, POLICY, ASOF);
    const out = allocateSeasonBudget(one, ranked, { ...LEDGER, remainingMinor: 300_000 }, POLICY, ASOF);
    expect(out.slots[0].advisoryBudgetMinor).toBeLessThanOrEqual(15_000);
  });

  it('TRIMS the flight to fit the value rather than overspending or refusing', () => {
    const one = [cand({ valueAtRiskRon: 1000 })];
    const ranked = rankSeasonWindows(one, POLICY, ASOF);
    const out = allocateSeasonBudget(one, ranked, { ...LEDGER, remainingMinor: 300_000 }, POLICY, ASOF);
    const slot = out.slots[0];
    expect(slot.funded).toBe(true);
    const cold = slot.phases.find((p) => p.kind === 'cold')!;
    expect(cold.days).toBeLessThan(25);          // the full runway would have been 25d
    expect(cold.days).toBeGreaterThanOrEqual(7); // but not below the minimum that can build a pool
    expect(slot.fundingNote).toMatch(/trimmed/);
  });

  it('refuses a window whose value cannot buy even a minimum-length flight, and says why', () => {
    const one = [cand({ valueAtRiskRon: 100 })]; // cap = 1_500 bani -> under one day
    const ranked = rankSeasonWindows(one, POLICY, ASOF);
    const out = allocateSeasonBudget(one, ranked, { ...LEDGER, remainingMinor: 300_000 }, POLICY, ASOF);
    expect(out.slots[0].funded).toBe(false);
    expect(out.slots[0].fundingNote).toMatch(/value-too-small/);
  });
});

describe('allocateSeasonBudget — phases', () => {
  it('runs cold BEFORE retarget, never in parallel, and both before check-in', () => {
    const one = [cand({ valueAtRiskRon: 5000 })];
    const ranked = rankSeasonWindows(one, POLICY, ASOF);
    const out = allocateSeasonBudget(one, ranked, LEDGER, POLICY, ASOF);
    const [cold, rt] = out.slots[0].phases;
    expect(cold.kind).toBe('cold');
    expect(rt.kind).toBe('retarget');
    expect(cold.endDate <= rt.startDate).toBe(true);
    expect(rt.endDate < out.slots[0].checkIn).toBe(true);
  });

  it('plans NO retarget phase when no audience is deliverable', () => {
    const one = [cand({ valueAtRiskRon: 5000 })];
    const policy = { ...POLICY, retargetPossible: false };
    const ranked = rankSeasonWindows(one, policy, ASOF);
    const out = allocateSeasonBudget(one, ranked, LEDGER, policy, ASOF);
    expect(out.slots[0].phases.map((p) => p.kind)).toEqual(['cold']);
  });

  it('never plans a phase below Meta\'s RON 4.00 daily floor', () => {
    const one = [cand({ valueAtRiskRon: 5000 })];
    const ranked = rankSeasonWindows(one, POLICY, ASOF);
    const out = allocateSeasonBudget(one, ranked, LEDGER, POLICY, ASOF);
    for (const p of out.slots[0].phases) {
      expect(p.dailyBudgetMinor).toBeGreaterThanOrEqual(AD_SET_DAILY_FLOOR_MINOR);
    }
  });

  it('closes the arithmetic: budgetMinor === dailyBudgetMinor x days, summing to the slot', () => {
    const one = [cand({ valueAtRiskRon: 5000 })];
    const ranked = rankSeasonWindows(one, POLICY, ASOF);
    const out = allocateSeasonBudget(one, ranked, LEDGER, POLICY, ASOF);
    const slot = out.slots[0];
    let sum = 0;
    for (const p of slot.phases) {
      expect(p.budgetMinor).toBe(p.dailyBudgetMinor * p.days);
      sum += p.budgetMinor;
    }
    expect(sum).toBe(slot.advisoryBudgetMinor);
  });
});

describe('tierFor — a minor holiday is not a peak', () => {
  it('puts a MAJOR holiday in tier 1 and a MINOR one in tier 2', () => {
    const major = cand({ occasion: { name: 'Craciunul', type: 'major', startDate: '2026-12-25', endDate: '2026-12-26' } });
    const minor = cand({ id: 'unirii', occasion: { name: 'Ziua Unirii', type: 'minor', startDate: '2027-01-24', endDate: '2027-01-24' } });
    expect(tierFor(major)).toBe(1);
    expect(tierFor(minor)).toBe(2);
  });

  it('stops a 1,365 RON minor holiday outranking a 6,582 RON school-break block', () => {
    const cands = [
      cand({ id: 'unirii', checkIn: '2027-01-22', valueAtRiskRon: 1365, daysOut: 137,
             occasion: { name: 'Ziua Unirii', type: 'minor', startDate: '2027-01-24', endDate: '2027-01-24' } }),
      cand({ id: 'newyear', checkIn: '2026-12-28', valueAtRiskRon: 6582, daysOut: 112, kind: 'school-break',
             occasion: { name: 'Vacanta de iarna', type: 'school-break', startDate: '2026-12-23', endDate: '2027-01-10' } }),
    ];
    const ranked = rankSeasonWindows(cands, POLICY, ASOF);
    const order = ranked.sort((a, b) => a.rank - b.rank).map((r) => r.candidateId);
    expect(order[0]).toBe('newyear');
  });
});

describe('allocateSeasonBudget — no self-competition', () => {
  it('refuses to fund two overlapping stays and names the winner', () => {
    // Craciun exists twice by construction: as its own occasion and as a slice
    // of the winter school break. Both describe the same nights.
    const cands = [
      cand({ id: 'craciun', checkIn: '2026-12-24', checkOut: '2026-12-27', valueAtRiskRon: 5000, daysOut: 108 }),
      cand({ id: 'break-slice', checkIn: '2026-12-25', checkOut: '2026-12-28', kind: 'school-break',
             valueAtRiskRon: 4800, daysOut: 109 }),
    ];
    const ranked = rankSeasonWindows(cands, POLICY, ASOF);
    const out = allocateSeasonBudget(cands, ranked, LEDGER, POLICY, ASOF);
    const funded = out.slots.filter((s) => s.funded);
    expect(funded).toHaveLength(1);
    expect(funded[0].candidateId).toBe('craciun');
    const loser = out.slots.find((s) => s.candidateId === 'break-slice')!;
    expect(loser.fundingNote).toMatch(/already covered by craciun/);
  });

  it('still funds two windows whose stays do not overlap', () => {
    const cands = [
      cand({ id: 'a', checkIn: '2026-12-24', checkOut: '2026-12-27', valueAtRiskRon: 5000, daysOut: 108 }),
      cand({ id: 'b', checkIn: '2027-01-15', checkOut: '2027-01-18', valueAtRiskRon: 5000, daysOut: 130 }),
    ];
    const ranked = rankSeasonWindows(cands, POLICY, ASOF);
    const out = allocateSeasonBudget(cands, ranked, LEDGER, POLICY, ASOF);
    expect(out.slots.filter((s) => s.funded)).toHaveLength(2);
  });
});

describe('allocateSeasonBudget — coverage', () => {
  it('accounts for EVERY candidate exactly once, in slots or excluded', () => {
    const cands = [
      cand({ id: 'ok', checkIn: '2026-12-24', daysOut: 108 }),
      cand({ id: 'losing', checkIn: '2026-11-27', daysOut: 81, parityVerdict: 'losing' }),
      cand({ id: 'sold', checkIn: '2026-11-06', daysOut: 60, openNights: 0 }),
    ];
    const ranked = rankSeasonWindows(cands, POLICY, ASOF);
    const out = allocateSeasonBudget(cands, ranked, LEDGER, POLICY, ASOF);
    const seen = [...out.slots.map((s) => s.candidateId), ...out.excluded.map((e) => e.candidateId)];
    expect(seen.sort()).toEqual(['losing', 'ok', 'sold']);
  });

  it('ships its own method with the result, for the plan to record verbatim', () => {
    const one = [cand()];
    const ranked = rankSeasonWindows(one, POLICY, ASOF);
    const out = allocateSeasonBudget(one, ranked, LEDGER, POLICY, ASOF);
    expect(out.method.join(' ')).toMatch(/losing.*HARD gate/i);
  });
});
