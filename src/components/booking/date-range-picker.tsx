"use client";

import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Pencil } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useDatePicker } from './hooks';
import { useBooking } from '@/contexts/BookingContext';

interface DateRangePickerProps {
  disabled?: boolean;
  showNights?: boolean;
  className?: string;
  // New props for allowing custom handlers
  customDateRange?: { from: Date | null, to: Date | null };
  onDateChange?: (range: { from: Date | null, to: Date | null }) => void;
}

export function DateRangePicker({
  disabled = false,
  showNights = true,
  className,
  customDateRange,
  onDateChange
}: DateRangePickerProps) {
  const { 
    dateRange, 
    datesSelected,
    isDatePickerOpen, 
    handleOpenChange, 
    handleDateSelect 
  } = useDatePicker();
  
  // Get number of nights directly from the BookingContext
  const { numberOfNights } = useBooking();
  
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="mb-1 block text-sm font-medium">Selected Dates</Label>
      <Popover open={isDatePickerOpen} onOpenChange={handleOpenChange}>
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
          {/* Only render Calendar when the popover is open to prevent unnecessary updates */}
          {isDatePickerOpen && (
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={handleDateSelect}
              numberOfMonths={2}
              disabled={{ before: new Date() }}
            />
          )}
        </PopoverContent>
      </Popover>
      {showNights && datesSelected && numberOfNights > 0 && (
        <p className="text-sm text-muted-foreground mt-1">
          ({numberOfNights} {numberOfNights === 1 ? 'night' : 'nights'})
        </p>
      )}
    </div>
  );
}