// src/components/booking/availability-check.tsx
"use client";

import *
as React from 'react';
import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useTransition
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Send,
  Mail,
  Phone as PhoneIcon
} from 'lucide-react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { Property, Availability, PriceCalculationResult, CurrencyCode } from '@/types';
import { getUnavailableDatesForProperty } from '@/services/bookingService';
import { createPendingBookingAction } from '@/app/actions/booking-actions';
import { createCheckoutSession } from '@/app/actions/create-checkout-session';
import { createHoldBookingAction } from '@/app/actions/createHoldBookingAction';
import { createHoldCheckoutSession } from '@/app/actions/createHoldCheckoutSession';
import { createInquiryAction } from '@/app/actions/createInquiryAction';


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
import { Input as ShadcnInput } from "@/components/ui/input"; // Renamed to avoid conflict
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";


import { AvailabilityCalendar } from './availability-calendar';
import { AvailabilityStatus } from './availability-status';
import { GuestInfoForm } from './guest-info-form';
import { BookingSummary } from './booking-summary';
import { BookingOptionsCards } from './booking-options-cards';


// Helper function
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

// Zod schema for the inquiry form
const inquiryFormSchema = z.object({
  firstName: z.string().min(1, "First name is required.").transform(sanitizeText),
  lastName: z.string().min(1, "Last name is required.").transform(sanitizeText),
  email: z.string().email("Invalid email address.").transform(sanitizeEmail),
  phone: z.string().optional().transform(val => val ? sanitizePhone(val) : undefined),
  message: z.string().min(10, "Message must be at least 10 characters.").max(1000, "Message must be at most 1000 characters.").transform(sanitizeText),
});


function AvailabilityCheck({
  property,
 initialCheckIn,
  initialCheckOut,
}: AvailabilityCheckProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { selectedCurrency, baseCurrencyForProperty, convertToSelectedCurrency, formatPrice } = useCurrency();
  const propertySlug = property.slug;
  const propertyBaseCcy = baseCurrencyForProperty(property.baseCurrency);

  const [isPending, startTransition] = useTransition();


  const [checkInDate, setCheckInDate] = useSessionStorage<Date | null>(`booking_${propertySlug}_checkIn`, parseDateSafe(initialCheckIn));
  const [checkOutDate, setCheckOutDate] = useSessionStorage<Date | null>(`booking_${propertySlug}_checkOut`, parseDateSafe(initialCheckOut));
  
  const [clientNumberOfNights, setClientNumberOfNights] = useSessionStorage<number>(`booking_${propertySlug}_nights`, () => {
      const from = parseDateSafe(initialCheckIn);
      const to = parseDateSafe(initialCheckOut);
      if (from && to && isValid(from) && isValid(to) && isAfter(to, from)) {
          return differenceInDays(to, from);
      }
      return 0;
  });

  const [guestsDisplay, setGuestsDisplay] = useSessionStorage<number>(`booking_${propertySlug}_guests`, property.baseOccupancy || 1);


  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(true);
  const [unavailableDates, setUnavailableDates] = useState<Date[]>([]);
  const [suggestedDates, setSuggestedDates] = useState<Array<{ from: Date; to: Date; recommendation?: string }>>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPercentage: number } | null>(null);
  const [isProcessingBooking, setIsProcessingBooking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);


  type SelectedOption = 'contact' | 'hold' | 'bookNow' | null;
  const [selectedOption, setSelectedOption] = useState<SelectedOption>(null);

  const inquiryForm = useForm<z.infer<typeof inquiryFormSchema>>({
    resolver: zodResolver(inquiryFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      message: "",
    },
  });

  // UseEffect to sync session storage values to inquiryForm
  // Initialize with empty strings to ensure we never have undefined values
  const [sessionFirstName, setSessionFirstName] = useSessionStorage<string>(`booking_${propertySlug}_firstName`, '');
  const [sessionLastName, setSessionLastName] = useSessionStorage<string>(`booking_${propertySlug}_lastName`, '');
  const [sessionEmail, setSessionEmail] = useSessionStorage<string>(`booking_${propertySlug}_email`, '');
  const [sessionPhone, setSessionPhone] = useSessionStorage<string>(`booking_${propertySlug}_phone`, '');
  const [sessionMessage, setSessionMessage] = useSessionStorage<string>(`booking_${propertySlug}_message`, '');


  useEffect(() => {
    if (hasMounted) {
      inquiryForm.reset({
        firstName: sessionFirstName || '',
        lastName: sessionLastName || '',
        email: sessionEmail || '',
        phone: sessionPhone || '',
        message: sessionMessage || '',
      });
    }
  }, [hasMounted, sessionFirstName, sessionLastName, sessionEmail, sessionPhone, sessionMessage, inquiryForm]);


  useEffect(() => {
    setHasMounted(true);
  }, []);

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
  }, [checkInDate, checkOutDate, datesSelected, hasMounted, setClientNumberOfNights]);


  const pricingDetailsInBaseCurrency = useMemo(() => {
    if (datesSelected && guestsDisplay > 0 && clientNumberOfNights > 0) {
      return calculatePrice(
        property.pricePerNight,
        clientNumberOfNights,
        property.cleaningFee ?? 0,
        guestsDisplay,
        property.baseOccupancy,
        property.extraGuestFee ?? 0,
        propertyBaseCcy,
        appliedCoupon?.discountPercentage
      );
    }
    return null;
  }, [datesSelected, property, clientNumberOfNights, guestsDisplay, appliedCoupon, propertyBaseCcy]);

  const checkPropertyAvailability = useCallback(async () => {
    setIsAvailable(null);
    setIsLoadingAvailability(true);
    setSuggestedDates([]);
    setSelectedOption(null);

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
        let suggestionFound = false;
        let suggestionStart = addDays(checkOutDate, 1);
        const maxSearchDate = addDays(checkOutDate, 60);

        while (isAfter(maxSearchDate, suggestionStart) && !suggestionFound) {
          const suggestionEnd = addDays(suggestionStart, clientNumberOfNights);
          let suggestionConflict = false;
          let checkCurrent = new Date(suggestionStart.getTime());

          while (isBefore(checkCurrent, suggestionEnd)) {
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
      setSelectedOption(null);
    }
  }, [checkPropertyAvailability, hasMounted, datesSelected, clientNumberOfNights]);


  const handleSelectAlternativeDate = (range: { from: Date; to: Date }) => {
    setCheckInDate(range.from);
    setCheckOutDate(range.to);
    setSelectedOption(null);
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
    setSelectedOption(null);
    setIsDatePickerOpen(false);
  };

  const handleGuestChange = (change: number) => {
    setGuestsDisplay((prev) => {
      const newCount = prev + change;
      return Math.max(1, Math.min(newCount, property.maxGuests));
    });
  };


  const onInquirySubmit = async (values: z.infer<typeof inquiryFormSchema>) => {
    setFormError(null);
    if (!checkInDate || !checkOutDate) {
      setFormError("Please select valid check-in and check-out dates.");
      toast({ title: "Missing Dates", description: "Please select check-in and check-out dates for your inquiry.", variant: "destructive" });
      return;
    }

    startTransition(async () => {
      const inquiryInput = {
        propertySlug: propertySlug,
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
        guestCount: guestsDisplay,
        guestInfo: {
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phone: values.phone,
        },
        message: values.message,
        // Convert the price to the selected currency
        totalPrice: pricingDetailsInBaseCurrency
          ? convertToSelectedCurrency(pricingDetailsInBaseCurrency.total, pricingDetailsInBaseCurrency.currency)
          : undefined,
        currency: selectedCurrency,
      };

      const result = await createInquiryAction(inquiryInput);
      if (result.error) {
        setFormError(result.error);
        toast({ title: "Inquiry Failed", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Inquiry Sent!", description: "Your message has been sent to the host." });

        // Just close the form without resetting values
        // This avoids the controlled/uncontrolled component error
        setSelectedOption(null);
      }
    });
  };

  const handleContinueToPayment = async (e?: React.FormEvent) => { // Make e optional
    if (e) e.preventDefault();
    setFormError(null);

    if (!datesSelected || !checkInDate || !checkOutDate || !pricingDetailsInBaseCurrency) {
      setFormError("Please select valid dates and ensure price is calculated.");
      return;
    }
    if (!sessionFirstName || !sessionLastName || !sessionEmail || !sessionPhone) {
      setFormError("Please fill in all required guest information.");
      return;
    }

    setIsProcessingBooking(true);

    try {
      // Create the booking input with default values to avoid undefined
      const bookingInput = {
        propertyId: propertySlug,
        guestInfo: {
          firstName: sanitizeText(sessionFirstName),
          lastName: sanitizeText(sessionLastName),
          email: sanitizeEmail(sessionEmail),
          phone: sanitizePhone(sessionPhone)
        },
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
        numberOfGuests: guestsDisplay,
        pricing: {
          // Map fields with safe defaults
          baseRate: pricingDetailsInBaseCurrency.basePrice || 0,
          accommodationTotal: (pricingDetailsInBaseCurrency.basePrice || 0) + (pricingDetailsInBaseCurrency.extraGuestFeeTotal || 0),
          cleaningFee: pricingDetailsInBaseCurrency.cleaningFee || 0,
          // These two are optional in the schema, but set them to 0 to avoid undefined
          extraGuestFee: pricingDetailsInBaseCurrency.extraGuestFeeTotal || 0,
          numberOfExtraGuests: pricingDetailsInBaseCurrency.numberOfExtraGuests || 0,
          // Required fields with safe defaults
          subtotal: pricingDetailsInBaseCurrency.subtotal || 0,
          discountAmount: pricingDetailsInBaseCurrency.discountAmount || 0,
          total: pricingDetailsInBaseCurrency.total || 0,
          currency: selectedCurrency,
          numberOfNights: pricingDetailsInBaseCurrency.numberOfNights || 0,
        },
        status: 'pending' as const,
        appliedCouponCode: appliedCoupon?.code ?? null,
      };

      // Print the pricing object to debug
      console.log("Booking input pricing:", JSON.stringify(bookingInput.pricing));

      const pendingBookingResult = await createPendingBookingAction(bookingInput);

      if (pendingBookingResult.error || !pendingBookingResult.bookingId) {
        throw new Error(pendingBookingResult.error || "Failed to create pending booking.");
      }

      const { bookingId } = pendingBookingResult;

      const checkoutInput = {
        property: property,
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
        numberOfGuests: guestsDisplay,
        // Use the already-converted price from the booking input (which is in the user's selected currency)
        totalPrice: bookingInput.pricing.total,
        numberOfNights: clientNumberOfNights,
        appliedCouponCode: appliedCoupon?.code,
        discountPercentage: appliedCoupon?.discountPercentage,
        guestFirstName: sanitizeText(sessionFirstName),
        guestLastName: sanitizeText(sessionLastName),
        guestEmail: sanitizeEmail(sessionEmail),
        pendingBookingId: bookingId,
        selectedCurrency: selectedCurrency, // Pass the user's selected currency
      };

      const stripeResult = await createCheckoutSession(checkoutInput);

      if (stripeResult.error || !stripeResult.sessionId || !stripeResult.sessionUrl) {
        throw new Error(stripeResult.error || 'Failed to create Stripe session or missing session URL.');
      }

      if (stripeResult.sessionUrl) {
        router.push(stripeResult.sessionUrl); 
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

  const handleHoldDates = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError(null);

    if (!datesSelected || !checkInDate || !checkOutDate || !property.holdFeeAmount) {
        setFormError("Please select valid dates. Hold fee must be configured for this property.");
        return;
    }
     if (!sessionFirstName || !sessionLastName || !sessionEmail) { // Phone is optional for hold
      setFormError("Please fill in First Name, Last Name, and Email to hold dates.");
      return;
    }

    setIsProcessingBooking(true);
    try {
        const holdBookingInput = {
            propertySlug: propertySlug,
            checkInDate: checkInDate.toISOString(),
            checkOutDate: checkOutDate.toISOString(),
            guestCount: guestsDisplay,
            guestInfo: {
                firstName: sanitizeText(sessionFirstName),
                lastName: sanitizeText(sessionLastName),
                email: sanitizeEmail(sessionEmail),
                phone: sessionPhone ? sanitizePhone(sessionPhone) : undefined,
            },
            holdFeeAmount: property.holdFeeAmount,
            selectedCurrency: selectedCurrency, // Pass the user's selected currency from the header dropdown
        };
        const holdBookingResult = await createHoldBookingAction(holdBookingInput);

        if (holdBookingResult.error || !holdBookingResult.bookingId) {
            throw new Error(holdBookingResult.error || "Failed to create hold booking record.");
        }
        const { bookingId: holdBookingId } = holdBookingResult;

        const holdCheckoutInput = {
            property: property,
            holdBookingId: holdBookingId,
            holdFeeAmount: property.holdFeeAmount,
            guestEmail: sanitizeEmail(sessionEmail),
            selectedCurrency: selectedCurrency, // Pass the user's selected currency to Stripe
        };

        const stripeHoldResult = await createHoldCheckoutSession(holdCheckoutInput);

        if (stripeHoldResult.error || !stripeHoldResult.sessionId || !stripeHoldResult.sessionUrl) {
            throw new Error(stripeHoldResult.error || "Failed to create Stripe session for hold fee.");
        }

        if (stripeHoldResult.sessionUrl) {
            router.push(stripeHoldResult.sessionUrl);
        } else {
            throw new Error("Stripe hold session URL is missing.");
        }

    } catch (error) {
        console.error("Error processing hold dates:", error);
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred while trying to hold dates.";
        setFormError(errorMessage);
        toast({ title: "Hold Dates Error", description: errorMessage, variant: "destructive" });
    } finally {
        setIsProcessingBooking(false);
    }
  };


  const renderAvailabilityCalendar = () => {
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

  if (!hasMounted) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading booking options...</p>
      </div>
    );
  }


  return (
    <div className="max-w-2xl mx-auto w-full px-4 md:px-0">
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
        email={sessionEmail}
        setEmail={setSessionEmail}
        phone={sessionPhone}
        setPhone={setSessionPhone}
        isProcessingBooking={isProcessingBooking || isPending}
      />

      {/* Date Picker and Guest Picker - Moved under AvailabilityStatus */}
      <div className="mt-6 flex flex-col md:flex-row md:items-end md:gap-4 space-y-4 md:space-y-0">
        <div className="flex-grow">
          <Label className="mb-1 block text-sm font-medium">Selected Dates</Label>
          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-between text-left font-normal flex items-center h-10",
                  !dateRange?.from && "text-muted-foreground"
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
          {clientNumberOfNights > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              ({clientNumberOfNights} {clientNumberOfNights === 1 ? 'night' : 'nights'})
            </p>
          )}
        </div>

        <div className="md:w-auto md:shrink-0">
          <Label className="mb-1 block text-sm font-medium">Guests</Label>
          <div className="flex items-center justify-between rounded-md border p-2 h-10 w-full md:w-auto">
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
            Max {property.maxGuests}
          </p>
        </div>
      </div>


      {renderAvailabilityCalendar()}

      {isAvailable === true && !isLoadingAvailability && datesSelected && (
        <div className="mt-8 space-y-6">
          <BookingSummary
            numberOfNights={clientNumberOfNights}
            numberOfGuests={guestsDisplay}
            pricingDetails={pricingDetailsInBaseCurrency}
            propertyBaseCcy={propertyBaseCcy}
            appliedCoupon={appliedCoupon}
          />
          <BookingOptionsCards
            selectedOption={selectedOption}
            onSelectOption={setSelectedOption}
            property={property}
          />

          {selectedOption === 'contact' && (
            <Card className="mt-4">
              <CardHeader><CardTitle>Contact Host</CardTitle></CardHeader>
              <CardContent>
                <Form {...inquiryForm}>
                  <form onSubmit={inquiryForm.handleSubmit(onInquirySubmit)} className="space-y-4">
                    <h3 className="font-semibold text-base pt-2">Your Information</h3>

                    {/* Names - side by side on larger screens */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField control={inquiryForm.control} name="firstName" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1 text-xs">
                            First Name
                            <span className="text-destructive ml-1">*</span>
                          </FormLabel>
                          <FormControl>
                            <ShadcnInput placeholder="Your first name" {...field}
                              onChange={e => { field.onChange(e); setSessionFirstName(e.target.value);}}
                              className={inquiryForm.formState.errors.firstName && "border-destructive focus-visible:ring-destructive/25"}
                              disabled={isPending}
                              required />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={inquiryForm.control} name="lastName" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1 text-xs">
                            Last Name
                            <span className="text-destructive ml-1">*</span>
                          </FormLabel>
                          <FormControl>
                            <ShadcnInput placeholder="Your last name" {...field}
                              onChange={e => { field.onChange(e); setSessionLastName(e.target.value);}}
                              className={inquiryForm.formState.errors.lastName && "border-destructive focus-visible:ring-destructive/25"}
                              disabled={isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    {/* Email and Phone - side by side on larger screens */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField control={inquiryForm.control} name="email" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1 text-xs">
                            <Mail className={cn("h-3 w-3", inquiryForm.formState.errors.email && "text-destructive")} />
                            Email
                            <span className="text-destructive ml-1">*</span>
                          </FormLabel>
                          <FormControl>
                            <ShadcnInput type="email" placeholder="your.email@example.com" {...field}
                              onChange={e => { field.onChange(e); setSessionEmail(e.target.value);}}
                              className={inquiryForm.formState.errors.email && "border-destructive focus-visible:ring-destructive/25"}
                              disabled={isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={inquiryForm.control} name="phone" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1 text-xs text-muted-foreground">
                            <PhoneIcon className={cn("h-3 w-3", inquiryForm.formState.errors.phone && "text-destructive")} />
                            Phone (Optional)
                          </FormLabel>
                          <FormControl>
                            <ShadcnInput type="tel" placeholder="Your phone number" {...field}
                              onChange={e => { field.onChange(e); setSessionPhone(e.target.value);}}
                              className={inquiryForm.formState.errors.phone && "border-destructive focus-visible:ring-destructive/25"}
                              disabled={isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={inquiryForm.control} name="message" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1 text-xs">
                          Message
                          <span className="text-destructive ml-1">*</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Your questions or custom request..."
                            {...field}
                            onChange={e => { field.onChange(e); setSessionMessage(e.target.value);}}
                            rows={4}
                            disabled={isPending}
                            className={inquiryForm.formState.errors.message && "border-destructive focus-visible:ring-destructive/25"}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <Button type="submit" disabled={isPending || isProcessingBooking}>
                      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      {isPending ? "Sending..." : "Send Inquiry"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
          {selectedOption === 'hold' && (
            <Card className="mt-4">
              <CardHeader><CardTitle>Hold Dates</CardTitle></CardHeader>
              <CardContent>
                <GuestInfoForm
                  property={property}
                  firstName={sessionFirstName} setFirstName={setSessionFirstName}
                  lastName={sessionLastName} setLastName={setSessionLastName}
                  email={sessionEmail} setEmail={setSessionEmail}
                  phone={sessionPhone} setPhone={setSessionPhone}
                  checkInDate={checkInDate}
                  checkOutDate={checkOutDate}
                  appliedCoupon={null} // No coupons for hold fee
                  setAppliedCoupon={() => { }} // No coupons for hold fee
                  pricingDetailsInBaseCurrency={null} // No full pricing for hold
                  isProcessingBooking={isProcessingBooking || isPending}
                  showCouponField={false} // Hide coupon field for hold form
                />
                <p className="text-sm text-muted-foreground my-4">
                  You will be charged a non-refundable fee of <strong>{formatPrice(convertToSelectedCurrency(property.holdFeeAmount || 0, propertyBaseCcy), selectedCurrency)}</strong> to hold these dates for 24 hours.
                  This fee will be applied towards your booking if you confirm within 24 hours.
                </p>
                <Button onClick={handleHoldDates} className="w-full" disabled={isProcessingBooking || isPending}>
                  {isProcessingBooking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                  {isProcessingBooking ? 'Processing...' : `Pay ${formatPrice(convertToSelectedCurrency(property.holdFeeAmount || 0, propertyBaseCcy), selectedCurrency)} to Hold`}
                </Button>
                {formError && (
                  <div className="border border-destructive bg-destructive/5 p-3 rounded-md mt-4">
                    <div className="flex items-start gap-2">
                      <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-destructive text-xs font-bold">!</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-destructive">Error</p>
                        <p className="text-xs text-destructive mt-1">{formError}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {selectedOption === 'bookNow' && (
            <Card className="mt-4">
              <CardHeader><CardTitle>Complete Booking</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleContinueToPayment} className="space-y-6">
                  <GuestInfoForm
                    property={property}
                    firstName={sessionFirstName} setFirstName={setSessionFirstName}
                    lastName={sessionLastName} setLastName={setSessionLastName}
                    email={sessionEmail} setEmail={setSessionEmail}
                    phone={sessionPhone} setPhone={setSessionPhone}
                    checkInDate={checkInDate}
                    checkOutDate={checkOutDate}
                    appliedCoupon={appliedCoupon}
                    setAppliedCoupon={setAppliedCoupon}
                    pricingDetailsInBaseCurrency={pricingDetailsInBaseCurrency}
                    isProcessingBooking={isProcessingBooking || isPending}
                  />
                  {formError && (
                    <div className="border border-destructive bg-destructive/5 p-3 rounded-md my-3">
                      <div className="flex items-start gap-2">
                        <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-destructive text-xs font-bold">!</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-destructive">Error</p>
                          <p className="text-xs text-destructive mt-1">{formError}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={isProcessingBooking || !datesSelected || isAvailable !== true || isPending}>
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

export { AvailabilityCheck };

const Input = ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <div className="space-y-1">
    <Label htmlFor={props.id || props.name}>{label}</Label>
    <ShadcnInput id={props.id || props.name} {...props} />
  </div>
);
