"use client";

import React from 'react';
import { useBooking } from '@/contexts/BookingContext';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { Property } from '@/types';

interface GuestCountSelectorProps {
  property: Property;
  disabled?: boolean;
}

/**
 * Guest count selector component with increment/decrement buttons
 */
export function GuestCountSelector({ 
  property,
  disabled = false 
}: GuestCountSelectorProps) {
  const { numberOfGuests, setNumberOfGuests } = useBooking();
  
  /**
   * Handle changing the guest count
   */
  const handleGuestChange = (change: number) => {
    setNumberOfGuests((prev) => {
      const newCount = prev + change;
      return Math.max(1, Math.min(newCount, property.maxGuests));
    });
  };
  
  return (
    <div>
      <Label className="mb-1 block text-sm font-medium">Guests</Label>
      <div className="flex items-center justify-between rounded-md border p-2 h-10 w-full md:w-auto">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => handleGuestChange(-1)}
          disabled={numberOfGuests <= 1 || disabled}
          aria-label="Decrease guests"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="mx-4 font-medium w-8 text-center" id="guests">
          {numberOfGuests}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => handleGuestChange(1)}
          disabled={numberOfGuests >= property.maxGuests || disabled}
          aria-label="Increase guests"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Max {property.maxGuests}
      </p>
    </div>
  );
}