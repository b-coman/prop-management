'use client';

import type { Booking } from '@/types';
import { usePropertySelector } from '@/contexts/PropertySelectorContext';
import { BookingTable } from './booking-table';
import { EmptyState } from '@/components/admin';
import { CalendarCheck } from 'lucide-react';

interface BookingsWithFilterProps {
  bookings: Booking[];
}

export function BookingsWithFilter({ bookings }: BookingsWithFilterProps) {
  const { selectedPropertyId } = usePropertySelector();

  const filtered = selectedPropertyId
    ? bookings.filter(b => b.propertyId === selectedPropertyId)
    : bookings;

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title={selectedPropertyId ? 'No bookings for this property' : 'No bookings yet'}
        description={
          selectedPropertyId
            ? 'Select "All Properties" to see all bookings'
            : 'Bookings will appear here when guests make reservations'
        }
      />
    );
  }

  return <BookingTable bookings={filtered} />;
}
