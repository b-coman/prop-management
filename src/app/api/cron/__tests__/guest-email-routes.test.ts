/** @jest-environment node */

// The cron routes are wiring: authorise, name the stages they own, hand over to the sweep. The
// rules those stages obey are tested in services/__tests__/guestEmailSweep.test.ts. What is worth
// testing here is that each route is pointed at the right stages — a route wired to the wrong
// stage would send the wrong email to every guest, and nothing else would catch it.
jest.mock('@/services/guestEmailSweep', () => ({ runGuestEmailSweep: jest.fn() }));
jest.mock('@/lib/logger', () => ({
  loggers: {
    email: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    guest: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  },
}));
jest.mock('@/config/growth-engine', () => ({ isGrowthEngineEnabled: () => false }));
jest.mock('@/services/guestLifecycleService', () => ({ runChannelAwareReactivation: jest.fn() }));

import { runGuestEmailSweep } from '@/services/guestEmailSweep';
import { GET as preArrival } from '../send-pre-arrival/route';
import { GET as reviewRequests } from '../send-review-requests/route';
import { GET as sequences } from '../guest-email-sequences/route';

const authed = (path: string, qs = '') =>
  ({ headers: { get: (h: string) => (h === 'Authorization' ? 'Bearer x' : null) },
     url: `https://x/api/cron/${path}${qs}` } as any);
const anonymous = { headers: { get: () => null }, url: 'https://x/' } as any;

const stageIds = () =>
  (runGuestEmailSweep as jest.Mock).mock.calls[0][0].map((s: any) => s.id);
const options = () => (runGuestEmailSweep as jest.Mock).mock.calls[0][1];

beforeEach(() => {
  jest.clearAllMocks();
  (runGuestEmailSweep as jest.Mock).mockResolvedValue({ ok: true, sent: 0, entries: [] });
});

describe.each([
  ['send-pre-arrival', preArrival],
  ['send-review-requests', reviewRequests],
  ['guest-email-sequences', sequences],
])('%s', (_name, handler) => {
  it('rejects a request that is neither Cloud Scheduler nor bearer-authed', async () => {
    const res = await handler(anonymous);
    expect(res.status).toBe(401);
    expect(runGuestEmailSweep).not.toHaveBeenCalled();
  });
});

describe('stage wiring', () => {
  it('send-pre-arrival owns only the pre-arrival email', async () => {
    await preArrival(authed('send-pre-arrival'));
    expect(stageIds()).toEqual(['pre-arrival']);
  });

  it('send-review-requests owns only the review request', async () => {
    await reviewRequests(authed('send-review-requests'));
    expect(stageIds()).toEqual(['review-request']);
  });

  it('guest-email-sequences owns the two post-stay marketing emails', async () => {
    await sequences(authed('guest-email-sequences'));
    expect(stageIds()).toEqual(['return-incentive', 'seasonal-reminder']);
  });

  it('every stage is owned by exactly one route, so none is orphaned or sent twice', async () => {
    await preArrival(authed('send-pre-arrival'));
    const a = stageIds();
    jest.clearAllMocks();
    (runGuestEmailSweep as jest.Mock).mockResolvedValue({ ok: true });
    await reviewRequests(authed('send-review-requests'));
    const b = stageIds();
    jest.clearAllMocks();
    (runGuestEmailSweep as jest.Mock).mockResolvedValue({ ok: true });
    await sequences(authed('guest-email-sequences'));
    const c = stageIds();

    const { GUEST_EMAIL_STAGES } = require('@/services/guestEmailSchedule');
    const owned = [...a, ...b, ...c];
    expect(new Set(owned).size).toBe(owned.length);
    expect(owned.sort()).toEqual(GUEST_EMAIL_STAGES.map((s: any) => s.id).sort());
  });
});

describe('query knobs', () => {
  it('passes dryRun and bookingId through', async () => {
    await preArrival(authed('send-pre-arrival', '?dryRun=1&bookingId=b2'));
    expect(options()).toMatchObject({ dryRun: true, onlyBooking: 'b2' });
  });

  it('accepts a now override on a dry run', async () => {
    await preArrival(authed('send-pre-arrival', '?dryRun=1&now=2026-10-06T10:00:00Z'));
    expect(options().now?.toISOString()).toBe('2026-10-06T10:00:00.000Z');
  });

  it('IGNORES a now override on a real run — a fake date could re-send or skip a guest', async () => {
    await preArrival(authed('send-pre-arrival', '?now=2026-10-06T10:00:00Z'));
    expect(options().now).toBeUndefined();
    expect(options().dryRun).toBe(false);
  });

  it('ignores an unparseable now', async () => {
    await preArrival(authed('send-pre-arrival', '?dryRun=1&now=banana'));
    expect(options().now).toBeUndefined();
  });
});
