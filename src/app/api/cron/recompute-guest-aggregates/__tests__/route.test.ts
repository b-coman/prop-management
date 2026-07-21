/** @jest-environment node */

jest.mock('@/lib/firebaseAdminSafe', () => ({ getAdminDb: jest.fn(), FieldValue: { serverTimestamp: jest.fn(() => 'ts') } }));
jest.mock('@/services/guestService', () => ({ recomputeGuestAggregates: jest.fn() }));
jest.mock('@/lib/logger', () => ({ loggers: { guest: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } } }));

import { GET } from '../route';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { recomputeGuestAggregates } from '@/services/guestService';
import type { NextRequest } from 'next/server';

const mockGetAdminDb = getAdminDb as jest.Mock;
const mockRecompute = recomputeGuestAggregates as jest.Mock;

function makeReq(params: Record<string, string> = {}, headers: Record<string, string> = {}) {
  return {
    nextUrl: { searchParams: new URLSearchParams(params) },
    headers: { get: (k: string) => headers[k] ?? null },
  } as unknown as NextRequest;
}

function makeDb(guestIds: string[]) {
  const docs = guestIds.map((id) => ({ id, data: () => ({ firstName: id }) }));
  return { collection: () => ({ get: async () => ({ docs }) }) };
}

const CRON = { 'X-Appengine-Cron': 'true' };

beforeEach(() => mockRecompute.mockReset());

describe('recompute-guest-aggregates cron', () => {
  it('rejects unauthenticated requests with 401', async () => {
    mockGetAdminDb.mockResolvedValue(makeDb([]));
    expect((await GET(makeReq())).status).toBe(401);
  });

  it('tallies the number of guests whose totals changed', async () => {
    mockGetAdminDb.mockResolvedValue(makeDb(['g1', 'g2', 'g3']));
    mockRecompute.mockImplementation(async (id: string) => ({
      changed: id !== 'g2',
      before: { totalBookings: 2, totalSpent: 2000 },
      after: { totalBookings: 1, totalSpent: 1000 },
    }));

    const res = await GET(makeReq({}, CRON));
    const json = await res.json();

    expect(json.scanned).toBe(3);
    expect(json.changed).toBe(2); // g1 and g3
    expect(json.changes).toHaveLength(2);
    expect(mockRecompute).toHaveBeenCalledTimes(3);
  });

  it('passes dryRun through to the recompute', async () => {
    mockGetAdminDb.mockResolvedValue(makeDb(['g1']));
    mockRecompute.mockResolvedValue({ changed: false, before: { totalBookings: 1, totalSpent: 1 }, after: { totalBookings: 1, totalSpent: 1 } });

    await GET(makeReq({ dryRun: '1' }, CRON));

    expect(mockRecompute).toHaveBeenCalledWith('g1', { dryRun: true });
  });
});
