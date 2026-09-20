/** @jest-environment node */

import { weekendStarts } from '../openWeekends';
import { format } from 'date-fns';

const d = (s: string) => new Date(`${s}T00:00:00`);
// date-fns `format` reads LOCAL date parts, which is what `findOpenWeekends` itself uses to build
// the card's `start`. `toISOString()` would convert to UTC and, at +0300, report local midnight as
// the previous day — the test would then be asserting something production never produces.
const iso = (x: Date) => format(x, 'yyyy-MM-dd');

describe('weekendStarts', () => {
  it('returns the Fridays in the window', () => {
    // 2026-10-02, -09, -16, -23, -30 are Fridays.
    expect(weekendStarts(d('2026-10-01'), d('2026-10-31'), 5, d('2026-09-20')).map(iso))
      .toEqual(['2026-10-02', '2026-10-09', '2026-10-16', '2026-10-23', '2026-10-30']);
  });

  it('NEVER offers a date that has already started', () => {
    // The bug this guards: on 20 Sep the live page was still advertising a 14 Sep check-in. Asking
    // from the 1st while standing on the 20th must start at the next Friday, not the first one.
    const got = weekendStarts(d('2026-09-01'), d('2026-09-30'), 5, d('2026-09-20')).map(iso);
    expect(got).toEqual(['2026-09-25']);
    expect(got.some((x) => x < '2026-09-20')).toBe(false);
  });

  it('starts from `from` when `from` is still in the future', () => {
    expect(weekendStarts(d('2026-11-01'), d('2026-11-30'), 5, d('2026-09-20')).map(iso))
      .toEqual(['2026-11-06', '2026-11-13', '2026-11-20', '2026-11-27']);
  });

  it('includes a Friday that is today — the weekend has not started yet', () => {
    // 2026-10-02 is a Friday. Standing on it, that evening is still sellable.
    expect(weekendStarts(d('2026-10-01'), d('2026-10-09'), 5, d('2026-10-02')).map(iso))
      .toEqual(['2026-10-02', '2026-10-09']);
  });

  it('is empty when the window has already passed', () => {
    expect(weekendStarts(d('2026-08-01'), d('2026-08-31'), 5, d('2026-09-20'))).toEqual([]);
  });

  it('takes a weekday other than Friday, so a midweek variant needs no new function', () => {
    // 1 = Monday.
    expect(weekendStarts(d('2026-10-01'), d('2026-10-20'), 1, d('2026-09-20')).map(iso))
      .toEqual(['2026-10-05', '2026-10-12', '2026-10-19']);
  });
});
