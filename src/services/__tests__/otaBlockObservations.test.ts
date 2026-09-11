/**
 * Grouping is where a wrong answer is most expensive: it turns rows into the reservation COUNT the
 * ad loop reads. Both cases below are real failures this store produced on its first day live.
 */
import { groupIntoReservations, type OtaBlockObservation } from '../otaBlockObservations';

const row = (o: Partial<OtaBlockObservation>): OtaBlockObservation => ({
  cellId: 'x', propertyId: 'p', date: '2026-10-24', feedId: 'f-booking', feedName: 'Booking.com',
  event: 'appeared', kind: 'reservation', capturedAt: '2026-09-10T12:00:00Z', createdAt: null, ...o,
});

describe('groupIntoReservations', () => {
  it('folds the nights of one reservation into a single booking', () => {
    const g = groupIntoReservations([
      row({ date: '2026-10-24', uid: 'a' }), row({ date: '2026-10-25', uid: 'a' }),
      row({ date: '2026-10-26', uid: 'a' }), row({ date: '2026-10-27', uid: 'a' }),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].nights).toEqual(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']);
  });

  it('does NOT join two far-apart nights just because one sync saw both', () => {
    // The real failure: 2027-09-05 and 2028-03-10 became one "2-night stay" because the fallback
    // key was the capture instant.
    const g = groupIntoReservations([
      row({ date: '2027-09-05', uid: undefined }), row({ date: '2028-03-10', uid: undefined }),
    ]);
    expect(g).toHaveLength(2);
  });

  it('joins consecutive nights that have no uid', () => {
    const g = groupIntoReservations([
      row({ date: '2026-10-24', uid: undefined }), row({ date: '2026-10-25', uid: undefined }),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].nights).toHaveLength(2);
  });

  it('ignores closed-inventory blocks entirely', () => {
    // Booking.com's rolling horizon. Counting these was the phantom-booking bug.
    const g = groupIntoReservations([
      row({ date: '2027-09-06', kind: 'blocked', uid: 'horizon', eventNights: 551 }),
      row({ date: '2026-10-24', kind: 'reservation', uid: 'real' }),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].uid).toBe('real');
  });

  it('can be asked for the other kinds deliberately', () => {
    const g = groupIntoReservations([row({ kind: 'blocked', uid: 'h' })], ['blocked']);
    expect(g).toHaveLength(1);
  });

  it('treats a row with no kind as unknown, not as a reservation', () => {
    const legacy = { ...row({ uid: 'old' }) } as OtaBlockObservation;
    delete (legacy as { kind?: unknown }).kind;
    expect(groupIntoReservations([legacy])).toHaveLength(0);
    expect(groupIntoReservations([legacy], ['unknown'])).toHaveLength(1);
  });

  it('ignores releases when counting reservations', () => {
    expect(groupIntoReservations([row({ event: 'released' })])).toHaveLength(0);
  });

  it('keeps two different reservations apart even on touching dates', () => {
    const g = groupIntoReservations([
      row({ date: '2026-10-24', uid: 'a' }), row({ date: '2026-10-25', uid: 'b' }),
    ]);
    expect(g).toHaveLength(2);
  });
});
