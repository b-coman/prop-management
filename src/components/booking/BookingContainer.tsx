"use client";

// This file is a redirect to maintain backward compatibility
// The actual implementation has been moved to /components/booking/container/BookingContainer.tsx

import { BookingContainer as ActualBookingContainer } from './container/BookingContainer';
import type { Property } from '@/types';

export interface BookingContainerProps {
  property: Property;
  position?: 'center' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  size?: 'compressed' | 'large';
  showRating?: boolean;
  variant?: 'embedded' | 'standalone';
  className?: string;
}

export function BookingContainer(props: BookingContainerProps) {
  // Set default variant to 'embedded' for backward compatibility
  const extendedProps = {
    ...props,
    variant: props.variant || 'embedded'
  };
  
  console.warn('[DEPRECATED] Using BookingContainer from "/components/booking/BookingContainer.tsx" is deprecated. ' +
    'Please import from "/components/booking/container/BookingContainer.tsx" instead.');
    
  return <ActualBookingContainer {...extendedProps} />;
}