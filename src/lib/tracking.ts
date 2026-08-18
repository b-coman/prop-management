/**
 * GTM dataLayer push utilities for GA4 ecommerce events.
 * All functions are no-ops when window.dataLayer is undefined (SSR-safe).
 */

import type { Property, Booking } from '@/types';

interface BookingPricingForTracking {
  total: number;
  currency: string;
  baseRate: number;
  numberOfNights: number;
  cleaningFee?: number;
}

/**
 * Push a generic event to the GTM dataLayer.
 */
export function trackEvent(event: string, data?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.dataLayer) return;
  window.dataLayer.push({ event, ...data });
}

/**
 * Every parameter a UI-interaction event can carry, in one list.
 *
 * GTM's dataLayer is a PERSISTENT model — a variable keeps its last value until something overwrites
 * it. Verified on the wire 2026-08-18: a `check_dates_click` arrived carrying `stay_dates` from an
 * earlier `select_item`, and a `scroll_depth` arrived carrying `position`. Left alone, that silently
 * mis-attributes exactly the reports these events exist to feed.
 *
 * So every UI event emits the FULL key set, `undefined` for the keys it does not use, which clears the
 * stale ones. This lives here rather than in each component so a new event cannot forget it — the same
 * guard `trackEcommerceEvent` applies to `ecommerce`.
 */
const UI_PARAMS = [
  'position', 'stay_dates', 'stay_nights', 'stay_guests', 'value',
  'percent_scrolled', 'destination',
  'photo_index', 'photo_id', 'photo_tag', 'gallery_filter',
  'booking_outcome', 'booking_action',
] as const;

export function trackUiEvent(event: string, params: Record<string, unknown> = {}) {
  const payload: Record<string, unknown> = {};
  for (const k of UI_PARAMS) payload[k] = params[k];
  // Anything not in the list (campaign, landing, phone, source...) passes through untouched.
  for (const [k, v] of Object.entries(params)) if (!(k in payload)) payload[k] = v;
  trackEvent(event, payload);
}

/**
 * Push an ecommerce event — clears ecommerce first (GA4 best practice).
 */
export function trackEcommerceEvent(
  event: string,
  ecommerce: object,
  userData?: object
) {
  if (typeof window === 'undefined' || !window.dataLayer) return;
  // Clear previous ecommerce data
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({
    event,
    ecommerce,
    ...(userData ? { user_data: userData } : {}),
  });
}

function propertyToItem(property: Property, price?: number) {
  return {
    item_id: property.slug,
    item_name: typeof property.name === 'string' ? property.name : property.name?.en || property.slug,
    item_category: 'Vacation Rental',
    item_category2: property.propertyType || undefined,
    item_category3: property.location?.city || undefined,
    price: price ?? property.pricePerNight ?? undefined,
    quantity: 1,
  };
}

/**
 * Fire `view_item` event when a property page is viewed.
 */
export function trackViewItem(property: Property) {
  trackEcommerceEvent('view_item', {
    currency: 'EUR',
    value: property.pricePerNight ?? 0,
    items: [propertyToItem(property)],
  });
}

/**
 * Fire `begin_checkout` when guest starts the booking process.
 */
export function trackBeginCheckout(
  property: Property,
  pricing: BookingPricingForTracking,
  dates: { checkIn: string; checkOut: string },
  guests: number
) {
  trackEcommerceEvent('begin_checkout', {
    currency: pricing.currency,
    value: pricing.total,
    items: [propertyToItem(property, pricing.baseRate)],
    check_in_date: dates.checkIn,
    check_out_date: dates.checkOut,
    number_of_guests: guests,
    number_of_nights: pricing.numberOfNights,
  });
}

/**
 * Fire `purchase` on booking success page.
 * Returns the event_id used (for Meta CAPI dedup).
 */
export function trackPurchase(
  booking: Booking,
  property: Property
): string {
  const eventId = crypto.randomUUID();
  const price = booking.pricing?.baseRate ?? 0;

  trackEcommerceEvent(
    'purchase',
    {
      transaction_id: booking.id,
      value: booking.pricing?.total ?? 0,
      currency: booking.pricing?.currency ?? 'EUR',
      items: [propertyToItem(property, price)],
      check_in_date: booking.checkInDate,
      check_out_date: booking.checkOutDate,
      number_of_guests: booking.numberOfGuests,
      number_of_nights: booking.pricing?.numberOfNights,
      event_id: eventId,
    },
    booking.guestInfo?.email
      ? {
          email: booking.guestInfo.email,
          phone_number: booking.guestInfo.phone || undefined,
        }
      : undefined
  );

  return eventId;
}

/**
 * Fire `generate_lead` when an inquiry is submitted.
 */
export function trackGenerateLead(property: Property, value?: number) {
  trackEcommerceEvent('generate_lead', {
    currency: 'EUR',
    value: value ?? 0,
    items: [propertyToItem(property)],
  });
}
