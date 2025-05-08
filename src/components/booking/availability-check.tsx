// src/components/booking/availability-check.tsx
"use client";

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, differenceInDays, addDays, parseISO, isValid, isAfter, startOfDay, startOfMonth, subMonths } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import {
  Loader2,
  Calendar as CalendarIcon,
  ArrowRight,
  AlertTriangle,
  Pencil,
} from 'lucide-react';

import type { Property, Availability, PriceCalculationResult, CurrencyCode } from '@/types';
import { getUnavailableDatesForProperty } from '@/services/bookingService';
import { createPendingBookingAction } from '@/app/actions/booking-actions';
import { createCheckoutSession } from '@/app/actions/create-checkout-session';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from '@/components/ui/label'; // Import Label
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { useSessionStorage } from '@/hooks/use-session-storage';
import { sanitizeEmail, sanitizePhone, sanitizeText } from '@/lib/sanitize';
import { useCurrency } from '@/contexts/CurrencyContext';
import { calculatePrice } from '@/lib/price-utils';
import { cn } from '@/lib/utils';

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

  // --- Guest Info State (managed here, passed down) ---
  const [firstName, setFirstName] = useSessionStorage<string>(`booking_${propertySlug}_firstName`, '');
  const [lastName, setLastName] = useSessionStorage<string>(`booking_${propertySlug}_lastName`, '');
  const [email, setEmail] = useSessionStorage<string>(`booking_${propertySlug}_email`, '');
  const [phone, setPhone] = useSessionStorage<string>(`booking_${propertySlug}_phone`, '');


  // --- Derived State ---
  const dateRange: DateRange | undefined = useMemo(() => {
    return checkInDate && checkOutDate ? { from: checkInDate, to: checkOutDate } : undefined;
  }, [checkInDate, checkOutDate]);

  const datesSelected = checkInDate && checkOutDate && isValid(checkInDate) && isValid(checkOutDate) && isAfter(checkOutDate, checkInDate);
  const numberOfNights = useMemo(() => {
    if (datesSelected && checkInDate && checkOutDate) {
      return differenceInDays(startOfDay(checkOutDate), startOfDay(checkInDate));
    }
    return 0;
  }, [checkInDate, checkOutDate, datesSelected]);

  // --- Pricing Calculation ---
  const pricingDetailsInBaseCurrency = useMemo(() => {
    const currentGuests = typeof numberOfGuests === 'number' && !isNaN(numberOfGuests) ? numberOfGuests : (property.baseOccupancy || 1);
    if (datesSelected && currentGuests > 0 && numberOfNights > 0) {
      return calculatePrice(
        property.pricePerNight,
        numberOfNights,
        property.cleaningFee ?? 0,
        currentGuests,
        property.baseOccupancy,
        property.extraGuestFee ?? 0,
        propertyBaseCcy,
        appliedCoupon?.discountPercentage
      );
    }
    return null;
  }, [datesSelected, property, numberOfNights, numberOfGuests, appliedCoupon, propertyBaseCcy]);

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
      while (isAfter(checkOutDate, current)) { // Changed from isBefore to isAfter, should be correct
        const dateString = format(startOfDay(current), 'yyyy-MM-dd');
        if (fetchedUnavailableDates.some(d => format(startOfDay(d), 'yyyy-MM-dd') === dateString)) {
          conflict = true;
          break;
        }
        current = addDays(current, 1);
      }
      setIsAvailable(!conflict);

      if (conflict) {
        // Basic suggestion logic (find next available block of same length)
        let suggestionFound = false;
        let suggestionStart = addDays(checkOutDate!, 1); // Start searching from the day after requested checkout
        const maxSearchDate = addDays(checkOutDate!, 60); // Limit search to avoid infinite loops

        while (isAfter(maxSearchDate, suggestionStart) && !suggestionFound) {
            const suggestionEnd = addDays(suggestionStart, numberOfNights);
            let suggestionConflict = false;
            let checkCurrent = new Date(suggestionStart.getTime());

            while(isAfter(suggestionEnd, checkCurrent)) {
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
  }, [checkInDate, checkOutDate, datesSelected, propertySlug, numberOfNights, toast]);

  useEffect(() => {
    checkPropertyAvailability();
  }, [checkPropertyAvailability]);

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

  const handleContinueToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const currentGuests = typeof numberOfGuests === 'number' && !isNaN(numberOfGuests) ? numberOfGuests : (property.baseOccupancy || 1);
    if (currentGuests < 1 || currentGuests > property.maxGuests) {
      setFormError(`Number of guests must be between 1 and ${property.maxGuests}. Current: ${currentGuests}`);
      return;
    }
    if (!datesSelected || isAvailable !== true || !checkInDate || !checkOutDate) {
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
        numberOfGuests: currentGuests,
        pricing: {
          ...pricingDetailsInBaseCurrency,
          currency: propertyBaseCcy, // Pass base currency
        },
        status: 'pending' as const,
        appliedCouponCode: appliedCoupon?.code || null, // Send null if no coupon
      };

      const pendingBookingResult = await createPendingBookingAction(bookingInput);

      if (pendingBookingResult.error || !pendingBookingResult.bookingId) {
        throw new Error(pendingBookingResult.error || "Failed to create pending booking.");
      }

      const { bookingId } = pendingBookingResult;

      const checkoutInput = {
        property: property,
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
        numberOfGuests: currentGuests,
        totalPrice: pricingDetailsInBaseCurrency.total, // Total in base currency
        numberOfNights: numberOfNights,
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
      // Only render if dates are unavailable
      if (isAvailable === true || isLoadingAvailability) {
          return null;
      }
      // Default to today if checkInDate is not valid or unavailable
      const validCheckIn = checkInDate && isValid(checkInDate) ? checkInDate : new Date();
      // Calculate the center month (one month before the target month)
      const calendarCenterMonth = startOfMonth(subMonths(validCheckIn, 1));

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
    <div className="max-w-2xl mx-auto w-full px-4">
      {/* Date Picker */}
      <div className="mb-6">
          <Label className="mb-1 block text-sm font-medium">Select Dates</Label>
          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-between text-left font-normal flex items-center",
                  !dateRange && "text-muted-foreground"
                )}
                disabled={isProcessingBooking || isLoadingAvailability}
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
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={handleDateSelect}
                numberOfMonths={2}
                disabled={{ before: startOfDay(new Date()) }}
              />
            </PopoverContent>
          </Popover>
           {numberOfNights > 0 && (
             <p className="text-xs text-muted-foreground mt-1 text-right">
               ({numberOfNights} nights)
             </p>
           )}
      </div>

      {/* Availability Status and Notifications */}
      <AvailabilityStatus
        isLoadingAvailability={isLoadingAvailability}
        isAvailable={isAvailable}
        datesSelected={!!datesSelected}
        checkInDate={checkInDate}
        checkOutDate={checkOutDate}
        numberOfNights={numberOfNights}
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

       {/* Calendar (only if dates are unavailable) */}
      {renderAvailabilityCalendar()}

      {/* Guest Info & Pricing Form (only if dates ARE available) */}
      {isAvailable === true && !isLoadingAvailability && (
        <Card className="w-full mt-8">
          <CardHeader>
            <CardTitle>Booking Summary & Details</CardTitle>
            <CardDescription>Confirm details and proceed to payment.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleContinueToPayment} className="space-y-6">
              <GuestInfoForm
                property={property}
                numberOfGuests={numberOfGuests}
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
               {/* Removed Test Booking Button - keep separate if needed */}
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
