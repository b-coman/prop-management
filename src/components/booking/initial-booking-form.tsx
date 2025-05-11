
// src/components/booking/initial-booking-form.tsx
"use client";

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, isAfter } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Calendar as CalendarIcon, SearchCheck, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import type { Property } from '@/types';

interface InitialBookingFormProps {
  property: Property;
  size?: 'compressed' | 'large'; // Add optional size prop
}

export function InitialBookingForm({ property, size = 'compressed' }: InitialBookingFormProps) {
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Clear any existing booking storage when this initial form loads
  // This ensures we start fresh when booking a new stay
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Clear any property-specific booking storage
      console.log("InitialBookingForm mounted - clearing old booking storage");

      // Simple session storage cleanup approach
      // Look for and remove any booking-related items
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('booking_')) {
          console.log(`Clearing old booking storage: ${key}`);
          sessionStorage.removeItem(key);
          // Re-adjust index because we removed an item
          i--;
        }
      }
    }
  }, []);

  // Check if date range is valid (end date is after start date)
  const isDateRangeValid = (): boolean => {
    if (!date?.from || !date?.to) {
      return false;
    }
    // Ensure end date is strictly after start date
    return isAfter(date.to, date.from);
  };

  const handleCheckAvailability = () => {
    if (!isDateRangeValid()) {
      toast({
        title: "Invalid Dates",
        description: "Please select a valid check-in and check-out date.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    // Construct the URL for the availability check page (only dates)
    const checkIn = format(date!.from!, 'yyyy-MM-dd');
    const checkOut = format(date!.to!, 'yyyy-MM-dd');
    const params = new URLSearchParams({
      checkIn,
      checkOut,
    });

    // Navigate to the new availability check page
    router.push(`/booking/check/${property.slug}?${params.toString()}`);
    // Note: setIsLoading(false) will happen implicitly when navigation occurs
  };

  const isButtonDisabled = !isDateRangeValid() || isLoading;

  // Conditionally apply classes based on the size prop
  const formContainerClasses = cn(
    'space-y-4', // Default vertical spacing
    size === 'large' && 'flex flex-col md:flex-row md:items-end md:space-y-0 md:space-x-2 w-full' // Flex layout for large size on medium screens and up
  );

  const datePickerContainerClasses = cn(
    'grid gap-2',
    size === 'large' && 'flex-grow' // Allow date picker to take up space in large layout
  );

  const buttonContainerClasses = cn(
    'w-full',
    size === 'large' && 'md:w-auto md:shrink-0' // Adjust button width for large layout
  );

  return (
    <div className={formContainerClasses}>
      {/* Date Range Picker */}
      <div className={datePickerContainerClasses}>
         {/* Hide label visually but keep for accessibility if needed, or remove if context is clear */}
         <Label htmlFor="date" className={cn(size === 'large' ? "sr-only" : "text-sm font-medium text-foreground")}>
             Check-in / Check-out Dates
         </Label>
         <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={'outline'}
              className={cn(
                'w-full justify-start text-left font-normal', // Ensure full width by default
                !date && 'text-muted-foreground'
              )}
              disabled={isLoading}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, 'LLL dd, y')} -{' '}
                    {format(date.to, 'LLL dd, y')}
                  </>
                ) : (
                  format(date.from, 'LLL dd, y')
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from || new Date()}
                  selected={date}
                  onSelect={setDate}
                  numberOfMonths={1}
                  disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }} // Only disable past dates
              />
          </PopoverContent>
        </Popover>
      </div>

      {/* Check Availability Button */}
      <div className={buttonContainerClasses}>
          {/* Add an invisible label for large layout alignment if needed, or adjust flex alignment */}
          {size === 'large' && <Label htmlFor="check-availability-btn" className="text-sm font-medium text-transparent md:block hidden">Submit</Label> }
          <Button
            id="check-availability-btn"
            type="button"
            onClick={handleCheckAvailability}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" // Ensure full width by default
            disabled={isButtonDisabled}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <SearchCheck className="mr-2 h-4 w-4" />
                Check Availability
              </>
            )}
          </Button>
       </div>
    </div>
  );
}

    