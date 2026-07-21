/** @jest-environment node */

jest.mock('@/lib/firebaseAdminSafe', () => ({
  getAdminDb: jest.fn(),
  FieldValue: {
    serverTimestamp: jest.fn(() => 'ts'),
    arrayUnion: jest.fn((x) => ({ __arrayUnion: x })),
    increment: jest.fn((n) => ({ __increment: n })),
  },
}));

import { advanceGuestLastStay } from '../guestService';
import { getAdminDb } from '@/lib/firebaseAdminSafe';

const mockGetAdminDb = getAdminDb as jest.Mock;

function makeDb(guest: Record<string, unknown> | null) {
  const updateCapture: Record<string, unknown>[] = [];
  const ref = {};
  const snap = { empty: guest == null, docs: guest ? [{ ref }] : [] };
  const query: Record<string, jest.Mock> = {};
  query.where = jest.fn(() => query);
  query.limit = jest.fn(() => query);
  query.get = jest.fn().mockResolvedValue(snap);
  const txApi = {
    get: jest.fn().mockResolvedValue({ data: () => guest }),
    update: jest.fn((_ref: unknown, patch: Record<string, unknown>) => updateCapture.push(patch)),
  };
  const db = {
    collection: jest.fn(() => query),
    runTransaction: jest.fn((fn: (tx: typeof txApi) => unknown) => fn(txApi)),
  };
  return { db, txApi, updateCapture };
}

describe('advanceGuestLastStay', () => {
  it('advances lastStayDate when the checkout is newer — and never touches counters', async () => {
    const { db, txApi, updateCapture } = makeDb({ lastStayDate: new Date('2024-08-12') });
    mockGetAdminDb.mockResolvedValue(db);

    const res = await advanceGuestLastStay('b1', new Date('2026-07-16'));

    expect(res).toBe(true);
    expect(txApi.update).toHaveBeenCalledTimes(1);
    expect(updateCapture[0]).toMatchObject({ lastStayDate: new Date('2026-07-16') });
    expect(updateCapture[0]).not.toHaveProperty('totalBookings');
    expect(updateCapture[0]).not.toHaveProperty('totalSpent');
    expect(updateCapture[0]).not.toHaveProperty('bookingIds');
  });

  it('is a no-op when the guest already has a newer or equal lastStayDate', async () => {
    const { db, txApi } = makeDb({ lastStayDate: new Date('2026-08-01') });
    mockGetAdminDb.mockResolvedValue(db);

    const res = await advanceGuestLastStay('b1', new Date('2026-07-16'));

    expect(res).toBe(false);
    expect(txApi.update).not.toHaveBeenCalled();
  });

  it('advances when the guest has no lastStayDate yet', async () => {
    const { db, txApi } = makeDb({});
    mockGetAdminDb.mockResolvedValue(db);

    const res = await advanceGuestLastStay('b1', new Date('2026-07-16'));

    expect(res).toBe(true);
    expect(txApi.update).toHaveBeenCalledTimes(1);
  });

  it('returns false when no guest is linked to the booking', async () => {
    const { db } = makeDb(null);
    mockGetAdminDb.mockResolvedValue(db);

    const res = await advanceGuestLastStay('bX', new Date('2026-07-16'));

    expect(res).toBe(false);
  });
});
