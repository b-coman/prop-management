/** @jest-environment node */

// Mock the Admin SDK, guest lookup, and WhatsApp provider BEFORE importing the SUT.
jest.mock('@/lib/firebaseAdminSafe', () => ({
  getAdminDb: jest.fn(),
  FieldValue: { serverTimestamp: jest.fn(() => 'server-ts') },
}));
jest.mock('@/services/guestService', () => ({ getGuestById: jest.fn() }));
jest.mock('@/services/whatsappService', () => ({
  resolveWhatsAppTemplateSid: jest.fn((name: string) => (name === 'winter_invite' ? 'HX-test' : undefined)),
  sendWhatsAppTemplateBySid: jest.fn().mockResolvedValue({ success: true, sid: 'SM-1' }),
}));

import { executeSend, isConsentBlocked, maskContact } from '../executionGateway';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { getGuestById } from '@/services/guestService';
import { sendWhatsAppTemplateBySid } from '@/services/whatsappService';
import type { Guest } from '@/types';

const mockGetAdminDb = getAdminDb as jest.Mock;
const mockGetGuestById = getGuestById as jest.Mock;
const mockSendWhatsApp = sendWhatsAppTemplateBySid as jest.Mock;

function chainableGet(result: unknown) {
  const q: Record<string, jest.Mock> = {};
  q.where = jest.fn(() => q);
  q.limit = jest.fn(() => q);
  q.get = jest.fn().mockResolvedValue(result);
  return q;
}

/** Chainable Firestore mock; toggles suppressionList hit and prior-delivery dedup. */
function makeDb({ suppressed = false, priorDelivered = false }: { suppressed?: boolean; priorDelivered?: boolean } = {}) {
  const addMock = jest.fn().mockResolvedValue({ id: 'log-123' });
  const suppressionQuery = chainableGet({ empty: !suppressed });
  const messageLogQuery = chainableGet({ docs: priorDelivered ? [{ data: () => ({ status: 'sent' }) }] : [] });
  const messageLogCol = { add: addMock, where: messageLogQuery.where };
  const db = {
    collection: jest.fn((name: string) => (name === 'messageLog' ? messageLogCol : suppressionQuery)),
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
  // Enforce DARK LAUNCH default (both switches off) for every test unless overridden.
  delete process.env.GROWTH_ENGINE_ENABLED;
  delete process.env.GROWTH_ENGINE_SEND_MODE;
  mockSendWhatsApp.mockClear();
  mockSendWhatsApp.mockResolvedValue({ success: true, sid: 'SM-1' });
});

describe('executionGateway pure helpers', () => {
  it('isConsentBlocked blocks unsubscribed and explicit opt-out only', () => {
    expect(isConsentBlocked({ unsubscribed: true }, 'whatsapp')).toBe(true);
    expect(isConsentBlocked({ unsubscribed: false, channelConsent: { whatsapp: 'opted_out' } }, 'whatsapp')).toBe(true);
    expect(isConsentBlocked({ unsubscribed: false, channelConsent: { whatsapp: 'opted_in' } }, 'whatsapp')).toBe(false);
    expect(isConsentBlocked({ unsubscribed: false }, 'whatsapp')).toBe(false);
    expect(isConsentBlocked({ unsubscribed: false, channelConsent: { email: 'opted_out' } }, 'whatsapp')).toBe(false);
  });
  it('maskContact never leaks the full contact', () => {
    expect(maskContact('+40712345678')).toBe('+40712***');
    expect(maskContact('a@b.co')).toBe('a***');
  });
});

describe('executeSend — dark-launch safety (default)', () => {
  it('defaults to dry-run: records intent, delivers nothing', async () => {
    const { db, addMock } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);
    mockGetGuestById.mockResolvedValue(guest());

    const res = await executeSend({ guestId: 'g1', channel: 'whatsapp', templateName: 'winter_invite' });

    expect(mockSendWhatsApp).not.toHaveBeenCalled();
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
    const { db } = makeDb({ suppressed: true });
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

describe('executeSend — live mode (both switches on)', () => {
  beforeEach(() => {
    process.env.GROWTH_ENGINE_ENABLED = 'true';
    process.env.GROWTH_ENGINE_SEND_MODE = 'live';
  });

  it('delivers via WhatsApp and logs sent', async () => {
    const { db, addMock } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);
    mockGetGuestById.mockResolvedValue(guest());

    const res = await executeSend({ guestId: 'g1', channel: 'whatsapp', templateName: 'winter_invite', campaignId: 'c1' });

    expect(mockSendWhatsApp).toHaveBeenCalledTimes(1);
    expect(res.status).toBe('sent');
    expect(res.mode).toBe('live');
    expect(res.providerId).toBe('SM-1');
    expect(addMock.mock.calls.at(-1)?.[0]).toMatchObject({ status: 'sent', providerId: 'SM-1' });
  });

  it('logs failed (not delivered) when the provider reports failure', async () => {
    mockSendWhatsApp.mockResolvedValue({ success: false, error: 'twilio boom' });
    const { db } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);
    mockGetGuestById.mockResolvedValue(guest());

    const res = await executeSend({ guestId: 'g1', channel: 'whatsapp', templateName: 'winter_invite' });
    expect(res.status).toBe('failed');
    expect(res.reason).toBe('twilio boom');
  });

  it('dedups an already-delivered campaign template (M1)', async () => {
    const { db } = makeDb({ priorDelivered: true });
    mockGetAdminDb.mockResolvedValue(db);
    mockGetGuestById.mockResolvedValue(guest());

    const res = await executeSend({ guestId: 'g1', channel: 'whatsapp', templateName: 'winter_invite', campaignId: 'c1' });
    expect(mockSendWhatsApp).not.toHaveBeenCalled();
    expect(res.status).toBe('skipped');
    expect(res.reason).toBe('dedup');
  });

  it('does NOT dedup when there is no campaignId (lifecycle sends)', async () => {
    const { db } = makeDb({ priorDelivered: true }); // prior exists but request carries no campaignId
    mockGetAdminDb.mockResolvedValue(db);
    mockGetGuestById.mockResolvedValue(guest());

    const res = await executeSend({ guestId: 'g1', channel: 'whatsapp', templateName: 'winter_invite' });
    expect(res.status).toBe('sent');
  });
});
