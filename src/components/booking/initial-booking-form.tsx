
"use client";

import * as React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, isAfter } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Calendar as CalendarIcon, SearchCheck, Loader2 } from 'lucide-react'; // Removed Users, Minus, Plus

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
}

export function InitialBookingForm({ property }: InitialBookingFormProps) {
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  // Removed guest state: const [numberOfGuests, setNumberOfGuests] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Removed handleGuestChange function

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
      // Removed guests parameter: guests: String(numberOfGuests),
    });

    // Navigate to the new availability check page
    router.push(`/booking/check/${property.slug}?${params.toString()}`);

    // Optionally reset loading state if navigation fails, though usually it won't
    // setTimeout(() => setIsLoading(false), 2000); // Reset after a delay just in case
  };

  const isButtonDisabled = !isDateRangeValid() || isLoading;

  return (
    // Reduced vertical spacing for overlay context
    <div className="space-y-4">
      {/* Date Range Picker */}
      <div className={cn('grid gap-2')}>
         {/* Use text-sm for label in overlay */}
         <Label htmlFor="date" className="text-sm font-medium text-gray-700">Check-in / Check-out Dates</Label>
         <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={'outline'}
              className={cn(
                // Adjusted width for overlay form
                'w-full justify-start text-left font-normal',
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
                <span>Pick a date range now</span>
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

      {/* Guest Selector Removed */}

      {/* Check Availability Button */}
      <Button
        type="button"
        onClick={handleCheckAvailability}
        // Use primary color defined in globals.css
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
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
  );
}
