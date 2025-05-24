"use client";

import React from 'react';
import { BookingContainer } from '@/components/booking/container/BookingContainer';
import { BookingCheckLayout } from '@/components/booking/container/BookingCheckLayout';
import { useLanguage } from '@/hooks/useLanguage';
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

export const ClientBookingWrapper = React.memo(function ClientBookingWrapper({ property, urlParams, heroImage }: ClientBookingWrapperProps) {
  const { tc } = useLanguage();
  const { checkInDate, checkOutDate, numberOfNights, numberOfGuests, pricingDetails } = useBooking();
  const { formatPrice, selectedCurrency, convertToSelectedCurrency } = useCurrency();
  
  // Translate all multilingual fields in the property object
  const translatedProperty = {
    ...property,
    name: typeof property.name === 'string' ? property.name : tc(property.name),
    shortDescription: typeof property.shortDescription === 'string' 
      ? property.shortDescription 
      : tc(property.shortDescription),
    description: typeof property.description === 'string'
      ? property.description
      : tc(property.description),
    advertisedRateType: typeof property.advertisedRateType === 'string'
      ? property.advertisedRateType
      : tc(property.advertisedRateType)
  };
  
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
    console.log('[ClientBookingWrapper] 💰 Using centralized pricing from BookingContext');
    const convertedAmount = convertToSelectedCurrency(pricingDetails.totalPrice, pricingDetails.currency);
    totalPrice = formatPrice(convertedAmount, selectedCurrency);
  } else if (numberOfNights > 0) {
    console.log('[ClientBookingWrapper] 💰 Using fallback pricing calculation');
    // Fallback to simple calculation when no centralized pricing available
    const nightlyRate = property.advertisedRate || property.baseRate || 0;
    const totalAmount = nightlyRate * numberOfNights;
    totalPrice = totalAmount > 0 ? formatPrice(totalAmount, selectedCurrency) : '';
  }
  
  return (
    <BookingCheckLayout
      property={translatedProperty}
      checkInDate={checkInDate}
      checkOutDate={checkOutDate}
      numberOfNights={numberOfNights}
      totalPrice={totalPrice}
      selectedDates={selectedDates}
      heroImage={heroImage}
    >
      <BookingContainer property={translatedProperty} />
    </BookingCheckLayout>
  );
});