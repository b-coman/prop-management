// src/components/booking/booking-options-cards.tsx
"use client";

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { Property } from '@/types'; // Import Property type
import { ContactCard } from './contact-card'; // Import specific cards
import { HoldCard } from './hold-card';
import { BookNowCard } from './book-now-card';

type SelectedOption = 'contact' | 'hold' | 'bookNow' | null;

interface BookingOptionsCardsProps {
  selectedOption: SelectedOption;
  onSelectOption: (option: SelectedOption) => void;
  property: Property; // Receive property to check options
}

export function BookingOptionsCards({
  selectedOption,
  onSelectOption,
  property,
}: BookingOptionsCardsProps) {
  const { enableContactOption = true, enableHoldOption = true } = property; // Default to true if not set

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
      {/* Contact Card */}
      {enableContactOption && (
        <ContactCard
          isSelected={selectedOption === 'contact'}
          onSelect={() => onSelectOption('contact')}
        />
      )}

      {/* Hold Card */}
      {enableHoldOption && (
        <HoldCard
          isSelected={selectedOption === 'hold'}
          onSelect={() => onSelectOption('hold')}
          holdFeeAmount={property.holdFeeAmount || 25} // Use property config or default
          propertyBaseCurrency={property.baseCurrency} // Pass the property's base currency
        />
      )}

      {/* Book Now Card */}
      <BookNowCard
        isSelected={selectedOption === 'bookNow'}
        onSelect={() => onSelectOption('bookNow')}
      />
    </div>
  );
}
