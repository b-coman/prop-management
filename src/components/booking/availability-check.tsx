// src/components/booking/availability-check.tsx
"use client";

import *
as React from 'react';
import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useTransition,
  useRef
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
import { getUnavailableDatesForProperty } from '@/services/availabilityService';
import { createPendingBookingAction } from '@/app/actions/booking-actions';
import { createCheckoutSession } from '@/app/actions/create-checkout-session';
import { createHoldBookingAction } from '@/app/actions/createHoldBookingAction';
import { createHoldCheckoutSession } from '@/app/actions/createHoldCheckoutSession';
import { createInquiryAction } from '@/app/actions/createInquiryAction';


import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ErrorMessage } from "@/components/ui/error-message";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { useBooking } from '@/contexts/BookingContext';
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
import { FixNights } from './fix-nights'; // Import the auto-fix component


// Import date parsing utility
import { parseDateSafe } from './date-utils';

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

  // Use BookingContext instead of useSessionStorage directly
  const {
    checkInDate, setCheckInDate,
    checkOutDate, setCheckOutDate,
    numberOfNights: clientNumberOfNights, setNumberOfNights: setClientNumberOfNights,
    numberOfGuests: guestsDisplay, setNumberOfGuests: setGuestsDisplay,
    firstName: sessionFirstName, setFirstName: setSessionFirstName,
    lastName: sessionLastName, setLastName: setSessionLastName,
    email: sessionEmail, setEmail: setSessionEmail,
    phone: sessionPhone, setPhone: setSessionPhone,
    message: sessionMessage, setMessage: setSessionMessage,
    setPropertySlug
  } = useBooking();

  // Move hasMounted to the top of other state declarations
  const [hasMounted, setHasMounted] = useState(false);

  // Set mounted state on first render
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Initialize booking context with property slug
  useEffect(() => {
    if (!hasMounted) return; // Don't run initialization until mounted

    // Debug info - this will help diagnose issues
    console.log('[AvailabilityCheck] Initializing with:', {
      propertySlug,
      initialCheckIn,
      initialCheckOut,
      existingCheckInDate: checkInDate && checkInDate.toISOString(),
      existingCheckOutDate: checkOutDate && checkOutDate.toISOString(),
      hasDates: !!checkInDate && !!checkOutDate
    });

    // Set the property slug (should also be set by BookingClient, but ensure it's set)
    setPropertySlug(propertySlug);

    // Initialize guest count if not already set
    if (!guestsDisplay || guestsDisplay <= 0) {
      setGuestsDisplay(property.baseOccupancy || 1);
    }

    // Determine if we need to process dates from URL params
    const needToProcessDates = !checkInDate || !checkOutDate;
    console.log(`[AvailabilityCheck] Need to process dates: ${needToProcessDates}`);

    // Parse both dates from URL params - we'll do this even if we have dates in context
    // to handle potential URL overrides, but we'll only use them if needed
    const parsedCheckIn = initialCheckIn ? parseDateSafe(initialCheckIn) : null;
    const parsedCheckOut = initialCheckOut ? parseDateSafe(initialCheckOut) : null;

    console.log("[AvailabilityCheck] Parsed dates from URL:", {
      parsedCheckIn: parsedCheckIn ? parsedCheckIn.toISOString() : 'null',
      parsedCheckOut: parsedCheckOut ? parsedCheckOut.toISOString() : 'null',
    });

    // Only set dates if we need to (we don't have dates in context)
    if (needToProcessDates) {
      console.log('[AvailabilityCheck] No existing dates in context, using URL params');

      // Set dates from URL params if they exist and are valid
      if (parsedCheckIn) {
        console.log(`[AvailabilityCheck] Setting check-in date to ${parsedCheckIn.toISOString()}`);
        setCheckInDate(parsedCheckIn);
      }

      if (parsedCheckOut) {
        console.log(`[AvailabilityCheck] Setting check-out date to ${parsedCheckOut.toISOString()}`);
        setCheckOutDate(parsedCheckOut);
      }
    } else {
      console.log('[AvailabilityCheck] Using existing dates from BookingContext:', {
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString()
      });
    }

    // Always validate date order, regardless of where dates came from
    // This ensures dates always have correct chronological order
    const currentCheckIn = needToProcessDates && parsedCheckIn ? parsedCheckIn : checkInDate;
    const currentCheckOut = needToProcessDates && parsedCheckOut ? parsedCheckOut : checkOutDate;

    if (currentCheckIn && currentCheckOut && currentCheckIn.getTime() >= currentCheckOut.getTime()) {
      console.error("[AvailabilityCheck] Invalid date range - check-in not before check-out. Adjusting check-out date.");
      const correctedCheckOut = new Date(currentCheckIn.getTime());
      correctedCheckOut.setDate(correctedCheckOut.getDate() + 1); // Add one day to check-in
      setCheckOutDate(correctedCheckOut);
    }

  }, [
    hasMounted,
    initialCheckIn,
    initialCheckOut,
    propertySlug,
    setPropertySlug,
    checkInDate,
    checkOutDate,
    guestsDisplay,
    setCheckInDate,
    setCheckOutDate,
    setGuestsDisplay,
    property.baseOccupancy
  ]);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  // Initialize loading state - set to false initially to prevent automatic checking
  // This will allow us to explicitly trigger the check when we're ready
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [unavailableDates, setUnavailableDates] = useState<Date[]>([]);
  const [suggestedDates, setSuggestedDates] = useState<Array<{ from: Date; to: Date; recommendation?: string }>>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPercentage: number } | null>(null);
  const [isProcessingBooking, setIsProcessingBooking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastErrorType, setLastErrorType] = useState<string | undefined>(undefined);
  const [canRetryError, setCanRetryError] = useState<boolean>(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  // Use refs to track states without triggering re-renders
  const isOpenRef = useRef(isDatePickerOpen);
  const prevDatesSelectedRef = useRef<boolean | null>(null);


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


  // We already have a hasMounted effect at the top of the component
  // No need for a duplicate one here

  // Debug the actual date range being used - use stringified dates to prevent reference issues
  const dateRange: DateRange | undefined = useMemo(() => {
    if (checkInDate && checkOutDate) {
      // Log this less frequently to reduce console noise
      if (process.env.NODE_ENV === 'development') {
        console.log("Creating date range for calendar:", {
          from: checkInDate.toISOString(),
          to: checkOutDate.toISOString()
        });
      }
      return { from: checkInDate, to: checkOutDate };
    }
    return undefined;
  }, [
    // Use these instead of object references to help with stability
    checkInDate?.getTime(),
    checkOutDate?.getTime()
  ]);

  const datesSelected = useMemo(() => {
    // More robust date validation with additional logging
    const hasCheckIn = !!checkInDate;
    const hasCheckOut = !!checkOutDate;
    const checkInValid = hasCheckIn && isValid(checkInDate);
    const checkOutValid = hasCheckOut && isValid(checkOutDate);
    const datesInOrder = checkInValid && checkOutValid && isAfter(checkOutDate, checkInDate);
    const result = hasCheckIn && hasCheckOut && checkInValid && checkOutValid && datesInOrder;

    // For development debugging - log all date validation less frequently to reduce noise
    if (process.env.NODE_ENV === 'development' && result !== prevDatesSelectedRef.current) {
      console.log('Date validation changed:', {
        hasCheckIn,
        hasCheckOut,
        checkInValid,
        checkOutValid,
        checkInDate: checkInDate ? checkInDate.toISOString() : 'null',
        checkOutDate: checkOutDate ? checkOutDate.toISOString() : 'null',
        isValidOrder: datesInOrder,
        result
      });
      prevDatesSelectedRef.current = result;
    }

    return result;
  }, [
    // Use primitive values instead of object references
    checkInDate?.getTime(),
    checkOutDate?.getTime()
  ]);

  // Use a ref to prevent unnecessary recalculations
  const calculatingNightsRef = useRef(false);

  // Calculate and memoize the night count to prevent re-calculations
  const calculateNightCount = useCallback(() => {
    // Only calculate when we have valid dates
    if (!checkInDate || !checkOutDate) {
      return 0;
    }

    // Calculate nights using differenceInDays from date-fns
    const nights = differenceInDays(checkOutDate, checkInDate);

    // Only log this in development mode and not too frequently
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AvailabilityCheck] Calculating nights between ${checkInDate.toISOString()} and ${checkOutDate.toISOString()}: ${nights} nights`);
    }

    // Determine the final night count
    let finalNightCount = 0;

    if (nights > 0) {
      // Use the standard calculation if it works
      finalNightCount = nights;
    } else {
      // Try an alternative calculation method
      const daysDiff = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff > 0) {
        finalNightCount = daysDiff;
      } else {
        // Fixed fallback for development
        finalNightCount = process.env.NODE_ENV === 'development' ? 8 : 1;
      }
    }

    return finalNightCount;
  }, [checkInDate, checkOutDate]);

  // Apply the calculated night count using a stable effect
  useEffect(() => {
    // Only run when mounted and when we have both dates
    if (!hasMounted || calculatingNightsRef.current) {
      return;
    }

    // Set flag to prevent multiple calculations in the same render cycle
    calculatingNightsRef.current = true;

    // Skip the calculation if we don't have dates
    if (!checkInDate || !checkOutDate) {
      calculatingNightsRef.current = false;
      return;
    }

    // Calculate nights using our memoized function
    const finalNightCount = calculateNightCount();

    // Only update if the nights count has actually changed to avoid infinite loops
    if (finalNightCount > 0 && finalNightCount !== clientNumberOfNights) {
      console.log(`[AvailabilityCheck] Setting nights from ${clientNumberOfNights} to ${finalNightCount}`);
      setClientNumberOfNights(finalNightCount);
    }

    // Reset the calculation flag after a small delay
    const timeoutId = setTimeout(() => {
      calculatingNightsRef.current = false;
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [hasMounted, calculateNightCount, clientNumberOfNights, setClientNumberOfNights, checkInDate, checkOutDate]);


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
    // Force log the dates we're checking to help debug
    console.log("==========================================");
    console.log("🚨 MANUAL AVAILABILITY CHECK TRIGGERED 🚨");
    console.log("==========================================");

    console.log("🔍 [AvailabilityCheck] Starting availability check for property:" + propertySlug, {
      from: checkInDate ? checkInDate.toISOString() : 'null',
      to: checkOutDate ? checkOutDate.toISOString() : 'null',
      numNights: clientNumberOfNights,
      propertySlug: propertySlug
    });

    // Always reset the state first
    setIsAvailable(null);
    setIsLoadingAvailability(true);
    setSuggestedDates([]);
    // Don't reset selectedOption when just checking availability
    // setSelectedOption(null);

    console.log("🔄 [AvailabilityCheck] State reset, starting availability check flow");

    // Set a timeout to prevent infinite loading state
    const timeoutId = setTimeout(() => {
      console.log("⏱️ [AvailabilityCheck] ERROR: Availability check timed out after 10 seconds");
      setIsLoadingAvailability(false);
      setIsAvailable(null);
      toast({
        title: "Check Timed Out",
        description: "The availability check took too long. Please try again.",
        variant: "destructive",
      });
    }, 10000); // 10-second timeout

    // Extra validation to ensure we have valid dates
    if (!datesSelected || !checkInDate || !checkOutDate) {
      clearTimeout(timeoutId);
      setIsLoadingAvailability(false);
      console.log("❌ [AvailabilityCheck] ERROR: Availability check aborted - no dates selected", {
        datesSelected,
        checkInDate: checkInDate?.toISOString() || 'null',
        checkOutDate: checkOutDate?.toISOString() || 'null'
      });
      return;
    }

    // Double-check date validity
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      clearTimeout(timeoutId);
      setIsLoadingAvailability(false);
      console.error("❌ [AvailabilityCheck] ERROR: Availability check aborted - invalid date objects", {
        checkInValid: !isNaN(checkInDate.getTime()),
        checkOutValid: !isNaN(checkOutDate.getTime()),
        checkInDate: checkInDate.toString(),
        checkOutDate: checkOutDate.toString()
      });
      toast({
        title: "Invalid Dates",
        description: "The selected dates are invalid. Please try selecting dates again.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log(`📅 [AvailabilityCheck] Fetching unavailable dates for property: "${propertySlug}"`);

      // TEMPORARY FIX: For development/testing, force the property to be available
      // This is useful to help with debugging the booking forms
      if (process.env.NODE_ENV === 'development') {
        console.log("🧪 [AvailabilityCheck] DEVELOPMENT MODE DETECTED - Should we force availability?");

        // FORCE the actual availability check in development
        const forceDevelopmentAvailability = false; // Keep false to always run the real check

        if (forceDevelopmentAvailability) {
          console.log("🧪 [AvailabilityCheck] DEVELOPMENT MODE: Forcing property as available");
          // Wait a bit to simulate loading
          await new Promise(resolve => setTimeout(resolve, 1000));

          // For development testing, set availability to true to show the booking forms
          setIsAvailable(true);
          setUnavailableDates([]);
          console.log("🧪 [AvailabilityCheck] DEV MODE: Availability forced to TRUE, unavailable dates cleared");

          // Ensure we have a valid number of nights for testing
          if (checkInDate && checkOutDate) {
            // Force recalculate nights using a different method
            const daysDiff = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
            console.log(`🧪 [AvailabilityCheck] DEV MODE: Force setting nights to ${daysDiff}`, {
              checkIn: checkInDate.toISOString(),
              checkOut: checkOutDate.toISOString(),
              timeDiff: checkOutDate.getTime() - checkInDate.getTime(),
              daysDiff: daysDiff
            });

            if (daysDiff > 0) {
              setClientNumberOfNights(daysDiff);
            } else {
              // Fallback to manual night count from URL params
              const nights = 8; // Default to 8 nights if calculation fails
              console.log(`🧪 [AvailabilityCheck] DEV MODE: Calculation failed, forcing to ${nights} nights`, {
                calculatedDaysDiff: daysDiff,
                forcedNights: nights
              });
              setClientNumberOfNights(nights);
            }
          }

          clearTimeout(timeoutId);
          setIsLoadingAvailability(false);
          console.log("🧪 [AvailabilityCheck] DEV MODE: Availability check process completed with forced result");
          return;
        } else {
          console.log("🧪 [AvailabilityCheck] DEVELOPMENT MODE: Using real availability check");
        }
      }

      // Continue with the normal availability check for production
      console.log(`📞 [AvailabilityCheck] Calling getUnavailableDatesForProperty service for "${propertySlug}"`);
      const fetchedUnavailableDates = await getUnavailableDatesForProperty(propertySlug);
      console.log(`✅ [AvailabilityCheck] Received ${fetchedUnavailableDates.length} unavailable dates from service`);

      // Log all unavailable dates for debugging
      if (fetchedUnavailableDates.length > 0) {
        // Only show the first 20 dates to avoid console spam
        const datesToShow = fetchedUnavailableDates.length > 20 ? fetchedUnavailableDates.slice(0, 20) : fetchedUnavailableDates;
        console.log(`📋 [AvailabilityCheck] First ${datesToShow.length} unavailable dates:`,
          datesToShow.map(d => format(d, 'yyyy-MM-dd')).join(', ') +
          (fetchedUnavailableDates.length > 20 ? ' ...(more)' : '')
        );
      } else {
        console.log("📋 [AvailabilityCheck] No unavailable dates returned from service");
      }

      setUnavailableDates(fetchedUnavailableDates);

      let conflict = false;
      let current = new Date(checkInDate.getTime());
      console.log(`🔎 [AvailabilityCheck] Starting date-by-date availability check from ${format(current, 'yyyy-MM-dd')} to ${format(checkOutDate, 'yyyy-MM-dd')}`);

      const allDatesToCheck = [];
      let currentDate = new Date(current);

      // Pre-collect all dates to check for logging
      while (isBefore(currentDate, checkOutDate)) {
        allDatesToCheck.push(format(startOfDay(currentDate), 'yyyy-MM-dd'));
        currentDate = addDays(currentDate, 1);
      }

      console.log(`🗓️ [AvailabilityCheck] Will check ${allDatesToCheck.length} dates for availability: ${allDatesToCheck.join(', ')}`);

      // Actual date-by-date check
      while (isBefore(current, checkOutDate)) {
        const dateString = format(startOfDay(current), 'yyyy-MM-dd');
        console.log(`🔍 [AvailabilityCheck] Checking date: ${dateString}`);

        const isUnavailable = fetchedUnavailableDates.some(d => {
          const unavailableDateStr = format(startOfDay(d), 'yyyy-MM-dd');
          const matches = unavailableDateStr === dateString;
          if (matches) {
            console.log(`❌ [AvailabilityCheck] MATCH! Date ${dateString} matches unavailable date ${unavailableDateStr}`);
          }
          return matches;
        });

        if (isUnavailable) {
          conflict = true;
          console.log(`⛔ [AvailabilityCheck] CONFLICT FOUND: Date ${dateString} is unavailable`);
          break;
        } else {
          console.log(`✓ [AvailabilityCheck] Date ${dateString} is available`);
        }

        current = addDays(current, 1);
      }

      console.log(`📊 [AvailabilityCheck] Final availability result: ${!conflict ? '✅ AVAILABLE' : '❌ NOT AVAILABLE'}`);
      setIsAvailable(!conflict);

      if (conflict && clientNumberOfNights > 0) {
        console.log(`🔄 [AvailabilityCheck] Finding alternative dates for a ${clientNumberOfNights}-night stay...`);
        let suggestionFound = false;
        let suggestionStart = addDays(checkOutDate, 1);
        const maxSearchDate = addDays(checkOutDate, 60);
        console.log(`🔍 [AvailabilityCheck] Will search for alternatives from ${format(suggestionStart, 'yyyy-MM-dd')} to ${format(maxSearchDate, 'yyyy-MM-dd')}`);

        let attemptCount = 0;
        while (isAfter(maxSearchDate, suggestionStart) && !suggestionFound) {
          attemptCount++;
          const suggestionEnd = addDays(suggestionStart, clientNumberOfNights);
          console.log(`🔄 [AvailabilityCheck] Trying alternative dates: ${format(suggestionStart, 'yyyy-MM-dd')} to ${format(suggestionEnd, 'yyyy-MM-dd')} (attempt ${attemptCount})`);

          let suggestionConflict = false;
          let checkCurrent = new Date(suggestionStart.getTime());

          while (isBefore(checkCurrent, suggestionEnd)) {
            const checkDateString = format(startOfDay(checkCurrent), 'yyyy-MM-dd');
            const isUnavailable = fetchedUnavailableDates.some(d => format(startOfDay(d), 'yyyy-MM-dd') === checkDateString);
            const isPastDate = isBefore(checkCurrent, startOfDay(new Date()));

            if (isUnavailable || isPastDate) {
              suggestionConflict = true;
              console.log(`❌ [AvailabilityCheck] Alternative date conflict on ${checkDateString} - ${isUnavailable ? 'unavailable' : 'past date'}`);
              break;
            }
            checkCurrent = addDays(checkCurrent, 1);
          }

          if (!suggestionConflict) {
            console.log(`✅ [AvailabilityCheck] SUCCESS: Found alternative dates on attempt ${attemptCount}: ${format(suggestionStart, 'yyyy-MM-dd')} to ${format(suggestionEnd, 'yyyy-MM-dd')}`);
            setSuggestedDates([{ from: suggestionStart, to: suggestionEnd, recommendation: "Next Available" }]);
            suggestionFound = true;
          } else {
            console.log(`↪️ [AvailabilityCheck] Alternative dates ${format(suggestionStart, 'yyyy-MM-dd')} to ${format(suggestionEnd, 'yyyy-MM-dd')} have conflicts, trying next day`);
            suggestionStart = addDays(suggestionStart, 1);
          }
        }

        if (!suggestionFound) {
          console.log(`❗ [AvailabilityCheck] Could not find alternative dates within the next 60 days after ${attemptCount} attempts`);
        }
      }
    } catch (error) {
      console.error("❌ [AvailabilityCheck] ERROR checking availability:", error);
      // Log more details about the error
      if (error instanceof Error) {
        console.error("⚠️ [AvailabilityCheck] Error details:", {
          name: error.name,
          message: error.message,
          stack: error.stack,
          propertySlug
        });
      }

      toast({
        title: "Error Checking Availability",
        description: "Could not check property availability. Please try again.",
        variant: "destructive",
      });
      setIsAvailable(false);
    } finally {
      clearTimeout(timeoutId); // Clear the timeout on success or error
      setIsLoadingAvailability(false);
      console.log("🏁 [AvailabilityCheck] Availability check process completed");
    }
  }, [checkInDate, checkOutDate, datesSelected, propertySlug, clientNumberOfNights, toast]);

  // Store previous date values to avoid unnecessary rechecks
  const prevCheckInRef = useRef<Date | null>(null);
  const prevCheckOutRef = useRef<Date | null>(null);

  // Effect to handle date changes and set initial availability
  // This replaces the auto-checking effect with one that only sets initial state
  useEffect(() => {
    // Return early if not mounted
    if (!hasMounted) {
      return;
    }

    // If dates are not selected or invalid, reset states
    if (!datesSelected || clientNumberOfNights <= 0) {
      setIsAvailable(null);
      setIsLoadingAvailability(false);
      setUnavailableDates([]);
      setSuggestedDates([]);
      setSelectedOption(null);
      return;
    }

    // Check if the date range has actually changed to avoid infinite loops
    const dateRangeChanged =
      !prevCheckInRef.current ||
      !prevCheckOutRef.current ||
      prevCheckInRef.current.getTime() !== checkInDate?.getTime() ||
      prevCheckOutRef.current.getTime() !== checkOutDate?.getTime();

    if (dateRangeChanged) {
      // Update refs with current values for tracking
      prevCheckInRef.current = checkInDate;
      prevCheckOutRef.current = checkOutDate;

      console.log("==========================================");
      console.log("⚠️ [DATE-CHANGE] Dates changed - Reset availability state");
      console.log("==========================================");

      console.log("🔄 [DATE-CHANGE] New date range: " +
        (checkInDate ? format(checkInDate, 'yyyy-MM-dd') : 'null') + " to " +
        (checkOutDate ? format(checkOutDate, 'yyyy-MM-dd') : 'null'));

      // IMPORTANT: Just reset the availability state without auto-checking
      // This forces the user to explicitly check availability with the button
      setIsAvailable(null);

      // No auto-checking to prevent infinite loops
      console.log("⚠️ [DATE-CHANGE] Resetting availability state to null - waiting for user to check");

      // Also clear any previously loaded unavailable dates to avoid confusion
      setUnavailableDates([]);
      setSuggestedDates([]);
    }
  }, [
    hasMounted,
    datesSelected,
    clientNumberOfNights,
    // Use the stringified date values to prevent reference comparison issues
    checkInDate?.toISOString(),
    checkOutDate?.toISOString()
    // IMPORTANT: We removed checkPropertyAvailability from dependencies
    // This helps break the loop of auto-checking
  ]);

  // Add a safety timeout to ensure loading state is never stuck
  useEffect(() => {
    if (isLoadingAvailability) {
      const safetyTimeout = setTimeout(() => {
        console.log("Safety timeout triggered - forcing reset of loading state after 20 seconds");
        setIsLoadingAvailability(false);
        setIsAvailable(null);
      }, 20000); // 20-second absolute maximum timeout

      return () => clearTimeout(safetyTimeout);
    }
  }, [isLoadingAvailability]);

  // Create a ref to track if we've already initialized
  const initializedRef = useRef(false);

  // Effect that runs once to set up initial night count calculation
  useEffect(() => {
    // Only run once after component has mounted and only if not already initialized
    if (hasMounted && !initializedRef.current) {
      // Mark as initialized immediately to prevent re-entry
      initializedRef.current = true;

      // Calculate nights if needed, but don't auto-start availability check
      const initialSetupTimeout = setTimeout(() => {
        console.log("==========================================");
        console.log("🚀 [INITIAL SETUP] Setting up initial state");
        console.log("==========================================");

        // Only calculate nights if needed (this won't auto-check availability)
        if (checkInDate && checkOutDate && clientNumberOfNights <= 0) {
          const daysDiff = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
          const nightsToSet = daysDiff > 0 ? daysDiff : 1; // Default to 1 night
          console.log(`[AvailabilityCheck] Setting initial nights to ${nightsToSet}`);
          setClientNumberOfNights(nightsToSet);
        }

        // Important: We update the ref values but DON'T auto-check availability
        if (checkInDate && checkOutDate) {
          prevCheckInRef.current = checkInDate;
          prevCheckOutRef.current = checkOutDate;
          console.log("[AvailabilityCheck] Stored initial date range in refs");
        }

        console.log("[AvailabilityCheck] Initial setup completed - user must check availability manually");
      }, 500); // Short timeout for initial setup

      return () => clearTimeout(initialSetupTimeout);
    }
  // Only depend on hasMounted to run once after mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMounted]);


  const handleSelectAlternativeDate = (range: { from: Date; to: Date }) => {
    setCheckInDate(range.from);
    setCheckOutDate(range.to);
    setSelectedOption(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Memoized handler for open state changes to prevent render loops
  const handleOpenChange = useCallback((open: boolean) => {
    // Only update the state if the value has actually changed
    if (isOpenRef.current !== open) {
      isOpenRef.current = open;
      setIsDatePickerOpen(open);
    }
  }, []);

  const handleDateSelect = useCallback((range: DateRange | undefined) => {
    if (range?.from) {
      // Normalize dates to start of day to avoid time zone issues
      const checkIn = startOfDay(range.from);
      console.log('Setting check-in date:', checkIn.toISOString());
      setCheckInDate(checkIn);
    } else {
      setCheckInDate(null);
    }

    if (range?.to) {
      const checkOut = startOfDay(range.to);
      console.log('Setting check-out date:', checkOut.toISOString());
      setCheckOutDate(checkOut);
    } else {
      setCheckOutDate(null);
    }

    setSelectedOption(null);

    // Use the ref to avoid circular updates
    if (isOpenRef.current) {
      isOpenRef.current = false;
      setIsDatePickerOpen(false);
    }
  }, [setCheckInDate, setCheckOutDate, setSelectedOption]);

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

  const handleContinueToPayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError(null);

    // Client-side validation
    if (!datesSelected || !checkInDate || !checkOutDate || !pricingDetailsInBaseCurrency) {
      setFormError("Please select valid dates and ensure price is calculated.");
      toast({
        title: "Missing Information",
        description: "Please select valid dates for your booking.",
        variant: "destructive",
      });
      return;
    }

    if (!sessionFirstName || !sessionLastName || !sessionEmail || !sessionPhone) {
      setFormError("Please fill in all required guest information.");
      toast({
        title: "Missing Information",
        description: "Please provide all required guest details.",
        variant: "destructive",
      });
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

      // Create pending booking in database
      const pendingBookingResult = await createPendingBookingAction(bookingInput);

      // Handle errors from booking creation
      if (pendingBookingResult.error || !pendingBookingResult.bookingId) {
        const errorMsg = pendingBookingResult.error || "Could not create booking";
        const canRetry = pendingBookingResult.retry === true;

        toast({
          title: canRetry ? "Please Try Again" : "Booking Error",
          description: errorMsg,
          variant: "destructive",
          // For network errors, make toast stay longer to give user time to read it
          duration: pendingBookingResult.errorType === 'network_error' ? 8000 : 5000,
        });

        setFormError(errorMsg);
        setLastErrorType(pendingBookingResult.errorType);
        setCanRetryError(canRetry);
        return;
      }

      const { bookingId } = pendingBookingResult;

      // Create checkout session to process payment
      const checkoutInput = {
        property: property,
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
        numberOfGuests: guestsDisplay,
        totalPrice: bookingInput.pricing.total,
        numberOfNights: clientNumberOfNights,
        appliedCouponCode: appliedCoupon?.code,
        discountPercentage: appliedCoupon?.discountPercentage,
        guestFirstName: sanitizeText(sessionFirstName),
        guestLastName: sanitizeText(sessionLastName),
        guestEmail: sanitizeEmail(sessionEmail),
        pendingBookingId: bookingId,
        selectedCurrency: selectedCurrency,
      };

      const stripeResult = await createCheckoutSession(checkoutInput);

      // Handle errors from Stripe checkout creation
      if (stripeResult.error || !stripeResult.sessionUrl) {
        const errorMsg = stripeResult.error || "Payment processing error";
        const canRetry = stripeResult.retry === true;

        toast({
          title: canRetry ? "Payment Processing Issue" : "Payment Error",
          description: errorMsg,
          variant: "destructive",
          duration: stripeResult.errorType === 'network_error' ? 8000 : 5000,
        });

        setFormError(errorMsg);
        setLastErrorType(pendingBookingResult.errorType);
        setCanRetryError(canRetry);
        return;
      }

      // Navigate to Stripe Checkout
      router.push(stripeResult.sessionUrl);

    } catch (error) {
      // Handle unexpected errors
      console.error("Error processing booking:", error);

      let errorMessage = "Something went wrong with your booking. Please try again.";

      // For known error types, provide more specific messages
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('connection')) {
          errorMessage = "Network connection issue. Please check your internet connection and try again.";
        } else if (error.message.includes('Stripe') || error.message.includes('payment')) {
          errorMessage = "There was a problem processing your payment. Please try again.";
        } else if (error.message.includes('unavailable') || error.message.includes('service')) {
          errorMessage = "Service temporarily unavailable. Please try again in a few minutes.";
        } else {
          // Use the actual error message for other cases
          errorMessage = error.message;
        }
      }

      setFormError(errorMessage);

      toast({
        title: "Booking Error",
        description: errorMessage,
        variant: "destructive",
        duration: 7000, // Longer duration for unexpected errors
      });
    } finally {
      setIsProcessingBooking(false);
    }
  };

  const handleHoldDates = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError(null);

    // Client-side validation
    if (!datesSelected || !checkInDate || !checkOutDate || !property.holdFeeAmount) {
        setFormError("Please select valid dates. Hold fee must be configured for this property.");
        toast({
          title: "Missing Information",
          description: "Please select valid dates. This property requires a hold fee.",
          variant: "destructive",
        });
        return;
    }

    if (!sessionFirstName || !sessionLastName || !sessionEmail) { // Phone is optional for hold
      setFormError("Please fill in First Name, Last Name, and Email to hold dates.");
      toast({
        title: "Missing Information",
        description: "Please provide your name and email to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingBooking(true);

    try {
        // Prepare hold booking input
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
            selectedCurrency: selectedCurrency,
        };

        // Create hold booking in database
        const holdBookingResult = await createHoldBookingAction(holdBookingInput);

        // Handle errors from hold booking creation
        if (holdBookingResult.error || !holdBookingResult.bookingId) {
            const errorMsg = holdBookingResult.error || "Could not create hold booking";
            const canRetry = holdBookingResult.retry === true;

            toast({
              title: canRetry ? "Please Try Again" : "Hold Booking Error",
              description: errorMsg,
              variant: "destructive",
              duration: holdBookingResult.errorType === 'network_error' ? 8000 : 5000,
            });

            setFormError(errorMsg);
            return;
        }

        const { bookingId: holdBookingId } = holdBookingResult;

        // Set up hold checkout session for payment
        const holdCheckoutInput = {
            property: property,
            holdBookingId: holdBookingId,
            holdFeeAmount: property.holdFeeAmount,
            guestEmail: sanitizeEmail(sessionEmail),
            selectedCurrency: selectedCurrency,
        };

        // Create checkout session
        const stripeHoldResult = await createHoldCheckoutSession(holdCheckoutInput);

        // Handle errors from checkout session creation
        if (stripeHoldResult.error || !stripeHoldResult.sessionUrl) {
            const errorMsg = stripeHoldResult.error || "Payment processing error";
            const canRetry = stripeHoldResult.retry === true;

            toast({
              title: canRetry ? "Payment Processing Issue" : "Payment Error",
              description: errorMsg,
              variant: "destructive",
              duration: stripeHoldResult.errorType === 'network_error' ? 8000 : 5000,
            });

            setFormError(errorMsg);
            return;
        }

        // Redirect to Stripe checkout
        router.push(stripeHoldResult.sessionUrl);

    } catch (error) {
        // Handle unexpected errors
        console.error("Error processing hold dates:", error);

        let errorMessage = "Something went wrong while trying to hold these dates. Please try again.";

        // Provide more specific messages for known error types
        if (error instanceof Error) {
            if (error.message.includes('network') || error.message.includes('connection')) {
                errorMessage = "Network connection issue. Please check your internet connection and try again.";
            } else if (error.message.includes('Stripe') || error.message.includes('payment')) {
                errorMessage = "There was a problem with the payment system. Please try again.";
            } else if (error.message.includes('unavailable') || error.message.includes('service')) {
                errorMessage = "Service temporarily unavailable. Please try again in a few minutes.";
            } else {
                // Use the actual error message for other cases
                errorMessage = error.message;
            }
        }

        setFormError(errorMessage);

        toast({
            title: "Hold Dates Error",
            description: errorMessage,
            variant: "destructive",
            duration: 7000 // Longer duration for unexpected errors
        });
    } finally {
        setIsProcessingBooking(false);
    }
  };

  // New effect to load unavailable dates as soon as the component mounts
  useEffect(() => {
    if (!hasMounted || !propertySlug) {
      return;
    }

    console.log("==========================================");
    console.log("🔍 [INITIAL-LOAD] Loading unavailable dates on mount");
    console.log("==========================================");

    // Set loading state
    setIsLoadingAvailability(true);

    // Fetch unavailable dates immediately on component mount
    getUnavailableDatesForProperty(propertySlug)
      .then(dates => {
        console.log(`🔍 [INITIAL-LOAD] Loaded ${dates.length} unavailable dates for property ${propertySlug}`);

        // Process dates to ensure they're valid Date objects with consistent time (midnight)
        const validDates = dates
          .filter(date => date instanceof Date && !isNaN(date.getTime()))
          .map(date => new Date(date.getFullYear(), date.getMonth(), date.getDate()));

        console.log(`🔍 [INITIAL-LOAD] Processed ${validDates.length} valid unavailable dates`);

        // Store the unavailable dates
        setUnavailableDates(validDates);
        setIsLoadingAvailability(false);
      })
      .catch(error => {
        console.error("❌ [INITIAL-LOAD] Error loading unavailable dates:", error);
        // Set empty array in case of error
        setUnavailableDates([]);
        setIsLoadingAvailability(false);
      });
  }, [hasMounted, propertySlug]);

  const renderAvailabilityCalendar = () => {
    // Changed the condition to show calendar when dates are selected and we have unavailable dates
    // This ensures unavailable dates are shown even when availability is still being checked
    if (!datesSelected || !hasMounted || unavailableDates.length === 0) {
      return null;
    }

    // Log to confirm we're showing the calendar with unavailable dates
    console.log(`[AvailabilityCheck] Rendering calendar with ${unavailableDates.length} unavailable dates`);

    const validCheckIn = checkInDate && isValid(checkInDate) ? checkInDate : new Date();
    const calendarCenterMonth = startOfMonth(validCheckIn);

    return (
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-3">Availability Calendar</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Dates that are unavailable for booking are marked with a strikethrough.
        </p>
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
      {/* Include the nights fixer component */}
      <FixNights />

      {/* Add debug component - only visible in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-4 bg-gray-100 p-3 rounded-md text-xs">
          <details open>
            <summary className="cursor-pointer font-medium text-blue-600">Debug Info</summary>
            <pre className="mt-2 whitespace-pre-wrap">
              propertySlug: {propertySlug}
              checkInDate: {checkInDate ? checkInDate.toISOString() : 'null'}
              checkOutDate: {checkOutDate ? checkOutDate.toISOString() : 'null'}
              datesSelected: {String(datesSelected)}
              isAvailable: {String(isAvailable)}
              isLoadingAvailability: {String(isLoadingAvailability)}
              numberOfNights: {clientNumberOfNights}
              selectedOption: {selectedOption || 'null'}
            </pre>

            <div className="mt-2 pt-2 border-t border-gray-300">
              <button
                onClick={() => {
                  console.log('Force checking availability');
                  setIsAvailable(true); // Try forcing availability for testing
                }}
                className="text-xs bg-blue-500 hover:bg-blue-700 text-white py-1 px-2 rounded mr-2"
              >
                Force Available
              </button>

              <button
                onClick={checkPropertyAvailability}
                className="text-xs bg-green-500 hover:bg-green-700 text-white py-1 px-2 rounded mr-2"
              >
                Check Availability
              </button>

              <button
                onClick={() => {
                  if (checkInDate && checkOutDate) {
                    // Calculate using simple method
                    const days = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
                    const nightsToSet = days > 0 ? days : 4; // Default to 4 nights
                    console.log(`[Manual] Setting nights to ${nightsToSet}`);
                    setClientNumberOfNights(nightsToSet);
                  }
                }}
                className="text-xs bg-yellow-500 hover:bg-yellow-700 text-white py-1 px-2 rounded"
              >
                Fix Nights
              </button>
            </div>
          </details>
        </div>
      )}

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

      {/* Add Check Availability button */}
      {datesSelected && !isLoadingAvailability && (
        <div className="mt-6">
          <Button
            onClick={checkPropertyAvailability}
            className="w-full"
            variant="default"
            disabled={isLoadingAvailability}
          >
            {isAvailable === null ? "Check Availability for Selected Dates" : "Re-Check Availability"}
          </Button>
        </div>
      )}

      {/* Loading state monitoring is handled with timeouts */}

      {/* Date Picker and Guest Picker - Moved under AvailabilityStatus */}
      <div className="mt-6 flex flex-col md:flex-row md:items-end md:gap-4 space-y-4 md:space-y-0">
        <div className="flex-grow">
          <Label className="mb-1 block text-sm font-medium">Selected Dates</Label>
          <Popover open={isDatePickerOpen} onOpenChange={handleOpenChange}>
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
              {/* Wrap Calendar in a Fragment to reduce re-renders */}
              {isDatePickerOpen && (
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from && isValid(dateRange.from) ? dateRange.from : undefined}
                  selected={dateRange}
                  onSelect={handleDateSelect}
                  numberOfMonths={2}
                  disabled={{ before: startOfDay(new Date()) }}
                  // Add modifiers to style unavailable dates
                  modifiers={{
                    unavailable: unavailableDates
                  }}
                  modifiersStyles={{
                    unavailable: {
                      textDecoration: 'line-through',
                      color: 'hsl(var(--muted-foreground))',
                      opacity: 0.6,
                      pointerEvents: 'none' as const
                    }
                  }}
                />
              )}
            </PopoverContent>
          </Popover>
          {clientNumberOfNights > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              ({clientNumberOfNights} {clientNumberOfNights === 1 ? 'night' : 'nights'})
            </p>
          )}
          {unavailableDates.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-amber-600">•</span> Some dates are not available (marked with strikethrough)
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
                    <ErrorMessage
                      error={formError}
                      className="my-3"
                      errorType={lastErrorType}
                      onRetry={canRetryError ? handleContinueToPayment : undefined}
                    />
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
