/** @jest-environment node */
import { matchesDefinition, resolveChannel, PREDEFINED_SEGMENTS } from '../segmentService';
import type { Guest } from '@/types';

function guest(overrides: Partial<Guest> = {}): Guest {
  return {
    id: 'g1',
    firstName: 'Test',
    language: 'en',
    bookingIds: ['b1'],
    propertyIds: ['prahova-mountain-chalet'],
    totalBookings: 1,
    totalSpent: 1000,
    currency: 'RON',
    firstBookingDate: new Date(Date.UTC(2024, 0, 1)) as unknown as Guest['firstBookingDate'],
    lastBookingDate: new Date(Date.UTC(2025, 0, 1)) as unknown as Guest['lastBookingDate'],
    reviewSubmitted: false,
    tags: [],
    unsubscribed: false,
    createdAt: new Date() as unknown as Guest['createdAt'],
    updatedAt: new Date() as unknown as Guest['updatedAt'],
    ...overrides,
  } as Guest;
}

const NOW = new Date(Date.UTC(2026, 0, 1)); // fixed reference

describe('segmentService.resolveChannel', () => {
  it('prefers WhatsApp when a phone exists', () => {
    expect(resolveChannel({ normalizedPhone: '+40712345678' })).toBe('whatsapp');
    expect(resolveChannel({ phone: '0712345678' })).toBe('whatsapp');
  });
  it('falls back to email', () => {
    expect(resolveChannel({ email: 'a@b.com' })).toBe('email');
  });
  it('returns null when unreachable', () => {
    expect(resolveChannel({})).toBeNull();
  });
});

describe('segmentService.matchesDefinition', () => {
  it('excludes unsubscribed by default, includes when opted out of exclusion', () => {
    expect(matchesDefinition(guest({ unsubscribed: true }), {}, NOW)).toBe(false);
    expect(matchesDefinition(guest({ unsubscribed: true }), { excludeUnsubscribed: false }, NOW)).toBe(true);
  });
  it('filters by propertyId', () => {
    const def = { propertyId: 'prahova-mountain-chalet' };
    expect(matchesDefinition(guest(), def, NOW)).toBe(true);
    expect(matchesDefinition(guest({ propertyIds: ['other'] }), def, NOW)).toBe(false);
  });
  it('filters repeat guests by minTotalBookings', () => {
    expect(matchesDefinition(guest({ totalBookings: 1 }), { minTotalBookings: 2 }, NOW)).toBe(false);
    expect(matchesDefinition(guest({ totalBookings: 3 }), { minTotalBookings: 2 }, NOW)).toBe(true);
  });
  it('filters by countryIn (requires a known country)', () => {
    expect(matchesDefinition(guest({ country: 'RO' }), { countryIn: ['RO'] }, NOW)).toBe(true);
    expect(matchesDefinition(guest({ country: 'IL' }), { countryIn: ['RO'] }, NOW)).toBe(false);
    expect(matchesDefinition(guest({ country: undefined }), { countryIn: ['RO'] }, NOW)).toBe(false);
  });
  it('normalizes country names/aliases before matching (H3)', () => {
    expect(matchesDefinition(guest({ country: 'Romania' }), { countryIn: ['RO'] }, NOW)).toBe(true);
    expect(matchesDefinition(guest({ country: 'Romania' }), { countryNotIn: ['RO'] }, NOW)).toBe(false);
  });
  it('countryNotIn requires a KNOWN country — unknown is NOT foreign (M3)', () => {
    expect(matchesDefinition(guest({ country: 'IL' }), { countryNotIn: ['RO'] }, NOW)).toBe(true);
    expect(matchesDefinition(guest({ country: 'RO' }), { countryNotIn: ['RO'] }, NOW)).toBe(false);
    expect(matchesDefinition(guest({ country: undefined }), { countryNotIn: ['RO'] }, NOW)).toBe(false);
  });
  it('requires a phone for hasChannel whatsapp', () => {
    expect(matchesDefinition(guest({ normalizedPhone: '+40712345678', email: undefined }), { hasChannel: 'whatsapp' }, NOW)).toBe(true);
    expect(matchesDefinition(guest({ normalizedPhone: undefined, phone: undefined, email: 'a@b.com' }), { hasChannel: 'whatsapp' }, NOW)).toBe(false);
  });
  it('filters by lastStaySeason', () => {
    const winterStay = guest({ lastStayDate: new Date(Date.UTC(2025, 0, 15)) as unknown as Guest['lastStayDate'] });
    expect(matchesDefinition(winterStay, { lastStaySeason: ['winter'] }, NOW)).toBe(true);
    expect(matchesDefinition(winterStay, { lastStaySeason: ['summer'] }, NOW)).toBe(false);
  });
  it('filters by monthsSinceLastBooking', () => {
    // lastBookingDate = 2025-01-01, NOW = 2026-01-01 => 12 months
    expect(matchesDefinition(guest(), { monthsSinceLastBooking: { min: 6 } }, NOW)).toBe(true);
    expect(matchesDefinition(guest(), { monthsSinceLastBooking: { max: 6 } }, NOW)).toBe(false);
  });
  it('filters by tagsInclude', () => {
    expect(matchesDefinition(guest({ tags: ['vip'] }), { tagsInclude: ['vip'] }, NOW)).toBe(true);
    expect(matchesDefinition(guest({ tags: [] }), { tagsInclude: ['vip'] }, NOW)).toBe(false);
  });
  it('ANDs multiple conditions', () => {
    const g = guest({ country: 'RO', totalBookings: 2, normalizedPhone: '+40712345678' });
    expect(matchesDefinition(g, { countryIn: ['RO'], minTotalBookings: 2, hasChannel: 'whatsapp' }, NOW)).toBe(true);
    expect(matchesDefinition(g, { countryIn: ['RO'], minTotalBookings: 5 }, NOW)).toBe(false);
  });
});

describe('segmentService.PREDEFINED_SEGMENTS', () => {
  it('builds coherent definitions', () => {
    expect(PREDEFINED_SEGMENTS.repeatGuests('p1')).toEqual({ minTotalBookings: 2, propertyId: 'p1' });
    expect(PREDEFINED_SEGMENTS.romanian()).toEqual({ countryIn: ['RO'], propertyId: undefined });
    expect(PREDEFINED_SEGMENTS.foreign('p1')).toEqual({ countryNotIn: ['RO'], propertyId: 'p1' });
    expect(PREDEFINED_SEGMENTS.lastStayedInSeason('winter', 'p1')).toEqual({ lastStaySeason: ['winter'], propertyId: 'p1' });
  });
});
