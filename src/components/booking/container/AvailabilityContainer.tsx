"use client";

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useBooking } from '@/contexts/BookingContext';
import { format, startOfDay } from 'date-fns';
import { getFeatureFlag } from '@/config/featureFlags';
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
import { checkAvailability } from '@/services/availabilityService';
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
export const AvailabilityContainer = React.memo(function AvailabilityContainer({
  property,
  initialCheckIn,
  initialCheckOut,
  className
}: AvailabilityContainerProps) {
  // Component initialized
  
  // Get language hook for translations
  const { tc } = useLanguage();
  
  // Get values from booking context
  const {
    checkInDate,
    checkOutDate,
    numberOfNights,
    numberOfGuests, // BUG FIX: Add numberOfGuests from context
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
    setMessage: setContextMessage,
    // Get centralized pricing state
    pricingDetails,
    isPricingLoading,
    pricingError,
    // Get pricing actions
    fetchPricing,
    resetPricing
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
  
  // Handler for checking availability - simplified to sync with EnhancedAvailabilityChecker
  const handleCheckAvailability = useCallback(async () => {
    console.log(`[AvailabilityContainer] 🔄 HANDLE_CHECK_AVAILABILITY called:`, {
      hasCheckIn: !!checkInDate,
      hasCheckOut: !!checkOutDate,
      isCheckingAvailability,
      wasChecked,
      isAvailable
    });
    
    if (!checkInDate || !checkOutDate) {
      console.log(`[AvailabilityContainer] ⚠️ Missing dates, skipping availability check`);
      return;
    }
    
    setIsCheckingAvailability(true);
    
    try {
      // Use the service to check availability
      console.log(`[AvailabilityContainer] 🔍 Checking availability for property:`, property.slug);
      const result = await checkAvailability(
        property.slug,
        checkInDate,
        checkOutDate
      );
      
      console.log(`[AvailabilityContainer] 🗓️ Checking dates: ${checkInDate.toDateString()} to ${checkOutDate.toDateString()}`);
      console.log(`[AvailabilityContainer] ✅ Availability result: ${result.isAvailable ? 'AVAILABLE' : 'NOT AVAILABLE'}`);
      
      // Store the unavailable dates for the calendar view
      setUnavailableDates(result.unavailableDates);
      
      // Set the availability state - CRITICAL for UI rendering
      setIsAvailable(result.isAvailable);
      setWasChecked(true);
      
      console.log(`[AvailabilityContainer] 🔄 State updated: wasChecked=true, isAvailable=${result.isAvailable}`);
      
      // If available, fetch pricing data using the centralized context function
      if (result.isAvailable) {
        console.log(`[AvailabilityContainer] 💰 Dates are available, fetching centralized pricing data`);
        
        // Fetch pricing data using the context's centralized function ONLY
        // No manual API call should be made here
        fetchPricing().catch(error => {
          console.error(`[AvailabilityContainer] ❌ Error fetching centralized pricing:`, error);
        });
      }
    } catch (error) {
      console.error('[AvailabilityContainer] ❌ Error checking availability:', error);
      // MODIFIED: For cloud compatibility, assume available on error
      setIsAvailable(true);
      setWasChecked(true);
      toast({
        title: "Warning",
        description: "Could not verify availability. Proceeding as available.",
        variant: "warning"
      });
    } finally {
      setIsCheckingAvailability(false);
    }
  }, [checkInDate, checkOutDate, property.slug, toast, isCheckingAvailability, 
      wasChecked, isAvailable, fetchPricing]);
  
  // Handler for selecting and checking new dates
  const selectAndCheckDates = useCallback(async (newCheckIn: Date, newCheckOut: Date) => {
    console.log(`Setting new dates: ${newCheckIn.toDateString()} - ${newCheckOut.toDateString()}`);

    // Reset pricing first to avoid displaying stale data
    resetPricing();

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
  }, [setCheckInDate, setCheckOutDate, handleCheckAvailability, resetPricing]);

  // Handler for check-in date changes
  const handleCheckInChange = useCallback((date: Date | null) => {
    console.log(`Check-in date changed: ${date?.toDateString() || 'null'}`);
    
    // Reset pricing when date changes
    resetPricing();
    
    setCheckInDate(date);

    // Reset availability state when dates change
    setWasChecked(false);
    setIsAvailable(null);

    // Optional: When check-in is set to null, also reset checkout
    if (date === null && checkOutDate !== null) {
      setCheckOutDate(null);
    }
  }, [setCheckInDate, checkOutDate, setCheckOutDate, resetPricing]);

  // Handler for check-out date changes
  const handleCheckOutChange = useCallback((date: Date | null) => {
    console.log(`Check-out date changed: ${date?.toDateString() || 'null'}`);
    
    // Reset pricing when date changes
    resetPricing();
    
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
  }, [setCheckOutDate, checkInDate, handleCheckAvailability, resetPricing]);
  
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
          guestCount: numberOfGuests,
          guestInfo: {
            firstName: values.firstName || sessionFirstName,
            lastName: values.lastName || sessionLastName,
            email: values.email || sessionEmail,
            phone: values.phone || sessionPhone,
          },
          message: values.message || sessionMessage || "I'm interested in booking your property.",
          // Use centralized pricing if available
          totalPrice: pricingDetails
            ? pricingDetails.total
            : (pricingDetailsInBaseCurrency
                ? convertToSelectedCurrency(pricingDetailsInBaseCurrency.total, pricingDetailsInBaseCurrency.currency)
                : undefined),
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
      selectedCurrency, toast, startTransition, pricingDetails]);

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
        guestCount: numberOfGuests,
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
      numberOfGuests, selectedCurrency, router, toast]);

  // Handler for continuing to payment
  const handleContinueToPayment = useCallback(async () => {
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
    
    // Check if we have pricing data
    const hasPricingData = pricingDetails || pricingDetailsInBaseCurrency;
    if (!hasPricingData) {
      setFormError("Unable to calculate price for these dates.");
      toast({
        title: "Pricing Error",
        description: "We couldn't calculate the price for these dates. Please try again.",
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
      // Decide which pricing data to use
      const pricingData = pricingDetails || pricingDetailsInBaseCurrency;
      
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
        numberOfGuests: numberOfGuests,
        pricing: {
          // Map fields with safe defaults
          baseRate: pricingData.accommodationTotal || pricingData.basePrice || 0,
          accommodationTotal: pricingData.accommodationTotal || 
                             ((pricingData.basePrice || 0) + (pricingData.extraGuestFeeTotal || 0)),
          cleaningFee: pricingData.cleaningFee || 0,
          // These two are optional in the schema, but set them to 0 to avoid undefined
          extraGuestFee: pricingData.extraGuestFeeTotal || 0,
          numberOfExtraGuests: pricingData.numberOfExtraGuests || 0,
          // Required fields with safe defaults
          subtotal: pricingData.subtotal || 0,
          discountAmount: pricingData.discountAmount || 0,
          total: pricingData.total || 0,
          currency: selectedCurrency,
          numberOfNights: pricingData.numberOfNights || numberOfNights || 0,
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
        numberOfGuests: numberOfGuests,
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
  }, [checkInDate, checkOutDate, property, numberOfGuests, pricingDetails, pricingDetailsInBaseCurrency, 
      numberOfNights, sessionFirstName, sessionLastName, sessionEmail, sessionPhone, selectedCurrency, 
      router, toast]);
  
  // Handler for updating the guest count - with centralized pricing sync
  const handleGuestCountChange = useCallback((count: number) => {
    console.log(`[AvailabilityContainer] 🧑‍🤝‍🧑 Guest count changed to: ${count} - updating local state and context`);
    
    // Update both local state and context state
    setGuestCount(count);
    setNumberOfGuests(count);
    
    // If dates are selected and availability was already checked, refetch pricing
    // This is now the ONLY place that triggers pricing updates for guest count changes
    if (checkInDate && checkOutDate && wasChecked && isAvailable) {
      console.log(`[AvailabilityContainer] 🔄 Guest count changed with valid dates - refetching pricing`);
      
      // Let BookingContext handle the pricing fetch - rely completely on centralized pricing
      fetchPricing().catch(error => {
        console.error(`[AvailabilityContainer] ❌ Error refetching pricing:`, error);
      });
    }
  }, [setNumberOfGuests, checkInDate, checkOutDate, wasChecked, isAvailable, fetchPricing]);
  
  // Handler for external pricing data - completely ignored since we use centralized pricing
  const handlePricingDataReceived = useCallback(() => {
    console.log(`[AvailabilityContainer] 📊 External pricing data callback received - COMPLETELY IGNORED, using centralized pricing only`);
    // Do nothing - the BookingContext will handle all pricing data management
  }, []);

  // Initialize local state from context and sync changes
  React.useEffect(() => {
    // Initialize from context
    if (contextFirstName) setSessionFirstName(contextFirstName);
    if (contextLastName) setSessionLastName(contextLastName);
    if (contextEmail) setSessionEmail(contextEmail);
    if (contextPhone) setSessionPhone(contextPhone);
    if (contextMessage) setSessionMessage(contextMessage);
  }, [contextFirstName, contextLastName, contextEmail, contextPhone, contextMessage]);

  // We don't need a local pricing calculation anymore - completely rely on BookingContext
  // This removes a source of duplicate API calls and pricing state inconsistencies

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
        <div>DEBUG (v1.3.1): wasChecked={wasChecked ? 'true' : 'false'} | isAvailable={isAvailable ? 'true' : 'false'}</div>
        <div>guestCount={numberOfGuests} | hasPricing={pricingDetails ? 'true' : 'false'} | isPricingLoading={isPricingLoading ? 'true' : 'false'}</div>
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
              {/* Booking summary component with centralized pricing */}
              
              {isPricingLoading ? (
                <BookingSummarySkeleton />
              ) : pricingDetails ? (
                <>
                  {/* COMMENTED OUT: BookingSummary component removed from UI per user request */}
                  {/*
                  <BookingSummary 
                    numberOfNights={numberOfNights}
                    numberOfGuests={numberOfGuests}
                    pricingDetails={null}
                    propertyBaseCcy={property.currency || 'USD'}
                    appliedCoupon={appliedCoupon}
                    dynamicPricing={pricingDetails}
                    isLoadingPricing={isPricingLoading}
                  />
                  */}
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
                        // Retry fetching pricing data
                        fetchPricing().catch(error => {
                          console.error(`[AvailabilityContainer] ❌ Retry failed:`, error);
                        });
                      }}
                    >
                      Retry
                    </Button>
                  )}
                </div>
              )}
              
              {/* Only show booking options when pricing is available */}
              {(pricingDetails || pricingDetailsInBaseCurrency) ? (
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
});