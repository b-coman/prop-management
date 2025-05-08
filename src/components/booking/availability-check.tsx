
// src/components/booking/availability-check.tsx
"use client";

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, differenceInDays, addDays, parseISO, isValid, isBefore, startOfDay, isAfter, startOfMonth, subMonths } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import {
  Loader2,
  Calendar as CalendarIcon,
  ArrowRight,
  AlertTriangle,
  Pencil, // Import Pencil icon
} from 'lucide-react';

import type { Property, Availability, PriceCalculationResult, CurrencyCode } from '@/types';
import { getUnavailableDatesForProperty } from '@/services/bookingService';
import { createPendingBookingAction } from '@/app/actions/booking-actions';
import { createCheckoutSession } from '@/app/actions/create-checkout-session'; // Direct import

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AvailabilityCalendar } from './availability-calendar';
import { calculatePrice } from '@/lib/price-utils';
import { useSessionStorage } from '@/hooks/use-session-storage';
import { useSanitizedState } from '@/hooks/useSanitizedState';
import { sanitizeEmail, sanitizePhone, sanitizeText } from '@/lib/sanitize';
import { useCurrency } from '@/contexts/CurrencyContext'; // Import useCurrency
import { AvailabilityStatus } from './availability-status'; // Import new component
import { GuestInfoForm } from './guest-info-form'; // Import new component
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'; // Import Popover components
import { Calendar } from '@/components/ui/calendar'; // Import Calendar component
import { cn } from '@/lib/utils'; // Import cn for class merging
import { useToast } from '@/hooks/use-toast'; // Import useToast

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
  const { toast } = useToast(); // Initialize toast
  const { selectedCurrency, baseCurrencyForProperty } = useCurrency(); // Get currency info
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
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPercentage: number } | null>(null); // Coupon state here
  const [isProcessingBooking, setIsProcessingBooking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false); // State for date picker popover

  // --- Guest Info State (managed here, passed down) ---
  const [firstName, setFirstName] = useSessionStorage<string>(`booking_${propertySlug}_firstName`, '');
  const [lastName, setLastName] = useSessionStorage<string>(`booking_${propertySlug}_lastName`, '');
  const [email, setEmail] = useSessionStorage<string>(`booking_${propertySlug}_email`, '');
  const [phone, setPhone] = useSessionStorage<string>(`booking_${propertySlug}_phone`, '');

  // --- Sanitized Guest Info State ---
  // Note: We might pass the setters from useSessionStorage directly, or use useSanitizedState if needed elsewhere.
  // For simplicity here, we'll assume the session storage hooks handle basic persistence.
  // If complex sanitization is needed *before* session storage, use useSanitizedState.

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
        propertyBaseCcy, // Pass base currency
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
      while (isBefore(current, checkOutDate)) {
        const dateString = format(startOfDay(current), 'yyyy-MM-dd');
        if (fetchedUnavailableDates.some(d => format(startOfDay(d), 'yyyy-MM-dd') === dateString)) {
          conflict = true;
          break;
        }
        current = addDays(current, 1);
      }
      setIsAvailable(!conflict);

      if (conflict) {
        const suggested = [
          { from: addDays(checkOutDate!, 1), to: addDays(checkOutDate!, 1 + numberOfNights), recommendation: "Next Available" },
          { from: addDays(checkInDate!, 7), to: addDays(checkInDate!, 7 + numberOfNights) },
        ];
        const validSuggestions = suggested.filter(range => {
          let isValidSuggestion = true;
          let checkCurrent = new Date(range.from.getTime());
          while (isBefore(checkCurrent, range.to)) {
            const checkDateString = format(startOfDay(checkCurrent), 'yyyy-MM-dd');
            if (fetchedUnavailableDates.some(d => format(startOfDay(d), 'yyyy-MM-dd') === checkDateString)) {
              isValidSuggestion = false;
              break;
            }
            checkCurrent = addDays(checkCurrent, 1);
          }
          return isValidSuggestion && !isBefore(startOfDay(range.from), startOfDay(new Date()));
        });
        setSuggestedDates(validSuggestions.slice(0, 3));
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
          currency: propertyBaseCcy,
        },
        status: 'pending' as const,
        appliedCouponCode: appliedCoupon?.code ?? null,
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
       if (isAvailable === true) {
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
               currentMonth={calendarCenterMonth} // Pass the calculated center month
               unavailableDates={unavailableDates}
               selectedRange={dateRange} // Pass the current selection
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
                disabled={isProcessingBooking || isLoadingAvailability} // Disable while loading or processing
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
      {isAvailable === true && (
        <Card className="w-full mt-8">
          <CardHeader>
            <CardTitle>Booking Summary & Details</CardTitle>
            <CardDescription>Confirm details and proceed to payment.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAvailability ? (
              <div className="flex justify-center items-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
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
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

    