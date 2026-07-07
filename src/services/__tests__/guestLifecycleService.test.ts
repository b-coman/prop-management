/** @jest-environment node */

jest.mock('@/lib/firebaseAdminSafe', () => ({
  getAdminDb: jest.fn(),
  FieldValue: { serverTimestamp: jest.fn(() => 'ts') },
}));
jest.mock('@/services/guestService', () => ({ findGuestByPhone: jest.fn() }));
jest.mock('@/services/executionGateway', () => ({ executeSend: jest.fn() }));

import { runChannelAwareReactivation } from '../guestLifecycleService';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { findGuestByPhone } from '@/services/guestService';
import { executeSend } from '@/services/executionGateway';

const mockGetAdminDb = getAdminDb as jest.Mock;
const mockFindGuestByPhone = findGuestByPhone as jest.Mock;
const mockExecuteSend = executeSend as jest.Mock;

const NOW = new Date(Date.UTC(2026, 5, 1));
const DAY_MS = 1000 * 60 * 60 * 24;
const secondsFor = (daysAgo: number) => ({ _seconds: (NOW.getTime() - daysAgo * DAY_MS) / 1000 });

/** A completed-booking doc with a mock ref.update. */
function bookingDoc(data: Record<string, unknown>) {
  const update = jest.fn().mockResolvedValue(undefined);
  return { data: () => data, ref: { update }, _update: update };
}

function makeDb(docs: ReturnType<typeof bookingDoc>[]) {
  const db = {
    collection: jest.fn(() => ({ where: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ docs }) })) })),
  };
  return { db };
}

beforeEach(() => {
  delete process.env.GROWTH_ENGINE_ENABLED;
  delete process.env.GROWTH_ENGINE_SEND_MODE;
  jest.clearAllMocks();
  mockFindGuestByPhone.mockResolvedValue({ id: 'g1', firstName: 'Ana', normalizedPhone: '+40712345678' });
});

describe('runChannelAwareReactivation — audience filtering', () => {
  it('only reaches phone-only / imported guests inside the Day-90 window', async () => {
    const eligible = bookingDoc({ guestInfo: { phone: '+40712345678' }, checkOutDate: secondsFor(90) });
    const docs = [
      eligible,
      bookingDoc({ guestInfo: { email: 'a@b.com', phone: '+40711111111' }, checkOutDate: secondsFor(90) }), // has email, not imported -> skip
      bookingDoc({ guestInfo: {}, checkOutDate: secondsFor(90) }), // no phone -> skip
      bookingDoc({ guestInfo: { phone: '+40712345678' }, checkOutDate: secondsFor(200) }), // outside window
      bookingDoc({ guestInfo: { phone: '+40712345678' }, checkOutDate: secondsFor(90), seasonalReactivationSentAt: 'ts' }), // already done
    ];
    const { db } = makeDb(docs);
    mockGetAdminDb.mockResolvedValue(db);
    mockExecuteSend.mockResolvedValue({ status: 'dry-run', mode: 'dry-run' });

    const stats = await runChannelAwareReactivation(NOW);

    expect(mockExecuteSend).toHaveBeenCalledTimes(1);
    expect(mockExecuteSend.mock.calls[0][0]).toMatchObject({
      guestId: 'g1',
      channel: 'whatsapp',
      templateName: 'seasonal_availability',
    });
    expect(stats).toMatchObject({ attempted: 1, dryRun: 1, sent: 0 });
    // Dry-run must NOT mark the booking as reactivated.
    expect(eligible._update).not.toHaveBeenCalled();
  });

  it('marks the booking as reactivated only on a real send', async () => {
    const eligible = bookingDoc({ guestInfo: { phone: '+40712345678' }, checkOutDate: secondsFor(90) });
    const { db } = makeDb([eligible]);
    mockGetAdminDb.mockResolvedValue(db);
    mockExecuteSend.mockResolvedValue({ status: 'sent', mode: 'live', providerId: 'SM-1' });

    const stats = await runChannelAwareReactivation(NOW);

    expect(stats).toMatchObject({ attempted: 1, sent: 1 });
    expect(eligible._update).toHaveBeenCalledTimes(1);
    expect(eligible._update.mock.calls[0][0]).toHaveProperty('seasonalReactivationSentAt');
  });

  it('skips guests who already re-booked since the stay', async () => {
    const eligible = bookingDoc({ guestInfo: { phone: '+40712345678' }, checkOutDate: secondsFor(90) });
    const { db } = makeDb([eligible]);
    mockGetAdminDb.mockResolvedValue(db);
    // last booking is 10 days ago — AFTER the 90-day-old checkout => re-booked
    mockFindGuestByPhone.mockResolvedValue({ id: 'g1', firstName: 'Ana', lastBookingDate: secondsFor(10) });
    mockExecuteSend.mockResolvedValue({ status: 'dry-run', mode: 'dry-run' });

    const stats = await runChannelAwareReactivation(NOW);
    expect(mockExecuteSend).not.toHaveBeenCalled();
    expect(stats).toMatchObject({ attempted: 0, skipped: 1 });
  });

  it('counts suppressed without marking', async () => {
    const eligible = bookingDoc({ guestInfo: { phone: '+40712345678' }, checkOutDate: secondsFor(90) });
    const { db } = makeDb([eligible]);
    mockGetAdminDb.mockResolvedValue(db);
    mockExecuteSend.mockResolvedValue({ status: 'suppressed', mode: 'live', reason: 'suppression-list' });

    const stats = await runChannelAwareReactivation(NOW);
    expect(stats).toMatchObject({ attempted: 1, suppressed: 1 });
    expect(eligible._update).not.toHaveBeenCalled();
  });
});
