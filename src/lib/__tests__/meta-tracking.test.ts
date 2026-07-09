/** @jest-environment jsdom */
import { purchaseEventId, trackMetaViewContent, trackMetaPurchase } from '../meta-tracking';
import type { Booking, Property } from '@/types';

const property = { slug: 'prahova-mountain-chalet', pricePerNight: 450, baseCurrency: 'RON' } as unknown as Property;
const booking = { id: 'bk123', propertyId: 'prahova-mountain-chalet', pricing: { total: 1350, currency: 'RON' } } as unknown as Booking;

afterEach(() => {
  delete (window as unknown as { fbq?: unknown }).fbq;
});

describe('purchaseEventId', () => {
  it('derives a deterministic id from the booking id (shared with server CAPI)', () => {
    expect(purchaseEventId('bk123')).toBe('purchase_bk123');
  });
});

describe('trackMetaViewContent', () => {
  it('fires fbq ViewContent with content + value when fbq is present', () => {
    const fbq = jest.fn();
    (window as unknown as { fbq: unknown }).fbq = fbq;
    trackMetaViewContent(property);
    expect(fbq).toHaveBeenCalledWith('track', 'ViewContent', {
      content_ids: ['prahova-mountain-chalet'],
      content_type: 'product',
      value: 450,
      currency: 'RON',
    });
  });
  it('is a no-op without consent (fbq undefined)', () => {
    expect(() => trackMetaViewContent(property)).not.toThrow();
  });
});

describe('trackMetaPurchase', () => {
  it('fires fbq Purchase with the deterministic eventID for dedup', () => {
    const fbq = jest.fn();
    (window as unknown as { fbq: unknown }).fbq = fbq;
    trackMetaPurchase(booking, property);
    expect(fbq).toHaveBeenCalledWith(
      'track',
      'Purchase',
      { value: 1350, currency: 'RON', content_ids: ['prahova-mountain-chalet'], content_type: 'product' },
      { eventID: 'purchase_bk123' }
    );
  });
  it('is a no-op without consent (fbq undefined)', () => {
    expect(() => trackMetaPurchase(booking, property)).not.toThrow();
  });
});
