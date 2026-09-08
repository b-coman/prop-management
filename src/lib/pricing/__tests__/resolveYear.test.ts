/** @jest-environment node */
/**
 * The rules must produce DATES, and must say so when they cannot. Both halves matter: a rule that
 * silently resolves to nothing is how 444 days of the horizon came to have no price.
 *
 * A YEAR HERE RUNS 1 SEPTEMBER TO 31 AUGUST, so `resolveYear(..., 2026)` is the 2026-27 season and
 * anything from January to August lands in 2027. Several of these cases exist specifically to pin
 * that down, because reading a season year as a calendar year moves every spring period by a year.
 */
import { resolveYear, officialDaysFrom, seasonWindow, type HolidayRow, type SeasonRule } from '../resolveYear';

const H = (slug: string, startDate: string, endDate: string, over: Partial<HolidayRow> = {}): HolidayRow => ({
  slug, name: slug, startDate, endDate, year: Number(startDate.slice(0, 4)), type: 'major', official: true, ...over,
});

const HOLIDAYS: HolidayRow[] = [
  H('ziua-unirii', '2026-01-24', '2026-01-24', { type: 'minor' }),
  H('ziua-unirii', '2027-01-24', '2027-01-24', { type: 'minor' }),
  H('ziua-muncii', '2026-05-01', '2026-05-01'),
  H('craciun', '2026-12-25', '2026-12-26'),
  H('anul-nou', '2026-01-01', '2026-01-02'),
  H('anul-nou', '2027-01-01', '2027-01-02'),
  H('vacanta-iarna', '2026-12-23', '2027-01-10', { type: 'school-break' }),
];

const OPTS = { propertyId: 'p' };

describe('resolveYear — the season year', () => {
  it('runs 1 September to 31 August', () => {
    expect(seasonWindow(2026)).toEqual({ from: '2026-09-01', to: '2027-08-31' });
  });

  it('puts a month-day before September into the SECOND calendar year', () => {
    const r = resolveYear([{ slug: 'summer', name: 'Summer', anchor: { kind: 'calendar', from: '06-20', to: '08-31' } }], HOLIDAYS, 2026, OPTS);
    expect(r.periods[0]).toMatchObject({ startDate: '2027-06-20', endDate: '2027-08-31', year: 2027 });
  });

  it('puts a month-day at or after September into the first', () => {
    const r = resolveYear([{ slug: 'fall', name: 'Fall', anchor: { kind: 'calendar', from: '09-09', to: '10-22' } }], HOLIDAYS, 2026, OPTS);
    expect(r.periods[0]).toMatchObject({ startDate: '2026-09-09', endDate: '2026-10-22', year: 2026 });
  });
});

describe('resolveYear — anchors', () => {

  it('wraps a calendar anchor whose end reads earlier than its start', () => {
    const r = resolveYear([{ slug: 'festive', name: 'Festive', anchor: { kind: 'calendar', from: '12-24', to: '01-02' } }], HOLIDAYS, 2026, OPTS);
    expect(r.periods[0]).toMatchObject({ startDate: '2026-12-24', endDate: '2027-01-02' });
  });

  it('runs a holiday through travelWindow, so the period starts on the departure evening', () => {
    // 1 May 2026 is a Friday: Fri/Sat/Sun off, so people leave on Thursday evening. It belongs to
    // the 2025-26 season, which is what makes it reachable from season year 2025.
    const r = resolveYear([{ slug: '1-mai', name: 'Labour Day', minStay: 'auto', anchor: { kind: 'holiday', slug: 'ziua-muncii', window: 'travel' } }], HOLIDAYS, 2025, OPTS);
    expect(r.periods[0]).toMatchObject({ startDate: '2026-04-30', endDate: '2026-05-02', minStay: 3 });
  });

  it('takes a school break exactly as seeded, shifted, never through travelWindow', () => {
    const r = resolveYear([{ slug: 'iarna', name: 'Winter break', anchor: { kind: 'holiday', slug: 'vacanta-iarna', window: 'exact', shiftStart: -1 } }], HOLIDAYS, 2026, OPTS);
    expect(r.periods[0]).toMatchObject({ startDate: '2026-12-22', endDate: '2027-01-10' });
  });

  it('keeps a festive season whole, with no per-rule year offset', () => {
    // Anul Nou has an instance at each end of a calendar year. The season window picks the right one
    // on its own — this needed an explicit yearOffset back when a year meant January to December.
    const rules: SeasonRule[] = [
      { slug: 'christmas', name: 'Christmas', anchor: { kind: 'span', from: { holiday: 'craciun', edge: 'start', offset: -1 }, to: { holiday: 'craciun', edge: 'end', offset: 1 } } },
      { slug: 'new-year', name: 'New Year', anchor: { kind: 'span', from: { rule: 'christmas', edge: 'end', offset: 1 }, to: { holiday: 'anul-nou', edge: 'end' } } },
    ];
    const r = resolveYear(rules, HOLIDAYS, 2026, OPTS);
    expect(r.periods.map((p) => [p.slug, p.startDate, p.endDate])).toEqual([
      ['christmas', '2026-12-24', '2026-12-27'],
      ['new-year', '2026-12-28', '2027-01-02'],
    ]);
  });

  it('tags a period by the year its FIRST NIGHT falls in', () => {
    const r = resolveYear([{ slug: 'rc', name: 'Russian Christmas', anchor: { kind: 'span', from: { holiday: 'vacanta-iarna', edge: 'end', offset: -7 }, to: { holiday: 'vacanta-iarna', edge: 'end' } } }], HOLIDAYS, 2026, OPTS);
    expect(r.periods[0]).toMatchObject({ startDate: '2027-01-03', year: 2027 });
  });
});

describe('resolveYear — resolving to nothing is a legal outcome, never a silent one', () => {
  it('names the rule and the reason when a holiday is not seeded', () => {
    const r = resolveYear([{ slug: 'paste', name: 'Easter', anchor: { kind: 'holiday', slug: 'paste', window: 'travel' } }], HOLIDAYS, 2026, OPTS);
    expect(r.periods).toHaveLength(0);
    expect(r.unresolved[0]).toMatchObject({ slug: 'paste' });
    expect(r.unresolved[0].reason).toMatch(/not seeded|never derive/i);
  });

  it('reports a span whose reference is missing rather than guessing a date', () => {
    const r = resolveYear([{ slug: 'pre', name: 'Pre', anchor: { kind: 'span', from: { rule: 'nope', edge: 'start' }, to: { rule: 'nope', edge: 'end' } } }], HOLIDAYS, 2026, OPTS);
    expect(r.periods).toHaveLength(0);
    expect(r.unresolved[0].reason).toMatch(/missing or circular/);
  });
});

describe('resolveYear — the exceptions layer', () => {
  // Season 2026-27's summer falls in CALENDAR 2027, and an exception is keyed on the calendar year
  // of the period's first night — a season spans two, so keying on the season would match the wrong
  // half of the year.
  const rule: SeasonRule = { slug: 'summer', name: 'Summer', anchor: { kind: 'calendar', from: '06-20', to: '08-31' } };

  it('patches a resolved period and records why', () => {
    const r = resolveYear([rule], HOLIDAYS, 2026, {
      ...OPTS,
      exceptions: [{ year: 2027, slug: 'summer', reason: 'owner extended it after the 2026 arrivals', patch: { endDate: '2027-09-06' } }],
    });
    expect(r.periods[0].endDate).toBe('2027-09-06');
    expect(r.notes.join(' ')).toMatch(/owner extended it/);
  });

  it('does not apply an exception from a different year', () => {
    const r = resolveYear([rule], HOLIDAYS, 2026, {
      ...OPTS,
      exceptions: [{ year: 2026, slug: 'summer', reason: 'the season before', patch: { endDate: '2026-09-06' } }],
    });
    expect(r.periods[0].endDate).toBe('2027-08-31');
  });

  it('drops a period by decision, and says it was a decision', () => {
    const r = resolveYear([rule], HOLIDAYS, 2026, {
      ...OPTS,
      exceptions: [{ year: 2027, slug: 'summer', reason: 'the house was being rebuilt', drop: true }],
    });
    expect(r.periods).toHaveLength(0);
    expect(r.unresolved[0].reason).toMatch(/dropped by exception/);
  });
});

describe('resolveYear — the declared fallback for a ministerial anchor', () => {
  const autumn: SeasonRule = {
    slug: 'vacanta-toamna', name: 'Autumn Break', minStay: 3,
    anchor: { kind: 'holiday', slug: 'vacanta-toamna', window: 'exact', shiftStart: -1, shiftEnd: -1 },
    fallback: { kind: 'last-school-week', month: 10, padWeekend: true },
  };

  it('reproduces the seeded shape when the ministry HAS published', () => {
    // The known years: 25 Oct - 2 Nov 2025 and 24 Oct - 1 Nov 2026. The fallback must agree with
    // both, or it is not a fallback, it is a different rule.
    const r = resolveYear([{ ...autumn, anchor: autumn.fallback! }], HOLIDAYS, 2026, OPTS);
    expect(r.periods[0]).toMatchObject({ startDate: '2026-10-24', endDate: '2026-11-01' });
    const prev = resolveYear([{ ...autumn, anchor: autumn.fallback! }], HOLIDAYS, 2025, OPTS);
    expect(prev.periods[0]).toMatchObject({ startDate: '2025-10-25', endDate: '2025-11-02' });
  });

  it('prices the window from the fallback when the year is unpublished, and says it is provisional', () => {
    const r = resolveYear([autumn], HOLIDAYS, 2027, OPTS);
    expect(r.periods[0]).toMatchObject({ startDate: '2027-10-23', endDate: '2027-10-31' });
    expect(r.unresolved).toHaveLength(0);
    expect(r.notes.join(' ')).toMatch(/PROVISIONAL.*fallback/);
  });

  it('waits for a fallback that hangs off another rule instead of failing it early', () => {
    // Russian Christmas falls back to "the week after New Year". Judged on the first pass that
    // reads as a failure, because New Year has not resolved yet — and it reported unresolved while
    // New Year sat one rule below, about to resolve.
    const rules: SeasonRule[] = [
      { slug: 'rc', name: 'Russian Christmas',
        anchor: { kind: 'span', from: { holiday: 'not-seeded', edge: 'end' }, to: { holiday: 'not-seeded', edge: 'end' } },
        fallback: { kind: 'span', from: { rule: 'new-year', edge: 'end', offset: 1 }, to: { rule: 'new-year', edge: 'end', offset: 8 } } },
      { slug: 'new-year', name: 'New Year',
        anchor: { kind: 'span', from: { holiday: 'craciun', edge: 'end', offset: 2 }, to: { holiday: 'anul-nou', edge: 'end' } } },
    ];
    const r = resolveYear(rules, HOLIDAYS, 2026, OPTS);
    expect(r.unresolved).toHaveLength(0);
    expect(r.periods.find((p) => p.slug === 'rc')).toMatchObject({ startDate: '2027-01-03', endDate: '2027-01-10' });
  });

  it('still reports unresolved when there is no fallback to fall back to', () => {
    const r = resolveYear([{ ...autumn, fallback: undefined }], HOLIDAYS, 2027, OPTS);
    expect(r.periods).toHaveLength(0);
    expect(r.unresolved[0].reason).toMatch(/never derive it/);
  });
});

describe('resolveYear — premium nights', () => {
  it('anchors a premium to a holiday rather than to a date', () => {
    const rules: SeasonRule[] = [
      { slug: 'christmas', name: 'Christmas', anchor: { kind: 'span', from: { holiday: 'craciun', edge: 'start', offset: -1 }, to: { holiday: 'craciun', edge: 'end', offset: 1 } } },
      { slug: 'new-year', name: 'New Year', fixedNightPrice: 940,
        anchor: { kind: 'span', from: { rule: 'christmas', edge: 'end', offset: 1 }, to: { holiday: 'anul-nou', edge: 'end' } },
        premiumNights: { anchor: { holiday: 'anul-nou', edge: 'start' }, offsets: [-2, -1], price: 2351 } },
    ];
    const ny = resolveYear(rules, HOLIDAYS, 2026, OPTS).periods.find((p) => p.slug === 'new-year')!;
    expect(ny.nightProfile).toEqual([
      { date: '2026-12-30', price: 2351 },
      { date: '2026-12-31', price: 2351 },
    ]);
  });
});

describe('officialDaysFrom', () => {
  it('excludes school breaks — a break is not a day the country is off work', () => {
    const days = officialDaysFrom(HOLIDAYS).map((d) => d.date);
    expect(days).toContain('2026-12-25');
    expect(days).not.toContain('2026-12-29'); // inside vacanta-iarna, not a public holiday
  });
});
