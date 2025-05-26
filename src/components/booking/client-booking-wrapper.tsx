"use client";

import React from 'react';
import { BookingContainer } from '@/components/booking/container/BookingContainer';
import { BookingCheckLayout } from '@/components/booking/container/BookingCheckLayout';
import { useBooking } from '@/contexts/BookingContext';
import { format } from 'date-fns';
import { useCurrency } from '@/contexts/CurrencyContext';
import type { Property } from '@/types';

interface ClientBookingWrapperProps {
  property: Property;
  urlParams?: {
    checkIn?: string;
    checkOut?: string;
  };
  heroImage?: string | null;
}

export const ClientBookingWrapper = React.memo(function ClientBookingWrapper({ property, heroImage }: ClientBookingWrapperProps) {
  const { checkInDate, checkOutDate, numberOfNights, pricingDetails } = useBooking();
  const { formatPrice, selectedCurrency, convertToSelectedCurrency } = useCurrency();
  
  // Format dates for display
  let selectedDates = '';
  if (checkInDate && checkOutDate) {
    selectedDates = `${format(checkInDate, 'MMM d')} - ${format(checkOutDate, 'MMM d, yyyy')}`;
  }
  
  // REFACTORED: Now uses centralized pricing from BookingContext instead of direct API calls
  // No need for separate useEffect and API calls - pricing comes from BookingContext
  
  // Calculate total price using centralized pricing from BookingContext
  let totalPrice = '';
  if (pricingDetails) {
    const convertedAmount = convertToSelectedCurrency(pricingDetails.totalPrice, pricingDetails.currency);
    totalPrice = formatPrice(convertedAmount, selectedCurrency);
  } else if (numberOfNights > 0) {
    // Fallback to simple calculation when no centralized pricing available
    const nightlyRate = property.advertisedRate || property.pricePerNight || 0;
    const totalAmount = nightlyRate * numberOfNights;
    totalPrice = totalAmount > 0 ? formatPrice(totalAmount, selectedCurrency) : '';
  }
  
  return (
    <BookingCheckLayout
      property={property}
      checkInDate={checkInDate}
      checkOutDate={checkOutDate}
      numberOfNights={numberOfNights}
      totalPrice={totalPrice}
      selectedDates={selectedDates}
      heroImage={heroImage}
    >
      <BookingContainer property={property} />
    </BookingCheckLayout>
  );
});