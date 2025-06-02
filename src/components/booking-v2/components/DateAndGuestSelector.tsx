/**
 * DateAndGuestSelector V2.2 - Conversational Date Selection
 * 
 * @file-status: ACTIVE
 * @v2-role: CORE - Primary date and guest selection component
 * @created: 2025-05-31
 * @updated: 2025-06-02 (V2.2 - Made summary text conversational, removed automatic pricing message)
 * @description: Calendar with unavailable dates, back-to-back booking support,
 *               property-level minimum stay validation, guest count picker,
 *               and automatic pricing when dates are available (V2.1).
 *               V2.1.1 adds inline memoized components for surgical number updates.
 *               V2.2 transforms summary into friendly, conversational text.
 * @dependencies: BookingProvider, date-fns, react-day-picker
 * @replaces: Multiple date selector components from V1
 * @v2.1-changes: Removed manual "Check Price" button, added automatic pricing trigger
 * @v2.1.1-changes: Added BookingSummaryText, DateRangeDisplay, PricingStatusDisplay memoized components
 * @v2.2-changes: Made text conversational, removed pricing calculation message
 */

"use client";

import React, { useCallback, useMemo, useState, memo } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { addDays, isBefore, isAfter, isSameDay, format } from 'date-fns';
import { useBooking } from '../contexts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendarDays, Users, Loader2, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { loggers } from '@/lib/logger';

interface DateAndGuestSelectorProps {
  className?: string;
}

export function DateAndGuestSelector({ className }: DateAndGuestSelectorProps) {
  const {
    property,
    checkInDate,
    checkOutDate,
    guestCount,
    unavailableDates,
    isLoadingUnavailable,
    unavailableError,
    isLoadingPricing,
    pricingError,
    showMinStayWarning,
    setCheckInDate,
    setCheckOutDate,
    setGuestCount,
    fetchPricing,
    dismissMinStayWarning
  } = useBooking();

  // Popover state management
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkOutOpen, setCheckOutOpen] = useState(false);

  // Utility functions for date calculations
  const getDaysBetween = useCallback((startDate: Date, endDate: Date): number => {
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  }, []);

  const getDatesBeforeCheckIn = useCallback((checkIn: Date): Date[] => {
    const dates: Date[] = [];
    const today = new Date();
    const startDate = isBefore(today, checkIn) ? today : checkIn;
    
    for (let d = new Date(startDate); isBefore(d, checkIn); d = addDays(d, 1)) {
      dates.push(new Date(d));
    }
    return dates;
  }, []);

  const getDatesBetween = useCallback((startDate: Date, endDate: Date): Date[] => {
    const dates: Date[] = [];
    for (let d = new Date(startDate); isBefore(d, endDate); d = addDays(d, 1)) {
      dates.push(new Date(d));
    }
    return dates;
  }, []);

  // Calculate disabled dates for check-in calendar
  const checkInDisabledDates = useMemo(() => {
    const today = new Date();
    const pastDates: Date[] = [];
    
    // Add past dates
    for (let d = new Date(today.getFullYear(), 0, 1); isBefore(d, today); d = addDays(d, 1)) {
      pastDates.push(new Date(d));
    }
    
    return [...unavailableDates, ...pastDates];
  }, [unavailableDates]);

  // Calculate disabled dates for check-out calendar
  const checkOutDisabledDates = useMemo(() => {
    if (!checkInDate) return [];
    
    const defaultMinStay = property.defaultMinimumStay || 1;
    const minCheckoutDate = addDays(checkInDate, defaultMinStay);
    
    return [
      // Back-to-back booking logic (shift unavailable dates +1 day)
      ...unavailableDates.map(date => addDays(date, 1)),
      // All dates before check-in
      ...getDatesBeforeCheckIn(checkInDate),
      // Minimum stay enforcement
      ...getDatesBetween(checkInDate, minCheckoutDate),
      // Same day checkout prevention
      checkInDate
    ];
  }, [checkInDate, unavailableDates, property.defaultMinimumStay, getDatesBeforeCheckIn, getDatesBetween]);

  // Handle check-in date selection
  const handleCheckInChange = useCallback((date: Date | undefined) => {
    const newCheckIn = date || null;
    
    if (newCheckIn && checkOutDate) {
      const nightsBetween = getDaysBetween(newCheckIn, checkOutDate);
      const minStay = property.defaultMinimumStay || 1;
      
      if (nightsBetween < minStay) {
        setCheckOutDate(null);
        loggers.bookingContext.debug('Checkout cleared due to minimum stay violation', {
          checkIn: newCheckIn,
          checkOut: checkOutDate,
          nights: nightsBetween,
          minStay
        });
      }
    }
    
    setCheckInDate(newCheckIn);
    setCheckInOpen(false); // Close popover after selection
    
    if (showMinStayWarning) {
      dismissMinStayWarning();
    }
    
    // Auto-open checkout date picker if no checkout date is selected
    if (newCheckIn && !checkOutDate) {
      setTimeout(() => setCheckOutOpen(true), 300);
    }
  }, [checkOutDate, property.defaultMinimumStay, getDaysBetween, setCheckInDate, setCheckOutDate, showMinStayWarning, dismissMinStayWarning]);

  // Handle check-out date selection
  const handleCheckOutChange = useCallback((date: Date | undefined) => {
    setCheckOutDate(date || null);
    setCheckOutOpen(false); // Close popover after selection
  }, [setCheckOutDate]);

  // Handle guest count change
  const handleGuestCountChange = useCallback((value: string) => {
    const count = parseInt(value);
    if (!isNaN(count) && count >= 1 && count <= property.maxGuests) {
      setGuestCount(count);
      loggers.bookingContext.debug('Guest count updated', {
        newCount: count,
        maxGuests: property.maxGuests
      });
    }
  }, [property.maxGuests, setGuestCount]);

  // V2.1: Calculate nights for display
  const numberOfNights = checkInDate && checkOutDate ? getDaysBetween(checkInDate, checkOutDate) : 0;

  // Generate guest count options
  const guestOptions = useMemo(() => {
    const options = [];
    for (let i = 1; i <= property.maxGuests; i++) {
      options.push(
        <SelectItem key={i} value={i.toString()}>
          {i} {i === 1 ? 'Guest' : 'Guests'}
          {i === property.baseOccupancy && ' (Standard)'}
        </SelectItem>
      );
    }
    return options;
  }, [property.maxGuests, property.baseOccupancy]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Date Selection */}
      <TooltipProvider>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Select Dates
            </CardTitle>
            {property.defaultMinimumStay > 1 && (
              <p className="text-sm text-muted-foreground">
                Minimum {property.defaultMinimumStay} nights required
              </p>
            )}
          </CardHeader>
        <CardContent>
          {isLoadingUnavailable ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading availability...</span>
            </div>
          ) : unavailableError ? (
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">{unavailableError}</p>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Date Selection Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Check-in Date Picker */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Check-in Date</label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground cursor-help">ⓘ</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Check-in after 3 PM, check-out by 11 AM</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Popover open={checkInOpen} onOpenChange={setCheckInOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal h-10 sm:h-9",
                          !checkInDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {checkInDate ? format(checkInDate, "PPP") : "Select your dates"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <DayPicker
                        mode="single"
                        selected={checkInDate || undefined}
                        onSelect={handleCheckInChange}
                        disabled={checkInDisabledDates}
                        initialFocus
                        classNames={{
                          months: "flex flex-col",
                          month: "space-y-4",
                          caption: "flex justify-center pt-1 relative items-center",
                          caption_label: "text-sm font-medium",
                          nav: "space-x-1 flex items-center",
                          nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                          nav_button_previous: "absolute left-1",
                          nav_button_next: "absolute right-1",
                          table: "w-full border-collapse space-y-1",
                          head_row: "flex",
                          head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                          row: "flex w-full mt-2",
                          cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                          day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
                          day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                          day_today: "bg-accent text-accent-foreground",
                          day_outside: "text-muted-foreground opacity-50",
                          day_disabled: "text-muted-foreground opacity-50 line-through",
                          day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                          day_hidden: "invisible"
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Check-out Date Picker */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Check-out Date</label>
                  <Popover open={checkOutOpen} onOpenChange={setCheckOutOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal h-10 sm:h-9",
                          !checkOutDate && "text-muted-foreground"
                        )}
                        disabled={!checkInDate}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {checkOutDate ? format(checkOutDate, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <DayPicker
                        mode="single"
                        selected={checkOutDate || undefined}
                        onSelect={handleCheckOutChange}
                        disabled={checkOutDisabledDates}
                        initialFocus
                        classNames={{
                          months: "flex flex-col",
                          month: "space-y-4",
                          caption: "flex justify-center pt-1 relative items-center",
                          caption_label: "text-sm font-medium",
                          nav: "space-x-1 flex items-center",
                          nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                          nav_button_previous: "absolute left-1",
                          nav_button_next: "absolute right-1",
                          table: "w-full border-collapse space-y-1",
                          head_row: "flex",
                          head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                          row: "flex w-full mt-2",
                          cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                          day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
                          day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                          day_today: "bg-accent text-accent-foreground",
                          day_outside: "text-muted-foreground opacity-50",
                          day_disabled: "text-muted-foreground opacity-50 line-through",
                          day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                          day_hidden: "invisible"
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  {!checkInDate && (
                    <p className="text-xs text-muted-foreground">Select check-in date first</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Minimum Stay Warning */}
          {showMinStayWarning && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">
                Please select checkout date (minimum {property.defaultMinimumStay} nights required)
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      </TooltipProvider>

      {/* Guest Selection */}
      <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <span>Number of Guests</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground cursor-help">ⓘ</span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Extra guests are not allowed without approval</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={guestCount.toString()} onValueChange={handleGuestCountChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select number of guests" />
            </SelectTrigger>
            <SelectContent>
              {guestOptions}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground mt-2">
            Max {property.maxGuests} guests
          </p>
        </CardContent>
      </Card>
      </TooltipProvider>

      {/* V2.1: Automatic Pricing Status Display */}
      <Card>
        <CardContent className="pt-6">
          {checkInDate && checkOutDate && (
            <>
              {/* Selection Summary - V2.1.1 Surgical Updates */}
              <div className="text-center mb-4">
                <BookingSummaryText nights={numberOfNights} guests={guestCount} />
                <DateRangeDisplay checkInDate={checkInDate} checkOutDate={checkOutDate} />
              </div>

              {/* Automatic Pricing Status - V2.1.1 Surgical Updates */}
              <PricingStatusDisplay 
                isLoadingPricing={isLoadingPricing} 
                pricingError={pricingError} 
                fetchPricing={fetchPricing} 
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// V2.1.1: Inline Memoized Components for Surgical Number Updates
// These components only re-render when their specific props change

const BookingSummaryText = memo(function BookingSummaryText({ 
  nights, 
  guests 
}: { 
  nights: number; 
  guests: number; 
}) {
  return (
    <h3 className="text-lg font-semibold">
      You're booking a {nights}-night stay for {guests} {guests === 1 ? 'guest' : 'guests'}
    </h3>
  );
});

const DateRangeDisplay = memo(function DateRangeDisplay({ 
  checkInDate, 
  checkOutDate 
}: { 
  checkInDate: Date | null; 
  checkOutDate: Date | null; 
}) {
  if (!checkInDate || !checkOutDate) return null;
  
  return (
    <p className="text-sm text-muted-foreground">
      Arriving {format(checkInDate, "EEEE, MMMM d")} and leaving {format(checkOutDate, "EEEE, MMMM d")}
    </p>
  );
});

const PricingStatusDisplay = memo(function PricingStatusDisplay({ 
  isLoadingPricing, 
  pricingError, 
  fetchPricing 
}: { 
  isLoadingPricing: boolean; 
  pricingError: string | null; 
  fetchPricing: () => void; 
}) {
  if (isLoadingPricing) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Calculating your price...</span>
      </div>
    );
  }

  if (pricingError) {
    return (
      <div className="text-center py-4">
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{pricingError}</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-3"
          onClick={fetchPricing}
        >
          Retry Pricing
        </Button>
      </div>
    );
  }

  return null; // No message needed - pricing calculates automatically
});