/** @jest-environment node */

// "I don't want any email to be missed" is the requirement, so these test the MISSES: the guest
// with no address, the OTA guest we promised not to email, the one already sent to, the failed
// send that must retry, and the catch-up after a run that never happened.
//
// These rules used to live in three cron routes and disagreed with each other. They live here now,
// so they are tested once.
jest.mock('@/lib/firebaseAdminSafe', () => ({
  getAdminDb: jest.fn(),
  FieldValue: { serverTimestamp: () => 'ts' },
}));
jest.mock('@/lib/logger', () => ({
  loggers: { email: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } },
}));
jest.mock('@/services/guestService', () => ({ isGuestUnsubscribed: jest.fn(async () => false) }));

import { runGuestEmailSweep } from '@/services/guestEmailSweep';
import type { GuestEmailStage } from '@/services/guestEmailSchedule';
import { getAdminDb } from '@/lib/firebaseAdminSafe';

const DAY = 86400000;
const at = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY);

/** A booking that every rule should admit, so each test changes exactly one thing. */
const guest = (over: any = {}) => ({
  status: 'confirmed',
  source: 'direct',
  checkInDate: at(1),
  guestInfo: { email: 'g@example.com', firstName: 'A' },
  ...over,
});

const updates: Record<string, any> = {};
function db(bookings: Array<[string, any]>, extra: Record<string, any> = {}) {
  for (const k of Object.keys(updates)) delete updates[k];
  const chain = (get: any) => {
    const self: any = { where: () => self, limit: () => self, get };
    return self;
  };
  (getAdminDb as jest.Mock).mockResolvedValue({
    collection: (name: string) => {
      if (name === 'bookings') {
        return chain(async () => ({
          size: bookings.length,
          docs: bookings.map(([id, data]) => ({
            id,
            data: () => data,
            ref: { update: async (u: any) => { updates[id] = u; } },
          })),
        }));
      }
      return { ...chain(async () => extra[name] ?? { empty: true, docs: [] }), add: jest.fn() };
    },
  });
  return updates;
}

/** A stage with no I/O of its own, so these tests exercise the sweep and nothing else. */
const send = jest.fn();
const STAGE: GuestEmailStage = {
  id: 'test-stage',
  anchor: 'checkInDate',
  offsets: [-1, 0],
  statuses: ['confirmed'],
  stamp: 'testSentAt',
  kind: 'transactional',
  audience: 'direct-only',
  send: (...a) => send(...a),
};

beforeEach(() => {
  jest.clearAllMocks();
  send.mockResolvedValue({ success: true, messageId: 'm1' });
  // clearAllMocks wipes calls but KEEPS implementations, so the unsubscribe stub has to be
  // re-armed or one test leaks "unsubscribed: true" into every test after it.
  require('@/services/guestService').isGuestUnsubscribed.mockResolvedValue(false);
});

const run = (opts = {}) => runGuestEmailSweep([STAGE], opts);

describe('runGuestEmailSweep', () => {
  it('sends for a booking inside the window, and stamps it only then', async () => {
    const u = db([['b1', guest()]]);
    const r = await run();
    expect(r.sent).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(u.b1).toEqual({ testSentAt: 'ts' });
  });

  it('NEVER attempts a guest with no email — every OTA import lands without one', async () => {
    const u = db([['b1', guest({ guestInfo: { firstName: 'A' } })]]);
    const r = await run();
    expect(send).not.toHaveBeenCalled();
    expect(u.b1).toBeUndefined();
    expect(r.entries[0].skipped).toBe('no guest email');
  });

  it('NEVER writes to an OTA guest, even when the import carried an email address', async () => {
    // The rule used to hold only because OTA imports arrive without an address. This is the rule.
    const u = db([['b1', guest({ source: 'booking.com' })]]);
    const r = await run();
    expect(send).not.toHaveBeenCalled();
    expect(u.b1).toBeUndefined();
    expect(r.entries[0].skipped).toBe('audience: ota');
  });

  it('does not write to a booking whose source nobody has classified, and counts it', async () => {
    const r = await db([['b1', guest({ source: 'some-new-channel' })]]) && await run();
    expect(send).not.toHaveBeenCalled();
    expect(r.unknownSource).toBe(1);
    expect(r.entries[0].skipped).toBe('audience: unknown');
  });

  it('does not send twice — the stamp is the cursor', async () => {
    db([['b1', guest({ testSentAt: 'ts' })]]);
    const r = await run();
    expect(send).not.toHaveBeenCalled();
    expect(r.sent).toBe(0);
  });

  it('CATCHES UP on the second offset when the first run never happened', async () => {
    db([['b1', guest({ checkInDate: at(0) })]]);
    expect((await run()).sent).toBe(1);
  });

  it('leaves a failed send unstamped so the next run retries it', async () => {
    send.mockResolvedValue({ success: false, error: 'resend down' });
    const u = db([['b1', guest()]]);
    const r = await run();
    expect(r.failed).toBe(1);
    expect(u.b1).toBeUndefined();
  });

  it('survives a stage that throws, and still leaves it unstamped', async () => {
    send.mockRejectedValue(new Error('boom'));
    const u = db([['b1', guest()]]);
    const r = await run();
    expect(r.failed).toBe(1);
    expect(u.b1).toBeUndefined();
  });

  it('ignores bookings outside the window', async () => {
    db([['b1', guest({ checkInDate: at(5) })], ['b2', guest({ checkInDate: at(-3) })]]);
    const r = await run();
    expect(r.sent).toBe(0);
    expect(r.skipped).toBe(2);
  });

  it('skips an unsubscribed guest', async () => {
    require('@/services/guestService').isGuestUnsubscribed.mockResolvedValue(true);
    db([['b1', guest()]]);
    expect((await run()).entries[0].skipped).toBe('unsubscribed');
  });

  it('still sends a TRANSACTIONAL message when the unsubscribe lookup throws', async () => {
    // The guest paid for this stay; a broken lookup must not cost them their arrival details.
    require('@/services/guestService').isGuestUnsubscribed.mockRejectedValue(new Error('down'));
    db([['b1', guest()]]);
    expect((await run()).sent).toBe(1);
  });

  it('withholds a MARKETING message when the unsubscribe lookup throws', async () => {
    require('@/services/guestService').isGuestUnsubscribed.mockRejectedValue(new Error('down'));
    db([['b1', guest()]]);
    const r = await runGuestEmailSweep([{ ...STAGE, kind: 'marketing' }], {});
    expect(send).not.toHaveBeenCalled();
    expect(r.entries[0].skipped).toBe('unsubscribe check failed');
  });

  it('honours a stage precondition', async () => {
    db([['b1', guest()]]);
    const r = await runGuestEmailSweep(
      [{ ...STAGE, precondition: async () => 'review already left' }], {}
    );
    expect(send).not.toHaveBeenCalled();
    expect(r.entries[0].skipped).toBe('review already left');
  });

  it('writes the extra fields a stage returns alongside the stamp', async () => {
    send.mockResolvedValue({ success: true, alsoStamp: { returnIncentiveCouponCode: 'RETURN-ABC' } });
    const u = db([['b1', guest()]]);
    await run();
    expect(u.b1).toEqual({ testSentAt: 'ts', returnIncentiveCouponCode: 'RETURN-ABC' });
  });

  it('dryRun reports what it would do and sends nothing', async () => {
    const u = db([['b1', guest()]]);
    const r = await run({ dryRun: true });
    expect(r.dryRun).toBe(true);
    expect(r.sent).toBe(1);
    expect(send).not.toHaveBeenCalled();
    expect(u.b1).toBeUndefined();
  });

  it('bookingId narrows the run to one booking, for checking against real data', async () => {
    db([['b1', guest()], ['b2', guest()]]);
    const r = await run({ onlyBooking: 'b2', dryRun: true });
    expect(r.sent).toBe(1);
    expect(r.entries[0].bookingId).toBe('b2');
  });

  it('accepts a supplied now, so a schedule can be checked on a date no booking sits on today', async () => {
    const checkIn = new Date('2026-10-02T12:00:00Z');
    db([['b1', guest({ checkInDate: checkIn })]]);
    // The day before check-in, in Bucharest.
    expect((await run({ now: new Date('2026-10-01T06:00:00Z'), dryRun: true })).sent).toBe(1);
    expect((await run({ now: new Date('2026-09-28T06:00:00Z'), dryRun: true })).sent).toBe(0);
  });

  it('runs several stages over one pass of the bookings', async () => {
    db([['b1', guest()]]);
    const second: GuestEmailStage = { ...STAGE, id: 'second', stamp: 'secondSentAt' };
    const r = await runGuestEmailSweep([STAGE, second], { dryRun: true });
    expect(r.sent).toBe(2);
    expect(r.stages).toEqual(['test-stage', 'second']);
  });
});
