/** @jest-environment node */

// Mock the Admin SDK, guest lookup, and WhatsApp provider BEFORE importing the SUT.
jest.mock('@/lib/firebaseAdminSafe', () => ({
  getAdminDb: jest.fn(),
  FieldValue: { serverTimestamp: jest.fn(() => 'server-ts') },
}));
jest.mock('@/services/guestService', () => ({ getGuestById: jest.fn() }));
jest.mock('@/services/whatsappService', () => ({
  // 2-arg (name, language) so we can assert language-variant selection
  resolveWhatsAppTemplateSid: jest.fn((name: string, lang: string) => (name === 'winter_invite' ? `HX-${lang}` : undefined)),
  sendWhatsAppTemplateBySid: jest.fn().mockResolvedValue({ success: true, sid: 'SM-1' }),
}));

import { executeSend, isConsentBlocked, maskContact, resolveGuestLanguage } from '../executionGateway';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { getGuestById } from '@/services/guestService';
import { sendWhatsAppTemplateBySid, resolveWhatsAppTemplateSid } from '@/services/whatsappService';
import type { Guest } from '@/types';

const mockGetAdminDb = getAdminDb as jest.Mock;
const mockGetGuestById = getGuestById as jest.Mock;
const mockSendWhatsApp = sendWhatsAppTemplateBySid as jest.Mock;
const mockResolve = resolveWhatsAppTemplateSid as jest.Mock;

function chainableGet(result: unknown) {
  const q: Record<string, jest.Mock> = {};
  q.where = jest.fn(() => q);
  q.limit = jest.fn(() => q);
  q.get = jest.fn().mockResolvedValue(result);
  return q;
}

/** Chainable Firestore mock; toggles suppressionList hit and prior-delivery dedup. */
function makeDb({ suppressed = false, priorDelivered = false, propertyName = 'Prahova Mountain Chalet' }: { suppressed?: boolean; priorDelivered?: boolean; propertyName?: string } = {}) {
  const addMock = jest.fn().mockResolvedValue({ id: 'log-123' });
  const guestUpdateMock = jest.fn().mockResolvedValue(undefined);
  const suppressionQuery = chainableGet({ empty: !suppressed });
  const messageLogQuery = chainableGet({ docs: priorDelivered ? [{ data: () => ({ status: 'sent' }) }] : [] });
  const messageLogCol = { add: addMock, where: messageLogQuery.where };
  const propertiesDoc = { get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ name: propertyName }) }) };
  const overridesDoc = { get: jest.fn().mockResolvedValue({ exists: false, data: () => ({}) }) };
  const guestsDoc = { update: guestUpdateMock };
  const db = {
    collection: jest.fn((name: string) => {
      if (name === 'messageLog') return messageLogCol;
      if (name === 'properties') return { doc: jest.fn(() => propertiesDoc) };
      if (name === 'propertyOverrides') return { doc: jest.fn(() => overridesDoc) };
      if (name === 'guests') return { doc: jest.fn(() => guestsDoc) };
      return suppressionQuery; // suppressionList
    }),
  };
  return { db, addMock, guestUpdateMock };
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

describe('resolveGuestLanguage (H2 — country beats the en default)', () => {
  it('explicit ro wins', () => {
    expect(resolveGuestLanguage({ language: 'ro' })).toBe('ro');
  });
  it('RO/MD country => ro even when language is en or absent', () => {
    expect(resolveGuestLanguage({ language: 'en', country: 'RO' })).toBe('ro');
    expect(resolveGuestLanguage({ country: 'Romania' } as Parameters<typeof resolveGuestLanguage>[0])).toBe('ro');
    expect(resolveGuestLanguage({ country: 'MD' } as Parameters<typeof resolveGuestLanguage>[0])).toBe('ro');
  });
  it('foreign/unknown => the language field or en', () => {
    expect(resolveGuestLanguage({ language: 'en', country: 'US' })).toBe('en');
    expect(resolveGuestLanguage({} as Parameters<typeof resolveGuestLanguage>[0])).toBe('en');
  });
});

describe('executeSend — dark-launch safety (default)', () => {
  it('defaults to dry-run: records intent, delivers nothing', async () => {
    const { db, addMock } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);
    mockGetGuestById.mockResolvedValue(guest());

    const res = await executeSend({ guestId: 'g1', propertyId: 'prahova-mountain-chalet', channel: 'whatsapp', templateName: 'winter_invite' });

    expect(mockSendWhatsApp).not.toHaveBeenCalled();
    expect(res.status).toBe('dry-run');
    expect(res.mode).toBe('dry-run');
    expect(addMock).toHaveBeenCalledTimes(1);
    // messageLog records the property for per-property audit/reporting (#1)
    expect(addMock.mock.calls[0][0]).toMatchObject({ status: 'dry-run', to: '+40712***', propertyId: 'prahova-mountain-chalet' });
  });

  it('skips a guest within the frequency-cap window (H4)', async () => {
    const { db } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);
    mockGetGuestById.mockResolvedValue(guest({ lastCampaignAt: { _seconds: Math.floor(Date.now() / 1000) - 2 * 86400 } as unknown as Guest['lastCampaignAt'] }));
    const res = await executeSend({ guestId: 'g1', channel: 'whatsapp', templateName: 'winter_invite' });
    expect(res.status).toBe('skipped');
    expect(res.reason).toBe('frequency-cap');
  });

  it('does not cap a guest whose last touch predates the window (H4)', async () => {
    const { db } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);
    mockGetGuestById.mockResolvedValue(guest({ lastCampaignAt: { _seconds: Math.floor(Date.now() / 1000) - 30 * 86400 } as unknown as Guest['lastCampaignAt'] }));
    const res = await executeSend({ guestId: 'g1', channel: 'whatsapp', templateName: 'winter_invite' });
    expect(res.status).toBe('dry-run');
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

  it('delivers via WhatsApp and logs sent, selecting the guest-language template (#2)', async () => {
    const { db, addMock } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);
    mockGetGuestById.mockResolvedValue(guest()); // language 'en'

    const res = await executeSend({ guestId: 'g1', channel: 'whatsapp', templateName: 'winter_invite', campaignId: 'c1' });

    expect(mockResolve).toHaveBeenCalledWith('winter_invite', 'en');
    expect(mockSendWhatsApp).toHaveBeenCalledWith('+40712345678', 'HX-en', expect.any(Object));
    expect(res.status).toBe('sent');
    expect(res.mode).toBe('live');
    expect(res.providerId).toBe('SM-1');
    expect(addMock.mock.calls.at(-1)?.[0]).toMatchObject({ status: 'sent', providerId: 'SM-1' });
  });

  it('property-brands the live message with the property name (H1)', async () => {
    const { db } = makeDb({ propertyName: 'Prahova Mountain Chalet' });
    mockGetAdminDb.mockResolvedValue(db);
    mockGetGuestById.mockResolvedValue(guest());
    await executeSend({ guestId: 'g1', propertyId: 'prahova-mountain-chalet', channel: 'whatsapp', templateName: 'winter_invite' });
    expect(mockSendWhatsApp).toHaveBeenCalledWith('+40712345678', 'HX-en', expect.objectContaining({ property: 'Prahova Mountain Chalet' }));
  });

  it('sends the RO template to a RO-country guest whose language defaulted to en (H2)', async () => {
    const { db } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);
    mockGetGuestById.mockResolvedValue(guest({ language: 'en', country: 'RO' }));
    await executeSend({ guestId: 'g1', channel: 'whatsapp', templateName: 'winter_invite' });
    expect(mockResolve).toHaveBeenCalledWith('winter_invite', 'ro');
  });

  it('selects the RO template variant for a RO-language guest (#2)', async () => {
    const { db } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);
    mockGetGuestById.mockResolvedValue(guest({ language: 'ro' }));

    await executeSend({ guestId: 'g1', channel: 'whatsapp', templateName: 'winter_invite' });

    expect(mockResolve).toHaveBeenCalledWith('winter_invite', 'ro');
    expect(mockSendWhatsApp).toHaveBeenCalledWith('+40712345678', 'HX-ro', expect.any(Object));
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
