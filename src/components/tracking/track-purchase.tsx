"use client";

import { useEffect, useRef } from 'react';
import { trackPurchase } from '@/lib/tracking';
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

    firedRef.current = booking.id;
    trackPurchase(booking, property);
  }, [booking, property]);

  return null;
}
