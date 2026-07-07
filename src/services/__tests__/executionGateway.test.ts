/** @jest-environment node */

// Mock the Admin SDK and guest lookup BEFORE importing the module under test.
jest.mock('@/lib/firebaseAdminSafe', () => ({
  getAdminDb: jest.fn(),
  FieldValue: { serverTimestamp: jest.fn(() => 'server-ts') },
}));
jest.mock('@/services/guestService', () => ({ getGuestById: jest.fn() }));

import { executeSend, isConsentBlocked, maskContact } from '../executionGateway';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { getGuestById } from '@/services/guestService';
import type { Guest } from '@/types';

const mockGetAdminDb = getAdminDb as jest.Mock;
const mockGetGuestById = getGuestById as jest.Mock;

/** Build a chainable Firestore mock; `suppressed` toggles the suppressionList hit. */
function makeDb({ suppressed = false }: { suppressed?: boolean } = {}) {
  const addMock = jest.fn().mockResolvedValue({ id: 'log-123' });
  const query: Record<string, jest.Mock> = {
    where: jest.fn(),
    limit: jest.fn(),
    get: jest.fn().mockResolvedValue({ empty: !suppressed }),
  };
  query.where.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  const db = {
    collection: jest.fn((name: string) => {
      if (name === 'messageLog') return { add: addMock };
      return query; // suppressionList
    }),
  };
  return { db, addMock };
}

function guest(overrides: Partial<Guest> = {}): Guest {
  return {
    id: 'g1',
    firstName: 'Ana',
    language: 'en',
    bookingIds: ['b1'],
    propertyIds: ['prahova-mountain-chalet'],
    totalBookings: 1,
    totalSpent: 1000,
    currency: 'RON',
    firstBookingDate: new Date() as unknown as Guest['firstBookingDate'],
    lastBookingDate: new Date() as unknown as Guest['lastBookingDate'],
    reviewSubmitted: false,
    tags: [],
    unsubscribed: false,
    normalizedPhone: '+40712345678',
    createdAt: new Date() as unknown as Guest['createdAt'],
    updatedAt: new Date() as unknown as Guest['updatedAt'],
    ...overrides,
  } as Guest;
}

beforeEach(() => {
  // Ensure DARK LAUNCH default (both switches off) for every test.
  delete process.env.GROWTH_ENGINE_ENABLED;
  delete process.env.GROWTH_ENGINE_SEND_MODE;
});

describe('executionGateway pure helpers', () => {
  it('isConsentBlocked blocks unsubscribed and explicit opt-out only', () => {
    expect(isConsentBlocked({ unsubscribed: true }, 'whatsapp')).toBe(true);
    expect(isConsentBlocked({ unsubscribed: false, channelConsent: { whatsapp: 'opted_out' } }, 'whatsapp')).toBe(true);
    expect(isConsentBlocked({ unsubscribed: false, channelConsent: { whatsapp: 'opted_in' } }, 'whatsapp')).toBe(false);
    // unknown/absent consent is allowed (owner call §0.2.1)
    expect(isConsentBlocked({ unsubscribed: false }, 'whatsapp')).toBe(false);
    expect(isConsentBlocked({ unsubscribed: false, channelConsent: { email: 'opted_out' } }, 'whatsapp')).toBe(false);
  });
  it('maskContact never leaks the full contact', () => {
    expect(maskContact('+40712345678')).toBe('+40712***');
    expect(maskContact('a@b.co')).toBe('a***');
  });
});

describe('executeSend — dark-launch safety', () => {
  it('defaults to dry-run (records intent, delivers nothing)', async () => {
    const { db, addMock } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);
    mockGetGuestById.mockResolvedValue(guest());

    const res = await executeSend({ guestId: 'g1', channel: 'whatsapp', templateName: 'winter_invite' });

    expect(res.status).toBe('dry-run');
    expect(res.mode).toBe('dry-run');
    expect(addMock).toHaveBeenCalledTimes(1);
    expect(addMock.mock.calls[0][0]).toMatchObject({ status: 'dry-run', to: '+40712***' });
  });

  it('suppresses unsubscribed guests', async () => {
    const { db, addMock } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);
    mockGetGuestById.mockResolvedValue(guest({ unsubscribed: true }));

    const res = await executeSend({ guestId: 'g1', channel: 'whatsapp', templateName: 'winter_invite' });
    expect(res.status).toBe('suppressed');
    expect(res.reason).toBe('consent-or-unsubscribed');
    expect(addMock.mock.calls[0][0]).toMatchObject({ status: 'suppressed' });
  });

  it('suppresses guests on the suppression list', async () => {
    const { db, addMock } = makeDb({ suppressed: true });
    mockGetAdminDb.mockResolvedValue(db);
    mockGetGuestById.mockResolvedValue(guest());

    const res = await executeSend({ guestId: 'g1', channel: 'whatsapp', templateName: 'winter_invite' });
    expect(res.status).toBe('suppressed');
    expect(res.reason).toBe('suppression-list');
  });

  it('skips when the guest is not found', async () => {
    const { db } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);
    mockGetGuestById.mockResolvedValue(null);

    const res = await executeSend({ guestId: 'missing', channel: 'whatsapp', templateName: 'winter_invite' });
    expect(res.status).toBe('skipped');
    expect(res.reason).toBe('guest-not-found');
  });

  it('skips when there is no contact for the channel', async () => {
    const { db } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);
    mockGetGuestById.mockResolvedValue(guest({ normalizedPhone: undefined, phone: undefined, email: undefined }));

    const res = await executeSend({ guestId: 'g1', channel: 'whatsapp', templateName: 'winter_invite' });
    expect(res.status).toBe('skipped');
    expect(res.reason).toBe('no-contact-for-channel');
  });
});
