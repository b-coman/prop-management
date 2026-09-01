/**
 * The cases the owner described on 2026-09-01, plus the ones that must NOT trigger.
 */
import { travelWindow, comparePeriodToWindow, suggestedMinStay } from '../travelWindow';

const H = (date: string, name = 'holiday') => ({ date, name });

describe('1 Decembrie 2026 - the case that started this', () => {
  // Sf. Andrei Mon 30 Nov, Ziua Nationala Tue 1 Dec, with Sat 28 / Sun 29 before them.
  const days = [H('2026-11-30', 'Sfantul Andrei'), H('2026-12-01', 'Ziua Nationala')];
  const w = travelWindow('2026-11-30', '2026-12-01', days);

  it('starts on the Friday evening people leave the city', () => {
    expect(w.checkIn).toBe('2026-11-27');
    expect(w.departureEvening).toBe(true);
  });

  it('sends them home on 1 December, as the owner described', () => {
    expect(w.checkOut).toBe('2026-12-01');
    expect(w.nights).toBe(4);
  });

  it('needs no bridge - the weekend runs straight into the holidays', () => {
    expect(w.bridged).toEqual([]);
    expect(w.daysOff).toEqual({ from: '2026-11-28', to: '2026-12-01' });
  });
});

describe('the bridge: a working day between two days off is taken off', () => {
  // The owner's own example: "thursday a holiday, then friday working day, then saturday and sunday".
  // 2026-12-24 is a Thursday.
  const w = travelWindow('2026-12-24', '2026-12-24', [H('2026-12-24', 'Craciun')]);

  it('takes the Friday, joining the holiday to the weekend', () => {
    expect(w.bridged).toContain('2026-12-25');
    expect(w.daysOff).toEqual({ from: '2026-12-24', to: '2026-12-27' });
  });

  it('sells the Wednesday night as the departure evening', () => {
    expect(w.checkIn).toBe('2026-12-23');
    expect(w.checkOut).toBe('2026-12-27');
    expect(w.nights).toBe(4);
  });

  it('explains itself in words the owner can check', () => {
    expect(w.why).toMatch(/bridged/);
    expect(w.why).toMatch(/departure evening/);
  });
});

describe('what must NOT be bridged', () => {
  it('does not bridge two working days', () => {
    // Wed holiday, Thu + Fri working, weekend. Nobody burns two days of leave for it.
    const w = travelWindow('2026-12-23', '2026-12-23', [H('2026-12-23', 'mid-week')]);
    expect(w.bridged).toEqual([]);
    expect(w.daysOff).toEqual({ from: '2026-12-23', to: '2026-12-23' });
  });

  it('does not invent a departure evening for a lone day off', () => {
    // A single day with no weekend attached is not a break, so there is no evening drive up.
    const w = travelWindow('2026-12-23', '2026-12-23', [H('2026-12-23', 'mid-week')]);
    expect(w.departureEvening).toBe(false);
    expect(w.checkIn).toBe('2026-12-23');
  });

  it('does not add a departure evening when the run already starts on a day off', () => {
    // New Year's Day 2027 is a Friday, so the run reaches back into no working day before it.
    const w = travelWindow('2027-01-01', '2027-01-02', [H('2027-01-01'), H('2027-01-02')]);
    expect(w.checkIn).toBe('2026-12-31');
    expect(w.daysOff.to).toBe('2027-01-03');   // runs into the weekend
  });
});

describe('comparePeriodToWindow', () => {
  const w = travelWindow('2026-11-30', '2026-12-01',
    [H('2026-11-30'), H('2026-12-01')]);
  const lateFall = { name: 'Late Fall', startDate: '2026-11-02', endDate: '2026-11-27' };
  const dec1 = { name: '1 Decembrie', startDate: '2026-11-28', endDate: '2026-12-01' };

  it('catches a holiday night falling to a general season', () => {
    // The Friday IS covered - by Late Fall. That is exactly the defect: one stay, two rates.
    const r = comparePeriodToWindow([lateFall, dec1], w);
    expect(r.aligned).toBe(false);
    expect(r.ordinaryNights).toEqual(['2026-11-27']);
    expect(r.note).toMatch(/ordinary season, not as this holiday/);
  });

  it('is satisfied once the holiday period starts on the Friday', () => {
    const r = comparePeriodToWindow(
      [lateFall, { ...dec1, startDate: '2026-11-27' }], w);
    expect(r.aligned).toBe(true);
    expect(r.nights.map((n) => n.period)).toEqual(
      ['1 Decembrie', '1 Decembrie', '1 Decembrie', '1 Decembrie']);
  });

  it('reports a night no period prices at all', () => {
    const r = comparePeriodToWindow([dec1], w);
    expect(r.unpricedNights).toEqual(['2026-11-27']);
    expect(r.note).toMatch(/no period at all/);
  });

  it('accepts a break deliberately split across two occasion periods', () => {
    // New Year: NYE is a dearer night than the two after it, and that is on purpose. Neither period
    // is a season, so nothing here is an ordinary rate.
    const ny = travelWindow('2027-01-01', '2027-01-02',
      [H('2027-01-01'), H('2027-01-02')]);
    const r = comparePeriodToWindow([
      { name: "New Year's Eve", startDate: '2026-12-30', endDate: '2026-12-31' },
      { name: 'Post-New Year', startDate: '2027-01-01', endDate: '2027-01-03' },
    ], ny);
    expect(r.aligned).toBe(true);
    expect(r.ordinaryNights).toEqual([]);
  });
});

describe('suggestedMinStay', () => {
  it('leaves a shorter break sellable rather than forcing the whole window', () => {
    const w = travelWindow('2026-11-30', '2026-12-01', [H('2026-11-30'), H('2026-12-01')]);
    expect(w.nights).toBe(4);
    expect(suggestedMinStay(w)).toBe(3);
  });

  it('never drops below two nights', () => {
    expect(suggestedMinStay({ nights: 2 } as never)).toBe(2);
  });
});
