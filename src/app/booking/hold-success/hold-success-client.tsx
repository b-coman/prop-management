'use client';

import { useEffect } from 'react';
import { useBooking } from '@/contexts/BookingContext';
import { useSearchParams } from 'next/navigation';

interface HoldSuccessClientProps {
  children: React.ReactNode;
}

// This component wraps the hold success page content and is responsible for
// clearing booking data from storage after a successful hold
export default function HoldSuccessClient({ children }: HoldSuccessClientProps) {
  const { clearBookingData } = useBooking();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('booking_id');
  
  // Clear booking data on successful hold
  useEffect(() => {
    if (bookingId) {
      // We only clear data if we have a booking ID, which confirms a successful hold
      console.log('[HoldSuccessClient] Clearing booking data after successful hold payment');
      clearBookingData();
    }
  }, [bookingId, clearBookingData]);

  return <>{children}</>;
}