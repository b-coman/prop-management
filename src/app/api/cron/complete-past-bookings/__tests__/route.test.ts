/** @jest-environment node */

jest.mock('@/lib/firebaseAdminSafe', () => ({
  getAdminDb: jest.fn(),
  FieldValue: { serverTimestamp: jest.fn(() => 'ts') },
}));
jest.mock('@/services/guestService', () => ({ advanceGuestLastStay: jest.fn().mockResolvedValue(true) }));
jest.mock('@/lib/logger', () => ({
  loggers: { booking: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } },
}));

import { GET } from '../route';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { advanceGuestLastStay } from '@/services/guestService';
import type { NextRequest } from 'next/server';

const mockGetAdminDb = getAdminDb as jest.Mock;
const mockAdvance = advanceGuestLastStay as jest.Mock;

function makeReq(params: Record<string, string> = {}, headers: Record<string, string> = {}) {
  return {
    nextUrl: { searchParams: new URLSearchParams(params) },
    headers: { get: (k: string) => headers[k] ?? null },
  } as unknown as NextRequest;
}

function makeDb(bookings: Array<{ id: string; data: Record<string, unknown> }>) {
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const docs = bookings.map((b) => ({
    id: b.id,
    data: () => b.data,
    ref: { update: async (patch: Record<string, unknown>) => { updates.push({ id: b.id, patch }); } },
  }));
  const query: Record<string, jest.Mock> = {};
  query.where = jest.fn(() => query);
  query.get = jest.fn().mockResolvedValue({ docs });
  const db = { collection: jest.fn(() => query) };
  return { db, updates };
}

const CRON = { 'X-Appengine-Cron': 'true' };
const past = new Date(Date.now() - 10 * 86400000);
const future = new Date(Date.now() + 10 * 86400000);

beforeEach(() => {
  mockAdvance.mockClear();
  mockAdvance.mockResolvedValue(true);
});

describe('complete-past-bookings cron', () => {
  it('rejects unauthenticated requests with 401', async () => {
    mockGetAdminDb.mockResolvedValue(makeDb([]).db);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('completes confirmed past-checkout bookings and advances the guest; leaves future ones', async () => {
    const { db, updates } = makeDb([
      { id: 'b-past', data: { status: 'confirmed', propertyId: 'prahova', checkOutDate: past, guestInfo: { firstName: 'Eugenia', lastName: 'Lungu' } } },
      { id: 'b-future', data: { status: 'confirmed', propertyId: 'prahova', checkOutDate: future } },
    ]);
    mockGetAdminDb.mockResolvedValue(db);

    const res = await GET(makeReq({}, CRON));
    const json = await res.json();

    expect(json.eligible).toBe(1);
    expect(json.completed).toBe(1);
    expect(json.guestsAdvanced).toBe(1);
    expect(json.skippedNotPast).toBe(1);
    expect(updates).toEqual([{ id: 'b-past', patch: expect.objectContaining({ status: 'completed' }) }]);
    expect(mockAdvance).toHaveBeenCalledWith('b-past', expect.any(Date));
    expect(mockAdvance).toHaveBeenCalledTimes(1);
  });

  it('dry-run reports eligible but writes nothing', async () => {
    const { db, updates } = makeDb([
      { id: 'b-past', data: { status: 'confirmed', propertyId: 'prahova', checkOutDate: past } },
    ]);
    mockGetAdminDb.mockResolvedValue(db);

    const res = await GET(makeReq({ dryRun: '1' }, CRON));
    const json = await res.json();

    expect(json.dryRun).toBe(true);
    expect(json.eligible).toBe(1);
    expect(json.completed).toBe(0);
    expect(updates).toHaveLength(0);
    expect(mockAdvance).not.toHaveBeenCalled();
  });

  it('skips bookings with an unparseable checkout date', async () => {
    const { db, updates } = makeDb([
      { id: 'b-bad', data: { status: 'confirmed', propertyId: 'prahova', checkOutDate: null } },
    ]);
    mockGetAdminDb.mockResolvedValue(db);

    const res = await GET(makeReq({}, CRON));
    const json = await res.json();

    expect(json.skippedBadDate).toBe(1);
    expect(json.eligible).toBe(0);
    expect(updates).toHaveLength(0);
  });
});
