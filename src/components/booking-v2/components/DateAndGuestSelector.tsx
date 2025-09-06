/**
 * DateAndGuestSelector V2.4.2 - Enhanced Date Selection with Smart Unavailability Handling
 * 
 * @file-status: ACTIVE
 * @v2-role: CORE - Primary date and guest selection component
 * @created: 2025-05-31
 * @updated: 2025-06-04 (V2.4.2 - Added distinction between hard and light unavailable dates)
 * @description: Calendar with unavailable dates, back-to-back booking support,
 *               property-level minimum stay validation, guest count picker,
 *               automatic pricing when dates are available (V2.1), and visual
 *               date range highlighting showing complete booking period (V2.4).
 *               V2.1.1 adds inline memoized components for surgical number updates.
 *               V2.2 transforms summary into friendly, conversational text.
 *               V2.3 prevents showing stale booking info when dates are unavailable.
 *               V2.4 adds range highlighting with rounded corners for start/end dates.
 *               V2.4.1 fixes flickering and applies uniform light theme coloring.
 *               V2.4.2 distinguishes between Firestore-blocked dates (hard) and minimum stay dates (light).
 * @dependencies: BookingProvider, date-fns, react-day-picker
 * @replaces: Multiple date selector components from V1
 * @v2.1-changes: Removed manual "Check Price" button, added automatic pricing trigger
 * @v2.1.1-changes: Added BookingSummaryText, DateRangeDisplay, PricingStatusDisplay memoized components
 * @v2.2-changes: Made text conversational, removed pricing calculation message
 * @v2.3-changes: Fixed stale booking summary display on pricing errors, added calendar help text
 * @v2.4-changes: Added rangeModifiers calculation and range highlighting CSS classes for visual feedback
 * @v2.4.1-changes: Removed selected prop conflicts, removed CSS class overrides, uniform light coloring
 * @v2.4.2-changes: Added range_blocked modifier for Firestore unavailable dates with red warning styling
 */

"use client";

import React, { useCallback, useMemo, useState, memo } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { addDays, isBefore, isAfter, isSameDay, format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { useBooking } from '../contexts';
import { useLanguage } from '@/lib/language-system';
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
  const { t, currentLang, translations } = useLanguage();
  
  const {
    property,
    checkInDate,
    checkOutDate,
    guestCount,
    unavailableDates,
    isLoadingUnavailable,
    unavailableError,
    pricing,
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

  // V2.4: Range highlighting calculation for visual feedback
  const rangeModifiers = useMemo(() => {
    if (!checkInDate || !checkOutDate) {
      return {
        selected: [],
        range_start: [],
        range_middle: [],
        range_end: [],
        range_blocked: []
      };
    }

    // Get dates between check-in and check-out (excluding both start and end)
    const middleDates = getDatesBetween(addDays(checkInDate, 1), checkOutDate);
    
    // Separate blocked dates (hard unavailable from Firestore) within the range
    const blockedInRange = middleDates.filter(date => 
      unavailableDates.some(unavailable => isSameDay(date, unavailable))
    );
    
    // Get middle dates that are NOT blocked
    const normalMiddleDates = middleDates.filter(date => 
      !unavailableDates.some(unavailable => isSameDay(date, unavailable))
    );
    
    const modifiers = {
      selected: [checkInDate, checkOutDate],
      range_start: [checkInDate],
      range_middle: normalMiddleDates,
      range_end: [checkOutDate],
      range_blocked: blockedInRange
    };
    
    return modifiers;
  }, [checkInDate, checkOutDate, getDatesBetween, unavailableDates]);

  // Generate guest count options
  const guestOptions = useMemo(() => {
    const options = [];
    for (let i = 1; i <= property.maxGuests; i++) {
      options.push(
        <SelectItem key={i} value={i.toString()}>
          {i} {i === 1 ? t('booking.guest', 'Guest') : t('booking.guests', 'Guests')}
          {i === property.baseOccupancy && ` (${t('booking.standard', 'Standard')})`}
        </SelectItem>
      );
    }
    return options;
  }, [property.maxGuests, property.baseOccupancy, t]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Combined Date and Guest Selection - Compact */}
      <TooltipProvider>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              {t('booking.selectDatesAndGuests', 'Selectează datele și oaspeții')}
            </CardTitle>
            <div className="space-y-1">
              {property.defaultMinimumStay > 1 && (
                <p className="text-sm text-muted-foreground">
                  {t('booking.minimumNightsRequired', 'Minimum {{nights}} nights required', { nights: property.defaultMinimumStay })}
                </p>
              )}
            </div>
          </CardHeader>
        <CardContent>
          {isLoadingUnavailable ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">{t('booking.loadingAvailability', 'Loading availability...')}</span>
            </div>
          ) : unavailableError ? (
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">{unavailableError}</p>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                {t('common.retry', 'Retry')}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Date Selection Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Check-in Date Picker */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">{t('booking.checkInDate', 'Check-in Date')}</label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground cursor-help">ⓘ</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('booking.checkInOutTime', 'Check-in after 3 PM, check-out by 11 AM')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Popover open={checkInOpen} onOpenChange={setCheckInOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal h-11 px-4",
                          !checkInDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {checkInDate ? format(checkInDate, "PPP", { locale: currentLang === 'ro' ? ro : undefined }) : t('booking.selectYourDates', 'Select your dates')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <DayPicker
                        mode="single"
                        onSelect={handleCheckInChange}
                        disabled={checkInDisabledDates}
                        initialFocus
                        modifiers={rangeModifiers}
                        modifiersStyles={{
                          range_start: { 
                            backgroundColor: 'hsl(var(--primary) / 0.15)', 
                            color: 'hsl(var(--primary))', 
                            borderRadius: '20px 0 0 20px',
                            fontWeight: '500'
                          },
                          range_middle: { 
                            backgroundColor: 'hsl(var(--primary) / 0.15)', 
                            color: 'hsl(var(--primary))', 
                            borderRadius: '0',
                            fontWeight: '500'
                          },
                          range_end: { 
                            backgroundColor: 'hsl(var(--primary) / 0.15)', 
                            color: 'hsl(var(--primary))', 
                            borderRadius: '0 20px 20px 0',
                            fontWeight: '500'
                          },
                          range_blocked: {
                            backgroundColor: 'hsl(var(--destructive) / 0.15)',
                            color: 'hsl(var(--destructive))',
                            borderRadius: '0',
                            fontWeight: '600',
                            textDecoration: 'line-through',
                            textDecorationThickness: '2px',
                            opacity: '1'
                          }
                        }}
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
                          head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] flex-1",
                          row: "flex w-full mt-2",
                          cell: "text-center text-sm p-0 relative flex-1 focus-within:relative focus-within:z-20",
                          day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
                          day_today: "bg-accent text-accent-foreground",
                          day_outside: "text-muted-foreground opacity-50",
                          day_disabled: "text-muted-foreground opacity-50 line-through",
                          day_hidden: "invisible"
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Check-out Date Picker */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">{t('booking.checkOutDate', 'Check-out Date')}</label>
                  </div>
                  <Popover open={checkOutOpen} onOpenChange={setCheckOutOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal h-11 px-4",
                          !checkOutDate && "text-muted-foreground"
                        )}
                        disabled={!checkInDate}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {checkOutDate ? format(checkOutDate, "PPP", { locale: currentLang === 'ro' ? ro : undefined }) : t('booking.selectDate', 'Select date')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <DayPicker
                        mode="single"
                        onSelect={handleCheckOutChange}
                        disabled={checkOutDisabledDates}
                        initialFocus
                        defaultMonth={checkInDate ? addDays(checkInDate, property.defaultMinimumStay || 1) : undefined}
                        modifiers={rangeModifiers}
                        modifiersStyles={{
                          range_start: { 
                            backgroundColor: 'hsl(var(--primary) / 0.15)', 
                            color: 'hsl(var(--primary))', 
                            borderRadius: '20px 0 0 20px',
                            fontWeight: '500',
                            textDecoration: 'none',
                            opacity: '1'
                          },
                          range_middle: { 
                            backgroundColor: 'hsl(var(--primary) / 0.15)', 
                            color: 'hsl(var(--primary))', 
                            borderRadius: '0',
                            fontWeight: '500',
                            textDecoration: 'none',
                            opacity: '1'
                          },
                          range_end: { 
                            backgroundColor: 'hsl(var(--primary) / 0.15)', 
                            color: 'hsl(var(--primary))', 
                            borderRadius: '0 20px 20px 0',
                            fontWeight: '500',
                            textDecoration: 'none',
                            opacity: '1'
                          },
                          range_blocked: {
                            backgroundColor: 'hsl(var(--destructive) / 0.15)',
                            color: 'hsl(var(--destructive))',
                            borderRadius: '0',
                            fontWeight: '600',
                            textDecoration: 'line-through',
                            textDecorationThickness: '2px',
                            opacity: '1'
                          }
                        }}
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
                          head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] flex-1",
                          row: "flex w-full mt-2",
                          cell: "text-center text-sm p-0 relative flex-1 focus-within:relative focus-within:z-20",
                          day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
                          day_today: "bg-accent text-accent-foreground",
                          day_outside: "text-muted-foreground opacity-50",
                          day_disabled: "text-muted-foreground opacity-50 line-through",
                          day_hidden: "invisible"
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  {!checkInDate && (
                    <p className="text-xs text-muted-foreground">{t('booking.selectCheckInFirst', 'Select check-in date first')}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Visual Separator */}
          <div className="border-t border-border my-4" />
          
          {/* Guest Selection Row - Below dates with visual separation */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <label className="text-sm font-medium">{t('booking.numberOfGuests', 'Number of Guests')}</label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground cursor-help">ⓘ</span>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-1">
                    <p>{t('booking.maxGuests', 'Max {{guests}} guests', { guests: property.maxGuests })}</p>
                    <p className="text-xs opacity-80">{t('booking.extraGuestsNotAllowed', 'Extra guests are not allowed without approval')}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            <Select value={guestCount.toString()} onValueChange={handleGuestCountChange}>
              <SelectTrigger className="w-full h-11">
                <SelectValue placeholder={t('booking.selectNumberOfGuests', 'Select number of guests')} />
              </SelectTrigger>
              <SelectContent>
                {guestOptions}
              </SelectContent>
            </Select>
          </div>

          {/* Minimum Stay Warning */}
          {showMinStayWarning && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">
                {t('booking.pleaseSelectCheckoutDate', 'Please select checkout date (minimum {{nights}} nights required)', { nights: property.defaultMinimumStay })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      </TooltipProvider>

      {/* V2.6: Minimal Status Display - Summary moved to pricing sidebar */}
      {checkInDate && checkOutDate && (isLoadingPricing || pricingError) && (
        <Card>
          <CardContent className="py-4">
            {/* Loading State - Show while checking pricing */}
            {isLoadingPricing && (
              <div className="text-center">
                <PricingStatusDisplay 
                  isLoadingPricing={isLoadingPricing} 
                  pricingError={pricingError} 
                  fetchPricing={fetchPricing}
                  t={t} 
                />
              </div>
            )}

            {/* Error State - Show pricing errors */}
            {!isLoadingPricing && pricingError && (
              <div className="text-center">
                <PricingStatusDisplay 
                  isLoadingPricing={isLoadingPricing} 
                  pricingError={pricingError} 
                  fetchPricing={fetchPricing}
                  t={t} 
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// V2.1.1: Inline Memoized Components for Surgical Number Updates
// These components only re-render when their specific props change

const BookingSummaryText = memo(function BookingSummaryText({ 
  nights, 
  guests,
  t 
}: { 
  nights: number; 
  guests: number;
  t: (key: string, fallback: string, options?: any) => string;
}) {
  return (
    <h3 className="text-lg font-semibold">
      {t('booking.bookingSummary', "You're booking a {{nights}}-night stay for {{guests}} {{guestLabel}}", {
        nights,
        guests,
        guestLabel: guests === 1 ? t('booking.guest', 'guest') : t('booking.guests', 'guests')
      })}
    </h3>
  );
});

const DateRangeDisplay = memo(function DateRangeDisplay({ 
  checkInDate, 
  checkOutDate,
  t,
  currentLang 
}: { 
  checkInDate: Date | null; 
  checkOutDate: Date | null; 
  t: (key: string, fallback: string, options?: any) => string;
  currentLang: string;
}) {
  if (!checkInDate || !checkOutDate) return null;
  
  const locale = currentLang === 'ro' ? ro : undefined;
  
  return (
    <p className="text-sm text-muted-foreground">
      {t('booking.arrivingLeaving', 'Arriving {{arrivalDate}} and leaving {{departureDate}}', {
        arrivalDate: format(checkInDate, "EEEE, MMMM d", { locale }),
        departureDate: format(checkOutDate, "EEEE, MMMM d", { locale })
      })}
    </p>
  );
});

const PricingStatusDisplay = memo(function PricingStatusDisplay({ 
  isLoadingPricing, 
  pricingError, 
  fetchPricing,
  t 
}: { 
  isLoadingPricing: boolean; 
  pricingError: string | null; 
  fetchPricing: () => void;
  t: (key: string, fallback: string, options?: any) => string; 
}) {
  if (isLoadingPricing) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">{t('booking.calculatingPrice', 'Calculating your price...')}</span>
      </div>
    );
  }

  if (pricingError) {
    return (
      <div className="text-center py-4">
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
          <p className="text-red-800 text-sm font-medium">{pricingError}</p>
          <p className="text-red-700 text-xs">
            {t('booking.unavailableDatesNote', 'Unavailable dates are marked with strikethrough in the calendar')}
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-3"
          onClick={fetchPricing}
        >
          {t('booking.retryPricing', 'Retry Pricing')}
        </Button>
      </div>
    );
  }

  return null; // No message needed - pricing calculates automatically
});