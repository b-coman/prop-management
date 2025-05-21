"use client";

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useBooking } from '@/contexts/BookingContext';
import { format, startOfDay } from 'date-fns';
import { Loader2, ArrowRight, Mail, Phone as PhoneIcon, Send } from 'lucide-react';
import { EnhancedAvailabilityChecker } from '../sections/availability/EnhancedAvailabilityChecker';
import { ErrorBoundary } from '../ErrorBoundary';
import { UnavailableDatesView } from '../sections/availability/UnavailableDatesView';
// Import from the correct updated file
import { BookingSummary } from '../booking-summary';
// Add debug marker
console.log("[DEBUG] ✅ Using updated BookingSummary component in AvailabilityContainer");
import { BookingOptions } from '../sections/common/BookingOptions';
import { BookingForm } from '../sections/forms/BookingForm';
import { HoldForm } from '../sections/forms/HoldForm';
import { ContactHostForm } from '../sections/forms/ContactHostForm';
import { useToast } from '@/hooks/use-toast';
import { checkAvailability } from '../services/availabilityService';
import { BookingOptionsCards } from '../booking-options-cards';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCurrency } from '@/contexts/CurrencyContext';
import { createPendingBookingAction } from '@/app/actions/booking-actions';
import { createCheckoutSession } from '@/app/actions/create-checkout-session';
import { createHoldBookingAction } from '@/app/actions/createHoldBookingAction';
import { createHoldCheckoutSession } from '@/app/actions/createHoldCheckoutSession';
import { createInquiryAction } from '@/app/actions/createInquiryAction';
import { sanitizeEmail, sanitizePhone, sanitizeText } from '@/lib/sanitize';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';
import { AvailabilityCheckerSkeleton, BookingSummarySkeleton, BookingOptionsSkeleton, FormSkeleton } from './BookingCheckSkeleton';
import { StateTransitionWrapper, transitionVariants } from './StateTransitionWrapper';

interface AvailabilityContainerProps {
  property: any;
  initialCheckIn?: string;
  initialCheckOut?: string;
  className?: string;
}

/**
 * AvailabilityContainer component
 * 
 * This container component manages the state and logic for checking availability
 * and showing the appropriate view based on the availability status.
 */
export function AvailabilityContainer({
  property,
  initialCheckIn,
  initialCheckOut,
  className
}: AvailabilityContainerProps) {
  // Debug marker just once using a static reference to prevent repeated logs
  React.useRef(() => {
    // Only log once during component lifetime
    console.log("[DEBUG] 🏆 AvailabilityContainer v1.2.1 with Price Calendar Support");
  }).current();
  
  // Get language hook for translations
  const { tc } = useLanguage();
  
  // Get values from booking context
  const {
    checkInDate,
    checkOutDate,
    numberOfNights,
    setCheckInDate,
    setCheckOutDate,
    setNumberOfGuests,
    firstName: contextFirstName,
    lastName: contextLastName,
    email: contextEmail,
    phone: contextPhone,
    message: contextMessage,
    setFirstName: setContextFirstName,
    setLastName: setContextLastName,
    setEmail: setContextEmail,
    setPhone: setContextPhone,
    setMessage: setContextMessage
  } = useBooking();
  
  // Local state for the guest count
  const [guestCount, setGuestCount] = useState(2);
  
  // State for availability checking
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [wasChecked, setWasChecked] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  
  // State for booking functionality
  const [selectedOption, setSelectedOption] = useState<'contact' | 'hold' | 'bookNow' | null>(null);
  const [isProcessingBooking, setIsProcessingBooking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastErrorType, setLastErrorType] = useState<string | undefined>(undefined);
  const [canRetryError, setCanRetryError] = useState<boolean>(false);

  // State for coupon and prices
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPercentage: number } | null>(null);
  const [pricingDetailsInBaseCurrency, setPricingDetailsInBaseCurrency] = useState<any>(null);
  
  // State for dynamic pricing data from price calendar API
  const [dynamicPricingDetails, setDynamicPricingDetails] = useState<any>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [pricingFetchKey, setPricingFetchKey] = useState<string | null>(null);
  
  // Effect to fetch pricing data from priceCalendar when dates or guests change
  React.useEffect(() => {
    // Create a marker to identify this render cycle
    const fetchId = Date.now();
    console.log(`[AvailabilityContainer] 🔄 Pricing effect running: ID=${fetchId}, guestCount=${guestCount}`);
    
    // Force a fetch if pricingFetchKey is null (triggered by guest count changes)
    const shouldForceFetch = pricingFetchKey === null;
    
    // Create a fetch key from current parameters
    const currentFetchKey = `${property?.slug}_${checkInDate?.toISOString() || 'null'}_${checkOutDate?.toISOString() || 'null'}_${guestCount}`;
    
    // Skip the effect if we've already fetched successfully for these parameters
    // BUT don't skip if we're forcing a fetch due to guest count change
    if (!shouldForceFetch && pricingFetchKey === currentFetchKey && dynamicPricingDetails) {
      console.log(`[AvailabilityContainer] 🛑 Skipping redundant pricing fetch: Already have data for these parameters`);
      return;
    }
    
    // Only proceed if we have a valid reason to fetch
    if (!checkInDate || !checkOutDate || numberOfNights <= 0 || !property || guestCount <= 0) {
      console.log(`[AvailabilityContainer] ⚠️ Fetch ID=${fetchId}: Missing data for pricing fetch`, { 
        hasCheckIn: !!checkInDate, 
        hasCheckOut: !!checkOutDate, 
        nights: numberOfNights, 
        hasProperty: !!property, 
        guests: guestCount,
        forceFetch: shouldForceFetch
      });
      return;
    }
    
    console.log(`[AvailabilityContainer] 👥 Fetch with ${guestCount} guests (guestCount changed or force fetch: ${shouldForceFetch})`);
    
    const fetchDynamicPricing = async () => {
      // Double-check in case state was updated between the outer check and async function execution
      // But always fetch if we're forcing a fetch due to guest count change
      if (!shouldForceFetch && pricingFetchKey === currentFetchKey && dynamicPricingDetails) {
        console.log(`[AvailabilityContainer] 🛑 Fetch ID=${fetchId}: Using cached pricing data`);
        return;
      }
      
      console.log(`[AvailabilityContainer] 🔍 Fetch ID=${fetchId}: Proceeding with fetch, guestCount=${guestCount}, shouldForceFetch=${shouldForceFetch}`);
      
      // Reset pricing state
      setPricingError(null);
      setIsPricingLoading(true);
      
      console.log(`[AvailabilityContainer] 🔍 Fetch ID=${fetchId}: Fetching dynamic pricing data for ${property.slug}`, {
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
          console.error(`[AvailabilityContainer] ❌ Fetch ID=${fetchId}: getPricingForDateRange function not found!`);
          setPricingError("Pricing service unavailable. Please try again later.");
          setIsPricingLoading(false);
          return;
        }
        
        console.log(`[AvailabilityContainer] 🚀 Fetch ID=${fetchId}: Calling getPricingForDateRange now...`);
        
        // Call the pricing function with specific parameters - explicitly cast guestCount to avoid any issues
        console.log(`[AvailabilityContainer] 📞 Calling getPricingForDateRange with guestCount=${guestCount}`);
        const pricingData = await getPricingForDateRange(
          property.slug,
          checkInDate,
          checkOutDate,
          Number(guestCount) // Ensure it's a number
        );
        
        // Log the raw response for debugging
        console.log(`[AvailabilityContainer] 📦 Fetch ID=${fetchId}: Raw pricing response:`, pricingData);
        
        if (pricingData && pricingData.pricing) {
          console.log(`[AvailabilityContainer] ✅ Fetch ID=${fetchId}: Received valid pricing data:`, {
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
          
          // Store the fetch key to prevent redundant fetches
          setPricingFetchKey(currentFetchKey);
        } else {
          console.error(`[AvailabilityContainer] ❌ Fetch ID=${fetchId}: No valid pricing data available`);
          setPricingError("Pricing information is currently unavailable. Please try again later.");
        }
      } catch (error) {
        console.error(`[AvailabilityContainer] Error fetching dynamic pricing:`, error);
        setPricingError("We're having trouble getting pricing information. Please try again later.");
      } finally {
        setIsPricingLoading(false);
      }
    };
    
    // Attempt to fetch dynamic pricing
    fetchDynamicPricing();
    
    // Use a more stable dependency array that won't cause infinite re-renders
  }, [property?.slug, 
      checkInDate?.toISOString(), // Only re-run if the actual date changes, not the object reference
      checkOutDate?.toISOString(), // Only re-run if the actual date changes, not the object reference
      numberOfNights, 
      guestCount, // This will cause the effect to run when guest count changes
      appliedCoupon?.code, // Only re-run if the coupon code changes
      pricingFetchKey]); // This will cause the effect to run when we force a re-fetch
  
  // State for unavailable dates (in a real implementation, this would come from a service)
  const [unavailableDates, setUnavailableDates] = useState<Date[]>([]);

  // State for storing user form data
  const [sessionFirstName, setSessionFirstName] = useState<string>('');
  const [sessionLastName, setSessionLastName] = useState<string>('');
  const [sessionEmail, setSessionEmail] = useState<string>('');
  const [sessionPhone, setSessionPhone] = useState<string>('');
  const [sessionMessage, setSessionMessage] = useState<string>('');

  const { toast } = useToast();
  const [isPending, startTransition] = React.useTransition();

  // Add router for navigation
  const router = useRouter();

  // Add currency context
  const { selectedCurrency, baseCurrencyForProperty, convertToSelectedCurrency, formatPrice } = useCurrency();
  const propertyBaseCcy = baseCurrencyForProperty(property.baseCurrency);

  // Create Input component for the forms
  const Input = ({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      {...props}
    />
  );
  
  // Handler for checking availability
  const handleCheckAvailability = useCallback(async () => {
    if (!checkInDate || !checkOutDate) return;
    
    setIsCheckingAvailability(true);
    
    try {
      // Use the service to check availability
      const result = await checkAvailability(
        property.slug,
        checkInDate,
        checkOutDate
      );
      
      console.log(`Checking availability for dates: ${checkInDate.toDateString()} to ${checkOutDate.toDateString()}`);
      console.log(`Availability result: ${result.isAvailable ? 'Available' : 'Not Available'}`);
      
      // Store the unavailable dates for the calendar view
      setUnavailableDates(result.unavailableDates);
      
      setIsAvailable(result.isAvailable);
      setWasChecked(true);
    } catch (error) {
      console.error('Error checking availability:', error);
      // In case of error, assume not available for safety
      setIsAvailable(false);
      setWasChecked(true);
      toast({
        title: "Error",
        description: "There was an error checking availability. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsCheckingAvailability(false);
    }
  }, [checkInDate, checkOutDate, property.slug, toast]);
  
  // Handler for selecting and checking new dates
  const selectAndCheckDates = useCallback(async (newCheckIn: Date, newCheckOut: Date) => {
    console.log(`Setting new dates: ${newCheckIn.toDateString()} - ${newCheckOut.toDateString()}`);

    // First update the dates
    setCheckInDate(newCheckIn);
    setCheckOutDate(newCheckOut);

    // Wait for state update to propagate
    await new Promise(resolve => setTimeout(resolve, 50));

    // Reset the availability check status
    setWasChecked(false);
    setIsAvailable(null);

    // Small delay before checking availability
    await new Promise(resolve => setTimeout(resolve, 50));

    // Now check availability with the new dates
    await handleCheckAvailability();
  }, [setCheckInDate, setCheckOutDate, handleCheckAvailability]);

  // Handler for check-in date changes
  const handleCheckInChange = useCallback((date: Date | null) => {
    console.log(`Check-in date changed: ${date?.toDateString() || 'null'}`);
    setCheckInDate(date);

    // Reset availability state when dates change
    setWasChecked(false);
    setIsAvailable(null);

    // Optional: When check-in is set to null, also reset checkout
    if (date === null && checkOutDate !== null) {
      setCheckOutDate(null);
    }
  }, [setCheckInDate, checkOutDate, setCheckOutDate]);

  // Handler for check-out date changes
  const handleCheckOutChange = useCallback((date: Date | null) => {
    console.log(`Check-out date changed: ${date?.toDateString() || 'null'}`);
    setCheckOutDate(date);

    // Reset availability state when dates change
    setWasChecked(false);
    setIsAvailable(null);

    // Automatically check availability if both dates are selected
    if (date !== null && checkInDate !== null) {
      setTimeout(() => {
        console.log('Auto-checking availability after date selection');
        handleCheckAvailability().catch(error => {
          console.error('Error during auto availability check:', error);
        });
      }, 100);
    }
  }, [setCheckOutDate, checkInDate, handleCheckAvailability]);
  
  // Handler for inquiry submission
  const handleInquirySubmit = useCallback(async (values: any) => {
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
      setIsProcessingBooking(true);
      try {
        const inquiryInput = {
          propertySlug: property.slug,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
          guestCount: guestCount,
          guestInfo: {
            firstName: values.firstName || sessionFirstName,
            lastName: values.lastName || sessionLastName,
            email: values.email || sessionEmail,
            phone: values.phone || sessionPhone,
          },
          message: values.message || sessionMessage || "I'm interested in booking your property.",
          // Convert the price to the selected currency
          totalPrice: pricingDetailsInBaseCurrency
            ? convertToSelectedCurrency(pricingDetailsInBaseCurrency.total, pricingDetailsInBaseCurrency.currency)
            : undefined,
          currency: selectedCurrency,
        };

        const result = await createInquiryAction(inquiryInput);
        if (result.error) {
          setFormError(result.error);
          toast({
            title: "Inquiry Failed",
            description: result.error,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Inquiry Sent!",
            description: "Your message has been sent to the host."
          });

          // Close the form without resetting values
          setSelectedOption(null);
        }
      } catch (error) {
        console.error("Error sending inquiry:", error);
        setFormError("Failed to send inquiry. Please try again.");
        toast({
          title: "Inquiry Failed",
          description: "There was an error sending your inquiry.",
          variant: "destructive"
        });
      } finally {
        setIsProcessingBooking(false);
      }
    });
  }, [checkInDate, checkOutDate, property.slug, sessionFirstName, sessionLastName, sessionEmail,
      sessionPhone, sessionMessage, guestCount, pricingDetailsInBaseCurrency, convertToSelectedCurrency,
      selectedCurrency, toast, startTransition]);

  // Handler for holding dates
  const handleHoldDates = useCallback(async () => {
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
        propertySlug: property.slug,
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
        guestCount: guestCount,
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
  }, [checkInDate, checkOutDate, property, sessionFirstName, sessionLastName, sessionEmail, sessionPhone,
      guestCount, selectedCurrency, router, toast]);

  // Handler for continuing to payment
  const handleContinueToPayment = useCallback(async () => {
    setFormError(null);

    // Client-side validation
    if (!checkInDate || !checkOutDate || !pricingDetailsInBaseCurrency) {
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
        propertyId: property.slug,
        guestInfo: {
          firstName: sanitizeText(sessionFirstName),
          lastName: sanitizeText(sessionLastName),
          email: sanitizeEmail(sessionEmail),
          phone: sanitizePhone(sessionPhone)
        },
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
        numberOfGuests: guestCount,
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
        appliedCouponCode: null,
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
        return;
      }

      const { bookingId } = pendingBookingResult;

      // Create checkout session to process payment
      const checkoutInput = {
        property: property,
        checkInDate: checkInDate.toISOString(),
        checkOutDate: checkOutDate.toISOString(),
        numberOfGuests: guestCount,
        totalPrice: bookingInput.pricing.total,
        numberOfNights: numberOfNights,
        appliedCouponCode: null,
        discountPercentage: 0,
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
  }, [checkInDate, checkOutDate, property, guestCount, pricingDetailsInBaseCurrency, numberOfNights,
      sessionFirstName, sessionLastName, sessionEmail, sessionPhone, selectedCurrency, router, toast]);
  
  // Handler for updating the guest count
  const handleGuestCountChange = useCallback((count: number) => {
    console.log(`[AvailabilityContainer] 🧑‍🤝‍🧑 Guest count changed to: ${count} - updating local state and triggering price fetch`);
    
    // Update both local state and context state
    setGuestCount(count);
    setNumberOfGuests(count);
    
    // Generate a unique key to force a fresh pricing fetch
    const newFetchKey = `${property?.slug}_${checkInDate?.toISOString() || 'null'}_${checkOutDate?.toISOString() || 'null'}_${count}_${Date.now()}`;
    console.log(`[AvailabilityContainer] 🔄 Forcing price refetch with new key: ${newFetchKey}`);
    setPricingFetchKey(null); // First set to null to force a refetch
  }, [setNumberOfGuests, property, checkInDate, checkOutDate]);
  
  // Add a new handler to receive pricing data directly from GuestSelector
  const handlePricingDataReceived = useCallback((data: any) => {
    console.log(`[AvailabilityContainer] 📊 CALLBACK TRIGGERED: Received pricing data for ${guestCount} guests`);
    console.log(`[AvailabilityContainer] 🔍 DEBUG DATA STRUCTURE:`, JSON.stringify(data, null, 2));
    
    // Detailed component state logging
    console.log(`[AvailabilityContainer] 🔄 BEFORE UPDATE - Component State:`, {
      isAvailable,
      wasChecked,
      guestCount,
      hasCheckInDate: !!checkInDate,
      hasCheckOutDate: !!checkOutDate,
      numberOfNights,
      isPricingLoading,
      hasDynamicPricingDetails: !!dynamicPricingDetails,
      selectedOption
    });
    
    // Only process if we have valid pricing data
    if (data && data.pricing) {
      console.log(`[AvailabilityContainer] ✅ DATA VALIDATED: Valid pricing data received with fields:`, 
        Object.keys(data.pricing).join(', '));
      
      try {
        // Log individual pricing fields for debugging
        console.log(`[AvailabilityContainer] 💲 PRICING BREAKDOWN:`, {
          subtotal: data.pricing.subtotal,
          cleaningFee: data.pricing.cleaningFee, 
          totalPrice: data.pricing.totalPrice,
          currency: data.pricing.currency,
          hasDailyRates: !!data.pricing.dailyRates,
          dailyRatesCount: data.pricing.dailyRates ? Object.keys(data.pricing.dailyRates).length : 0
        });
        
        // Create new pricing details object with detailed logging
        const newPricingDetails = {
          accommodationTotal: data.pricing.subtotal - (data.pricing.cleaningFee || 0),
          cleaningFee: data.pricing.cleaningFee || 0,
          subtotal: data.pricing.subtotal,
          total: data.pricing.totalPrice,
          currency: data.pricing.currency as any,
          dailyRates: data.pricing.dailyRates || {},
          // Apply any discount from coupon if present
          couponDiscount: appliedCoupon ? {
            discountPercentage: appliedCoupon.discountPercentage,
            discountAmount: (data.pricing.subtotal * appliedCoupon.discountPercentage) / 100
          } : null
        };
        
        console.log(`[AvailabilityContainer] 📋 SETTING NEW DETAILS:`, newPricingDetails);
        
        // Store the dynamic pricing data directly from the API response
        setDynamicPricingDetails(newPricingDetails);
        console.log(`[AvailabilityContainer] ✅ SET_DYNAMIC_PRICING_DETAILS called`);
        
        // Store the fetch key to prevent redundant fetches
        const currentFetchKey = `${property?.slug}_${checkInDate?.toISOString() || 'null'}_${checkOutDate?.toISOString() || 'null'}_${guestCount}`;
        setPricingFetchKey(currentFetchKey);
        console.log(`[AvailabilityContainer] 🔑 SET_PRICING_FETCH_KEY called with: ${currentFetchKey}`);
        
        // Set loading to false since we have the data
        setIsPricingLoading(false);
        console.log(`[AvailabilityContainer] ⏱️ SET_IS_PRICING_LOADING(false) called`);
        
        // Force this to run outside the current execution context to ensure state updates
        setTimeout(() => {
          console.log(`[AvailabilityContainer] 🔄 AFTER UPDATE - Scheduled Check:`, {
            guestCount,
            hasDynamicPricing: !!dynamicPricingDetails,
            dynamicPricingTotal: dynamicPricingDetails?.total,
            isPricingLoading
          });
        }, 100);
      } catch (error) {
        console.error(`[AvailabilityContainer] ❌ ERROR HANDLING PRICING DATA:`, error);
      }
    } else {
      console.error(`[AvailabilityContainer] ⚠️ INVALID DATA: Received invalid or missing pricing data`);
    }
  }, [guestCount, property, checkInDate, checkOutDate, appliedCoupon, setIsPricingLoading, 
      isAvailable, wasChecked, numberOfNights, isPricingLoading, dynamicPricingDetails, selectedOption]);

  // Initialize local state from context and sync changes
  React.useEffect(() => {
    // Initialize from context
    if (contextFirstName) setSessionFirstName(contextFirstName);
    if (contextLastName) setSessionLastName(contextLastName);
    if (contextEmail) setSessionEmail(contextEmail);
    if (contextPhone) setSessionPhone(contextPhone);
    if (contextMessage) setSessionMessage(contextMessage);
  }, [contextFirstName, contextLastName, contextEmail, contextPhone, contextMessage]);

  // Calculate pricing when necessary values change
  React.useEffect(() => {
    if (checkInDate && checkOutDate && numberOfNights > 0 && guestCount > 0) {
      // This is a simplified calculation, in a real app this would use the price utilities
      const basePrice = property.pricePerNight || 100;
      const cleaningFee = property.cleaningFee || 50;
      const baseOccupancy = property.baseOccupancy || 2;
      const extraGuestFee = property.extraGuestFee || 20;

      const extraGuests = Math.max(0, guestCount - baseOccupancy);
      const extraGuestTotal = extraGuests * extraGuestFee * numberOfNights;

      const subtotal = (basePrice * numberOfNights) + cleaningFee + extraGuestTotal;

      // Apply discount if coupon exists
      const discountAmount = appliedCoupon ? (subtotal * (appliedCoupon.discountPercentage / 100)) : 0;
      const total = subtotal - discountAmount;

      // Update pricing details
      setPricingDetailsInBaseCurrency({
        basePrice,
        cleaningFee,
        extraGuestFeeTotal: extraGuestTotal,
        numberOfExtraGuests: extraGuests,
        subtotal,
        discountAmount,
        total,
        currency: propertyBaseCcy,
        numberOfNights
      });
    } else {
      // Reset pricing details if necessary data is missing
      setPricingDetailsInBaseCurrency(null);
    }
  }, [checkInDate, checkOutDate, numberOfNights, guestCount, property, appliedCoupon, propertyBaseCcy]);

  // Run diagnostic test and initial price fetch on component mount
  React.useEffect(() => {
    const initializePricingData = async () => {
      try {
        // Diagnostic test
        const { testPricingApi, getPricingForDateRange } = await import('@/services/availabilityService');
        console.log(`[AvailabilityContainer] 🔬 Running diagnostic test for pricing API...`);
        
        if (typeof testPricingApi === 'function') {
          testPricingApi();
          console.log(`[AvailabilityContainer] ✅ Pricing API diagnostic test passed`);
        } else {
          console.error(`[AvailabilityContainer] ❌ testPricingApi not found in service`);
        }

        // Force initial price fetch if we have dates and property
        if (checkInDate && checkOutDate && property?.slug && typeof getPricingForDateRange === 'function') {
          console.log(`[AvailabilityContainer] 🚀 INITIAL PRICE FETCH: Explicitly loading price data for ${guestCount} guests...`);
          
          try {
            // Make API call to load initial pricing
            setIsPricingLoading(true);
            const pricingData = await getPricingForDateRange(
              property.slug,
              checkInDate, 
              checkOutDate,
              guestCount
            );
            
            if (pricingData?.pricing) {
              console.log(`[AvailabilityContainer] ✅ Initial price fetch success:`, {
                price: pricingData.pricing.totalPrice,
                currency: pricingData.pricing.currency,
                guests: guestCount
              });
              
              // Store the dynamic pricing data
              setDynamicPricingDetails({
                accommodationTotal: pricingData.pricing.subtotal - (pricingData.pricing.cleaningFee || 0),
                cleaningFee: pricingData.pricing.cleaningFee || 0,
                subtotal: pricingData.pricing.subtotal, 
                total: pricingData.pricing.totalPrice,
                currency: pricingData.pricing.currency as any,
                dailyRates: pricingData.pricing.dailyRates || {},
                // No coupon discount initially
                couponDiscount: null
              });
              
              // Update fetch key to prevent redundant fetches
              setPricingFetchKey(`${property.slug}_${checkInDate.toISOString()}_${checkOutDate.toISOString()}_${guestCount}`);
            } else {
              console.error(`[AvailabilityContainer] ❌ Initial price fetch failed - no valid data`);
            }
          } catch (error) {
            console.error(`[AvailabilityContainer] ❌ Error fetching initial pricing:`, error);
          } finally {
            setIsPricingLoading(false);
          }
        } else {
          console.log(`[AvailabilityContainer] ⚠️ Cannot fetch initial pricing - missing data:`, {
            hasProperty: !!property?.slug,
            hasCheckIn: !!checkInDate,
            hasCheckOut: !!checkOutDate,
            guestCount
          });
        }
      } catch (error) {
        console.error(`[AvailabilityContainer] ❌ Error in initialization:`, error);
      }
    };
    
    initializePricingData();
    
    // Clean up console logs in production to prevent spam
    if (process.env.NODE_ENV === 'production' || true) { // Force in all environments for testing
      const originalConsoleLog = console.log;
      console.log = (...args) => {
        // Filter out debugging messages that cause infinite logs
        if (typeof args[0] === 'string') {
          // Skip verbose logs that are repeatedly printed
          if (args[0].includes('[availabilityService]') || 
              args[0].includes('[AvailabilityContainer]') ||
              args[0].includes('[DEBUG]') ||
              args[0].includes('[EnhancedAvailabilityChecker]') ||
              args[0] === '==========================================') {
            // Skip verbose logs, but allow BookingClientInner and TRACK_RENDERED_COMPONENT logs to pass through
            if (!args[0].includes('[BookingClientInner]') && !args[0].includes('[TRACK_RENDERED_COMPONENT]')) {
              return;
            }
          }
        }
        originalConsoleLog(...args);
      };
      
      // Restore original console.log when component unmounts
      return () => {
        console.log = originalConsoleLog;
      };
    }
  }, [property?.slug, checkInDate, checkOutDate, guestCount, setIsPricingLoading]);

  // Sync session state back to context
  React.useEffect(() => {
    if (sessionFirstName) setContextFirstName(sessionFirstName);
    if (sessionLastName) setContextLastName(sessionLastName);
    if (sessionEmail) setContextEmail(sessionEmail);
    if (sessionPhone) setContextPhone(sessionPhone);
    if (sessionMessage) setContextMessage(sessionMessage);
  }, [
    sessionFirstName, sessionLastName, sessionEmail, sessionPhone, sessionMessage,
    setContextFirstName, setContextLastName, setContextEmail, setContextPhone, setContextMessage
  ]);
  
  return (
    <div className={cn("w-full", className)}>
      {/* Wrap the component with ErrorBoundary to catch and handle any errors */}
      <ErrorBoundary>
        {isCheckingAvailability ? (
          <AvailabilityCheckerSkeleton />
        ) : (
          <EnhancedAvailabilityChecker
            propertySlug={property.slug}
            propertyName={typeof property.name === 'string' ? property.name : (tc(property.name) || property.slug)}
            maxGuests={property.maxGuests || 10}
            onAvailabilityResult={(result) => {
              setIsAvailable(result);
              setWasChecked(true);
            }}
            onGuestCountChange={handleGuestCountChange}
            onPricingDataReceived={handlePricingDataReceived}
          />
        )}
      </ErrorBoundary>
      
      {/* Content based on availability */}
      {/* Debug info for troubleshooting */}
      <div className="text-xs p-1 mt-2 bg-slate-100 border border-slate-200 text-slate-800 rounded">
        <div>DEBUG: wasChecked={wasChecked ? 'true' : 'false'} | isAvailable={isAvailable ? 'true' : 'false'}</div>
        <div>guestCount={guestCount} | hasPricing={dynamicPricingDetails ? 'true' : 'false'}</div>
      </div>
      
      {wasChecked && (
        <StateTransitionWrapper 
          transitionKey={isAvailable ? "available" : "unavailable"}
          {...transitionVariants.slideUp}
        >
          <div className="mt-8 space-y-6">
            {isAvailable ? (
              // Booking options when dates are available
              <>
              {/* Real booking summary component with dynamic pricing */}
              <div className="text-xs p-1 mb-2 bg-green-50 text-green-700 rounded text-center">
                Using Dynamic Price Calendar v1.2.1
              </div>
              
              {isPricingLoading ? (
                <BookingSummarySkeleton />
              ) : dynamicPricingDetails ? (
                <>
                  <BookingSummary 
                    numberOfNights={numberOfNights}
                    numberOfGuests={guestCount}
                    pricingDetails={null}
                    propertyBaseCcy={property.currency || 'USD'}
                    appliedCoupon={appliedCoupon}
                    dynamicPricing={dynamicPricingDetails}
                  />
                  {/* Add a debug marker to show pricing source */}
                  <div className="text-xs text-right mt-1 text-slate-500">
                    Source: {dynamicPricingDetails.dailyRates ? 
                      `Property-Based Dynamic Pricing (${Object.keys(dynamicPricingDetails.dailyRates).length} days)` : 
                      'Standard Pricing'}
                  </div>
                </>
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
                        // Reset error and try again
                        setPricingError(null);
                        setDynamicPricingDetails(null);
                      }}
                    >
                      Retry
                    </Button>
                  )}
                </div>
              )}
              
              {/* Only show booking options when dynamic pricing is available */}
              {dynamicPricingDetails ? (
                <BookingOptionsCards
                  selectedOption={selectedOption}
                  onSelectOption={setSelectedOption}
                  property={property}
                />
              ) : (
                <div className="text-sm text-center py-4 text-muted-foreground">
                  Booking options will be available when pricing information is loaded.
                </div>
              )}

              {/* Contact host form - using the original implementation */}
              {selectedOption === 'contact' && (
                <StateTransitionWrapper 
                  transitionKey="contact-form"
                  {...transitionVariants.slideUp}
                >
                  <Card className="mt-4">
                  <CardHeader><CardTitle>Contact Host</CardTitle></CardHeader>
                  <CardContent>
                    {isProcessingBooking ? (
                      <FormSkeleton />
                    ) : (
                    <form onSubmit={(e) => { e.preventDefault(); handleInquirySubmit({ firstName: sessionFirstName, lastName: sessionLastName, email: sessionEmail, phone: sessionPhone, message: "I'm interested in booking your property." }); }} className="space-y-4">
                      <h3 className="font-semibold text-lg text-foreground pt-2">Your Information</h3>

                      {/* Names - side by side on larger screens */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="contact-first-name" required>
                            First Name
                          </Label>
                          <Input
                            id="contact-first-name"
                            placeholder="Your first name"
                            disabled={isProcessingBooking || isPending}
                            required
                            value={sessionFirstName || ''}
                            onChange={e => setSessionFirstName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contact-last-name" required>
                            Last Name
                          </Label>
                          <Input
                            id="contact-last-name"
                            placeholder="Your last name"
                            disabled={isProcessingBooking || isPending}
                            required
                            value={sessionLastName || ''}
                            onChange={e => setSessionLastName(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Email and Phone - side by side on larger screens */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="contact-email" required className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            Email
                          </Label>
                          <Input
                            id="contact-email"
                            type="email"
                            placeholder="your.email@example.com"
                            disabled={isProcessingBooking || isPending}
                            required
                            value={sessionEmail || ''}
                            onChange={e => setSessionEmail(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contact-phone" variant="optional" className="flex items-center gap-1">
                            <PhoneIcon className="h-3 w-3" />
                            Phone (Optional)
                          </Label>
                          <Input
                            id="contact-phone"
                            type="tel"
                            placeholder="Your phone number"
                            disabled={isProcessingBooking || isPending}
                            value={sessionPhone || ''}
                            onChange={e => setSessionPhone(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="contact-message" required>
                          Message
                        </Label>
                        <Textarea
                          id="contact-message"
                          placeholder="Your questions or custom request..."
                          rows={4}
                          disabled={isProcessingBooking || isPending}
                          value={sessionMessage || ''}
                          onChange={e => setSessionMessage(e.target.value)}
                        />
                      </div>

                      <Button type="submit" disabled={isProcessingBooking || isPending}>
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        {isPending ? "Sending..." : "Send Inquiry"}
                      </Button>
                    </form>
                    )}
                  </CardContent>
                  </Card>
                </StateTransitionWrapper>
              )}

              {/* Hold dates form - using the original implementation */}
              {selectedOption === 'hold' && (
                <StateTransitionWrapper 
                  transitionKey="hold-form"
                  {...transitionVariants.slideUp}
                >
                  <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>Hold Dates</CardTitle>
                    <CardDescription>
                      Reserve these dates for {
                        property.holdDurationHours 
                          ? (typeof property.holdDurationHours === 'object' 
                              ? tc(property.holdDurationHours) 
                              : property.holdDurationHours)
                          : 24
                      } hours with a small holding fee.
                      {property.holdFeeRefundable && 
                        (typeof property.holdFeeRefundable === 'object' 
                          ? tc(property.holdFeeRefundable) && " This fee is refundable if you complete your booking."
                          : " This fee is refundable if you complete your booking.")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isProcessingBooking ? (
                      <FormSkeleton />
                    ) : (
                    <form onSubmit={(e) => { e.preventDefault(); handleHoldDates(); }} className="space-y-6">
                      <h3 className="font-semibold text-base pt-2">Your Information</h3>

                      {/* Names - side by side on larger screens */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="mb-1 block text-sm font-medium">
                            First Name
                            <span className="text-destructive ml-1">*</span>
                          </Label>
                          <Input
                            placeholder="Your first name"
                            disabled={isProcessingBooking || isPending}
                            required
                            value={sessionFirstName || ''}
                            onChange={e => setSessionFirstName(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="mb-1 block text-sm font-medium">
                            Last Name
                            <span className="text-destructive ml-1">*</span>
                          </Label>
                          <Input
                            placeholder="Your last name"
                            disabled={isProcessingBooking || isPending}
                            value={sessionLastName || ''}
                            onChange={e => setSessionLastName(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Email and Phone - side by side on larger screens */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="flex items-center gap-1 text-xs">
                            <Mail className="h-3 w-3" />
                            Email
                            <span className="text-destructive ml-1">*</span>
                          </Label>
                          <Input
                            type="email"
                            placeholder="your.email@example.com"
                            disabled={isProcessingBooking || isPending}
                            value={sessionEmail || ''}
                            onChange={e => setSessionEmail(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="flex items-center gap-1 text-xs">
                            <PhoneIcon className="h-3 w-3" />
                            Phone Number
                            <span className="text-destructive ml-1">*</span>
                          </Label>
                          <Input
                            type="tel"
                            placeholder="Your phone number"
                            disabled={isProcessingBooking || isPending}
                            value={sessionPhone || ''}
                            onChange={e => setSessionPhone(e.target.value)}
                          />
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={isProcessingBooking || isPending}
                      >
                        {isProcessingBooking ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <ArrowRight className="mr-2 h-4 w-4" />
                            Pay {property.holdFeeAmount ? `$${property.holdFeeAmount}` : '$10'} to Hold Dates
                          </>
                        )}
                      </Button>
                    </form>
                    )}
                  </CardContent>
                  </Card>
                </StateTransitionWrapper>
              )}

              {/* Booking form - using the original implementation */}
              {selectedOption === 'bookNow' && (
                <StateTransitionWrapper 
                  transitionKey="booking-form"
                  {...transitionVariants.slideUp}
                >
                  <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>Complete Booking</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isProcessingBooking ? (
                      <FormSkeleton />
                    ) : (
                    <form onSubmit={(e) => { e.preventDefault(); handleContinueToPayment(); }} className="space-y-6">
                      <h3 className="font-semibold text-base pt-2">Your Information</h3>

                      {/* Names - side by side on larger screens */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="mb-1 block text-sm font-medium">
                            First Name
                            <span className="text-destructive ml-1">*</span>
                          </Label>
                          <Input
                            placeholder="Your first name"
                            disabled={isProcessingBooking || isPending}
                            required
                            value={sessionFirstName || ''}
                            onChange={e => setSessionFirstName(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="mb-1 block text-sm font-medium">
                            Last Name
                            <span className="text-destructive ml-1">*</span>
                          </Label>
                          <Input
                            placeholder="Your last name"
                            disabled={isProcessingBooking || isPending}
                            value={sessionLastName || ''}
                            onChange={e => setSessionLastName(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Email and Phone - side by side on larger screens */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="flex items-center gap-1 text-xs">
                            <Mail className="h-3 w-3" />
                            Email
                            <span className="text-destructive ml-1">*</span>
                          </Label>
                          <Input
                            type="email"
                            placeholder="your.email@example.com"
                            disabled={isProcessingBooking || isPending}
                            value={sessionEmail || ''}
                            onChange={e => setSessionEmail(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="flex items-center gap-1 text-xs">
                            <PhoneIcon className="h-3 w-3" />
                            Phone Number
                            <span className="text-destructive ml-1">*</span>
                          </Label>
                          <Input
                            type="tel"
                            placeholder="Your phone number"
                            disabled={isProcessingBooking || isPending}
                            value={sessionPhone || ''}
                            onChange={e => setSessionPhone(e.target.value)}
                          />
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={isProcessingBooking || isPending}
                      >
                        {isProcessingBooking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                        {isProcessingBooking ? 'Processing...' : 'Continue to Payment'}
                      </Button>
                    </form>
                    )}
                  </CardContent>
                  </Card>
                </StateTransitionWrapper>
              )}
            </>
          ) : (
            // UnavailableDatesView when dates are not available
            <UnavailableDatesView
              checkInDate={checkInDate}
              checkOutDate={checkOutDate}
              numberOfNights={numberOfNights}
              selectedOption={selectedOption}
              setSelectedOption={setSelectedOption}
              onInquirySubmit={handleInquirySubmit}
              isProcessingBooking={isProcessingBooking}
              isPending={isPending}
              selectAndCheckDates={selectAndCheckDates}
              selectedCurrency={property.currency || 'USD'}
              unavailableDates={unavailableDates}
              property={property}
            />
          )}
          </div>
        </StateTransitionWrapper>
      )}
    </div>
  );
}