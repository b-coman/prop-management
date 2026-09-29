/** @jest-environment node */

// The bug this guards: `property.hostInfo` does not exist on any property here, so the
// confirmation email's host name and phone were always undefined and the template silently
// dropped both lines. Every guest got an address and no phone number.
jest.mock('@/lib/firebaseAdminSafe', () => ({ getAdminDb: jest.fn() }));
jest.mock('@/lib/logger', () => ({ loggers: { email: { warn: jest.fn() } } }));

import { resolveGuideFacts, deriveHostContact, deriveArrivalFacts, formatPhoneForDisplay } from '../guide-facts';
import { getAdminDb } from '@/lib/firebaseAdminSafe';

const mockDb = (overrideData: any) => ({
  collection: () => ({ doc: () => ({ get: async () => ({ data: () => overrideData }) }) }),
});

const GUIDE = {
  guestGuide: {
    contacts: [
      { displayName: { en: 'Bogdan', ro: 'Bogdan' }, role: { en: 'Your host', ro: 'Gazda' }, phone: '+40723200868' },
      { displayName: { en: 'Corina & Gigi' }, role: { en: 'They look after the house' }, phone: '+40726000000' },
    ],
  },
};

describe('deriveHostContact (pure — the fallback ladder)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads the FIRST guide contact, localised to the guest language', async () => {
        expect(deriveHostContact(GUIDE.guestGuide, {}, 'ro')).toEqual({
      name: 'Bogdan', role: 'Gazda', phone: '+40723200868', phoneDisplay: '0723200868',
    });
    expect(deriveHostContact(GUIDE.guestGuide, {}, 'en').role).toBe('Your host');
  });

  it('prefers the guide over property fields, so the two can never disagree', async () => {
        const out = deriveHostContact(GUIDE.guestGuide, { contactPhone: '+40999999999' }, 'en');
    expect(out.phone).toBe('+40723200868');
  });

  it('falls back to property.hostInfo when a property has one (other properties may)', async () => {
        expect(deriveHostContact(undefined, { hostInfo: { name: 'Ana', phone: '+40711111111' } }, 'en'))
      .toEqual({ name: 'Ana', phone: '+40711111111', phoneDisplay: '+40711111111' });
  });

  it('falls back to contactPhone — a bare number beats nothing', async () => {
        expect(deriveHostContact(undefined, { contactPhone: '+40723200868' }, 'ro').phone)
      .toBe('+40723200868');
  });

  it('ignores a guide contact with no phone and falls through', async () => {
        expect(deriveHostContact({ contacts: [{ displayName: 'Nobody' }] }, { contactPhone: '+40723200868' }, 'en').phone)
      .toBe('+40723200868');
  });

  it('NEVER throws — a confirmation with no phone still beats no confirmation', async () => {
    (getAdminDb as jest.Mock).mockRejectedValue(new Error('firestore down'));
    await expect(resolveGuideFacts('p', { contactPhone: '+40723200868' }, 'en'))
      .resolves.toEqual({
        host: { name: undefined, phone: '+40723200868', phoneDisplay: '+40723200868' },
        arrival: {},
      });
  });

  it('returns empty rather than exploding when there is nothing anywhere', async () => {
        expect(deriveHostContact(undefined, {}, 'en')).toEqual({ name: undefined, phone: undefined, phoneDisplay: undefined });
  });
});

// A Romanian reads and dials 0723200868. Anyone abroad needs the +40. So the printed form is
// localised while the tel: href stays E.164 - the link still works from a foreign SIM.
describe('formatPhoneForDisplay', () => {
  it('drops the +40 for Romanian readers', () => {
    expect(formatPhoneForDisplay('+40723200868', 'ro')).toBe('0723200868');
  });

  it('keeps the country code for everyone else — for them it IS a foreign number', () => {
    expect(formatPhoneForDisplay('+40723200868', 'en')).toBe('+40723200868');
    expect(formatPhoneForDisplay('+40723200868', 'de')).toBe('+40723200868');
  });

  it('leaves a number that is already national alone', () => {
    expect(formatPhoneForDisplay('0723200868', 'ro')).toBe('0723200868');
  });

  it('does not nationalise a foreign number for a Romanian reader', () => {
    expect(formatPhoneForDisplay('+49301234567', 'ro')).toBe('+49301234567');
  });

  it('returns undefined for nothing', () => {
    expect(formatPhoneForDisplay(undefined, 'ro')).toBeUndefined();
    expect(formatPhoneForDisplay('  ', 'ro')).toBeUndefined();
  });
});

// The two derivations used to be separate async functions that each fetched the SAME
// propertyOverrides document, so the pre-arrival path read it twice for no reason.
describe('resolveGuideFacts', () => {
  it('reads the overrides document exactly once and derives both from it', async () => {
    const get = jest.fn(async () => ({ data: () => GUIDE }));
    (getAdminDb as jest.Mock).mockResolvedValue({ collection: () => ({ doc: () => ({ get }) }) });

    const facts = await resolveGuideFacts('p', {}, 'ro');

    expect(get).toHaveBeenCalledTimes(1);
    expect(facts.host.phoneDisplay).toBe('0723200868');
    expect(facts.arrival).toEqual({});
  });

  it('derives the arrival card from the same read', async () => {
    const guide = { guestGuide: { ...GUIDE.guestGuide, arrival: {
      wazeUrl: 'https://waze/x', mapsUrl: 'https://maps/y', gateNumber: 197,
      call: { ro: 'Sună-l pe Bogdan', en: 'Call Bogdan' },
    } } };
    const get = jest.fn(async () => ({ data: () => guide }));
    (getAdminDb as jest.Mock).mockResolvedValue({ collection: () => ({ doc: () => ({ get }) }) });

    const facts = await resolveGuideFacts('p', {}, 'ro');

    expect(get).toHaveBeenCalledTimes(1);
    expect(facts.arrival).toEqual({
      wazeUrl: 'https://waze/x', mapsUrl: 'https://maps/y',
      gateNumber: '197', callNote: 'Sună-l pe Bogdan',
    });
  });
});
