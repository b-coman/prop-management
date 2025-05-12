"use client";

import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Pencil } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useCustomDatePicker } from './hooks/useCustomDatePicker';
import { useDateDebug } from '@/hooks/useDateDebug';

interface CustomDateRangePickerProps {
  checkInDate: Date | null;
  checkOutDate: Date | null;
  onDateChange: (from: Date | null, to: Date | null) => void;
  numberOfNights: number;
  disabled?: boolean;
  showNights?: boolean;
  className?: string;
  unavailableDates?: Date[]; // Array of dates that should be disabled in the calendar
}

export function CustomDateRangePicker({
  checkInDate,
  checkOutDate,
  onDateChange,
  numberOfNights,
  disabled = false,
  showNights = true,
  className,
  unavailableDates = [] // Default to empty array if not provided
}: CustomDateRangePickerProps) {
  // Use debug hook to analyze dates
  useDateDebug(unavailableDates, 'CustomDateRangePicker-Raw');

  // Process unavailable dates to ensure they are valid Date objects - normalize to 00:00:00 local time
  const formattedUnavailableDates = React.useMemo(() => {
    console.log(`[CustomDateRangePicker] Processing ${unavailableDates.length} unavailable dates`);

    const formatted = unavailableDates
      .filter(date => date instanceof Date && !isNaN(date.getTime()))
      .map(date => {
        // Create a new date with time set to midnight for proper comparison
        const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        return normalized;
      });

    console.log(`[CustomDateRangePicker] After filtering & normalization: ${formatted.length} valid dates`);
    return formatted;
  }, [unavailableDates]);

  // Debug the processed dates too
  useDateDebug(formattedUnavailableDates, 'CustomDateRangePicker-Normalized');

  const {
    dateRange,
    datesSelected,
    isDatePickerOpen,
    handleOpenChange,
    handleDateSelect
  } = useCustomDatePicker({
    checkInDate,
    checkOutDate,
    onDateChange
  });
  
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
              disabled={(date) => {
                // Skip if it's not a Date object
                if (!(date instanceof Date)) return false;

                // Always disable dates in the past
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (date < today) {
                  // Don't log past dates to avoid console flooding
                  return true;
                }

                // Check if this date should be disabled
                for (const unavailableDate of formattedUnavailableDates) {
                  if (date.getFullYear() === unavailableDate.getFullYear() &&
                      date.getMonth() === unavailableDate.getMonth() &&
                      date.getDate() === unavailableDate.getDate()) {

                    // Log only the first few matches for debugging
                    if (formattedUnavailableDates.indexOf(unavailableDate) < 3) {
                      console.log(`[Calendar] Disabled date: ${date.toDateString()} matches unavailable: ${unavailableDate.toDateString()}`);
                    }

                    return true;
                  }
                }

                return false;
              }}
              // Add modifiers explicitly for unavailable dates
              modifiers={{
                unavailable: formattedUnavailableDates
              }}
              modifiersStyles={{
                unavailable: {
                  textDecoration: 'line-through',
                  color: 'hsl(var(--muted-foreground))',
                  opacity: 0.6,
                  pointerEvents: 'none' as const
                }
              }}
              // Style disabled dates
              classNames={{
                day_disabled: "text-gray-400 line-through opacity-50 pointer-events-none"
              }}
              // Visual indicator for debugging - logs the initial disabled state
              onMonthChange={(month) => {
                // Count disabled days in this month for debugging
                setTimeout(() => {
                  const disabledDays = document.querySelectorAll('.rdp-day_disabled');
                  console.log(`[Calendar] Month changed to ${month.getMonth() + 1}/${month.getFullYear()}, found ${disabledDays.length} disabled days`);
                }, 100);
              }}
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