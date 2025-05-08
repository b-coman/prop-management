// src/components/booking/availability-check.tsx
"use client";

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  format,
  differenceInDays,
  addDays,
  parseISO,
  isValid,
  isAfter,
  startOfDay,
  startOfMonth,
  subMonths,
  isBefore,
} from 'date-fns';
import type { DateRange } from 'react-day-picker';
import {
  Loader2,
  Calendar as CalendarIcon,
  ArrowRight,
  AlertTriangle,
  Pencil,
  Minus,
  Plus,
} from 'lucide-react';

import type { Property, Availability, PriceCalculationResult, CurrencyCode } from '@/types';
import { getUnavailableDatesForProperty } from '@/services/bookingService';
import { createPendingBookingAction } from '@/app/actions/booking-actions';
import { createCheckoutSession } from '@/app/actions/create-checkout-session';


import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { useSessionStorage } from '@/hooks/use-session-storage';
import { sanitizeEmail, sanitizePhone, sanitizeText } from '@/lib/sanitize';
import { useCurrency } from '@/contexts/CurrencyContext';
import { calculatePrice } from '@/lib/price-utils';
import { cn } from '@/lib/utils';
import { Label } from "@/components/ui/label";

import { AvailabilityCalendar } from './availability-calendar';
import { AvailabilityStatus } from './availability-status';
import { GuestInfoForm } from './guest-info-form';


interface AvailabilityCheckProps {
  property: Property;
  initialCheckIn?: string;
  initialCheckOut?: string;
}

const parseDateSafe = (dateStr: string | undefined | null): Date | null => {
  if (!dateStr) return null;
  try {
    const parsed = parseISO(dateStr);
    return isValid(parsed) ? startOfDay(parsed) : null;
  } catch {
    return null;
  }
};

export function AvailabilityCheck({
  property,
  initialCheckIn,
  initialCheckOut,
}: AvailabilityCheckProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { selectedCurrency, baseCurrencyForProperty } = useCurrency();
  const propertySlug = property.slug;
  const propertyBaseCcy = baseCurrencyForProperty(property.baseCurrency);

  // --- Core State ---
  const [checkInDate, setCheckInDate] = useSessionStorage<Date | null>(`booking_${propertySlug}_checkIn`, parseDateSafe(initialCheckIn));
  const [checkOutDate, setCheckOutDate] = useSessionStorage<Date | null>(`booking_${propertySlug}_checkOut`, parseDateSafe(initialCheckOut));
  const [numberOfGuests, setNumberOfGuests] = useSessionStorage<number>(`booking_${propertySlug}_guests`, property.baseOccupancy || 1);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true);
  const [unavailableDates, setUnavailableDates] = useState<Date[]>([]);
  const [suggestedDates, setSuggestedDates] = useState<Array<{ from: Date; to: Date; recommendation?: string }>>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPercentage: number } | null>(null);
  const [isProcessingBooking, setIsProcessingBooking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  // State for client-side rendering of formatted date string
  const [displayDateRangeString, setDisplayDateRangeString] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false); // Track client mount
  const [clientNumberOfNights, setClientNumberOfNights] = useState<number>(0); // State for client-side night calculation

  // --- Guest Info State (managed here, passed down) ---
  const [firstName, setFirstName] = useSessionStorage<string>(`booking_${propertySlug}_firstName`, '');
  const [lastName, setLastName] = useSessionStorage<string>(`booking_${propertySlug}_lastName`, '');
  const [email, setEmail] = useSessionStorage<string>(`booking_${propertySlug}_email`, '');
  const [phone, setPhone] = useSessionStorage<string>(`booking_${propertySlug}_phone`, '');

  // Indicate component has mounted
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Use guestsDisplay for guest count logic
  const guestsDisplay = useMemo(() => {
    // Ensure numberOfGuests is treated as a number before validation
    const guestValue = typeof numberOfGuests === 'string' ? parseInt(numberOfGuests, 10) : numberOfGuests;
    return typeof guestValue === 'number' && !isNaN(guestValue) && guestValue > 0
      ? guestValue
      : (property.baseOccupancy || 1);
  }, [numberOfGuests, property.baseOccupancy]);

  // --- Derived State ---
  const dateRange: DateRange | undefined = useMemo(() => {
    return checkInDate && checkOutDate ? { from: checkInDate, to: checkOutDate } : undefined;
  }, [checkInDate, checkOutDate]);

  // Calculate datesSelected and numberOfNights client-side after mount
  const datesSelected = useMemo(() =>
    checkInDate && checkOutDate && isValid(checkInDate) && isValid(checkOutDate) && isAfter(checkOutDate, checkInDate),
    [checkInDate, checkOutDate]
  );

  // Calculate numberOfNights on the client after hydration
  useEffect(() => {
    if (hasMounted) { // Ensure this runs only on the client
      if (datesSelected && checkInDate && checkOutDate) {
        setClientNumberOfNights(differenceInDays(checkOutDate, checkInDate));
      } else {
        setClientNumberOfNights(0);
      }
    }
  }, [checkInDate, checkOutDate, datesSelected, hasMounted]);


  // Update display string only on client after mount
  useEffect(() => {
    if (!hasMounted) return; // Don't run on server or before mount

    if (dateRange?.from) {
      if (dateRange.to) {
        setDisplayDateRangeString(
          `${format(dateRange.from, 'LLL dd, y')} - ${format(dateRange.to, 'LLL dd, y')}`
        );
      } else {
        setDisplayDateRangeString(format(dateRange.from, 'LLL dd, y'));
      }
    } else {
      setDisplayDateRangeString(null); // Reset if no date range
    }
  }, [dateRange, hasMounted]);


  // --- Pricing Calculation ---
  const pricingDetailsInBaseCurrency = useMemo(() => {
    const currentGuests = guestsDisplay; // Use derived guests state
    // Use clientNumberOfNights for calculation
    if (datesSelected && currentGuests > 0 && clientNumberOfNights > 0) {
      return calculatePrice(
        property.pricePerNight,
        clientNumberOfNights, // Use client-side calculated nights
        property.cleaningFee ?? 0,
        currentGuests,
        property.baseOccupancy,
        property.extraGuestFee ?? 0,
        propertyBaseCcy,
        appliedCoupon?.discountPercentage
      );
    }
    return null;
  }, [datesSelected, property, clientNumberOfNights, guestsDisplay, appliedCoupon, propertyBaseCcy]); // Depend on clientNumberOfNights and guestsDisplay


  // --- Availability Check Logic ---
  const checkPropertyAvailability = useCallback(async () => {
    setIsAvailable(null);
    setIsLoadingAvailability(true);
    setSuggestedDates([]);

    if (!datesSelected || !checkInDate || !checkOutDate) {
      setIsLoadingAvailability(false);
      return;
    }

    try {
      const fetchedUnavailableDates = await getUnavailableDatesForProperty(propertySlug);
      setUnavailableDates(fetchedUnavailableDates);

      let conflict = false;
      let current = new Date(checkInDate.getTime());
      while (isBefore(current, checkOutDate)) { // Check days *within* the range, excluding checkout day
        const dateString = format(startOfDay(current), 'yyyy-MM-dd');
        if (fetchedUnavailableDates.some(d => format(startOfDay(d), 'yyyy-MM-dd') === dateString)) {
          conflict = true;
          break;
        }
        current = addDays(current, 1);
      }
      setIsAvailable(!conflict);

      if (conflict && clientNumberOfNights > 0) { // Ensure clientNumberOfNights is calculated
        // Basic suggestion logic (find next available block of same length)
        let suggestionFound = false;
        let suggestionStart = addDays(checkOutDate, 1); // Start searching from the day after requested checkout
        const maxSearchDate = addDays(checkOutDate, 60); // Limit search to avoid infinite loops

        while (isAfter(maxSearchDate, suggestionStart) && !suggestionFound) {
            const suggestionEnd = addDays(suggestionStart, clientNumberOfNights); // Use clientNumberOfNights
            let suggestionConflict = false;
            let checkCurrent = new Date(suggestionStart.getTime());

            while(isBefore(checkCurrent, suggestionEnd)) { // Check days *within* the range
                 const checkDateString = format(startOfDay(checkCurrent), 'yyyy-MM-dd');
                 if (fetchedUnavailableDates.some(d => format(startOfDay(d), 'yyyy-MM-dd') === checkDateString) || isBefore(checkCurrent, startOfDay(new Date()))) {
                      suggestionConflict = true;
                      break;
                 }
                checkCurrent = addDays(checkCurrent, 1);
            }

            if (!suggestionConflict) {
                 setSuggestedDates([{ from: suggestionStart, to: suggestionEnd, recommendation: "Next Available" }]);
                 suggestionFound = true;
            } else {
                suggestionStart = addDays(suggestionStart, 1); // Move to the next day
            }
        }
          if (!suggestionFound) {
              console.log("No alternative dates found within 60 days.");
              // Optionally set a state to indicate no suggestions were found
          }

      }
    } catch (error) {
      console.error("Error checking availability:", error);
      toast({
        title: "Error Checking Availability",
        description: "Could not check property availability. Please try again.",
        variant: "destructive",
      });
      setIsAvailable(false);
    } finally {
      setIsLoadingAvailability(false);
    }
  }, [checkInDate, checkOutDate, datesSelected, propertySlug, clientNumberOfNights, toast]); // Depend on clientNumberOfNights

  useEffect(() => {
    // Run availability check only after mount and when dates/nights are ready
    if (hasMounted && datesSelected && clientNumberOfNights > 0) {
        checkPropertyAvailability();
    } else if (hasMounted && !datesSelected) {
        // Reset availability if dates become invalid
        setIsAvailable(null);
        setIsLoadingAvailability(false);
        setUnavailableDates([]);
        setSuggestedDates([]);
    }
  }, [checkPropertyAvailability, hasMounted, datesSelected, clientNumberOfNights]); // Depend on hasMounted and clientNumberOfNights


  // --- Event Handlers ---
  const handleSelectAlternativeDate = (range: { from: Date; to: Date }) => {
    setCheckInDate(range.from);
    setCheckOutDate(range.to);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDateSelect = (range: DateRange | undefined) => {
    if (range?.from) {
      setCheckInDate(startOfDay(range.from));
    } else {
      setCheckInDate(null); // Clear if 'from' is undefined
    }
    if (range?.to) {
      setCheckOutDate(startOfDay(range.to));
    } else {
      setCheckOutDate(null); // Clear if 'to' is undefined
    }
    setIsDatePickerOpen(false); // Close popover after selection
  };

  const handleGuestChange = (change: number) => {
    setNumberOfGuests((prev) => {
      // Use the derived guestsDisplay logic to ensure correct base for calculation
      const currentGuests = typeof prev === 'number' && !isNaN(prev) && prev > 0
        ? prev
        : (property.baseOccupancy || 1);
      const newCount = currentGuests + change;
      // Ensure bounds are respected
      return Math.max(1, Math.min(newCount, property.maxGuests));
    });
  };

  const handleContinueToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Use guestsDisplay for validation
    if (guestsDisplay < 1 || guestsDisplay > property.maxGuests) {
      setFormError(`Number of guests must be between 1 and ${property.maxGuests}. Current: ${guestsDisplay}`);
      return;
    }
    if (!datesSelected || isAvailable !== true || !checkInDate || !checkOutDate || clientNumberOfNights <= 0) { // Check clientNumberOfNights
      setFormError("Selected dates are not available or invalid.");
      return;
    }
    if (!firstName || !lastName || !email) {
      setFormError("Please fill in your first name, last name, and email.");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setFormError("Please enter a valid email address.");
      return;
    }
    if (!phone) {
      setFormError("Please enter your phone number.");
      return;
    }
    if (!pricingDetailsInBaseCurrency) {
      setFormError("Could not calculate pricing. Please try again.");
      return;
    }

    setIsProcessingBooking(true);

    try {
       const bookingInput = {
        propertyId: propertySlug,
        guestInfo: { firstName: sanitizeText(firstName), lastName: sanitizeText(lastName), email: sanitizeEmail(email), phone: sanitizePhone(phone) },
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
        numberOfGuests: guestsDisplay, // Use derived state
        pricing: {
          ...pricingDetailsInBaseCurrency,
          currency: propertyBaseCcy, // Pass base currency
          // Ensure numberOfNights here matches clientNumberOfNights if needed by schema
          numberOfNights: clientNumberOfNights,
        },
        status: 'pending' as const,
        appliedCouponCode: appliedCoupon?.code ?? null, // Pass null if no coupon applied
      };
      console.log("[Action createPendingBookingAction] Called with input:", JSON.stringify(bookingInput, null, 2));

      const pendingBookingResult = await createPendingBookingAction(bookingInput);
      console.log("[Action createPendingBookingAction] Result:", pendingBookingResult);


      if (pendingBookingResult.error || !pendingBookingResult.bookingId) {
        throw new Error(pendingBookingResult.error || "Failed to create pending booking.");
      }

      const { bookingId } = pendingBookingResult;

      const checkoutInput = {
        property: property,
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
        numberOfGuests: guestsDisplay, // Use derived state
        totalPrice: pricingDetailsInBaseCurrency.total, // Total in base currency
        numberOfNights: clientNumberOfNights, // Use clientNumberOfNights
        appliedCouponCode: appliedCoupon?.code,
        discountPercentage: appliedCoupon?.discountPercentage,
        guestFirstName: sanitizeText(firstName),
        guestLastName: sanitizeText(lastName),
        guestEmail: sanitizeEmail(email),
        pendingBookingId: bookingId,
      };

      const stripeResult = await createCheckoutSession(checkoutInput);

      if (stripeResult.error || !stripeResult.sessionId || !stripeResult.sessionUrl) {
        throw new Error(stripeResult.error || 'Failed to create Stripe session or missing session URL.');
      }

       if (stripeResult.sessionUrl) {
          // Redirect using window.location.href
          window.location.href = stripeResult.sessionUrl;
       } else {
          throw new Error("Stripe session URL is missing.");
       }

    } catch (error) {
      console.error("Error processing booking:", error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      setFormError(errorMessage);
      toast({
        title: "Booking Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessingBooking(false);
    }
  };


  // --- Calendar Rendering Logic ---
   const renderAvailabilityCalendar = () => {
       // Only render if dates are explicitly unavailable and component has mounted
       if (isAvailable === true || isLoadingAvailability || !datesSelected || !hasMounted) {
           return null;
       }
       // Default to today if checkInDate is not valid or unavailable
       const validCheckIn = checkInDate && isValid(checkInDate) ? checkInDate : new Date();
       // Calculate the center month (one month before the target month)
       const calendarCenterMonth = startOfMonth(validCheckIn); // Show requested month in center

       return (
           <div className="mt-6">
           <h3 className="text-lg font-semibold mb-3">Availability Calendar</h3>
           <AvailabilityCalendar
               currentMonth={calendarCenterMonth}
               unavailableDates={unavailableDates}
               selectedRange={dateRange}
           />
           </div>
       );
   };

  // --- Main Render ---
  return (
    // Apply max-width and mx-auto to center the content
    // Added padding-x for spacing on smaller screens
    <div className="max-w-2xl mx-auto w-full px-4">

      {/* Availability Status and Notifications */}
      <AvailabilityStatus
        isLoadingAvailability={isLoadingAvailability}
        isAvailable={isAvailable}
        datesSelected={!!datesSelected}
        checkInDate={checkInDate}
        checkOutDate={checkOutDate}
        numberOfNights={clientNumberOfNights} // Pass client-side calculated nights
        suggestedDates={suggestedDates}
        unavailableDates={unavailableDates}
        handleSelectAlternativeDate={handleSelectAlternativeDate}
        propertySlug={propertySlug}
        email={email}
        setEmail={setEmail}
        phone={phone}
        setPhone={setPhone}
        isProcessingBooking={isProcessingBooking}
      />

      {/* Date Picker and Guest Count */}
      {/* Moved these sections below AvailabilityStatus */}
      <div className="mt-6 space-y-6">
          {/* Date Picker */}
          <div>
              <Label className="mb-1 block text-sm font-medium">Selected Dates</Label>
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-grow justify-between text-left font-normal flex items-center w-full", // Ensure button takes full width
                      !displayDateRangeString && "text-muted-foreground" // Style when no date is displayed yet
                    )}
                    disabled={isProcessingBooking || isLoadingAvailability || !hasMounted} // Disable until mounted
                  >
                    <div className="flex items-center">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {/* Render placeholder until mounted or date is set */}
                      {hasMounted && displayDateRangeString ? (
                        displayDateRangeString
                      ) : (
                        <span>{hasMounted ? 'Pick a date range' : 'Loading dates...'}</span>
                      )}
                    </div>
                    <Pencil className="h-3 w-3 opacity-50 ml-auto" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={handleDateSelect}
                    numberOfMonths={2}
                    disabled={{ before: startOfDay(new Date()) }}
                  />
                </PopoverContent>
              </Popover>
              {clientNumberOfNights > 0 && hasMounted && (
                 <p className="text-sm text-muted-foreground mt-1">
                   ({clientNumberOfNights} {clientNumberOfNights === 1 ? 'night' : 'nights'})
                 </p>
              )}
          </div>

          {/* Number of Guests */}
          <div className="space-y-1">
            <Label htmlFor="guests">Number of Guests</Label>
            <div className="flex items-center justify-between rounded-md border p-2 mt-1 w-full max-w-xs"> {/* Limit width */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleGuestChange(-1)}
                disabled={guestsDisplay <= 1 || isProcessingBooking}
                aria-label="Decrease guests"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="mx-4 font-medium w-8 text-center" id="guests">
                {guestsDisplay}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleGuestChange(1)}
                disabled={guestsDisplay >= property.maxGuests || isProcessingBooking}
                aria-label="Increase guests"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Max {property.maxGuests}. Base for {property.baseOccupancy}.
              {(property.extraGuestFee ?? 0) > 0 && ` Extra: ${property.extraGuestFee ?? 0} ${propertyBaseCcy}/guest/night.`}
            </p>
          </div>
       </div>


       {/* Calendar (only if dates are unavailable) */}
      {renderAvailabilityCalendar()}

      {/* Guest Info & Pricing Form (only if dates ARE available) */}
      {isAvailable === true && !isLoadingAvailability && datesSelected && (
        <Card className="w-full mt-8">
          <CardHeader>
            <CardTitle>Booking Summary & Details</CardTitle>
            <CardDescription>Confirm details and proceed to payment.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleContinueToPayment} className="space-y-6">
              <GuestInfoForm
                property={property}
                numberOfGuests={numberOfGuests} // Pass raw state
                setNumberOfGuests={setNumberOfGuests}
                firstName={firstName}
                setFirstName={setFirstName}
                lastName={lastName}
                setLastName={setLastName}
                email={email}
                setEmail={setEmail}
                phone={phone}
                setPhone={setPhone}
                checkInDate={checkInDate}
                checkOutDate={checkOutDate}
                appliedCoupon={appliedCoupon}
                setAppliedCoupon={setAppliedCoupon}
                pricingDetailsInBaseCurrency={pricingDetailsInBaseCurrency}
                isProcessingBooking={isProcessingBooking}
              />

              {formError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={isProcessingBooking || !datesSelected || isAvailable !== true}>
                {isProcessingBooking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                {isProcessingBooking ? 'Processing...' : 'Continue to Payment'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
