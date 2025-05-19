"use client";

import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface GuestSelectorProps {
  value: number;
  onChange: (value: number) => void;
  minGuests?: number;
  maxGuests: number;
  disabled?: boolean;
  className?: string;
}

/**
 * GuestSelector component for selecting the number of guests
 * 
 * This component provides a simple interface with plus/minus buttons to 
 * increment or decrement the guest count within the allowed range.
 */
export function GuestSelector({
  value,
  onChange,
  minGuests = 1,
  maxGuests,
  disabled = false,
  className = '',
}: GuestSelectorProps) {
  // Handler for decrementing the guest count
  const decrementGuests = () => {
    if (value > minGuests) {
      onChange(value - 1);
    }
  };

  // Handler for incrementing the guest count
  const incrementGuests = () => {
    if (value < maxGuests) {
      onChange(value + 1);
    }
  };

  return (
    <div className={`${className}`}>
      <Label className="mb-1 block text-sm font-medium">Guests</Label>
      <div className="flex items-center justify-between rounded-md border p-2 h-auto w-full md:w-auto bg-white">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 min-h-[44px] min-w-[44px]"
          onClick={decrementGuests}
          disabled={value <= minGuests || disabled}
          aria-label="Decrease guests"
        >
          <Minus className="h-5 w-5" />
        </Button>
        <span className="mx-4 font-medium w-10 text-center" id="guests">
          {value}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 min-h-[44px] min-w-[44px]"
          onClick={incrementGuests}
          disabled={value >= maxGuests || disabled}
          aria-label="Increase guests"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Max {maxGuests}
      </p>
    </div>
  );
}