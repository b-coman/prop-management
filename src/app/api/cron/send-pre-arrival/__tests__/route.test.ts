/** @jest-environment node */

// "I don't want any email to be missed" is the requirement, so these test the MISSES: the guest
// with no address, the one already sent to, the failed send that must retry, and the catch-up
// after a run that never happened.
jest.mock('@/lib/firebaseAdminSafe', () => ({
  getAdminDb: jest.fn(),
  FieldValue: { serverTimestamp: () => 'ts' },
}));
jest.mock('@/lib/logger', () => ({
  loggers: { email: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } },
}));
const sendPreArrivalEmail = jest.fn();
jest.mock('@/services/emailService', () => ({ sendPreArrivalEmail: (...a: any[]) => sendPreArrivalEmail(...a) }));
jest.mock('@/services/guestService', () => ({ isGuestUnsubscribed: jest.fn(async () => false) }));

import { GET } from '../route';
import { getAdminDb } from '@/lib/firebaseAdminSafe';

const DAY = 24 * 60 * 60 * 1000;
const at = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY);

function db(bookings: Array<[string, any]>) {
  const updates: Record<string, any> = {};
  (getAdminDb as jest.Mock).mockResolvedValue({
    collection: () => ({
      where: () => ({
        get: async () => ({
          docs: bookings.map(([id, data]) => ({
            id, data: () => data,
            ref: { update: async (u: any) => { updates[id] = u; } },
          })),
        }),
      }),
    }),
  });
  return updates;
}

const req = (qs = '') =>
  ({ headers: { get: (h: string) => (h === 'Authorization' ? 'Bearer x' : null) },
     url: `https://x/api/cron/send-pre-arrival${qs}` } as any);

const guest = (over: any = {}) => ({
  status: 'confirmed',
  checkInDate: at(1),
  guestInfo: { email: 'g@example.com', firstName: 'A' },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  sendPreArrivalEmail.mockResolvedValue({ success: true, messageId: 'm1' });
  // clearAllMocks wipes calls but KEEPS implementations, so the unsubscribe stub has to be
  // re-armed or one test leaks "unsubscribed: true" into every test after it.
  require('@/services/guestService').isGuestUnsubscribed.mockResolvedValue(false);
});

describe('pre-arrival cron', () => {
  it('rejects a request that is neither Cloud Scheduler nor bearer-authed', async () => {
    const res = await GET({ headers: { get: () => null }, url: 'https://x/' } as any);
    expect(res.status).toBe(401);
  });

  it('sends for a booking checking in tomorrow, and stamps it only then', async () => {
    const updates = db([['b1', guest()]]);
    const body = await (await GET(req())).json();
    expect(body.sent).toBe(1);
    expect(sendPreArrivalEmail).toHaveBeenCalledWith('b1');
    expect(updates.b1).toEqual({ preArrivalSentAt: 'ts' });
  });

  it('NEVER attempts a guest with no email — every OTA import lands without one', async () => {
    const updates = db([['b1', guest({ guestInfo: { firstName: 'A' } })]]);
    const body = await (await GET(req())).json();
    expect(sendPreArrivalEmail).not.toHaveBeenCalled();
    expect(body.sent).toBe(0);
    expect(updates.b1).toBeUndefined();
    expect(body.results[0].skipped).toMatch(/no guest email/);
  });

  it('does not send twice — the stamp is the cursor', async () => {
    db([['b1', guest({ preArrivalSentAt: 'ts' })]]);
    const body = await (await GET(req())).json();
    expect(sendPreArrivalEmail).not.toHaveBeenCalled();
    expect(body.sent).toBe(0);
  });

  it('CATCHES UP on arrival day when yesterday run never happened', async () => {
    db([['b1', guest({ checkInDate: at(0) })]]);
    const body = await (await GET(req())).json();
    expect(body.sent).toBe(1);
  });

  it('leaves a failed send unstamped so tomorrow retries it', async () => {
    sendPreArrivalEmail.mockResolvedValue({ success: false, error: 'resend down' });
    const updates = db([['b1', guest()]]);
    const body = await (await GET(req())).json();
    expect(body.failed).toBe(1);
    expect(updates.b1).toBeUndefined();
  });

  it('ignores bookings outside the window', async () => {
    db([['b1', guest({ checkInDate: at(5) })], ['b2', guest({ checkInDate: at(-3) })]]);
    const body = await (await GET(req())).json();
    expect(body.sent).toBe(0);
    expect(body.skipped).toBe(2);
  });

  it('skips an unsubscribed guest', async () => {
    const { isGuestUnsubscribed } = require('@/services/guestService');
    (isGuestUnsubscribed as jest.Mock).mockResolvedValue(true);
    db([['b1', guest()]]);
    const body = await (await GET(req())).json();
    expect(sendPreArrivalEmail).not.toHaveBeenCalled();
    expect(body.results[0].skipped).toBe('unsubscribed');
  });

  it('dryRun reports what it would do and sends nothing', async () => {
    const updates = db([['b1', guest()]]);
    const body = await (await GET(req('?dryRun=1'))).json();
    expect(body.dryRun).toBe(true);
    expect(body.sent).toBe(1);
    expect(sendPreArrivalEmail).not.toHaveBeenCalled();
    expect(updates.b1).toBeUndefined();
  });

  it('bookingId narrows the run to one booking, for testing against real data', async () => {
    db([['b1', guest()], ['b2', guest()]]);
    const body = await (await GET(req('?bookingId=b2&dryRun=1'))).json();
    expect(body.sent).toBe(1);
    expect(body.results[0].bookingId).toBe('b2');
  });
});
