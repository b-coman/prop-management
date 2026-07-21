/** @jest-environment node */

jest.mock('@/lib/firebaseAdminSafe', () => ({
  getAdminDb: jest.fn(),
  FieldValue: { serverTimestamp: jest.fn(() => 'ts'), arrayUnion: jest.fn(), increment: jest.fn() },
}));

import { recomputeGuestAggregates } from '../guestService';
import { getAdminDb } from '@/lib/firebaseAdminSafe';

const mockGetAdminDb = getAdminDb as jest.Mock;

function makeDb({ guest, bookings }: { guest: Record<string, unknown>; bookings: Record<string, Record<string, unknown>> }) {
  const updateCapture: Record<string, unknown>[] = [];
  const gref = {
    get: async () => ({ exists: true, data: () => guest }),
    update: async (p: Record<string, unknown>) => { updateCapture.push(p); },
  };
  const db = {
    collection: (name: string) => {
      if (name === 'guests') return { doc: () => gref };
      if (name === 'bookings') return { doc: (id: string) => ({ _id: id }) };
      return { doc: () => ({}) };
    },
    getAll: async (...refs: Array<{ _id: string }>) =>
      refs.map((r) => ({ exists: bookings[r._id] != null, data: () => bookings[r._id] })),
  };
  return { db, updateCapture };
}

describe('recomputeGuestAggregates', () => {
  it('counts only non-cancelled bookings and fixes inflated totals', async () => {
    const { db, updateCapture } = makeDb({
      guest: { totalBookings: 3, totalSpent: 3000, bookingIds: ['b1', 'b2', 'b3'] },
      bookings: {
        b1: { status: 'completed', pricing: { total: 1000 } },
        b2: { status: 'confirmed', pricing: { total: 1500 } },
        b3: { status: 'cancelled', pricing: { total: 500 } }, // never happened
      },
    });
    mockGetAdminDb.mockResolvedValue(db);

    const res = await recomputeGuestAggregates('g1');

    expect(res.changed).toBe(true);
    expect(res.before).toEqual({ totalBookings: 3, totalSpent: 3000 });
    expect(res.after).toEqual({ totalBookings: 2, totalSpent: 2500 });
    expect(updateCapture[0]).toMatchObject({ totalBookings: 2, totalSpent: 2500 });
  });

  it('is a no-op (no write) when the totals already match', async () => {
    const { db, updateCapture } = makeDb({
      guest: { totalBookings: 1, totalSpent: 1000, bookingIds: ['b1'] },
      bookings: { b1: { status: 'completed', pricing: { total: 1000 } } },
    });
    mockGetAdminDb.mockResolvedValue(db);

    const res = await recomputeGuestAggregates('g1');

    expect(res.changed).toBe(false);
    expect(updateCapture).toHaveLength(0);
  });

  it('dry-run computes the correction but writes nothing', async () => {
    const { db, updateCapture } = makeDb({
      guest: { totalBookings: 3, totalSpent: 3000, bookingIds: ['b1', 'b2'] },
      bookings: {
        b1: { status: 'completed', pricing: { total: 1000 } },
        b2: { status: 'confirmed', pricing: { total: 1000 } },
      },
    });
    mockGetAdminDb.mockResolvedValue(db);

    const res = await recomputeGuestAggregates('g1', { dryRun: true });

    expect(res.changed).toBe(true);
    expect(res.after).toEqual({ totalBookings: 2, totalSpent: 2000 });
    expect(updateCapture).toHaveLength(0);
  });

  it('handles a guest with no bookings (zeroes)', async () => {
    const { db } = makeDb({ guest: { totalBookings: 2, totalSpent: 500, bookingIds: [] }, bookings: {} });
    mockGetAdminDb.mockResolvedValue(db);

    const res = await recomputeGuestAggregates('g1');

    expect(res.after).toEqual({ totalBookings: 0, totalSpent: 0 });
  });
});
