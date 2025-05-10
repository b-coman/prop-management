"use client";

import * as React from 'react';
import { Calendar } from "@/components/ui/calendar";
import type { DateRange, DayModifiers, ModifiersStyles } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { format, startOfDay, subMonths } from 'date-fns'; // Import subMonths

interface AvailabilityCalendarProps {
  currentMonth: Date; // The month to center around (usually based on check-in date)
  unavailableDates: Date[];
  selectedRange?: DateRange;
  // numberOfMonths removed, always 3 now
  onDateClick?: (date: Date) => void; // Optional callback for clicking a date
}

export function AvailabilityCalendar({
  currentMonth,
  unavailableDates,
  selectedRange,
  onDateClick,
}: AvailabilityCalendarProps) {

  const disabledDays = [
    { before: startOfDay(new Date()) }, // Disable dates before today
    ...unavailableDates.map(date => startOfDay(date)), // Disable specific unavailable dates
  ];

  // Modifiers to style specific date types
  const modifiers = React.useMemo<DayModifiers>(() => {
    const mods: DayModifiers = {
      unavailable: unavailableDates.map(date => startOfDay(date))
    };

    // Only add the selected modifier if we have a valid range with at least one defined date
    if (selectedRange && (selectedRange.from || selectedRange.to)) {
      // Create a DateRange with guaranteed non-undefined dates
      const fromDate = selectedRange.from ? startOfDay(selectedRange.from) : undefined;
      const toDate = selectedRange.to ? startOfDay(selectedRange.to) : undefined;

      // Only include valid dates in the range
      if (fromDate || toDate) {
        mods.selected = {
          from: fromDate,
          to: toDate
        };
      }
    }

    return mods;
  }, [unavailableDates, selectedRange]);

  // Modifier styles with proper typing
  const modifierStyles = React.useMemo<ModifiersStyles>(() => {
    return {
      unavailable: {
          textDecoration: 'line-through',
          color: 'hsl(var(--muted-foreground))',
          opacity: 0.6,
          pointerEvents: 'none' as const, // Make unavailable dates unclickable
      },
      selected: {
          backgroundColor: 'hsl(var(--primary) / 0.2)', // Light primary background
          fontWeight: 'bold',
          color: 'hsl(var(--primary))',
      },
      // Style for today
      today: {
          fontWeight: 'bold',
          color: 'hsl(var(--accent))', // Use accent color for today
          border: '1px solid hsl(var(--accent))',
      }
    };
  }, []);

  // Calculate the month to start the display from (one month before the target month)
  const displayStartMonth = subMonths(currentMonth, 1);

  return (
    <div className="flex justify-center">
       <Calendar
        mode="range" // Keep range mode for consistency
        month={displayStartMonth} // Start display from the previous month
        numberOfMonths={3} // Always display 3 months
        disabled={disabledDays}
        modifiers={modifiers}
        modifierStyles={modifierStyles}
        selected={selectedRange} // Visually highlight the selected range
        onDayClick={onDateClick} // Handle date clicks if needed
        showOutsideDays // Good practice for calendar context
        className="border rounded-md p-3 bg-card" // Add some basic styling
         classNames={{
            day: cn(
              "h-9 w-9 p-0 font-normal relative", // Ensure relative positioning for potential overlays
               // Add hover effect for available dates if needed
               "[&:not([aria-disabled=true])]:hover:bg-accent/10"
            ),
            // Customize other parts if necessary
          }}
       />
    </div>
  );
}
