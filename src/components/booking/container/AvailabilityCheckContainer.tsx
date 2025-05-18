"use client";

import React, { useState, useEffect, useRef, useTransition, useMemo, useCallback } from 'react';
import { Loader2, Calendar, Check, X, ArrowRight, Mail, Phone as PhoneIcon, Send, Minus, Plus, CalendarDays } from 'lucide-react';
import { format, startOfDay, differenceInDays } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useBooking } from '@/contexts/BookingContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useToast } from '@/hooks/use-toast';
import { calculatePrice } from '@/lib/price-utils';
import { Button } from '@/components/ui/button';
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { BookingOptionsCards } from '../booking-options-cards';
import { BookingSummary } from '../booking-summary';
import { BookingForm } from '../forms/BookingForm';
import { HoldForm } from '../forms/HoldForm';
import { ContactHostForm } from '../forms/ContactHostForm';
import { UnavailableDatesView } from './UnavailableDatesView';
import { RefactoredAvailabilityCheck } from './RefactoredAvailabilityCheck';
import { AvailabilityPreview } from '../AvailabilityPreview';
import { createInquiryAction } from '@/app/actions/createInquiryAction';
import { createHoldBookingAction } from '@/app/actions/createHoldBookingAction';
import { createHoldCheckoutSession } from '@/app/actions/createHoldCheckoutSession';
import { createPendingBookingAction } from '@/app/actions/booking-actions';
import { createCheckoutSession } from '@/app/actions/create-checkout-session';

interface AvailabilityCheckContainerProps {
  property: any;
  initialCheckIn?: string;
  initialCheckOut?: string;
}

// Enhanced version that safely handles availability checking and uses price calendar for pricing
function AvailabilityCheckContainer({ property, initialCheckIn, initialCheckOut }: AvailabilityCheckContainerProps) {
  // Use ref to track renders
  const renderCountRef = useRef(0);
  const [hasMounted, setHasMounted] = useState(false);

  // Get values from booking context with error handling
  const bookingContext = useMemo(() => {
    try {
      const context = useBooking();
      // Verify return value
      if (!context || typeof context !== 'object') {
        console.error('[AvailabilityCheckContainer] Invalid context returned from useBooking:', context);
        throw new Error('Invalid booking context');
      }
      return context;
    } catch (error) {
      console.error('[AvailabilityCheckContainer] Error accessing booking context:', error);
      // Return fallback values to prevent component crash
      return {
        checkInDate: null,
        checkOutDate: null,
        numberOfNights: 0,
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        message: '',
        setFirstName: () => {},
        setLastName: () => {},
        setEmail: () => {},
        setPhone: () => {},
        setMessage: () => {},
        setCheckInDate: () => {},
        setCheckOutDate: () => {},
      };
    }
  }, []);

  // Destructure values from context or fallback
  const {
    checkInDate,
    checkOutDate,
    numberOfNights,
    numberOfGuests,
    firstName,
    lastName,
    email,
    phone,
    message,
    setFirstName,
    setLastName,
    setEmail,
    setPhone,
    setMessage,
    setCheckInDate,
    setCheckOutDate,
    setNumberOfGuests,
  } = bookingContext;
  
  // Use a ref to avoid infinite update loops
  const didMount = useRef(false);

  // Use local state to directly manage the guest count, initialized from the context
  const [guestCount, setGuestCount] = useState(numberOfGuests);

  // Helper function to update guest count and context together
  const updateGuestCount = useCallback((newCount: number) => {
    console.log(`[AvailabilityCheckContainer] 🧑‍🤝‍🧑 Updating guest count through helper: ${guestCount} -> ${newCount}`);

    // Force a state update
    setGuestCount(newCount);

    // Also update the global context
    setNumberOfGuests(newCount);

    // Force a render of the price summary
    console.log(`[AvailabilityCheckContainer] ✅ Guest count updated to: ${newCount}`);
  }, [guestCount, setNumberOfGuests]);

  // Sync with context on mount and when numberOfGuests changes externally
  useEffect(() => {
    // Skip the first render to avoid double-updates
    if (!didMount.current) {
      didMount.current = true;
      return;
    }

    // Only update if there's an actual difference
    if (guestCount !== numberOfGuests) {
      console.log(`[AvailabilityCheckContainer] 🔄 Syncing guest count from context: ${guestCount} -> ${numberOfGuests}`);
      setGuestCount(numberOfGuests);
    }
  }, [numberOfGuests, guestCount]);

  // These effects have been replaced by the updateGuestCount function and
  // the sync effect above to avoid infinite update loops


  // State for availability checking and booking options
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [wasChecked, setWasChecked] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  // State for booking functionality
  const [selectedOption, setSelectedOption] = useState<'contact' | 'hold' | 'bookNow' | null>(null);
  const [isProcessingBooking, setIsProcessingBooking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastErrorType, setLastErrorType] = useState<string | undefined>(undefined);
  const [canRetryError, setCanRetryError] = useState<boolean>(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPercentage: number } | null>(null);

  // Import needed hooks
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const { selectedCurrency, baseCurrencyForProperty, convertToSelectedCurrency, formatPrice } = useCurrency();

  // Calculate pricing details for the booking - using hooks in the proper order
  const propertyBaseCcy = useMemo(() => baseCurrencyForProperty(property.baseCurrency), [property.baseCurrency, baseCurrencyForProperty]);

  // For storing the dynamic pricing from price calendar API
  const [dynamicPricingDetails, setDynamicPricingDetails] = useState<any>(null);

  // State for pricing data errors
  const [pricingError, setPricingError] = useState<string | null>(null);
  
  // Effect to fetch pricing data from priceCalendar when dates or guests change
  useEffect(() => {
    // Create a marker to identify this render cycle
    const fetchId = Date.now();
    console.log(`[AvailabilityCheckContainer] 🔄 Pricing effect running: ID=${fetchId}`);
    
    const fetchDynamicPricing = async () => {
      // Reset pricing state
      setDynamicPricingDetails(null);
      setPricingError(null);
      
      // Only fetch if we have valid dates and guest count
      if (checkInDate && checkOutDate && numberOfNights > 0 && property && guestCount > 0) {
        console.log(`[AvailabilityCheckContainer] 🔍 Fetch ID=${fetchId}: Fetching dynamic pricing data for ${property.slug}`, {
          checkIn: checkInDate.toISOString(),
          checkOut: checkOutDate.toISOString(),
          nights: numberOfNights,
          guests: guestCount
        });
        
        try {
          // Direct import with full path to make sure we get the correct module
          const { getPricingForDateRange } = await import('@/services/availabilityService');
          
          // Verify function exists
          if (typeof getPricingForDateRange !== 'function') {
            console.error(`[AvailabilityCheckContainer] ❌ Fetch ID=${fetchId}: getPricingForDateRange function not found!`);
            setPricingError("Pricing service unavailable. Please try again later.");
            return;
          }
          
          console.log(`[AvailabilityCheckContainer] 🚀 Fetch ID=${fetchId}: Calling getPricingForDateRange now...`);
          
          // Call the pricing function with specific parameters
          const pricingData = await getPricingForDateRange(
            property.slug,
            checkInDate,
            checkOutDate,
            guestCount
          );
          
          // Log the raw response for debugging
          console.log(`[AvailabilityCheckContainer] 📦 Fetch ID=${fetchId}: Raw pricing response:`, pricingData);
          
          if (pricingData && pricingData.pricing) {
            console.log(`[AvailabilityCheckContainer] ✅ Fetch ID=${fetchId}: Received valid pricing data:`, {
              dailyRates: Object.keys(pricingData.pricing.dailyRates || {}).length + " entries",
              totalPrice: pricingData.pricing.totalPrice,
              averageRate: pricingData.pricing.averageNightlyRate,
              currency: pricingData.pricing.currency
            });
            
            // Store the dynamic pricing data
            setDynamicPricingDetails({
              accommodationTotal: pricingData.pricing.subtotal - (pricingData.pricing.cleaningFee || 0),
              cleaningFee: pricingData.pricing.cleaningFee || 0,
              subtotal: pricingData.pricing.subtotal,
              total: pricingData.pricing.totalPrice,
              currency: pricingData.pricing.currency as any,
              dailyRates: pricingData.pricing.dailyRates || {},
              // Apply any discount from coupon if present
              couponDiscount: appliedCoupon ? {
                discountPercentage: appliedCoupon.discountPercentage,
                discountAmount: (pricingData.pricing.subtotal * appliedCoupon.discountPercentage) / 100
              } : null
            });
          } else {
            console.error(`[AvailabilityCheckContainer] ❌ Fetch ID=${fetchId}: No valid pricing data available`);
            setPricingError("Pricing information is currently unavailable. Please try again later.");
          }
        } catch (error) {
          console.error(`[AvailabilityCheckContainer] Error fetching dynamic pricing:`, error);
          setPricingError("We're having trouble getting pricing information. Please try again later.");
        }
      } else {
        console.log(`[AvailabilityCheckContainer] ⚠️ Fetch ID=${fetchId}: Missing data for pricing fetch`, { 
          hasCheckIn: !!checkInDate, 
          hasCheckOut: !!checkOutDate, 
          nights: numberOfNights, 
          hasProperty: !!property, 
          guests: guestCount 
        });
      }
    };
    
    // Attempt to fetch dynamic pricing
    fetchDynamicPricing();
  }, [property?.slug, checkInDate, checkOutDate, numberOfNights, guestCount, appliedCoupon]);
  
  // No longer calculate fallback prices - only for logging/debugging purposes
  // This will help us identify when dynamic pricing is missing
  const debugPriceCalculation = (() => {
    if (checkInDate && checkOutDate && numberOfNights > 0 && property) {
      console.log(`[AvailabilityCheckContainer] 📊 LOGGING ONLY - Not used for booking - What price would have been:`, {
        guestCount,
        numberOfNights,
        dynamicPricingAvailable: dynamicPricingDetails ? "Yes" : "No",
        dates: {
          checkIn: checkInDate?.toISOString(),
          checkOut: checkOutDate?.toISOString()
        }
      });
    }
    return null;
  })();
  
  // Only use dynamic pricing - no fallback
  const pricingDetailsInBaseCurrency = null;


  // Set mounted flag and load unavailable dates on first render
  const [unavailableDates, setUnavailableDates] = useState<Date[]>([]);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
  
  // Run the diagnostic test for the pricing API on mount
  useEffect(() => {
    const testPricingAPI = async () => {
      try {
        const { testPricingApi } = await import('@/services/availabilityService');
        console.log(`[AvailabilityCheckContainer] 🔬 Running pricing API diagnostic test...`);
        
        if (typeof testPricingApi === 'function') {
          testPricingApi();
          console.log(`[AvailabilityCheckContainer] ✅ Pricing API diagnostic test passed`);
        } else {
          console.error(`[AvailabilityCheckContainer] ❌ testPricingApi not found in service!`);
        }
      } catch (error) {
        console.error(`[AvailabilityCheckContainer] ❌ Error testing pricing API:`, error);
      }
    };
    
    testPricingAPI();
  }, []);

  // Load unavailable dates on mount
  useEffect(() => {
    const loadUnavailableDates = async () => {
      try {
        console.log(`[AvailabilityCheckContainer] Loading initial unavailable dates for ${property.slug}`);
        const { getUnavailableDatesForProperty } = await import('@/services/availabilityService');
        const dates = await getUnavailableDatesForProperty(property.slug);
        console.log(`[AvailabilityCheckContainer] Loaded ${dates.length} unavailable dates on init`);

        // Log some example dates to verify format
        if (dates.length > 0) {
          const sampleDates = dates.slice(0, 3);
          console.log('[AvailabilityCheckContainer] Sample unavailable dates:',
            sampleDates.map(d => d instanceof Date ? d.toISOString() : String(d))
          );

          // Check if all dates are valid Date objects and normalize them
          const validDates = dates
            .filter(d => d instanceof Date && !isNaN(d.getTime()))
            .map(d => {
              // Create a new date object with time set to midnight for consistent comparison
              return new Date(d.getFullYear(), d.getMonth(), d.getDate());
            });

          console.log(`[AvailabilityCheckContainer] Valid date objects: ${validDates.length} out of ${dates.length}`);

          // Set the normalized dates to state
          setUnavailableDates(validDates);
        } else {
          setUnavailableDates([]);
        }
      } catch (error) {
        console.error(`[AvailabilityCheckContainer] Error loading initial unavailable dates:`, error);
      } finally {
        setIsLoadingInitialData(false);
        setHasMounted(true);
      }
    };

    loadUnavailableDates();
  }, [property.slug]);

  // Log each render for debugging
  useEffect(() => {
    renderCountRef.current += 1;
    console.log(`[AvailabilityCheckContainer] Render #${renderCountRef.current} with property: ${property.slug}`);

    return () => {
      console.log(`[AvailabilityCheckContainer] Component will unmount`);
    };
  });

  // Optimized availability check using pre-loaded unavailable dates
  const handleCheckAvailability = async () => {
    if (!checkInDate || !checkOutDate) return;

    setIsCheckingAvailability(true);

    try {
      console.log(`[AvailabilityCheckContainer] Checking availability for dates: ${checkInDate.toDateString()} to ${checkOutDate.toDateString()}`);

      // Use already loaded unavailable dates
      console.log(`[AvailabilityCheckContainer] Using ${unavailableDates.length} pre-loaded unavailable dates`);

      // Check if any of the selected dates are unavailable
      let conflict = false;
      let current = new Date(checkInDate.getTime());

      // Check day by day
      while (current < checkOutDate) {
        const currentDateStr = format(startOfDay(current), 'yyyy-MM-dd');

        // Check if this date is in the unavailableDates array
        if (unavailableDates.some(d => format(startOfDay(d), 'yyyy-MM-dd') === currentDateStr)) {
          console.log(`[AvailabilityCheckContainer] Conflict found on ${currentDateStr}`);
          conflict = true;
          break;
        }

        // Move to the next day
        current.setDate(current.getDate() + 1);
      }

      console.log(`[AvailabilityCheckContainer] Availability result: ${!conflict ? 'Available' : 'Not Available'}`);
      setIsAvailable(!conflict);
      setWasChecked(true);
    } catch (error) {
      console.error('[AvailabilityCheckContainer] Error checking availability:', error);
      // In case of error, assume not available for safety
      setIsAvailable(false);
      setWasChecked(true);
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  // Optimized method that updates dates and immediately checks availability
  const selectAndCheckDates = async (newCheckIn: Date, newCheckOut: Date) => {
    console.log(`[AvailabilityCheckContainer] Setting new dates: ${newCheckIn.toDateString()} - ${newCheckOut.toDateString()}`);

    // First update the dates
    setCheckInDate(newCheckIn);
    setCheckOutDate(newCheckOut);

    // Reset the availability check status
    setWasChecked(false);
    setIsAvailable(null);

    // Perform availability check immediately using the new dates
    setIsCheckingAvailability(true);

    try {
      console.log(`[AvailabilityCheckContainer] Checking availability for new dates: ${newCheckIn.toDateString()} to ${newCheckOut.toDateString()}`);
      console.log(`[AvailabilityCheckContainer] Using ${unavailableDates.length} pre-loaded unavailable dates`);

      // Check if any of the selected dates are unavailable
      let conflict = false;
      let current = new Date(newCheckIn.getTime());

      // Check day by day
      while (current < newCheckOut) {
        const currentDateStr = format(startOfDay(current), 'yyyy-MM-dd');

        // Check if this date is in the unavailableDates array
        if (unavailableDates.some(d => format(startOfDay(d), 'yyyy-MM-dd') === currentDateStr)) {
          console.log(`[AvailabilityCheckContainer] Conflict found on date: ${currentDateStr}`);
          conflict = true;
          break;
        }

        // Move to the next day
        current.setDate(current.getDate() + 1);
      }

      console.log(`[AvailabilityCheckContainer] Availability result: ${!conflict ? 'Available' : 'Not Available'}`);
      setIsAvailable(!conflict);
      setWasChecked(true);
    } catch (error) {
      console.error('[AvailabilityCheckContainer] Error checking availability:', error);
      // In case of error, assume not available for safety
      setIsAvailable(false);
      setWasChecked(true);
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  if (!hasMounted || isLoadingInitialData) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
        <p className="text-muted-foreground">
          {isLoadingInitialData ? 'Loading availability data...' : 'Loading booking options...'}
        </p>
      </div>
    );
  }


  // Handle form submissions
  const onInquirySubmit = async (values: any) => {
    setFormError(null);
    if (!checkInDate || !checkOutDate) {
      setFormError("Please select valid check-in and check-out dates.");
      toast({
        title: "Missing Dates",
        description: "Please select check-in and check-out dates for your inquiry.",
        variant: "destructive"
      });
      return;
    }

    startTransition(async () => {
      const inquiryInput = {
        propertySlug: property.slug,
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
        guestCount: guestCount, // Use our local state
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
        setSelectedOption(null);
      }
    });
  };

  const handleHoldDates = async (selectedCurrency: string, formData?: any) => {
    setFormError(null);

    // Client-side validation
    if (!checkInDate || !checkOutDate || !property.holdFeeAmount) {
      setFormError("Please select valid dates. Hold fee must be configured for this property.");
      toast({
        title: "Missing Information",
        description: "Please select valid dates. This property requires a hold fee.",
        variant: "destructive",
      });
      return;
    }
    
    // Ensure dynamic pricing data is available
    if (!dynamicPricingDetails) {
      setFormError(pricingError || "Pricing information is unavailable. Please try again later.");
      toast({
        title: "Hold Not Available",
        description: pricingError || "We cannot process your hold request without valid pricing. Please try again later.",
        variant: "destructive",
      });
      return;
    }

    if (!firstName || !lastName || !email) { // Phone is optional for hold
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
      // Use the form data directly if provided, otherwise use context values
      const guestInfo = formData || {
        firstName,
        lastName,
        email,
        phone
      };

      // Prepare hold booking input
      const holdBookingInput = {
        propertySlug: property.slug,
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
        guestCount: guestCount, // Use our local state
        guestInfo,
        holdFeeAmount: property.holdFeeAmount,
        selectedCurrency: selectedCurrency,
      };

      // Create hold booking in database
      const holdBookingResult = await createHoldBookingAction(holdBookingInput);

      // Handle errors from hold booking creation
      if (holdBookingResult.error || !holdBookingResult.bookingId) {
        const errorMsg = holdBookingResult.error || "Could not create hold booking";

        toast({
          title: "Hold Booking Error",
          description: errorMsg,
          variant: "destructive",
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
        guestEmail: email,
        selectedCurrency: selectedCurrency as any,
      };

      // Create checkout session
      const stripeHoldResult = await createHoldCheckoutSession(holdCheckoutInput);

      // Handle errors from checkout session creation
      if (stripeHoldResult.error || !stripeHoldResult.sessionUrl) {
        const errorMsg = stripeHoldResult.error || "Payment processing error";

        toast({
          title: "Payment Error",
          description: errorMsg,
          variant: "destructive",
        });

        setFormError(errorMsg);
        return;
      }

      // Redirect to Stripe checkout
      router.push(stripeHoldResult.sessionUrl);

    } catch (error) {
      // Handle unexpected errors
      console.error("Error processing hold dates:", error);
      const errorMessage = error instanceof Error ? error.message : "Something went wrong while trying to hold these dates. Please try again.";

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

  const handleContinueToPayment = async () => {
    setFormError(null);

    // Client-side validation
    if (!checkInDate || !checkOutDate) {
      setFormError("Please select valid dates for your booking.");
      toast({
        title: "Missing Information",
        description: "Please select valid dates for your booking.",
        variant: "destructive",
      });
      return;
    }
    
    // Ensure dynamic pricing data is available
    if (!dynamicPricingDetails) {
      setFormError(pricingError || "Pricing information is unavailable. Please try again later.");
      toast({
        title: "Pricing Information Unavailable",
        description: pricingError || "We cannot process your booking without valid pricing. Please try again later.",
        variant: "destructive",
      });
      return;
    }

    if (!firstName || !lastName || !email || !phone) {
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
      // Create the booking input with dynamic pricing data
      // At this point we've already validated that dynamicPricingDetails exists
      if (!dynamicPricingDetails) {
        throw new Error("Cannot create booking without pricing information");
      }
      
      const bookingInput = {
        propertyId: property.slug,
        guestInfo: {
          firstName,
          lastName,
          email,
          phone
        },
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
        numberOfGuests: guestCount, // Use our local state
        pricing: {
          // Use dynamic pricing data
          baseRate: property.pricePerNight,
          accommodationTotal: dynamicPricingDetails.accommodationTotal,
          cleaningFee: dynamicPricingDetails.cleaningFee,
          // Set extra guest fee info (may be included in accommodationTotal already)
          extraGuestFee: Math.max(0, guestCount - (property.baseOccupancy || 1)) * (property.extraGuestFee || 0) * numberOfNights,
          numberOfExtraGuests: Math.max(0, guestCount - (property.baseOccupancy || 1)),
          // Required fields with values from dynamic pricing
          subtotal: dynamicPricingDetails.subtotal,
          discountAmount: (dynamicPricingDetails.couponDiscount?.discountAmount || 0),
          total: dynamicPricingDetails.total,
          currency: dynamicPricingDetails.currency || selectedCurrency as any,
          numberOfNights: numberOfNights,
          // Include daily rates if available
          dailyRates: dynamicPricingDetails.dailyRates,
          useDynamicPricing: true,
          pricingSource: "priceCalendar"
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
        numberOfGuests: guestCount, // Use our local state
        totalPrice: bookingInput.pricing.total,
        numberOfNights: numberOfNights,
        appliedCouponCode: appliedCoupon?.code,
        discountPercentage: appliedCoupon?.discountPercentage,
        guestFirstName: firstName,
        guestLastName: lastName,
        guestEmail: email,
        pendingBookingId: bookingId,
        selectedCurrency: selectedCurrency as any,
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

  return (
    <div className="max-w-2xl mx-auto w-full px-4 md:px-0">
      {/* Debug indicator that code is up-to-date */}
      <div className="text-xs p-1 mb-2 bg-green-50 text-green-700 rounded text-center">
        Updated Booking Component v1.2 - Using Dynamic Price Calendar
      </div>

      {/* Tools container with availability preview */}
      <div className="flex justify-end mb-3">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-1 text-xs">
              <CalendarDays className="h-3.5 w-3.5" />
              Check More Dates
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl w-[90vw]">
            <AvailabilityPreview propertySlug={property.slug} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Use our refactored component with custom date picker */}
      <RefactoredAvailabilityCheck
        property={property}
        initialCheckIn={initialCheckIn}
        initialCheckOut={initialCheckOut}
        preloadedUnavailableDates={unavailableDates}
        onAvailabilityChecked={(isAvailable) => {
          console.log(`[AvailabilityCheckContainer] Received availability result: ${isAvailable}`);
          setIsAvailable(isAvailable);
          setWasChecked(true);
        }}
      />

      {/* Guest Count Selector */}
      <div className="mb-6 p-4 border border-gray-200 bg-white rounded-md">
        <Label className="mb-1 block text-sm font-medium">Number of Guests</Label>
        <div className="flex items-center justify-between rounded-md border p-2 h-10 w-full md:w-48 bg-white">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              console.log(`[AvailabilityCheckContainer] 🔽 Decrease guest button clicked: ${guestCount} -> ${guestCount - 1}`);
              if (guestCount > 1) {
                // Directly update context and local state
                const newCount = guestCount - 1;
                console.log(`[AvailabilityCheckContainer] ✅ Updating guest count: ${guestCount} -> ${newCount}`);

                // First, update the local state
                setGuestCount(newCount);

                // Then update the global context
                setNumberOfGuests(newCount);

                // EXPLICITLY CALCULATE PRICES after updating guest count
                console.log(`[AvailabilityCheckContainer] 💰 EXPLICITLY calculating price for ${newCount} guests`);
                if (checkInDate && checkOutDate && numberOfNights > 0 && property) {
                  const recalculatedPrice = calculatePrice(
                    property.pricePerNight,
                    numberOfNights,
                    property.cleaningFee ?? 0,
                    newCount, // Use our updated guest count
                    property.baseOccupancy || 1,
                    property.extraGuestFee ?? 0,
                    propertyBaseCcy,
                    appliedCoupon?.discountPercentage
                  );

                  console.log(`[AvailabilityCheckContainer] 💰 RECALCULATED price details:`, {
                    basePrice: recalculatedPrice.basePrice,
                    extraGuestFee: recalculatedPrice.extraGuestFeeTotal,
                    cleaningFee: recalculatedPrice.cleaningFee,
                    subtotal: recalculatedPrice.subtotal,
                    total: recalculatedPrice.total,
                    currency: recalculatedPrice.currency,
                    numberOfGuests: newCount,
                    extraGuests: recalculatedPrice.numberOfExtraGuests
                  });
                } else {
                  console.log(`[AvailabilityCheckContainer] 💰 Cannot recalculate price - missing required inputs`);
                }
              }
            }}
            disabled={guestCount <= 1 || isCheckingAvailability}
            aria-label="Decrease guests"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="mx-4 font-medium w-8 text-center" id="guests">
            {guestCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              console.log(`[AvailabilityCheckContainer] 🔼 Increase guest button clicked: ${guestCount} -> ${guestCount + 1}`);
              if (guestCount < property.maxGuests) {
                // Directly update context and local state
                const newCount = guestCount + 1;
                console.log(`[AvailabilityCheckContainer] ✅ Updating guest count: ${guestCount} -> ${newCount}`);

                // First, update the local state
                setGuestCount(newCount);

                // Then update the global context
                setNumberOfGuests(newCount);

                // EXPLICITLY CALCULATE PRICES after updating guest count
                console.log(`[AvailabilityCheckContainer] 💰 EXPLICITLY calculating price for ${newCount} guests`);
                if (checkInDate && checkOutDate && numberOfNights > 0 && property) {
                  const recalculatedPrice = calculatePrice(
                    property.pricePerNight,
                    numberOfNights,
                    property.cleaningFee ?? 0,
                    newCount, // Use our updated guest count
                    property.baseOccupancy || 1,
                    property.extraGuestFee ?? 0,
                    propertyBaseCcy,
                    appliedCoupon?.discountPercentage
                  );

                  console.log(`[AvailabilityCheckContainer] 💰 RECALCULATED price details:`, {
                    basePrice: recalculatedPrice.basePrice,
                    extraGuestFee: recalculatedPrice.extraGuestFeeTotal,
                    cleaningFee: recalculatedPrice.cleaningFee,
                    subtotal: recalculatedPrice.subtotal,
                    total: recalculatedPrice.total,
                    currency: recalculatedPrice.currency,
                    numberOfGuests: newCount,
                    extraGuests: recalculatedPrice.numberOfExtraGuests
                  });
                } else {
                  console.log(`[AvailabilityCheckContainer] 💰 Cannot recalculate price - missing required inputs`);
                }
              }
            }}
            disabled={guestCount >= property.maxGuests || isCheckingAvailability}
            aria-label="Increase guests"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Max {property.maxGuests}
        </p>
      </div>

      {/* Booking options and forms section */}
      {wasChecked && (
        <div className="mt-8 space-y-6">
          {isAvailable ? (
            // Available Dates: Show all booking options
            <>
              {/* Pricing summary */}
              {/* Force a fresh render of BookingSummary whenever key props change, including a timestamp */}
              <div key={`booking-summary-container-${guestCount}-${numberOfNights}-${selectedCurrency}-${Date.now()}`}>
                {dynamicPricingDetails ? (
                  <BookingSummary
                    numberOfNights={numberOfNights}
                    numberOfGuests={guestCount}
                    pricingDetails={null}
                    propertyBaseCcy={propertyBaseCcy}
                    appliedCoupon={appliedCoupon}
                    dynamicPricing={dynamicPricingDetails} // Pass dynamic pricing if available
                  />
                ) : (
                  <div className="p-4 border border-orange-200 bg-orange-50 rounded text-orange-800">
                    <p className="text-sm font-medium">
                      {pricingError || "Retrieving pricing information..."}
                    </p>
                    {pricingError && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2 text-xs"
                        onClick={() => {
                          // Recheck availability which will trigger a new pricing fetch
                          handleCheckAvailability();
                        }}
                      >
                        Retry
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Booking options - only show if we have valid pricing */}
              {dynamicPricingDetails ? (
                <BookingOptionsCards
                  selectedOption={selectedOption}
                  onSelectOption={setSelectedOption}
                  property={property}
                />
              ) : null}

              {/* Contact host form */}
              {selectedOption === 'contact' && (
                <ContactHostForm
                  onSubmit={onInquirySubmit}
                  isProcessing={isProcessingBooking}
                  isPending={isPending}
                  pricingDetails={pricingDetailsInBaseCurrency}
                  selectedCurrency={selectedCurrency}
                />
              )}

              {/* Hold form */}
              {selectedOption === 'hold' && (
                <HoldForm
                  property={property}
                  isProcessing={isProcessingBooking}
                  isPending={isPending}
                  formError={formError}
                  pricingDetails={pricingDetailsInBaseCurrency}
                  selectedCurrency={selectedCurrency}
                  onSubmit={handleHoldDates}
                />
              )}

              {/* Book now form */}
              {selectedOption === 'bookNow' && (
                <BookingForm
                  property={property}
                  isProcessing={isProcessingBooking}
                  isPending={isPending}
                  formError={formError}
                  lastErrorType={lastErrorType}
                  canRetryError={canRetryError}
                  pricingDetails={pricingDetailsInBaseCurrency}
                  appliedCoupon={appliedCoupon}
                  setAppliedCoupon={setAppliedCoupon}
                  selectedCurrency={selectedCurrency}
                  onSubmit={handleContinueToPayment}
                />
              )}
            </>
          ) : (
            <UnavailableDatesView
              checkInDate={checkInDate}
              checkOutDate={checkOutDate}
              numberOfNights={numberOfNights}
              selectedOption={selectedOption}
              setSelectedOption={setSelectedOption}
              onInquirySubmit={onInquirySubmit}
              isProcessingBooking={isProcessingBooking || isCheckingAvailability}
              isPending={isPending}
              selectAndCheckDates={selectAndCheckDates}
              selectedCurrency={selectedCurrency}
            />
          )}
        </div>
      )}
    </div>
  );
}

export { AvailabilityCheckContainer };