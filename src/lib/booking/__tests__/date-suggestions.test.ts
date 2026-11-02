/** @jest-environment node */

import { buildDateSuggestions, isRangeAvailable } from '../date-suggestions';

const d = (iso: string) => {
  const [y, m, day] = iso.split('-').map(Number);
  return new Date(y, m - 1, day);
};
const days = (...isos: string[]) => isos.map(d);
const TODAY = d('2026-08-06');
const fmt = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
const shape = (s: { checkIn: Date; checkOut: Date; nights: number; reason: string }) =>
  `${fmt(s.checkIn)}→${fmt(s.checkOut)}:${s.nights}:${s.reason}`;

describe('isRangeAvailable', () => {
  it('excludes the checkout day — a stay may end where the next booking starts', () => {
    // The 5th is occupied; checking out ON the 5th does not use that night.
    expect(isRangeAvailable(d('2026-09-03'), d('2026-09-05'), days('2026-09-05'))).toBe(true);
    expect(isRangeAvailable(d('2026-09-03'), d('2026-09-06'), days('2026-09-05'))).toBe(false);
  });

  it('rejects empty and inverted ranges', () => {
    expect(isRangeAvailable(d('2026-09-03'), d('2026-09-03'), [])).toBe(false);
    expect(isRangeAvailable(d('2026-09-05'), d('2026-09-03'), [])).toBe(false);
  });
});

describe('buildDateSuggestions — unavailable dates', () => {
  it('proposes the EARLIER window when it is nearer than the later one', () => {
    // Requested Mon 17→Wed 19 (a weekday ask; weekends have their own rule below). Blocked 13..24.
    // The old forward-only search could only ever answer "25th"; 11→13 is two days closer.
    const out = buildDateSuggestions({
      checkIn: d('2026-08-17'),
      checkOut: d('2026-08-19'),
      unavailableDates: days(
        '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16', '2026-08-17', '2026-08-18',
        '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23', '2026-08-24'
      ),
      minStay: 2,
      today: TODAY,
    });

    expect(out.length).toBeGreaterThan(0);
    expect(out[0].reason).toBe('earlier-window');
    expect(shape(out[0])).toBe('2026-08-11→2026-08-13:2:earlier-window');
    // and the forward option is still offered, just ranked below
    expect(out.some((s) => s.reason === 'later-window')).toBe(true);
  });

  it('offers a shorter stay on the guest\'s own dates when the front of the window is free', () => {
    // Wants 5 nights from the 10th; the 13th onward is taken. 10→13 (3 nights) still works.
    const out = buildDateSuggestions({
      checkIn: d('2026-08-10'),
      checkOut: d('2026-08-15'),
      unavailableDates: days('2026-08-13', '2026-08-14'),
      minStay: 2,
      today: TODAY,
    });

    const shorter = out.find((s) => s.reason === 'shorter-stay');
    expect(shorter).toBeDefined();
    expect(shape(shorter!)).toBe('2026-08-10→2026-08-13:3:shorter-stay');
    expect(out[0].reason).toBe('shorter-stay'); // distance 0 — it keeps their start date
  });

  it('suppresses a shorter stay that keeps too little of the requested trip', () => {
    // Wants 5 nights from the 17th; only the first night is free. 1-of-5 is a different trip, and
    // because it keeps their start date it would otherwise outrank two real 5-night windows.
    const out = buildDateSuggestions({
      checkIn: d('2026-09-17'),
      checkOut: d('2026-09-22'),
      unavailableDates: days('2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21'),
      minStay: 1,
      today: TODAY,
    });

    expect(out.some((s) => s.reason === 'shorter-stay')).toBe(false);
    expect(out.every((s) => s.nights === 5)).toBe(true);
    expect(out.map((s) => s.reason)).toEqual(['earlier-window', 'later-window']);
  });

  it('keeps a shorter stay that retains at least half the trip', () => {
    // 3 of 5 nights is still the same weekend away.
    const out = buildDateSuggestions({
      checkIn: d('2026-08-10'),
      checkOut: d('2026-08-15'),
      unavailableDates: days('2026-08-13', '2026-08-14'),
      minStay: 2,
      today: TODAY,
    });
    expect(out.find((s) => s.reason === 'shorter-stay')?.nights).toBe(3);
  });

  it('never proposes a stay shorter than the minimum', () => {
    // Only 1 night free at the front, but minStay is 2 — so no shorter-stay option.
    const out = buildDateSuggestions({
      checkIn: d('2026-08-10'),
      checkOut: d('2026-08-15'),
      unavailableDates: days('2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14'),
      minStay: 2,
      today: TODAY,
    });
    expect(out.every((s) => s.nights >= 2)).toBe(true);
    expect(out.some((s) => s.reason === 'shorter-stay')).toBe(false);
  });

  it('never proposes dates in the past', () => {
    const out = buildDateSuggestions({
      checkIn: d('2026-08-08'),
      checkOut: d('2026-08-10'),
      unavailableDates: days('2026-08-08', '2026-08-09'),
      minStay: 2,
      today: TODAY, // 2026-08-06
    });
    expect(out.every((s) => s.checkIn >= TODAY)).toBe(true);
  });

  it('returns an empty list rather than inventing something when nothing fits', () => {
    const everyNight = Array.from({ length: 200 }, (_, i) => {
      const x = new Date(2026, 7, 1);
      x.setDate(x.getDate() + i);
      return x;
    });
    const out = buildDateSuggestions({
      checkIn: d('2026-08-14'),
      checkOut: d('2026-08-16'),
      unavailableDates: everyNight,
      minStay: 2,
      today: TODAY,
    });
    expect(out).toEqual([]);
  });

  it('respects the search horizon', () => {
    // Everything blocked for the next 120 days; a 10-day horizon must find nothing.
    const blocked = Array.from({ length: 120 }, (_, i) => {
      const x = new Date(2026, 7, 10);
      x.setDate(x.getDate() + i);
      return x;
    });
    const out = buildDateSuggestions({
      checkIn: d('2026-08-14'),
      checkOut: d('2026-08-16'),
      unavailableDates: blocked,
      minStay: 2,
      today: d('2026-08-13'), // so earlier windows are in the past too
      horizonDays: 10,
    });
    expect(out).toEqual([]);
  });

  it('caps the number of suggestions', () => {
    const out = buildDateSuggestions({
      checkIn: d('2026-09-10'),
      checkOut: d('2026-09-12'),
      unavailableDates: days('2026-09-10'),
      minStay: 2,
      today: TODAY,
      maxSuggestions: 2,
    });
    expect(out.length).toBeLessThanOrEqual(2);
  });
});

describe('buildDateSuggestions — minimum-stay shortfall', () => {
  it('offers BOTH extending the checkout and pulling the check-in earlier', () => {
    // Wants a single Saturday night (12th→13th) but the minimum is 2.
    const out = buildDateSuggestions({
      checkIn: d('2026-09-12'),
      checkOut: d('2026-09-13'),
      unavailableDates: [],
      minStay: 2,
      today: TODAY,
    });

    const reasons = out.map((s) => s.reason);
    expect(reasons).toContain('extend-to-minimum');
    expect(reasons).toContain('shift-earlier-to-minimum');

    const extend = out.find((s) => s.reason === 'extend-to-minimum')!;
    const shift = out.find((s) => s.reason === 'shift-earlier-to-minimum')!;
    expect(shape(extend)).toBe('2026-09-12→2026-09-14:2:extend-to-minimum');
    // Pulling earlier keeps the night they actually wanted (the 12th) inside the stay.
    expect(shape(shift)).toBe('2026-09-11→2026-09-13:2:shift-earlier-to-minimum');
    expect(out[0].reason).toBe('extend-to-minimum'); // distance 0 ranks first
  });

  it('drops the extend option when the extra night is already taken, keeping the shift', () => {
    const out = buildDateSuggestions({
      checkIn: d('2026-09-12'),
      checkOut: d('2026-09-13'),
      unavailableDates: days('2026-09-13'), // the night after is booked
      minStay: 2,
      today: TODAY,
    });

    expect(out.some((s) => s.reason === 'extend-to-minimum')).toBe(false);
    expect(out.some((s) => s.reason === 'shift-earlier-to-minimum')).toBe(true);
  });

  it('never returns the exact range the guest already asked for', () => {
    const out = buildDateSuggestions({
      checkIn: d('2026-09-12'),
      checkOut: d('2026-09-14'),
      unavailableDates: [],
      minStay: 2,
      today: TODAY,
    });
    expect(out.every((s) => shape(s).split(':')[0] !== '2026-09-12→2026-09-14')).toBe(true);
  });
});

describe('buildDateSuggestions — a weekend that is taken', () => {
  // The chalet's real autumn 2026: nights of 30-31 Oct, 2-8 Nov and 14 Nov are booked.
  const booked = days(
    '2026-10-30', '2026-10-31',
    '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08',
    '2026-11-14',
  );
  const nationalDay = { '2026-11-27': 3, '2026-11-28': 3, '2026-11-29': 3, '2026-11-30': 3 };

  it('offers the next free weekends first, in date order, instead of Mon-Wed', () => {
    // Fri 30 Oct -> Sun 1 Nov is taken. 6-8 Nov and 13-15 Nov are too. Before this, the only offer was
    // Mon 9 -> Wed 11 Nov ("just after").
    const out = buildDateSuggestions({
      checkIn: d('2026-10-30'), checkOut: d('2026-11-01'), unavailableDates: booked, minStay: 2, today: d('2026-10-29'),
    });
    expect(out.map(shape)).toEqual([
      '2026-11-20→2026-11-22:2:weekend',
      '2026-11-27→2026-11-29:2:weekend',
      '2026-12-04→2026-12-06:2:weekend',
    ]);
  });

  it('grows a weekend to the minimum stay of the nights it lands on', () => {
    // 27-29 Nov sits in a 3-night holiday period: offering 2 nights would fail on the next tap.
    const out = buildDateSuggestions({
      checkIn: d('2026-10-30'), checkOut: d('2026-11-01'), unavailableDates: booked, minStay: 2,
      minStayByNight: nationalDay, today: d('2026-10-29'),
    });
    expect(out.map(shape)).toEqual([
      '2026-11-20→2026-11-22:2:weekend',
      '2026-11-27→2026-11-30:3:weekend',
      '2026-12-04→2026-12-06:2:weekend',
    ]);
  });

  it('includes earlier free weekends, still in date order', () => {
    const out = buildDateSuggestions({
      checkIn: d('2026-12-04'), checkOut: d('2026-12-06'),
      unavailableDates: [...booked, ...days('2026-12-04', '2026-12-05')], minStay: 2, today: d('2026-11-02'),
    });
    expect(out.map(shape)).toEqual([
      '2026-11-20→2026-11-22:2:weekend',
      '2026-11-27→2026-11-29:2:weekend',
      '2026-12-11→2026-12-13:2:weekend',
    ]);
  });

  it('fills up with the nearest dates when fewer weekends are free', () => {
    const out = buildDateSuggestions({
      checkIn: d('2026-10-30'), checkOut: d('2026-11-01'), unavailableDates: booked, minStay: 2,
      today: d('2026-10-29'), horizonDays: 21,
    });
    expect(out.map(shape)).toEqual(['2026-11-20→2026-11-22:2:weekend', '2026-11-09→2026-11-11:2:later-window']);
  });

  it('keeps their own weekend, shorter, as a weekend option', () => {
    // Fri 20 -> Mon 23 Nov with Sunday night taken: Fri-Sun of their own weekend is still free.
    const out = buildDateSuggestions({
      checkIn: d('2026-11-20'), checkOut: d('2026-11-23'),
      unavailableDates: [...booked, ...days('2026-11-22')], minStay: 2, today: d('2026-11-02'),
    });
    expect(shape(out[0])).toBe('2026-11-20→2026-11-22:2:shorter-stay');
    expect(out.slice(1).every((s) => s.reason === 'weekend')).toBe(true);
  });

  it('grows a one-night ask toward the weekend', () => {
    // Saturday 14 Nov alone is taken and below the 2-night minimum: offer Fri-Sun, not Sat-Mon.
    const saturday = buildDateSuggestions({
      checkIn: d('2026-11-14'), checkOut: d('2026-11-15'), unavailableDates: booked, minStay: 2, today: d('2026-11-02'),
    });
    expect(shape(saturday[0])).toBe('2026-11-20→2026-11-22:2:weekend');
    // Friday 6 Nov alone: Fri-Sun, not Thu-Sat.
    const friday = buildDateSuggestions({
      checkIn: d('2026-11-06'), checkOut: d('2026-11-07'), unavailableDates: booked, minStay: 2, today: d('2026-11-02'),
    });
    expect(shape(friday[0])).toBe('2026-11-20→2026-11-22:2:weekend');
  });

  it('leaves weekday asks and long stays to the nearest-window search', () => {
    const weekday = buildDateSuggestions({
      checkIn: d('2026-11-03'), checkOut: d('2026-11-05'), unavailableDates: booked, minStay: 2, today: d('2026-10-29'),
    });
    expect(weekday.some((s) => s.reason === 'weekend')).toBe(false);

    const fiveNights = buildDateSuggestions({
      checkIn: d('2026-10-30'), checkOut: d('2026-11-04'), unavailableDates: booked, minStay: 2, today: d('2026-10-29'),
    });
    expect(fiveNights.some((s) => s.reason === 'weekend')).toBe(false);
  });

  it('does not switch on for a free weekend that is only too short', () => {
    // Sat 21 -> Sun 22 Nov is free but 1 night: the answer is the same weekend, made longer.
    const out = buildDateSuggestions({
      checkIn: d('2026-11-21'), checkOut: d('2026-11-22'), unavailableDates: booked, minStay: 2, today: d('2026-11-02'),
    });
    expect(out.some((s) => s.reason === 'weekend')).toBe(false);
    expect(out[0].reason).toBe('extend-to-minimum');
  });
});

describe('buildDateSuggestions — per-night minimum stay', () => {
  const nationalDay = { '2026-11-27': 3, '2026-11-28': 3, '2026-11-29': 3, '2026-11-30': 3 };

  it('uses the strictest night of the stay, not the property default', () => {
    // Sun 29 Nov -> Tue 1 Dec is 2 nights inside a 3-night period. With only the default (2) known,
    // the page offered nothing that fixed it.
    const out = buildDateSuggestions({
      checkIn: d('2026-11-29'), checkOut: d('2026-12-01'), unavailableDates: [], minStay: 2,
      minStayByNight: nationalDay, today: d('2026-11-02'),
    });
    expect(out.map(shape)).toContain('2026-11-29→2026-12-02:3:extend-to-minimum');
    expect(out.map(shape)).toContain('2026-11-28→2026-12-01:3:shift-earlier-to-minimum');
  });

  it('never proposes a stay that breaks a stricter night inside it', () => {
    const out = buildDateSuggestions({
      checkIn: d('2026-11-23'), checkOut: d('2026-11-25'), unavailableDates: days('2026-11-23', '2026-11-24'),
      minStay: 2, minStayByNight: nationalDay, today: d('2026-11-02'),
    });
    for (const s of out) {
      const strictest = Math.max(2, ...Array.from({ length: s.nights }, (_, i) => {
        const x = new Date(s.checkIn); x.setDate(x.getDate() + i);
        return (nationalDay as Record<string, number>)[fmt(x)] ?? 0;
      }));
      expect(s.nights).toBeGreaterThanOrEqual(strictest);
    }
  });
});
