import {
  parseAmPmTime,
  resolvePropertyTime,
  propertyDateAt,
  formatBucharestDate,
  getBucharestDay,
  getBucharestMonth,
  getBucharestHourMinute,
  formatBucharestDateTime,
  iterateBucharestStayDays,
} from './property-times';

describe('parseAmPmTime', () => {
  test.each([
    ['3:00 PM',   { hours: 15, minutes: 0 }],
    ['11:00 AM',  { hours: 11, minutes: 0 }],
    ['2:00 PM',   { hours: 14, minutes: 0 }],
    ['12:00 PM',  { hours: 12, minutes: 0 }],   // noon
    ['12:00 AM',  { hours: 0,  minutes: 0 }],   // midnight
    ['12:30 AM',  { hours: 0,  minutes: 30 }],
    ['11:30 PM',  { hours: 23, minutes: 30 }],
    ['3PM',       { hours: 15, minutes: 0 }],
    ['3:00pm',    { hours: 15, minutes: 0 }],
    [' 3:00 PM ', { hours: 15, minutes: 0 }],
  ])('parses %s', (input, expected) => {
    expect(parseAmPmTime(input)).toEqual(expected);
  });

  test.each([null, undefined, '', 'banana', '13:00 PM', '00:00 AM', '3:60 PM', '3:00'])(
    'rejects %s',
    (input) => {
      expect(parseAmPmTime(input as any)).toBeNull();
    }
  );
});

describe('resolvePropertyTime', () => {
  test('uses property fields when present and parseable', () => {
    expect(resolvePropertyTime({ checkInTime: '3:00 PM', checkOutTime: '11:00 AM' }, 'checkin')).toEqual({ hours: 15, minutes: 0 });
    expect(resolvePropertyTime({ checkInTime: '3:00 PM', checkOutTime: '11:00 AM' }, 'checkout')).toEqual({ hours: 11, minutes: 0 });
  });
  test('falls back to default when missing', () => {
    expect(resolvePropertyTime(null, 'checkin')).toEqual({ hours: 14, minutes: 0 });
    expect(resolvePropertyTime(undefined, 'checkout')).toEqual({ hours: 11, minutes: 0 });
    expect(resolvePropertyTime({}, 'checkin')).toEqual({ hours: 14, minutes: 0 });
  });
  test('falls back when garbage', () => {
    expect(resolvePropertyTime({ checkInTime: 'banana' }, 'checkin')).toEqual({ hours: 14, minutes: 0 });
  });
});

describe('propertyDateAt — DST handling', () => {
  const summer = { checkInTime: '2:00 PM', checkOutTime: '12:00 PM' }; // coltei

  test('summer (EEST, UTC+3): 14:00 Bucharest = 11:00 UTC', () => {
    const d = propertyDateAt(summer, '2026-05-22', 'checkin');
    expect(d.toISOString()).toBe('2026-05-22T11:00:00.000Z');
  });

  test('summer (EEST, UTC+3): 12:00 Bucharest = 09:00 UTC', () => {
    const d = propertyDateAt(summer, '2026-05-24', 'checkout');
    expect(d.toISOString()).toBe('2026-05-24T09:00:00.000Z');
  });

  test('winter (EET, UTC+2): 14:00 Bucharest = 12:00 UTC', () => {
    const d = propertyDateAt(summer, '2026-01-22', 'checkin');
    expect(d.toISOString()).toBe('2026-01-22T12:00:00.000Z');
  });

  test('winter (EET, UTC+2): 12:00 Bucharest = 10:00 UTC', () => {
    const d = propertyDateAt(summer, '2026-02-15', 'checkout');
    expect(d.toISOString()).toBe('2026-02-15T10:00:00.000Z');
  });

  test('day after spring-forward (March 29 2026): 14:00 Bucharest = 11:00 UTC', () => {
    const d = propertyDateAt(summer, '2026-03-30', 'checkin');
    expect(d.toISOString()).toBe('2026-03-30T11:00:00.000Z');
  });

  test('day after fall-back (October 26 2025): 14:00 Bucharest = 12:00 UTC', () => {
    const d = propertyDateAt(summer, '2025-10-27', 'checkin');
    expect(d.toISOString()).toBe('2025-10-27T12:00:00.000Z');
  });

  test('prahova property values: 3:00 PM / 11:00 AM', () => {
    const prahova = { checkInTime: '3:00 PM', checkOutTime: '11:00 AM' };
    expect(propertyDateAt(prahova, '2026-05-22', 'checkin').toISOString()).toBe('2026-05-22T12:00:00.000Z');
    expect(propertyDateAt(prahova, '2026-05-24', 'checkout').toISOString()).toBe('2026-05-24T08:00:00.000Z');
  });

  test('throws on bad date string', () => {
    expect(() => propertyDateAt(summer, 'banana', 'checkin')).toThrow();
    expect(() => propertyDateAt(summer, '2026-05', 'checkin')).toThrow();
  });
});

describe('formatBucharestDate', () => {
  test('UTC midnight (legacy guest-flow convention) reads as next-day in Bucharest summer', () => {
    // 2026-05-22T00:00:00Z = 2026-05-22T03:00 EEST (still May 22)
    const d = new Date('2026-05-22T00:00:00.000Z');
    expect(formatBucharestDate(d)).toBe('2026-05-22');
  });
  test('Bucharest-midnight legacy convention reads as the intended day', () => {
    // 2026-05-21T21:00:00Z = 2026-05-22T00:00 EEST
    const d = new Date('2026-05-21T21:00:00.000Z');
    expect(formatBucharestDate(d)).toBe('2026-05-22');
  });
  test('post-migration timestamp reads correctly', () => {
    // 14:00 Bucharest summer = 11:00 UTC
    const d = new Date('2026-05-22T11:00:00.000Z');
    expect(formatBucharestDate(d)).toBe('2026-05-22');
  });
  test('day-boundary edge case: 23:59:59 UTC summer is next day in Bucharest', () => {
    const d = new Date('2026-05-22T23:59:59.000Z');
    expect(formatBucharestDate(d)).toBe('2026-05-23');
  });
});

describe('getBucharestDay / getBucharestMonth', () => {
  test('Ivan-style legacy (Bucharest-midnight, EEST)', () => {
    const checkIn = new Date('2026-05-21T21:00:00.000Z');
    expect(getBucharestDay(checkIn)).toBe(22);
    expect(getBucharestMonth(checkIn)).toBe('2026-05');
  });
  test('Paul-style legacy (UTC-midnight)', () => {
    const checkIn = new Date('2026-05-17T00:00:00.000Z');
    expect(getBucharestDay(checkIn)).toBe(17);
    expect(getBucharestMonth(checkIn)).toBe('2026-05');
  });
  test('post-migration (real time)', () => {
    const checkIn = new Date('2026-05-22T11:00:00.000Z');
    expect(getBucharestDay(checkIn)).toBe(22);
  });
  test('handles hour-24 quirk (midnight in Bucharest)', () => {
    // 22:00 UTC winter = 00:00 Bucharest next day
    const d = new Date('2026-01-21T22:00:00.000Z');
    expect(formatBucharestDate(d)).toBe('2026-01-22');
    expect(getBucharestHourMinute(d)).toEqual({ hour: 0, minute: 0 });
  });
});

describe('formatBucharestDateTime', () => {
  test('formats with date-fns pattern in Bucharest TZ', () => {
    const d = new Date('2026-05-22T11:00:00.000Z'); // 14:00 Bucharest summer
    expect(formatBucharestDateTime(d, 'yyyy-MM-dd')).toBe('2026-05-22');
    expect(formatBucharestDateTime(d, 'HH:mm')).toBe('14:00');
  });
  test('legacy Bucharest-midnight booking shows correct day', () => {
    const d = new Date('2026-05-21T21:00:00.000Z'); // 00:00 Bucharest May 22
    expect(formatBucharestDateTime(d, 'yyyy-MM-dd')).toBe('2026-05-22');
  });
});

describe('iterateBucharestStayDays', () => {
  test('Ivan: 2026-05-22 → 2026-05-24 (legacy Bucharest-midnight) yields days 22, 23', () => {
    const checkIn = new Date('2026-05-21T21:00:00.000Z');
    const checkOut = new Date('2026-05-23T21:00:00.000Z');
    const days = [...iterateBucharestStayDays(checkIn, checkOut)];
    expect(days.map(d => d.day)).toEqual([22, 23]);
    expect(days.every(d => d.monthKey === '2026-05')).toBe(true);
  });

  test('Paul: 2026-05-17 → 2026-05-21 (UTC-midnight) yields days 17, 18, 19, 20', () => {
    const checkIn = new Date('2026-05-17T00:00:00.000Z');
    const checkOut = new Date('2026-05-21T00:00:00.000Z');
    const days = [...iterateBucharestStayDays(checkIn, checkOut)];
    expect(days.map(d => d.day)).toEqual([17, 18, 19, 20]);
  });

  test('post-migration real-time: 14:00 Bucharest May 22 → 12:00 May 24 yields days 22, 23', () => {
    const checkIn = new Date('2026-05-22T11:00:00.000Z');
    const checkOut = new Date('2026-05-24T09:00:00.000Z');
    const days = [...iterateBucharestStayDays(checkIn, checkOut)];
    expect(days.map(d => d.day)).toEqual([22, 23]);
  });

  test('multi-month stay', () => {
    const checkIn = new Date('2026-05-30T11:00:00.000Z');
    const checkOut = new Date('2026-06-02T09:00:00.000Z');
    const days = [...iterateBucharestStayDays(checkIn, checkOut)];
    expect(days.map(d => `${d.monthKey}:${d.day}`)).toEqual([
      '2026-05:30', '2026-05:31', '2026-06:1',
    ]);
  });

  test('DST-spanning stay (March 2026 spring-forward)', () => {
    // 14:00 Bucharest March 27 (EET, UTC+2) → 12:00 Bucharest March 30 (EEST, UTC+3)
    // March 28→29 transition: 03:00 EET becomes 04:00 EEST
    const checkIn = new Date('2026-03-27T12:00:00.000Z'); // 14:00 EET
    const checkOut = new Date('2026-03-30T09:00:00.000Z'); // 12:00 EEST
    const days = [...iterateBucharestStayDays(checkIn, checkOut)];
    expect(days.map(d => d.day)).toEqual([27, 28, 29]);
  });

  test('zero-night booking (checkOut == checkIn)', () => {
    const d = new Date('2026-05-22T11:00:00.000Z');
    expect([...iterateBucharestStayDays(d, d)]).toEqual([]);
  });
});
