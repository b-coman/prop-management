/** @jest-environment jsdom */
import { purchaseEventId, trackMetaViewContent, trackMetaViewContentWhenReady, trackMetaPurchase } from '../meta-tracking';
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

/**
 * The race that cost ~70% of ViewContents on 19 Aug: `fbq` does not exist when the page mounts,
 * because the consent question is shown a beat after load. Accepting only STARTS the pixel script
 * loading, so a single check shortly afterwards still finds nothing.
 */
describe('trackMetaViewContentWhenReady', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  it('fires nothing while there is no consent', () => {
    const stop = trackMetaViewContentWhenReady(property);
    jest.advanceTimersByTime(30000);
    expect((window as unknown as { fbq?: unknown }).fbq).toBeUndefined();
    stop();
  });

  it('fires once the pixel appears AFTER a late accept, not just within a moment of it', () => {
    const stop = trackMetaViewContentWhenReady(property);
    // Visitor reads the page, then accepts 20s in - past the initial wait window.
    jest.advanceTimersByTime(20000);
    window.dispatchEvent(new CustomEvent('consent-updated', { detail: { marketing: true } }));
    // The script takes a further 2s to load and define fbq. The old code checked once at 300ms.
    jest.advanceTimersByTime(2000);
    const fbq = jest.fn();
    (window as unknown as { fbq: unknown }).fbq = fbq;
    jest.advanceTimersByTime(1000);
    expect(fbq).toHaveBeenCalledWith('track', 'ViewContent', expect.objectContaining({
      content_ids: ['prahova-mountain-chalet'],
    }));
    stop();
  });

  it('fires at most once, however long the pixel stays loaded', () => {
    const fbq = jest.fn();
    (window as unknown as { fbq: unknown }).fbq = fbq;
    const stop = trackMetaViewContentWhenReady(property);
    jest.advanceTimersByTime(1000);
    window.dispatchEvent(new CustomEvent('consent-updated', { detail: { marketing: true } }));
    jest.advanceTimersByTime(20000);
    expect(fbq.mock.calls.filter((c) => c[1] === 'ViewContent')).toHaveLength(1);
    stop();
  });

  it('gives up rather than polling forever when consent never comes', () => {
    const stop = trackMetaViewContentWhenReady(property);
    jest.advanceTimersByTime(60000);
    const fbq = jest.fn();
    (window as unknown as { fbq: unknown }).fbq = fbq;
    jest.advanceTimersByTime(10000);
    expect(fbq).not.toHaveBeenCalled();
    stop();
  });
});
