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
import { Label } from "@/components/ui/label"; // Import Label

import { AvailabilityCalendar } from './availability-calendar';
import { AvailabilityStatus } from './availability-status';
import { GuestInfoForm } from './guest-info-form';
import { BookingSummary } from './booking-summary'; // Import new component
import { BookingOptionsCards } from './booking-options-cards'; // Import new component

// Helper function (keep or move to utils)
const parseDateSafe = (dateStr: string | undefined | null): Date | null => {
  if (!dateStr) return null;
  try {
    const parsed = parseISO(dateStr);
    return isValid(parsed) ? startOfDay(parsed) : null;
  } catch {
    return null;
  }
};

interface AvailabilityCheckProps {
  property: Property;
  initialCheckIn?: string;
  initialCheckOut?: string;
}

export function AvailabilityCheck({
  property,
  initialCheckIn,
  initialCheckOut,
}: AvailabilityCheckProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { selectedCurrency, baseCurrencyForProperty, convertToSelectedCurrency, formatPrice } = useCurrency();
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
  const [hasMounted, setHasMounted] = useState(false);
  const [clientNumberOfNights, setClientNumberOfNights] = useState<number>(0);

  // --- New State for Redesign ---
  type SelectedOption = 'contact' | 'hold' | 'bookNow' | null;
  const [selectedOption, setSelectedOption] = useState<SelectedOption>(null);

  // Indicate component has mounted
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // --- Derived State ---
  const dateRange: DateRange | undefined = useMemo(() => {
    return checkInDate && checkOutDate ? { from: checkInDate, to: checkOutDate } : undefined;
  }, [checkInDate, checkOutDate]);

  const datesSelected = useMemo(() =>
    checkInDate && checkOutDate && isValid(checkInDate) && isValid(checkOutDate) && isAfter(checkOutDate, checkInDate),
    [checkInDate, checkOutDate]
  );

  useEffect(() => {
    if (hasMounted) {
      if (datesSelected && checkInDate && checkOutDate) {
        setClientNumberOfNights(differenceInDays(checkOutDate, checkInDate));
      } else {
        setClientNumberOfNights(0);
      }
    }
  }, [checkInDate, checkOutDate, datesSelected, hasMounted]);


  // --- Pricing Calculation ---
  const pricingDetailsInBaseCurrency = useMemo(() => {
    const currentGuests = typeof numberOfGuests === 'number' && !isNaN(numberOfGuests) && numberOfGuests > 0
      ? numberOfGuests
      : (property.baseOccupancy || 1);

    if (datesSelected && currentGuests > 0 && clientNumberOfNights > 0) {
      return calculatePrice(
        property.pricePerNight,
        clientNumberOfNights,
        property.cleaningFee ?? 0,
        currentGuests,
        property.baseOccupancy,
        property.extraGuestFee ?? 0,
        propertyBaseCcy,
        appliedCoupon?.discountPercentage
      );
    }
    return null;
  }, [datesSelected, property, clientNumberOfNights, numberOfGuests, appliedCoupon, propertyBaseCcy]);


  // --- Guest Info State (might move to specific forms later) ---
  const [firstName, setFirstName] = useSessionStorage<string>(`booking_${propertySlug}_firstName`, '');
  const [lastName, setLastName] = useSessionStorage<string>(`booking_${propertySlug}_lastName`, '');
  const [email, setEmail] = useSessionStorage<string>(`booking_${propertySlug}_email`, '');
  const [phone, setPhone] = useSessionStorage<string>(`booking_${propertySlug}_phone`, '');
  const [message, setMessage] = useSessionStorage<string>(`booking_${propertySlug}_message`, ''); // For contact form

  // --- Availability Check Logic (keep as is for now) ---
  const checkPropertyAvailability = useCallback(async () => {
    setIsAvailable(null);
    setIsLoadingAvailability(true);
    setSuggestedDates([]);
    setSelectedOption(null); // Reset option on availability change

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

      if (conflict && clientNumberOfNights > 0) {
        // Suggest alternative dates logic (keep as is for now)
        let suggestionFound = false;
        let suggestionStart = addDays(checkOutDate, 1);
        const maxSearchDate = addDays(checkOutDate, 60);

        while (isAfter(maxSearchDate, suggestionStart) && !suggestionFound) {
            const suggestionEnd = addDays(suggestionStart, clientNumberOfNights);
            let suggestionConflict = false;
            let checkCurrent = new Date(suggestionStart.getTime());

            while(isBefore(checkCurrent, suggestionEnd)) {
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
                suggestionStart = addDays(suggestionStart, 1);
            }
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
  }, [checkInDate, checkOutDate, datesSelected, propertySlug, clientNumberOfNights, toast]);

  useEffect(() => {
    if (hasMounted && datesSelected && clientNumberOfNights > 0) {
        checkPropertyAvailability();
    } else if (hasMounted && !datesSelected) {
        setIsAvailable(null);
        setIsLoadingAvailability(false);
        setUnavailableDates([]);
        setSuggestedDates([]);
        setSelectedOption(null); // Reset option
    }
  }, [checkPropertyAvailability, hasMounted, datesSelected, clientNumberOfNights]);


  // --- Event Handlers ---
  const handleSelectAlternativeDate = (range: { from: Date; to: Date }) => {
    setCheckInDate(range.from);
    setCheckOutDate(range.to);
    setSelectedOption(null); // Reset selected option when dates change
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDateSelect = (range: DateRange | undefined) => {
    if (range?.from) {
      setCheckInDate(startOfDay(range.from));
    } else {
      setCheckInDate(null);
    }
    if (range?.to) {
      setCheckOutDate(startOfDay(range.to));
    } else {
      setCheckOutDate(null);
    }
    setSelectedOption(null); // Reset selected option when dates change
    setIsDatePickerOpen(false);
  };

  const handleGuestChange = (change: number) => {
    setNumberOfGuests((prev) => {
      const currentGuests = typeof prev === 'number' && !isNaN(prev) && prev > 0
        ? prev
        : (property.baseOccupancy || 1);
      const newCount = currentGuests + change;
      return Math.max(1, Math.min(newCount, property.maxGuests));
    });
  };

  // --- OLD Continue to Payment Logic (will be adapted for Book Now path later) ---
  const handleContinueToPayment_OLD = async (e: React.FormEvent) => {
    // This logic will be moved/adapted into the BookNowCard component's submission handler
    e.preventDefault();
    setFormError(null);

    const currentGuests = typeof numberOfGuests === 'number' && !isNaN(numberOfGuests) && numberOfGuests > 0
        ? numberOfGuests
        : (property.baseOccupancy || 1);

    // ... existing validation ...

    setIsProcessingBooking(true);

    try {
      // 1. Create Pending Booking
      const bookingInput = {
        propertyId: propertySlug,
        guestInfo: { firstName: sanitizeText(firstName), lastName: sanitizeText(lastName), email: sanitizeEmail(email), phone: sanitizePhone(phone) },
        checkInDate: checkInDate!.toISOString(),
        checkOutDate: checkOutDate!.toISOString(),
        numberOfGuests: currentGuests,
        pricing: {
          ...pricingDetailsInBaseCurrency!,
          currency: propertyBaseCcy,
          numberOfNights: clientNumberOfNights,
        },
        status: 'pending' as const,
        appliedCouponCode: appliedCoupon?.code ?? null,
      };

      const pendingBookingResult = await createPendingBookingAction(bookingInput);

      if (pendingBookingResult.error || !pendingBookingResult.bookingId) {
        throw new Error(pendingBookingResult.error || "Failed to create pending booking.");
      }
      const { bookingId } = pendingBookingResult;

      // 2. Create Stripe Checkout Session
      const checkoutInput = {
        property: property,
        checkInDate: checkInDate!.toISOString(),
        checkOutDate: checkOutDate!.toISOString(),
        numberOfGuests: currentGuests,
        totalPrice: pricingDetailsInBaseCurrency!.total,
        numberOfNights: clientNumberOfNights,
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

      // 3. Redirect to Stripe
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
    // Only render if dates are explicitly unavailable and component has mounted
    if (isAvailable === true || isLoadingAvailability || !datesSelected || !hasMounted) {
        return null;
    }
    const validCheckIn = checkInDate && isValid(checkInDate) ? checkInDate : new Date();
    const calendarCenterMonth = startOfMonth(validCheckIn);

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
    // Apply max-width styling here to constrain the content width
    <div className="max-w-3xl mx-auto w-full px-4 md:px-0"> {/* Adjusted max-width and padding */}

      {/* Availability Status and Notifications */}
      <AvailabilityStatus
        isLoadingAvailability={isLoadingAvailability}
        isAvailable={isAvailable}
        datesSelected={!!datesSelected}
        checkInDate={checkInDate}
        checkOutDate={checkOutDate}
        numberOfNights={clientNumberOfNights}
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

       {/* Date Picker and Guest Count (on the same line for md+ screens) */}
       <div className="mt-6 flex flex-col md:flex-row md:items-end md:gap-4 space-y-4 md:space-y-0">
          {/* Date Picker */}
          <div className="flex-grow">
              <Label className="mb-1 block text-sm font-medium">Selected Dates</Label>
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-between text-left font-normal flex items-center h-10", // Ensure consistent height
                      !dateRange?.from && "text-muted-foreground"
                    )}
                    disabled={isProcessingBooking || isLoadingAvailability || !hasMounted}
                  >
                    <div className="flex items-center">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {hasMounted && dateRange?.from ? (
                         dateRange.to ? (
                            <>
                              {format(dateRange.from, 'LLL dd, y')} -{' '}
                              {format(dateRange.to, 'LLL dd, y')}
                            </>
                         ) : (
                            format(dateRange.from, 'LLL dd, y')
                         )
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
          <div className="md:w-auto md:shrink-0"> {/* Allow shrink on larger screens */}
            <Label className="mb-1 block text-sm font-medium">Guests</Label>
            <div className="flex items-center justify-between rounded-md border p-2 h-10 w-full md:w-auto"> {/* Consistent height, adjust width */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleGuestChange(-1)}
                disabled={numberOfGuests <= 1 || isProcessingBooking}
                aria-label="Decrease guests"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="mx-4 font-medium w-8 text-center" id="guests">
                 {hasMounted ? numberOfGuests : (property.baseOccupancy || 1)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleGuestChange(1)}
                disabled={numberOfGuests >= property.maxGuests || isProcessingBooking}
                aria-label="Increase guests"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
             <p className="text-xs text-muted-foreground mt-1">
                Max {property.maxGuests}
              </p>
          </div>
       </div>


       {/* Calendar (only if dates are unavailable) */}
       {renderAvailabilityCalendar()}

      {/* New Booking Summary and Options (only if dates ARE available) */}
      {isAvailable === true && !isLoadingAvailability && datesSelected && hasMounted && (
        <div className="mt-8 space-y-6">
          <BookingSummary
            numberOfNights={clientNumberOfNights}
            numberOfGuests={numberOfGuests}
            pricingDetails={pricingDetailsInBaseCurrency}
            propertyBaseCcy={propertyBaseCcy}
            appliedCoupon={appliedCoupon}
          />
          <BookingOptionsCards
            selectedOption={selectedOption}
            onSelectOption={setSelectedOption}
            property={property} // Pass property for config options
          />

          {/* Conditionally Render Forms based on selectedOption */}
          {selectedOption === 'contact' && (
            <Card className="mt-4">
                <CardHeader><CardTitle>Contact Host</CardTitle></CardHeader>
                <CardContent>
                   {/* TODO: Implement Contact Form Component Here */}
                   <p>Contact form placeholder...</p>
                   <Input label="Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                   <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                   <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                   <textarea value={message} onChange={(e) => setMessage(e.target.value)} />
                   <Button disabled={isProcessingBooking}>Send Inquiry</Button>
                </CardContent>
            </Card>
          )}
           {selectedOption === 'hold' && (
            <Card className="mt-4">
                <CardHeader><CardTitle>Hold Dates</CardTitle></CardHeader>
                <CardContent>
                   {/* TODO: Implement Hold Form Component Here */}
                   <p>Hold form placeholder...</p>
                    <Input label="Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                    <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                   {/* Add payment element for hold fee */}
                   <Button disabled={isProcessingBooking}>Pay ${property.holdFeeAmount || 25} to Hold</Button>
                </CardContent>
            </Card>
          )}
           {selectedOption === 'bookNow' && (
            <Card className="mt-4">
                <CardHeader><CardTitle>Complete Booking</CardTitle></CardHeader>
                <CardContent>
                  {/* Use existing GuestInfoForm for Book Now path */}
                  <form onSubmit={handleContinueToPayment_OLD} className="space-y-6">
                      <GuestInfoForm
                        property={property}
                        numberOfGuests={numberOfGuests}
                        setNumberOfGuests={setNumberOfGuests} // Pass setter down
                        firstName={firstName}
                        setFirstName={setFirstName}
                        lastName={lastName}
                        setLastName={setLastName}
                        email={email}
                        setEmail={setEmail}
                        phone={phone}
                        setPhone={setPhone}
                        checkInDate={checkInDate} // Needed for coupon validation
                        checkOutDate={checkOutDate} // Needed for coupon validation
                        appliedCoupon={appliedCoupon}
                        setAppliedCoupon={setAppliedCoupon}
                        pricingDetailsInBaseCurrency={pricingDetailsInBaseCurrency}
                        isProcessingBooking={isProcessingBooking}
                        // No need for displayGuests prop here as it's self-contained? Review GuestInfoForm
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
      )}
    </div>
  );
}

// Helper Input component (can be moved to ui)
const Input = ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
    <div className="space-y-1">
        <Label htmlFor={props.id || props.name}>{label}</Label>
        <input
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            {...props} />
    </div>
);
