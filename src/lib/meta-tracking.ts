/**
 * Client-side Meta Pixel (fbq) event helpers.
 *
 * These are NO-OPS unless `window.fbq` exists — and fbq is only loaded after the
 * visitor grants *marketing* consent (see components/tracking/meta-pixel.tsx).
 * So calling these without consent silently does nothing (GDPR-safe).
 *
 * Deduplication: browser events that also fire server-side via the Conversions
 * API (Purchase) use a DETERMINISTIC eventID derived from the stable business
 * key (bookingId). The server CAPI uses the exact same id, so Meta counts the
 * action once regardless of which arrives first. See src/lib/meta-capi.ts.
 */
import type { Booking, Property } from '@/types';

type Fbq = (...args: unknown[]) => void;

function getFbq(): Fbq | null {
  if (typeof window === 'undefined') return null;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  return typeof fbq === 'function' ? fbq : null;
}

/** Deterministic Purchase eventID shared by browser + server for dedup. */
export function purchaseEventId(bookingId: string): string {
  return `purchase_${bookingId}`;
}

/**
 * Browser ViewContent for a property page — the key retargeting-audience signal
 * ("people who viewed a property"). Browser-only; no server equivalent, so no
 * dedup needed.
 */
export function trackMetaViewContent(property: Property): void {
  const fbq = getFbq();
  if (!fbq || !property?.slug) return;
  const data: Record<string, unknown> = {
    content_ids: [property.slug],
    content_type: 'product',
  };
  if (typeof property.pricePerNight === 'number') {
    data.value = property.pricePerNight;
    data.currency = property.baseCurrency || 'RON';
  }
  fbq('track', 'ViewContent', data);
}

/**
 * Browser Purchase on the booking-success page — deduped against the server-side
 * CAPI Purchase via the deterministic eventID.
 */
export function trackMetaPurchase(booking: Booking, property?: Property): void {
  const fbq = getFbq();
  if (!fbq || !booking?.id) return;
  fbq(
    'track',
    'Purchase',
    {
      value: booking.pricing?.total ?? 0,
      currency: booking.pricing?.currency ?? property?.baseCurrency ?? 'RON',
      content_ids: [booking.propertyId],
      content_type: 'product',
    },
    { eventID: purchaseEventId(booking.id) }
  );
}
