/** @jest-environment node */

// These builders are pure, so the payload assembly is finally testable — it never was while it
// lived inside the send functions. Two of the assertions below (extraGuestFee, specialRequests)
// cover fields that the old hand-written preview script silently omitted: they were in the real
// email and invisible to the owner reviewing copy. No booking has triggered either yet.
import { buildConfirmationPayload, buildPreArrivalPayload } from '../guestEmailPayloads';

const BOOKING: any = {
  id: 'B1',
  guestInfo: { firstName: 'Musat', lastName: 'Liviu', email: 'g@example.com' },
  checkInDate: new Date('2026-10-02T00:00:00Z'),
  checkOutDate: new Date('2026-10-04T00:00:00Z'),
  numberOfGuests: 3,
  numberOfAdults: 3,
  pricing: { numberOfNights: 2, baseRate: 526.5, cleaningFee: 200, total: 1253, currency: 'RON' },
  paymentInfo: { status: 'succeeded', paidAt: new Date('2026-09-29T00:00:00Z') },
};

const PROPERTY: any = {
  checkInTime: '3:00 PM',
  checkOutTime: '11:00 AM',
  location: { address: 'Strada Secăriei nr 197', city: 'Comarnic', state: 'Prahova', country: 'Romania' },
  cancellationPolicy: { en: 'Free cancellation...', ro: 'Anulare gratuită...' },
};

const GUIDE: any = {
  host: { name: 'Bogdan', role: 'Gazda', phone: '+40723200868', phoneDisplay: '0723200868' },
  arrival: { wazeUrl: 'https://waze/x', mapsUrl: 'https://maps/y', gateNumber: '197', callNote: 'Sună-l pe Bogdan' },
};

const ctx = (over: any = {}): any => ({
  booking: BOOKING, property: PROPERTY, propertyName: 'Prahova Mountain Chalet',
  language: 'ro', brand: undefined, guide: GUIDE, guideUrl: 'https://x/g/B1?t=abc', ...over,
});

describe('buildConfirmationPayload', () => {
  it('prints the phone the way the guest reads it, not E.164', () => {
    expect(buildConfirmationPayload(ctx()).hostPhone).toBe('0723200868');
  });

  it('formats clock times for the language', () => {
    expect(buildConfirmationPayload(ctx()).checkInTime).toBe('15:00');
    expect(buildConfirmationPayload(ctx({ language: 'en' })).checkInTime).toBe('3:00 PM');
  });

  it('picks the cancellation policy in the guest language', () => {
    expect(buildConfirmationPayload(ctx()).cancellationPolicy).toBe('Anulare gratuită...');
    expect(buildConfirmationPayload(ctx({ language: 'en' })).cancellationPolicy).toBe('Free cancellation...');
  });

  // The preview omitted this field entirely. A 6-guest booking would show it to the guest and
  // not to the owner.
  it('carries extraGuestFee when the booking has one, and omits it when it does not', () => {
    expect(buildConfirmationPayload(ctx()).extraGuestFee).toBeUndefined();
    const withFee = ctx({ booking: { ...BOOKING, pricing: { ...BOOKING.pricing, extraGuestFee: 60 } } });
    expect(buildConfirmationPayload(withFee).extraGuestFee).toBeTruthy();
  });

  // Same: the preview never showed a guest's note back to the owner.
  it('carries specialRequests through', () => {
    const withNote = ctx({ booking: { ...BOOKING, specialRequests: 'Ajungem târziu' } });
    expect(buildConfirmationPayload(withNote).specialRequests).toBe('Ajungem târziu');
  });

  it('marks paid only when the payment actually succeeded', () => {
    expect(buildConfirmationPayload(ctx()).isPaid).toBe(true);
    const pending = ctx({ booking: { ...BOOKING, paymentInfo: { status: 'pending' } } });
    expect(buildConfirmationPayload(pending).isPaid).toBe(false);
  });

  it('passes the guide link straight through', () => {
    expect(buildConfirmationPayload(ctx()).guideUrl).toBe('https://x/g/B1?t=abc');
    expect(buildConfirmationPayload(ctx({ guideUrl: undefined })).guideUrl).toBeUndefined();
  });

  it('builds the address from the property location', () => {
    expect(buildConfirmationPayload(ctx()).propertyAddress).toContain('Strada Secăriei nr 197');
    expect(buildConfirmationPayload(ctx({ property: {} })).propertyAddress).toBeUndefined();
  });
});

describe('buildPreArrivalPayload', () => {
  it('maps the arrival facts from the guide', () => {
    const p = buildPreArrivalPayload(ctx());
    expect(p.wazeUrl).toBe('https://waze/x');
    expect(p.gateNumber).toBe('197');
  });

  it('splits display from dial: local text, E.164 href', () => {
    const p = buildPreArrivalPayload(ctx());
    expect(p.hostPhone).toBe('0723200868');
    expect(p.hostPhoneHref).toBe('+40723200868');
  });

  it('degrades cleanly when the guide has no arrival block', () => {
    const p = buildPreArrivalPayload(ctx({ guide: { host: GUIDE.host, arrival: {} } }));
    expect(p.wazeUrl).toBeUndefined();
    expect(p.gateNumber).toBeUndefined();
    expect(p.hostPhone).toBe('0723200868');
  });
});
