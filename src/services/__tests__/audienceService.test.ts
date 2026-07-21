/** @jest-environment node */

jest.mock('@/lib/firebaseAdminSafe', () => ({
  getAdminDb: jest.fn(),
  FieldValue: { serverTimestamp: jest.fn(() => 'ts') },
}));
// executionGateway (imported for isConsentBlocked) pulls guestService at load — stub it.
jest.mock('@/services/guestService', () => ({ getGuestById: jest.fn() }));

import { buildAudience } from '../audienceService';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import type { Guest } from '@/types';

const mockGetAdminDb = getAdminDb as jest.Mock;

function makeDb({ guests = [], suppression = [], bookings = [] }: {
  guests?: Record<string, unknown>[];
  suppression?: Record<string, unknown>[];
  bookings?: Record<string, unknown>[];
} = {}) {
  const guestSnap = { docs: guests.map((g) => ({ id: g.id as string, data: () => g })) };
  const suppSnap = { docs: suppression.map((s) => ({ data: () => s })) };
  const bookingSnap = { docs: bookings.map((b) => ({ id: b.id as string, data: () => b })) };
  return {
    collection: (name: string) => {
      if (name === 'guests') return { where: () => ({ get: async () => guestSnap }) };
      if (name === 'suppressionList') return { get: async () => suppSnap };
      if (name === 'bookings') return { where: () => ({ get: async () => bookingSnap }) };
      return { get: async () => ({ docs: [] }) };
    },
  };
}

function guest(overrides: Partial<Guest> = {}): Guest {
  return {
    id: 'g',
    firstName: 'Ana',
    language: 'ro',
    bookingIds: [],
    propertyIds: ['prahova'],
    totalBookings: 1,
    totalSpent: 1000,
    currency: 'RON',
    reviewSubmitted: false,
    tags: [],
    unsubscribed: false,
    normalizedPhone: '+40712345678',
    ...overrides,
  } as Guest;
}

const NOW = new Date('2026-07-21T12:00:00Z');

describe('audienceService.buildAudience', () => {
  it('annotates each candidate with eligibility + reason and never caps the list', async () => {
    const twoDaysAgo = { _seconds: Math.floor(NOW.getTime() / 1000) - 2 * 86400 };
    const guests = [
      guest({ id: 'ok', normalizedPhone: '+40700000001' }),
      guest({ id: 'unsub', unsubscribed: true, normalizedPhone: '+40700000002' }),
      guest({ id: 'nocontact', normalizedPhone: undefined, phone: undefined, email: undefined }),
      guest({ id: 'supp', normalizedPhone: '+40700000004' }),
      guest({ id: 'freq', normalizedPhone: '+40700000005', lastCampaignAt: twoDaysAgo as unknown as Guest['lastCampaignAt'] }),
      guest({ id: 'future', normalizedPhone: '+40700000006', bookingIds: ['b-future'] }),
    ];
    const db = makeDb({
      guests,
      suppression: [{ normalizedPhone: '+40700000004' }],
      bookings: [{ id: 'b-future', propertyId: 'prahova', status: 'confirmed', checkOutDate: new Date(NOW.getTime() + 14 * 86400000) }],
    });
    mockGetAdminDb.mockResolvedValue(db);

    const res = await buildAudience('prahova', { now: NOW });
    const by = Object.fromEntries(res.candidates.map((c) => [c.guestId, c]));

    expect(by.ok.eligible).toBe(true);
    expect(by.unsub).toMatchObject({ eligible: false, ineligibleReason: 'unsubscribed' });
    expect(by.nocontact).toMatchObject({ eligible: false, ineligibleReason: 'no-contact' });
    expect(by.supp).toMatchObject({ eligible: false, ineligibleReason: 'suppressed' });
    expect(by.freq).toMatchObject({ eligible: false, ineligibleReason: 'frequency-cap' });
    expect(by.future).toMatchObject({ eligible: false, ineligibleReason: 'active-future-booking' });

    expect(res.total).toBe(6);
    expect(res.eligibleCount).toBe(1);
    expect(res.candidates).toHaveLength(6); // ALL returned — the picker annotates, never caps
  });

  it('surfaces fit signals (repeat, last-stay season) as advisory annotations', async () => {
    const guests = [
      guest({ id: 'winterRepeat', totalBookings: 3, lastStayDate: new Date('2025-01-05') as unknown as Guest['lastStayDate'], normalizedPhone: '+40700000010' }),
      guest({ id: 'summerOnce', totalBookings: 1, lastStayDate: new Date('2025-08-10') as unknown as Guest['lastStayDate'], normalizedPhone: '+40700000011' }),
    ];
    mockGetAdminDb.mockResolvedValue(makeDb({ guests }));

    const res = await buildAudience('prahova', { now: NOW });
    const by = Object.fromEntries(res.candidates.map((c) => [c.guestId, c]));

    // A winter-stayer is STILL eligible — season is advisory, never an exclusion.
    expect(by.winterRepeat).toMatchObject({ eligible: true, isRepeat: true, lastStaySeason: 'winter' });
    expect(by.summerOnce).toMatchObject({ eligible: true, isRepeat: false, lastStaySeason: 'summer' });
    expect(res.perRunCap).toBeGreaterThan(0);
  });

  it('does not flag a cancelled future booking as active', async () => {
    const guests = [guest({ id: 'g1', bookingIds: ['b-cancelled'], normalizedPhone: '+40700000020' })];
    const db = makeDb({
      guests,
      bookings: [{ id: 'b-cancelled', propertyId: 'prahova', status: 'cancelled', checkOutDate: new Date(NOW.getTime() + 14 * 86400000) }],
    });
    mockGetAdminDb.mockResolvedValue(db);

    const res = await buildAudience('prahova', { now: NOW });
    expect(res.candidates[0].eligible).toBe(true);
  });

  it('does not flag a PAST booking as an active future booking', async () => {
    const guests = [guest({ id: 'g1', bookingIds: ['b-past'], normalizedPhone: '+40700000030' })];
    const db = makeDb({
      guests,
      bookings: [{ id: 'b-past', propertyId: 'prahova', status: 'completed', checkOutDate: new Date(NOW.getTime() - 60 * 86400000) }],
    });
    mockGetAdminDb.mockResolvedValue(db);

    const res = await buildAudience('prahova', { now: NOW });
    expect(res.candidates[0].eligible).toBe(true);
  });
});
