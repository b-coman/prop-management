
"use client";

import * as React from 'react';
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { format, startOfDay } from 'date-fns';

interface AvailabilityCalendarProps {
  currentMonth: Date; // The month to initially display or center around
  unavailableDates: Date[];
  selectedRange?: DateRange;
  numberOfMonths?: number;
  onDateClick?: (date: Date) => void; // Optional callback for clicking a date
}

export function AvailabilityCalendar({
  currentMonth,
  unavailableDates,
  selectedRange,
  numberOfMonths = 3, // Default to showing 3 months
  onDateClick,
}: AvailabilityCalendarProps) {

  const disabledDays = [
    { before: startOfDay(new Date()) }, // Disable dates before today
    ...unavailableDates.map(date => startOfDay(date)), // Disable specific unavailable dates
  ];

  // Modifiers to style specific date types
  const modifiers = {
    unavailable: unavailableDates.map(date => startOfDay(date)),
    selected: selectedRange ? { from: selectedRange.from ? startOfDay(selectedRange.from) : undefined, to: selectedRange.to ? startOfDay(selectedRange.to): undefined } : undefined,
  };

  // Modifier styles
  const modifierStyles = {
    unavailable: {
        textDecoration: 'line-through',
        color: 'hsl(var(--muted-foreground))',
        opacity: 0.6,
        // Optionally add a background color
        // backgroundColor: 'hsl(var(--muted) / 0.5)',
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

  return (
    <div className="flex justify-center">
       <Calendar
        mode="range" // Keep range mode for consistency, even if selection is just visual here
        month={currentMonth} // Control the displayed month
        numberOfMonths={numberOfMonths}
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
