"use client";

import * as React from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useBooking } from '@/contexts/BookingContext';

interface GuestPickerProps {
  maxGuests: number;
  disabled?: boolean;
  baseOccupancy?: number;
  className?: string;
}

export function GuestPicker({ 
  maxGuests,
  disabled = false,
  baseOccupancy = 1,
  className
}: GuestPickerProps) {
  const { numberOfGuests, setNumberOfGuests } = useBooking();
  
  // Initialize with base occupancy if not set
  React.useEffect(() => {
    if (!numberOfGuests || numberOfGuests <= 0) {
      setNumberOfGuests(baseOccupancy);
    }
  }, [numberOfGuests, setNumberOfGuests, baseOccupancy]);
  
  const handleGuestChange = React.useCallback((change: number) => {
    setNumberOfGuests((prev) => {
      const newCount = prev + change;
      return Math.max(1, Math.min(newCount, maxGuests));
    });
  }, [setNumberOfGuests, maxGuests]);
  
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="mb-1 block text-sm font-medium">Guests</Label>
      <div className="flex items-center justify-between rounded-md border p-2 h-10 w-full">
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
          disabled={numberOfGuests >= maxGuests || disabled}
          aria-label="Increase guests"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Max {maxGuests}
      </p>
    </div>
  );
}