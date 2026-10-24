/** @jest-environment node */

import {
  mergeStays, pickBadges, searchScore, lastFreeWeekendByMonth, overlaps,
  type CandidateStay,
} from '../openStays';

const wk = (start: string, end: string, price = 1253): CandidateStay => ({
  start, end, nights: (Date.parse(end) - Date.parse(start)) / 86400000, price, label: null, kind: 'weekend',
});
const occ = (start: string, end: string, price: number, ro: string): CandidateStay => ({
  start, end, nights: (Date.parse(end) - Date.parse(start)) / 86400000, price, label: { ro, en: ro }, kind: 'occasion',
});
const none = { searches: [], lastFree: new Map<string, string>() };

describe('overlaps', () => {
  it('needs a shared night, not a shared changeover day', () => {
    expect(overlaps({ start: '2026-11-20', end: '2026-11-22' }, { start: '2026-11-22', end: '2026-11-24' })).toBe(false);
    expect(overlaps({ start: '2026-11-20', end: '2026-11-23' }, { start: '2026-11-22', end: '2026-11-24' })).toBe(true);
  });
});

describe('mergeStays', () => {
  it('keeps the occasion and drops the plain weekend it overlaps', () => {
    const rows = mergeStays(
      [wk('2026-11-20', '2026-11-22'), wk('2026-12-04', '2026-12-06')],
      [occ('2026-11-28', '2026-12-02', 2421, 'Minivacanța de 1 Decembrie'), occ('2026-12-04', '2026-12-08', 2600, 'X')],
    );
    expect(rows.map((r) => r.start)).toEqual(['2026-11-20', '2026-11-28', '2026-12-04']);
    expect(rows[2].kind).toBe('occasion');
  });

  it('sorts soonest first and stops at maxRows', () => {
    const rows = mergeStays([wk('2026-12-11', '2026-12-13'), wk('2026-11-20', '2026-11-22'), wk('2026-12-04', '2026-12-06')], [], 2);
    expect(rows.map((r) => r.start)).toEqual(['2026-11-20', '2026-12-04']);
  });

  it('gives the last row to the next occasion the soonest rows miss', () => {
    const weekends = [wk('2026-11-20', '2026-11-22'), wk('2026-12-04', '2026-12-06'), wk('2026-12-11', '2026-12-13')];
    const occasions = [
      occ('2026-11-28', '2026-12-02', 2421, 'Minivacanța de 1 Decembrie'),
      occ('2026-12-25', '2026-12-30', 4017, 'Vacanța de iarnă'),
      occ('2027-01-03', '2027-01-08', 3128, 'Vacanța de iarnă'),
    ];
    expect(mergeStays(weekends, occasions, 4).map((r) => r.start)).toEqual(['2026-11-20', '2026-11-28', '2026-12-04', '2026-12-25']);
    expect(mergeStays(weekends, occasions, 3).map((r) => r.start)).toEqual(['2026-11-20', '2026-11-28', '2026-12-25']);
    // Nothing later to show: plain soonest-first.
    expect(mergeStays(weekends, occasions.slice(0, 1), 4).map((r) => r.start)).toEqual(['2026-11-20', '2026-11-28', '2026-12-04', '2026-12-11']);
    // A single row stays the soonest stay.
    expect(mergeStays(weekends, occasions, 1).map((r) => r.start)).toEqual(['2026-11-20']);
  });
});

describe('lastFreeWeekendByMonth', () => {
  // November 2026 Saturdays: 7, 14, 21, 28.
  it('names the only free weekend of a fully searched month', () => {
    const m = lastFreeWeekendByMonth([wk('2026-11-20', '2026-11-22')], { from: '2026-10-20', to: '2027-01-03' });
    expect(m.get('2026-11')).toBe('2026-11-21');
  });

  it('counts a holiday stay that holds a Saturday night as a free weekend', () => {
    const m = lastFreeWeekendByMonth(
      [wk('2026-11-20', '2026-11-22'), occ('2026-11-28', '2026-12-02', 2421, '1 Dec')],
      { from: '2026-10-20', to: '2027-01-03' },
    );
    expect(m.has('2026-11')).toBe(false);
  });

  it('says nothing about a month the search only half covered', () => {
    const m = lastFreeWeekendByMonth([wk('2026-11-20', '2026-11-22')], { from: '2026-10-20', to: '2026-11-25' });
    expect(m.has('2026-11')).toBe(false);
  });

  it('says nothing when only one weekend of the month is left at all', () => {
    // Standing on 23 Nov, the 28th is the only Saturday left: free, but not news.
    const m = lastFreeWeekendByMonth([wk('2026-11-27', '2026-11-29')], { from: '2026-11-23', to: '2027-01-03' });
    expect(m.has('2026-11')).toBe(false);
  });
});

describe('pickBadges', () => {
  const rows = [wk('2026-11-20', '2026-11-22'), wk('2026-12-04', '2026-12-06'), wk('2026-12-11', '2026-12-13')];

  it('puts "high demand" on the most searched stay, if searched enough', () => {
    const searches = [
      { start: '2026-11-20', end: '2026-11-22', count: 8 },
      { start: '2026-12-04', end: '2026-12-06', count: 2 },
    ];
    const out = pickBadges(rows, { searches, lastFree: new Map() });
    expect(out[0].badge?.kind).toBe('highDemand');
    expect(out.filter((r) => r.badge).length).toBe(1);
    expect(pickBadges(rows, { searches: [{ start: '2026-12-04', end: '2026-12-06', count: 2 }], lastFree: new Map() })
      .some((r) => r.badge)).toBe(false);
  });

  it('counts searches that share a night with the stay', () => {
    expect(searchScore(rows[0], [{ start: '2026-11-21', end: '2026-11-23', count: 3 }, { start: '2026-11-22', end: '2026-11-24', count: 5 }])).toBe(3);
  });

  it('fills {month} in the last-free-weekend badge, per language', () => {
    const out = pickBadges(rows, { searches: [], lastFree: new Map([['2026-11', '2026-11-21']]) });
    expect(out[0].badge).toEqual({ kind: 'lastFree', text: { en: 'Last free weekend in November', ro: 'Ultimul weekend liber din noiembrie' } });
  });

  it('gives "best price" only for a real gap, per night', () => {
    const cheap = [wk('2026-11-20', '2026-11-22', 1000), wk('2026-12-04', '2026-12-06', 1253)];
    expect(pickBadges(cheap, none)[0].badge?.kind).toBe('bestPrice');
    expect(pickBadges([wk('2026-11-20', '2026-11-22', 1200), wk('2026-12-04', '2026-12-06', 1253)], none).some((r) => r.badge)).toBe(false);
    // A 4-night stay at 2,000 is 500 a night: cheaper per night than a 1,253 weekend, though dearer in total.
    const mixed = [wk('2026-11-20', '2026-11-22', 1253), occ('2026-11-28', '2026-12-02', 2000, '1 Dec')];
    expect(pickBadges(mixed, none)[1].badge?.kind).toBe('bestPrice');
  });

  it('lets the owner pin a badge, and caps the block at two badges, one per row', () => {
    const out = pickBadges(rows, {
      searches: [{ start: '2026-11-20', end: '2026-11-22', count: 9 }, { start: '2026-12-04', end: '2026-12-06', count: 5 }],
      lastFree: new Map([['2026-11', '2026-11-21']]),
    }, { pinned: [{ start: '2026-12-11', text: { ro: 'Ofertă', en: 'Offer' } }] });
    expect(out.map((r) => r.badge?.kind ?? null)).toEqual(['lastFree', null, 'pinned']);
  });

  it('switches a badge off, or rewords it', () => {
    const lastFree = new Map([['2026-11', '2026-11-21']]);
    expect(pickBadges(rows, { searches: [], lastFree }, { badges: { lastFree: false } }).some((r) => r.badge)).toBe(false);
    const searches = [{ start: '2026-11-20', end: '2026-11-22', count: 4 }];
    expect(pickBadges(rows, { searches, lastFree: new Map() }, { badges: { highDemand: { ro: 'Se caută mult', en: 'Popular' } } })[0].badge?.text)
      .toEqual({ ro: 'Se caută mult', en: 'Popular' });
  });
});
