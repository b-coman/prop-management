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
}

export function ClientBookingWrapper({ property, urlParams }: ClientBookingWrapperProps) {
  const { tc } = useLanguage();
  const { checkInDate, checkOutDate, numberOfNights, numberOfGuests } = useBooking();
  const { formatPrice, selectedCurrency, convertToSelectedCurrency } = useCurrency();
  
  const [dynamicPricing, setDynamicPricing] = React.useState<any>(null);
  
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
  
  // Fetch dynamic pricing when dates change
  React.useEffect(() => {
    const fetchPricing = async () => {
      if (checkInDate && checkOutDate && numberOfGuests > 0) {
        try {
          const { getPricingForDateRange } = await import('@/services/availabilityService');
          const pricing = await getPricingForDateRange(
            property.slug,
            checkInDate,
            checkOutDate,
            numberOfGuests
          );
          
          if (pricing?.pricing) {
            setDynamicPricing(pricing.pricing);
          }
        } catch (error) {
          console.error('[ClientBookingWrapper] Error fetching pricing:', error);
        }
      }
    };
    
    fetchPricing();
  }, [property.slug, checkInDate, checkOutDate, numberOfGuests]);
  
  // Calculate total price using dynamic pricing or fallback
  let totalPrice = '';
  if (dynamicPricing) {
    const convertedAmount = convertToSelectedCurrency(dynamicPricing.totalPrice, dynamicPricing.currency);
    totalPrice = formatPrice(convertedAmount, selectedCurrency);
  } else if (numberOfNights > 0) {
    // Fallback to simple calculation
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
    >
      <BookingContainer property={translatedProperty} />
    </BookingCheckLayout>
  );
}