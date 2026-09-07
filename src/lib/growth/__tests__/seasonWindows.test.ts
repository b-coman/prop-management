/** @jest-environment node */

import { buildSeasonCandidates, toOfficialDays, addDays, type SeasonWindowsInput } from '../seasonWindows';

/** The real seeded rows for the 2026-27 winter, names as stored (no diacritics). */
const HOLIDAYS = [
  { name: 'Vacanta de toamna', type: 'school-break', startDate: '2026-10-24', endDate: '2026-11-01' },
  { name: 'Sfantul Andrei + Ziua Nationala', type: 'major', startDate: '2026-11-30', endDate: '2026-12-01' },
  { name: 'Vacanta de iarna', type: 'school-break', startDate: '2026-12-23', endDate: '2027-01-10' },
  { name: 'Craciunul', type: 'major', startDate: '2026-12-25', endDate: '2026-12-26' },
  { name: 'Anul Nou', type: 'major', startDate: '2027-01-01', endDate: '2027-01-02' },
];

const base = (over: Partial<SeasonWindowsInput> = {}): SeasonWindowsInput => ({
  season: { start: '2026-10-11', end: '2027-01-31' },
  asOf: '2026-09-07',
  // The real void: one unbroken run.
  freeRuns: [{ start: '2026-10-11', end: '2027-01-31', nights: 113 }],
  holidays: HOLIDAYS,
  minStayByDate: () => 2,
  priceByDate: () => 500,
  quote: (_ci, nights) => nights * 500,
  periodByDate: () => ({ id: 'winter', name: 'Winter', verdict: 'healthy' }),
  creativeFor: () => ({ ready: true, gaps: [] }),
  ...over,
});

describe('buildSeasonCandidates — the school-break trap', () => {
  it('never produces one absurd 19-night window from the winter break', () => {
    const { candidates } = buildSeasonCandidates(base());
    const monsters = candidates.filter((c) => c.nights > 7);
    expect(monsters).toEqual([]);
  });

  it('keeps school-break rows out of travelWindow entirely', () => {
    const official = toOfficialDays(HOLIDAYS);
    expect(official.some((o) => o.name === 'Vacanta de iarna')).toBe(false);
    expect(official.some((o) => o.name === 'Craciunul')).toBe(true);
  });

  it('slices the winter break into weekends and midweek blocks instead', () => {
    const { candidates } = buildSeasonCandidates(base());
    const breakSlices = candidates.filter((c) => c.kind === 'school-break');
    expect(breakSlices.length).toBeGreaterThan(0);
    expect(breakSlices.every((c) => c.nights <= 4)).toBe(true);
  });
});

describe('buildSeasonCandidates — sources', () => {
  it('produces all four kinds, not just holidays', () => {
    const { candidates } = buildSeasonCandidates(base());
    const kinds = new Set(candidates.map((c) => c.kind));
    expect(kinds.has('occasion')).toBe(true);
    expect(kinds.has('school-break')).toBe(true);
    expect(kinds.has('weekend')).toBe(true);
    expect(kinds.has('residual')).toBe(true);
  });

  it('builds a real travel window around 1 Decembrie, incl. the departure evening', () => {
    const { candidates } = buildSeasonCandidates(base());
    const dec = candidates.find((c) => c.occasion?.name.includes('Ziua Nationala'));
    expect(dec).toBeDefined();
    // 30 Nov Mon + 1 Dec Tue, so the run reaches back over the weekend to the Friday evening.
    expect(dec!.checkIn <= '2026-11-28').toBe(true);
    expect(dec!.departureEvening).toBe(true);
  });
});

describe('buildSeasonCandidates — the off-by-one', () => {
  it('accepts a stay whose LAST NIGHT is the free run\'s last night', () => {
    const { candidates } = buildSeasonCandidates(
      base({
        season: { start: '2026-10-16', end: '2026-10-18' },
        freeRuns: [{ start: '2026-10-16', end: '2026-10-17', nights: 2 }],
      })
    );
    const fri = candidates.find((c) => c.checkIn === '2026-10-16');
    expect(fri).toBeDefined();
    expect(fri!.checkOut).toBe('2026-10-18'); // exclusive: last night is the 17th
  });

  it('rejects a stay that runs one night past the free run', () => {
    const { candidates, skipped } = buildSeasonCandidates(
      base({
        season: { start: '2026-10-16', end: '2026-10-18' },
        freeRuns: [{ start: '2026-10-16', end: '2026-10-16', nights: 1 }],
        minStayByDate: () => 2,
      })
    );
    expect(candidates).toEqual([]);
    expect(skipped.some((s) => s.reason === 'nights-not-all-free')).toBe(true);
  });
});

describe('buildSeasonCandidates — measurement', () => {
  it('values a window at open nights x asking price', () => {
    const { candidates } = buildSeasonCandidates(base());
    const w = candidates.find((c) => c.kind === 'weekend')!;
    expect(w.valueAtRiskRon).toBe(w.nights * 500);
    expect(w.openNights).toBe(w.nights);
  });

  it('skips a window whose nights have no calendar price rather than valuing it at zero', () => {
    const { candidates, skipped } = buildSeasonCandidates(base({ priceByDate: () => null }));
    expect(candidates).toEqual([]);
    expect(skipped.every((s) => s.reason === 'no-calendar-price' || s.reason === 'nights-not-all-free')).toBe(true);
  });

  it('carries the parity verdict through, so the allocator can gate on it', () => {
    const { candidates } = buildSeasonCandidates(
      base({ periodByDate: () => ({ id: 'p', name: 'P', verdict: 'losing' }) })
    );
    expect(candidates.every((c) => c.parityVerdict === 'losing')).toBe(true);
  });

  it('marks weekend nights and computes daysOut from asOf', () => {
    const { candidates } = buildSeasonCandidates(base());
    const w = candidates.find((c) => c.kind === 'weekend')!;
    expect(w.includesWeekendNight).toBe(true);
    expect(w.daysOut).toBeGreaterThan(30);
  });

  it('gives every candidate a stable id of checkIn_nights', () => {
    const { candidates } = buildSeasonCandidates(base());
    for (const c of candidates) expect(c.id).toBe(`${c.checkIn}_${c.nights}`);
    expect(new Set(candidates.map((c) => c.id)).size).toBe(candidates.length);
  });
});

describe('addDays', () => {
  it('crosses a month and a year boundary in UTC', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-11-30', -1)).toBe('2026-11-29');
  });
});
