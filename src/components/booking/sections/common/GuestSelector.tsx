"use client";

import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useBooking } from '@/contexts/BookingContext';

interface GuestSelectorProps {
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
 * 
 * REFACTORED: Now uses BookingContext only - no direct API calls.
 * Users must click "Check Price" button to get updated pricing.
 */
export function GuestSelector({
  minGuests = 1,
  maxGuests,
  disabled = false,
  className = '',
}: GuestSelectorProps) {
  const { numberOfGuests, setNumberOfGuests } = useBooking();

  // Handler for decrementing the guest count - CONTEXT ONLY
  const decrementGuests = () => {
    if (numberOfGuests > minGuests) {
      const newCount = numberOfGuests - 1;
      
      console.log(`[GuestSelector] 👥 CONTEXT ONLY: Updating guests to ${newCount} (no auto API call)`);
      
      // Update context only - no direct API calls
      setNumberOfGuests(newCount);
    }
  };

  // Handler for incrementing the guest count - CONTEXT ONLY
  const incrementGuests = () => {
    if (numberOfGuests < maxGuests) {
      const newCount = numberOfGuests + 1;
      
      console.log(`[GuestSelector] 👥 CONTEXT ONLY: Updating guests to ${newCount} (no auto API call)`);
      
      // Update context only - no direct API calls
      setNumberOfGuests(newCount);
    }
  };

  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="mb-1 block text-sm font-medium">Guests</Label>
      <div className="flex items-center justify-between rounded-md border px-3 h-10 w-full bg-white mt-px">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={decrementGuests}
          disabled={numberOfGuests <= minGuests || disabled}
          aria-label="Decrease guests"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="mx-2 font-medium w-10 text-center" id="guests">
          {numberOfGuests}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={incrementGuests}
          disabled={numberOfGuests >= maxGuests || disabled}
          aria-label="Increase guests"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {/* This invisible element ensures same spacing as date selectors */}
      <div className="h-[21px] invisible">.</div>
    </div>
  );
}