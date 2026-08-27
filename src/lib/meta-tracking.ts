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
 * The fields a ViewContent actually needs, declared structurally rather than as
 * `Property`.
 *
 * A full `Property` satisfies this, and so does a campaign landing page's render
 * model — which never loads a `Property` and therefore fired NOTHING. Measured
 * 6-18 Aug: the campaign pointed at /ro produced 88 ViewContents off 177 landing
 * views; the two pointed at /lp produced zero off 196. The whole point of paid
 * traffic here is to build a retargeting audience, and the pages the ads actually
 * point at were the only ones not contributing to one.
 */
export interface ViewedProperty {
  slug: string;
  pricePerNight?: number;
  baseCurrency?: string;
}

/**
 * Browser ViewContent for a property or campaign landing page — the key
 * retargeting-audience signal ("people who viewed a property"). Browser-only; no
 * server equivalent, so no dedup needed.
 */
export function trackMetaViewContent(property: ViewedProperty): void {
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
 * Fire ViewContent as soon as the Pixel EXISTS, which is almost never at mount.
 *
 * `fbq` is only defined once marketing consent is granted and the pixel script has executed. The
 * consent question is deliberately shown a beat after load, so at mount the answer is reliably "no
 * pixel yet" and a one-shot call no-ops. Firing once on a `consent-updated` event is not enough
 * either: accepting only STARTS the script loading, so a single check 300ms later usually still
 * finds nothing.
 *
 * Measured on the live pixel, 19 Aug 06:00-07:00 UTC: 14 people accepted, 14 PageViews fired, and
 * only 4 ViewContents. The PageView comes from the pixel's own init snippet so it cannot lose that
 * race; ViewContent was losing it about 70% of the time.
 *
 * So: poll for `fbq`, briefly, with the window extended each time consent changes. Fires at most
 * once, never without consent, and gives up rather than spinning. Returns a cleanup function.
 */
const FBQ_WAIT_ON_LOAD_MS = 8000;
const FBQ_WAIT_AFTER_CONSENT_MS = 15000;
const FBQ_POLL_MS = 300;

export function trackMetaViewContentWhenReady(property: ViewedProperty): () => void {
  if (typeof window === 'undefined') return () => {};
  let fired = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let deadline = performance.now() + FBQ_WAIT_ON_LOAD_MS;

  const attempt = (): boolean => {
    if (fired) return true;
    if (!getFbq()) return false;
    fired = true;
    trackMetaViewContent(property);
    return true;
  };

  const pump = () => {
    if (attempt() || performance.now() > deadline) {
      timer = null;
      return;
    }
    timer = setTimeout(pump, FBQ_POLL_MS);
  };
  const start = () => {
    if (timer === null && !fired) pump();
  };

  // Accepting restarts the wait, because that is the moment the script begins loading.
  const onConsent = () => {
    deadline = performance.now() + FBQ_WAIT_AFTER_CONSENT_MS;
    start();
  };
  window.addEventListener('consent-updated', onConsent);
  start();

  return () => {
    window.removeEventListener('consent-updated', onConsent);
    if (timer !== null) clearTimeout(timer);
  };
}

/**
 * `Contact` — someone opened WhatsApp or tapped the phone number from the booking page.
 *
 * WHY BOTHER, GIVEN THE VOLUME. The ad set optimises on CONTENT_VIEW, which on a one-property site
 * is barely more selective than "arrived and the pixel fired". This is real intent: a person who
 * opens a conversation about specific dates is far closer to booking than one who scrolled a page.
 * `Contact` is a Meta STANDARD event, so it needs no custom-conversion plumbing.
 *
 * It will NOT be usable as an optimisation target for a long time — at current traffic it is a
 * couple of events a week against Meta's ~50/week learning threshold, and switching the ad set to
 * it would starve delivery. That is exactly why it starts now: pixel history cannot be created
 * retroactively, so the option only exists in a few months if the collecting begins today.
 *
 * Fire-and-forget, and silent without consent — `fbq` does not exist until the pixel loads, so this
 * no-ops for anyone who declined, which is the correct behaviour rather than a gap.
 */
export function trackMetaContact(channel: 'whatsapp' | 'call'): void {
  const fbq = getFbq();
  if (!fbq) return;
  fbq('track', 'Contact', { content_category: channel });
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
