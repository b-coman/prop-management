"use client";

import React from 'react';
import type { DateRange } from 'react-day-picker';
import { format, isValid, startOfDay } from 'date-fns';
import { AvailabilityCalendar as ExistingAvailabilityCalendar } from '../../availability-calendar';

interface AvailabilityCalendarProps {
  currentMonth: Date; // The month to center around (usually based on check-in date)
  unavailableDates: Date[];
  selectedRange?: DateRange;
  onDateClick?: (date: Date) => void; // Optional callback for clicking a date
}

/**
 * AvailabilityCalendar component for displaying a calendar with available and unavailable dates
 *
 * This is a wrapper component that re-exports the existing AvailabilityCalendar component
 * with a standardized interface for the booking system.
 */
export function AvailabilityCalendar({
  currentMonth,
  unavailableDates,
  selectedRange,
  onDateClick,
}: AvailabilityCalendarProps) {
  // Use the existing component implementation
  return (
    <ExistingAvailabilityCalendar
      currentMonth={currentMonth}
      unavailableDates={unavailableDates}
      selectedRange={selectedRange}
      onDateClick={onDateClick}
    />
  );
}