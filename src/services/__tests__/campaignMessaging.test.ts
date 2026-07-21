/** @jest-environment node */

jest.mock('@/lib/firebaseAdminSafe', () => ({ getAdminDb: jest.fn().mockResolvedValue({}), FieldValue: { serverTimestamp: jest.fn() } }));
jest.mock('@/services/guestService', () => ({ getGuestById: jest.fn() }));
jest.mock('@/services/executionGateway', () => ({
  executeSend: jest.fn(),
  getPropertyContext: jest.fn().mockResolvedValue({ name: 'Prahova Mountain Chalet', link: 'https://prahova-chalet.ro/calendar/tok' }),
}));

import { renderMessages, queueMessages, fillTemplate } from '../campaignMessaging';
import { getGuestById } from '@/services/guestService';
import { executeSend } from '@/services/executionGateway';
import type { Guest } from '@/types';

const mockGetGuest = getGuestById as jest.Mock;
const mockExecuteSend = executeSend as jest.Mock;

function guest(id: string, o: Partial<Guest> = {}): Guest {
  return {
    id, firstName: 'Ana', language: 'ro', normalizedPhone: '+40712345678',
    unsubscribed: false, bookingIds: [], propertyIds: ['prahova'],
    totalBookings: 1, totalSpent: 0, reviewSubmitted: false, tags: [], ...o,
  } as Guest;
}

beforeEach(() => { mockGetGuest.mockReset(); mockExecuteSend.mockReset(); });

describe('fillTemplate', () => {
  it('replaces name/property/link and leaves unknown placeholders untouched', () => {
    expect(fillTemplate('Salut {name}! {property} {link} {x}', { name: 'Ana', property: 'Chalet', link: 'URL' }))
      .toBe('Salut Ana! Chalet URL {x}');
  });
});

describe('renderMessages', () => {
  it('rotates variants within a language, fills tokens, appends the opt-out line', async () => {
    const guests: Record<string, Guest> = {
      g1: guest('g1', { firstName: 'Ana', language: 'ro' }),
      g2: guest('g2', { firstName: 'Ion', language: 'ro' }),
      g3: guest('g3', { firstName: 'John', language: 'en' }),
    };
    mockGetGuest.mockImplementation(async (id: string) => guests[id] ?? null);

    const { rendered, skipped } = await renderMessages({
      propertyId: 'prahova',
      guestIds: ['g1', 'g2', 'g3'],
      variants: [
        { language: 'ro', body: 'Salut {name}! Ai fost la {property}.' },
        { language: 'ro', body: 'Bună {name}! Te așteptăm la {property}.' },
        { language: 'en', body: 'Hi {name}! Come back to {property}: {link}' },
      ],
    });

    expect(skipped).toHaveLength(0);
    const byId = Object.fromEntries(rendered.map((m) => [m.guestId, m]));
    expect(byId.g1.variantIndex).toBe(0); // g1,g2 rotate the two RO variants (sorted by id)
    expect(byId.g2.variantIndex).toBe(1);
    expect(byId.g1.body).toContain('Salut Ana!');
    expect(byId.g1.body).toContain('Prahova Mountain Chalet');
    expect(byId.g2.body).toContain('Bună Ion!');
    expect(byId.g3.body).toContain('Hi John!');
    expect(byId.g3.body).toContain('https://prahova-chalet.ro/calendar/tok');
    expect(byId.g1.body.endsWith('Răspundeți STOP dacă nu mai doriți mesaje.')).toBe(true);
    expect(byId.g3.body.endsWith('Reply STOP to opt out.')).toBe(true);
  });

  it('skips guests with no phone / not found / no variant for their language', async () => {
    const guests: Record<string, Guest | null> = {
      ok: guest('ok', { language: 'ro' }),
      nophone: guest('nophone', { language: 'ro', normalizedPhone: undefined, phone: undefined }),
      missing: null,
      envariantless: guest('envariantless', { language: 'en' }),
    };
    mockGetGuest.mockImplementation(async (id: string) => guests[id] ?? null);

    const { rendered, skipped } = await renderMessages({
      propertyId: 'prahova',
      guestIds: ['ok', 'nophone', 'missing', 'envariantless'],
      variants: [{ language: 'ro', body: 'Salut {name}!' }], // RO only
    });

    expect(rendered.map((m) => m.guestId)).toEqual(['ok']);
    expect(Object.fromEntries(skipped.map((s) => [s.guestId, s.reason]))).toEqual({
      nophone: 'no-phone', missing: 'guest-not-found', envariantless: 'no-variant-for-language',
    });
  });
});

describe('queueMessages', () => {
  it('sends each rendered message through executeSend(manual_queue) and tallies queued', async () => {
    mockGetGuest.mockImplementation(async (id: string) => guest(id, { language: 'ro', firstName: id }));
    mockExecuteSend.mockResolvedValue({ status: 'queued', mode: 'live' });

    const res = await queueMessages({
      campaignId: 'c1', propertyId: 'prahova', guestIds: ['g1', 'g2'],
      variants: [{ language: 'ro', body: 'Salut {name}!' }],
    });

    expect(res.queued).toBe(2);
    expect(mockExecuteSend).toHaveBeenCalledTimes(2);
    expect(mockExecuteSend).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'whatsapp', deliveryMode: 'manual_queue', campaignId: 'c1', templateName: 'manual', propertyId: 'prahova',
    }));
    expect(mockExecuteSend.mock.calls[0][0].body).toContain('Salut');
  });

  it('counts a gateway skip (e.g. frequency-cap) as not queued', async () => {
    mockGetGuest.mockImplementation(async (id: string) => guest(id, { language: 'ro' }));
    mockExecuteSend.mockImplementation(async (req: { guestId: string }) =>
      req.guestId === 'g1' ? { status: 'queued', mode: 'live' } : { status: 'skipped', reason: 'frequency-cap', mode: 'live' });

    const res = await queueMessages({
      campaignId: 'c1', propertyId: 'prahova', guestIds: ['g1', 'g2'],
      variants: [{ language: 'ro', body: 'Salut {name}!' }],
    });

    expect(res.queued).toBe(1);
    expect(res.results.find((r) => r.guestId === 'g2')).toMatchObject({ status: 'skipped', reason: 'frequency-cap' });
  });
});
