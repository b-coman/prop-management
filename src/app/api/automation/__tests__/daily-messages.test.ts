/** @jest-environment node */

// dailyMessages builds the cleaner's check-in/check-out text server-side. Uses the real
// Bucharest date helpers (unlike route.test.ts) because the day matching is the point.
jest.mock('@/lib/firebaseAdminSafe', () => ({
  getAdminDb: jest.fn(),
  FieldValue: { serverTimestamp: jest.fn(() => 'ts') },
}));
jest.mock('@/lib/logger', () => ({
  loggers: { adminBookings: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } },
}));

import { GET } from '../route';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import type { NextRequest } from 'next/server';

const mockGetAdminDb = getAdminDb as jest.Mock;

function makeReq(params: Record<string, string>): NextRequest {
  return {
    nextUrl: { searchParams: new URLSearchParams(params), origin: 'https://test.local' },
    headers: { get: () => null },
  } as unknown as NextRequest;
}

// Stays stored the way the booking flow writes them: check-in 15:00, check-out 11:00 Bucharest.
const BOOKINGS = [
  { id: 'maria', guestInfo: { firstName: 'Maria', lastName: 'Iova' }, numberOfGuests: 6, numberOfAdults: 4, numberOfChildren: 2,
    status: 'confirmed', checkInDate: new Date('2026-10-16T12:00:00Z'), checkOutDate: new Date('2026-10-18T08:00:00Z') },
  { id: 'simona', guestInfo: { firstName: 'Simona', lastName: 'Chiriluta' }, numberOfGuests: 4, numberOfAdults: 3, numberOfChildren: 1,
    status: 'confirmed', checkInDate: new Date('2026-10-25T13:00:00Z'), checkOutDate: new Date('2026-10-30T09:00:00Z') },
  { id: 'george', guestInfo: { firstName: 'George', lastName: 'Iordache' }, numberOfGuests: 4, numberOfAdults: 4,
    status: 'confirmed', checkInDate: new Date('2026-10-30T13:00:00Z'), checkOutDate: new Date('2026-11-01T09:00:00Z') },
];

function makeDb() {
  const bookingsQuery = {
    where: () => bookingsQuery,
    get: async () => ({
      forEach: (fn: (doc: { id: string; data: () => Record<string, unknown> }) => void) =>
        BOOKINGS.forEach(({ id, ...data }) => fn({ id, data: () => data })),
    }),
  };
  return {
    collection: (name: string) => {
      if (name === 'bookings') return bookingsQuery;
      return { doc: () => ({ get: async () => ({ exists: false, data: () => ({}) }) }) };
    },
  };
}

async function dailyMessages(date: string, token = 'secret') {
  const res = await GET(makeReq({ op: 'dailyMessages', propertyId: 'prahova', token, date }));
  return { status: res.status, text: await res.text() };
}

beforeEach(() => {
  process.env.AUTOMATION_TOKEN = 'secret';
  mockGetAdminDb.mockResolvedValue(makeDb());
});

describe('/api/automation — dailyMessages', () => {
  it('reports both guests on a changeover day', async () => {
    const { status, text } = await dailyMessages('2026-10-30');
    expect(status).toBe(200);
    expect(text).toBe(
      "Saru'mana!... Astazi vineri, 30 octombrie pleaca Simona Chiriluta.\n" +
      'Tot astazi soseste George Iordache. Sunt in total 4 persoane (4 adulti / 0 copii).'
    );
  });

  it('reports an arrival', async () => {
    const { text } = await dailyMessages('2026-10-16');
    expect(text).toBe("Saru'mana!... Astazi vineri, 16 octombrie soseste Maria Iova. Sunt in total 6 persoane (4 adulti / 2 copii).");
  });

  it('reports a departure', async () => {
    const { text } = await dailyMessages('2026-10-18');
    expect(text).toBe("Saru'mana!... Astazi duminică, 18 octombrie pleaca Maria Iova.");
  });

  it('is empty mid-stay and on free days, so the shortcut sends nothing', async () => {
    expect((await dailyMessages('2026-10-27')).text).toBe('');
    expect((await dailyMessages('2026-10-20')).text).toBe('');
  });

  it('fails quietly: a bad token returns an empty body, never "Unauthorized"', async () => {
    const { status, text } = await dailyMessages('2026-10-30', 'wrong');
    expect(status).toBe(401);
    expect(text).toBe('');
  });

  it('changedReservations fails as "none" so its shortcut stays silent', async () => {
    const res = await GET(makeReq({ op: 'changedReservations', propertyId: 'prahova', token: 'wrong' }));
    expect(res.status).toBe(401);
    expect(await res.text()).toBe('none');
  });
});
