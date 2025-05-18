"use client";

import { BookingContainer } from '@/components/booking/container/BookingContainer';
import { useLanguage } from '@/hooks/useLanguage';
import type { Property } from '@/types';

interface ClientBookingWrapperProps {
  property: Property;
}

export function ClientBookingWrapper({ property }: ClientBookingWrapperProps) {
  const { tc } = useLanguage();
  
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
  
  return <BookingContainer property={translatedProperty} />;
}