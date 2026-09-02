/** @jest-environment node */

/**
 * Grouping by period exists because four December probes are the same nights. These pin the two
 * things that made it necessary: overlap collapsing into one section, and money counted once.
 */
import { groupByPeriod, nightsOf, type PricingPeriod } from '../periods';
import type { BoardRow } from '../board';

const period = (id: string, name: string, startDate: string, endDate: string): PricingPeriod =>
  ({ id, name, startDate, endDate, weekdayRate: 1000, weekendRate: 1200 });

const row = (checkIn: string, checkOut: string, over: Partial<BoardRow> = {}): BoardRow => ({
  key: `${checkIn}|${checkOut}|3`, checkIn, checkOut,
  nights: nightsOf(checkIn, checkOut).length, partyLabel: '2a+1c',
  channel: 'booking.com', channelLabel: 'Booking.com',
  ourPrice: 4539, ourDirect: 3296, fieldMedian: 5150, fieldMin: 4100, fieldMax: 5890,
  gapPct: -12, aboveAll: false, quoted: 5, eligible: 15, nothingLeft: 10, cantHost: 0, unread: 0,
  onSaleShare: 0.33, position: 'cheap', scarcity: 'tight', attention: 'act',
  label: 'Left money', why: '…', atStake: 3296, fullySold: false,
  oldestAgeDays: 0, soldNights: 0, movedSinceLastReading: 0,
  ...over,
});

const XMAS = period('xmas', 'Christmas', '2026-12-24', '2026-12-27');
const PNY = period('pny', 'Pre-New Year', '2026-12-28', '2027-01-03');

describe('overlapping probes are one situation, not four decisions', () => {
  it('collapses the four Christmas windows into one period section', () => {
    const g = groupByPeriod({
      rows: [
        row('2026-12-23', '2026-12-26'), row('2026-12-23', '2026-12-27'),
        row('2026-12-24', '2026-12-29'), row('2026-12-25', '2026-12-28'),
      ],
      periods: [XMAS, PNY], soldNights: new Set(), rateByNight: new Map(),
    });
    const xmas = g.find((x) => x.period?.id === 'xmas')!;
    expect(xmas.windows.length).toBeGreaterThanOrEqual(3);
    expect(g.filter((x) => x.windows.length > 0).length).toBeLessThanOrEqual(2);
  });

  it('files a straddling window where most of its nights are, and TELLS the other side', () => {
    // 24-29 Dec: 24,25,26,27 in Christmas (4) and 28 in Pre-New Year (1).
    const g = groupByPeriod({
      rows: [row('2026-12-24', '2026-12-29')],
      periods: [XMAS, PNY], soldNights: new Set(), rateByNight: new Map(),
    });
    const xmas = g.find((x) => x.period?.id === 'xmas')!;
    const pny = g.find((x) => x.period?.id === 'pny')!;
    expect(xmas.windows).toHaveLength(1);
    expect(xmas.windows[0].nightsInside).toBe(4);
    expect(pny.windows).toHaveLength(0);
    expect(pny.alsoSampledBy).toEqual([
      { key: '2026-12-24|2026-12-29', checkIn: '2026-12-24', checkOut: '2026-12-29', nightsInside: 1 },
    ]);
  });
});

describe('money is counted once, from the period', () => {
  it('does not multiply the same nights by the probes that overlap them', () => {
    // Four probes, each carrying atStake ~3,300: summing per window gave 14,018 for five nights.
    const rate = new Map(nightsOf('2026-12-24', '2026-12-28').map((n) => [n, 1000]));
    const g = groupByPeriod({
      rows: [
        row('2026-12-23', '2026-12-26'), row('2026-12-23', '2026-12-27'),
        row('2026-12-24', '2026-12-29'), row('2026-12-25', '2026-12-28'),
      ],
      periods: [XMAS], soldNights: new Set(), rateByNight: rate,
    });
    const xmas = g.find((x) => x.period?.id === 'xmas')!;
    expect(xmas.openNights).toBe(4);          // 24, 25, 26, 27 - inclusive end
    expect(xmas.unsoldMoney).toBe(4000);      // not 14,018
  });

  it('leaves out nights already booked', () => {
    const rate = new Map(nightsOf('2026-12-24', '2026-12-28').map((n) => [n, 1000]));
    const g = groupByPeriod({
      rows: [row('2026-12-24', '2026-12-27')],
      periods: [XMAS], soldNights: new Set(['2026-12-25', '2026-12-26']), rateByNight: rate,
    });
    expect(g.find((x) => x.period?.id === 'xmas')!.unsoldMoney).toBe(2000);
  });
});

describe('what it refuses to do', () => {
  it('gives a period no verdict of its own - rolling up across channels is pooling', () => {
    const g = groupByPeriod({
      rows: [row('2026-12-24', '2026-12-27'), row('2026-12-24', '2026-12-27', { channel: 'airbnb' })],
      periods: [XMAS], soldNights: new Set(), rateByNight: new Map(),
    });
    const xmas = g.find((x) => x.period?.id === 'xmas')!;
    expect(xmas).not.toHaveProperty('attention');
    expect(xmas).not.toHaveProperty('label');
    expect(xmas.windows[0].rows).toHaveLength(2);   // both contests survive, separately
  });

  it('keeps a period with nothing read - an unread period is a stated absence', () => {
    const g = groupByPeriod({ rows: [], periods: [XMAS, PNY], soldNights: new Set(), rateByNight: new Map() });
    expect(g.map((x) => x.period?.name)).toEqual(['Christmas', 'Pre-New Year']);
    expect(g.every((x) => x.windows.length === 0)).toBe(true);
  });

  it('still shows a window that falls in no configured period', () => {
    const g = groupByPeriod({
      rows: [row('2026-07-01', '2026-07-04')],
      periods: [XMAS], soldNights: new Set(), rateByNight: new Map(),
    });
    expect(g.find((x) => x.period === null)!.windows).toHaveLength(1);
  });
});
