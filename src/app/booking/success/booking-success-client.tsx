'use client';

import { useEffect } from 'react';
import { useBooking } from '@/contexts/BookingContext';
import { useSearchParams } from 'next/navigation';

interface BookingSuccessClientProps {
  children: React.ReactNode;
}

// This component wraps the success page content and is responsible for
// clearing booking data from storage
export default function BookingSuccessClient({ children }: BookingSuccessClientProps) {
  const { clearBookingData } = useBooking();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('booking_id');
  
  // Clear booking data on successful booking
  useEffect(() => {
    if (bookingId) {
      // We only clear data if we have a booking ID, which confirms a successful booking
      clearBookingData();
    }
  }, [bookingId, clearBookingData]);

  return <>{children}</>;
}