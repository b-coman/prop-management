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
  // Owner, 2026-09-07: "for national day, or any other official holiday, the min stay should be 3
  // if there is a long weekend". The trigger is the RUN OF DAYS OFF, not the window length.

  it('leaves a shorter break sellable rather than forcing the whole window', () => {
    const w = travelWindow('2026-11-30', '2026-12-01', [H('2026-11-30'), H('2026-12-01')]);
    expect(w.nights).toBe(4);
    expect(suggestedMinStay(w)).toBe(3);
  });

  it('asks 3 for a Friday holiday - the case the old formula returned 2 for', () => {
    // Ziua Muncii 2026: Fri 1 May off, so Fri/Sat/Sun is a 3-day run selling 3 nights.
    const w = travelWindow('2026-05-01', '2026-05-01', [H('2026-05-01', 'Ziua Muncii')]);
    expect(w.daysOff).toEqual({ from: '2026-05-01', to: '2026-05-03' });
    expect(w.nights).toBe(3);
    expect(suggestedMinStay(w)).toBe(3);
  });

  it('asks 3 for a Monday holiday too', () => {
    // Rusalii 2027: Sun 20 / Mon 21 June, giving Sat/Sun/Mon.
    const w = travelWindow('2027-06-20', '2027-06-21', [H('2027-06-20'), H('2027-06-21')]);
    expect(suggestedMinStay(w)).toBe(3);
  });

  it('stays at 2 when the holiday lands inside the weekend', () => {
    // Ziua Unirii 2027 is a Sunday: no run longer than the weekend itself, so no long weekend.
    const w = travelWindow('2027-01-24', '2027-01-24', [H('2027-01-24', 'Ziua Unirii')]);
    expect(suggestedMinStay(w)).toBe(2);
  });

  it('does not force the whole festive stretch', () => {
    // The 10-night Craciun->Revelion run: a long weekend many times over, but still min 3, so a
    // family wanting only the Christmas end can still book.
    const w = travelWindow('2026-12-25', '2026-12-26', [
      H('2026-12-25'), H('2026-12-26'), H('2027-01-01'), H('2027-01-02'),
      H('2026-12-28', 'punte'), H('2026-12-29', 'punte'), H('2026-12-30', 'punte'), H('2026-12-31', 'punte'),
    ]);
    expect(w.nights).toBe(10);
    expect(suggestedMinStay(w)).toBe(3);
  });

  it('never drops below two nights', () => {
    expect(suggestedMinStay({ nights: 2 } as never)).toBe(2);
  });
});

describe('travelWindow — the festive stretch (bridge-day rows)', () => {
  // "In real terms, nobody works between Christmas and NY" — owner, 2026-09-07.
  // Seeded as `bridge-day` rows because travelWindow bridges at most 1-2 working
  // days on its own, and there are four here.
  const PUBLIC_ONLY = [
    { date: '2026-12-25', name: 'Craciunul' }, { date: '2026-12-26', name: 'Craciunul' },
    { date: '2027-01-01', name: 'Anul Nou' }, { date: '2027-01-02', name: 'Anul Nou' },
  ];
  const WITH_BRIDGE = [
    ...PUBLIC_ONLY,
    { date: '2026-12-28', name: 'Punte Craciun-Revelion' }, { date: '2026-12-29', name: 'Punte Craciun-Revelion' },
    { date: '2026-12-30', name: 'Punte Craciun-Revelion' }, { date: '2026-12-31', name: 'Punte Craciun-Revelion' },
  ];

  it('splits the stretch into two short windows on public holidays alone', () => {
    expect(travelWindow('2026-12-25', '2026-12-26', PUBLIC_ONLY).nights).toBe(3);
    expect(travelWindow('2027-01-01', '2027-01-02', PUBLIC_ONLY).checkIn).toBe('2026-12-31');
  });

  it('returns ONE continuous 10-night stretch once the bridge days are seeded', () => {
    const w = travelWindow('2026-12-25', '2026-12-26', WITH_BRIDGE);
    expect(w.checkIn).toBe('2026-12-24');
    expect(w.checkOut).toBe('2027-01-03');
    expect(w.nights).toBe(10);
  });

  it('carries its ANCHOR, so two identical stretches stay distinguishable', () => {
    const craciun = travelWindow('2026-12-25', '2026-12-26', WITH_BRIDGE);
    const anulNou = travelWindow('2027-01-01', '2027-01-02', WITH_BRIDGE);
    expect(craciun.checkIn).toBe(anulNou.checkIn);
    expect(craciun.nights).toBe(anulNou.nights);
    expect(craciun.anchor).toEqual({ startDate: '2026-12-25', endDate: '2026-12-26' });
    expect(anulNou.anchor).toEqual({ startDate: '2027-01-01', endDate: '2027-01-02' });
  });

  it('lists every official day inside, so the stretch can be sliced into products', () => {
    const w = travelWindow('2026-12-25', '2026-12-26', WITH_BRIDGE);
    const names = [...new Set(w.spans.map((o) => o.name))];
    expect(names).toEqual(expect.arrayContaining(['Craciunul', 'Anul Nou']));
    expect(w.why).toMatch(/spans .*Craciunul.*Anul Nou/);
  });
});
