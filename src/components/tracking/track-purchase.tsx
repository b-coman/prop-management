"use client";

import { useEffect, useRef } from 'react';
import { trackPurchase } from '@/lib/tracking';
import { trackMetaPurchase } from '@/lib/meta-tracking';
import type { Booking, Property } from '@/types';

interface TrackPurchaseProps {
  booking: Booking;
  property: Property;
}

export function TrackPurchase({ booking, property }: TrackPurchaseProps) {
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    // Only fire for successful conversions, and only once per booking ID
    if (!booking?.id) return;
    if (booking.status !== 'confirmed' && booking.status !== 'on-hold') return;
    if (firedRef.current === booking.id) return;

    // The ref alone only survives within one page life. A guest who refreshes this page, or reopens
    // it from their confirmation email, would fire `purchase` a second time - and GA4 does NOT
    // deduplicate by transaction_id, so the booking would be counted twice at double the revenue.
    // Meta is unaffected (it dedupes on the deterministic purchaseEventId), which is exactly why this
    // was invisible: the defect only shows up in GA4, and only on a booking that has never happened.
    // localStorage rather than sessionStorage so the guard survives closing the tab.
    const key = `purchase_tracked_${booking.id}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch {
      // Private mode or storage disabled: fall through on the ref alone rather than lose the
      // conversion entirely. A duplicate is better than never recording the sale.
    }

    firedRef.current = booking.id;
    trackPurchase(booking, property);          // GA4 purchase (GTM dataLayer)
    trackMetaPurchase(booking, property);      // Meta Pixel Purchase, deduped w/ server CAPI
  }, [booking, property]);

  return null;
}
