/**
 * The rule that decides whether a stored price is still evidence.
 *
 * It is tested on its own because three tools got three different answers from three private copies
 * of it, and each disagreement was invisible from inside the tool that had it wrong.
 */
import { isSuperseded, captureDay, supersessionReason } from '../supersession';

const CHANGE = { date: '2026-09-01', fromNights: 4, note: 'Weekly 30%->25%' };

describe('isSuperseded', () => {
  it('sets aside a reading taken before the change', () => {
    expect(isSuperseded('2026-08-30T14:00:00Z', 4, CHANGE)).toBe(true);
  });

  it('keeps a reading taken after it', () => {
    expect(isSuperseded('2026-09-01T09:00:00Z', 4, CHANGE)).toBe(false);
  });

  it('keeps a same-day reading', () => {
    // The change is recorded by day, so same-day is genuinely ambiguous. Discarding it would throw
    // away the whole run made to measure the change - a far worse error than one stale comparison.
    expect(isSuperseded('2026-09-01T23:59:00Z', 7, CHANGE)).toBe(false);
  });

  it('leaves stays shorter than the change alone', () => {
    // A weekly discount cannot have moved a 2-night price, however old the reading is.
    expect(isSuperseded('2026-07-01T00:00:00Z', 2, CHANGE)).toBe(false);
    expect(isSuperseded('2026-07-01T00:00:00Z', 3, CHANGE)).toBe(false);
    expect(isSuperseded('2026-07-01T00:00:00Z', 4, CHANGE)).toBe(true);
  });

  it('says no when no change has been recorded, rather than guessing', () => {
    expect(isSuperseded('2020-01-01T00:00:00Z', 30, undefined)).toBe(false);
  });

  it('refuses to judge an undated reading', () => {
    expect(isSuperseded(null, 7, CHANGE)).toBe(false);
    expect(isSuperseded({}, 7, CHANGE)).toBe(false);
  });
});

describe('captureDay reads all three shapes Firestore returns', () => {
  it('ISO string', () => expect(captureDay('2026-08-30T14:00:00Z')).toBe('2026-08-30'));
  it('Timestamp-like', () => expect(captureDay({ _seconds: 1788098400 })).toBe('2026-08-30'));
  it('Date', () => expect(captureDay(new Date('2026-08-30T14:00:00Z'))).toBe('2026-08-30'));
  it('a Timestamp with toDate', () =>
    expect(captureDay({ toDate: () => new Date('2026-08-30T14:00:00Z') })).toBe('2026-08-30'));
  it('anything else is empty, not a wrong date', () => expect(captureDay(undefined)).toBe(''));
});

describe('supersessionReason', () => {
  it('names the date and the change, in the owner\'s own words', () => {
    expect(supersessionReason(CHANGE)).toBe('predates your own change of 2026-09-01 (Weekly 30%->25%)');
  });
});
