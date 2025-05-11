"use client";

import { useState, useMemo } from 'react';
import { useBooking } from '@/contexts/BookingContext';
import { format, isValid, startOfDay } from 'date-fns';
import { Calendar as CalendarIcon, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

interface DateSelectionProps {
  disabled?: boolean;
}

/**
 * Date selection component with date picker popover
 */
export function DateSelection({ disabled = false }: DateSelectionProps) {
  const { 
    checkInDate, 
    checkOutDate, 
    numberOfNights,
    setCheckInDate, 
    setCheckOutDate 
  } = useBooking();
  
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  // Create a date range object for the calendar
  const dateRange: DateRange | undefined = useMemo(() => {
    if (checkInDate && checkOutDate) {
      return { from: checkInDate, to: checkOutDate };
    }
    return undefined;
  }, [checkInDate, checkOutDate]);
  
  /**
   * Handle date selection from the calendar
   */
  const handleDateSelect = (range: DateRange | undefined) => {
    if (range?.from) {
      // Normalize dates to start of day to avoid time zone issues
      const checkIn = startOfDay(range.from);
      console.log('[DateSelection] Setting check-in date:', checkIn.toISOString());
      setCheckInDate(checkIn);
    } else {
      setCheckInDate(null);
    }
    
    if (range?.to) {
      const checkOut = startOfDay(range.to);
      console.log('[DateSelection] Setting check-out date:', checkOut.toISOString());
      setCheckOutDate(checkOut);
    } else {
      setCheckOutDate(null);
    }
    
    // Close the date picker after selection
    setIsDatePickerOpen(false);
  };
  
  return (
    <div>
      <Label className="mb-1 block text-sm font-medium">Selected Dates</Label>
      <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-between text-left font-normal flex items-center h-10",
              !dateRange?.from && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <div className="flex items-center">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, 'LLL dd, y')} -{' '}
                    {format(dateRange.to, 'LLL dd, y')}
                  </>
                ) : (
                  format(dateRange.from, 'LLL dd, y')
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </div>
            <Pencil className="h-3 w-3 opacity-50 ml-auto" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from && isValid(dateRange.from) ? dateRange.from : undefined}
            selected={dateRange}
            onSelect={handleDateSelect}
            numberOfMonths={2}
            disabled={{ before: startOfDay(new Date()) }}
          />
        </PopoverContent>
      </Popover>
      {numberOfNights > 0 && (
        <p className="text-sm text-muted-foreground mt-1">
          ({numberOfNights} {numberOfNights === 1 ? 'night' : 'nights'})
        </p>
      )}
    </div>
  );
}